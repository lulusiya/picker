const items = [
  { icon: '▦', label: 'Overview', current: true },
  { icon: '◇', label: 'Projects' },
  { icon: '↑', label: 'Deployments', count: 12 },
  { icon: '≡', label: 'Logs' },
  { icon: '◔', label: 'Usage' },
  { icon: '⚙', label: 'Settings' },
]

export default function AppSidebar() {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand__mark">A</span>
        <span>Acme Console</span>
      </div>

      <div>
        <p className="nav__label">Workspace</p>
        <nav className="nav">
          {items.map((item) => (
            <button
              key={item.label}
              className="nav__item"
              type="button"
              aria-current={item.current ? 'page' : undefined}
            >
              <span className="nav__icon" aria-hidden="true">
                {item.icon}
              </span>
              <span>{item.label}</span>
              {item.count ? <span className="nav__count">{item.count}</span> : null}
            </button>
          ))}
        </nav>
      </div>

      <div className="sidebar__foot">
        <p>
          Hover any element and hold <code>Alt</code> to inspect it.
        </p>
        <p style={{ margin: 0, color: 'var(--faint)' }}>vite-plugin-picker</p>
      </div>
    </aside>
  )
}
