import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, Navigate, useParams } from 'react-router-dom'
import {
  ConfirmModal,
  IconEdit,
  IconExport,
  IconImport,
  IconNested,
  IconTrash,
  IconView,
  TipButton,
  TipLink,
} from '../components/actionUi'
import { DEFAULT_GROUP_NAME, DEFAULT_NODE_TYPE, DEFAULT_TRIP_DESC, GROUP_TYPE_LABEL, ITINERARY_TYPE, NODE_TYPES, ROOT_ID } from '../lib/constants'
import { captureFlipRects, playFlip } from '../lib/flip'
import {
  editBreadcrumbTrail,
  editPathFor,
  fromDatetimeLocalValue,
  getNode,
  isGroup,
  isItineraryTrip,
  isTrip,
  toDatetimeLocalValue,
  viewPathFor,
} from '../lib/model'
import { useStore } from '../lib/store'
import {
  downloadStoreJson,
  makeExportFilename,
  parseStorePayload,
} from '../lib/storage'
import { TypeIcon, typeToneClass } from '../lib/typeIcons'

const EditUiContext = createContext(null)

function useEditUi() {
  const ctx = useContext(EditUiContext)
  if (!ctx) throw new Error('useEditUi requires EditUiContext')
  return ctx
}

const NARROW_CARD_MAX = 136 // px — too narrow for 3 action icons

/**
 * Wide: hover overlay with icon buttons.
 * Narrow: hover shows an external tooltip with the same clickable icons.
 * items: { id, label, tip, danger?, to?, icon, onClick? }
 */
function CardActions({ items, onActivateCard }) {
  const rootRef = useRef(null)
  const tipRef = useRef(null)
  const hideTimerRef = useRef(null)
  const [narrow, setNarrow] = useState(false)
  const [tipOpen, setTipOpen] = useState(false)
  const [pos, setPos] = useState(null)

  const clearHide = () => {
    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }
  }

  const scheduleHide = () => {
    clearHide()
    hideTimerRef.current = window.setTimeout(() => setTipOpen(false), 120)
  }

  const updatePos = () => {
    const card = rootRef.current?.closest('.trip-card')
    if (!card) return
    const rect = card.getBoundingClientRect()
    const tipWidth = 7.5 * 16
    const gap = 8
    let left = rect.right + gap
    if (left + tipWidth > window.innerWidth - 8) {
      left = Math.max(8, rect.left - tipWidth - gap)
    }
    let top = rect.top
    if (top + 44 > window.innerHeight - 8) {
      top = Math.max(8, window.innerHeight - 52)
    }
    setPos({ top, left })
  }

  useEffect(() => {
    const card = rootRef.current?.closest('.trip-card')
    if (!card) return undefined

    const ro = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect?.width ?? card.getBoundingClientRect().width
      const nextNarrow = width < NARROW_CARD_MAX
      setNarrow(nextNarrow)
      card.classList.toggle('is-narrow', nextNarrow)
      if (!nextNarrow) setTipOpen(false)
    })
    ro.observe(card)

    // Use mouseover so nested trip-cards steal the tip from their parent.
    const onOver = (e) => {
      if (!card.classList.contains('is-narrow')) return
      if (e.target.closest('.trip-card') !== card) {
        scheduleHide()
        return
      }
      clearHide()
      updatePos()
      setTipOpen(true)
    }
    const onOut = (e) => {
      if (!card.classList.contains('is-narrow')) return
      const next = e.relatedTarget
      if (next && tipRef.current?.contains(next)) return
      if (next && card.contains(next) && next.closest('.trip-card') === card) return
      scheduleHide()
    }
    const onFocusIn = (e) => {
      if (!card.classList.contains('is-narrow')) return
      if (e.target.closest('.trip-card') !== card) return
      clearHide()
      updatePos()
      setTipOpen(true)
    }
    const onFocusOut = (e) => {
      if (card.contains(e.relatedTarget)) return
      if (tipRef.current?.contains(e.relatedTarget)) return
      scheduleHide()
    }

    card.addEventListener('mouseover', onOver)
    card.addEventListener('mouseout', onOut)
    card.addEventListener('focusin', onFocusIn)
    card.addEventListener('focusout', onFocusOut)

    return () => {
      ro.disconnect()
      clearHide()
      card.classList.remove('is-narrow')
      card.removeEventListener('mouseover', onOver)
      card.removeEventListener('mouseout', onOut)
      card.removeEventListener('focusin', onFocusIn)
      card.removeEventListener('focusout', onFocusOut)
    }
  }, [])

  useEffect(() => {
    if (!tipOpen || !narrow) return undefined
    updatePos()
    const onScroll = () => updatePos()
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [tipOpen, narrow])

  const renderIcons = (inTooltip) => items.map((item) => (
    item.to ? (
      <TipLink
        key={item.id}
        tip={inTooltip ? undefined : (item.tip || item.label)}
        className={`trip-icon-btn${item.danger ? ' is-danger' : ''}`}
        to={item.to}
        aria-label={item.label}
        onClick={(e) => {
          e.stopPropagation()
          setTipOpen(false)
          item.onClick?.(e)
        }}
      >
        {item.icon}
      </TipLink>
    ) : (
      <TipButton
        key={item.id}
        tip={inTooltip ? undefined : (item.tip || item.label)}
        className={`trip-icon-btn${item.danger ? ' is-danger' : ''}`}
        aria-label={item.label}
        onClick={(e) => {
          e.stopPropagation()
          setTipOpen(false)
          item.onClick?.(e)
        }}
      >
        {item.icon}
      </TipButton>
    )
  ))

  return (
    <>
      <div
        ref={rootRef}
        className="trip-card-actions"
        onClick={(e) => {
          e.stopPropagation()
          onActivateCard?.()
        }}
      >
        <div className="trip-actions-wide">
          {renderIcons(false)}
        </div>
      </div>

      {narrow && tipOpen && pos
        ? createPortal(
          <div
            ref={tipRef}
            className="trip-actions-tooltip"
            style={{ top: pos.top, left: pos.left }}
            role="toolbar"
            aria-label="卡片操作"
            onMouseEnter={() => {
              clearHide()
              setTipOpen(true)
            }}
            onMouseLeave={scheduleHide}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              onActivateCard?.()
            }}
          >
            {renderIcons(true)}
          </div>,
          document.body,
        )
        : null}
    </>
  )
}

