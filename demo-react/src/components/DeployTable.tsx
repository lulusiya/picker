import DeployRow from './DeployRow'

const deployments = [
  { name: 'web-prod', branch: 'main', status: 'ready', duration: '42s', when: '2 min ago', commit: '9f31ac2', author: 'LH' },
  { name: 'api-staging', branch: 'feat/rate-limit', status: 'building', duration: '1m 08s', when: '5 min ago', commit: 'c4e7b10', author: 'YW' },
  { name: 'docs-site', branch: 'main', status: 'ready', duration: '18s', when: '26 min ago', commit: '7b2d844', author: 'LH' },
  { name: 'worker-eu', branch: 'fix/backoff', status: 'failed', duration: '9s', when: '1 hr ago', commit: 'a10f5c9', author: 'MZ' },
] as const

export default function DeployTable() {
  return (
    <section className="panel">
      <header className="panel__head">
        <h2>Recent deployments</h2>
        <span>4 of 128</span>
        <button className="btn" type="button">
          Filter
        </button>
      </header>

      <table className="table">
        <thead>
          <tr>
            <th>Service</th>
            <th>Branch</th>
            <th>Status</th>
            <th>Build</th>
            <th>Deployed</th>
            <th>By</th>
          </tr>
        </thead>
        <tbody>
          {deployments.map((deployment) => (
            <DeployRow key={deployment.name} {...deployment} />
          ))}
        </tbody>
      </table>
    </section>
  )
}
