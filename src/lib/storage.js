import { NODE_KIND, ROOT_ID, STORAGE_KEY } from './constants'
import { createRoot, isGroup, isRoot, isTrip, syncItineraryType } from './model'

export const STORE_VERSION = 2

function seedStore() {
  const root = createRoot()
  root.id = ROOT_ID

  return {
    version: STORE_VERSION,
    rootId: ROOT_ID,
    nodes: {
      [root.id]: root,
    },
  }
}

/**
 * v1: children = subsequent, internals = internal
 * v2: next = subsequent, children = internal
 */
function migrateNodeToV2(node) {
  if (!node || typeof node !== 'object') return

  const alreadyV2 = Array.isArray(node.next) && !Object.prototype.hasOwnProperty.call(node, 'internals')
  if (alreadyV2) {
    if (isTrip(node) && !Array.isArray(node.children)) node.children = []
    if (isRoot(node) || isGroup(node)) delete node.children
    return
  }

  const subsequent = Array.isArray(node.next)
    ? node.next
    : (Array.isArray(node.children) ? node.children : [])
  const internal = Array.isArray(node.internals) ? node.internals : []

  node.next = subsequent
  if (isTrip(node)) {
    node.children = internal
  } else {
    delete node.children
  }
  delete node.internals
}

function migrateStore(store) {
  if (!store?.nodes) return store
  for (const node of Object.values(store.nodes)) {
    migrateNodeToV2(node)
  }
  store.version = STORE_VERSION
  return store
}

function normalizeStore(store) {
  if (!store?.nodes) return store
  migrateStore(store)
  for (const node of Object.values(store.nodes)) {
    if (isTrip(node)) {
      if (!Array.isArray(node.next)) node.next = []
      if (!Array.isArray(node.children)) node.children = []
      syncItineraryType(node)
    }
    if (isGroup(node)) {
      if (!Array.isArray(node.next)) node.next = []
      if (typeof node.description !== 'string') node.description = ''
    }
    if (isRoot(node) && !Array.isArray(node.next)) node.next = []
  }
  store.version = STORE_VERSION
  return store
}

export function loadStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      const seeded = seedStore()
      saveStore(seeded)
      return seeded
    }
    const store = normalizeStore(JSON.parse(raw))
    saveStore(store)
    return store
  } catch {
    const seeded = seedStore()
    saveStore(seeded)
    return seeded
  }
}

export function saveStore(store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
}

export function resetStore() {
  const seeded = seedStore()
  saveStore(seeded)
  return seeded
}

/** Validate and normalize a JSON payload for import. */
export function parseStorePayload(raw) {
  const data = typeof raw === 'string' ? JSON.parse(raw) : raw
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('文件格式无效，需要 JSON 对象')
  }
  if (!data.nodes || typeof data.nodes !== 'object' || Array.isArray(data.nodes)) {
    throw new Error('缺少 nodes 数据')
  }

  const rootId = data.rootId || ROOT_ID
  const root = data.nodes[rootId]
  if (!root || root.kind !== NODE_KIND.root || !isRoot(root)) {
    throw new Error('缺少有效的根节点')
  }

  return normalizeStore({
    version: typeof data.version === 'number' ? data.version : 1,
    rootId,
    nodes: data.nodes,
  })
}

export function serializeStore(store) {
  return `${JSON.stringify(store, null, 2)}\n`
}

export function downloadStoreJson(store, filename) {
  const blob = new Blob([serializeStore(store)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function makeExportFilename(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `journey-world-${y}${m}${d}.json`
}