function AddTripSlot({ variant = 'below', onClick, style, className = '' }) {
  return (
    <button
      type="button"
      className={`trip-add trip-add-${variant}${className ? ` ${className}` : ''}`}
      style={style}
      aria-label="添加行程"
      onClick={(e) => {
        e.stopPropagation()
        onClick?.(e)
      }}
    >
      <span className="trip-add-label trip-add-label-full">+ 添加行程</span>
      <span className="trip-add-label trip-add-label-short" aria-hidden>+</span>
    </button>
  )
}

function emptyTripForm() {
  return {
    name: '',
    description: '',
    type: DEFAULT_NODE_TYPE,
    startAtLocal: '',
  }
}

function formFromNode(node) {
  return {
    name: node?.name || '',
    description: node?.description || '',
    type: isItineraryTrip(node) ? ITINERARY_TYPE : (node?.type || DEFAULT_NODE_TYPE),
    startAtLocal: toDatetimeLocalValue(node?.startAt),
  }
}

function TripFormModal({
  open,
  title,
  initial,
  lockType = false,
  showType = true,
  showTime = true,
  namePlaceholder = '行程名称',
  confirmLabel = '确定',
  onCancel,
  onConfirm,
}) {
  const [form, setForm] = useState(emptyTripForm)
  const nameRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    setForm({ ...emptyTripForm(), ...initial })
    const t = window.setTimeout(() => nameRef.current?.focus(), 20)
    return () => window.clearTimeout(t)
  }, [open, initial])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  const patch = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  const submit = (e) => {
    e.preventDefault()
    onConfirm?.({
      name: form.name.trim(),
      description: form.description.trim(),
      type: lockType ? ITINERARY_TYPE : form.type,
      startAt: fromDatetimeLocalValue(form.startAtLocal),
    })
  }

  return createPortal(
    <div className="modal-backdrop" onClick={onCancel} role="presentation">
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="trip-form-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="trip-form-title" className="modal-title">{title}</h2>
        <form className="modal-form" onSubmit={submit}>
          <label className="modal-field">
            <span className="modal-label">名称</span>
            <input
              ref={nameRef}
              className="modal-input"
              value={form.name}
              onChange={(e) => patch('name', e.target.value)}
              placeholder={namePlaceholder}
              required
            />
          </label>
          <label className="modal-field">
            <span className="modal-label">描述</span>
            <textarea
              className="modal-input modal-textarea"
              value={form.description}
              onChange={(e) => patch('description', e.target.value)}
              placeholder="可选描述"
              rows={3}
            />
          </label>
          {showType ? (
            <label className="modal-field">
              <span className="modal-label">类型</span>
              {lockType ? (
                <span className={`modal-static-type ${typeToneClass(ITINERARY_TYPE)}`}>
                  <TypeIcon type={ITINERARY_TYPE} className="type-icon-inline" />
                  {ITINERARY_TYPE}
                </span>
              ) : (
                <select
                  className="modal-input"
                  value={form.type}
                  onChange={(e) => patch('type', e.target.value)}
                >
                  {NODE_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              )}
            </label>
          ) : null}
          {showTime ? (
            <label className="modal-field">
              <span className="modal-label">时间</span>
              <input
                className="modal-input"
                type="datetime-local"
                value={form.startAtLocal}
                onChange={(e) => patch('startAtLocal', e.target.value)}
              />
            </label>
          ) : null}
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onCancel}>
              取消
            </button>
            <button type="submit" className="btn btn-primary">
              {confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  )
}

