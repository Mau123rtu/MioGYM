import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { calcAge } from '../lib/utils'
import { toArr, type Answers } from '../lib/questionnaires'
import Icon from '../components/Icons'
import SupplementAdd from './SupplementAdd'
import { KINDS, LEVEL_LABEL, analyzeItem, dayCheck, timingTips, type Ctx, type Kind, type SuppItem, type SuppLog, type Tip } from '../lib/suppDb'
import { safeInsert } from '../lib/offline'

const TIMINGS: [string, string][] = [
  ['pre', 'Antes de entrenar'], ['durante', 'Durante el entreno'], ['post', 'Después de entrenar'],
  ['manana', 'Mañana'], ['tarde', 'Tarde'], ['noche', 'Noche'],
]
const TLABEL = Object.fromEntries(TIMINGS)
const nowHHMM = () => new Date().toTimeString().slice(0, 5)
const hhmm = (iso: string) => new Date(iso).toTimeString().slice(0, 5)
const defTiming = (k: Kind) =>
  ({ preentreno: 'pre', cafeina: 'pre', proteina: 'post', creatina: 'manana', carbohidratos: 'durante', magnesio: 'noche' } as Record<string, string>)[k]
  ?? (new Date().getHours() < 12 ? 'manana' : new Date().getHours() < 19 ? 'tarde' : 'noche')

function TipList({ tips }: { tips: Tip[] }) {
  return <>{tips.map((t, i) => <div key={i} className={t.kind === 'warn' ? 'urgent' : t.kind === 'tip' ? 'warn' : 'okbox'}>{t.text}</div>)}</>
}

/* ---------- Consejos ---------- */
const GOAL_TIP: Record<string, string> = {
  complementar: 'Quieres complementar tu alimentación: empieza por ver qué te falta en tu comida (proteína, verduras, grasas buenas) antes de comprar nada. Un suplemento completa, no reemplaza.',
  musculo: 'Para el desarrollo muscular, lo que más pesa es entrenar con progresión, comer suficiente proteína y dormir bien. De los suplementos, la creatina tiene la mejor evidencia y la proteína en polvo es una forma práctica de llegar a tu meta.',
  rendimiento: 'Para mejorar tu rendimiento, la creatina y la cafeína son las que más respaldo tienen. Usa cafeína solo si no afecta tu sueño y respeta el límite diario.',
  recuperacion: 'Para recuperarte, el sueño, la comida y los días de descanso valen más que cualquier producto. Si quieres apoyo extra, el magnesio por la noche o una buena ingesta de proteína suelen ser suficientes.',
  evidencia: 'Quieres conocer lo que tiene evidencia: en general, creatina, cafeína y proteína en polvo son las mejor estudiadas. Del resto, la evidencia es menor o depende de si tienes una deficiencia.',
  nose: 'No sabes cuáles podrían servirte, y es normal. Un buen punto de partida es no tomar nada hasta tener tu alimentación, entrenamiento y sueño en orden. Si algo falta, un médico o dietista puede orientarte según tu caso.',
}

