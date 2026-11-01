import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Icon from './Icons'
import { MFIELDS, progressChanged, useProgressData, type MKey, type MRow } from '../lib/progress'

const today = () => new Date().toLocaleDateString('en-CA')
const fmtDate = (s: string) => new Date(`${s}T12:00:00`).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })
const r1 = (x: number) => Math.round(x * 10) / 10
const arrow = (d: number) => (d > 0 ? `▲ +${r1(d)}` : d < 0 ? `▼ ${r1(d)}` : '= igual')

export default function Measurements() {
  const { session, profile } = useAuth()
  const { meas, loading } = useProgressData()
  const [date, setDate] = useState(today())
  const [vals, setVals] = useState<Record<MKey, string>>({ arm_cm: '', thigh_cm: '', waist_cm: '', hip_cm: '', chest_cm: '' })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null)
  const [help, setHelp] = useState(false)

  const save = async () => {
    const row: Record<string, number | string> = { user_id: session!.user.id, measured_at: date }
    let n = 0
    for (const [k, label] of MFIELDS) {
      const raw = vals[k].trim()
      if (!raw) continue
      const v = Number(raw.replace(',', '.'))
      if (!Number.isFinite(v) || v < 5 || v > 300) { setMsg({ ok: false, t: `${label}: escribe un valor en cm entre 5 y 300.` }); return }
      row[k] = v; n++
    }
    if (!n) { setMsg({ ok: false, t: 'Escribe al menos una medida.' }); return }
    setBusy(true); setMsg(null)
    const { error } = await supabase.from('body_measurements').insert(row)
    setBusy(false)
    if (error) { setMsg({ ok: false, t: error.message }); return }
    setVals({ arm_cm: '', thigh_cm: '', waist_cm: '', hip_cm: '', chest_cm: '' })
    setMsg({ ok: true, t: 'Medidas guardadas.' }); progressChanged()
  }

  const remove = async (id: number) => {
    if (!window.confirm('¿Eliminar este registro de medidas?')) return
    await supabase.from('body_measurements').delete().eq('id', id)
    progressChanged()
  }

  const goal = profile?.goal
  const hint = (k: MKey, d: number | null) => {
    if (d === null || d === 0) return ''
    if (k === 'waist_cm') return d < 0 ? (goal === 'grasa' ? 'Va en tu dirección' : '') : goal === 'grasa' ? 'Revisa tu alimentación' : ''
    if (goal === 'masa' && ['arm_cm', 'chest_cm', 'thigh_cm'].includes(k)) return d > 0 ? 'Va en tu dirección' : ''
    return ''
  }

  const info = MFIELDS.map(([k, label]) => {
    const rows = meas.filter(r => r[k] !== null)
    const last = rows[rows.length - 1], prev = rows[rows.length - 2], first = rows[0]
    return {
      k, label, last,
      dPrev: last && prev ? Number(last[k]) - Number(prev[k]) : null,
      dFirst: last && first && first !== last ? Number(last[k]) - Number(first[k]) : null,
    }
  })

  return (
    <>
      {loading && <p className="hint">Cargando...</p>}
      <p className="hint" style={{ marginTop: 0 }}>Mide cada 2 a 4 semanas, a la misma hora y en las mismas condiciones.</p>

      <div className="hscroll in">
        {info.map(i => (
          <div className="mcard" key={i.k}>
            <small>{i.label}</small>
            <b>{i.last ? `${i.last[i.k]}` : '–'}<span> cm</span></b>
            <small>{i.last ? `Medido: ${fmtDate(i.last.measured_at)}` : 'Sin registro'}</small>
            {i.dPrev !== null && <span className="pill">{arrow(i.dPrev)} cm vs anterior</span>}
            {i.dFirst !== null && <small>{arrow(i.dFirst)} cm desde el inicio</small>}
            {hint(i.k, i.dPrev) && <small className="mhint">{hint(i.k, i.dPrev)}</small>}
          </div>
        ))}
      </div>

      <div className="pbox">
        <h4 className="ph">Registrar medidas</h4>
        <label><span className="hint">Fecha</span><input type="date" max={today()} value={date} onChange={e => e.target.value && setDate(e.target.value)} /></label>
        <div className="mgrid">
          {MFIELDS.map(([k, label]) => (
            <label key={k}><span className="hint">{label} (cm)</span>
              <input type="number" inputMode="decimal" placeholder="–" value={vals[k]} onChange={e => setVals(v => ({ ...v, [k]: e.target.value }))} /></label>
          ))}
        </div>
        <p className="hint" style={{ margin: '.2rem 0' }}>Puedes dejar vacías las que no midas hoy.</p>
        {msg && <p className={msg.ok ? 'hint' : 'error'}>{msg.t}</p>}
        <button className="btn primary" disabled={busy} onClick={save}>{busy ? 'Guardando…' : 'Guardar medidas'}</button>
        <button className="link" onClick={() => setHelp(h => !h)}>{help ? 'Ocultar cómo medir' : '¿Cómo medir?'}</button>
        {help && (
          <div className="hint">
            <p>• <b>Brazo:</b> parte más ancha del bíceps, relajado.</p>
            <p>• <b>Pierna:</b> parte más ancha del muslo.</p>
            <p>• <b>Cintura:</b> a la altura del ombligo, sin meter el abdomen.</p>
            <p>• <b>Cadera:</b> parte más ancha de los glúteos.</p>
            <p>• <b>Pecho:</b> a la altura de los pezones, con los brazos relajados.</p>
            <p>Usa una cinta flexible, sin apretar, y mide siempre el mismo lado.</p>
          </div>
        )}
      </div>

      <h4 className="ph" style={{ marginTop: '1rem' }}>Historial</h4>
      {meas.length === 0 && <p className="hint">Aún no hay medidas registradas.</p>}
      {[...meas].reverse().slice(0, 8).map((r: MRow) => (
        <div className="mhist" key={r.id}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <b>{fmtDate(r.measured_at)}</b>
            <small className="hint" style={{ display: 'block' }}>
              {MFIELDS.filter(([k]) => r[k] !== null).map(([k, l]) => `${l} ${r[k]}`).join(' · ')}
            </small>
          </div>
          <button className="mini-ic" onClick={() => remove(r.id)} aria-label="Eliminar"><Icon name="trash" size={16} /></button>
        </div>
      ))}
    </>
  )
}