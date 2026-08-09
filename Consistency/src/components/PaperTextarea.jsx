import { useEffect, useRef } from 'react'
import { MAX_NOTE_LENGTH } from '../lib/useNotes'

const RULE = 32 // must match --rule in .paper

/**
 * Auto-growing textarea on ruled paper. Height follows the content so the page
 * never gets an inner scrollbar, which would break the ruled-line illusion.
 */
export default function PaperTextarea({
  value,
  onChange,
  onCancel,
  onSubmit,
  placeholder,
  minRows = 3,
  autoFocus = false,
  label,
}) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    // Collapse first, or scrollHeight only ever grows.
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value])

  const onKeyDown = (e) => {
    if (e.key === 'Escape' && onCancel) {
      e.preventDefault()
      onCancel()
    }
    // Enter alone must stay a newline — this is a notepad.
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && onSubmit) {
      e.preventDefault()
      onSubmit()
    }
  }

  return (
    <textarea
      ref={ref}
      className="paper"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      aria-label={label}
      maxLength={MAX_NOTE_LENGTH}
      autoFocus={autoFocus}
      style={{ minHeight: `${minRows * RULE + 32}px` }}
    />
  )
}
