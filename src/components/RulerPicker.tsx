import { useEffect, useRef } from 'react'
import './ruler.css'

interface Props {
  value: number
  min: number
  max: number
  step: number
  tick?: number            // píxeles por paso
  major: number            // cada cuántos pasos va la marca grande con número
  mid?: number             // cada cuántos pasos va la marca mediana
  height?: number
  label: (v: number) => string
  onChange: (v: number) => void
  ariaLabel: string
}

const round = (n: number) => Math.round(n * 1000) / 1000

export default function RulerPicker({ value, min, max, step, tick = 10, major, mid, height = 260, label, onChange, ariaLabel }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const last = useRef(value)
  const timer = useRef<number | undefined>(undefined)
  const drag = useRef<{ y: number; top: number } | null>(null)

  const n = Math.round((max - min) / step)
  const idxOf = (v: number) => Math.min(n, Math.max(0, Math.round((v - min) / step)))
  const valOf = (i: number) => round(min + i * step)
  last.current = value

  // Mueve la regla cuando el valor cambia desde fuera (al cambiar de unidad o con los botones)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const top = idxOf(value) * tick
    if (Math.abs(el.scrollTop - top) > tick / 2) el.scrollTop = top
  }, [value, min, max, step, tick])

  const snap = () => {
    const el = ref.current
    if (!el) return
    const top = Math.min(n, Math.max(0, Math.round(el.scrollTop / tick))) * tick
    if (Math.abs(el.scrollTop - top) > 0.5) el.scrollTo({ top, behavior: 'smooth' })
  }

  const onScroll = () => {
    const el = ref.current
    if (!el) return
    const i = Math.min(n, Math.max(0, Math.round(el.scrollTop / tick)))
    const v = valOf(i)
    if (Math.abs(v - last.current) > 1e-9) { last.current = v; onChange(v) }
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => { if (!drag.current) snap() }, 140)
  }

  // Arrastrar con el mouse (en pantallas táctiles se usa el desplazamiento nativo)
  const down = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse' || !ref.current) return
    drag.current = { y: e.clientY, top: ref.current.scrollTop }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    if (drag.current && ref.current) ref.current.scrollTop = drag.current.top - (e.clientY - drag.current.y)
  }
  const up = () => { if (drag.current) { drag.current = null; snap() } }

  const nudge = (d: number) => onChange(valOf(Math.min(n, Math.max(0, idxOf(value) + d))))
  const key = (e: React.KeyboardEvent) => {
    const k = e.key
    if (k === 'ArrowDown' || k === 'ArrowRight') { e.preventDefault(); nudge(1) }
    else if (k === 'ArrowUp' || k === 'ArrowLeft') { e.preventDefault(); nudge(-1) }
    else if (k === 'PageDown') { e.preventDefault(); nudge(major) }
    else if (k === 'PageUp') { e.preventDefault(); nudge(-major) }
  }

  const bg = [
    `linear-gradient(to bottom,#c9c9c9 2px,transparent 2px) right top / 30px ${tick * major}px repeat-y`,
    ...(mid ? [`linear-gradient(to bottom,#707070 1px,transparent 1px) right top / 22px ${tick * mid}px repeat-y`] : []),
    `linear-gradient(to bottom,#3d3d3d 1px,transparent 1px) right top / 14px ${tick}px repeat-y`,
  ].join(',')

  const labels: number[] = []
  for (let i = 0; i <= n; i += major) labels.push(i)

  return (
    <div className="rp" style={{ ['--h' as string]: `${height}px` }}>
      <div className="rp-ruler">
        <div ref={ref} className="rp-scroll" role="slider" tabIndex={0} aria-label={ariaLabel}
          aria-valuemin={min} aria-valuemax={max} aria-valuenow={value}
          onScroll={onScroll} onKeyDown={key}
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
          <div style={{ height: height / 2 }} />
          <div className="rp-track" style={{ height: n * tick + 2, background: bg }}>
            {labels.map(i => <span key={i} className="rp-lab" style={{ top: i * tick }}>{label(valOf(i))}</span>)}
          </div>
          <div style={{ height: height / 2 }} />
        </div>
        <div className="rp-ind" />
      </div>
      <div className="rp-btns">
        <button type="button" onClick={() => nudge(-1)} aria-label="Bajar un paso">−</button>
        <button type="button" onClick={() => nudge(1)} aria-label="Subir un paso">+</button>
      </div>
    </div>
  )
}