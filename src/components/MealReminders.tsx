import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Icon from './Icons'
import type { NPlan } from '../lib/nutritionPlan'

interface R { id: number; label: string; time_of_day: string; enabled: boolean }
const LABELS = ['Desayuno', 'Colación', 'Comida', 'Cena']
const changed = () => window.dispatchEvent(new Event('meal-reminders-changed'))

export default function MealReminders({ plan }: { plan: NPlan | null }) {
  const { session } = useAuth()
  const [list, setList] = useState<R[]>([])
  const [perm, setPerm] = useState<string>('Notification' in window ? Notification.permission : 'unsupported')

  const load = () => supabase.from('meal_reminders').select('*').order('time_of_day', { ascending: true })
    .then(({ data }) => setList((data as R[]) ?? []))
  useEffect(() => { load() }, [])

  const ask = async () => { if ('Notification' in window) setPerm(await Notification.requestPermission()) }

  const add = async (label = 'Comida', time = '14:00') => {
    await supabase.from('meal_reminders').insert({ user_id: session!.user.id, label, time_of_day: time })
    await load(); changed()
  }
  const patch = async (id: number, p: Partial<R>) => {
    setList(l => l.map(r => (r.id === id ? { ...r, ...p } : r)))
    await supabase.from('meal_reminders').update(p).eq('id', id)
    changed()
  }
  const remove = async (id: number) => {
    await supabase.from('meal_reminders').delete().eq('id', id)
    await load(); changed()
  }
  const fromPlan = async () => {
    if (!plan) return
    const rows = plan.meals
      .filter(m => !list.some(r => r.label === m.label && r.time_of_day.slice(0, 5) === m.time))
      .map(m => ({ user_id: session!.user.id, label: m.label, time_of_day: m.time }))
    if (rows.length) await supabase.from('meal_reminders').insert(rows)
    await load(); changed()
  }

  return (
    <>
      <p className="hint">Te avisamos a la hora de tus comidas para que subas una foto o anotes lo que comes.</p>

      {perm === 'default' && <button className="btn" onClick={ask}>Activar notificaciones del navegador</button>}
      {perm === 'denied' && <div className="warn">Las notificaciones están bloqueadas en tu navegador. Igual verás un aviso dentro de la app mientras esté abierta.</div>}

      {list.length === 0 && <div className="card"><p className="hint" style={{ margin: 0 }}>Aún no tienes recordatorios.</p></div>}
      {list.map(r => (
        <div className="card rem" key={r.id}>
          <select value={LABELS.includes(r.label) ? r.label : 'Otra'} onChange={e => patch(r.id, { label: e.target.value })}>
            {LABELS.map(l => <option key={l}>{l}</option>)}
            {!LABELS.includes(r.label) && <option value="Otra">{r.label}</option>}
          </select>
          <input type="time" value={r.time_of_day.slice(0, 5)} onChange={e => e.target.value && patch(r.id, { time_of_day: e.target.value })} />
          <input type="checkbox" checked={r.enabled} onChange={e => patch(r.id, { enabled: e.target.checked })} aria-label="Activo" />
          <button className="mini-ic" onClick={() => remove(r.id)} aria-label="Eliminar"><Icon name="trash" size={16} /></button>
        </div>
      ))}

      <button className="btn primary" onClick={() => add()}><Icon name="plus" size={16} /> Agregar recordatorio</button>
      {plan && <button className="btn" onClick={fromPlan}>Usar los horarios de mi plan</button>}
      <p className="hint">Los avisos suenan mientras la app esté abierta, aunque estés en otra pantalla. En el celular, para recibirlos con la app cerrada hace falta convertirla en PWA con notificaciones push.</p>
    </>
  )
}