function Advice({ a, ctx }: { a: Answers; ctx: Ctx }) {
  const info = toArr(a.info)
  const restr = toArr(a.restricciones)
  const minor = ctx.age !== null && ctx.age < 18
  const budget = ({ ninguno: 'Indicaste que no destinarás presupuesto a suplementos, y es una decisión válida: puedes lograr tus objetivos sin ellos.', bajo: 'Con un presupuesto bajo, prioriza una sola cosa: la creatina monohidratada suele ser la más barata y mejor respaldada. Evita las mezclas caras con muchos ingredientes.', moderado: 'Con un presupuesto moderado, compara el precio por porción y no por frasco. Las versiones simples (creatina monohidratada, proteína sin extras) suelen rendir más por tu dinero.', flexible: 'Con presupuesto flexible, no necesitas gastar más para obtener más: un producto caro no es mejor por serlo. Prioriza la calidad y la transparencia de la etiqueta.' } as Record<string, string>)[a.presupuesto]

  return (
    <>
      <div className="card"><h3>Primero lo básico</h3>
        <p className="hint" style={{ margin: 0 }}>Una buena alimentación, entrenamiento y sueño pesan mucho más que cualquier suplemento. No necesitas consumirlos para lograr tu objetivo.</p></div>

      {minor && <div className="warn">Al ser menor de edad, consulta con un médico antes de usar cualquier suplemento. Los estimulantes no se recomiendan.</div>}
      {a.medicacion === 'si' && <div className="warn">Indicaste medicamentos o una indicación médica. Antes de usar cualquier suplemento, consulta a tu médico o farmacéutico por posibles interacciones.</div>}

      <h3 className="sec-t">Para ti</h3>
      {GOAL_TIP[a.objetivo] && <div className="card"><h3>Tu objetivo</h3><p className="hint" style={{ margin: 0 }}>{GOAL_TIP[a.objetivo]}</p></div>}
      {budget && <div className="card"><h3>Tu presupuesto</h3><p className="hint" style={{ margin: 0 }}>{budget}{a.pres_monto ? ` Tu referencia: ${a.pres_monto}. Úsala para comparar precio por porción, no para decidir qué necesitas.` : ''}</p></div>}
      {restr.includes('vegano') && <div className="card"><h3>Sin ingredientes de origen animal</h3><p className="hint" style={{ margin: 0 }}>Busca proteína de chícharo, arroz o soya. La creatina suele ser sintética y apta para veganos, pero confirma la etiqueta. Evita cápsulas de gelatina y omega-3 de pescado; existe omega-3 de algas.</p></div>}
      {restr.includes('alergias') && <div className="urgent">Indicaste alergias{a.alergias_detalle ? ` (${a.alergias_detalle})` : ''}. Revisa siempre la lista de ingredientes y los avisos de alérgenos de cada producto: la leche, la soya y los frutos secos aparecen en muchos suplementos.</div>}
      {restr.includes('certificacion') && <div className="card"><h3>Certificación de calidad</h3><p className="hint" style={{ margin: 0 }}>Los sellos de laboratorios independientes (por ejemplo, para sustancias prohibidas en el deporte) dan más confianza de que el contenido coincide con la etiqueta. No garantizan que sea adecuado para todas las personas.</p></div>}

      {info.includes('dosis') && <div className="card"><h3>Dosis estudiadas</h3>
        <p className="hint">• Creatina: 3 a 5 g al día.</p><p className="hint">• Cafeína: hasta unos 3 mg por kg de peso por toma, y máximo 400 mg al día en adultos sanos.</p>
        <p className="hint">• Proteína: importa el total del día; una porción típica es de 20 a 30 g.</p><p className="hint" style={{ margin: 0 }}>• Omega-3: 1 a 2 g de EPA + DHA al día.</p></div>}
      {info.includes('riesgos') && <div className="card"><h3>Riesgos y contraindicaciones</h3>
        <p className="hint">• Estimulantes: evítalos con ansiedad, hipertensión, problemas del corazón, embarazo o menores de edad.</p>
        <p className="hint">• Vitaminas y minerales: tomar de más puede dañar.</p><p className="hint" style={{ margin: 0 }}>• Cualquier producto con medicación: consulta antes a tu médico o farmacéutico.</p></div>}
      {info.includes('precios') && <div className="card"><h3>Comparar precios</h3><p className="hint" style={{ margin: 0 }}>Divide el precio del envase entre el número de porciones para saber cuánto cuesta cada una. Compara siempre la misma cantidad del ingrediente activo (por ejemplo, gramos de proteína o de creatina por porción).</p></div>}

      {(info.includes('etiquetas') || info.length === 0) && <LabelGuide />}
    </>
  )
}

