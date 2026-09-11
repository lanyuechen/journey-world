import { ITINERARY_TYPE, ITINERARY_TYPE_LEGACY, NODE_KIND, NODE_TYPES, DEFAULT_NODE_TYPE, ROOT_ID, STATUS } from './constants'

export function createId(prefix = 'n') {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`
}

export function createRoot() {
  return {
    id: ROOT_ID,
    kind: NODE_KIND.root,
    name: '我的旅程',
    description: '人生旅途的根节点，可在此添加旅行与安排',
    children: [],
  }
}

export function createTripNode({
  name = '',
  description = '',
  type = DEFAULT_NODE_TYPE,
  startAt = null,
  status = STATUS.pending,
  children = [],
  internals = [],
} = {}) {
  return {
    id: createId('trip'),
    kind: NODE_KIND.trip,
    name,
    description,
    type,
    startAt,
    status,
    /** Subsequent trips under this card (below-add); shown in outer column. */
    children: [...children],
    /** Internal itinerary (edit-button); card attribute; not shown in outer column. */
    internals: [...internals],
  }
}

export function createGroupNode({
  name = '',
  description = '',
  members = [],
  children = [],
} = {}) {
  return {
    id: createId('group'),
    kind: NODE_KIND.group,
    name,
    description,
    members: [...members],
    children: [...children],
  }
}

export function isRoot(node) {
  return node?.kind === NODE_KIND.root
}

export function isTrip(node) {
  return node?.kind === NODE_KIND.trip
}

export function isGroup(node) {
  return node?.kind === NODE_KIND.group
}

export function getInternals(node) {
  return node?.internals || []
}

export function isItineraryTrip(node) {
  if (!isTrip(node)) return false
  if (!getInternals(node).length) return false
  return node.type === ITINERARY_TYPE || ITINERARY_TYPE_LEGACY.includes(node.type)
}

/**
 * Trip with internals → type「行程」; empty internals → restore ordinary type.
 * Mutates and returns the node.
 */
export function syncItineraryType(node) {
  if (!isTrip(node)) return node

  if (!Array.isArray(node.internals)) node.internals = []

  const hasInternals = node.internals.length > 0
  const isItineraryLabel = node.type === ITINERARY_TYPE
    || ITINERARY_TYPE_LEGACY.includes(node.type)

  if (hasInternals) {
    if (!isItineraryLabel) {
      node.typeBeforeItinerary = NODE_TYPES.includes(node.type) ? node.type : DEFAULT_NODE_TYPE
    }
    node.type = ITINERARY_TYPE
    return node
  }

  if (isItineraryLabel) {
    const restored = NODE_TYPES.includes(node.typeBeforeItinerary)
      ? node.typeBeforeItinerary
      : DEFAULT_NODE_TYPE
    node.type = restored
    delete node.typeBeforeItinerary
  }
  return node
}

export function editPathFor(nodeId) {
  if (!nodeId || nodeId === ROOT_ID) return '/edit'
  return `/edit/${nodeId}`
}

/** Parent edit scope: nearest trip ancestor, else root `/edit`. */
export function parentEditPath(store, nodeId) {
  let current = findParentId(store, nodeId)
  while (current) {
    const node = getNode(store, current)
    if (!node || isRoot(node)) return '/edit'
    if (isTrip(node)) return editPathFor(current)
    current = findParentId(store, current)
  }
  return '/edit'
}

export function getNode(store, id) {
  return store.nodes[id] ?? null
}

/**
 * Locate a node in its parent's `children`, `members`, or `internals` list.
 * @returns {{ parentId: string, slot: 'children' | 'members' | 'internals', index: number } | null}
 */
export function findParentRef(store, nodeId) {
  if (nodeId === ROOT_ID) return null
  for (const node of Object.values(store.nodes)) {
    const childIndex = node.children?.indexOf(nodeId) ?? -1
    if (childIndex >= 0) {
      return { parentId: node.id, slot: 'children', index: childIndex }
    }
    const memberIndex = node.members?.indexOf(nodeId) ?? -1
    if (memberIndex >= 0) {
      return { parentId: node.id, slot: 'members', index: memberIndex }
    }
    const internalIndex = node.internals?.indexOf(nodeId) ?? -1
    if (internalIndex >= 0) {
      return { parentId: node.id, slot: 'internals', index: internalIndex }
    }
  }
  return null
}

export function findParentId(store, nodeId) {
  return findParentRef(store, nodeId)?.parentId ?? null
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

/** Display: YYYY-MM-DD HH:mm */
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
