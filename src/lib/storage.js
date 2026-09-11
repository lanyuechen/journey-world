import { ROOT_ID, STORAGE_KEY } from './constants'
import { createRoot } from './model'

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

export function loadStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      const seeded = seedStore()
      saveStore(seeded)
      return seeded
    }
    return JSON.parse(raw)
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
