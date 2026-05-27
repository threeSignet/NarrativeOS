import { BookOpen, Plus } from 'lucide-react'

interface EmptyStateProps {
  onCreate: () => void
}

export default function EmptyState({ onCreate }: EmptyStateProps) {
  return (
    <div className="animate-fade-in-up" style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '96px 0',
      gap: 24,
    }}>
      <div style={{
        width: 56,
        height: 56,
        borderRadius: 14,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid var(--glass-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <BookOpen size={24} style={{ color: 'var(--text-muted)' }} />
      </div>
      <div style={{ textAlign: 'center' }}>
        <h2 style={{
          fontSize: 16,
          fontWeight: 500,
          color: 'var(--text-secondary)',
          marginBottom: 8,
        }}>
          还没有创作宇宙
        </h2>
        <p style={{
          fontSize: 13,
          color: 'var(--text-muted)',
        }}>
          创建你的第一个小说项目，开始 AI 辅助创作之旅
        </p>
      </div>
      <button
        onClick={onCreate}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 18px',
          borderRadius: 10,
          border: '1px solid var(--glass-border-hover)',
          background: 'rgba(255,255,255,0.08)',
          color: 'var(--text-primary)',
          fontSize: 13,
          fontWeight: 500,
          cursor: 'pointer',
          transition: 'all var(--duration) var(--ease)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(255,255,255,0.14)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
        }}
      >
        <Plus size={15} />
        创建第一个宇宙
      </button>
    </div>
  )
}
