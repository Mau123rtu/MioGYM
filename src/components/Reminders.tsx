import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

interface Reminder {
  type: 'water' | 'exercise'
  time_of_day: string | null
  interval_minutes: number | null
  enabled: boolean
}

export default function Reminders() {
  const { session } = useAuth()
  const [water, setWater] = useState<Reminder>({ type: 'water', time_of_day: null, interval_minutes: 90, enabled: false })
  const [exercise, setExercise] = useState<Reminder>({ type: 'exercise', time_of_day: '18:00', interval_minutes: null, enabled: false })

  useEffect(() => {
    supabase.from('reminders').select('*').then(({ data }) => {
      data?.forEach((r: Reminder) => (r.type === 'water' ? setWater(r) : setExercise(r)))
    })
  }, [])

  const save = async (r: Reminder) => {
    if (r.enabled && 'Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission()
    }
    await supabase.from('reminders').upsert({ ...r, user_id: session!.user.id }, { onConflict: 'user_id,type' })
  }

  const notify = (body: string) => {
    if ('Notification' in window && Notification.permission === 'granted') new Notification('MioGym', { body })
    else alert(body)
  }

  // Agua: cada X minutos mientras la app esté abierta
  useEffect(() => {
    if (!water.enabled || !water.interval_minutes) return
    const t = setInterval(() => notify('💧 ¡Hora de tomar agua!'), water.interval_minutes * 60000)
    return () => clearInterval(t)
  }, [water.enabled, water.interval_minutes])

  // Ejercicio: revisa cada 30 s si llegó la hora
  useEffect(() => {
    if (!exercise.enabled || !exercise.time_of_day) return
    let last = ''
    const t = setInterval(() => {
      const now = new Date()
      const hhmm = now.toTimeString().slice(0, 5)
      if (hhmm === exercise.time_of_day!.slice(0, 5) && last !== hhmm) {
        last = hhmm
        notify('🏋️ ¡Es hora de entrenar!')
      }
    }, 30000)
    return () => clearInterval(t)
  }, [exercise.enabled, exercise.time_of_day])

  return (
    <div className="card">
      <h3>Recordatorios</h3>

      <label className="switch">
        💧 Agua cada
        <select value={water.interval_minutes ?? 90}
          onChange={e => { const r = { ...water, interval_minutes: Number(e.target.value) }; setWater(r); save(r) }}>
          <option value={30}>30 min</option><option value={60}>1 h</option>
          <option value={90}>1.5 h</option><option value={120}>2 h</option>
        </select>
        <input type="checkbox" checked={water.enabled}
          onChange={e => { const r = { ...water, enabled: e.target.checked }; setWater(r); save(r) }} />
      </label>

      <label className="switch">
        🏋️ Entrenar a las
        <input type="time" value={exercise.time_of_day?.slice(0, 5) ?? '18:00'}
          onChange={e => { const r = { ...exercise, time_of_day: e.target.value }; setExercise(r); save(r) }} />
        <input type="checkbox" checked={exercise.enabled}
          onChange={e => { const r = { ...exercise, enabled: e.target.checked }; setExercise(r); save(r) }} />
      </label>

      <p className="hint">Los avisos suenan mientras la app esté abierta. Para avisos con la app cerrada se necesitan notificaciones push (ver "Siguientes pasos").</p>
    </div>
  )
}