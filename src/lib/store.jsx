import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import {
  addEdge,
  createBranchGroupNode,
  createContainerNode,
  createLeafNode,
  detachNodeFromFlow,
  findParentId,
  getNode,
  isBranchGroup,
  isContainer,
  removeEdge,
  setMainEdge,
} from './model'
import { loadStore, resetStore as resetStorage, saveStore } from './storage'
import { EDGE_KIND, ROOT_ID, STATUS } from './constants'

const StoreContext = createContext(null)

function cloneStore(store) {
  return structuredClone(store)
}

function rewriteEdgesForNode(container, oldId, newId) {
  const edges = (container.edges || []).map((e) => ({
    ...e,
    from: e.from === oldId ? newId : e.from,
    to: e.to === oldId ? newId : e.to,
  }))
  return { ...container, edges }
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
    updateNode(nodeId, patch) {
      commit((draft) => {
        const node = draft.nodes[nodeId]
        if (!node) return draft
        draft.nodes[nodeId] = { ...node, ...patch, id: node.id }
        return draft
      })
    },
    setLeafStatus(nodeId, status) {
      commit((draft) => {
        const node = draft.nodes[nodeId]
        if (!node || node.kind !== 'leaf') return draft
        if (!Object.values(STATUS).includes(status)) return draft
        draft.nodes[nodeId] = { ...node, status }
        return draft
      })
    },
    addChild(parentId, { asContainer, ...fields }) {
      const child = asContainer
        ? createContainerNode(fields)
        : createLeafNode(fields)
      commit((draft) => {
        const parent = draft.nodes[parentId]
        if (!parent || (!isContainer(parent) && !isBranchGroup(parent))) return draft
        draft.nodes[child.id] = child
        parent.children = [...parent.children, child.id]
        draft.nodes[parentId] = parent
        return draft
      })
      return child.id
    },
    /**
     * Insert a new leaf after `afterId`.
     * - If afterId lives in a branch-group, insert after that branch-group in its parent container.
     * - If parent is a branch-group (editing inside it), splice children only.
     */
    insertAfter(parentId, afterId) {
      const child = createLeafNode({
        name: '',
        description: '',
        status: STATUS.pending,
      })
      commit((draft) => {
        let parent = draft.nodes[parentId]
        if (!parent) return draft

        let targetAfter = afterId
        let targetParentId = parentId

        // Active slide inside a branch-group shown on a container page:
        // "下一程" means after the whole branch card.
        if (isContainer(parent) && !parent.children.includes(afterId)) {
          const ownerId = findParentId(draft, afterId)
          const owner = ownerId ? draft.nodes[ownerId] : null
          if (owner && isBranchGroup(owner) && parent.children.includes(owner.id)) {
            targetAfter = owner.id
          } else {
            return draft
          }
        }

        parent = draft.nodes[targetParentId]
        if (isBranchGroup(parent)) {
          if (!parent.children.includes(targetAfter)) return draft
          draft.nodes[child.id] = child
          const idx = parent.children.indexOf(targetAfter)
          parent.children = [
            ...parent.children.slice(0, idx + 1),
            child.id,
            ...parent.children.slice(idx + 1),
          ]
          draft.nodes[targetParentId] = parent
          return draft
        }

        if (!isContainer(parent) || !parent.children.includes(targetAfter)) return draft

        draft.nodes[child.id] = child
        const idx = parent.children.indexOf(targetAfter)
        parent.children = [
          ...parent.children.slice(0, idx + 1),
          child.id,
          ...parent.children.slice(idx + 1),
        ]

        let next = parent
        const outs = (next.edges || []).filter((e) => e.from === targetAfter)
        const mainOut = outs.find((e) => e.kind === EDGE_KIND.main) || outs[0]
        if (mainOut) {
          next = removeEdge(next, targetAfter, mainOut.to)
          next = addEdge(next, targetAfter, child.id, EDGE_KIND.main)
          next = addEdge(next, child.id, mainOut.to, EDGE_KIND.main)
        } else {
          next = addEdge(next, targetAfter, child.id, EDGE_KIND.main)
        }
        draft.nodes[targetParentId] = next
        return draft
      })
      return child.id
    },
    /**
     * Add a parallel alternative:
     * - Inside a branch-group → append sibling to the group.
     * - On a container timeline card → wrap into a new branch-group Swiper card.
     */
    createBranch(parentId, sourceId) {
      const child = createLeafNode({
        name: '',
        description: '',
        status: STATUS.pending,
      })
      let focusId = child.id

      commit((draft) => {
        const pageParent = draft.nodes[parentId]
        if (!pageParent) return draft

        const ownerId = findParentId(draft, sourceId)
        const owner = ownerId ? draft.nodes[ownerId] : null

        // Already in a branch card → add another alternative.
        if (owner && isBranchGroup(owner)) {
          draft.nodes[child.id] = child
          const idx = owner.children.indexOf(sourceId)
          owner.children = [
            ...owner.children.slice(0, idx + 1),
            child.id,
            ...owner.children.slice(idx + 1),
          ]
          draft.nodes[owner.id] = owner
          focusId = child.id
          return draft
        }

        // Viewing a branch-group page directly.
        if (isBranchGroup(pageParent) && pageParent.children.includes(sourceId)) {
          draft.nodes[child.id] = child
          const idx = pageParent.children.indexOf(sourceId)
          pageParent.children = [
            ...pageParent.children.slice(0, idx + 1),
            child.id,
            ...pageParent.children.slice(idx + 1),
          ]
          draft.nodes[parentId] = pageParent
          focusId = child.id
          return draft
        }

        // On a container timeline: wrap source into a branch-group card.
        if (!isContainer(pageParent) || !pageParent.children.includes(sourceId)) {
          return draft
        }

        const group = createBranchGroupNode({
          name: '分支',
          children: [sourceId, child.id],
        })
        draft.nodes[child.id] = child
        draft.nodes[group.id] = group

        const idx = pageParent.children.indexOf(sourceId)
        pageParent.children = [
          ...pageParent.children.slice(0, idx),
          group.id,
          ...pageParent.children.slice(idx + 1),
        ]

        let next = pageParent
        next = rewriteEdgesForNode(next, sourceId, group.id)
        draft.nodes[parentId] = next
        focusId = child.id
        return draft
      })

      return focusId
    },
    ensureContainer(nodeId) {
      commit((draft) => {
        const node = draft.nodes[nodeId]
        if (!node || node.kind === 'container' || isBranchGroup(node)) return draft
        draft.nodes[nodeId] = {
          ...node,
          kind: 'container',
          type: null,
          children: node.children || [],
          edges: node.edges || [],
        }
        return draft
      })
    },
    deleteNode(nodeId) {
      if (nodeId === ROOT_ID) return
      commit((draft) => {
        const parentId = findParentId(draft, nodeId)
        if (!parentId) return draft

        const removeRecursive = (id) => {
          const node = draft.nodes[id]
          if (!node) return
          for (const cid of node.children || []) removeRecursive(cid)
          delete draft.nodes[id]
        }

        const parent = draft.nodes[parentId]

        if (isBranchGroup(parent)) {
          parent.children = parent.children.filter((id) => id !== nodeId)
          draft.nodes[parentId] = parent
          removeRecursive(nodeId)

          // Unwrap when only one alternative remains.
          if (parent.children.length === 1) {
            const remainingId = parent.children[0]
            const grandId = findParentId(draft, parentId)
            if (grandId) {
              const grand = draft.nodes[grandId]
              const gidx = grand.children.indexOf(parentId)
              if (gidx >= 0) {
                grand.children = [
                  ...grand.children.slice(0, gidx),
                  remainingId,
                  ...grand.children.slice(gidx + 1),
                ]
                if (isContainer(grand)) {
                  draft.nodes[grandId] = rewriteEdgesForNode(grand, parentId, remainingId)
                } else {
                  draft.nodes[grandId] = grand
                }
                delete draft.nodes[parentId]
              }
            }
          } else if (parent.children.length === 0) {
            // Empty branch card → remove it from grandparent.
            const grandId = findParentId(draft, parentId)
            if (grandId) {
              const grand = draft.nodes[grandId]
              if (isContainer(grand)) {
                draft.nodes[grandId] = {
                  ...detachNodeFromFlow(grand, parentId),
                  children: grand.children.filter((id) => id !== parentId),
                }
              } else {
                grand.children = grand.children.filter((id) => id !== parentId)
                draft.nodes[grandId] = grand
              }
            }
            delete draft.nodes[parentId]
          }
          return draft
        }

        const next = detachNodeFromFlow(parent, nodeId)
        next.children = (next.children || []).filter((id) => id !== nodeId)
        draft.nodes[parentId] = next
        removeRecursive(nodeId)
        return draft
      })
    },
    linkNodes(parentId, fromId, toId, kind = EDGE_KIND.main) {
      commit((draft) => {
        const parent = draft.nodes[parentId]
        if (!parent || !isContainer(parent)) return draft
        draft.nodes[parentId] = addEdge(parent, fromId, toId, kind)
        return draft
      })
    },
    unlinkNodes(parentId, fromId, toId) {
      commit((draft) => {
        const parent = draft.nodes[parentId]
        if (!parent || !isContainer(parent)) return draft
        draft.nodes[parentId] = removeEdge(parent, fromId, toId)
        return draft
      })
    },
    switchMain(parentId, fromId, toId) {
      commit((draft) => {
        const parent = draft.nodes[parentId]
        if (!parent || !isContainer(parent)) return draft
        draft.nodes[parentId] = setMainEdge(parent, fromId, toId)
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
