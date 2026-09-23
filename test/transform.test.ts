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
