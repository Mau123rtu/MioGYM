import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Icon from '../components/Icons'
import { CATALOG, planFromDays, savePlan, type G, type PlanDay, type PlanExercise } from '../lib/routine'
import { recommend, type Tip } from '../lib/recommend'
import { generateAi, swapExercise, type AiResult } from '../lib/aiRoutine'
import { toArr, type Answers } from '../lib/questionnaires'
import History from './History'
import { BodyPicker } from '../components/Body'


const MUSCLE: Record<G, string> = {
  pecho: 'Pecho', espalda: 'Espalda', hombros: 'Hombros',
  brazos: 'Bíceps y tríceps', piernas: 'Piernas y glúteos', abdomen: 'Abdomen',
}
const EQ: Record<string, string> = {
  maquinas: 'Máquina', libres: 'Mancuernas / barra', poleas: 'Polea', bandas: 'Banda', corporal: 'Peso corporal',
}
const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

interface Saved { id: number; name: string; source: string; exercises: PlanExercise[] }

const defaults = (name: string): PlanExercise => {
  const g = CATALOG.find(e => e.n === name)?.g
  return {
    name, sets: 3,
    reps: g === 'abdomen' ? '30–45 s / 12–20' : '8–12',
    rest: g === 'abdomen' ? 45 : g && ['piernas', 'espalda', 'pecho'].includes(g) ? 90 : 60,
  }
}
const groupsOf = (exs: PlanExercise[]) =>
  Array.from(new Set(exs.map(e => CATALOG.find(c => c.n === e.name)?.g).filter(Boolean) as G[]))

async function blockedZones(): Promise<Set<string>> {
  const { data } = await supabase.from('module_profiles').select('answers').eq('module', 'lesiones').maybeSingle()
  const a = data?.answers as Answers | undefined
  return new Set(a?.dolor === 'si' ? toArr(a.zonas) : [])
}

function TipList({ tips }: { tips: Tip[] }) {
  return <>{tips.map((t, i) => (
    <div key={i} className={t.kind === 'warn' ? 'urgent' : t.kind === 'tip' ? 'warn' : 'okbox'}>{t.text}</div>
  ))}</>
}



