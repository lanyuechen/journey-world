import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { EffectCoverflow, Pagination } from 'swiper/modules'
import { Swiper, SwiperSlide } from 'swiper/react'
import { Breadcrumb } from '../components/JourneyUI'
import { NODE_TYPES, ROOT_ID, STATUS } from '../lib/constants'
import {
  buildTimelineRows,
  fromDatetimeLocalValue,
  getNode,
  getPathToNode,
  isBranchGroup,
  isContainer,
  toDateTimeInputValue,
  toDatetimeLocalValue,
} from '../lib/model'
import { useStore } from '../lib/store'
import 'swiper/css'
import 'swiper/css/effect-coverflow'
import 'swiper/css/pagination'

const VERTICAL_MS = 380

/** Soft coverflow: keep the active face fully on-screen. */
const BRANCH_COVERFLOW = {
  rotate: 36,
  stretch: 12,
  depth: 80,
  modifier: 1,
  slideShadows: false,
}

/** Coverflow's z-index uses round(offset); fractional snap can put a neighbor above active (often on even indices). */
function pinActiveSlideLayer(swiper) {
  if (!swiper?.slides?.length) return
  const apply = () => {
    if (!swiper?.slides?.length || swiper.destroyed) return
    swiper.slides.forEach((slide, index) => {
      const isActive = index === swiper.activeIndex
      slide.style.zIndex = isActive ? '40' : String(index + 1)
      slide.style.pointerEvents = isActive ? 'auto' : 'none'
    })
  }
  // Run after coverflow effect writes its own inline z-index.
  requestAnimationFrame(apply)
}

function IconEditInner({ className = 'entry-icon' }) {
  return (
    <svg className={className} viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path
        d="M426.666667 85.333333a42.666667 42.666667 0 0 1 42.666666 42.666667v170.666667a42.666667 42.666667 0 0 1-42.666666 42.666666H341.333333v85.333334h213.333334V384a42.666667 42.666667 0 0 1 42.666666-42.666667h256a42.666667 42.666667 0 0 1 42.666667 42.666667v170.666667a42.666667 42.666667 0 0 1-42.666667 42.666666h-256a42.666667 42.666667 0 0 1-42.666666-42.666666v-42.666667H341.333333v256h213.333334v-42.666667a42.666667 42.666667 0 0 1 42.666666-42.666666h256a42.666667 42.666667 0 0 1 42.666667 42.666666v170.666667a42.666667 42.666667 0 0 1-42.666667 42.666667h-256a42.666667 42.666667 0 0 1-42.666666-42.666667v-42.666667H298.666667a42.666667 42.666667 0 0 1-42.666667-42.666666V341.333333H170.666667a42.666667 42.666667 0 0 1-42.666667-42.666666V128a42.666667 42.666667 0 0 1 42.666667-42.666667h256z m384 682.666667h-170.666667v85.333333h170.666667v-85.333333z m0-341.333333h-170.666667v85.333333h170.666667v-85.333333zM384 170.666667H213.333333v85.333333h170.666667V170.666667z"
        fill="currentColor"
      />
    </svg>
  )
}

function IconTrash({ className = 'entry-icon' }) {
  return (
    <svg className={className} viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path
        d="M360.533333 170.666667a42.666667 42.666667 0 0 1 42.666667-42.666667h217.6a42.666667 42.666667 0 0 1 42.666667 42.666667V213.333333h170.666666a42.666667 42.666667 0 1 1 0 85.333334H192a42.666667 42.666667 0 1 1 0-85.333334h168.533333V170.666667zM256 341.333333h512l-36.266667 490.666667a85.333333 85.333333 0 0 1-85.333333 78.933333H377.6a85.333333 85.333333 0 0 1-85.333333-78.933333L256 341.333333z m128 128a42.666667 42.666667 0 0 1 85.333333 0v298.666667a42.666667 42.666667 0 0 1-85.333333 0V469.333333z m170.666667 0a42.666667 42.666667 0 0 1 85.333333 0v298.666667a42.666667 42.666667 0 0 1-85.333333 0V469.333333z"
        fill="currentColor"
      />
    </svg>
  )
}

