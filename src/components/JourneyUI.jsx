import { Link } from 'react-router-dom'
import { STATUS_LABEL } from '../lib/constants'
import { formatDateTime, isBranchGroup, isContainer, resolveStatus } from '../lib/model'
import { useStore } from '../lib/store'

export function Breadcrumb({ path, mode }) {
  return (
    <nav className="breadcrumb" aria-label="路径">
      {path.map((node, index) => {
        const isLast = index === path.length - 1
        const to = mode === 'edit'
          ? `/edit/${node.id}`
          : `/view/${node.id}`
        return (
          <span key={node.id} className="breadcrumb-item">
            {index > 0 && <span className="breadcrumb-sep">/</span>}
            {isLast ? (
              <span className="breadcrumb-current">{node.name}</span>
            ) : (
              <Link to={to}>{node.name}</Link>
            )}
          </span>
        )
      })}
    </nav>
  )
}

export function StatusBadge({ status }) {
  return (
    <span className={`status-badge status-${status}`}>
      {STATUS_LABEL[status] || status}
    </span>
  )
}

export function TypeChip({ type }) {
  if (!type) return null
  return <span className="type-chip">{type}</span>
}

export function Filters({ dates, types, selectedDates, selectedTypes, onDatesChange, onTypesChange }) {
  const toggle = (list, value, setter) => {
    if (list.includes(value)) setter(list.filter((v) => v !== value))
    else setter([...list, value])
  }

  return (
    <div className="filters">
      {dates.length > 0 && (
        <div className="filter-group">
          <span className="filter-label">日期</span>
          <div className="filter-chips">
            {dates.map((d) => (
              <button
                key={d}
                type="button"
                className={`chip ${selectedDates.includes(d) ? 'active' : ''}`}
                onClick={() => toggle(selectedDates, d, onDatesChange)}
              >
                {d.slice(5)}
              </button>
            ))}
            {selectedDates.length > 0 && (
              <button type="button" className="chip clear" onClick={() => onDatesChange([])}>
                清除
              </button>
            )}
          </div>
        </div>
      )}
      <div className="filter-group">
        <span className="filter-label">类型</span>
        <div className="filter-chips">
          {types.map((t) => (
            <button
              key={t}
              type="button"
              className={`chip ${selectedTypes.includes(t) ? 'active' : ''}`}
              onClick={() => toggle(selectedTypes, t, onTypesChange)}
            >
              {t}
            </button>
          ))}
          {selectedTypes.length > 0 && (
            <button type="button" className="chip clear" onClick={() => onTypesChange([])}>
              清除
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function TimelineCard({ item, mode, containerId, onEnter, onEdit }) {
  const { store, setLeafStatus, switchMain, getNode } = useStore()
  const node = getNode(item.id)
  if (!node) return null

  const status = resolveStatus(store, node.id)
  const container = isContainer(node)
  const branchGroup = isBranchGroup(node)
  const weak = !item.isMain

  const predecessors = (store.nodes[containerId]?.edges || [])
    .filter((e) => e.to === node.id)

  return (
    <article className={`tl-card ${weak ? 'is-branch' : 'is-main'} ${container ? 'is-container' : ''} ${branchGroup ? 'is-branch-group' : ''}`}>
      <div className="tl-card-top">
        <time className="tl-time">{formatDateTime(node.startAt)}</time>
        <div className="tl-card-meta">
          {branchGroup && <TypeChip type="分支" />}
          {!container && !branchGroup && <TypeChip type={node.type} />}
          {container && <TypeChip type="行程" />}
          <StatusBadge status={status} />
          {weak && <span className="branch-tag">支线</span>}
          {item.isMain && predecessors.some((e) => {
            const outs = (store.nodes[containerId]?.edges || []).filter((x) => x.from === e.from)
            return outs.length > 1
          }) && <span className="main-tag">主线</span>}
        </div>
      </div>

      <h3 className="tl-title">{node.name}</h3>
      {node.description ? <p className="tl-desc">{node.description}</p> : null}
      {branchGroup && (
        <p className="tl-desc muted">含 {node.children.length} 个并列分支</p>
      )}

      <div className="tl-actions">
        {(container || branchGroup) && (
          <button type="button" className="btn btn-ghost" onClick={() => onEnter(node.id)}>
            {branchGroup ? '查看分支 ›' : '进入行程 ›'}
          </button>
        )}

        {mode === 'view' && !container && !branchGroup && (
          <div className="status-switch">
            {['pending', 'doing', 'done'].map((s) => (
              <button
                key={s}
                type="button"
                className={`btn btn-tiny ${status === s ? 'active' : ''}`}
                onClick={() => setLeafStatus(node.id, s)}
              >
                {STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        )}

        {mode === 'view' && weak && predecessors.map((e) => (
          <button
            key={`${e.from}-${e.to}`}
            type="button"
            className="btn btn-ghost"
            onClick={() => switchMain(containerId, e.from, node.id)}
          >
            设为主线
          </button>
        ))}

        {mode === 'edit' && (
          <button type="button" className="btn btn-ghost" onClick={() => onEdit(node.id)}>
            编辑
          </button>
        )}
      </div>
    </article>
  )
}

function expandRowForView(store, row) {
  if (!row?.length) return []
  if (row.length > 1) return row
  const node = store.nodes[row[0].id]
  if (node?.kind === 'branch-group' && node.children?.length) {
    return node.children.map((id, index) => ({
      id,
      isMain: index === 0,
    }))
  }
  return row
}

export function Timeline({ containerId, rows, mode, onEnter, onEdit }) {
  const { store } = useStore()

  if (!rows.length) {
    return (
      <div className="empty-state">
        <p>当前层还没有安排</p>
        <p className="muted">去录入页添加节点吧</p>
      </div>
    )
  }

  return (
    <div className="timeline">
      {rows.map((row, rowIndex) => {
        const displayRow = expandRowForView(store, row)
        return (
          <div key={`row-${rowIndex}`} className={`tl-row ${displayRow.length > 1 ? 'has-branches' : ''}`}>
            <div className="tl-axis">
              <span className="tl-dot" />
              {rowIndex < rows.length - 1 && <span className="tl-line" />}
            </div>
            <div className={`tl-parallel ${displayRow.length > 1 ? 'multi' : ''}`}>
              {displayRow.map((item) => (
                <TimelineCard
                  key={item.id}
                  item={item}
                  mode={mode}
                  containerId={containerId}
                  onEnter={onEnter}
                  onEdit={onEdit}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
