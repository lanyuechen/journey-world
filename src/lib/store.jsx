import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { ROOT_ID } from './constants'
import {
  createGroupNode,
  createTripNode,
  findParentRef,
  getNode,
  isGroup,
  isRoot,
  isTrip,
  syncItineraryType,
} from './model'
import { loadStore, resetStore as resetStorage, saveStore } from './storage'

const StoreContext = createContext(null)

function cloneStore(store) {
  return structuredClone(store)
}

function replaceInList(list, index, nextId) {
  return [...list.slice(0, index), nextId, ...list.slice(index + 1)]
}

function removeFromList(list, id) {
  return list.filter((item) => item !== id)
}

function spliceReplace(list, index, items) {
  return [...list.slice(0, index), ...items, ...list.slice(index + 1)]
}

/** Lift a node's subsequent `next` onto `parent` before the node is removed. */
function promoteNextToParent(draft, node, parent, ref) {
  const promoted = [...(node.next || [])]
  node.next = []
  draft.nodes[node.id] = node

  if (!promoted.length) {
    if (ref.slot === 'next') {
      parent.next = removeFromList(parent.next || [], node.id)
    } else if (ref.slot === 'children') {
      parent.children = removeFromList(parent.children || [], node.id)
    } else if (ref.slot === 'members') {
      parent.members = removeFromList(parent.members || [], node.id)
    }
    draft.nodes[ref.parentId] = parent
    return
  }

  if (ref.slot === 'next') {
    parent.next = spliceReplace(parent.next || [], ref.index, promoted)
  } else if (ref.slot === 'children') {
    parent.children = spliceReplace(parent.children || [], ref.index, promoted)
  } else if (ref.slot === 'members') {
    parent.members = removeFromList(parent.members || [], node.id)
    parent.next = [...promoted, ...(parent.next || [])]
  }
  draft.nodes[ref.parentId] = parent
}

function syncTrip(draft, nodeId) {
  const node = draft.nodes[nodeId]
  if (!node || !isTrip(node)) return
  draft.nodes[nodeId] = syncItineraryType(node)
}

function removeRecursive(draft, id) {
  const node = draft.nodes[id]
  if (!node) return
  for (const nid of node.next || []) removeRecursive(draft, nid)
  for (const mid of node.members || []) removeRecursive(draft, mid)
  for (const cid of node.children || []) removeRecursive(draft, cid)
  delete draft.nodes[id]
}