function IconArrowDown({ className = 'entry-icon' }) {
  return (
    <svg className={className} viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path
        d="M512 128c23.552 0 42.667 19.115 42.667 42.667v588.501l201.984-201.984a42.667 42.667 0 0 1 60.331 60.331l-274.773 274.773a42.667 42.667 0 0 1-60.331 0L207.104 617.515a42.667 42.667 0 1 1 60.331-60.331L469.333 759.168V170.667C469.333 147.115 488.448 128 512 128z"
        fill="currentColor"
      />
    </svg>
  )
}

function IconArrowRight({ className = 'entry-icon' }) {
  return (
    <svg className={className} viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path
        d="M128 512c0-23.552 19.115-42.667 42.667-42.667h588.501L557.184 267.349a42.667 42.667 0 0 1 60.331-60.331l274.773 274.773a42.667 42.667 0 0 1 0 60.331L617.515 816.896a42.667 42.667 0 1 1-60.331-60.331L759.168 554.667H170.667C147.115 554.667 128 535.552 128 512z"
        fill="currentColor"
      />
    </svg>
  )
}

function getRowKey(row) {
  return row.find((item) => item.isMain)?.id || row[0]?.id
}

/** Slides for a timeline row: branch-group children, or legacy parallel row, or single card. */
function resolveSlideItems(store, row) {
  if (!row?.length) return []
  if (row.length > 1) return row
  const node = getNode(store, row[0].id)
  if (isBranchGroup(node)) {
    return node.children.map((id, index) => ({
      id,
      isMain: index === 0,
    }))
  }
  return row
}

function slidesFromBranchGroup(store, groupId) {
  const node = getNode(store, groupId)
  if (!isBranchGroup(node)) return []
  return node.children.map((id, index) => ({
    id,
    isMain: index === 0,
  }))
}

/** Vertical expand / collapse using grid rows — avoids height measure flicker. */
function VerticalReveal({ present, instant = false, children, onExited }) {
  const [mounted, setMounted] = useState(present)
  const [expanded, setExpanded] = useState(() => (instant ? present : false))
  const onExitedRef = useRef(onExited)
  const exitTimerRef = useRef(0)
  onExitedRef.current = onExited

  useLayoutEffect(() => {
    if (present) {
      setMounted(true)
      if (instant || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        setExpanded(true)
        return undefined
      }
      const id = requestAnimationFrame(() => setExpanded(true))
      return () => cancelAnimationFrame(id)
    }

    setExpanded(false)
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setMounted(false)
      onExitedRef.current?.()
      return undefined
    }
    exitTimerRef.current = window.setTimeout(() => {
      setMounted(false)
      onExitedRef.current?.()
    }, VERTICAL_MS)
    return () => window.clearTimeout(exitTimerRef.current)
  }, [present, instant])

  if (!mounted) return null

  return (
    <div
      className={`vertical-reveal ${expanded ? 'is-expanded' : 'is-collapsed'}${instant && present ? ' is-instant' : ''}`}
    >
      <div className="vertical-reveal-inner">
        {children}
      </div>
    </div>
  )
}