/* ---------- Crear / editar rutina ---------- */
function Builder({ initial, onCancel, onSaved }: { initial: Saved | null; onCancel: () => void; onSaved: (r: Saved) => void }) {
  const { session } = useAuth()
  const [name, setName] = useState(initial?.name ?? '')
  const [sel, setSel] = useState<PlanExercise[]>(initial?.exercises ?? [])
  const [group, setGroup] = useState<G | null>(null)
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const results = useMemo(() => CATALOG.filter(e =>
    (!group || e.g === group) &&
    (!q.trim() || norm(`${e.n} ${MUSCLE[e.g]} ${EQ[e.eq[0]]}`).includes(norm(q)))
  ), [group, q])

  const has = (n: string) => sel.some(s => s.name === n)
  const toggle = (n: string) => setSel(s => (has(n) ? s.filter(x => x.name !== n) : [...s, defaults(n)]))
  const move = (i: number, d: number) => setSel(s => {
    const j = i + d
    if (j < 0 || j >= s.length) return s
    const c = [...s]
    ;[c[i], c[j]] = [c[j], c[i]]
    return c
  })

  const save = async () => {
    setBusy(true); setErr('')
    const nm = name.trim()
    const res = initial
      ? await supabase.from('custom_routines').update({ name: nm, exercises: sel }).eq('id', initial.id).select().single()
      : await supabase.from('custom_routines').insert({ user_id: session!.user.id, name: nm, exercises: sel, source: 'manual' }).select().single()
    setBusy(false)
    if (res.error) { setErr(res.error.message); return }
    onSaved(res.data as Saved)
  }

  return (
    <>
      <button className="back" onClick={onCancel}>← Biblioteca</button>
      <h2>{initial ? 'Editar rutina' : 'Crear rutina'}</h2>
      <input placeholder="Nombre de la rutina (ej. Pecho y hombro)" value={name} onChange={e => setName(e.target.value)} />
      <input placeholder="Buscar ejercicio o músculo…" value={q} onChange={e => setQ(e.target.value)} />

      <p className="hint" style={{ margin: '.6rem 0 0' }}>Toca un músculo para ver sus ejercicios</p>
      <BodyPicker value={group} onPick={setGroup} />
      {group && (
        <p style={{ margin: '.4rem 0' }}>
          <span className="tag">{MUSCLE[group]}</span>
          <button className="link" style={{ display: 'inline', width: 'auto', margin: '0 0 0 .5rem' }} onClick={() => setGroup(null)}>Quitar filtro</button>
        </p>
      )}

      {(group || q.trim()) ? (
        <div className="card" style={{ padding: '.2rem 1rem' }}>
          {results.length === 0 && <p className="hint">Sin resultados.</p>}
          {results.map(e => (
            <div className="exrow" key={e.n}>
              <div style={{ flex: 1 }}>
                <b>{e.n}</b>
                <small>{MUSCLE[e.g]} · {EQ[e.eq[0]]}</small>
              </div>
              <button className={`chk${has(e.n) ? ' on' : ''}`} onClick={() => toggle(e.n)} aria-label={has(e.n) ? 'Quitar' : 'Agregar'}>
                <Icon name={has(e.n) ? 'check' : 'plus'} size={18} />
              </button>
            </div>
          ))}
        </div>
      ) : <p className="hint">Elige un músculo en el muñeco o usa el buscador.</p>}

      <h3 style={{ marginTop: '1.2rem' }}>Tu rutina ({sel.length})</h3>
      {sel.length === 0 && <p className="hint">Aún no agregaste ejercicios.</p>}
      {sel.length > 0 && (
        <div className="card" style={{ padding: '.2rem 1rem' }}>
          {sel.map((s, i) => (
            <div className="exrow" key={s.name}>
              <span className="n">{i + 1}</span>
              <div style={{ flex: 1 }}><b>{s.name}</b><small>{s.sets} series × {s.reps}</small></div>
              <button className="mini-ic" onClick={() => move(i, -1)} aria-label="Subir"><Icon name="up" size={16} /></button>
              <button className="mini-ic" onClick={() => move(i, 1)} aria-label="Bajar"><Icon name="down" size={16} /></button>
              <button className="mini-ic" onClick={() => toggle(s.name)} aria-label="Quitar"><Icon name="x" size={16} /></button>
            </div>
          ))}
        </div>
      )}

      {err && <p className="error">{err}</p>}
      <button className="btn primary" disabled={!name.trim() || sel.length === 0 || busy} onClick={save}>
        {busy ? 'Guardando...' : initial ? 'Guardar cambios' : 'Crear rutina'}
      </button>
    </>
  )
}