/** True if rootId is targetId or an ancestor of it (via next / members). */
function nodeContains(store, rootId, targetId) {
  if (!rootId || !targetId) return false
  if (rootId === targetId) return true
  const node = getNode(store, rootId)
  if (!node) return false
  for (const id of node.next || []) {
    if (nodeContains(store, id, targetId)) return true
  }
  for (const id of node.members || []) {
    if (nodeContains(store, id, targetId)) return true
  }
  return false
}

/** Preorder flatten along subsequent next (not members, not children). */
function flattenColumnEntries(store, nodeId) {
  const node = getNode(store, nodeId)
  if (!node || (!isTrip(node) && !isGroup(node))) return []
  const entries = [{ id: nodeId, node }]
  for (const nextId of node.next || []) {
    entries.push(...flattenColumnEntries(store, nextId))
  }
  return entries
}

function flattenForest(store, rootIds) {
  return rootIds.flatMap((id) => flattenColumnEntries(store, id))
}

/** Deepest entry in a flat list that contains activeId. */
function findExpandedEntryId(store, entries, activeId) {
  if (!activeId) return null
  let expandedId = null
  for (const entry of entries) {
    if (nodeContains(store, entry.id, activeId)) expandedId = entry.id
  }
  return expandedId
}

function TripCard({
  nodeId,
  onDelete,
  activeId,
  onActivate,
  style,
  className = '',
}) {
  const { store } = useStore()
  const { openEditTrip } = useEditUi()
  const node = getNode(store, nodeId)
  const isActive = activeId === nodeId

  if (!node || !isTrip(node)) return null

  const lockedItinerary = isItineraryTrip(node)
  const typeLabel = lockedItinerary ? ITINERARY_TYPE : (node.type || DEFAULT_NODE_TYPE)

  const actionItems = [
    {
      id: 'edit',
      label: '编辑信息',
      tip: '编辑信息',
      icon: <IconEdit />,
      onClick: () => openEditTrip(node.id),
    },
    {
      id: 'internals',
      label: '内部行程',
      tip: '内部行程',
      icon: <IconNested />,
      to: editPathFor(node.id),
    },
    {
      id: 'delete',
      label: '删除',
      tip: '删除',
      danger: true,
      icon: <IconTrash />,
      onClick: () => {
        if (window.confirm(`删除「${node.name || '未命名'}」？`)) {
          onDelete(node.id)
        }
      },
    },
  ]

  return (
    <article
      className={`trip-card${isActive ? ' is-active' : ''}${lockedItinerary ? ' is-itinerary' : ''}${className ? ` ${className}` : ''}`}
      style={style}
      data-flip-id={`card:${nodeId}`}
      onClick={() => onActivate?.(nodeId)}
    >
      <CardActions
        items={actionItems}
        onActivateCard={() => onActivate?.(nodeId)}
      />

      <div className="trip-card-top">
        <div className="trip-card-meta">
          <span
            className={`trip-type-tag${lockedItinerary ? ' is-static' : ''} ${typeToneClass(typeLabel)}`}
            title={typeLabel}
          >
            <TypeIcon type={typeLabel} />
            <span className="visually-hidden">{typeLabel}</span>
          </span>

          <div className="trip-heading">
            <span className="trip-heading-title">
              {node.name?.trim() || '未命名行程'}
            </span>
            <span className={`trip-heading-desc${node.description?.trim() ? '' : ' is-placeholder'}`}>
              {node.description?.trim() || DEFAULT_TRIP_DESC}
            </span>
          </div>
        </div>
      </div>
    </article>
  )
}

