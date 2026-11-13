import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Icon from './Icons'

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
  const [perm, setPerm] = useState<string>('Notification' in window ? Notification.permission : 'unsupported')

  useEffect(() => {
    supabase.from('reminders').select('*').then(({ data }) => {
      data?.forEach((r: Reminder) => (r.type === 'water' ? setWater(r) : setExercise(r)))
    })
  }, [])

  const save = async (r: Reminder) => {
    if (r.enabled && 'Notification' in window && Notification.permission === 'default') {
      setPerm(await Notification.requestPermission())
    }
    if (r.type === 'water') localStorage.removeItem('miogym-water-last')   // reinicia la cuenta del agua
    await supabase.from('reminders').upsert({ ...r, user_id: session!.user.id }, { onConflict: 'user_id,type' })
    window.dispatchEvent(new Event('reminders-changed'))
  }

  return (
    <div className="card">
      <h3>Recordatorios</h3>

      <label className="switch">
        <Icon name="drop" size={20} /><span style={{ flex: 1 }}>Agua cada</span>
        <select value={water.interval_minutes ?? 90}
          onChange={e => { const r = { ...water, interval_minutes: Number(e.target.value) }; setWater(r); save(r) }}>
          <option value={30}>30 min</option><option value={60}>1 h</option>
          <option value={90}>1.5 h</option><option value={120}>2 h</option>
        </select>
        <input type="checkbox" checked={water.enabled}
          onChange={e => { const r = { ...water, enabled: e.target.checked }; setWater(r); save(r) }} />
      </label>

      <label className="switch">
        <Icon name="dumbbell" size={20} /><span style={{ flex: 1 }}>Entrenar a las</span>
        <input type="time" value={exercise.time_of_day?.slice(0, 5) ?? '18:00'}
          onChange={e => { if (!e.target.value) return; const r = { ...exercise, time_of_day: e.target.value }; setExercise(r); save(r) }} />
        <input type="checkbox" checked={exercise.enabled}
          onChange={e => { const r = { ...exercise, enabled: e.target.checked }; setExercise(r); save(r) }} />
      </label>

      {perm === 'default' && <button className="btn" onClick={async () => setPerm(await Notification.requestPermission())}>Activar notificaciones del navegador</button>}
      {perm === 'denied' && <div className="warn">Las notificaciones están bloqueadas en tu navegador. Igual verás el aviso dentro de la app.</div>}

      <button className="btn" onClick={() => window.dispatchEvent(new Event('reminder-test'))}>Probar aviso</button>
      <p className="hint">El agua te avisa de 8:00 a 22:00. Los avisos suenan en cualquier pantalla, mientras la app esté abierta.</p>
    </div>
  )
}