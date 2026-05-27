import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  children: ReactNode
}

const variantStyles: Record<Variant, string> = {
  primary: `
    bg-white/[0.08] border border-white/[0.12]
    hover:bg-white/[0.14] hover:border-white/[0.20]
    text-white/88
  `,
  secondary: `
    bg-transparent border border-white/[0.08]
    hover:bg-white/[0.06] hover:border-white/[0.12]
    text-white/60 hover:text-white/88
  `,
  ghost: `
    bg-transparent border-none
    hover:bg-white/[0.06]
    text-white/50 hover:text-white/88
  `,
}

export default function Button({ variant = 'primary', children, className = '', ...props }: ButtonProps) {
  return (
    <button
      className={`
        inline-flex items-center justify-center gap-2
        px-4 py-2 rounded-lg
        font-medium text-sm
        transition-all duration-[var(--speed-fast)] ease-[var(--ease)]
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]
        disabled:opacity-40 disabled:cursor-not-allowed
        ${variantStyles[variant]}
        ${className}
      `}
      {...props}
    >
      {children}
    </button>
  )
}