/** One stretch unit: card/shell + optional right + below. */
function StretchUnit({
  nodeId,
  showRight,
  isLast = false,
  expanded,
  collapsed,
  focusId,
  onFocus,
  activeId,
  onActivate,
  depth,
}) {
  const { store, addNext, addBeside, deleteNode } = useStore()
  const { openCreateTrip } = useEditUi()
  const node = getNode(store, nodeId)
  if (!node) return null

  const isActive = activeId === nodeId
  // Always expose below-add on the outermost column's last card.
  const showBelowAdd = isActive || isLast
  const showRightAdd = isActive && showRight
  const stateClass = expanded ? ' is-expanded' : (collapsed ? ' is-collapsed' : '')

  return (
    <div className={`stretch-unit${showRightAdd ? ' has-right' : ''}${showBelowAdd ? ' has-add' : ''}${stateClass}`}>
      {isTrip(node) ? (
        <TripCard
          nodeId={nodeId}
          onDelete={deleteNode}
          activeId={activeId}
          onActivate={onActivate}
          className="stretch-unit-card"
        />
      ) : (
        <GroupShell
          nodeId={nodeId}
          focusId={focusId}
          onFocus={onFocus}
          activeId={activeId}
          onActivate={onActivate}
          depth={depth}
          className="stretch-unit-card"
        />
      )}
      {showRightAdd && (
        <AddTripSlot
          variant="right"
          className="stretch-unit-right"
          onClick={() => openCreateTrip(() => addBeside(nodeId))}
        />
      )}
      {showBelowAdd && (
        <AddTripSlot
          variant="below"
          className="stretch-unit-below"
          onClick={() => openCreateTrip(() => addNext(nodeId))}
        />
      )}
    </div>
  )
}

/**
 * Vertical column of flattened nodes. With activeId, the expanded unit
 * takes remaining height; others collapse to add-slot height.
 */
function StretchColumn({
  rootIds,
  activeId,
  onActivate,
  focusId,
  onFocus,
  depth = 0,
  showRightFor,
  persistLastBelowAdd = false,
  className = '',
}) {
  const { store } = useStore()
  const entries = flattenForest(store, rootIds)
  if (entries.length === 0) return null

  const expandedId = findExpandedEntryId(store, entries, activeId)
  const hasActive = Boolean(expandedId)

  return (
    <div
      className={`stretch-column${hasActive ? ' has-active' : ''}${className ? ` ${className}` : ''}`}
      style={{ '--col-units': entries.length }}
    >
      {entries.map((entry, index) => {
        const expanded = hasActive && entry.id === expandedId
        const collapsed = hasActive && !expanded
        const showRight = showRightFor
          ? showRightFor(entry, entries)
          : true
        const isLast = persistLastBelowAdd && index === entries.length - 1
        return (
          <StretchUnit
            key={entry.id}
            nodeId={entry.id}
            showRight={showRight}
            isLast={isLast}
            expanded={expanded}
            collapsed={collapsed}
            focusId={focusId}
            onFocus={onFocus}
            activeId={activeId}
            onActivate={onActivate}
            depth={depth}
          />
        )
      })}
    </div>
  )
}

/**
 * Group card: parallel member columns.
 * Active column grows; other columns shrink to add-slot width.
 */
