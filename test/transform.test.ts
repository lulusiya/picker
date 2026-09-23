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
})
