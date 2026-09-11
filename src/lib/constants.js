export const NODE_TYPES = ['交通', '住宿', '吃喝', '游玩', '其他']

/** Default type for newly created trip cards. */
export const DEFAULT_NODE_TYPE = '其他'

/** Placeholder shown on cards when description is empty. */
export const DEFAULT_TRIP_DESC = '行程描述，巴拉巴拉...'

/** Locked type after drilling into nested itinerary edit. */
export const ITINERARY_TYPE = '行程'

/** Previous labels; still treated as itinerary for stored data. */
export const ITINERARY_TYPE_LEGACY = ['行程类型', '行程卡片']

/** Display label for parallel trip groups (not a selectable NODE_TYPES value). */
export const GROUP_TYPE_LABEL = '行程组'

/** Placeholder name for unnamed trip groups. */
export const DEFAULT_GROUP_NAME = '未命名行程组'

export const NODE_KIND = {
  root: 'root',
  trip: 'trip',
  group: 'group',
}

export const STATUS = {
  pending: 'pending',
  doing: 'doing',
  done: 'done',
}

export const ROOT_ID = 'root'

/** Bumped for tree-based trip / group schema (no edges). */
export const STORAGE_KEY = 'journey-world-v3'

export const TZ = 'Asia/Shanghai'
