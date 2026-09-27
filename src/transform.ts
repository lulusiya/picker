import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { parse } from '@babel/parser'
import traverseModule from '@babel/traverse'
import MagicString from 'magic-string'

const traverse = (traverseModule as unknown as { default?: typeof traverseModule }).default ?? traverseModule
const nodeRequire = createRequire(import.meta.url)

interface VueCompilers {
  parseSfc: typeof import('@vue/compiler-sfc').parse
  parseTemplate: typeof import('@vue/compiler-dom').parse
}

let vueCompilers: VueCompilers | undefined

/**
 * The Vue compilers are around 3 MB and are only needed for `.vue` files, so they
 * are required on first use instead of at import time. A React-only dev server
 * never pays the ~75 ms it costs to parse them.
 */
function loadVueCompilers(): VueCompilers {
  if (!vueCompilers) {
    try {
      const sfc: typeof import('@vue/compiler-sfc') = nodeRequire('@vue/compiler-sfc')
      const dom: typeof import('@vue/compiler-dom') = nodeRequire('@vue/compiler-dom')
      vueCompilers = { parseSfc: sfc.parse, parseTemplate: dom.parse }
    } catch (cause) {
      throw new Error(
        'vite-plugin-picker needs @vue/compiler-sfc to instrument .vue files. Install it with: npm i -D @vue/compiler-sfc',
        { cause },
      )
    }
  }
  return vueCompilers
}

/**
 * Vite module ids are slash-separated while `path.resolve` returns native
 * separators, and both reach the instrumenters below, so the component name can
 * not come from `path.basename` (POSIX does not split on backslashes).
 */
function baseName(file: string): string {
  return file.slice(Math.max(file.lastIndexOf('/'), file.lastIndexOf('\\')) + 1)
}

export interface SourceRecord {
  file: string
  line: number
  column: number
  range: {
    start: { line: number; column: number }
    end: { line: number; column: number }
  }
  component?: string
}

export interface TransformResult {
  code: string
  map: ReturnType<MagicString['generateMap']>
  records: Map<string, SourceRecord>
}

/** React capitalises components, so this is what separates a component from a
 * helper function that happens to return JSX. */
const COMPONENT_NAME = /^[A-Z]/

/**
 * The nearest enclosing name that looks like a component.
 *
 * Walking stops at the first capitalised candidate, so an inner helper
 * (`const renderRow = () => <tr/>` inside `App`) cannot be mistaken for the
 * component that contains it. When nothing is capitalised the first name found
 * still beats having none - a lowercase local at least points somewhere real.
 */
function componentName(path: string): string | undefined {
  let current: any = path
  let fallback: string | undefined
  while (current) {
    const node = current.node
    let name: string | undefined
    if (current.isFunctionDeclaration?.() || current.isFunctionExpression?.()) name = node.id?.name
    else if (current.isClassDeclaration?.() || current.isClassExpression?.()) name = node.id?.name
    else if (current.isVariableDeclarator?.() && node.id?.type === 'Identifier') name = node.id.name
    if (name) {
      if (COMPONENT_NAME.test(name)) return name
      fallback ??= name
    }
    current = current.parentPath
  }
  return fallback
}

/**
 * A JSX tag names a DOM element only when it starts lowercase: `<div>` is a host
 * element, while `<Card>` and `<Foo.Bar>` are components. Injecting into a
 * component would hand it a `data-picker` *prop* that it usually drops, and
 * `<Fragment data-picker>` is a React warning, so only host tags are stamped -
 * the same rule `instrumentVueSfc` applies with `tagType === 0`.
 */
function isHostElement(name: any): boolean {
  return name?.type === 'JSXIdentifier' && /^[a-z]/.test(name.name)
}

/**
 * Every JSX opening tag starts with `<` followed by `>`, an identifier start, or
 * a name character, so this cannot hide real JSX - it only lets plain modules
 * skip the parser entirely. `a<b` slips through as a false positive, which costs
 * one parse and nothing else.
 */
const MAY_CONTAIN_JSX = /<[A-Za-z_$>]/

/** Adds source locators to native elements in JSX/TSX. Returns null when the
 * source is not parseable as JSX, so callers never see a syntax error. */
