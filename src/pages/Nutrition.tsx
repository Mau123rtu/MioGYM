import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { calcAge, calcBMI } from '../lib/utils'
import type { Answers } from '../lib/questionnaires'
import { PHASES, buildPlan, type NPlan, type Opt, type Phase } from '../lib/nutritionPlan'
import Icon from '../components/Icons'
import MealPhoto from './MealPhoto'
import MealReminders from '../components/MealReminders'
import { VERDICT_LABEL, type VerdictKind } from '../lib/foodDb'

interface Entry {
  id: number; logged_at: string; meal: string; description: string
  calories: number | null; protein_g: number | null
  photo_path: string | null; verdict: VerdictKind | null; source: string | null
}

const MEALS: [string, string][] = [['desayuno', 'Desayuno'], ['comida', 'Comida'], ['colacion', 'Colación'], ['cena', 'Cena']]
const MEAL_LABEL = Object.fromEntries(MEALS)
const todayKey = () => new Date().toLocaleDateString('en-CA')
const hhmm = (iso: string) => new Date(iso).toTimeString().slice(0, 5)
const nowHHMM = () => new Date().toTimeString().slice(0, 5)

export default function Nutrition({ a }: { a: Answers }) {
  const { profile, session } = useAuth()
  const age = calcAge(profile?.birth_date ?? null)
  const bmi = calcBMI(profile?.weight_kg, profile?.height_cm)

  const [tab, setTab] = useState<'hoy' | 'plan' | 'consejos' | 'avisos'>('hoy')
  const [plan, setPlan] = useState<NPlan | null>(null)
  const [picking, setPicking] = useState(false)
  const [choice, setChoice] = useState<Phase | null>(null)
  const [noCount, setNoCount] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [toast, setToast] = useState('')

  const [day, setDay] = useState(todayKey())
  const [entries, setEntries] = useState<Entry[]>([])
  const [showForm, setShowForm] = useState(false)
  const [meal, setMeal] = useState('desayuno')
  const [time, setTime] = useState(nowHHMM())
  const [desc, setDesc] = useState('')
  const [kcal, setKcal] = useState('')
  const [prot, setProt] = useState('')
  const [photoOpen, setPhotoOpen] = useState(false)
  const [urls, setUrls] = useState<Record<string, string>>({})

  useEffect(() => {
    supabase.from('nutrition_plans').select('plan').maybeSingle().then(({ data }) => setPlan((data?.plan as NPlan) ?? null))
  }, [])

  const loadDay = async (d = day) => {
    const s = new Date(`${d}T00:00:00`)
    const e = new Date(s); e.setDate(e.getDate() + 1)
    const { data } = await supabase.from('food_logs').select('*')
      .gte('logged_at', s.toISOString()).lt('logged_at', e.toISOString()).order('logged_at', { ascending: true })
    setEntries((data as Entry[]) ?? [])
  }
  useEffect(() => { loadDay() }, [day])

  const shift = (n: number) => {
    const d = new Date(`${day}T12:00:00`); d.setDate(d.getDate() + n)
    const k = d.toLocaleDateString('en-CA')
    if (k <= todayKey()) setDay(k)
  }

    useEffect(() => {
    const paths = entries.map(e => e.photo_path).filter(Boolean) as string[]
    if (!paths.length) { setUrls({}); return }
    supabase.storage.from('meal-photos').createSignedUrls(paths, 3600).then(({ data }) => {
      const m: Record<string, string> = {}
      data?.forEach(d => { if (d.path && d.signedUrl) m[d.path] = d.signedUrl })
      setUrls(m)
    })
  }, [entries])

  const addEntry = async (row: { meal: string; description: string; calories: number | null; protein_g: number | null; at: Date }) => {
    const { error } = await supabase.from('food_logs').insert({
      user_id: session!.user.id, meal: row.meal, description: row.description,
      calories: row.calories, protein_g: row.protein_g, logged_at: row.at.toISOString(),
    })
    if (error) { setErr(error.message); return false }
    return true
  }

  const saveManual = async () => {
    if (!desc.trim()) return
    const ok = await addEntry({
      meal, description: desc.trim(), at: new Date(`${day}T${time}`),
      calories: kcal ? Math.round(Number(kcal)) : null, protein_g: prot ? Number(prot) : null,
    })
    if (!ok) return
    setDesc(''); setKcal(''); setProt(''); setShowForm(false); setErr('')
    loadDay()
  }

  const eaten = async (slot: string, o: Opt) => {
    const ok = await addEntry({
      meal: slot, at: new Date(), calories: o.kcal, protein_g: o.p,
      description: `${o.n}${o.mult !== 1 ? ` (porción ×${o.mult})` : ''}`,
    })
    if (!ok) return
    setToast('Anotada en tu registro de hoy')
    setTimeout(() => setToast(''), 2500)
    if (day === todayKey()) loadDay(); else setDay(todayKey())
  }

    const remove = async (e: Entry) => {
    if (e.photo_path) await supabase.storage.from('meal-photos').remove([e.photo_path])
    await supabase.from('food_logs').delete().eq('id', e.id)
    loadDay()
  }

  /* ---- Reglas de seguridad ---- */
  const minor = age !== null && age < 18
  const lowBmi = bmi !== null && bmi.value < 18.5
  const restricted = minor || a.condicion === 'si' || noCount || lowBmi
  const reason = minor ? 'Al ser menor de edad solo ofrecemos mantenimiento.'
    : a.condicion === 'si' ? 'Indicaste una condición o indicación profesional: no ofrecemos déficit sin su supervisión.'
    : lowBmi ? 'Tu IMC está por debajo de lo recomendado: no ofrecemos déficit.'
    : noCount ? 'No ofrecemos déficit si prefieres evitar objetivos de calorías.' : ''
  const allowed = (p: Phase) => (minor ? p === 'mantener' : restricted ? !PHASES[p].restrictive : true)

  const make = async (phase: Phase, seed: number) => {
    if (!profile) return
    const p = buildPlan({ profile, a, phase, seed })
    if (!p) { setErr('Para calcular necesitamos tu peso, altura y fecha de nacimiento.'); return }
    setBusy(true); setErr('')
    const { error } = await supabase.from('nutrition_plans').upsert(
      { user_id: session!.user.id, plan: p, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    setBusy(false)
    if (error) { setErr(error.message); return }
    setPlan(p); setPicking(false); setTab('plan'); window.scrollTo(0, 0)
  }

  const totalK = entries.reduce((s, e) => s + (e.calories ?? 0), 0)
  const totalP = entries.reduce((s, e) => s + Number(e.protein_g ?? 0), 0)


    if (photoOpen) {
    const h = new Date().getHours()
    return (
      <MealPhoto day={day} phase={plan?.phase}
        defaultMeal={h < 11 ? 'desayuno' : h < 16 ? 'comida' : h < 18 ? 'colacion' : 'cena'}
        onClose={() => setPhotoOpen(false)}
        onSaved={() => { setPhotoOpen(false); setToast('Comida guardada en tu registro'); setTimeout(() => setToast(''), 2500); loadDay() }} />
    )
  }

  /* ---- Pregunta de etapa ---- */
  if (picking) return (
    <>
      <button className="back" onClick={() => setPicking(false)}>← Nutrición</button>
      <h2>¿En qué etapa estás?</h2>
      <p className="hint">Elige tu objetivo del momento. Con esto calculamos tus calorías y proteínas, y armamos tus comidas con horarios.</p>

      <div className="options">
        {(Object.keys(PHASES) as Phase[]).map(p => {
          const ok = allowed(p)
          return (
            <button key={p} disabled={!ok} className={`option${choice === p ? ' selected' : ''}`} style={!ok ? { opacity: .4, cursor: 'not-allowed' } : undefined}
              onClick={() => setChoice(p)}>
              <b>{PHASES[p].label}</b>
              <small className="hint" style={{ display: 'block' }}>{PHASES[p].desc}</small>
            </button>
          )
        })}
      </div>
      {reason && <div className="warn">{reason}</div>}

      <label className="chkline">
        <input type="checkbox" checked={noCount} onChange={e => { setNoCount(e.target.checked); setChoice(null) }} />
        <span>Tengo o tuve un trastorno de la conducta alimentaria, o prefiero evitar objetivos de déficit.</span>
      </label>
      <p className="hint">Si tienes antecedentes de trastorno alimentario, evita el déficit calórico sin acompañamiento de un profesional.</p>

      {err && <p className="error">{err}</p>}
      <button className="btn primary" disabled={!choice || busy} onClick={() => choice && make(choice, 0)}>
        {busy ? 'Calculando…' : 'Crear mis recomendaciones'}
      </button>
    </>
  )

  return (
    <>
      {minor && <div className="warn">Eres menor de edad: no aplicamos objetivos restrictivos de calorías. Consulta con un profesional de salud o nutrición.</div>}
      {a.condicion === 'si' && <div className="warn">Indicaste una condición o indicación profesional. Sigue siempre esa indicación; estas sugerencias son generales.</div>}
      {a.alergias === 'si' && <div className="urgent"><b>{a.alergias_tipo === 'alergia' ? 'Alergia' : a.alergias_tipo === 'intolerancia' ? 'Intolerancia' : 'Preferencia'}:</b> {a.alergias_detalle || 'sin detalle'}. {a.alergias_tipo === 'alergia' && 'Revisa siempre las etiquetas.'}</div>}

            <div className="tabs t4">
        <button className={tab === 'hoy' ? 'on' : ''} onClick={() => setTab('hoy')}>Hoy</button>
        <button className={tab === 'plan' ? 'on' : ''} onClick={() => setTab('plan')}>Plan</button>
        <button className={tab === 'consejos' ? 'on' : ''} onClick={() => setTab('consejos')}>Consejos</button>
        <button className={tab === 'avisos' ? 'on' : ''} onClick={() => setTab('avisos')}>Avisos</button>
      </div>
      {toast && <div className="okbox">{toast}</div>}

      {/* ---------- HOY ---------- */}
      {tab === 'hoy' && (
        <>
          <div className="cal-head" style={{ margin: '.2rem 0 .6rem' }}>
            <button onClick={() => shift(-1)} aria-label="Día anterior">‹</button>
            <b style={{ textTransform: 'capitalize' }}>
              {day === todayKey() ? 'Hoy' : new Date(`${day}T12:00:00`).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'short' })}
            </b>
            <button onClick={() => shift(1)} aria-label="Día siguiente" disabled={day >= todayKey()}>›</button>
          </div>

          <div className="card">
            <div className="nrow"><span>Calorías</span><b>{totalK}{plan ? ` / ${plan.kcal}` : ''} kcal</b></div>
            {plan && <div className="hbar"><i style={{ width: `${Math.min(100, (totalK / plan.kcal) * 100)}%` }} /></div>}
            <div className="nrow" style={{ marginTop: '.8rem' }}><span>Proteína</span><b>{Math.round(totalP)}{plan ? ` / ${plan.p}` : ''} g</b></div>
            {plan && <div className="hbar"><i style={{ width: `${Math.min(100, (totalP / plan.p) * 100)}%` }} /></div>}
            {!plan && <p className="hint" style={{ margin: '.8rem 0 0' }}>Crea tus recomendaciones en la pestaña Plan para ver tu meta diaria.</p>}
          </div>

          {entries.length === 0 && <div className="card"><p className="hint" style={{ margin: 0 }}>Aún no anotaste comidas este día.</p></div>}
                    {entries.map(e => (
            <div className="card entry" key={e.id}>
              {e.photo_path && urls[e.photo_path]
                ? <a href={urls[e.photo_path]} target="_blank" rel="noreferrer"><img className="ethumb" src={urls[e.photo_path]} alt="Foto de la comida" /></a>
                : <div className="etime"><b>{hhmm(e.logged_at)}</b><small>{MEAL_LABEL[e.meal]}</small></div>}
              <div style={{ flex: 1, minWidth: 0 }}>
                {e.photo_path && <small className="hint">{hhmm(e.logged_at)} · {MEAL_LABEL[e.meal]}</small>}
                <p style={{ margin: 0 }}>{e.description}</p>
                {(e.calories !== null || e.protein_g !== null) && (
                  <small className="hint">{e.calories !== null && `${e.calories} kcal`}{e.calories !== null && e.protein_g !== null && ' · '}{e.protein_g !== null && `${e.protein_g} g proteína`}{e.source && e.source !== 'manual' && ' (estimado)'}</small>
                )}
                {e.verdict && <span className={`pill v-${e.verdict}`} style={{ display: 'inline-block', marginTop: '.3rem' }}>{VERDICT_LABEL[e.verdict]}</span>}
              </div>
              <button className="mini-ic" onClick={() => remove(e)} aria-label="Eliminar"><Icon name="trash" size={16} /></button>
            </div>
          ))}

          {showForm ? (
            <div className="card">
              <h3>Anotar comida</h3>
              <div className="row">
                <select value={meal} onChange={e => setMeal(e.target.value)}>
                  {MEALS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <input type="time" value={time} onChange={e => setTime(e.target.value)} />
              </div>
              <input placeholder="¿Qué comiste? (ej. 2 huevos con frijoles)" value={desc} onChange={e => setDesc(e.target.value)} />
              <div className="row">
                <input type="number" inputMode="numeric" placeholder="Calorías (opcional)" value={kcal} onChange={e => setKcal(e.target.value)} />
                <input type="number" inputMode="decimal" placeholder="Proteína g (opcional)" value={prot} onChange={e => setProt(e.target.value)} />
              </div>
              {err && <p className="error">{err}</p>}
              <button className="btn primary" disabled={!desc.trim()} onClick={saveManual}>Guardar</button>
              <button className="link" onClick={() => setShowForm(false)}>Cancelar</button>
            </div>
          ) : (
                <div className="row">
              <button className="btn primary" onClick={() => { setTime(nowHHMM()); setShowForm(true) }}><Icon name="plus" size={16} /> Anotar</button>
              <button className="btn" onClick={() => setPhotoOpen(true)}><Icon name="camera" size={16} /> Foto de mi comida</button>
            </div>
          )}
        </>
      )}

      {/* ---------- PLAN ---------- */}
      {tab === 'plan' && (!plan ? (
        <div className="card" style={{ textAlign: 'center' }}>
          <h3>Tus comidas y horarios</h3>
          <p className="hint">Calculamos tus calorías y proteínas según tu peso y tu objetivo, y te proponemos qué comer y a qué hora.</p>
          <button className="btn primary" onClick={() => { setChoice(null); setPicking(true) }}>Crear recomendaciones de comida</button>
        </div>
      ) : (
        <>
          <div className="card grad">
            <b>{PHASES[plan.phase].label}</b>
            <p style={{ margin: '.2rem 0 0', fontSize: '.88rem' }}>{PHASES[plan.phase].desc}</p>
          </div>
          {plan.warnings.map((w, i) => <div key={i} className="warn">{w}</div>)}

          <div className="stats" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
            <div className="stat"><b>{plan.kcal}</b><small>kcal</small></div>
            <div className="stat"><b>{plan.p}g</b><small>Proteína</small></div>
            <div className="stat"><b>{plan.c}g</b><small>Carbos</small></div>
            <div className="stat"><b>{plan.fat}g</b><small>Grasa</small></div>
          </div>
          <p className="hint">Según tu peso actual ({plan.weight} kg{bmi ? ` · IMC ${bmi.value}` : ''}), tu gasto estimado es de unas {plan.tdee} kcal al día.</p>

          <h3 className="sec-t">Comidas y horarios</h3>
          <div className="hscroll">
            {plan.meals.map(m => (
              <div className="mealc" key={m.k}>
                <small className="wk">{m.time} h</small>
                <h3>{m.label}</h3>
                <p className="hint" style={{ margin: 0 }}>Meta: unas {m.target} kcal</p>
                {m.options.length === 0 && <p className="hint">No encontramos opciones compatibles con tus preferencias y alergias.</p>}
                {m.options.map(o => (
                  <div className="nopt" key={o.n}>
                    <b>{o.n}</b>
                    {o.mult !== 1 && <small className="hint">Porción ×{o.mult}</small>}
                    <div className="macros">
                      <span><b>{o.kcal}</b> kcal</span><span><b>{o.p}</b> g prot</span>
                      <span><b>{o.c}</b> g carb</span><span><b>{o.fat}</b> g grasa</span>
                    </div>
                    <button className="qbtn" onClick={() => eaten(m.slot, o)}><Icon name="check" size={16} />Lo comí</button>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <button className="btn" disabled={busy} onClick={() => make(plan.phase, plan.seed + 1)}><Icon name="swap" size={16} /> Otras opciones</button>
          <button className="btn" onClick={() => { setChoice(null); setPicking(true) }}>Cambiar etapa</button>

          <div className="card">
            <h3>Recomendaciones</h3>
            {plan.tips.map((t, i) => <p key={i} className="hint">• {t}</p>)}
          </div>
          <p className="hint">Son estimaciones generales y no sustituyen la valoración de un nutriólogo o dietista.</p>
        </>
      ))}

      {/* ---------- CONSEJOS ---------- */}
      {tab === 'consejos' && <Tips a={a} />}
    {tab === 'avisos' && <MealReminders plan={plan} />}

      <button className="btn" onClick={() => { window.location.assign('/app/nutricion/perfil') }}>Editar mis respuestas</button>
    </>
  )
}

function Tips({ a }: { a: Answers }) {
  const meals: Record<string, string> = {
    '1-2': 'Con pocas comidas, haz que cada una sea completa: proteína, carbohidrato, verduras y una grasa saludable.',
    '3': 'Desayuno, comida y cena, cada una con una porción de proteína y verduras.',
    '4': 'Tres comidas principales y una colación con proteína (yogur, huevo, fruta con nueces).',
    '5+': 'Reparte la comida en porciones moderadas y procura proteína en la mayoría de ellas.',
    variable: 'Como tu horario cambia, define 2 o 3 comidas "ancla" que sí puedas cuidar cada día.',
  }
  const time: Record<string, string> = {
    '<15': 'Opciones rápidas: omelette con verduras, bowl de atún, yogur con avena y fruta.',
    '15-30': 'Salteados, tacos de pollo o pescado a la plancha con ensalada, pasta integral con legumbres.',
    '>30': 'Tienes margen para guisos, hornear verduras y cocinar legumbres.',
    lotes: 'Cocina por lotes: arroz, legumbres y proteína para 3–4 días, y guárdalo en porciones.',
    fuera: 'Fuera de casa, elige platos a la plancha o al horno, con verdura, y pide aderezos aparte.',
  }
  return (
    <>
      <div className="card"><h3>Distribución de comidas</h3><p>{meals[a.comidas]}</p></div>
      <div className="card"><h3>Preparación</h3><p>{time[a.tiempo]}</p></div>
      <div className="card"><h3>Hidratación</h3>
        <p>Tu estimación actual: {({ '<1': 'menos de 1 L', '1-2': '1 a 2 L', '2-3': '2 a 3 L', '>3': 'más de 3 L', nose: 'no lo sabes' } as Record<string, string>)[a.agua]}. Bebe a lo largo del día y activa el recordatorio de agua en Más → Cuenta.</p></div>
      {a.presupuesto === 'cantidad' && <div className="card"><h3>Presupuesto</h3><p>{a.pres_monto} {a.pres_moneda} ({a.pres_periodo}) para {a.pres_personas || 1} persona(s). Legumbres, huevo, avena, arroz y verdura de temporada rinden mucho.</p></div>}
    </>
  )
}