function LabelGuide() {
  return (
    <div className="card"><h3>Cómo leer una etiqueta</h3>
      <p className="hint">• Mira la <b>porción</b>: todas las cantidades son por porción, no por envase.</p>
      <p className="hint">• Revisa la <b>cantidad real</b> del ingrediente activo, no solo el nombre.</p>
      <p className="hint">• Desconfía de las <b>"mezclas propietarias"</b>: no dicen cuánto lleva de cada cosa.</p>
      <p className="hint">• Busca <b>alérgenos</b> y azúcares añadidos.</p>
      <p className="hint" style={{ margin: 0 }}>• Un sello de certificación independiente ayuda, pero no garantiza que sea adecuado para ti.</p></div>
  )
}

/* ---------- Detalle ---------- */
function Analysis({ item, ctx, onBack, onTake, onDelete }: {
  item: SuppItem; ctx: Ctx; onBack: () => void; onTake: () => void; onDelete: () => void
}) {
  const an = useMemo(() => analyzeItem(item, ctx), [item, ctx.age, ctx.medication])
  const [photo, setPhoto] = useState('')
  useEffect(() => {
    if (!item.photo_path) return
    supabase.storage.from('supplement-photos').createSignedUrl(item.photo_path, 3600).then(({ data }) => setPhoto(data?.signedUrl ?? ''))
  }, [item.photo_path])

  const head = an.verdict === 'ok' ? 'Adecuado para la mayoría de adultos sanos'
    : an.verdict === 'caution' ? 'Úsalo con las precauciones de abajo' : 'Lo más prudente es evitarlo'

  return (
    <>
      <button className="back" onClick={onBack}>← Suplementos</button>
      <p className="hint" style={{ margin: 0 }}>{an.K.label}{item.brand ? ` · ${item.brand}` : ''}</p>
      <h2>{item.name}</h2>
      {photo && <div className="mphoto"><img src={photo} alt="Etiqueta" /></div>}

      <div className={`vbox ${an.verdict}`}>
        <b>{LEVEL_LABEL[an.verdict]}</b><span>{head}</span>
      </div>

      <div className="card"><h3>Qué función cumple</h3><p style={{ margin: 0 }}>{an.K.fn}</p></div>

      {an.flags.length > 0 && (
        <div className="card">
          <h3>Qué encontramos y por qué</h3>
          {an.flags.map((f, i) => <p key={i} className={`hint flag-${f.level}`}>{f.level === 'avoid' ? '✕ ' : f.level === 'caution' ? '! ' : '• '}{f.text}</p>)}
          {an.positives.map((p, i) => <p key={`p${i}`} className="hint">✓ {p}</p>)}
        </div>
      )}

      <div className="card"><h3>Cuándo y cómo tomarlo</h3>{an.K.when.map((x, i) => <p key={i} className="hint">• {x}</p>)}</div>
      {an.K.pair.length > 0 && <div className="card"><h3>Con qué combinarlo</h3>{an.K.pair.map((x, i) => <p key={i} className="hint">• {x}</p>)}</div>}
      {an.K.avoid.length > 0 && <div className="card"><h3>Qué evitar</h3>{an.K.avoid.map((x, i) => <p key={i} className="hint">• {x}</p>)}</div>}

      {item.ingredients.length > 0 && (
        <div className="card">
          <h3>Ingredientes{item.serving ? ` (${item.serving})` : ' por porción'}</h3>
          {item.ingredients.map((i, k) => <p key={k} className="logrow"><span>{i.name}</span><b>{i.amount !== null ? `${i.amount} ${i.unit}` : '–'}</b></p>)}
        </div>
      )}

      <button className="btn primary" onClick={onTake}>Lo tomé</button>
      <button className="btn dlg-out" onClick={onDelete}><Icon name="trash" size={16} /> Eliminar suplemento</button>
      <p className="hint">Información educativa basada en reglas generales; no sustituye la orientación de un médico, farmacéutico o dietista.</p>
    </>
  )
}

