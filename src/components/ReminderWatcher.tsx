import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

interface Rem { type: 'water' | 'exercise'; time_of_day: string | null; interval_minutes: number | null; enabled: boolean }
interface Meal { id: number; label: string; time_of_day: string }
interface Banner { id: string; text: string; to?: string; cta?: string }

const WATER_KEY = 'miogym-water-last'
const WATER_FROM = 8 * 60
const WATER_TO = 22 * 60

/** true solo la primera vez que se pide esa clave en el día */
function once(key: string) {
  const day = new Date().toLocaleDateString('en-CA')
  let s: { day: string; keys: string[] } = { day, keys: [] }
  try {
    const r = JSON.parse(localStorage.getItem('miogym-fired') ?? '')
    if (r.day === day) s = r
  } catch { /* primera vez */ }
  if (s.keys.includes(key)) return false
  s.keys.push(key)
  localStorage.setItem('miogym-fired', JSON.stringify(s))
  return true
}

async function system(body: string) {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') return
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined
    if (reg) await reg.showNotification('MioGym', { body, icon: '/pwa-192x192.png', tag: body })
    else new Notification('MioGym', { body })
  } catch { /* algunos móviles no lo permiten sin service worker */ }
}

export default function ReminderWatcher() {
  const [rems, setRems] = useState<Rem[]>([])
  const [meals, setMeals] = useState<Meal[]>([])
  const [banners, setBanners] = useState<Banner[]>([])
  const trained = useRef<string>('')

  const load = () => {
    supabase.from('reminders').select('type,time_of_day,interval_minutes,enabled')
      .then(({ data }) => { if (data) setRems(data as Rem[]) })
    supabase.from('meal_reminders').select('id,label,time_of_day').eq('enabled', true)
      .then(({ data }) => { if (data) setMeals(data as Meal[]) })
  }

  const show = (b: Banner, autoMs?: number) => {
    setBanners(l => (l.some(x => x.id === b.id) ? l : [...l, b]))
    navigator.vibrate?.(200)
    system(b.text)
    if (autoMs) setTimeout(() => close(b.id), autoMs)
  }
  const close = (id: string) => setBanners(l => l.filter(x => x.id !== id))

  useEffect(() => {
    load()
    const ev = ['reminders-changed', 'meal-reminders-changed']
    ev.forEach(e => window.addEventListener(e, load))
    const test = () => show({ id: `test-${Date.now()}`, text: 'Así se verá tu aviso. ¡Todo funciona!' }, 6000)
    window.addEventListener('reminder-test', test)
    return () => { ev.forEach(e => window.removeEventListener(e, load)); window.removeEventListener('reminder-test', test) }
  }, [])

  useEffect(() => {
    const check = async () => {
      const n = new Date()
      const mins = n.getHours() * 60 + n.getMinutes()
      const day = n.toLocaleDateString('en-CA')

      // Agua: cada X minutos, solo de 8:00 a 22:00
      const water = rems.find(r => r.type === 'water')
      if (water?.enabled && water.interval_minutes) {
        if (mins >= WATER_FROM && mins <= WATER_TO) {
          const last = Number(localStorage.getItem(WATER_KEY)) || 0
          if (!last) localStorage.setItem(WATER_KEY, String(Date.now()))
          else if (Date.now() - last >= water.interval_minutes * 60000) {
            localStorage.setItem(WATER_KEY, String(Date.now()))
            show({ id: `water-${Date.now()}`, text: 'Hora de tomar agua.' }, 15000)
          }
        }
      }

      // Ejercicio: a la hora elegida, una vez al día, y solo si aún no entrenaste
      const ex = rems.find(r => r.type === 'exercise')
      if (ex?.enabled && ex.time_of_day) {
        const [h, m] = ex.time_of_day.split(':').map(Number)
        const t = h * 60 + m
        if (mins >= t && mins <= t + 10 && once(`ex|${ex.time_of_day}`)) {
          if (trained.current !== day) {
            const s0 = new Date(); s0.setHours(0, 0, 0, 0)
            const { data } = await supabase.from('workout_sessions').select('id').gte('completed_at', s0.toISOString()).limit(1)
            if (data && data.length) trained.current = day
          }
          if (trained.current !== day) show({ id: `ex-${day}`, text: 'Es hora de entrenar.', to: '/app/ejercicios', cta: 'Ir a rutinas' })
        }
      }

      // Comidas
      meals.forEach(r => {
        const [h, m] = r.time_of_day.split(':').map(Number)
        const t = h * 60 + m
        if (mins >= t && mins <= t + 2 && once(`meal|${r.id}|${r.time_of_day}`))
          show({ id: `meal-${r.id}-${day}`, text: `Hora de tu ${r.label.toLowerCase()}. ¿Quieres subir una foto de lo que comes?`, to: '/app/nutricion', cta: 'Subir' })
      })
    }
    check()
    const id = setInterval(check, 20000)
    const vis = () => { if (document.visibilityState === 'visible') check() }
    document.addEventListener('visibilitychange', vis)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', vis) }
  }, [rems, meals])

  if (!banners.length) return null
  return (
    <div className="remind-stack" role="alert">
      {banners.map(b => (
        <div className="remind-banner" key={b.id}>
          <span>{b.text}</span>
          {b.to && <Link to={b.to} onClick={() => close(b.id)}>{b.cta ?? 'Ver'}</Link>}
          <button onClick={() => close(b.id)} aria-label="Cerrar">×</button>
        </div>
      ))}
    </div>
  )
}