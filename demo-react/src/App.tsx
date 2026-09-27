import AppSidebar from './components/AppSidebar'
import DeployTable from './components/DeployTable'
import StatCard from './components/StatCard'

const stats = [
  { label: 'Requests per minute', value: '12,480', delta: '8.2%', trend: 'up' },
  { label: 'p95 latency', value: '184 ms', delta: '12 ms', trend: 'up' },
  { label: 'Error rate', value: '0.12%', delta: '0.03%', trend: 'down' },
] as const

export default function App() {
  return (
    <div className="shell">
      <AppSidebar />

      <div className="column">
        <header className="topbar">
          <div className="crumbs">
            <span>acme</span>
            <span aria-hidden="true">/</span>
            <strong>Overview</strong>
          </div>
          <div className="topbar__spacer" />
          <button className="btn" type="button">
            Docs
          </button>
          <button className="btn btn--primary" type="button">
            New deploy
          </button>
          <span className="avatar" title="lihuohuo">
            LH
          </span>
        </header>

        <main className="content">
          <div className="page-head">
            <h1>Overview</h1>
            <p>Production is healthy across 3 regions. Last incident 14 days ago.</p>
          </div>

          <div className="stats">
            {stats.map((stat) => (
              <StatCard key={stat.label} {...stat} />
            ))}
          </div>

          <DeployTable />
        </main>
      </div>
    </div>
  )
}