function GroupShell({
  nodeId,
  focusId,
  onFocus,
  activeId,
  onActivate,
  depth = 0,
  className = '',
  style,
}) {
  const { store, deleteNode, addGroupMember } = useStore()
  const { openCreateTrip, openEditGroup } = useEditUi()
  const group = getNode(store, nodeId)
  if (!group || !isGroup(group)) return null

  const members = (group.members || [])
    .map((id) => ({ id, node: getNode(store, id) }))
    .filter((item) => item.node && (isTrip(item.node) || isGroup(item.node)))
  if (members.length === 0) return null

  const activeColIndex = activeId
    ? members.findIndex((item) => nodeContains(store, item.id, activeId))
    : -1
  const hasActiveCol = activeColIndex >= 0
  const isActiveGroup = activeId === nodeId

  // Explicit tracks so FLIP measures stable column targets (not repeat()).
  const memberCols = members
    .map((_, index) => (
      hasActiveCol && index !== activeColIndex
        ? 'var(--trip-add-slot)'
        : 'minmax(0, 1fr)'
    ))
    .join(' ')

  const actionItems = [
    {
      id: 'edit',
      label: '编辑信息',
      tip: '编辑信息',
      icon: <IconEdit />,
      onClick: () => openEditGroup(group.id),
    },
    {
      id: 'delete',
      label: '删除',
      tip: '删除',
      danger: true,
      icon: <IconTrash />,
      onClick: () => {
        if (window.confirm(`删除「${group.name?.trim() || DEFAULT_GROUP_NAME}」？`)) {
          deleteNode(group.id)
        }
      },
    },
  ]

  return (
    <article
      className={`trip-card trip-group-shell${isActiveGroup ? ' is-active' : ''}${className ? ` ${className}` : ''}`}
      style={style}
      data-flip-id={`card:${nodeId}`}
      onClick={() => onActivate?.(nodeId)}
    >
      <CardActions
        items={actionItems}
        onActivateCard={() => onActivate?.(nodeId)}
      />

      <div className="trip-card-top">
        <div className="trip-card-meta">
          <span className={`trip-type-tag is-static ${typeToneClass(GROUP_TYPE_LABEL)}`} title={GROUP_TYPE_LABEL}>
            <TypeIcon type={GROUP_TYPE_LABEL} />
            <span className="visually-hidden">{GROUP_TYPE_LABEL}</span>
          </span>
          <div className="trip-heading">
            <span className="trip-heading-title">
              {group.name?.trim() || DEFAULT_GROUP_NAME}
            </span>
            <span className={`trip-heading-desc${group.description?.trim() ? '' : ' is-placeholder'}`}>
              {group.description?.trim() || DEFAULT_TRIP_DESC}
            </span>
          </div>
        </div>
      </div>

      <div
        className={`trip-group-body${isActiveGroup ? ' has-group-right' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`trip-group-grid${hasActiveCol ? ' has-active-col' : ' is-idle'}`}
          style={{ gridTemplateColumns: memberCols }}
        >
          {members.map((item, index) => {
            const colCollapsed = hasActiveCol && index !== activeColIndex
            return (
              <StretchColumn
                key={item.id}
                rootIds={[item.id]}
                activeId={activeId}
                onActivate={onActivate}
                focusId={focusId}
                onFocus={onFocus}
                depth={depth + 1}
                className={colCollapsed ? 'is-col-collapsed' : (hasActiveCol && index === activeColIndex ? 'is-col-expanded' : '')}
                showRightFor={() => true}
              />
            )
          })}
        </div>
        {isActiveGroup && (
          <AddTripSlot
            variant="right"
            className="trip-group-insert-right"
            onClick={() => openCreateTrip(() => addGroupMember(nodeId))}
          />
        )}
      </div>
    </article>
  )
}

export default function EditPage() {
  const { nodeId: scopeParam } = useParams()
  const { store, addNext, addChild, reset, replaceStore, updateNode } = useStore()
  const [focusId, setFocusId] = useState(null)
  const [activeId, setActiveId] = useState(null)
  const [tripForm, setTripForm] = useState(null)
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)
  const [pendingImport, setPendingImport] = useState(null)
  const [importError, setImportError] = useState(null)
  const pendingFlipRef = useRef(null)
  const importInputRef = useRef(null)

  const scopeId = scopeParam || ROOT_ID
  const scope = getNode(store, scopeId)
  const isRootScope = scopeId === ROOT_ID

  const activateWithFlip = useCallback((id) => {
    const stack = document.querySelector('.trip-stack')
    pendingFlipRef.current = captureFlipRects(stack || document)
    setActiveId(id)
  }, [])

  const clearActiveOnBlank = useCallback((e) => {
    if (!activeId) return
    if (e.target.closest('.trip-card, .trip-add, .trip-actions-tooltip, .modal-backdrop, .floating-tip')) {
      return
    }
    activateWithFlip(null)
  }, [activeId, activateWithFlip])

  useLayoutEffect(() => {
    const first = pendingFlipRef.current
    pendingFlipRef.current = null
    if (!first) return
    const stack = document.querySelector('.trip-stack')
    playFlip(first, { root: stack || document })
  }, [activeId])

  useEffect(() => {
    setFocusId(null)
    setActiveId(null)
    setTripForm(null)
  }, [scopeId])

  const closeTripForm = () => setTripForm(null)

  const openCreateTrip = (createFn) => {
    setTripForm({
      mode: 'create',
      title: '添加行程',
      confirmLabel: '添加',
      lockType: false,
      showType: true,
      showTime: true,
      namePlaceholder: '行程名称',
      initial: emptyTripForm(),
      onConfirm: (values) => {
        const result = createFn()
        const tripId = result && typeof result === 'object' ? result.tripId : result
        const activateId = result && typeof result === 'object'
          ? (result.activateId ?? result.tripId)
          : result
        if (!tripId) {
          setTripForm(null)
          return
        }
        updateNode(tripId, {
          name: values.name,
          description: values.description,
          type: values.type,
          startAt: values.startAt,
        })
        setFocusId(tripId)
        activateWithFlip(activateId)
        setTripForm(null)
      },
    })
  }

  const openEditTrip = (nodeId) => {
    const node = getNode(store, nodeId)
    if (!node || !isTrip(node)) return
    const locked = isItineraryTrip(node)
    setTripForm({
      mode: 'edit',
      title: '编辑行程信息',
      confirmLabel: '保存',
      lockType: locked,
      showType: true,
      showTime: true,
      namePlaceholder: '行程名称',
      initial: formFromNode(node),
      onConfirm: (values) => {
        const patch = {
          name: values.name,
          description: values.description,
          startAt: values.startAt,
        }
        if (!locked) patch.type = values.type
        updateNode(nodeId, patch)
        setTripForm(null)
      },
    })
  }

  const openEditGroup = (nodeId) => {
    const node = getNode(store, nodeId)
    if (!node || !isGroup(node)) return
    setTripForm({
      mode: 'edit-group',
      title: '编辑行程组信息',
      confirmLabel: '保存',
      lockType: false,
      showType: false,
      showTime: false,
      namePlaceholder: '行程组名称',
      initial: {
        name: node.name || '',
        description: node.description || '',
      },
      onConfirm: (values) => {
        updateNode(nodeId, {
          name: values.name,
          description: values.description,
        })
        setTripForm(null)
      },
    })
  }

  if (!scope) {
    return <Navigate to="/edit" replace />
  }

  if (!isRootScope && !isTrip(scope)) {
    return <Navigate to="/edit" replace />
  }

  const title = isRootScope
    ? (scope.name || '我的旅程')
    : (scope.name?.trim() || '未命名行程')
  const forestIds = isRootScope ? (scope.next || []) : (scope.children || [])
  const breadcrumbs = isRootScope ? null : editBreadcrumbTrail(store, scopeId)

  const editUi = { openCreateTrip, openEditTrip, openEditGroup }

  return (
    <EditUiContext.Provider value={editUi}>
      <div className="page" onClick={clearActiveOnBlank}>
        <header className="page-header">
          <div className="page-brand">
            {breadcrumbs?.length ? (
              <nav className="edit-breadcrumb" aria-label="内部行程路径">
                <ol className="edit-breadcrumb-list">
                  {breadcrumbs.map((crumb, index) => {
                    const isLast = index === breadcrumbs.length - 1
                    return (
                      <li key={crumb.id} className="edit-breadcrumb-item">
                        {isLast ? (
                          <span className="edit-breadcrumb-current" aria-current="page">
                            {crumb.label}
                          </span>
                        ) : (
                          <Link className="edit-breadcrumb-link" to={crumb.path}>
                            {crumb.label}
                          </Link>
                        )}
                      </li>
                    )
                  })}
                </ol>
              </nav>
            ) : (
              <p className="eyebrow">我的旅程</p>
            )}
            <h1 className="page-title">{title}</h1>
          </div>
          <div className="header-actions">
            {!isRootScope ? (
              <TipButton
                tip="编辑行程信息"
                className="header-icon-btn"
                aria-label="编辑行程信息"
                onClick={() => openEditTrip(scope.id)}
              >
                <IconEdit />
              </TipButton>
            ) : null}
            <TipLink
              tip="查看行程"
              className="header-icon-btn"
              to={viewPathFor(scopeId)}
              aria-label="查看行程"
            >
              <IconView />
            </TipLink>
            {isRootScope ? (
              <>
                <TipButton
                  tip="导出数据"
                  className="header-icon-btn"
                  aria-label="导出数据"
                  onClick={() => downloadStoreJson(store, makeExportFilename())}
                >
                  <IconExport />
                </TipButton>
                <TipButton
                  tip="导入数据"
                  className="header-icon-btn"
                  aria-label="导入数据"
                  onClick={() => importInputRef.current?.click()}
                >
                  <IconImport />
                </TipButton>
                <TipButton
                  tip="清空重置"
                  className="header-icon-btn is-danger"
                  aria-label="清空重置"
                  onClick={() => setResetConfirmOpen(true)}
                >
                  <IconTrash />
                </TipButton>
                <input
                  ref={importInputRef}
                  type="file"
                  accept="application/json,.json"
                  className="visually-hidden"
                  tabIndex={-1}
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    e.target.value = ''
                    if (!file) return
                    try {
                      const text = await file.text()
                      const next = parseStorePayload(text)
                      setImportError(null)
                      setPendingImport(next)
                    } catch (err) {
                      setPendingImport(null)
                      setImportError(err instanceof Error ? err.message : '导入失败')
                    }
                  }}
                />
              </>
            ) : null}
          </div>
        </header>

        <section className="hero-block">
          <p className="lede">
            {isRootScope
              ? '点击「添加行程」，开启一段惊心动魄的旅程吧！'
              : '点击「添加行程」，开启又一段惊心动魄的旅程吧！'}
          </p>
        </section>

        <div className="trip-stack">
          {forestIds.length === 0 ? (
            <AddTripSlot
              variant="empty"
              onClick={() => openCreateTrip(() => (
                isRootScope ? addNext(scopeId) : addChild(scopeId)
              ))}
            />
          ) : (
            <StretchColumn
              rootIds={forestIds}
              activeId={activeId}
              onActivate={activateWithFlip}
              focusId={focusId}
              onFocus={(id) => {
                setFocusId(id)
                activateWithFlip(id)
              }}
              depth={0}
              className="trip-stack-column"
              persistLastBelowAdd
              showRightFor={() => true}
            />
          )}
        </div>

        <TripFormModal
          key={tripForm ? `${tripForm.mode}-${tripForm.title}` : 'closed'}
          open={Boolean(tripForm)}
          title={tripForm?.title || ''}
          initial={tripForm?.initial || emptyTripForm()}
          lockType={Boolean(tripForm?.lockType)}
          showType={tripForm?.showType !== false}
          showTime={tripForm?.showTime !== false}
          namePlaceholder={tripForm?.namePlaceholder || '行程名称'}
          confirmLabel={tripForm?.confirmLabel || '确定'}
          onCancel={closeTripForm}
          onConfirm={(values) => tripForm?.onConfirm?.(values)}
        />

        <ConfirmModal
          open={resetConfirmOpen}
          title="清空重置"
          message="确定清空当前全部行程数据？此操作不可撤销。"
          confirmLabel="清空"
          danger
          onCancel={() => setResetConfirmOpen(false)}
          onConfirm={() => {
            reset()
            setFocusId(null)
            setActiveId(null)
            setResetConfirmOpen(false)
          }}
        />

        <ConfirmModal
          open={Boolean(pendingImport)}
          title="导入数据"
          message="导入将覆盖当前全部行程数据，是否继续？"
          confirmLabel="导入"
          danger
          onCancel={() => setPendingImport(null)}
          onConfirm={() => {
            if (pendingImport) {
              replaceStore(pendingImport)
              setFocusId(null)
              setActiveId(null)
            }
            setPendingImport(null)
          }}
        />

        <ConfirmModal
          open={Boolean(importError)}
          title="导入失败"
          message={importError || '无法读取该文件'}
          confirmLabel="知道了"
          cancelLabel="关闭"
          onCancel={() => setImportError(null)}
          onConfirm={() => setImportError(null)}
        />
      </div>
    </EditUiContext.Provider>
  )
}