/* ---------- Biblioteca ---------- */
export function Library({ onBack, onStart }: { onBack: () => void; onStart: (d: PlanDay) => void }) {
  const [items, setItems] = useState<Saved[] | null>(null)
  const [mode, setMode] = useState<'list' | 'build'>('list')
  const [editing, setEditing] = useState<Saved | null>(null)
  const [open, setOpen] = useState<number | null>(null)
  const [recs, setRecs] = useState<{ row: Saved; tips: Tip[] } | null>(null)
  const [tab, setTab] = useState<'rutinas' | 'historial'>('rutinas')

  const load = async () => {
    const { data } = await supabase.from('custom_routines').select('*').order('created_at', { ascending: false })
    setItems((data as Saved[]) ?? [])
  }
  useEffect(() => { load() }, [])

  const remove = async (id: number) => {
    if (!window.confirm('¿Eliminar esta rutina?')) return
    await supabase.from('custom_routines').delete().eq('id', id)
    load()
  }
  const toDay = (r: Saved): PlanDay => ({ weekday: 'Biblioteca', name: `Biblioteca · ${r.name}`, rest: false, exercises: r.exercises })

  if (mode === 'build') return (
    <Builder
      initial={editing}
      onCancel={() => { setMode('list'); setEditing(null) }}
      onSaved={async row => {
        const tips = recommend(row.exercises, await blockedZones())
        setRecs({ row, tips }); setMode('list'); setEditing(null); load(); window.scrollTo(0, 0)
      }}
    />
  )

  if (recs) return (
    <>
      <h2>Rutina guardada</h2>
      <p className="hint">"{recs.row.name}" ya está en tu biblioteca. Estas son nuestras recomendaciones; tú decides si las sigues.</p>
      <TipList tips={recs.tips} />
      <button className="btn primary" onClick={() => setRecs(null)}>Seguir con mi rutina tal cual</button>
      <button className="btn" onClick={() => { setEditing(recs.row); setRecs(null); setMode('build') }}>Editar según las recomendaciones</button>
    </>
  )

  return (
    <>
      <button className="back" onClick={onBack}>← Tu plan</button>
      <h2>Biblioteca</h2>
      <div className="tabs">
        <button className={tab === 'rutinas' ? 'on' : ''} onClick={() => setTab('rutinas')}>Mis rutinas</button>
        <button className={tab === 'historial' ? 'on' : ''} onClick={() => setTab('historial')}>Historial</button>
      </div>

      {tab === 'historial' ? <History /> : (
        <>
          {items === null && <p className="center">Cargando...</p>}
          {items?.length === 0 && <div className="card"><p className="hint" style={{ margin: 0 }}>Todavía no tienes rutinas. Crea la primera con el botón de abajo.</p></div>}

          {items?.map(r => (
            <div className="card" key={r.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '.6rem' }}>
                <div style={{ minWidth: 0 }}>
                  <h3 style={{ margin: 0 }}>{r.name.replace(/^IA · /, '')}{r.source === 'ia' && <span className="badge" style={{ marginLeft: '.5rem' }}>IA</span>}</h3>
                  <p className="hint" style={{ margin: '.2rem 0 0' }}>{r.exercises.length} ejercicios</p>
                </div>
                <button className="btn-ver" onClick={() => onStart(toDay(r))}>Empezar</button>
              </div>
              <div>{groupsOf(r.exercises).map(g => <span className="tag" key={g}>{MUSCLE[g]}</span>)}</div>

              {open === r.id && (
                <div style={{ marginTop: '.6rem' }}>
                  {r.exercises.map((e, i) => (
                    <div className="exrow" key={e.name}>
                      <span className="n">{i + 1}</span>
                      <div><b>{e.name}</b><small>{e.sets} series × {e.reps}</small></div>
                    </div>
                  ))}
                </div>
              )}

              <div className="qrow" style={{ marginTop: '.7rem' }}>
                <button className="qbtn" onClick={() => setOpen(open === r.id ? null : r.id)}>{open === r.id ? 'Ocultar' : 'Ver ejercicios'}</button>
                <button className="qbtn" onClick={() => { setEditing(r); setMode('build') }}><Icon name="pencil" size={16} />Editar</button>
                <button className="qbtn" onClick={() => remove(r.id)}><Icon name="trash" size={16} />Eliminar</button>
              </div>
            </div>
          ))}

          <button className="btn primary" onClick={() => { setEditing(null); setMode('build') }}>Crear rutina</button>
        </>
      )}
    </>
  )
}

