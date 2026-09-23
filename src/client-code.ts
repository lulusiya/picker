const rawClientCode = String.raw`
const PICK_ATTRIBUTE = 'data-picker'
const HIGHLIGHT_GAP = 5
const state = { alt: false, selected: null, hovered: null, context: null, stash: [], stashOpen: false, target: '' }
let stashSeq = 0
const selectedStash = new Set()
const runtimeConfig = globalThis.__PICKER_CONFIG__ || {}

const host = document.createElement('div')
host.setAttribute('data-picker-ui', '')
const root = host.attachShadow({ mode: 'open' })
root.innerHTML = \`
  <style>
    :host { all: initial }
    :host {
      --picker-accent: #2563eb;
      --picker-accent-hover: #1d4ed8;
      --picker-accent-soft: #3b82f6;
      --picker-accent-border: #93c5fd;
      --picker-accent-tint: #eff6ff;
      --picker-accent-ring: rgb(37 99 235 / 25%);
      --picker-accent-ring-soft: rgb(37 99 235 / 12%);
      --picker-accent-focus: rgb(59 130 246 / 14%);
      --picker-on-accent: #fff;
      --picker-ink: #18181b;
      --picker-ink-strong: #27272a;
      --picker-ink-soft: #3f3f46;
      --picker-ink-route: #52525b;
      --picker-muted: #8b8b95;
      --picker-muted-strong: #a1a1aa;
      --picker-muted-soft: #a6a6b0;
      --picker-muted-faint: #b6b6c0;
      --picker-placeholder: #c9c9d2;
      --picker-surface: #fff;
      --picker-surface-1: rgb(255 255 255 / 94%);
      --picker-surface-2: rgb(255 255 255 / 97%);
      --picker-fill: #f4f4f5;
      --picker-fill-hover: #e4e4e7;
      --picker-fill-soft: #fafafc;
      --picker-rule: #e4e4e7;
      --picker-rule-strong: #d4d4d8;
      --picker-rule-faint: #f1f1f3;
      --picker-success: #22c55e;
      --picker-success-bg: #f0fdf4;
      --picker-success-border: #bbf7d0;
      --picker-success-ink: #166534;
      --picker-success-ring: rgb(34 197 94 / 16%);
      --picker-danger: #dc2626;
      --picker-danger-bg: #fef2f2;
      --picker-danger-bg-hover: #fee2e2;
      --picker-danger-border: #fecaca;
      --picker-shadow-sm: 0 5px 18px rgb(0 0 0 / 14%);
      --picker-shadow-md: 0 8px 24px rgb(0 0 0 / 16%);
      --picker-shadow-lg: 0 24px 60px rgb(0 0 0 / 22%),0 4px 10px rgb(0 0 0 / 7%);
    }
    .box { display:none; position:fixed; pointer-events:none; z-index:2147483646; box-sizing:border-box; border:2px solid var(--picker-accent); border-radius:7px; box-shadow:0 0 0 1px var(--picker-accent-ring) }
    .tag { position:absolute; top:-27px; left:-2px; padding:3px 8px; border-radius:5px 5px 0 0; background:var(--picker-accent); color:var(--picker-on-accent); font:12px/18px ui-monospace,monospace; white-space:nowrap }
    .dock { position:fixed; z-index:2147483645; right:14px; bottom:14px; display:flex; align-items:center; gap:8px }
    .stash-btn { display:flex; align-items:center; gap:6px; padding:7px 11px; border:1px solid var(--picker-rule-strong); border-radius:999px; background:var(--picker-surface-1); color:var(--picker-ink-soft); cursor:pointer; box-shadow:var(--picker-shadow-sm); font:600 12px/1 system-ui,sans-serif; user-select:none; backdrop-filter:blur(8px) }
    .stash-btn:hover { border-color:var(--picker-accent-border); background:var(--picker-surface) }
    .stash-count { min-width:16px; padding:1px 5px; border-radius:999px; background:var(--picker-accent); color:var(--picker-on-accent); font:700 10px/1.5 system-ui,sans-serif; text-align:center }
    .status { display:flex; align-items:center; gap:7px; padding:7px 10px; border:1px solid var(--picker-rule-strong); border-radius:999px; background:var(--picker-surface-1); color:var(--picker-ink-soft); box-shadow:var(--picker-shadow-sm); font:600 12px/1 system-ui,sans-serif; user-select:none; backdrop-filter:blur(8px); cursor:default }
    .status-dot { width:8px; height:8px; border-radius:50%; background:var(--picker-success); box-shadow:0 0 0 3px var(--picker-success-ring) }
    .toast { display:none; position:fixed; z-index:2147483647; left:50%; bottom:18px; transform:translateX(-50%); padding:9px 12px; border:1px solid var(--picker-success-border); border-radius:8px; background:var(--picker-success-bg); color:var(--picker-success-ink); box-shadow:var(--picker-shadow-md); font:600 13px/1.4 system-ui,sans-serif; pointer-events:none; white-space:nowrap }
    .panel, .stash-panel { display:none; position:fixed; z-index:2147483647; width:min(376px,calc(100vw - 24px)); box-sizing:border-box; padding:18px 17px 15px; border:1px solid var(--picker-rule); border-radius:16px; background:var(--picker-surface-2); color:var(--picker-ink); box-shadow:var(--picker-shadow-lg); font:13px/1.55 system-ui,-apple-system,'Segoe UI',sans-serif; backdrop-filter:blur(12px) }
    .header { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:13px }
    .title { font-size:14px; font-weight:750; letter-spacing:.1px }
    .stash-panel .title { display:flex; align-items:center; gap:8px }
    .stash-panel .title::before { content:''; width:9px; height:9px; border-radius:50%; background:linear-gradient(135deg,var(--picker-accent-soft),var(--picker-accent-hover)); box-shadow:0 0 0 3px var(--picker-accent-ring-soft) }
    .close { width:30px; height:30px; margin:-4px -4px 0 0; display:grid; place-items:center; border:0; border-radius:9px; background:transparent; color:var(--picker-muted-strong); cursor:pointer; font:21px/1 system-ui,sans-serif }
    .close:hover { background:var(--picker-fill); color:var(--picker-ink-soft) }
    .panel-target { flex:1; min-width:0; display:grid; gap:2px }
    .target-range { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--picker-ink-strong); font:600 13px/1.4 system-ui,sans-serif }
    .target-src { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--picker-muted); font:11px/1.4 ui-monospace,SFMono-Regular,Consolas,'Courier New',monospace }
    .routing { display:flex; flex-wrap:wrap; align-items:center; gap:6px; margin-bottom:11px }
    .routing-label { color:var(--picker-muted); font:11px/1.4 system-ui,sans-serif }
    .route { padding:4px 10px; border:1px solid var(--picker-rule-strong); border-radius:999px; background:var(--picker-surface); color:var(--picker-ink-route); cursor:pointer; font:600 11px/1 system-ui,sans-serif }
    .route:hover { border-color:var(--picker-accent-border); color:var(--picker-accent-hover) }
    .route.active { border-color:var(--picker-accent); background:var(--picker-accent); color:var(--picker-on-accent) }
    .route.live::after { content:''; display:inline-block; width:5px; height:5px; margin-left:5px; border-radius:50%; background:var(--picker-success); vertical-align:middle }
    .route.active.live::after { background:currentColor }
    .action:disabled { opacity:.5; cursor:not-allowed }
    textarea { width:100%; min-height:100px; max-height:200px; box-sizing:border-box; resize:vertical; padding:10px; border:1px solid var(--picker-rule-strong); border-radius:10px; outline:none; font:13px/1.55 system-ui,sans-serif; color:var(--picker-ink-strong) }
    textarea:focus { border-color:var(--picker-accent-soft); box-shadow:0 0 0 3px var(--picker-accent-focus) }
    .actions { display:flex; justify-content:flex-end; gap:8px; margin-top:13px }
    button.action { flex:1; padding:9px 12px; border:0; border-radius:9px; cursor:pointer; background:var(--picker-accent); color:var(--picker-on-accent); font:600 13px/1 system-ui,sans-serif }
    button.action:hover { background:var(--picker-accent-hover) }
    button.secondary { background:var(--picker-fill); color:var(--picker-ink-strong) }
    button.secondary:hover { background:var(--picker-fill-hover) }
    button.action:disabled { cursor:not-allowed; opacity:.5 }
    .stash-panel { width:min(440px,calc(100vw - 24px)) }
    .stash-empty { margin:8px 0; color:var(--picker-muted-strong); font-size:12px; text-align:center }
    .stash-list { display:block; max-height:min(60vh,440px); margin:0; padding:0 6px; overflow:auto; list-style:none }
    .stash-row { display:flex; align-items:center; gap:12px; padding:11px 10px; border-bottom:1px solid var(--picker-rule-faint) }
    .stash-row:last-child { border-bottom:0 }
    .stash-row:hover { background:var(--picker-fill-soft); border-radius:8px }
    .stash-row.sel { background:var(--picker-accent-tint); border-radius:8px }
    .stash-check { flex:none; width:15px; height:15px; margin:0; accent-color:var(--picker-accent); cursor:pointer }
    .stash-main { flex:1; min-width:0 }
    .stash-loc { margin:0 0 5px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--picker-muted-soft); font:10.5px/1.4 ui-monospace,SFMono-Regular,Consolas,'Courier New',monospace }
    .stash-row.sel .stash-loc { color:var(--picker-accent-soft) }
    .stash-main textarea { display:block; width:100%; min-height:44px; max-height:240px; box-sizing:border-box; resize:vertical; padding:0; border:0; background:transparent; color:var(--picker-ink-strong); outline:none; font:13px/1.6 system-ui,-apple-system,'Segoe UI',sans-serif }
    .stash-main textarea::placeholder { color:var(--picker-placeholder) }
    .stash-actions { display:flex; align-items:center; gap:8px; margin-top:11px }
    .stash-select-all { border:0; background:transparent; color:var(--picker-accent); cursor:pointer; font:600 12px/1.4 system-ui,sans-serif; padding:2px 4px }
    .stash-clear { border:0; background:transparent; color:var(--picker-muted-faint); cursor:pointer; font:600 12px/1.4 system-ui,sans-serif; padding:2px 4px }
    .stash-clear:hover:enabled { color:var(--picker-danger) }
    .stash-clear:disabled { cursor:not-allowed; opacity:.45 }
    .stash-actions button.action { flex:0 1 auto; min-width:72px }
    .stash-actions-spacer { flex:1 }
    button.danger { background:var(--picker-danger-bg); color:var(--picker-danger); border:1px solid var(--picker-danger-border) }
    button.danger:hover { background:var(--picker-danger-bg-hover) }
  </style>
  <div class="box"><span class="tag"></span></div>
  <div class="dock">
    <button class="stash-btn" type="button" title="查看暂存的提示词"><span>暂存</span><span class="stash-count" hidden>0</span></button>
    <div class="status" title="按住 Alt 并点击页面元素"><span class="status-dot"></span><span>Picker 已启用</span></div>
  </div>
  <div class="toast" role="status" aria-live="polite"></div>
  <section class="panel" role="dialog" aria-label="Picker Prompt">
    <div class="header"><div class="panel-target" hidden><span class="target-range"></span><span class="target-src"></span></div><button class="close" type="button" title="关闭">×</button></div>
    <div class="routing" hidden><span class="routing-label">发送给</span></div>
    <textarea placeholder="描述你希望 AI 完成的修改…"></textarea>
    <div class="actions"><button class="action secondary push-once" type="button" title="立即推送到当前目标的会话">推送</button><button class="action secondary stash-now" type="button">暂存</button><button class="action copy" type="button">复制</button></div>
  </section>
  <section class="stash-panel" role="dialog" aria-label="暂存夹">
    <div class="header"><span class="title">暂存夹</span><button class="close stash-close" type="button" title="关闭">×</button></div>
    <p class="stash-empty" hidden>还没有暂存的提示词。</p>
    <ul class="stash-list"></ul>
    <div class="stash-actions">
      <button class="stash-select-all" type="button">全选</button>
      <button class="stash-clear" type="button" disabled>清空</button>
      <span class="stash-actions-spacer"></span>
      <button class="action secondary stash-copy" type="button" disabled>复制</button>
      <button class="action danger stash-delete" type="button" disabled>删除</button>
    </div>
  </section>
\`
document.documentElement.appendChild(host)

const box = root.querySelector('.box')
const tag = root.querySelector('.tag')
const panel = root.querySelector('.panel')
const stashPanel = root.querySelector('.stash-panel')
const textarea = root.querySelector('textarea')
const copyButton = root.querySelector('.copy')
const stashNowButton = root.querySelector('.stash-now')
const statusText = root.querySelector('.status span:last-child')
const toast = root.querySelector('.toast')
const stashBtn = root.querySelector('.stash-btn')
const pushOnceButton = root.querySelector('.push-once')
const stashCount = root.querySelector('.stash-count')
const targetRange = root.querySelector('.target-range')
const targetSrc = root.querySelector('.target-src')
const stashList = root.querySelector('.stash-list')
const stashEmpty = root.querySelector('.stash-empty')
const stashSelectAll = root.querySelector('.stash-select-all')
const stashClearButton = root.querySelector('.stash-clear')
const stashCopyButton = root.querySelector('.stash-copy')
const stashDeleteButton = root.querySelector('.stash-delete')
const routing = root.querySelector('.routing')
const agentTargets = Array.isArray(runtimeConfig.targets) ? runtimeConfig.targets : []
// Agents that can inject into a live session, refreshed from the dev server.
const listeners = []
function pushTarget() {
  return state.target || ''
}
function canPush() {
  const wanted = pushTarget()
  return wanted ? listeners.some(item => item.agent === wanted) : listeners.length > 0
}
function pushLabel() {
  return pushTarget() ? '推送给 ' + pushTarget() : '推送'
}function syncRouting() {
  routing.querySelectorAll('.route').forEach(button => {
    const value = button.dataset.target || ''
    button.classList.toggle('active', value === state.target)
    const live = value === '' ? listeners.length > 0 : listeners.some(item => item.agent === value)
    button.classList.toggle('live', live)
    button.title = live
      ? '有 agent 正在监听，可立即推送'
      : '没有 agent 在监听；选取仍会写入 .picker/，可用复制'
  })
  if (pushOnceButton) {
    // Hidden rather than disabled: a disabled button's tooltip is invisible, and
    // every action already writes the pick to .picker/ anyway.
    pushOnceButton.hidden = !canPush()
    pushOnceButton.textContent = pushTarget() ? '推送给 ' + pushTarget() : '推送'
    pushOnceButton.title = '立即推送到正在监听的会话'
  }
}
async function refreshListeners() {
  try {
    const res = await fetch('/__picker/listeners')
    if (res.ok) {
      const body = await res.json()
      listeners.length = 0
      if (Array.isArray(body.listeners)) body.listeners.forEach(item => listeners.push(item))
    }
  } catch {
    // The bridge is best-effort; an unreachable server means nobody is listening.
  }
  syncRouting()
  refreshPanel()
}
setInterval(refreshListeners, 3000)
if (agentTargets.length) {
  routing.hidden = false
  const addRoute = (value, label) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'route'
    button.dataset.target = value
    button.textContent = label
    button.addEventListener('click', () => { state.target = value; syncRouting(); record('pick') })
    routing.appendChild(button)
  }
  addRoute('', '全部')
  agentTargets.forEach(name => addRoute(name, name))
  syncRouting()
}
async function postPush(patch) {
  try {
    const res = await fetch('/__picker/push', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(patch) })
    if (res.status === 409) return { ok: false, reason: 'no-listener' }
    return { ok: res.ok, reason: res.ok ? '' : 'error' }
  } catch {
    return { ok: false, reason: 'offline' }
  }
}
async function pushNow() {
  if (!state.context) return
  await record('prompt', textarea.value)
  const result = await postPush({ once: true, target: pushTarget() })
  textarea.value = ''
  if (result.ok) {
    closePanel()
    showToast(pushTarget() ? '已立即推送给 ' + pushTarget() : '已立即推送给监听中的 agent')
    return
  }
  // The pick is already in .picker/, so nothing is lost - say what actually happened.
  await refreshListeners()
  showToast(result.reason === 'no-listener' ? '没有 agent 在监听，已写入 .picker/，请用复制' : '推送通道不可用，已写入 .picker/，请用复制')
  refreshPanel()
}
pushOnceButton.addEventListener('click', pushNow)
textarea.addEventListener('keydown', event => {
  if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return
  event.preventDefault()
  pushNow()
})
fetch('/__picker/push', { headers: { accept: 'application/json' } })
  .then(response => { if (!response.ok) throw new Error() })
  .catch(() => { pushOnceButton.hidden = true })
let toastTimer

function closestLocated(element) {
  while (element && element !== document.documentElement) {
    if (element.hasAttribute?.(PICK_ATTRIBUTE)) return element
    element = element.parentElement
  }
  return null
}
function stableClass(element) {
  return [...element.classList].filter(name => name.length < 40 && !/[A-Fa-f0-9]{7,}/.test(name)).slice(0, 2)
}
function selectorPart(element) {
  if (element.id) return '#' + CSS.escape(element.id)
  let part = element.tagName.toLowerCase()
  const classes = stableClass(element)
  if (classes.length) part += '.' + classes.map(CSS.escape).join('.')
  const siblings = element.parentElement ? [...element.parentElement.children].filter(e => e.tagName === element.tagName) : []
  if (siblings.length > 1) part += ':nth-of-type(' + (siblings.indexOf(element) + 1) + ')'
  return part
}
function domPath(element) {
  const parts = []
  while (element && element.nodeType === 1 && parts.length < 8) {
    parts.unshift(selectorPart(element))
    if (element.id) break
    element = element.parentElement
  }
  return parts.join(' > ')
}
function highlight(element) {
  const rect = element.getBoundingClientRect()
  const gap = HIGHLIGHT_GAP
  box.style.display = 'block'
  box.style.left = (rect.left - gap) + 'px'
  box.style.top = (rect.top - gap) + 'px'
  box.style.width = (rect.width + gap * 2) + 'px'
  box.style.height = (rect.height + gap * 2) + 'px'
  tag.textContent = element.tagName.toLowerCase() + (element.classList.length ? '.' + stableClass(element).join('.') : '')
}
function hideHighlight() { if (!state.selected) box.style.display = 'none' }
function positionPanel(element) {
  const rect = element.getBoundingClientRect()
  const gap = 10
  const panelRect = panel.getBoundingClientRect()
  let left = rect.right + gap
  let top = rect.bottom + gap
  if (left + panelRect.width > window.innerWidth - 10) left = Math.max(10, rect.right - panelRect.width)
  if (top + panelRect.height > window.innerHeight - 10) top = Math.max(10, rect.top - panelRect.height - gap)
  panel.style.left = left + 'px'; panel.style.top = top + 'px'
}
function positionStashBottom() {
  stashPanel.style.display = 'block'
  const rect = stashPanel.getBoundingClientRect()
  stashPanel.style.left = Math.max(10, window.innerWidth - rect.width - 14) + 'px'
  stashPanel.style.top = Math.max(10, window.innerHeight - rect.height - 62) + 'px'
}
function updateStashBadge() {
  const count = state.stash.length
  stashCount.textContent = String(count)
  stashCount.hidden = count === 0
  stashBtn.title = count ? '查看暂存的提示词（' + count + ' 条）' : '暂存提示词后可从这里查看'
}
function showToast(message) {
  clearTimeout(toastTimer)
  toast.textContent = message
  toast.style.display = 'block'
  toastTimer = setTimeout(() => { toast.style.display = 'none' }, 1800)
}
async function sourceInfo(id) {
  const response = await fetch('/__picker/source?id=' + encodeURIComponent(id), { headers: { accept: 'application/json' } })
  if (!response.ok) throw new Error('无法找到源码位置')
  return response.json()
}
async function record(kind, instruction) {
  if (!state.context || !panel.dataset.id) return
  try {
    await fetch('/__picker/record', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: panel.dataset.id, kind, chain: state.context.range, instruction: instruction || '', target: state.target || '' }),
    })
  } catch {
    // The file bridge is best-effort; never block the UI on it.
  }
}
function composePrompt(contexts, prompt) {
  const sources = contexts.map(context => 'src: ' + context.src + '\nrange: ' + context.range).join('\n\n')
  return prompt.trim() + '\n\n' + sources
}
function refreshPanel() {
  const has = Boolean(state.context)
  const target = root.querySelector('.panel-target')
  target.hidden = !has
  if (has) {
    targetRange.textContent = state.context.range
    targetSrc.textContent = state.context.src
  }
  stashNowButton.disabled = !has
  pushOnceButton.disabled = !has
  copyButton.disabled = !has
  syncRouting()
}
function renderStashList() {
  stashList.replaceChildren()
  const items = state.stash
  stashEmpty.hidden = items.length > 0
  items.forEach((item) => {
    const li = document.createElement('li')
    li.className = 'stash-row' + (selectedStash.has(item.id) ? ' sel' : '')
    const check = document.createElement('input')
    check.type = 'checkbox'
    check.className = 'stash-check'
    check.checked = selectedStash.has(item.id)
    check.title = '勾选后可批量复制/删除'
    check.addEventListener('change', () => {
      if (check.checked) selectedStash.add(item.id)
      else selectedStash.delete(item.id)
      refreshStashSelection()
    })
    const main = document.createElement('div')
    main.className = 'stash-main'
    const loc = document.createElement('div')
    loc.className = 'stash-loc'
    loc.textContent = item.context.src + (item.context.range ? ' · ' + item.context.range : '')
    const field = document.createElement('textarea')
    field.className = 'stash-text'
    field.spellcheck = false
    field.rows = 2
    field.value = item.instruction
    field.placeholder = '输入修改要求…'
    field.title = '点击此处直接修改'
    field.addEventListener('input', () => {
      item.instruction = field.value
      item.full = composePrompt([item.context], item.instruction)
    })
    main.appendChild(loc)
    main.appendChild(field)
    li.appendChild(check)
    li.appendChild(main)
    stashList.appendChild(li)
  })
  refreshStashSelection()
}
function refreshStashSelection() {
  const count = selectedStash.size
  const allSelected = state.stash.length > 0 && count === state.stash.length
  stashSelectAll.textContent = allSelected ? '取消全选' : '全选'
  stashClearButton.disabled = state.stash.length === 0
  stashCopyButton.disabled = count === 0
  stashDeleteButton.disabled = count === 0
  stashList.querySelectorAll('.stash-row').forEach(row => {
    const check = row.querySelector('.stash-check')
    row.classList.toggle('sel', check.checked)
  })
}
function closeStash() {
  state.stashOpen = false
  stashPanel.style.display = 'none'
  selectedStash.clear()
}
function openStash() {
  closePanel()
  renderStashList()
  positionStashBottom()
  state.stashOpen = true
}
async function componentRange(element) {
  const ids = []
  let current = element
  while (current && current.nodeType === 1) {
    const id = current.getAttribute?.(PICK_ATTRIBUTE)
    if (id) ids.unshift(id)
    current = current.parentElement
  }
  const infos = await Promise.all(ids.map(id => sourceInfo(id).catch(() => null)))
  const components = []
  for (const info of infos) {
    if (info?.component && components.at(-1) !== info.component) components.push(info.component)
  }
  return components.join(' > ') || 'UnknownComponent'
}
async function inspect(element) {
  const id = element.getAttribute(PICK_ATTRIBUTE)
  const info = await sourceInfo(id)
  const range = await componentRange(element)
  state.context = { src: info.file + ':' + info.line + ':' + info.column, range }
  textarea.value = ''
  refreshPanel()
  refreshListeners()
  panel.style.display = 'block'; panel.dataset.id = id
  requestAnimationFrame(() => { positionPanel(element); textarea.focus() })
}
function pickTarget(element) {
  state.selected = element
  state.hovered = element
  highlight(element)
  inspect(element).catch(error => window.alert('[Picker] ' + error.message))
}
function closePanel() { panel.style.display = 'none'; state.selected = null; state.hovered = null; state.context = null; box.style.display = 'none' }

window.addEventListener('keydown', event => { if (event.key === 'Alt') state.alt = true }, true)
window.addEventListener('keyup', event => { if (event.key === 'Alt') { state.alt = false; hideHighlight() } }, true)
window.addEventListener('blur', () => { state.alt = false; hideHighlight() })
window.addEventListener('pointermove', event => {
  if (!state.alt || state.selected || event.composedPath().includes(host)) return
  const element = closestLocated(document.elementFromPoint(event.clientX, event.clientY))
  if (element) { state.hovered = element; highlight(element) }
}, true)
window.addEventListener('click', event => {
  const inHost = event.composedPath().includes(host)
  if (!inHost) {
    if (state.alt) {
      const target = closestLocated(event.target)
      if (target) {
        event.preventDefault(); event.stopImmediatePropagation()
        closeStash()
        pickTarget(target)
        return
      }
    }
    if (state.stashOpen) closeStash()
    if (panel.style.display === 'block') closePanel()
    return
  }
}, true)

root.querySelector('.close').addEventListener('click', closePanel)
stashBtn.addEventListener('click', () => {
  if (state.stashOpen) closeStash()
  else openStash()
})
root.querySelector('.stash-close').addEventListener('click', closeStash)
copyButton.addEventListener('click', async () => {
  if (!state.context) return
  const output = composePrompt([state.context], textarea.value)
  await navigator.clipboard.writeText(output)
  await record('prompt', textarea.value)
  textarea.value = ''
  closePanel(); showToast('已保存到剪贴板')
})
stashNowButton.addEventListener('click', () => {
  if (!state.context) return
  const instruction = textarea.value.trim()
  if (!instruction) { showToast('请先输入修改要求'); return }
  state.stash.push({
    id: ++stashSeq,
    instruction,
    context: { src: state.context.src, range: state.context.range },
    full: composePrompt([state.context], instruction),
    time: Date.now(),
  })
  updateStashBadge()
  record('prompt', instruction)
  closePanel()
  showToast('已暂存，共 ' + state.stash.length + ' 条')
})
stashSelectAll.addEventListener('click', () => {
  const allSelected = state.stash.length > 0 && selectedStash.size === state.stash.length
  selectedStash.clear()
  if (!allSelected) state.stash.forEach(item => selectedStash.add(item.id))
  renderStashList()
})
stashCopyButton.addEventListener('click', async () => {
  if (!selectedStash.size) return
  const picked = state.stash.filter(item => selectedStash.has(item.id))
  const output = picked.map(item => item.full).join('\n\n--------\n\n')
  await navigator.clipboard.writeText(output)
  state.stash = state.stash.filter(item => !selectedStash.has(item.id))
  selectedStash.clear()
  updateStashBadge()
  if (!state.stash.length) { closeStash(); showToast('已复制 ' + picked.length + ' 条并清空暂存夹') }
  else { renderStashList(); showToast('已复制 ' + picked.length + ' 条，已从暂存夹移除') }
})
stashClearButton.addEventListener('click', () => {
  if (!state.stash.length) return
  const count = state.stash.length
  state.stash = []
  selectedStash.clear()
  updateStashBadge()
  closeStash()
  showToast('已清空 ' + count + ' 条暂存')
})
stashDeleteButton.addEventListener('click', () => {
  if (!selectedStash.size) return
  state.stash = state.stash.filter(item => !selectedStash.has(item.id))
  selectedStash.clear()
  updateStashBadge()
  if (!state.stash.length) { closeStash(); showToast('已删除，暂存为空') }
  else { renderStashList() }
})
function syncHighlightPosition() {
  const element = state.selected || (state.alt ? state.hovered : null)
  if (!element?.isConnected) { hideHighlight(); return }
  highlight(element)
  if (state.selected && panel.style.display === 'block') positionPanel(state.selected)
}
window.addEventListener('scroll', syncHighlightPosition, true)
window.addEventListener('resize', syncHighlightPosition)
`

// Backticks inside the generated module must be escaped for this source file,
// but String.raw intentionally preserves those escape slashes. Remove only
// backtick escapes before Vite serves the virtual client module.
export const clientCode = rawClientCode.replaceAll('\\`', '`')
