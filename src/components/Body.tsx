import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import type { G } from '../lib/routine'

const NAMES: Record<G, string> = {
  pecho: 'Pecho', espalda: 'Espalda', hombros: 'Hombros',
  brazos: 'Bíceps y tríceps', piernas: 'Piernas y glúteos', abdomen: 'Abdomen',
}
// el número coincide con el mapa de zonas de las imágenes
const GROUPS: G[] = ['pecho', 'espalda', 'hombros', 'brazos', 'piernas', 'abdomen']
const YELLOW = [255, 212, 0]

export const useFemale = () => useAuth().profile?.sex === 'mujer'

interface Zone { w: number; h: number; paint: Uint8Array; hit: Uint8Array }
interface Loaded { img: HTMLImageElement; zone: Zone }

const cache = new Map<string, Promise<Loaded>>()

const loadImg = (src: string) => new Promise<HTMLImageElement>((ok, no) => {
  const i = new Image()
  i.onload = () => ok(i)
  i.onerror = () => no(new Error(`No se pudo cargar ${src}`))
  i.src = src
})

function load(id: string): Promise<Loaded> {
  let p = cache.get(id)
  if (!p) {
    p = (async () => {
      const [img, zimg] = await Promise.all([loadImg(`/body/${id}.png`), loadImg(`/body/${id}-z.png`)])
      const c = document.createElement('canvas')
      c.width = zimg.width; c.height = zimg.height
      const ctx = c.getContext('2d', { willReadFrequently: true })!
      ctx.drawImage(zimg, 0, 0)
      const d = ctx.getImageData(0, 0, c.width, c.height).data
      const n = c.width * c.height
      const paint = new Uint8Array(n), hit = new Uint8Array(n)
      for (let i = 0; i < n; i++) { paint[i] = d[i * 4]; hit[i] = d[i * 4 + 1] }
      return { img, zone: { w: c.width, h: c.height, paint, hit } }
    })()
    p.catch(() => cache.delete(id))   // si falla, se reintenta la próxima vez
    cache.set(id, p)
  }
  return p
}

/** Una figura: base en gris + músculos pintados según `alpha(g)` (0 a 1) */
function Fig({ id, alpha, onPick, label }: {
  id: string; alpha: (g: G) => number; onPick?: (g: G) => void; label: string
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [data, setData] = useState<Loaded | null>(null)

  useEffect(() => {
    let alive = true
    setData(null)
    load(id).then(d => { if (alive) setData(d) }).catch(() => { /* sin imagen: no se dibuja */ })
    return () => { alive = false }
  }, [id])

  const key = GROUPS.map(g => alpha(g).toFixed(2)).join(',')

  useEffect(() => {
    const c = ref.current
    if (!data || !c) return
    const { img, zone } = data
    c.width = zone.w; c.height = zone.h
    const ctx = c.getContext('2d', { willReadFrequently: true })!
    ctx.drawImage(img, 0, 0, zone.w, zone.h)
    const al = GROUPS.map(g => alpha(g))
    if (al.every(a => a <= 0)) return
    const im = ctx.getImageData(0, 0, zone.w, zone.h)
    const px = im.data
    for (let i = 0; i < zone.paint.length; i++) {
      const g = zone.paint[i]
      if (!g) continue
      const a = al[g - 1]
      if (a <= 0) continue
      const o = i * 4
      px[o] = px[o] * (1 - a) + YELLOW[0] * a
      px[o + 1] = px[o + 1] * (1 - a) + YELLOW[1] * a
      px[o + 2] = px[o + 2] * (1 - a) + YELLOW[2] * a
    }
    ctx.putImageData(im, 0, 0)
  }, [data, key])

  const at = (e: React.MouseEvent<HTMLCanvasElement>): G | null => {
    if (!data) return null
    const r = e.currentTarget.getBoundingClientRect()
    const x = Math.floor(((e.clientX - r.left) / r.width) * data.zone.w)
    const y = Math.floor(((e.clientY - r.top) / r.height) * data.zone.h)
    if (x < 0 || y < 0 || x >= data.zone.w || y >= data.zone.h) return null
    const g = data.zone.hit[y * data.zone.w + x]
    return g ? GROUPS[g - 1] : null
  }

  return (
    <canvas
      ref={ref}
      role={onPick ? 'button' : 'img'}
      aria-label={label}
      onClick={onPick ? e => { const g = at(e); if (g) onPick(g) } : undefined}
      onMouseMove={onPick ? e => { e.currentTarget.style.cursor = at(e) ? 'pointer' : 'default' } : undefined}
    />
  )
}

const figId = (female: boolean, view: 'front' | 'back') =>
  `${female ? 'mujer' : 'hombre'}-${view === 'front' ? 'frente' : 'espalda'}`

/** Muñecos de frente y espalda con los músculos pintados según porcentaje */
export function BodyMap({ pcts, max, only, compact }: {
  pcts: Record<string, number>; max: number; only?: 'front' | 'back'; compact?: boolean
}) {
  const female = useFemale()
  const alpha = (g: G) => { const v = pcts[g] ?? 0; return v > 0 ? 0.3 + 0.7 * (v / max) : 0 }
  return (
    <div className={compact ? 'body-wrap compact' : 'body-wrap'}>
      {only !== 'back' && <figure><Fig id={figId(female, 'front')} alpha={alpha} label="Vista frontal" /><figcaption>Frente</figcaption></figure>}
      {only !== 'front' && <figure><Fig id={figId(female, 'back')} alpha={alpha} label="Vista posterior" /><figcaption>Espalda</figcaption></figure>}
    </div>
  )
}

/** Muñecos clicables para elegir un músculo */
export function BodyPicker({ value, onPick }: { value: G | null; onPick: (g: G | null) => void }) {
  const female = useFemale()
  const alpha = (g: G) => (value === g ? 1 : 0)
  const pick = (g: G) => onPick(value === g ? null : g)
  return (
    <div className="body-wrap picker">
      <figure><Fig id={figId(female, 'front')} alpha={alpha} onPick={pick} label={`Vista frontal. Toca un músculo (${NAMES[value ?? 'pecho']})`} /><figcaption>Frente</figcaption></figure>
      <figure><Fig id={figId(female, 'back')} alpha={alpha} onPick={pick} label="Vista posterior. Toca un músculo" /><figcaption>Espalda</figcaption></figure>
    </div>
  )
}