import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'
import type { SettingItem } from '../../stores/hatch'
import { typeLabels, typeColors } from '../../utils/entityConfig'

interface EntityMarkdownProps {
  text: string
  entities: SettingItem[]
  onEntityClick?: (item: SettingItem) => void
}

function escapeRegex(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function processEntityReferences(text: string, entities: SettingItem[]) {
  if (!entities.length) return text

  const markers: { start: number; end: number; entity: SettingItem }[] = []

  // Collect all entity match positions
  for (const entity of entities) {
    if (!entity.name) continue

    // 1. Explicit [Type:Name] references
    const typeKey = entity.type
    const label = typeLabels[typeKey] || typeKey
    const explicitRe = new RegExp(
      `\\[(${escapeRegex(label)}|${escapeRegex(typeKey)})\\s*:\\s*${escapeRegex(entity.name)}\\]`,
      'gi'
    )
    let m
    while ((m = explicitRe.exec(text)) !== null) {
      markers.push({ start: m.index, end: m.index + m[0].length, entity })
    }

    // 2. Bracketed names 「name」
    const bracketRe = new RegExp(`「${escapeRegex(entity.name)}」`, 'g')
    while ((m = bracketRe.exec(text)) !== null) {
      markers.push({ start: m.index, end: m.index + m[0].length, entity })
    }

    // 3. Plain name detection — only match standalone names not inside markdown syntax
    const plainRe = new RegExp('(?<![\\w/\\[\\`])(?:「)?' + escapeRegex(entity.name) + '(?:」)?(?![\\w/\\]\\`])', 'g')
    while ((m = plainRe.exec(text)) !== null) {
      // Skip if already covered by a bracketed or explicit marker
      const overlaps = markers.some(
        (mk) => m!.index >= mk.start - 1 && m!.index <= mk.end
      )
      if (!overlaps) {
        markers.push({
          start: m.index,
          end: m.index + entity.name.length,
          entity,
        })
      }
    }
  }

  // Deduplicate: if overlapping markers, prefer explicit > bracketed > plain
  markers.sort((a, b) => a.start - b.start || b.end - a.end)
  const deduped: typeof markers = []
  let lastEnd = 0
  for (const mk of markers) {
    if (mk.start >= lastEnd) {
      deduped.push(mk)
      lastEnd = mk.end
    }
  }

  if (!deduped.length) return text

  // Build result with entity pill markdown links
  const parts: string[] = []
  let cursor = 0
  for (const mk of deduped) {
    if (mk.start > cursor) {
      parts.push(text.slice(cursor, mk.start))
    }
    const color = typeColors[mk.entity.type] || '#7dd3fc'
    const label = typeLabels[mk.entity.type] || mk.entity.type
    parts.push(`[${mk.entity.name}](entity://${mk.entity.id}?label=${encodeURIComponent(label)}&color=${encodeURIComponent(color)})`)
    cursor = mk.end
  }
  if (cursor < text.length) {
    parts.push(text.slice(cursor))
  }

  return parts.join('')
}

function EntityPill({ name, label, color, onClick }: {
  name: string; label: string; color: string; onClick?: () => void
}) {
  return (
    <span
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick?.() }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '2px 10px',
        borderRadius: 6,
        cursor: onClick ? 'pointer' : 'default',
        background: `${color}18`,
        color,
        border: `1px solid ${color}30`,
        fontSize: 'inherit',
        fontFamily: 'inherit',
        lineHeight: 'inherit',
        transition: 'all 150ms cubic-bezier(0.4, 0, 0.2, 1)',
        whiteSpace: 'nowrap',
        textDecoration: 'none',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = `${color}28`
        e.currentTarget.style.borderColor = `${color}50`
        e.currentTarget.style.transform = 'translateY(-1px)'
        e.currentTarget.style.boxShadow = `0 2px 8px ${color}20`
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = `${color}18`
        e.currentTarget.style.borderColor = `${color}30`
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      <span style={{
        fontSize: '0.72em',
        opacity: 0.75,
        fontWeight: 600,
        letterSpacing: '0.02em',
      }}>
        {label}
      </span>
      <span style={{ fontWeight: 500 }}>{name}</span>
    </span>
  )
}

