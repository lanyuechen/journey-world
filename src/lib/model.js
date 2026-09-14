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
    /** Subsequent trips (below-add); shown in outer column. */
    next: [],
  }
}

export function createTripNode({
  name = '',
  description = '',
  type = DEFAULT_NODE_TYPE,
  startAt = null,
  status = STATUS.pending,
  next = [],
  children = [],
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
    next: [...next],
    /** Internal itinerary (nested edit); not flattened into the outer column. */
    children: [...children],
  }
}

export function createGroupNode({
  name = '',
  description = '',
  members = [],
  next = [],
} = {}) {
  return {
    id: createId('group'),
    kind: NODE_KIND.group,
    name,
    description,
    members: [...members],
    next: [...next],
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

export function getNext(node) {
  return node?.next || []
}

export function getChildren(node) {
  return node?.children || []
}

export function isItineraryTrip(node) {
  if (!isTrip(node)) return false
  if (!getChildren(node).length) return false
  return node.type === ITINERARY_TYPE || ITINERARY_TYPE_LEGACY.includes(node.type)
}

/**
 * Trip with children → type「行程」; empty children → restore ordinary type.
 * Mutates and returns the node.
 */
export function syncItineraryType(node) {
  if (!isTrip(node)) return node

  if (!Array.isArray(node.children)) node.children = []
  if (!Array.isArray(node.next)) node.next = []

  const hasChildren = node.children.length > 0
  const isItineraryLabel = node.type === ITINERARY_TYPE
    || ITINERARY_TYPE_LEGACY.includes(node.type)

  if (hasChildren) {
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

export function viewPathFor(nodeId) {
  if (!nodeId || nodeId === ROOT_ID) return '/view'
  return `/view/${nodeId}`
}

/** Parent edit scope: via `children`, or a trip whose children tree contains the parent group. */
export function parentEditPath(store, nodeId) {
  const ref = findParentRef(store, nodeId)
  if (!ref) return '/edit'

  if (ref.slot === 'children') {
    const parent = getNode(store, ref.parentId)
    if (parent && isTrip(parent)) return editPathFor(ref.parentId)
    return '/edit'
  }

  let groupId = null
  if (ref.slot === 'members') {
    groupId = ref.parentId
  } else if (ref.slot === 'next') {
    const parent = getNode(store, ref.parentId)
    if (parent && isGroup(parent)) groupId = ref.parentId
  }

  if (groupId) {
    const hostId = findChildrenContainingTrip(store, groupId)
    if (hostId) return editPathFor(hostId)
  }

  return '/edit'
}

function pushRootCrumb(store, trail) {
  const root = getNode(store, ROOT_ID)
  trail.unshift({
    id: ROOT_ID,
    label: root?.name?.trim() || '我的旅程',
    path: '/edit',
  })
}

/**
 * Nearest trip that contains `nodeId` somewhere under its `children` tree
 * (direct or nested via next / members / further children).
 */
export function findChildrenContainingTrip(store, nodeId) {
  let cursor = nodeId
  while (cursor) {
    const ref = findParentRef(store, cursor)
    if (!ref) return null
    const parent = getNode(store, ref.parentId)
    if (!parent || isRoot(parent)) return null
    if (ref.slot === 'children' && isTrip(parent)) return parent.id
    cursor = ref.parentId
  }
  return null
}

/** @deprecated use findChildrenContainingTrip */
export const findInternalsContainingTrip = findChildrenContainingTrip

/**
 * Breadcrumb for internal-edit scopes.
 * - Follow `children` nesting.
 * - For groups: climb to the trip whose `children` tree contains the group; else root.
 * - Do not follow plain `next` between trips.
 */
export function editBreadcrumbTrail(store, nodeId) {
  const trail = []
  let current = nodeId

  while (current) {
    const node = getNode(store, current)
    if (!node) break

    if (isRoot(node)) {
      pushRootCrumb(store, trail)
      break
    }

    if (isGroup(node)) {
      const hostId = findChildrenContainingTrip(store, node.id)
      if (hostId) {
        current = hostId
        continue
      }
      pushRootCrumb(store, trail)
      break
    }

    if (isTrip(node)) {
      trail.unshift({
        id: node.id,
        label: node.name?.trim() || '未命名行程',
        path: editPathFor(node.id),
      })

      const ref = findParentRef(store, current)
      if (ref?.slot === 'children' || ref?.slot === 'members') {
        current = ref.parentId
        continue
      }

      if (ref?.slot === 'next') {
        const parent = getNode(store, ref.parentId)
        if (parent && isGroup(parent)) {
          current = ref.parentId
          continue
        }
      }

      pushRootCrumb(store, trail)
      break
    }

    current = findParentId(store, current)
  }

  return trail
}

export function getNode(store, id) {
  return store.nodes[id] ?? null
}

/**
 * Locate a node in its parent's `next`, `members`, or `children` list.
 * @returns {{ parentId: string, slot: 'next' | 'members' | 'children', index: number } | null}
 */
export function findParentRef(store, nodeId) {
  if (nodeId === ROOT_ID) return null
  for (const node of Object.values(store.nodes)) {
    const nextIndex = node.next?.indexOf(nodeId) ?? -1
    if (nextIndex >= 0) {
      return { parentId: node.id, slot: 'next', index: nextIndex }
    }
    const memberIndex = node.members?.indexOf(nodeId) ?? -1
    if (memberIndex >= 0) {
      return { parentId: node.id, slot: 'members', index: memberIndex }
    }
    const childIndex = node.children?.indexOf(nodeId) ?? -1
    if (childIndex >= 0) {
      return { parentId: node.id, slot: 'children', index: childIndex }
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
