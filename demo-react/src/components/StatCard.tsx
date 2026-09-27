interface StatCardProps {
  label: string
  value: string
  delta: string
  trend: 'up' | 'down'
}

export default function StatCard({ label, value, delta, trend }: StatCardProps) {
  return (
    <article className="stat">
      <p className="stat__label">{label}</p>
      <p className="stat__value">{value}</p>
      <p className="stat__delta" data-trend={trend}>
        <span aria-hidden="true">{trend === 'up' ? '▲' : '▼'}</span>
        <span>{delta}</span>
        <span className="stat__period">vs. previous hour</span>
      </p>
    </article>
  )
}