function EntryCard({
  item,
  autoFocus,
  expanded,
  onActivate,
  onDelete,
  onAddBranch,
  onAddNext,
  layout = 'solo',
}) {
  const {
    store,
    updateNode,
    ensureContainer,
  } = useStore()
  const navigate = useNavigate()
  const nameRef = useRef(null)
  const timePickerRef = useRef(null)
  const node = getNode(store, item.id)
  const coverflow = layout === 'coverflow'
  const interactive = expanded

  useEffect(() => {
    if (expanded && autoFocus && nameRef.current) {
      nameRef.current.focus({ preventScroll: true })
    }
  }, [autoFocus, expanded])

  if (!node) return null

  const container = isContainer(node)
  const branchGroup = isBranchGroup(node)
  const timeLabel = toDateTimeInputValue(node.startAt)

  return (
    <div
      className={`entry-panel ${expanded ? 'is-open' : 'is-closed'}${coverflow ? ' is-coverflow' : ''}`}
      role={interactive ? undefined : 'button'}
      tabIndex={interactive ? undefined : 0}
      onMouseDown={(e) => {
        if (!interactive) e.preventDefault()
      }}
      onClick={() => {
        if (!interactive) onActivate(node.id)
      }}
      onKeyDown={(e) => {
        if (!interactive && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          onActivate(node.id)
        }
      }}
    >
      <div className="entry-unit" aria-hidden={!interactive}>
        <article className={`entry-block ${item.isMain ? 'is-main' : 'is-branch'}`}>
          <div className="entry-topbar">
            {container ? (
              <span className="entry-type-tag is-static" title="含内部行程">行程</span>
            ) : branchGroup ? (
              <span className="entry-type-tag is-static" title="并列分支组">分支</span>
            ) : (
              <label className="entry-type-tag" title="切换类型">
                <span className="entry-type-tag-text">{node.type || NODE_TYPES[0]}</span>
                <select
                  className="entry-type-tag-select"
                  value={node.type || NODE_TYPES[0]}
                  onChange={(e) => updateNode(node.id, { type: e.target.value })}
                  aria-label="类型"
                  tabIndex={interactive ? 0 : -1}
                >
                  {NODE_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </label>
            )}

            {interactive && (
              <div className="entry-topbar-actions swiper-no-swiping">
                <button
                  type="button"
                  className="entry-icon-btn"
                  data-tooltip="编辑子行程"
                  aria-label="编辑子行程"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (!container && !branchGroup) ensureContainer(node.id)
                    navigate(`/edit/${node.id}`)
                  }}
                >
                  <IconEditInner />
                </button>
                {onAddNext && (
                  <button
                    type="button"
                    className="entry-icon-btn"
                    data-tooltip="添加下一级"
                    aria-label="添加下一级"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation()
                      onAddNext()
                    }}
                  >
                    <IconArrowDown />
                  </button>
                )}
                {onAddBranch && (
                  <button
                    type="button"
                    className="entry-icon-btn"
                    data-tooltip="添加分支"
                    aria-label="添加分支"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation()
                      onAddBranch()
                    }}
                  >
                    <IconArrowRight />
                  </button>
                )}
                <button
                  type="button"
                  className="entry-icon-btn is-danger"
                  data-tooltip="删除"
                  aria-label="删除"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (window.confirm(`删除「${node.name || '未命名'}」？`)) {
                      onDelete(node.id)
                    }
                  }}
                >
                  <IconTrash />
                </button>
              </div>
            )}
          </div>

          <input
            ref={nameRef}
            className="entry-name"
            value={node.name}
            onChange={(e) => updateNode(node.id, { name: e.target.value })}
            placeholder="输入名称"
            tabIndex={interactive ? 0 : -1}
          />

          <div className="entry-time-wrap">
            <button
              type="button"
              className={`entry-time ${timeLabel ? '' : 'is-empty'}`}
              tabIndex={interactive ? 0 : -1}
              onClick={(e) => {
                e.stopPropagation()
                const el = timePickerRef.current
                if (!el) return
                if (typeof el.showPicker === 'function') el.showPicker()
                else el.click()
              }}
            >
              {timeLabel || '开始时间'}
            </button>
            <input
              ref={timePickerRef}
              className="entry-time-picker"
              type="datetime-local"
              value={toDatetimeLocalValue(node.startAt)}
              onChange={(e) => updateNode(node.id, {
                startAt: fromDatetimeLocalValue(e.target.value),
              })}
              tabIndex={-1}
              aria-hidden
            />
          </div>

          <textarea
            className="entry-desc"
            value={node.description || ''}
            onChange={(e) => updateNode(node.id, { description: e.target.value })}
            rows={2}
            placeholder="输入描述"
            tabIndex={interactive ? 0 : -1}
          />
        </article>
      </div>
    </div>
  )
}

