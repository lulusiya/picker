import { describe, expect, it } from 'vitest'
import { instrumentJsx, instrumentVueSfc } from '../src/transform'

describe('instrumentJsx', () => {
  it('adds source ids to JSX elements and records their locations', () => {
    const source = `export function Card() {\n  return <div className="card"><span>Hello</span></div>\n}`
    const result = instrumentJsx(source, 'C:\\project\\src\\Card.tsx')
    expect(result?.code).toContain('<div data-picker="')
    expect(result?.code).toContain('<span data-picker="')
    expect([...result!.records.values()]).toEqual([
      expect.objectContaining({ line: 2, component: 'Card', range: expect.any(Object) }),
      expect.objectContaining({ line: 2, component: 'Card', range: expect.any(Object) }),
    ])
  })

  it('does not add the attribute twice', () => {
    const result = instrumentJsx('const App = () => <div data-picker="custom" />', 'App.tsx')
    expect(result).toBeNull()
  })

  // A component tag would receive `data-picker` as a prop, which React drops or
  // warns about (`<Fragment data-picker>`), so only lowercase host tags are
  // stamped - the mirror of the `tagType === 0` rule in the Vue instrumenter.
  it('stamps host elements only, never components', () => {
    const source = 'export default function App() {\n  return <Layout><StatCard value={1} /><span>x</span></Layout>\n}'
    const result = instrumentJsx(source, 'App.tsx')

    expect(result?.code).toContain('<span data-picker="')
    expect(result?.code).toContain('<Layout>')
    expect(result?.code).toContain('<StatCard value={1} />')
    expect(result?.code).not.toContain('<Layout data-picker')
    expect(result?.code).not.toContain('<StatCard data-picker')
    expect(result!.records.size).toBe(1)
  })

  it('ignores member-expression components', () => {
    const result = instrumentJsx('const A = () => <UI.Card><div className="x" /></UI.Card>', 'A.tsx')
    expect(result?.code).toContain('<UI.Card>')
    expect(result?.code).toContain('<div data-picker="')
    expect(result!.records.size).toBe(1)
  })

  // `renderRow` returns JSX but is not the component the user clicked inside.
  it('prefers the enclosing component over an inner lowercase helper', () => {
    const source = 'function App() {\n  const renderRow = (x) => <tr><td>row</td></tr>\n  return <table>{[1].map(renderRow)}</table>\n}'
    const result = instrumentJsx(source, 'App.tsx')
    expect([...result!.records.values()].map(record => record.component)).toEqual(['App', 'App', 'App'])
  })

  it('names the component for every common definition shape', () => {
    const cases: Array<[string, string]> = [
      ['function declaration', 'export default function Card() { return <div /> }'],
      ['arrow in a const', 'const Card = () => <div />'],
      ['React.memo', 'const Card = React.memo(function Card() { return <div /> })'],
      ['React.forwardRef', 'const Card = React.forwardRef((props, ref) => <div />)'],
      ['class component', 'class Card extends React.Component { render() { return <div /> } }'],
      ['named function expression in a HOC', 'export default connect()(function Card() { return <div /> })'],
    ]

    for (const [label, source] of cases) {
      const result = instrumentJsx(source, 'C:\app\src\Whatever.tsx')
      expect([...result!.records.values()][0].component, label).toBe('Card')
    }
  })

  // Nothing to walk up to, so the file answers for the component - the same
  // fallback a Vue SFC gets from its own filename.
  it('falls back to the filename for an anonymous component', () => {
    const result = instrumentJsx('export default () => <div className="x" />', 'C:\\app\\src\\StatCard.tsx')
    expect([...result!.records.values()][0].component).toBe('StatCard')
  })

  // The declared return type is `TransformResult | null`, so an unparseable
  // source has to come back as null rather than as a thrown syntax error.
  it('returns null instead of throwing on sources that are not JSX', () => {
    const svelte = '<script>\n  let n = 0\n</script>\n\n<button on:click={() => n++}>{n}</button>\n'
    expect(() => instrumentJsx(svelte, 'Counter.svelte')).not.toThrow()
    expect(instrumentJsx(svelte, 'Counter.svelte')).toBeNull()
  })
})

describe('instrumentVueSfc', () => {
  it('adds source ids to native Vue template elements', () => {
    const source = `<script setup lang="ts">\nconst title = 'Hello'\n</script>\n\n<template>\n  <main class="card">\n    <button @click="console.log(title)">{{ title }}</button>\n    <UserAvatar />\n  </main>\n</template>\n`
    const result = instrumentVueSfc(source, 'C:\\project\\src\\UserCard.vue')

    expect(result?.code).toContain('<main data-picker="')
    expect(result?.code).toContain('<button data-picker="')
    expect(result?.code).toContain('<UserAvatar />')
    expect(result?.records.size).toBe(2)
    expect([...result!.records.values()]).toEqual([
      expect.objectContaining({ line: 6, column: 3, component: 'UserCard', range: { start: { line: 6, column: 3 }, end: { line: 9, column: 10 } } }),
      expect.objectContaining({ line: 7, column: 5, component: 'UserCard', range: { start: { line: 7, column: 5 }, end: { line: 7, column: 61 } } }),
    ])
  })

  it('supports directives and does not add duplicate locators', () => {
    const source = `<template><div v-if="ok" data-picker="existing"><span v-for="x in xs">{{ x }}</span></div></template>`
    const result = instrumentVueSfc(source, 'List.vue')
    expect(result?.code.match(/data-picker=/g)).toHaveLength(2)
    expect(result?.records.size).toBe(1)
  })

  // Vite hands over slash-separated ids while the plugin resolves native paths,
  // so both separators reach the instrumenter. Splitting with `path.basename`
  // only works on the host that produced the path.
  it('derives the component name from either path separator', () => {
    const source = '<template>\n  <main />\n</template>\n'
    const componentOf = (file: string) => [...instrumentVueSfc(source, file)!.records.values()][0].component

    expect(componentOf('C:\\project\\src\\UserCard.vue')).toBe('UserCard')
    expect(componentOf('/home/picker/src/UserCard.vue')).toBe('UserCard')
    expect(componentOf('UserCard.vue')).toBe('UserCard')
  })

  it('returns null instead of throwing on sources that are not Vue SFCs', () => {
    const astro = '---\nconst title = 1\n---\n\n<div>{title}</div>\n'
    expect(() => instrumentVueSfc(astro, 'Page.astro')).not.toThrow()
    expect(instrumentVueSfc(astro, 'Page.astro')).toBeNull()
    expect(instrumentVueSfc('<script setup>const a = 1</script>', 'NoTemplate.vue')).toBeNull()
  })
})
