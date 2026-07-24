"use client"

type Props = {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  disabled?: boolean
  /** Fired when the shopper taps + but value is already at max (stock cap). */
  onMaxAttempt?: () => void
}

/**
 * Compact ± stepper for the PDP — sized for mobile so it doesn't
 * dominate the buy row.
 */
export default function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 99,
  disabled,
  onMaxAttempt,
}: Props) {
  const dec = () => onChange(Math.max(min, value - 1))
  const inc = () => {
    if (value >= max) {
      onMaxAttempt?.()
      return
    }
    onChange(Math.min(max, value + 1))
  }

  const btn =
    "w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-full bg-bg text-ink border border-line transition-all duration-200 hover:bg-primary hover:text-primary-fg hover:border-primary disabled:opacity-40 disabled:cursor-not-allowed"

  return (
    <div className="inline-flex items-center gap-1 rounded-full p-0.5 bg-surface border border-line">
      <button
        type="button"
        onClick={dec}
        disabled={disabled || value <= min}
        aria-label="Decrease quantity"
        className={btn}
      >
        <i className="ph-bold ph-minus text-[10px] sm:text-[11px]" aria-hidden />
      </button>
      <span
        aria-live="polite"
        className="min-w-[22px] sm:min-w-[24px] text-center text-[11px] sm:text-xs font-semibold text-ink tabular-nums"
      >
        {value}
      </span>
      <button
        type="button"
        onClick={inc}
        disabled={disabled}
        aria-label="Increase quantity"
        className={btn}
      >
        <i className="ph-bold ph-plus text-[10px] sm:text-[11px]" aria-hidden />
      </button>
    </div>
  )
}
