type Status = 'ready' | 'building' | 'failed'

interface DeployRowProps {
  name: string
  branch: string
  status: Status
  duration: string
  when: string
  commit: string
  author: string
}

const labels: Record<Status, string> = { ready: 'Ready', building: 'Building', failed: 'Failed' }

export default function DeployRow({ name, branch, status, duration, when, commit, author }: DeployRowProps) {
  return (
    <tr className="row">
      <td>
        <span className="row__name">{name}</span>
        <span className="row__commit">{commit}</span>
      </td>
      <td>
        <span className="row__branch">{branch}</span>
      </td>
      <td>
        <span className="pill" data-status={status}>
          <span className="pill__dot" aria-hidden="true" />
          {labels[status]}
        </span>
      </td>
      <td className="row__num">{duration}</td>
      <td className="row__num row__when">{when}</td>
      <td>
        <span className="row__author">{author}</span>
      </td>
    </tr>
  )
}
