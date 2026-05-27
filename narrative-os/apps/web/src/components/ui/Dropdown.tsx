import { useState, useRef, useEffect } from 'react'

interface DropdownProps {
  options: { value: string; label: string }[]
  value: string | null
  placeholder: string
  onChange: (value: string | null) => void
  nullable?: boolean
}

export default function Dropdown({ options, value, placeholder, onChange, nullable = true }: DropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const selected = options.find((o) => o.value === value)

  return (
    <div className="dropdown-wrap" ref={ref}>
      <div
        className={`dropdown-trigger ${value ? 'active' : ''}`}
        onClick={() => setOpen(!open)}
      >
        {selected ? selected.label : placeholder}
      </div>
      {open && (
        <div className="dropdown-menu">
          {nullable && (
            <div
              className={`dropdown-item ${!value ? 'selected' : ''}`}
              onClick={() => { onChange(null); setOpen(false) }}
            >
              {placeholder}
            </div>
          )}
          {options.map((o) => (
            <div
              key={o.value}
              className={`dropdown-item ${value === o.value ? 'selected' : ''}`}
              onClick={() => { onChange(o.value); setOpen(false) }}
            >
              {o.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
