import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { CONFIGS, toArr, type Answers, type Q } from '../lib/questionnaires'
import { regenerateRoutine } from '../lib/routine'

export default function Questionnaire() {
  const { module = '' } = useParams()
  const cfg = CONFIGS[module]
  const { profile, session } = useAuth()
  const navigate = useNavigate()
  const [answers, setAnswers] = useState<Answers>({})
  const [i, setI] = useState(0)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!cfg) return
    supabase.from('module_profiles').select('answers').eq('module', cfg.db).maybeSingle().then(({ data }) => {
      setAnswers({ ...(cfg.defaults?.(profile) ?? {}), ...(data?.answers ?? {}) })
      setReady(true)
    })
  }, [module])

  if (!cfg) return <p className="center">Módulo no encontrado</p>
  if (!ready) return <p className="center">Cargando...</p>

  const visible = cfg.questions.filter(q => !q.showIf || q.showIf(answers))
  const idx = Math.min(i, visible.length - 1)
  const q = visible[idx]
  const last = idx === visible.length - 1

  const set = (k: string, v: any) => setAnswers(a => ({ ...a, [k]: v }))
  const toggle = (q: Q, v: string) => {
    const cur = toArr(answers[q.id])
    let nx: string[]
    if (v === q.exclusive) nx = [v]
    else {
      const base = cur.filter(x => x !== q.exclusive)
      nx = base.includes(v) ? base.filter(x => x !== v) : [...base, v]
    }
    set(q.id, nx)
  }
  const canNext = q.type === 'confirm' || q.type === 'text' ? true
    : q.type === 'single' ? !!answers[q.id] : toArr(answers[q.id]).length > 0

  const finish = async () => {
    setBusy(true); setError('')
    try {
      const uid = session!.user.id
      const { error } = await supabase.from('module_profiles')
        .upsert({ user_id: uid, module: cfg.db, answers, updated_at: new Date().toISOString() }, { onConflict: 'user_id,module' })
      if (error) throw error
      if (cfg.db === 'rutinas' || cfg.db === 'lesiones') await regenerateRoutine(uid, profile)
      navigate(`/app/${cfg.slug}`, { replace: true })
    } catch (e: any) {
      setError(e.message ?? 'No se pudo guardar')
    } finally { setBusy(false) }
  }

  const showFollow = (q.follow ?? []).filter(f => f.when.some(w => toArr(answers[q.id]).includes(w)))
  const hint = q.hintFn ? q.hintFn(profile) : q.hint

  return (
    <div className="wizard">
      <div className="progress"><div style={{ width: `${((idx + 1) / visible.length) * 100}%` }} /></div>
      <p className="hint">{cfg.title} · {idx + 1} de {visible.length}</p>
      <h2>{q.title}</h2>
      {hint && <p className="hint">{hint}</p>}

      {q.type === 'confirm' && (
        <div className="card">
          <p>Nivel: <b>{profile?.experience}</b></p>
          <p>Días por semana: <b>{profile?.days_per_week}</b></p>
          <p>Lugar: <b>{profile?.training_place}</b></p>
        </div>
      )}

      {(q.type === 'single' || q.type === 'multi') && (
        <div className="options">
          {q.options!.map(([v, label]) => {
            const sel = q.type === 'single' ? answers[q.id] === v : toArr(answers[q.id]).includes(v)
            return (
              <button key={v} type="button" className={sel ? 'option selected' : 'option'}
                onClick={() => (q.type === 'single' ? set(q.id, v) : toggle(q, v))}>{label}</button>
            )
          })}
        </div>
      )}

      {q.type === 'text' && (
        <textarea placeholder={q.placeholder} value={answers[q.id] ?? ''} onChange={e => set(q.id, e.target.value)} />
      )}

      {showFollow.map(f => f.kind === 'text' ? (
        <label key={f.id}><span className="hint">{f.label}</span>
          <input value={answers[f.id] ?? ''} onChange={e => set(f.id, e.target.value)} /></label>
      ) : (
        <label key={f.id}><span className="hint">{f.label}</span>
          <select value={answers[f.id] ?? ''} onChange={e => set(f.id, e.target.value)}>
            <option value="">Selecciona…</option>
            {f.options!.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select></label>
      ))}

      {error && <p className="error">{error}</p>}
      <button className="btn primary" disabled={!canNext || busy} onClick={last ? finish : () => setI(idx + 1)}>
        {busy ? 'Guardando...' : last ? 'Finalizar' : 'Siguiente'}
      </button>
      {idx > 0 ? <button className="link" onClick={() => setI(idx - 1)}>Atrás</button>
        : <button className="link" onClick={() => navigate(-1)}>Cancelar</button>}
    </div>
  )
}