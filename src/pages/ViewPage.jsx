import { Link, Navigate, useParams } from 'react-router-dom'
import {
  VerticalTimeline,
  VerticalTimelineElement,
} from 'react-vertical-timeline-component'
import 'react-vertical-timeline-component/style.min.css'
import { IconEdit, TipLink } from '../components/actionUi'
import {
  DEFAULT_GROUP_NAME,
  DEFAULT_NODE_TYPE,
  DEFAULT_TRIP_DESC,
  GROUP_TYPE_LABEL,
  ROOT_ID,
} from '../lib/constants'
import {
  editBreadcrumbTrail,
  editPathFor,
  getChildren,
  getNode,
  isGroup,
  isItineraryTrip,
  isTrip,
  toDateTimeInputValue,
  viewPathFor,
} from '../lib/model'
import { useStore } from '../lib/store'
import { TypeIcon, typeToneColor } from '../lib/typeIcons'

function tripTypeLabel(node) {
  if (isItineraryTrip(node)) return '行程'
  return node.type || DEFAULT_NODE_TYPE
}

function TimelineBody({ title, timeLabel, dateTime, description, extra = null }) {
  const hasRealDesc = Boolean(description?.trim())
  return (
    <>
      <h3 className="vertical-timeline-element-title tl-title">{title}</h3>
      {timeLabel ? (
        <time className="tl-time" dateTime={dateTime || undefined}>{timeLabel}</time>
      ) : (
        <span className="tl-time is-empty">时间待定</span>
      )}
      <p className={`tl-desc${hasRealDesc ? '' : ' is-placeholder'}`}>
        {description?.trim() || DEFAULT_TRIP_DESC}
      </p>
      {extra}
    </>
  )
}

function elementShellProps(typeLabel) {
  const color = typeToneColor(typeLabel)
  return {
    icon: <TypeIcon type={typeLabel} tone={false} />,
    iconStyle: { background: color, color: '#fff' },
    iconClassName: 'tl-icon',
    contentStyle: {
      background: 'transparent',
      boxShadow: 'none',
      padding: '0.15rem 0 0.35rem',
    },
    contentArrowStyle: { display: 'none' },
  }
}

