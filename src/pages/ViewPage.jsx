import { Link } from 'react-router-dom'
import {
  VerticalTimeline,
  VerticalTimelineElement,
} from 'react-vertical-timeline-component'
import 'react-vertical-timeline-component/style.min.css'
import {
  DEFAULT_GROUP_NAME,
  DEFAULT_NODE_TYPE,
  DEFAULT_TRIP_DESC,
  GROUP_TYPE_LABEL,
  ROOT_ID,
} from '../lib/constants'
import {
  getInternals,
  getNode,
  isGroup,
  isItineraryTrip,
  isTrip,
  toDateTimeInputValue,
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
      const internals = getInternals(node)

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
            extra={internals.length ? (
              <div className="tl-nest" aria-label="内部行程">
                <p className="tl-nest-label">内部行程</p>
                <VerticalTimeline
                  layout="1-column-left"
                  lineColor="rgba(31, 111, 120, 0.22)"
                  className="tl-nested-timeline"
                >
                  {collectElements(store, internals, depth + 1)}
                </VerticalTimeline>
              </div>
            ) : null}
          />
        </VerticalTimelineElement>,
      )

      if (node.children?.length) {
        out.push(...collectElements(store, node.children, depth))
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

      if (node.children?.length) {
        out.push(...collectElements(store, node.children, depth))
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
  const { store } = useStore()
  const root = getNode(store, ROOT_ID)
  const children = root?.children || []

  if (!root) {
    return (
      <div className="page">
        <p>根节点不存在</p>
      </div>
    )
  }

  return (
    <div className="page page-view">
      <header className="page-header">
        <div className="page-brand">
          <p className="eyebrow">行程查看</p>
          <h1 className="page-title">{root.name}</h1>
        </div>
        <div className="header-actions">
          <Link className="btn" to="/edit">
            去编辑
          </Link>
        </div>
      </header>

      <section className="hero-block">
        <p className="lede">
          按时间轴阅读旅程：节点旁为标题，其下为时间，再下为描述。
        </p>
      </section>

      {children.length === 0 ? (
        <div className="view-empty">
          <p>还没有行程。</p>
          <Link className="btn" to="/edit">
            去录入
          </Link>
        </div>
      ) : (
        <div className="tl-board">
          <ViewTimeline ids={children} />
        </div>
      )}
    </div>
  )
}
