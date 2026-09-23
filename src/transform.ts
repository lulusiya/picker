import { createHash } from 'node:crypto'
import { parse } from '@babel/parser'
import traverseModule from '@babel/traverse'
import { parse as parseVueTemplate } from '@vue/compiler-dom'
import { parse as parseVueSfc } from '@vue/compiler-sfc'
import MagicString from 'magic-string'

const traverse = (traverseModule as unknown as { default?: typeof traverseModule }).default ?? traverseModule

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

function componentName(path: string): string | undefined {
  let current: any = path
  while (current) {
    if (current.isFunctionDeclaration?.() && current.node.id?.name) return current.node.id.name
    if (current.isClassDeclaration?.() && current.node.id?.name) return current.node.id.name
    if (current.isVariableDeclarator?.() && current.node.id?.type === 'Identifier') return current.node.id.name
    current = current.parentPath
  }
  return undefined
}

export function instrumentJsx(code: string, file: string): TransformResult | null {
  const ast = parse(code, {
    sourceType: 'module',
    sourceFilename: file,
    plugins: ['jsx', 'typescript', 'decorators-legacy', 'classProperties', 'importAttributes'],
  })
  const magic = new MagicString(code)
  const records = new Map<string, SourceRecord>()
  const fileHash = createHash('sha1').update(file).digest('hex').slice(0, 8)

  traverse(ast, {
    JSXOpeningElement(path: any) {
      const node = path.node
      if (!node.loc || node.name.type === 'JSXNamespacedName') return
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
        component: componentName(path),
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

/** Adds source locators to native elements in a Vue 3 SFC template. */
export function instrumentVueSfc(code: string, file: string): TransformResult | null {
  const { descriptor, errors } = parseVueSfc(code, { filename: file })
  if (errors.length || !descriptor.template) return null

  const template = descriptor.template
  const ast = parseVueTemplate(template.content, { comments: true })
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