/* ---------- Pantalla principal ---------- */
export default function Supplements({ a }: { a: Answers }) {
  const { profile, session } = useAuth()
  const age = calcAge(profile?.birth_date ?? null)
  const ctx: Ctx = { age, medication: a.medicacion === 'si' }

  const [tab, setTab] = useState<'hoy' | 'mis' | 'consejos'>('hoy')
  const [items, setItems] = useState<SuppItem[] | null>(null)
  const [logs, setLogs] = useState<SuppLog[]>([])
  const [screen, setScreen] = useState<{ t: 'add' } | { t: 'detail'; id: number } | null>(null)
  const [take, setTake] = useState<SuppItem | null>(null)
  const [tTiming, setTTiming] = useState('pre')
  const [tTime, setTTime] = useState(nowHHMM())
  const [tServ, setTServ] = useState('1')
  const [feedback, setFeedback] = useState<Tip[]>([])
  const [err, setErr] = useState('')

  const loadItems = async () => {
    const { data } = await supabase.from('supplement_items').select('*').order('created_at', { ascending: false })
    setItems((data as SuppItem[]) ?? [])
  }
  const loadLogs = async () => {
    const s = new Date(); s.setHours(0, 0, 0, 0)
    const e = new Date(s); e.setDate(e.getDate() + 1)
    const { data } = await supabase.from('supplement_logs').select('*')
      .gte('taken_at', s.toISOString()).lt('taken_at', e.toISOString()).order('taken_at', { ascending: true })
    setLogs((data as SuppLog[]) ?? [])
  }
  useEffect(() => { loadItems(); loadLogs() }, [])

  const day = useMemo(() => dayCheck(logs, ctx), [logs, age, a.medicacion])
  const totalCaff = Math.round(logs.reduce((s, l) => s + Number(l.caffeine_mg ?? 0) * Number(l.servings ?? 1), 0))
  const limit = age !== null && age < 18 ? 100 : 400

  const openTake = (it: SuppItem) => { setTake(it); setTTiming(defTiming(it.kind)); setTTime(nowHHMM()); setTServ('1'); setErr('') }

  const confirmTake = async () => {
    if (!take) return
    const serv = Math.max(0.25, Number(tServ) || 1)
    const an = analyzeItem(take, ctx)
    const [h, m] = tTime.split(':').map(Number)
    const at = new Date(); at.setHours(h || 0, m || 0, 0, 0)
       const { error } = await safeInsert('supplement_logs', {
      user_id: session!.user.id, item_id: take.id, name: take.name, kind: take.kind,
      caffeine_mg: an.caffeine, servings: serv, timing: tTiming, taken_at: at.toISOString(),
    })
    if (error) { setErr(error); return }
    const tips = timingTips(take.kind, an.caffeine, tTiming, h || 0)
    if (an.verdict === 'avoid') tips.unshift({ kind: 'warn', text: 'Este suplemento salió como "mejor evitarlo". Revisa su análisis antes de volver a tomarlo.' })
    else if (an.verdict === 'caution') tips.unshift({ kind: 'tip', text: 'Este suplemento requiere precauciones. Revisa su análisis.' })
    setFeedback(tips); setTake(null); setTab('hoy'); setScreen(null)
    await loadLogs(); window.scrollTo(0, 0)
  }

  const removeLog = async (id: number) => { await supabase.from('supplement_logs').delete().eq('id', id); loadLogs() }

  const removeItem = async (it: SuppItem) => {
    if (!window.confirm('¿Eliminar este suplemento? Tu historial de tomas se conserva.')) return
    if (it.photo_path) await supabase.storage.from('supplement-photos').remove([it.photo_path])
    await supabase.from('supplement_items').delete().eq('id', it.id)
    setScreen(null); loadItems()
  }

  /* ---- Pantallas ---- */
  if (screen?.t === 'add') return (
    <SupplementAdd onClose={() => setScreen(null)} onSaved={id => { loadItems(); setScreen({ t: 'detail', id }); window.scrollTo(0, 0) }} />
  )
  const detail = screen?.t === 'detail' ? items?.find(i => i.id === screen.id) : null
  if (screen?.t === 'detail' && !detail && items === null) return <p className="center">Cargando...</p>

  const takeDialog = take && (
    <div className="dlg-bg" onClick={() => setTake(null)}>
      <div className="dlg" role="dialog" aria-label="Registrar toma" onClick={e => e.stopPropagation()} style={{ textAlign: 'left' }}>
        <h3 style={{ textAlign: 'center' }}>{take.name}</h3>
        <label><span className="hint">¿Cuándo lo tomas?</span>
          <select value={tTiming} onChange={e => setTTiming(e.target.value)}>{TIMINGS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        <div className="row">
          <label style={{ flex: 1 }}><span className="hint">Hora</span><input type="time" value={tTime} onChange={e => setTTime(e.target.value)} /></label>
          <label style={{ flex: 1 }}><span className="hint">Porciones</span><input type="number" step="0.25" min="0.25" inputMode="decimal" value={tServ} onChange={e => setTServ(e.target.value)} /></label>
        </div>
        {err && <p className="error">{err}</p>}
        <button className="btn primary" onClick={confirmTake}>Guardar toma</button>
        <button className="link" onClick={() => setTake(null)}>Cancelar</button>
      </div>
    </div>
  )

  if (detail) return (
    <>
      <Analysis item={detail} ctx={ctx} onBack={() => setScreen(null)} onTake={() => openTake(detail)} onDelete={() => removeItem(detail)} />
      {takeDialog}
    </>
  )

  const minor = age !== null && age < 18
  return (
    <>
      {tab !== 'consejos' && minor && <div className="warn">Al ser menor de edad, consulta con un médico antes de usar cualquier suplemento. Los estimulantes no se recomiendan.</div>}
      {tab !== 'consejos' && a.medicacion === 'si' && <div className="warn">Indicaste medicamentos o una indicación médica. Antes de usar cualquier suplemento, consulta a tu médico o farmacéutico por posibles interacciones.</div>}
      {toArr(a.restricciones).includes('alergias') && tab !== 'consejos' && <div className="urgent">Indicaste alergias: revisa siempre los ingredientes y alérgenos de cada producto.</div>}

      <div className="tabs t3">
        <button className={tab === 'hoy' ? 'on' : ''} onClick={() => setTab('hoy')}>Hoy</button>
        <button className={tab === 'mis' ? 'on' : ''} onClick={() => setTab('mis')}>Mis suplementos</button>
        <button className={tab === 'consejos' ? 'on' : ''} onClick={() => setTab('consejos')}>Consejos</button>
      </div>

      {/* ---------- HOY ---------- */}
      {tab === 'hoy' && (
        <>
          {feedback.length > 0 && (
            <div className="card" style={{ borderColor: 'var(--y)' }}>
              <div className="hrow"><h3 style={{ margin: 0 }}>Sobre tu toma</h3>
                <button className="mini-ic" onClick={() => setFeedback([])} aria-label="Cerrar"><Icon name="x" size={16} /></button></div>
              <TipList tips={feedback} />
            </div>
          )}

          {totalCaff > 0 && (
            <div className="card">
              <div className="nrow"><span>Cafeína de hoy</span><b>{totalCaff} / {limit} mg</b></div>
              <div className="hbar"><i style={{ width: `${Math.min(100, (totalCaff / limit) * 100)}%`, background: totalCaff > limit ? '#e5484d' : undefined }} /></div>
              <p className="hint" style={{ margin: '.5rem 0 0' }}>Solo cuenta lo registrado aquí; suma tu café, té y refrescos.</p>
            </div>
          )}

          <TipList tips={day} />

          <h3 className="sec-t">Tomar ahora</h3>
          {items === null && <p className="center">Cargando...</p>}
          {items?.length === 0 && <div className="card"><p className="hint" style={{ margin: 0 }}>Aún no agregaste suplementos. Agrega el primero para registrar tus tomas y recibir recomendaciones.</p></div>}
          {items && items.length > 0 && (
            <div className="hscroll">
              {items.map(it => {
                const an = analyzeItem(it, ctx)
                return (
                  <div className="sc" key={it.id}>
                    <small className="wk">{KINDS[it.kind]?.label ?? 'Otro'}</small>
                    <b>{it.name}</b>
                    <span className={`pill v-${an.verdict}`}>{LEVEL_LABEL[an.verdict]}</span>
                    <button className="btn-ver" onClick={() => openTake(it)}>Lo tomé</button>
                  </div>
                )
              })}
            </div>
          )}

          <h3 className="sec-t">Tomas de hoy</h3>
          {logs.length === 0 && <div className="card"><p className="hint" style={{ margin: 0 }}>Aún no registraste tomas hoy.</p></div>}
          {logs.map(l => (
            <div className="card entry" key={l.id}>
              <div className="etime"><b>{hhmm(l.taken_at)}</b><small>{TLABEL[l.timing] ?? l.timing}</small></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0 }}>{l.name}</p>
                <small className="hint">{KINDS[l.kind]?.label}{Number(l.servings) !== 1 ? ` · ${l.servings} porciones` : ''}{Number(l.caffeine_mg) > 0 ? ` · ${Math.round(Number(l.caffeine_mg) * Number(l.servings))} mg cafeína` : ''}</small>
              </div>
              <button className="mini-ic" onClick={() => removeLog(l.id)} aria-label="Eliminar"><Icon name="trash" size={16} /></button>
            </div>
          ))}

          <button className="btn primary" onClick={() => setScreen({ t: 'add' })}><Icon name="plus" size={16} /> Agregar suplemento</button>
        </>
      )}

      {/* ---------- MIS SUPLEMENTOS ---------- */}
      {tab === 'mis' && (
        <>
          {items === null && <p className="center">Cargando...</p>}
          {items?.length === 0 && <div className="card"><p className="hint" style={{ margin: 0 }}>Aún no tienes suplementos guardados.</p></div>}
          {items?.map(it => {
            const an = analyzeItem(it, ctx)
            return (
              <button className="card sitem" key={it.id} onClick={() => { setScreen({ t: 'detail', id: it.id }); window.scrollTo(0, 0) }}>
                <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                  <small className="wk">{KINDS[it.kind]?.label ?? 'Otro'}{it.brand ? ` · ${it.brand}` : ''}</small>
                  <b style={{ display: 'block' }}>{it.name}</b>
                  <span className={`pill v-${an.verdict}`} style={{ display: 'inline-block', marginTop: '.3rem' }}>{LEVEL_LABEL[an.verdict]}</span>
                </div>
                <Icon name="chevron" size={18} />
              </button>
            )
          })}
          <button className="btn primary" onClick={() => setScreen({ t: 'add' })}><Icon name="plus" size={16} /> Agregar suplemento</button>
        </>
      )}

      {/* ---------- CONSEJOS ---------- */}
      {tab === 'consejos' && (
        <>
          <Advice a={a} ctx={ctx} />

          <h3 className="sec-t">Guía por tipo</h3>
          {(Object.keys(KINDS) as Kind[]).filter(k => k !== 'otro').map(k => (
            <div className="card" key={k}>
              <div className="hrow"><h3 style={{ margin: 0 }}>{KINDS[k].label}</h3><span className="pill">Evidencia {KINDS[k].evidence}</span></div>
              <p style={{ margin: '.5rem 0 0' }}>{KINDS[k].fn}</p>
              <p className="hint" style={{ margin: '.4rem 0 0' }}>{KINDS[k].when[0]}</p>
            </div>
          ))}
          <p className="hint">Información educativa; no sustituye la orientación de un médico o dietista.</p>
        </>
      )}

      {takeDialog}
    </>
  )
}