function collectElements(store, ids, depth) {
  if (!ids?.length) return []
  const out = []

  ids.forEach((id) => {
    const node = getNode(store, id)
    if (!node) return

    if (isTrip(node)) {
      const typeLabel = tripTypeLabel(node)
      const timeLabel = toDateTimeInputValue(node.startAt)
      const nested = getChildren(node)

      out.push(
        <VerticalTimelineElement
          key={id}
          className={`tl-element tl-depth-${depth}`}
          {...elementShellProps(typeLabel)}
        >
          <TimelineBody
            title={node.name?.trim() || '未命名行程'}
            timeLabel={timeLabel}
            dateTime={node.startAt || undefined}
            description={node.description}
            extra={nested.length ? (
              <div className="tl-nest" aria-label="内部行程">
                <p className="tl-nest-label">内部行程</p>
                <VerticalTimeline
                  layout="1-column-left"
                  lineColor="rgba(31, 111, 120, 0.22)"
                  className="tl-nested-timeline"
                >
                  {collectElements(store, nested, depth + 1)}
                </VerticalTimeline>
              </div>
            ) : null}
          />
        </VerticalTimelineElement>,
      )

      if (node.next?.length) {
        out.push(...collectElements(store, node.next, depth))
      }
      return
    }

    if (isGroup(node)) {
      const members = node.members || []

      out.push(
        <VerticalTimelineElement
          key={id}
          className={`tl-element tl-group tl-depth-${depth}`}
          {...elementShellProps(GROUP_TYPE_LABEL)}
        >
          <TimelineBody
            title={node.name?.trim() || DEFAULT_GROUP_NAME}
            timeLabel=""
            description={node.description}
            extra={members.length ? (
              <div className="tl-parallel" role="group" aria-label="并行行程">
                <p className="tl-nest-label">并行 · {members.length} 路</p>
                <div
                  className="tl-parallel-cols"
                  style={{ '--view-cols': Math.max(members.length, 1) }}
                >
                  {members.map((memberId, index) => (
                    <div
                      key={memberId}
                      className="tl-parallel-col"
                      style={{ '--view-col-index': index }}
                    >
                      <VerticalTimeline
                        layout="1-column-left"
                        lineColor="rgba(31, 111, 120, 0.2)"
                        className="tl-nested-timeline"
                      >
                        {collectElements(store, [memberId], depth + 1)}
                      </VerticalTimeline>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          />
        </VerticalTimelineElement>,
      )

      if (node.next?.length) {
        out.push(...collectElements(store, node.next, depth))
      }
    }
  })

  return out
}

function ViewTimeline({ ids }) {
  const { store } = useStore()
  const items = collectElements(store, ids, 0)
  if (!items.length) return null

  return (
    <VerticalTimeline
      layout="1-column-left"
      lineColor="rgba(31, 111, 120, 0.28)"
      className="tl-root-timeline"
    >
      {items}
    </VerticalTimeline>
  )
}

export default function ViewPage() {
  const { nodeId: scopeParam } = useParams()
  const { store } = useStore()
  const scopeId = scopeParam || ROOT_ID
  const scope = getNode(store, scopeId)
  const isRootScope = !scopeParam || scopeId === ROOT_ID

  if (!scope || (!isRootScope && !isTrip(scope))) {
    return <Navigate to="/view" replace />
  }

  const title = isRootScope
    ? (scope.name || '我的旅程')
    : (scope.name?.trim() || '未命名行程')
  const forestIds = isRootScope ? (scope.next || []) : getChildren(scope)
  const editPath = editPathFor(scopeId)
  const breadcrumbs = isRootScope ? null : editBreadcrumbTrail(store, scopeId)

  return (
    <div className="page page-view">
      <header className="page-header">
        <div className="page-brand">
          {breadcrumbs?.length ? (
            <nav className="edit-breadcrumb" aria-label="行程路径">
              <ol className="edit-breadcrumb-list">
                {breadcrumbs.map((crumb, index) => {
                  const isLast = index === breadcrumbs.length - 1
                  const viewTo = viewPathFor(crumb.id)
                  return (
                    <li key={crumb.id} className="edit-breadcrumb-item">
                      {isLast ? (
                        <span className="edit-breadcrumb-current" aria-current="page">
                          {crumb.label}
                        </span>
                      ) : (
                        <Link className="edit-breadcrumb-link" to={viewTo}>
                          {crumb.label}
                        </Link>
                      )}
                    </li>
                  )
                })}
              </ol>
            </nav>
          ) : (
            <p className="eyebrow">行程查看</p>
          )}
          <h1 className="page-title">{isRootScope ? title : '内部行程'}</h1>
        </div>
        <div className="header-actions">
          <TipLink
            tip="去编辑"
            className="header-icon-btn"
            to={editPath}
            aria-label="去编辑"
          >
            <IconEdit />
          </TipLink>
        </div>
      </header>

      <section className="hero-block">
        <p className="lede">
          {isRootScope
            ? '按时间轴阅读旅程：节点旁为标题，其下为时间，再下为描述。'
            : '正在查看该行程的内部安排。'}
        </p>
      </section>

      {!isRootScope ? (
        <div className="edit-scope-meta">
          <p className="trip-name is-display edit-scope-name">{title}</p>
          {scope.description?.trim() ? (
            <p className="trip-desc is-display edit-scope-desc">{scope.description.trim()}</p>
          ) : null}
        </div>
      ) : null}

      {forestIds.length === 0 ? (
        <div className="view-empty">
          <p>{isRootScope ? '还没有行程。' : '还没有内部行程。'}</p>
          <Link className="btn" to={editPath}>
            {isRootScope ? '去录入' : '去编辑'}
          </Link>
        </div>
      ) : (
        <div className="tl-board">
          <ViewTimeline ids={forestIds} />
        </div>
      )}
    </div>
  )
}