/* ---------- Crear rutina con IA ---------- */
export function AiBuilder({ onBack, onSaved, onAdopted }: { onBack: () => void; onSaved: () => void; onAdopted: () => void }) {
  const { profile, session } = useAuth()
  const [rut, setRut] = useState<Answers | null>(null)
  const [inj, setInj] = useState<Answers | null>(null)
  const [ready, setReady] = useState(false)
  const [days, setDays] = useState(3)
  const [focus, setFocus] = useState<G[]>([])
  const [seed, setSeed] = useState(0)
  const [res, setRes] = useState<AiResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')

  useEffect(() => {
    supabase.from('module_profiles').select('module,answers').in('module', ['rutinas', 'lesiones']).then(({ data }) => {
      const r = data?.find(d => d.module === 'rutinas')?.answers ?? null
      setRut(r); setInj(data?.find(d => d.module === 'lesiones')?.answers ?? null)
      const exp = profile?.experience
      setDays(({ '1-2': 2, '3-4': exp === 'principiante' ? 3 : 4, '5-6': 5, '7': 6 } as Record<string, number>)[profile?.days_per_week ?? '3-4'] ?? 3)
      setFocus(toArr(r?.grupos).filter(g => g !== 'todo') as G[])
      setReady(true)
    })
  }, [])

  if (!ready) return <p className="center">Cargando...</p>

  const run = (s: number) => { if (profile) setRes(generateAi({ profile, rut, inj, days, focus, seed: s })); window.scrollTo(0, 0) }
  const toggleFocus = (g: G) => setFocus(f => (f.includes(g) ? f.filter(x => x !== g) : [...f, g]))

  const swap = (di: number, k: number) => {
    if (!res || !profile) return
    const d = res.days[di]
    const n = swapExercise({ profile, rut, inj, current: d.exercises[k].name, dayNames: d.exercises.map(e => e.name) })
    if (!n) { setMsg('No hay otro ejercicio compatible con tu equipo y tus molestias para reemplazarlo.'); return }
    setMsg('')
    setRes({ ...res, days: res.days.map((x, i) => i !== di ? x : { ...x, exercises: x.exercises.map((e, j) => j === k ? { ...e, name: n } : e) }) })
  }

  const adopt = async () => {
    if (!res) return
    if (!window.confirm('Esto reemplazará tu plan semanal por esta propuesta. Podrás volver al plan automático cuando quieras. ¿Continuar?')) return
    setBusy(true); setErr('')
    const { error } = await savePlan(session!.user.id, planFromDays(res.days, res.warnings))
    setBusy(false)
    if (error) setErr(error.message); else onAdopted()
  }

  const save = async () => {
    if (!res) return
    setBusy(true); setErr('')
    const rows = res.days.map(d => ({ user_id: session!.user.id, name: `IA · ${d.name}`, source: 'ia', exercises: d.exercises }))
    const { error } = await supabase.from('custom_routines').insert(rows)
    setBusy(false)
    if (error) setErr(error.message); else onSaved()
  }

  return (
    <>
      <button className="back" onClick={res ? () => setRes(null) : onBack}>← {res ? 'Ajustar opciones' : 'Tu plan'}</button>
      <h2>Crear rutina con IA</h2>

      {!res && (
        <>
          <p className="hint">Armamos una división realista con tu perfil, tu equipo y tus molestias. No se limita a un músculo por día: combina grupos y repite los más importantes.</p>
          <label><span className="hint">Días a la semana</span>
            <select value={days} onChange={e => setDays(Number(e.target.value))}>
              {[2, 3, 4, 5, 6].map(d => <option key={d} value={d}>{d} días</option>)}
            </select>
          </label>
          <p className="hint" style={{ marginBottom: 0 }}>Músculos a priorizar (opcional)</p>
          <div style={{ marginBottom: '.6rem' }}>
            {(Object.keys(MUSCLE) as G[]).map(g => (
              <button key={g} className={`chipbtn${focus.includes(g) ? ' on' : ''}`} onClick={() => toggleFocus(g)}>{MUSCLE[g]}</button>
            ))}
          </div>
          {!rut && <div className="warn">Aún no completaste tu perfil de rutinas; usaremos tu lugar de entrenamiento como referencia.</div>}
          <button className="btn primary" onClick={() => run(seed)}>Generar propuesta</button>
        </>
      )}

      {res?.stop && <div className="urgent">{res.stop}</div>}

      {res && !res.stop && (
        <>
          <div className="card grad"><p style={{ margin: 0 }}>{res.why}</p></div>
          {res.warnings.map((w, i) => <div key={i} className="warn">{w}</div>)}

          <h3>Frecuencia semanal</h3>
          <div style={{ marginBottom: '.6rem' }}>
            {(Object.keys(res.freq) as G[]).map(g => <span className="tag" key={g}>{MUSCLE[g]} · {res.freq[g]}×</span>)}
          </div>

          <p className="hint">Puedes cambiar cualquier ejercicio con <Icon name="swap" size={14} />. Mientras no pulses "Usar como mi plan semanal", esto es solo una propuesta y tu plan no cambia.</p>
          {msg && <div className="warn">{msg}</div>}

          {res.days.map((d, i) => (
            <div className="card" key={i}>
              <h3>{d.name}</h3>
              <div>{d.groups.map(g => <span className="tag" key={g}>{MUSCLE[g]}</span>)}</div>
              {d.exercises.map((e, k) => (
                <div className="exrow" key={`${e.name}-${k}`}>
                  <span className="n">{k + 1}</span>
                  <div style={{ flex: 1 }}><b>{e.name}</b><small>{e.sets} series × {e.reps} · descanso {e.rest} s</small></div>
                  <button className="mini-ic" onClick={() => swap(i, k)} aria-label="Cambiar ejercicio"><Icon name="swap" size={16} /></button>
                </div>
              ))}
            </div>
          ))}

          {err && <p className="error">{err}</p>}
          <button className="btn primary" disabled={busy} onClick={adopt}>Usar como mi plan semanal</button>
          <button className="btn" disabled={busy} onClick={save}>{busy ? 'Guardando...' : 'Guardar solo como propuesta en la biblioteca'}</button>
          <button className="btn" onClick={() => { const s = seed + 1; setSeed(s); run(s) }}>Generar otra variante</button>
          <p className="hint">Las cargas las eliges tú: usa un peso con el que te queden 2 o 3 repeticiones en reserva.</p>
        </>
      )}
    </>
  )
}