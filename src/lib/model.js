import { EDGE_KIND, NODE_TYPES, ROOT_ID, STATUS } from './constants'

export function createId(prefix = 'n') {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`
}

export function createLeafNode({
  name = '',
  description = '',
  type = NODE_TYPES[0],
  startAt = null,
  status = STATUS.pending,
} = {}) {
  return {
    id: createId('leaf'),
    name,
    description,
    kind: 'leaf',
    type,
    startAt,
    status,
    children: [],
    edges: [],
  }
}

export function createContainerNode({
  name = '新行程',
  description = '',
  startAt = null,
} = {}) {
  return {
    id: createId('trip'),
    name,
    description,
    kind: 'container',
    type: null,
    startAt,
    status: STATUS.pending,
    children: [],
    edges: [],
  }
}

/** Parallel alternatives shown as a Swiper card in the parent timeline. */
export function createBranchGroupNode({
  name = '分支',
  description = '',
  startAt = null,
  children = [],
} = {}) {
  return {
    id: createId('branch'),
    name,
    description,
    kind: 'branch-group',
    type: null,
    startAt,
    status: STATUS.pending,
    children: [...children],
    edges: [],
  }
}

export function createRoot() {
  return {
    id: ROOT_ID,
    name: '我的旅程',
    description: '人生旅途的根节点，可在此添加旅行与安排',
    kind: 'container',
    type: null,
    startAt: null,
    status: STATUS.pending,
    children: [],
    edges: [],
  }
}

export function isContainer(node) {
  return node?.kind === 'container'
}

export function isBranchGroup(node) {
  return node?.kind === 'branch-group'
}

/** Trip containers and branch groups can own children. */
export function canHaveChildren(node) {
  return isContainer(node) || isBranchGroup(node)
}

export function getNode(store, id) {
  return store.nodes[id] ?? null
}

export function getChildren(store, containerId) {
  const container = getNode(store, containerId)
  if (!container) return []
  return container.children.map((id) => getNode(store, id)).filter(Boolean)
}

export function getPathToNode(store, nodeId) {
  const path = []
  let current = nodeId
  while (current) {
    const node = getNode(store, current)
    if (!node) break
    path.unshift(node)
    current = findParentId(store, current)
  }
  return path
}

export function findParentId(store, nodeId) {
  if (nodeId === ROOT_ID) return null
  for (const node of Object.values(store.nodes)) {
    if (node.children?.includes(nodeId)) return node.id
  }
  return null
}

/** Aggregate status for a node (containers / branch groups roll up from descendants). */
export function resolveStatus(store, nodeId) {
  const node = getNode(store, nodeId)
  if (!node) return STATUS.pending
  if (!canHaveChildren(node) || node.children.length === 0) {
    return node.status || STATUS.pending
  }
  const childStatuses = node.children.map((id) => resolveStatus(store, id))
  if (childStatuses.every((s) => s === STATUS.done)) return STATUS.done
  if (childStatuses.some((s) => s === STATUS.doing || s === STATUS.done)) {
    return STATUS.doing
  }
  return STATUS.pending
}

export function getIncoming(container, nodeId) {
  return (container.edges || []).filter((e) => e.to === nodeId)
}

export function getOutgoing(container, nodeId) {
  return (container.edges || []).filter((e) => e.from === nodeId)
}

export function getStartNodeIds(container) {
  const targets = new Set((container.edges || []).map((e) => e.to))
  return container.children.filter((id) => !targets.has(id))
}

/** Follow main edges from each start; pick earliest startAt when multiple starts. */
export function getMainPath(store, containerId) {
  const container = getNode(store, containerId)
  if (!container) return []

  const starts = getStartNodeIds(container)
  if (starts.length === 0) return []

  const sortedStarts = [...starts].sort((a, b) => {
    const na = getNode(store, a)
    const nb = getNode(store, b)
    return compareStartAt(na?.startAt, nb?.startAt)
  })

  // Prefer a start that is target of a main "virtual" — if multiple starts,
  // treat the first by time as main spine start; others appear as parallel in row 0.
  const path = []
  let current = sortedStarts[0]
  const visited = new Set()

  while (current && !visited.has(current)) {
    visited.add(current)
    path.push(current)
    const outs = getOutgoing(container, current)
    const main = outs.find((e) => e.kind === EDGE_KIND.main) || outs[0]
    current = main?.to ?? null
  }
  return path
}

export function compareStartAt(a, b) {
  if (!a && !b) return 0
  if (!a) return 1
  if (!b) return -1
  return a.localeCompare(b)
}

/**
 * Build timeline rows for a container.
 * Each row is an array of { id, isMain } shown in parallel.
 */
export function buildTimelineRows(store, containerId) {
  const container = getNode(store, containerId)
  if (!container || container.children.length === 0) return []

  const mainPath = getMainPath(store, containerId)
  const mainSet = new Set(mainPath)
  const shown = new Set()
  const rows = []

  const starts = getStartNodeIds(container)
  if (starts.length > 0) {
    const startMain = mainPath[0] ?? starts[0]
    const startRow = starts.map((id) => ({
      id,
      isMain: id === startMain,
    }))
    startRow.sort((a, b) => Number(b.isMain) - Number(a.isMain) || compareStartAt(
      getNode(store, a.id)?.startAt,
      getNode(store, b.id)?.startAt,
    ))
    rows.push(startRow)
    starts.forEach((id) => shown.add(id))
  }

  for (const nodeId of mainPath) {
    const outs = getOutgoing(container, nodeId)
    if (outs.length === 0) continue

    const nextIds = [...new Set(outs.map((e) => e.to))]
    const mainEdge = outs.find((e) => e.kind === EDGE_KIND.main)
    const mainNext = mainEdge?.to ?? nextIds[0]

    const row = nextIds.map((id) => ({
      id,
      isMain: id === mainNext,
    }))
    row.sort((a, b) => Number(b.isMain) - Number(a.isMain) || compareStartAt(
      getNode(store, a.id)?.startAt,
      getNode(store, b.id)?.startAt,
    ))

    // Avoid duplicating if already shown as starts-only weirdness
    const fresh = row.filter((item) => !shown.has(item.id))
    if (fresh.length > 0) {
      // If some were shown, still show the group if any new; merge shown check per row
      rows.push(row)
      row.forEach((item) => shown.add(item.id))
    }
  }

  // Orphan / unlinked children (no edges at all involvement)
  const orphans = container.children.filter((id) => !shown.has(id))
  orphans.sort((a, b) => compareStartAt(
    getNode(store, a)?.startAt,
    getNode(store, b)?.startAt,
  ))
  for (const id of orphans) {
    rows.push([{ id, isMain: true }])
    shown.add(id)
  }

  return rows
}

export function setMainEdge(container, fromId, toId) {
  const edges = (container.edges || []).map((e) => {
    if (e.from !== fromId) return e
    return { ...e, kind: e.to === toId ? EDGE_KIND.main : EDGE_KIND.branch }
  })
  return { ...container, edges }
}

export function addEdge(container, fromId, toId, kind = EDGE_KIND.main) {
  const edges = [...(container.edges || [])]
  if (edges.some((e) => e.from === fromId && e.to === toId)) {
    return setMainEdge({ ...container, edges }, fromId, kind === EDGE_KIND.main ? toId : edges.find((e) => e.from === fromId && e.kind === EDGE_KIND.main)?.to)
  }

  if (kind === EDGE_KIND.main) {
    for (let i = 0; i < edges.length; i += 1) {
      if (edges[i].from === fromId && edges[i].kind === EDGE_KIND.main) {
        edges[i] = { ...edges[i], kind: EDGE_KIND.branch }
      }
    }
  } else if (!edges.some((e) => e.from === fromId && e.kind === EDGE_KIND.main)) {
    kind = EDGE_KIND.main
  }

  edges.push({ from: fromId, to: toId, kind })
  return { ...container, edges }
}

export function removeEdge(container, fromId, toId) {
  let edges = (container.edges || []).filter((e) => !(e.from === fromId && e.to === toId))
  // Ensure each from still has a main if any outs remain
  const byFrom = {}
  for (const e of edges) {
    if (!byFrom[e.from]) byFrom[e.from] = []
    byFrom[e.from].push(e)
  }
  edges = edges.map((e) => {
    const group = byFrom[e.from]
    if (!group.some((x) => x.kind === EDGE_KIND.main) && group[0].to === e.to) {
      return { ...e, kind: EDGE_KIND.main }
    }
    return e
  })
  return { ...container, edges }
}

/** True if this node shares a fork with other alternatives (sibling branches). */
export function hasBranchSiblings(container, nodeId) {
  const edges = container.edges || []
  const incomings = edges.filter((e) => e.to === nodeId)

  if (incomings.length === 0) {
    const starts = getStartNodeIds(container)
    return starts.includes(nodeId) && starts.length > 1
  }

  return incomings.some((inc) => edges.filter((e) => e.from === inc.from).length > 1)
}

/**
 * Remove a node from the parent's flow graph.
 * If it has no sibling branches, reconnect each predecessor to each successor
 * so the next level takes this node's place.
 */
export function detachNodeFromFlow(container, nodeId) {
  const edges = container.edges || []
  const incomings = edges.filter((e) => e.to === nodeId)
  const outgoings = edges.filter((e) => e.from === nodeId)
  const splice = !hasBranchSiblings(container, nodeId)

  let next = { ...container, edges: [...edges] }

  if (splice) {
    for (const inc of incomings) {
      for (const out of outgoings) {
        if (inc.from === out.to) continue
        const kind = (inc.kind === EDGE_KIND.main && out.kind === EDGE_KIND.main)
          ? EDGE_KIND.main
          : EDGE_KIND.branch
        next = addEdge(next, inc.from, out.to, kind)
      }
    }
  }

  next = {
    ...next,
    edges: (next.edges || []).filter((e) => e.from !== nodeId && e.to !== nodeId),
  }

  // Repair main flags per from-group
  const byFrom = {}
  for (const e of next.edges) {
    if (!byFrom[e.from]) byFrom[e.from] = []
    byFrom[e.from].push(e)
  }
  next = {
    ...next,
    edges: next.edges.map((e) => {
      const group = byFrom[e.from]
      const hasMain = group.some((x) => x.kind === EDGE_KIND.main)
      if (!hasMain && group[0].to === e.to) return { ...e, kind: EDGE_KIND.main }
      return e
    }),
  }

  return next
}

export function filterRows(store, rows, { dates, types }) {
  const dateSet = dates?.length ? new Set(dates) : null
  const typeSet = types?.length ? new Set(types) : null

  return rows
    .map((row) => row.filter(({ id }) => {
      const node = getNode(store, id)
      if (!node) return false
      if (dateSet) {
        const day = node.startAt ? node.startAt.slice(0, 10) : null
        if (!day || !dateSet.has(day)) return false
      }
      if (typeSet) {
        // containers have no type — hide them when filtering by type
        if (isContainer(node) || !typeSet.has(node.type)) return false
      }
      return true
    }))
    .filter((row) => row.length > 0)
}

export function collectDatesInContainer(store, containerId) {
  const children = getChildren(store, containerId)
  const dates = new Set()
  for (const child of children) {
    if (child.startAt) dates.add(child.startAt.slice(0, 10))
  }
  return [...dates].sort()
}

export function formatDateTime(iso) {
  if (!iso) return '未定时间'
  const local = toDatetimeLocalValue(iso)
  return local ? local.replace('T', ' ') : iso
}

export function formatDate(isoDay) {
  if (!isoDay) return ''
  const [y, m, d] = isoDay.split('-')
  return `${y}年${m}月${d}日`
}

/** datetime-local value in Beijing wall time: YYYY-MM-DDTHH:mm */
export function toDatetimeLocalValue(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d)
  const get = (type) => parts.find((p) => p.type === type)?.value
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`
}

/** Display / text input: YYYY-MM-DD HH:mm */
export function toDateTimeInputValue(iso) {
  const local = toDatetimeLocalValue(iso)
  return local ? local.replace('T', ' ') : ''
}

/** Interpret datetime-local (YYYY-MM-DDTHH:mm) as Beijing time → ISO UTC string */
export function fromDatetimeLocalValue(local) {
  if (!local) return null
  const withOffset = `${local}:00+08:00`
  const d = new Date(withOffset)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

/** Parse YYYY-MM-DD HH:mm (or with T) as Beijing time */
export function fromDateTimeInputValue(value) {
  if (!value?.trim()) return null
  const normalized = value.trim().replace(' ', 'T').slice(0, 16)
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(normalized)) return null
  return fromDatetimeLocalValue(normalized)
}