export function instrumentJsx(code: string, file: string): TransformResult | null {
  if (!MAY_CONTAIN_JSX.test(code)) return null
  let ast: ReturnType<typeof parse>
  try {
    ast = parse(code, {
      sourceType: 'module',
      sourceFilename: file,
      plugins: ['jsx', 'typescript', 'decorators-legacy', 'classProperties', 'importAttributes'],
    })
  } catch {
    // Not JSX/TSX, so there is nothing to instrument (a Svelte or Astro file).
    return null
  }
  const magic = new MagicString(code)
  const records = new Map<string, SourceRecord>()
  const fileHash = createHash('sha1').update(file).digest('hex').slice(0, 8)
  // An anonymous default export has no name to walk up to, so the file itself is
  // the last resort - the same fallback a Vue SFC gets from its filename.
  const fileComponent = baseName(file).replace(/\.[cm]?[jt]sx?$/i, '') || undefined

  traverse(ast, {
    JSXOpeningElement(path: any) {
      const node = path.node
      if (!node.loc || !isHostElement(node.name)) return
      const hasLocator = node.attributes.some(
        (attribute: any) => attribute.type === 'JSXAttribute' && attribute.name?.name === 'data-picker',
      )
      if (hasLocator) return

      const line = node.loc.start.line
      const column = node.loc.start.column + 1
      const sourceNode = path.parentPath?.node?.type === 'JSXElement' ? path.parentPath.node : node
      const end = sourceNode.loc?.end ?? node.loc.end
      const id = `${fileHash}:${line}:${column}`
      const insertAt = node.name.end
      if (typeof insertAt !== 'number') return

      magic.appendLeft(insertAt, ` data-picker="${id}"`)
      records.set(id, {
        file,
        line,
        column,
        range: {
          start: { line, column },
          end: { line: end.line, column: end.column + 1 },
        },
        component: componentName(path) ?? fileComponent,
      })
    },
  })

  if (records.size === 0) return null
  return {
    code: magic.toString(),
    map: magic.generateMap({ hires: true, source: file, includeContent: true }),
    records,
  }
}

function offsetLocation(code: string, offset: number): { line: number; column: number } {
  const before = code.slice(0, offset)
  const lines = before.split(/\r?\n/)
  return { line: lines.length, column: (lines.at(-1)?.length ?? 0) + 1 }
}

/** Parses a component template, returning null when the source is not a valid
 * SFC: a parse error and a missing `<template>` are the same "nothing to do". */
function parseSfcTemplate(code: string, file: string) {
  // Outside the try: a missing dependency must surface, not look like bad source.
  const { parseSfc, parseTemplate } = loadVueCompilers()
  try {
    const { descriptor, errors } = parseSfc(code, { filename: file })
    if (errors.length || !descriptor.template) return null
    const template = descriptor.template
    return { template, ast: parseTemplate(template.content, { comments: true }) }
  } catch {
    return null
  }
}

/** Adds source locators to native elements in a Vue 3 SFC template. */
export function instrumentVueSfc(code: string, file: string): TransformResult | null {
  const parsed = parseSfcTemplate(code, file)
  if (!parsed) return null
  const { template, ast } = parsed

  const magic = new MagicString(code)
  const records = new Map<string, SourceRecord>()
  const fileHash = createHash('sha1').update(file).digest('hex').slice(0, 8)
  const component = baseName(file).replace(/\.vue$/i, '')
  const templateOffset = template.loc.start.offset

  function visit(node: any): void {
    // Vue compiler: NodeTypes.ELEMENT === 1, ElementTypes.ELEMENT === 0.
    if (node?.type === 1 && node.tagType === 0) {
      const alreadyLocated = node.props?.some(
        (prop: any) => prop.type === 6 && prop.name === 'data-picker',
      )
      if (!alreadyLocated) {
        const absoluteOffset = templateOffset + node.loc.start.offset
        const location = offsetLocation(code, absoluteOffset)
        const end = offsetLocation(code, templateOffset + node.loc.end.offset)
        const id = `${fileHash}:${location.line}:${location.column}`
        const insertAt = absoluteOffset + 1 + node.tag.length
        magic.appendLeft(insertAt, ` data-picker="${id}"`)
        records.set(id, {
          file,
          ...location,
          range: { start: location, end },
          component,
        })
      }
    }
    if (Array.isArray(node?.children)) node.children.forEach(visit)
  }

  visit(ast)
  if (records.size === 0) return null
  return {
    code: magic.toString(),
    map: magic.generateMap({ hires: true, source: file, includeContent: true }),
    records,
  }
}
