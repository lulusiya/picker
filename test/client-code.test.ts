import { describe, expect, it } from 'vitest'
import { clientCode } from '../src/client-code'

describe('client runtime', () => {
  it('is valid JavaScript after generating the virtual module', () => {
    expect(clientCode).not.toContain('\\`')
    expect(() => new Function(clientCode)).not.toThrow()
  })

  it('renders a persistent ready indicator with a stash button on its left', () => {
    expect(clientCode).toContain('Picker 已启用')
    expect(clientCode).toContain('status-dot')
    expect(clientCode).toContain('按住 Alt 并点击页面元素')
    expect(clientCode).toContain('class="dock"')
    expect(clientCode).toContain('class="stash-btn"')
    expect(clientCode).toContain('class="stash-count"')
  })

  it('no longer offers prompt templates or in-panel multi-add', () => {
    expect(clientCode).not.toContain('提示词模板')
    expect(clientCode).not.toContain('<option value="style">')
    expect(clientCode).not.toContain('promptTemplates')
    expect(clientCode).not.toContain('add-selection')
    expect(clientCode).not.toContain('加入多选')
    expect(clientCode).not.toContain('selection-count')
    expect(clientCode).toContain('placeholder="描述你希望 AI 完成的修改…"')
    expect(clientCode).not.toContain('DOM 层级：')
    expect(clientCode).not.toContain('class="details"')
  })

  it('exposes stash and copy actions on the prompt panel', () => {
    expect(clientCode).toContain('class="action secondary stash-now"')
    expect(clientCode).toContain('class="action copy"')
    expect(clientCode).toContain('function composePrompt')
    expect(clientCode).toContain("'src: ' + context.src")
    expect(clientCode).toContain("'\\nrange: ' + context.range")
    expect(clientCode).toContain('async function componentRange')
    expect(clientCode).toContain("components.join(' > ')")
  })

  it('shows the component location as the panel header and drops the old title', () => {
    expect(clientCode).not.toContain('生成提示词')
    expect(clientCode).toContain('class="panel-target"')
    expect(clientCode).toContain('target-range')
    expect(clientCode).toContain('target-src')
    expect(clientCode).toContain('targetRange.textContent = state.context.range')
    expect(clientCode).toContain('targetSrc.textContent = state.context.src')
  })

  it('closes the prompt panel after stashing, like copy does', () => {
    expect(clientCode).toContain("  record('prompt', instruction)\n  closePanel()\n  showToast('已暂存，共 ' + state.stash.length + ' 条')")
  })

  it('auto-removes copied stash items and offers clear-all', () => {
    expect(clientCode).toContain('class="stash-clear"')
    expect(clientCode).toContain("state.stash = state.stash.filter(item => !selectedStash.has(item.id))")
    expect(clientCode).toContain("已复制 ' + picked.length + ' 条，已从暂存夹移除")
    expect(clientCode).toContain("showToast('已清空 ' + count + ' 条暂存')")
  })

  it('stashes full prompts and renders editable cards with a left checkbox', () => {
    expect(clientCode).toContain('stash: []')
    expect(clientCode).toContain('function renderStashList()')
    expect(clientCode).toContain("showToast('已暂存，共 ' + state.stash.length + ' 条')")
    expect(clientCode).toContain('class="stash-panel"')
    expect(clientCode).toContain("check.className = 'stash-check'")
    expect(clientCode).toContain("field.className = 'stash-text'")
    expect(clientCode).toContain('stash-delete')
    expect(clientCode).toContain('stash-copy')
    expect(clientCode).toContain('stashSelectAll')
  })

  it('edits stash cards in place without jumping to another panel', () => {
    expect(clientCode).toContain("item.full = composePrompt([item.context], item.instruction)")
    expect(clientCode).toContain('暂存夹')
    expect(clientCode).toContain("field.placeholder = '输入修改要求…'")
    expect(clientCode).not.toContain('loadStashItem')
    expect(clientCode).not.toContain('stash-edit')
    expect(clientCode).not.toContain('>编辑<')
    expect(clientCode).not.toContain('positionPanelBottom')
    expect(clientCode).not.toContain('stash-hint')
    expect(clientCode).not.toContain('点击文字可直接原地修改')
  })

  it('dismisses overlays and picks targets via Alt+click', () => {
    expect(clientCode).toContain('function closeStash()')
    expect(clientCode).toContain('function pickTarget(element)')
    expect(clientCode).toContain('event.stopImmediatePropagation()')
  })

  it('has no open-in-editor action', () => {
    expect(clientCode).not.toContain('open-editor')
    expect(clientCode).not.toContain('__open-in-editor')
  })

  it('offers Pi push through a switch instead of a routing row', () => {
    expect(clientCode).not.toContain('发送给')
    expect(clientCode).not.toContain('class="routing"')
    expect(clientCode).not.toContain('addRoute')
    expect(clientCode).not.toContain('state.target')
    expect(clientCode).toContain('class="pi-toggle"')
    expect(clientCode).toContain('class="pi-glyph"')
    expect(clientCode).toContain("setAttribute('aria-pressed'")
    expect(clientCode).toContain('localStorage.getItem(PI_PUSH_KEY)')
    expect(clientCode).toContain('localStorage.setItem(PI_PUSH_KEY')
  })

  it('pushes the current pick on demand and on Enter', () => {
    expect(clientCode).toContain('class="action secondary push-once"')
    expect(clientCode).toContain('/__picker/push')
    expect(clientCode).not.toContain('push-toggle')
    expect(clientCode).not.toContain('实时推送')
    expect(clientCode).toContain("await record('prompt', textarea.value)")
    expect(clientCode).toContain("postPush({ once: true, target: '' })")
    expect(clientCode).toContain("if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return")
  })

  // Pushing injects into a session that is running right now. The switch is the
  // user's intent; a fresh heartbeat is the capability. Both are needed, so the
  // button can never promise a delivery that goes nowhere.
  it('only offers immediate push while the switch is on and an agent listens', () => {
    expect(clientCode).toContain("fetch('/__picker/listeners')")
    expect(clientCode).toContain('function canPush()')
    expect(clientCode).toContain('return piPush && listeners.length > 0')
    expect(clientCode).toContain('pushOnceButton.hidden = !canPush()')
    expect(clientCode).toContain("result.reason === 'no-listener'")
    // The old "success no matter what" toast is gone.
    expect(clientCode).not.toContain("'已推送到会话'")
  })

  // Only a host that can inject into a running session beats a heartbeat (Pi
  // today), so liveness is the whole capability check. There is no second
  // "queue" notion for agents that are merely read on their next prompt.
  it('treats a live heartbeat as the only push capability', () => {
    expect(clientCode).not.toContain('pushListeners')
    expect(clientCode).not.toContain("mode === 'push'")
    expect(clientCode).toContain('function liveAgentNames()')
    expect(clientCode).toContain('type="button" hidden title="立即推送到当前目标的会话"')
  })

  it('falls back to copy on Enter when nothing can take a push', () => {
    expect(clientCode).toContain('async function copyNow()')
    expect(clientCode).toContain("copyButton.addEventListener('click', copyNow)")
    expect(clientCode).toContain('if (canPush()) pushNow()')
    expect(clientCode).toContain('else copyNow()')
  })

  it('themes the overlay through CSS variables with a blue accent', () => {
    expect(clientCode).toContain('--picker-accent: #2563eb')
    expect(clientCode).toContain('border:2px solid var(--picker-accent)')
    expect(clientCode).not.toContain('#7c3aed')
    expect(clientCode).not.toContain('#8b5cf6')
    expect(clientCode).not.toContain('#6d28d9')
    expect(clientCode).not.toContain('rgb(124 58 237')
  })

  it('keeps a breathing gap around the highlighted element', () => {
    expect(clientCode).toContain('const HIGHLIGHT_GAP = 5')
    expect(clientCode).toContain('rect.left - gap')
    expect(clientCode).toContain('rect.width + gap * 2')
  })

  it('keeps the hover highlight aligned while scrolling with Alt held', () => {
    expect(clientCode).toContain('state.selected || (state.alt ? state.hovered : null)')
    expect(clientCode).toContain("window.addEventListener('scroll', syncHighlightPosition, true)")
    expect(clientCode).toContain("window.addEventListener('resize', syncHighlightPosition)")
  })
})
