import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

interface R { id: number; label: string; time_of_day: string }

export default function MealReminderWatcher() {
  const [list, setList] = useState<R[]>([])
  const [banner, setBanner] = useState<string | null>(null)
  const fired = useRef(new Set<string>())

  const load = () => supabase.from('meal_reminders').select('id,label,time_of_day').eq('enabled', true)
    .then(({ data }) => setList((data as R[]) ?? []))

  useEffect(() => {
    load()
    window.addEventListener('meal-reminders-changed', load)
    return () => window.removeEventListener('meal-reminders-changed', load)
  }, [])

  useEffect(() => {
    const check = () => {
      const n = new Date()
      const mins = n.getHours() * 60 + n.getMinutes()
      const day = n.toLocaleDateString('en-CA')
      list.forEach(r => {
        const [h, m] = r.time_of_day.split(':').map(Number)
        const t = h * 60 + m
        const key = `${day}|${r.id}|${r.time_of_day}`
        if (mins >= t && mins <= t + 2 && !fired.current.has(key)) {
          fired.current.add(key)
          const text = `Hora de tu ${r.label.toLowerCase()}. ¿Quieres subir una foto de lo que comes?`
          setBanner(text)
          navigator.vibrate?.(200)
          try {
            if ('Notification' in window && Notification.permission === 'granted') new Notification('MioGym', { body: text })
          } catch { /* algunos móviles no permiten esta API sin service worker */ }
        }
      })
    }
    check()
    const id = setInterval(check, 20000)
    return () => clearInterval(id)
  }, [list])

  if (!banner) return null
  return (
    <div className="remind-banner" role="alert">
      <span>{banner}</span>
      <Link to="/app/nutricion" onClick={() => setBanner(null)}>Subir</Link>
      <button onClick={() => setBanner(null)} aria-label="Cerrar">×</button>
    </div>
  )
}