import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Loader2, Filter, X } from 'lucide-react'
import { useProjectStore } from '../stores/projects'
import type { Project } from '../stores/projects'
import Dropdown from '../components/ui/Dropdown'
import ProjectGrid from '../components/project/ProjectGrid'
import EmptyState from '../components/project/EmptyState'
import CreateProjectModal from '../components/project/CreateProjectModal'
import ContextMenu from '../components/project/ProjectContextMenu'
import TopBar from '../components/layout/TopBar'

const statusOptions = [
  { value: 'hatching', label: '孵化中' },
  { value: 'active', label: '写作中' },
]

export default function ProjectList() {
  const { projects, loading, fetchProjects, createProject, updateProject, deleteProject, archiveProject } = useProjectStore()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [genreFilter, setGenreFilter] = useState<string | null>(null)
  const [platformFilter, setPlatformFilter] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; project: Project } | null>(null)
  const navigate = useNavigate()

  useEffect(() => { fetchProjects() }, [fetchProjects])

  const genreOptions = useMemo(() => {
    const genres = Array.from(new Set(projects.map((p) => p.genre))).filter(Boolean)
    return genres.map((g) => ({ value: g, label: g }))
  }, [projects])

  const platformOptions = useMemo(() => {
    const platforms = Array.from(new Set(projects.map((p) => p.platform).filter(Boolean) as string[])).filter(Boolean)
    return platforms.map((p) => ({ value: p, label: p }))
  }, [projects])

  const handleCreate = async (data: { title: string; genre: string; style?: string; target_words?: number; core_creativity?: string; platform?: string }) => {
    await createProject(data)
  }

  const handleSelect = (id: string) => { navigate(`/project/${id}`) }

  const handleContextMenu = (e: React.MouseEvent, project: Project) => {
    e.preventDefault()
    setCtxMenu({ x: e.clientX, y: e.clientY, project })
  }

  const handleDelete = async () => {
    if (!ctxMenu) return
    await deleteProject(ctxMenu.project.id)
    setCtxMenu(null)
  }

  const handleArchive = async () => {
    if (!ctxMenu) return
    await archiveProject(ctxMenu.project.id)
    setCtxMenu(null)
  }

  const handleEdit = () => {
    if (!ctxMenu) return
    setEditingProject(ctxMenu.project)
    setCtxMenu(null)
  }

  const handleEditSubmit = async (data: { title: string; genre: string; style?: string; target_words?: number; core_creativity?: string; platform?: string }) => {
    if (editingProject) {
      await updateProject(editingProject.id, data)
      setEditingProject(null)
    }
  }

  const hasFilters = genreFilter || platformFilter || statusFilter

  const clearFilters = () => {
    setGenreFilter(null)
    setPlatformFilter(null)
    setStatusFilter(null)
  }

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      if (genreFilter && p.genre !== genreFilter) return false
      if (platformFilter && p.platform !== platformFilter) return false
      if (statusFilter && p.status !== statusFilter) return false
      return true
    })
  }, [projects, genreFilter, platformFilter, statusFilter])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <TopBar>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
          {projects.length > 0 ? `${filtered.length}${hasFilters ? ` / ${projects.length}` : ''} 个宇宙` : ''}
        </span>
        {projects.length > 0 && (
          <button
            onClick={() => setModalOpen(true)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', borderRadius: 8,
              border: '1px solid var(--glass-border-hover)',
              background: 'rgba(255,255,255,0.08)',
              color: 'var(--text-primary)', fontSize: 13, fontWeight: 500,
              cursor: 'pointer', transition: 'all var(--duration) var(--ease)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.14)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
          >
            <Plus size={14} />
            创建宇宙
          </button>
        )}
      </TopBar>

      {/* ── Content ── */}
      <main style={{ flex: 1, overflowY: 'auto', background: 'linear-gradient(180deg, var(--bg-deep) 0%, #0e0e18 100%)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px 60px' }}>

          {/* ── Filter Bar ── */}
          {projects.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
              <Filter size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <Dropdown options={genreOptions} value={genreFilter} placeholder="全部类型" onChange={setGenreFilter} />
              <Dropdown options={statusOptions} value={statusFilter} placeholder="全部状态" onChange={setStatusFilter} />
              <Dropdown options={platformOptions} value={platformFilter} placeholder="全部平台" onChange={setPlatformFilter} />
              {hasFilters && (
                <button onClick={clearFilters} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '5px 10px', borderRadius: 8, border: 'none',
                  background: 'transparent', color: 'var(--accent-rose)',
                  fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-ui)',
                  transition: 'all var(--duration) var(--ease)',
                }}>
                  <X size={11} />
                  清除
                </button>
              )}
            </div>
          )}

          {loading && projects.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '128px 0' }}>
              <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: 'var(--text-muted)' }} />
            </div>
          ) : projects.length === 0 ? (
            <EmptyState onCreate={() => setModalOpen(true)} />
          ) : filtered.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '96px 0', gap: 12 }}>
              <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>没有匹配的项目</p>
              <button onClick={clearFilters} style={{
                padding: '5px 12px', borderRadius: 8, border: '1px solid var(--glass-border)',
                background: 'transparent', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-ui)',
              }}>清除筛选</button>
            </div>
          ) : (
            <ProjectGrid projects={filtered} onSelect={handleSelect} onContextMenu={handleContextMenu} />
          )}
        </div>
      </main>

      <CreateProjectModal open={modalOpen} onClose={() => setModalOpen(false)} onSubmit={handleCreate} />

      {/* Edit modal */}
      {editingProject && (
        <CreateProjectModal
          open
          onClose={() => setEditingProject(null)}
          onSubmit={handleEditSubmit}
          initialData={{
            title: editingProject.title,
            genre: editingProject.genre,
            style: editingProject.style || '',
            target_words: editingProject.targetWords || undefined,
            core_creativity: editingProject.coreCreativity || '',
            platform: editingProject.platform || '',
          }}
        />
      )}

      {/* Context menu */}
      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          isHatching={ctxMenu.project.status === 'hatching'}
          onDelete={handleDelete}
          onArchive={handleArchive}
          onEdit={handleEdit}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </div>
  )
}