function BranchGroup({
  slides,
  parentId,
  focusId,
  activeId,
  onActiveChange,
  onInserted,
  onBranched,
}) {
  const { deleteNode, insertAfter, createBranch } = useStore()
  const swiperRef = useRef(null)
  const syncingRef = useRef(false)

  const row = slides
  const active = useMemo(() => {
    if (activeId && row.some((i) => i.id === activeId)) return activeId
    return row.find((i) => i.isMain)?.id || row[0]?.id
  }, [row, activeId])

  const activeIndex = Math.max(0, row.findIndex((item) => item.id === active))
  const activeItem = row[activeIndex] || row[0]
  const hasBranches = row.length > 1

  useEffect(() => {
    const swiper = swiperRef.current
    if (!swiper || swiper.destroyed) return
    swiper.update()
    swiper.updateAutoHeight?.(0)
    pinActiveSlideLayer(swiper)
    if (swiper.activeIndex === activeIndex) return
    syncingRef.current = true
    swiper.slideTo(activeIndex, 380)
    const t = window.setTimeout(() => {
      syncingRef.current = false
      swiper.updateAutoHeight?.(0)
      pinActiveSlideLayer(swiper)
    }, 420)
    return () => window.clearTimeout(t)
  }, [activeIndex, row.length])

  const handleDelete = (id) => {
    if (id === active) {
      const index = row.findIndex((item) => item.id === id)
      const nextActive = index > 0
        ? row[index - 1].id
        : (row[index + 1]?.id ?? null)
      if (nextActive) onActiveChange(nextActive)
    }
    deleteNode(id)
  }

  const handleAddBranch = () => {
    const id = createBranch(parentId, active)
    if (!id) return
    onActiveChange(id)
    onBranched(id)
  }

  const handleAddNext = () => {
    const id = insertAfter(parentId, active)
    if (!id) return
    onInserted(id)
  }

  if (!activeItem) return null

  return (
    <div className={`entry-group ${hasBranches ? 'has-branches' : ''}`}>
      <div className="entry-row entry-row-coverflow">
        <Swiper
          className="entry-coverflow"
          modules={[EffectCoverflow, Pagination]}
          effect="coverflow"
          grabCursor
          centeredSlides
          slidesPerView="auto"
          autoHeight
          spaceBetween={12}
          initialSlide={activeIndex}
          coverflowEffect={BRANCH_COVERFLOW}
          pagination={hasBranches ? { clickable: true } : false}
          preventClicks={false}
          preventClicksPropagation={false}
          noSwiping
          noSwipingClass="swiper-no-swiping"
          noSwipingSelector="button, input, textarea, select, .entry-topbar-actions"
          touchStartPreventDefault={false}
          threshold={18}
          allowTouchMove={hasBranches}
          simulateTouch={hasBranches}
          observer
          observeParents
          observeSlideChildren
          onSwiper={(swiper) => {
            swiperRef.current = swiper
            pinActiveSlideLayer(swiper)
          }}
          onSetTranslate={(swiper) => {
            pinActiveSlideLayer(swiper)
          }}
          onSlideChange={(swiper) => {
            pinActiveSlideLayer(swiper)
            if (syncingRef.current) return
            const item = row[swiper.activeIndex]
            if (item && item.id !== active) onActiveChange(item.id)
          }}
          onSlideChangeTransitionEnd={(swiper) => {
            pinActiveSlideLayer(swiper)
            swiper.updateAutoHeight?.(0)
          }}
          onResize={(swiper) => {
            swiper.updateAutoHeight(0)
            pinActiveSlideLayer(swiper)
          }}
        >
          {row.map((item) => (
            <SwiperSlide key={item.id}>
              <EntryCard
                item={item}
                layout="coverflow"
                autoFocus={focusId === item.id}
                expanded={item.id === active}
                onActivate={onActiveChange}
                onDelete={handleDelete}
                onAddBranch={handleAddBranch}
                onAddNext={handleAddNext}
              />
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
    </div>
  )
}

export default function EditPage() {
  const { nodeId = ROOT_ID } = useParams()
  const navigate = useNavigate()
  const { store, addChild, reset } = useStore()
  const [focusId, setFocusId] = useState(null)
  const [activeByRow, setActiveByRow] = useState({})
  const [rowEntries, setRowEntries] = useState([])
  const bootRef = useRef(true)

  const node = getNode(store, nodeId)
  const path = useMemo(() => getPathToNode(store, nodeId), [store, nodeId])
  const viewingBranchGroup = isBranchGroup(node)
  const viewingContainer = isContainer(node)

  const rows = useMemo(() => {
    if (viewingBranchGroup) {
      return [slidesFromBranchGroup(store, nodeId)]
    }
    if (viewingContainer) {
      return buildTimelineRows(store, nodeId)
    }
    return []
  }, [store, nodeId, viewingBranchGroup, viewingContainer])

  useEffect(() => {
    bootRef.current = true
    setRowEntries([])
    setActiveByRow({})
    setFocusId(null)
  }, [nodeId])

  useEffect(() => {
    setRowEntries((prev) => {
      const rowByKey = new Map(rows.map((row) => [getRowKey(row), row]))
      const nextKeys = rows.map((row) => getRowKey(row))

      if (bootRef.current) {
        bootRef.current = false
        return nextKeys.map((key) => ({
          key,
          row: rowByKey.get(key),
          present: true,
          instant: true,
        }))
      }

      const prevIndex = new Map(prev.map((entry, index) => [entry.key, index]))
      const result = nextKeys.map((key) => ({
        key,
        row: rowByKey.get(key),
        present: true,
        instant: false,
      }))

      for (const entry of prev) {
        if (rowByKey.has(entry.key)) continue
        if (result.some((item) => item.key === entry.key)) continue
        const insertAt = Math.min(prevIndex.get(entry.key) ?? result.length, result.length)
        result.splice(
          insertAt,
          0,
          entry.present ? { ...entry, present: false, instant: false } : entry,
        )
      }

      return result
    })
  }, [rows])

  useEffect(() => {
    if (!focusId) return
    rows.forEach((row) => {
      const key = getRowKey(row)
      const slides = viewingBranchGroup ? row : resolveSlideItems(store, row)
      if (slides.some((item) => item.id === focusId) || row.some((item) => item.id === focusId)) {
        setActiveByRow((prev) => ({ ...prev, [key]: focusId }))
      }
    })
  }, [focusId, rows, store, viewingBranchGroup])

  useEffect(() => {
    setActiveByRow((prev) => {
      const valid = new Set(rows.map((row) => getRowKey(row)))
      const next = { ...prev }
      let changed = false
      Object.keys(next).forEach((key) => {
        if (!valid.has(key)) {
          delete next[key]
          changed = true
        }
      })
      return changed ? next : prev
    })
  }, [rows])

  if (!node) {
    return (
      <div className="page">
        <p>节点不存在</p>
        <Link to="/edit">返回</Link>
      </div>
    )
  }

  if (!viewingContainer && !viewingBranchGroup) {
    return (
      <div className="page">
        <p>叶子节点没有子层，请返回上一层编辑。</p>
        <button type="button" className="btn" onClick={() => navigate(-1)}>返回</button>
      </div>
    )
  }

  const onAddFirst = () => {
    const id = addChild(nodeId, {
      asContainer: false,
      name: '',
      description: '',
      type: NODE_TYPES[0],
      startAt: null,
      status: STATUS.pending,
    })
    setFocusId(id)
  }

  return (
    <div className="page">
      <header className="page-header">
        <Breadcrumb path={path} mode="edit" />
        <div className="header-actions">
          <Link className="btn btn-primary" to={`/view/${nodeId}`}>查看日程</Link>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              if (window.confirm('重置数据？当前内容将清空。')) {
                reset()
                setFocusId(null)
                setActiveByRow({})
                bootRef.current = true
                setRowEntries([])
              }
            }}
          >
            清空重置
          </button>
        </div>
      </header>

      <section className="hero-block">
        <p className="eyebrow">{viewingBranchGroup ? '分支卡片' : '日程录入'}</p>
        <h1>{node.name}</h1>
        <p className="lede">
          {viewingBranchGroup
            ? '左右滑动切换分支；右上角 ↓ 添加下一级，→ 添加分支。'
            : '纵向为行程顺序；右上角 ↓ 添加下一级，→ 添加并列分支。'}
        </p>
      </section>

      <div className="entry-stack">
        {rowEntries.length === 0 && (
          <button type="button" className="entry-insert entry-insert-first" onClick={onAddFirst}>
            添加行程
          </button>
        )}

        {rowEntries.map((entry) => {
          const slides = viewingBranchGroup
            ? (entry.row || [])
            : resolveSlideItems(store, entry.row || [])
          return (
            <VerticalReveal
              key={entry.key}
              present={entry.present}
              instant={entry.instant}
              onExited={() => {
                setRowEntries((prev) => prev.filter((item) => item.key !== entry.key))
              }}
            >
              <BranchGroup
                slides={slides}
                parentId={nodeId}
                focusId={focusId}
                activeId={activeByRow[entry.key]}
                onActiveChange={(id) => {
                  setActiveByRow((prev) => ({ ...prev, [entry.key]: id }))
                  setFocusId(null)
                }}
                onInserted={setFocusId}
                onBranched={(id) => {
                  setActiveByRow((prev) => ({ ...prev, [entry.key]: id }))
                  setFocusId(id)
                }}
              />
            </VerticalReveal>
          )
        })}
      </div>
    </div>
  )
}
