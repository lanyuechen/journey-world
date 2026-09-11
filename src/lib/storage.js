import { ROOT_ID, STORAGE_KEY } from './constants'
import { createRoot, isGroup, isTrip, syncItineraryType } from './model'

function seedStore() {
  const root = createRoot()
  root.id = ROOT_ID

  return {
    version: 1,
    rootId: ROOT_ID,
    nodes: {
      [root.id]: root,
    },
  }
}

function normalizeStore(store) {
  if (!store?.nodes) return store
  for (const node of Object.values(store.nodes)) {
    if (isTrip(node)) {
      if (!Array.isArray(node.internals)) node.internals = []
      syncItineraryType(node)
    }
    if (isGroup(node) && typeof node.description !== 'string') {
      node.description = ''
    }
  }
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