export function StoreProvider({ children }) {
  const [store, setStore] = useState(() => loadStore())

  const commit = useCallback((updater) => {
    setStore((prev) => {
      const next = typeof updater === 'function' ? updater(cloneStore(prev)) : updater
      saveStore(next)
      return next
    })
  }, [])

  const api = useMemo(() => ({
    store,
    reset() {
      commit(resetStorage())
    },
    replaceStore(next) {
      commit(next)
    },
    updateNode(nodeId, patch) {
      commit((draft) => {
        const node = draft.nodes[nodeId]
        if (!node) return draft
        draft.nodes[nodeId] = { ...node, ...patch, id: node.id, kind: node.kind }
        return draft
      })
    },
    /** Append a subsequent trip under parent.next (root / trip / group). */
    addNext(parentId) {
      const trip = createTripNode()
      commit((draft) => {
        const parent = draft.nodes[parentId]
        if (!parent || (!isRoot(parent) && !isTrip(parent) && !isGroup(parent))) {
          return draft
        }
        draft.nodes[trip.id] = trip
        parent.next = [...(parent.next || []), trip.id]
        draft.nodes[parentId] = parent
        return draft
      })
      return trip.id
    },
    /** Append an internal itinerary trip under a trip's `children`. */
    addChild(tripId) {
      const trip = createTripNode()
      commit((draft) => {
        const parent = draft.nodes[tripId]
        if (!parent || !isTrip(parent)) return draft
        if (!Array.isArray(parent.children)) parent.children = []
        draft.nodes[trip.id] = trip
        parent.children = [...parent.children, trip.id]
        draft.nodes[tripId] = parent
        syncTrip(draft, tripId)
        return draft
      })
      return trip.id
    },
    /**
     * Right-add on a trip or group: wrap into a new parallel group with a new sibling.
     * Former `next` of the source move onto the new group.
     * Internal `children` stay on the source trip.
     */
    addBeside(nodeId) {
      const trip = createTripNode()
      let groupId = null

      commit((draft) => {
        const source = draft.nodes[nodeId]
        if (!source || (!isTrip(source) && !isGroup(source))) return draft

        const ref = findParentRef(draft, nodeId)
        if (!ref) return draft

        const parent = draft.nodes[ref.parentId]
        if (!parent) return draft

        const movedNext = [...(source.next || [])]
        source.next = []
        draft.nodes[nodeId] = source

        const group = createGroupNode({
          members: [nodeId, trip.id],
          next: movedNext,
        })
        draft.nodes[trip.id] = trip
        draft.nodes[group.id] = group
        groupId = group.id

        if (ref.slot === 'next') {
          parent.next = replaceInList(parent.next, ref.index, group.id)
        } else if (ref.slot === 'members') {
          parent.members = replaceInList(parent.members, ref.index, group.id)
        } else if (ref.slot === 'children') {
          parent.children = replaceInList(parent.children, ref.index, group.id)
          syncTrip(draft, ref.parentId)
        }
        draft.nodes[ref.parentId] = parent
        return draft
      })

      return { tripId: trip.id, activateId: groupId || trip.id }
    },
    /** Append a new trip as a parallel member inside an existing group. */
    addGroupMember(groupId) {
      const trip = createTripNode()
      commit((draft) => {
        const group = draft.nodes[groupId]
        if (!group || !isGroup(group)) return draft
        draft.nodes[trip.id] = trip
        group.members = [...(group.members || []), trip.id]
        draft.nodes[groupId] = group
        return draft
      })
      return { tripId: trip.id, activateId: groupId }
    },
    deleteNode(nodeId) {
      if (nodeId === ROOT_ID) return
      commit((draft) => {
        const ref = findParentRef(draft, nodeId)
        if (!ref) return draft

        const parent = draft.nodes[ref.parentId]
        const node = draft.nodes[nodeId]
        if (!parent || !node) return draft

        // Subsequent next move to this node's parent; children stay and are removed with the node.
        promoteNextToParent(draft, node, parent, ref)
        const parentAfter = draft.nodes[ref.parentId]

        if (ref.slot === 'members' && isGroup(parentAfter)) {
          removeRecursive(draft, nodeId)

          if (parentAfter.members.length === 1) {
            const remainingId = parentAfter.members[0]
            const remaining = draft.nodes[remainingId]
            if (remaining && (isTrip(remaining) || isGroup(remaining))) {
              remaining.next = [
                ...(remaining.next || []),
                ...(parentAfter.next || []),
              ]
              draft.nodes[remainingId] = remaining
            }
            const grandRef = findParentRef(draft, parentAfter.id)
            if (grandRef) {
              const grand = draft.nodes[grandRef.parentId]
              if (grandRef.slot === 'next') {
                grand.next = replaceInList(grand.next, grandRef.index, remainingId)
              } else if (grandRef.slot === 'members') {
                grand.members = replaceInList(grand.members, grandRef.index, remainingId)
              } else if (grandRef.slot === 'children') {
                grand.children = replaceInList(grand.children, grandRef.index, remainingId)
                syncTrip(draft, grandRef.parentId)
              }
              draft.nodes[grandRef.parentId] = grand
            }
            delete draft.nodes[parentAfter.id]
          } else if (parentAfter.members.length === 0) {
            const grandRef = findParentRef(draft, parentAfter.id)
            if (grandRef) {
              const grand = draft.nodes[grandRef.parentId]
              if (grandRef.slot === 'next') {
                grand.next = removeFromList(grand.next, parentAfter.id)
              } else if (grandRef.slot === 'members') {
                grand.members = removeFromList(grand.members, parentAfter.id)
              } else if (grandRef.slot === 'children') {
                grand.children = removeFromList(grand.children, parentAfter.id)
                syncTrip(draft, grandRef.parentId)
              }
              draft.nodes[grandRef.parentId] = grand
            }
            removeRecursive(draft, parentAfter.id)
          }
          return draft
        }

        if (ref.slot === 'children') {
          syncTrip(draft, ref.parentId)
        }
        removeRecursive(draft, nodeId)
        return draft
      })
    },
    getNode: (id) => getNode(store, id),
  }), [store, commit])

  return (
    <StoreContext.Provider value={api}>
      {children}
    </StoreContext.Provider>
  )
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}
