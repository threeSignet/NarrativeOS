import { useState, useCallback, useRef, useEffect } from 'react'
import { Plus, Loader2, Sparkles, ArrowRight, ArrowLeft, PenLine, Check, X } from 'lucide-react'
import Modal from '../ui/Modal'
import Input from '../ui/Input'
import { readSSEStream } from '../../utils/sse'

interface CreativeDirection {
  name: string
  summary: string
  hook: string
  diff: string
}

interface CreateProjectModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: {
    title: string
    genre: string
    style?: string
    target_words?: number
    core_creativity?: string
    platform?: string
  }) => Promise<void>
  initialData?: {
    title: string
    genre: string
    style?: string
    target_words?: number
    core_creativity?: string
    platform?: string
  }
}

const GENRES = ['修仙', '玄幻', '科幻', '都市', '历史', '游戏', '其他']
const PLATFORMS = ['起点中文网', '晋江文学城', '番茄小说', '纵横中文网', '17K', '豆瓣读书', '其他']
type Step = 'info' | 'brainstorm' | 'confirm'

export default function CreateProjectModal({ open, onClose, onSubmit, initialData }: CreateProjectModalProps) {
  // Step control
  const [step, setStep] = useState<Step>('info')

  // Step 1: basic info
  const [title, setTitle] = useState(initialData?.title || '')
  const [genre, setGenre] = useState(initialData?.genre || '')
  const [customGenre, setCustomGenre] = useState('')
  const [genreEditing, setGenreEditing] = useState(false)
  const [style, setStyle] = useState(initialData?.style || '')
  const [targetWords, setTargetWords] = useState(initialData?.target_words ? String(initialData.target_words) : '')
  const [platform, setPlatform] = useState(initialData?.platform || '')
  const [customPlatform, setCustomPlatform] = useState('')
  const [platformEditing, setPlatformEditing] = useState(false)

  const customGenreInputRef = useRef<HTMLInputElement>(null)
  const customPlatformInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (genreEditing && customGenreInputRef.current) {
      customGenreInputRef.current.focus()
    }
  }, [genreEditing])

  useEffect(() => {
    if (platformEditing && customPlatformInputRef.current) {
      customPlatformInputRef.current.focus()
    }
  }, [platformEditing])

  const effectiveGenre = genre === '其他' ? customGenre : genre
  const effectivePlatform = platform === '其他' ? customPlatform : platform

  // Step 2: brainstorm
  const [directions, setDirections] = useState<CreativeDirection[]>([])
  const [rawText, setRawText] = useState('')
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const [customIdea, setCustomIdea] = useState('')
  const [useCustom, setUseCustom] = useState(false)
  const [brainLoading, setBrainLoading] = useState(false)
  const [brainError, setBrainError] = useState<string | null>(null)
  const [streamText, setStreamText] = useState('')

  // Step 3: submitting
  const [submitting, setSubmitting] = useState(false)

  const canProceed = title.trim() && effectiveGenre

  const handleStartBrainstorm = useCallback(() => {
    if (!canProceed) return
    setStep('brainstorm')
    setBrainLoading(true)
    setBrainError(null)
    setStreamText('')
    setDirections([])
    setSelectedIdx(null)
    setCustomIdea('')
    setUseCustom(false)

    const body = {
      title: title.trim(),
      genre: effectiveGenre,
      style: style.trim() || undefined,
      target_words: targetWords ? parseInt(targetWords) : undefined,
    }

    let accumulated = ''
    fetch('/api/brainstorm/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: res.statusText }))
          throw new Error(err.error || '请求失败')
        }

        await readSSEStream(res, {
          onChunk: (text) => {
            accumulated += text
            setStreamText(accumulated)
          },
          onDone: (parsed) => {
            // 后端已在 done 事件中解析好 directions，无需前端正则提取
            if (parsed.directions && Array.isArray(parsed.directions)) {
              setDirections(parsed.directions as CreativeDirection[])
            }
            setRawText((parsed.raw as string) || accumulated)
            setBrainLoading(false)
          },
          onError: (message) => {
            setBrainError(message)
            setBrainLoading(false)
          },
        })
      })
      .catch((err) => {
        setBrainError(err.message)
        setBrainLoading(false)
      })
  }, [title, effectiveGenre, style, targetWords, canProceed])

  const handleBack = () => {
    if (step === 'brainstorm') setStep('info')
    if (step === 'confirm') setStep('brainstorm')
  }

  const handleConfirm = async () => {
    const coreCreativity = useCustom
      ? customIdea.trim()
      : selectedIdx !== null && directions[selectedIdx]
        ? `${directions[selectedIdx].name}：${directions[selectedIdx].summary} — ${directions[selectedIdx].hook}`
        : undefined

    setSubmitting(true)
    try {
      await onSubmit({
        title: title.trim(),
        genre: effectiveGenre,
        style: style.trim() || undefined,
        target_words: targetWords ? parseInt(targetWords) : undefined,
        core_creativity: coreCreativity,
        platform: effectivePlatform || undefined,
      })
      // Reset all
      setTitle(''); setGenre(''); setCustomGenre(''); setGenreEditing(false)
      setStyle(''); setTargetWords('')
      setPlatform(''); setCustomPlatform(''); setPlatformEditing(false)
      setDirections([]); setRawText(''); setSelectedIdx(null)
      setCustomIdea(''); setUseCustom(false); setStreamText('')
      setStep('info')
      onClose()
    } catch {
      // store handles error
    } finally {
      setSubmitting(false)
    }
  }

  const canConfirm = useCustom ? customIdea.trim().length > 0 : selectedIdx !== null

  const handleClose = () => {
    if (step !== 'info' && !submitting) {
      // Allow going back
      setStep('info')
      setBrainLoading(false)
      setStreamText('')
      return
    }
    if (!submitting) onClose()
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={step === 'info' ? '创建新宇宙' : 'AI 创意风暴'}
      wide
    >
      <div style={{ minHeight: 200 }}>
        {/* ── Step 1: Basic Info ── */}
        {step === 'info' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Input
              label="小说标题"
              placeholder="输入你的小说标题..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{
                fontSize: 11, color: 'var(--text-secondary)',
                fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
              }}>
                分类类型
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                {GENRES.filter((g) => g !== '其他').map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => { setGenre(g); setGenreEditing(false); }}
                    style={{
                      padding: '5px 12px',
                      borderRadius: 8,
                      fontSize: 13,
                      border: `1px solid ${genre === g ? 'var(--glass-border-active)' : 'var(--glass-border)'}`,
                      background: genre === g ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.03)',
                      color: genre === g ? 'var(--text-primary)' : 'var(--text-muted)',
                      cursor: 'pointer',
                      transition: 'all var(--duration) var(--ease)',
                    }}
                  >
                    {g}
                  </button>
                ))}
                {!genreEditing ? (
                  <button
                    type="button"
                    onClick={() => { setGenre('其他'); setGenreEditing(true); setCustomGenre(''); }}
                    style={{
                      padding: '5px 12px',
                      borderRadius: 8,
                      fontSize: 13,
                      border: `1px solid ${genre === '其他' ? 'var(--glass-border-active)' : 'var(--glass-border)'}`,
                      background: genre === '其他' ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.03)',
                      color: genre === '其他' ? 'var(--text-primary)' : 'var(--text-muted)',
                      cursor: 'pointer',
                      transition: 'all var(--duration) var(--ease)',
                    }}
                  >
                    其他
                  </button>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input
                      ref={customGenreInputRef}
                      type="text"
                      value={customGenre}
                      onChange={(e) => setCustomGenre(e.target.value)}
                      placeholder="输入自定义类型..."
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          if (customGenre.trim()) {
                            setGenreEditing(false);
                          }
                        } else if (e.key === 'Escape') {
                          setGenreEditing(false);
                          if (!customGenre.trim()) {
                            setGenre('');
                          }
                        }
                      }}
                      style={{
                        padding: '5px 10px',
                        borderRadius: 8,
                        fontSize: 13,
                        border: '1px solid var(--glass-border-active)',
                        background: 'rgba(255,255,255,0.06)',
                        color: 'var(--text-primary)',
                        outline: 'none',
                        width: 140,
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (customGenre.trim()) {
                          setGenreEditing(false);
                        }
                      }}
                      style={{
                        width: 24, height: 24, borderRadius: 4,
                        border: 'none',
                        background: customGenre.trim() ? 'var(--accent-mint)' : 'rgba(255,255,255,0.06)',
                        color: customGenre.trim() ? 'var(--bg-deep)' : 'var(--text-muted)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: customGenre.trim() ? 'pointer' : 'default',
                        flexShrink: 0,
                      }}
                    >
                      <Check size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setGenreEditing(false);
                        setCustomGenre('');
                        setGenre('');
                      }}
                      style={{
                        width: 24, height: 24, borderRadius: 4,
                        border: 'none',
                        background: 'rgba(255,255,255,0.04)',
                        color: 'var(--text-muted)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Input label="风格" placeholder="如：热血、暗黑..." value={style} onChange={(e) => setStyle(e.target.value)} />
              <Input label="目标字数" type="number" placeholder="如：500000" value={targetWords} onChange={(e) => setTargetWords(e.target.value)} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{
                fontSize: 11, color: 'var(--text-secondary)',
                fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
              }}>
                发布平台
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                {PLATFORMS.filter((p) => p !== '其他').map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => { setPlatform(platform === p ? '' : p); setPlatformEditing(false); }}
                    style={{
                      padding: '5px 12px',
                      borderRadius: 8,
                      fontSize: 13,
                      border: `1px solid ${platform === p ? 'var(--glass-border-active)' : 'var(--glass-border)'}`,
                      background: platform === p ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.03)',
                      color: platform === p ? 'var(--text-primary)' : 'var(--text-muted)',
                      cursor: 'pointer',
                      transition: 'all var(--duration) var(--ease)',
                    }}
                  >
                    {p}
                  </button>
                ))}
                {!platformEditing ? (
                  <button
                    type="button"
                    onClick={() => { setPlatform('其他'); setPlatformEditing(true); setCustomPlatform(''); }}
                    style={{
                      padding: '5px 12px',
                      borderRadius: 8,
                      fontSize: 13,
                      border: `1px solid ${platform === '其他' ? 'var(--glass-border-active)' : 'var(--glass-border)'}`,
                      background: platform === '其他' ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.03)',
                      color: platform === '其他' ? 'var(--text-primary)' : 'var(--text-muted)',
                      cursor: 'pointer',
                      transition: 'all var(--duration) var(--ease)',
                    }}
                  >
                    其他
                  </button>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input
                      ref={customPlatformInputRef}
                      type="text"
                      value={customPlatform}
                      onChange={(e) => setCustomPlatform(e.target.value)}
                      placeholder="输入自定义平台..."
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          if (customPlatform.trim()) {
                            setPlatformEditing(false);
                          }
                        } else if (e.key === 'Escape') {
                          setPlatformEditing(false);
                          if (!customPlatform.trim()) {
                            setPlatform('');
                          }
                        }
                      }}
                      style={{
                        padding: '5px 10px',
                        borderRadius: 8,
                        fontSize: 13,
                        border: '1px solid var(--glass-border-active)',
                        background: 'rgba(255,255,255,0.06)',
                        color: 'var(--text-primary)',
                        outline: 'none',
                        width: 140,
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (customPlatform.trim()) {
                          setPlatformEditing(false);
                        }
                      }}
                      style={{
                        width: 24, height: 24, borderRadius: 4,
                        border: 'none',
                        background: customPlatform.trim() ? 'var(--accent-mint)' : 'rgba(255,255,255,0.06)',
                        color: customPlatform.trim() ? 'var(--bg-deep)' : 'var(--text-muted)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: customPlatform.trim() ? 'pointer' : 'default',
                        flexShrink: 0,
                      }}
                    >
                      <Check size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPlatformEditing(false);
                        setCustomPlatform('');
                        setPlatform('');
                      }}
                      style={{
                        width: 24, height: 24, borderRadius: 4,
                        border: 'none',
                        background: 'rgba(255,255,255,0.04)',
                        color: 'var(--text-muted)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '6px 14px', borderRadius: 8, border: 'none',
                  background: 'transparent', color: 'var(--text-muted)',
                  fontSize: 13, cursor: 'pointer',
                }}
              >
                取消
              </button>
              <button
                type="button"
                disabled={!canProceed}
                onClick={handleStartBrainstorm}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '6px 16px', borderRadius: 8,
                  border: '1px solid var(--glass-border-hover)',
                  background: 'rgba(255,255,255,0.08)',
                  color: 'var(--text-primary)',
                  fontSize: 13, fontWeight: 500,
                  cursor: canProceed ? 'pointer' : 'not-allowed',
                  opacity: canProceed ? 1 : 0.4,
                  transition: 'all var(--duration) var(--ease)',
                }}
              >
                <Sparkles size={13} />
                AI 创意风暴
                <ArrowRight size={12} />
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Brainstorm ── */}
        {step === 'brainstorm' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Context */}
            <div style={{
              padding: '10px 14px',
              borderRadius: 8,
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--glass-border)',
              fontSize: 12,
              color: 'var(--text-secondary)',
              display: 'flex',
              gap: 12,
              flexWrap: 'wrap',
            }}>
              <span><strong style={{ color: 'var(--text-primary)' }}>{title}</strong></span>
              <span style={{ color: 'var(--text-muted)' }}>·</span>
              <span>{genre}</span>
              {style && <><span style={{ color: 'var(--text-muted)' }}>·</span><span>{style}</span></>}
            </div>

            {/* Loading state */}
            {brainLoading && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 12,
                padding: '24px 0',
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  color: 'var(--accent-violet)',
                  fontSize: 13,
                }}>
                  <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                  AI 正在思考创意方向...
                </div>
                {/* Streaming text preview */}
                {streamText && (
                  <div style={{
                    width: '100%',
                    maxHeight: 120,
                    overflowY: 'auto',
                    padding: 12,
                    borderRadius: 8,
                    background: 'rgba(196,181,253,0.04)',
                    border: '1px solid rgba(196,181,253,0.10)',
                    fontSize: 11,
                    color: 'var(--text-muted)',
                    fontFamily: 'var(--font-mono)',
                    whiteSpace: 'pre-wrap',
                    lineHeight: 1.6,
                  }}>
                    {streamText}
                  </div>
                )}
              </div>
            )}

            {/* Error state */}
            {brainError && (
              <div style={{
                padding: 12,
                borderRadius: 8,
                background: 'rgba(252,165,165,0.06)',
                border: '1px solid rgba(252,165,165,0.15)',
                fontSize: 13,
                color: 'var(--accent-rose)',
              }}>
                {brainError}
              </div>
            )}

            {/* Direction cards */}
            {!brainLoading && directions.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  选择一个方向，或输入自己的创意
                </p>
                {directions.map((d, i) => (
                  <div
                    key={i}
                    onClick={() => { setSelectedIdx(i); setUseCustom(false) }}
                    style={{
                      padding: 14,
                      borderRadius: 10,
                      border: `1px solid ${selectedIdx === i && !useCustom ? 'var(--accent-ice)' : 'var(--glass-border)'}`,
                      background: selectedIdx === i && !useCustom ? 'rgba(125,211,252,0.06)' : 'rgba(255,255,255,0.02)',
                      cursor: 'pointer',
                      transition: 'all var(--duration) var(--ease)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      {selectedIdx === i && !useCustom && (
                        <Check size={14} style={{ color: 'var(--accent-ice)', flexShrink: 0 }} />
                      )}
                      <strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>{d.name}</strong>
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{d.summary}</p>
                    {d.hook && (
                      <p style={{ fontSize: 11, color: 'var(--accent-warm)' }}>
                        卖点：{d.hook}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Fallback: raw text if parsing failed */}
            {!brainLoading && directions.length === 0 && rawText && !brainError && (
              <div style={{
                padding: 12,
                borderRadius: 8,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--glass-border)',
                fontSize: 12,
                color: 'var(--text-secondary)',
                whiteSpace: 'pre-wrap',
                maxHeight: 200,
                overflowY: 'auto',
                lineHeight: 1.6,
              }}>
                {rawText}
              </div>
            )}

            {/* Custom creativity input */}
            {!brainLoading && (directions.length > 0 || rawText) && (
              <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <button
                    type="button"
                    onClick={() => { setUseCustom(!useCustom); if (!useCustom) setSelectedIdx(null) }}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '4px 10px', borderRadius: 6,
                      border: `1px solid ${useCustom ? 'var(--accent-warm)' : 'var(--glass-border)'}`,
                      background: useCustom ? 'rgba(253,230,138,0.08)' : 'transparent',
                      color: useCustom ? 'var(--accent-warm)' : 'var(--text-muted)',
                      fontSize: 12, cursor: 'pointer',
                      transition: 'all var(--duration) var(--ease)',
                    }}
                  >
                    <PenLine size={12} />
                    我有自己的创意
                  </button>
                </div>
                {useCustom && (
                  <textarea
                    value={customIdea}
                    onChange={(e) => setCustomIdea(e.target.value)}
                    placeholder="描述你的核心创意、故事主线、独特设定..."
                    style={{
                      width: '100%',
                      minHeight: 80,
                      padding: '10px 12px',
                      borderRadius: 8,
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid var(--glass-border)',
                      color: 'var(--text-primary)',
                      fontSize: 13,
                      fontFamily: 'var(--font-ui)',
                      lineHeight: 1.6,
                      resize: 'vertical',
                      outline: 'none',
                    }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--border-focus)' }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--glass-border)' }}
                  />
                )}
              </div>
            )}

            {/* Actions */}
            {!brainLoading && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <button
                  type="button"
                  onClick={handleBack}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '6px 12px', borderRadius: 8, border: 'none',
                    background: 'transparent', color: 'var(--text-muted)',
                    fontSize: 12, cursor: 'pointer',
                  }}
                >
                  <ArrowLeft size={12} />
                  返回修改
                </button>
                <button
                  type="button"
                  disabled={!canConfirm}
                  onClick={handleConfirm}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '6px 16px', borderRadius: 8,
                    border: '1px solid var(--glass-border-hover)',
                    background: 'rgba(255,255,255,0.08)',
                    color: 'var(--text-primary)',
                    fontSize: 13, fontWeight: 500,
                    cursor: canConfirm ? 'pointer' : 'not-allowed',
                    opacity: canConfirm ? 1 : 0.4,
                    transition: 'all var(--duration) var(--ease)',
                  }}
                >
                  {submitting ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={13} />}
                  {submitting ? '创建中...' : '确认创建'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
