export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? 'brand-mark compact' : 'brand-mark'}>
      <svg viewBox="0 0 24 24" aria-hidden="true" className="brand-icon">
        <path d="M5 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM19 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
        <path d="M7 17h6a3 3 0 0 0 0-6h-2a3 3 0 0 1 0-6h6" />
      </svg>
      <span>Truck Weather Router</span>
    </div>
  )
}
