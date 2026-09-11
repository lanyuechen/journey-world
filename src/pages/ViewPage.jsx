import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Breadcrumb, Filters, Timeline } from '../components/JourneyUI'
import { NODE_TYPES, ROOT_ID } from '../lib/constants'
import {
  buildTimelineRows,
  collectDatesInContainer,
  filterRows,
  getNode,
  getPathToNode,
  isBranchGroup,
  isContainer,
  resolveStatus,
} from '../lib/model'
import { useStore } from '../lib/store'
import { STATUS_LABEL } from '../lib/constants'

export default function ViewPage() {
  const { nodeId = ROOT_ID } = useParams()
  const navigate = useNavigate()
  const { store } = useStore()
  const [selectedDates, setSelectedDates] = useState([])
  const [selectedTypes, setSelectedTypes] = useState([])

  const node = getNode(store, nodeId)
  const path = useMemo(() => getPathToNode(store, nodeId), [store, nodeId])
  const dates = useMemo(() => collectDatesInContainer(store, nodeId), [store, nodeId])
  const rows = useMemo(() => {
    const current = getNode(store, nodeId)
    if (isBranchGroup(current)) {
      const slides = (current.children || []).map((id, index) => ({
        id,
        isMain: index === 0,
      }))
      return filterRows(store, slides.length ? [slides] : [], {
        dates: selectedDates,
        types: selectedTypes,
      })
    }
    if (!isContainer(current)) return []
    const all = buildTimelineRows(store, nodeId)
    return filterRows(store, all, { dates: selectedDates, types: selectedTypes })
  }, [store, nodeId, selectedDates, selectedTypes])

  if (!node) {
    return (
      <div className="page">
        <p>节点不存在</p>
        <Link to="/view">返回</Link>
      </div>
    )
  }

  if (!isContainer(node) && !isBranchGroup(node)) {
    return (
      <div className="page">
        <p>叶子节点没有子层日程。</p>
        <button type="button" className="btn" onClick={() => navigate(-1)}>返回</button>
      </div>
    )
  }

  const status = resolveStatus(store, nodeId)

  return (
    <div className="page">
      <header className="page-header">
        <Breadcrumb path={path} mode="view" />
        <div className="header-actions">
          <Link className="btn btn-primary" to={`/edit/${nodeId}`}>录入 / 编辑</Link>
        </div>
      </header>

      <section className="hero-block">
        <p className="eyebrow">日程查看</p>
        <h1>{node.name}</h1>
        {node.description && <p className="lede">{node.description}</p>}
        <p className="hero-status">进度：{STATUS_LABEL[status]}</p>
      </section>

      <Filters
        dates={dates}
        types={NODE_TYPES}
        selectedDates={selectedDates}
        selectedTypes={selectedTypes}
        onDatesChange={setSelectedDates}
        onTypesChange={setSelectedTypes}
      />

      <Timeline
        containerId={nodeId}
        rows={rows}
        mode="view"
        onEnter={(id) => navigate(`/view/${id}`)}
      />
    </div>
  )
}