export default function EntityMarkdown({ text, entities, onEntityClick }: EntityMarkdownProps) {
  const entityMap = new Map(entities.map((e) => [e.id, e]))
  const processed = processEntityReferences(text, entities)

  const components: Components = {
    a: ({ href, children }) => {
      if (href?.startsWith('entity://')) {
        const id = href.replace('entity://', '').split('?')[0]
        const params = new URLSearchParams(href.split('?')[1] || '')
        const label = params.get('label') || ''
        const color = params.get('color') || '#7dd3fc'
        const childText = Array.isArray(children) ? children.join('') : String(children || '')
        const name = childText || label
        const entity = entityMap.get(id)

        return (
          <EntityPill
            name={name}
            label={label}
            color={color}
            onClick={entity && onEntityClick ? () => onEntityClick(entity) : undefined}
          />
        )
      }
      return (
        <a href={href} target="_blank" rel="noreferrer" style={{
          color: '#7dd3fc',
          textDecoration: 'underline',
          textUnderlineOffset: 3,
          textDecorationThickness: 1,
          transition: 'color 150ms',
        }}>
          {children}
        </a>
      )
    },
    p: ({ children }) => (
      <p style={{
        marginBottom: 10,
        lineHeight: 1.8,
        color: 'var(--text-secondary)',
        fontSize: 14,
      }}>{children}</p>
    ),
    strong: ({ children }) => (
      <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{children}</strong>
    ),
    em: ({ children }) => (
      <em style={{ color: 'var(--text-secondary)', fontStyle: 'italic', opacity: 0.9 }}>{children}</em>
    ),
    code: ({ className, children }) => {
      const isBlock = className?.startsWith('language-') || String(children).includes('\n')
      if (isBlock) {
        return (
          <pre style={{
            marginBottom: 12,
            padding: '14px 18px',
            borderRadius: 10,
            background: 'rgba(0,0,0,0.3)',
            border: '1px solid rgba(255,255,255,0.06)',
            overflow: 'auto',
            fontSize: 13,
            lineHeight: 1.6,
          }}>
            <code style={{
              fontFamily: 'var(--font-mono)',
              color: '#86efac',
              fontSize: '0.9em',
            }}>{children}</code>
          </pre>
        )
      }
      return (
        <code style={{
          fontSize: '0.88em',
          padding: '2px 7px',
          borderRadius: 5,
          background: 'rgba(255,255,255,0.06)',
          color: '#86efac',
          fontFamily: 'var(--font-mono)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}>{children}</code>
      )
    },
    pre: ({ children }) => <>{children}</>,
    ul: ({ children }) => (
      <ul style={{
        marginBottom: 10,
        paddingLeft: 22,
        lineHeight: 1.8,
        listStyle: 'disc',
      }}>{children}</ul>
    ),
    ol: ({ children }) => (
      <ol style={{
        marginBottom: 10,
        paddingLeft: 22,
        lineHeight: 1.8,
        listStyle: 'decimal',
      }}>{children}</ol>
    ),
    li: ({ children }) => (
      <li style={{
        color: 'var(--text-secondary)',
        marginBottom: 3,
        paddingLeft: 4,
      }}>{children}</li>
    ),
    h1: ({ children }) => (
      <h1 style={{
        fontSize: 20,
        fontWeight: 700,
        color: 'var(--text-primary)',
        marginBottom: 12,
        marginTop: 20,
        paddingBottom: 8,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        letterSpacing: '-0.01em',
      }}>{children}</h1>
    ),
    h2: ({ children }) => (
      <h2 style={{
        fontSize: 17,
        fontWeight: 600,
        color: 'var(--text-primary)',
        marginBottom: 10,
        marginTop: 18,
        letterSpacing: '-0.01em',
      }}>{children}</h2>
    ),
    h3: ({ children }) => (
      <h3 style={{
        fontSize: 15,
        fontWeight: 600,
        color: 'var(--text-primary)',
        marginBottom: 8,
        marginTop: 14,
      }}>{children}</h3>
    ),
    blockquote: ({ children }) => (
      <blockquote style={{
        marginBottom: 12,
        padding: '10px 16px',
        borderRadius: 8,
        borderLeft: '3px solid #c4b5fd',
        background: 'rgba(196,181,253,0.06)',
        color: 'var(--text-secondary)',
        fontStyle: 'italic',
      }}>{children}</blockquote>
    ),
    hr: () => (
      <hr style={{
        border: 'none',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        margin: '16px 0',
      }} />
    ),
    table: ({ children }) => (
      <div style={{
        marginBottom: 12,
        overflowX: 'auto',
        borderRadius: 10,
        border: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(255,255,255,0.02)',
      }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: 13,
          lineHeight: 1.6,
        }}>{children}</table>
      </div>
    ),
    thead: ({ children }) => (
      <thead style={{
        background: 'rgba(255,255,255,0.04)',
      }}>{children}</thead>
    ),
    th: ({ children }) => (
      <th style={{
        padding: '10px 14px',
        textAlign: 'left',
        fontWeight: 600,
        fontSize: 12,
        color: 'var(--text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        whiteSpace: 'nowrap',
      }}>{children}</th>
    ),
    td: ({ children }) => (
      <td style={{
        padding: '10px 14px',
        color: 'var(--text-secondary)',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        verticalAlign: 'top',
      }}>{children}</td>
    ),
    tr: ({ children }) => (
      <tr style={{
        transition: 'background 150ms',
      }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
      >{children}</tr>
    ),
  }

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={components}
    >
      {processed}
    </ReactMarkdown>
  )
}
