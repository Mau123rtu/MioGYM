import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { toArr, type Answers } from '../lib/questionnaires'
import Icon from '../components/Icons'
import InjuryCheck, { LEVEL_CLS, LEVEL_PILL, PainSlider, ResultView } from './InjuryCheck'
import {
  SIDES, ZONE_LABEL, injuryChanged, modeOf, syncInjuries, useInjury,exerciseAdvice,
  type Report, type Summary, type ZoneKey,
} from '../lib/injury'
import { useMemo } from 'react'
import type { Ex } from '../lib/routine'

const URGENT = 'Si sientes dolor en el pecho, desmayo o dificultad importante para respirar, detén el ejercicio y busca atención médica urgente.'
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short' })
const zoneNames = (zs: string[]) => zs.map(z => (ZONE_LABEL[z] ?? z).toLowerCase()).join(', ')

/** Mensaje cuando las rutinas están bloqueadas */
export function InjuryBlock({ s }: { s: Summary }) {
  const first = s.blocked[0]
  if (!first) return null
  const { r, m } = first
  const text = m.why === 'paused'
    ? 'Pausaste tus rutinas por tu molestia. Puedes reanudarlas en Prevención cuando quieras.'
    : r.level === 'urgent'
      ? 'Marcaste señales que requieren atención médica. Por seguridad, tus rutinas están bloqueadas hasta que un médico te valore, o hasta que repitas la evaluación.'
      : 'Tu evaluación sugiere descansar y consultar a un médico. Tus rutinas están bloqueadas hasta que haya una valoración médica que te permita seguir, o hasta que indiques que fue falsa alarma.'
  return (
    <>
      <div className="urgent"><b>Rutinas bloqueadas · {ZONE_LABEL[r.zone]}</b><p style={{ margin: '.4rem 0 0' }}>{text}</p></div>
      <Link to="/app/lesiones" className="btn primary">Ir a Prevención</Link>
    </>
  )
}

/** Aviso cuando se entrena con ajustes */
export function InjuryBanner({ s }: { s: Summary }) {
  if (s.mode !== 'adjust') return null
  return (
    <div className="warn">
      <b>Entrenas con ajustes por tu {zoneNames(s.zones)}.</b> Evita ejercicios que la carguen, usa cerca del {Math.round(s.loadFactor * 100)}% de tu carga habitual
      y descansa {s.restBonus} s más. <Link to="/app/lesiones" style={{ textDecoration: 'underline' }}>Ver mi estado</Link>
    </div>
  )
}

/* ---------- Consejos (se conserva) ---------- */
function Injuries({ a }: { a: Answers }) {
  const zones = toArr(a.zonas)
  const want = (k: string) => toArr(a.mejorar).some(x => x === k || x === 'todo')
  return (
    <>
      {a.alarma === 'si' && <div className="urgent"><b>Importante:</b> {URGENT} No entrenes hasta que un profesional te valore.</div>}
      {a.dolor === 'si' && zones.length > 0 && (
        <div className="warn">
          Zonas con molestia: {zones.map(z => <span className="tag" key={z}>{z}</span>)}
          <p>Tu rutina evita ejercicios que carguen esas zonas. {(a.intensidad === 'intenso' || toArr(a.situaciones).includes('reposo')) && 'Como el dolor es intenso o aparece en reposo, te recomendamos una valoración profesional.'}</p>
        </div>
      )}
      <div className="card"><h3>Calentamiento general (5–8 min)</h3>
        <p className="hint">1) 3–5 min de cardio ligero · 2) círculos de hombros, cadera y tobillos · 3) sentadilla sin peso × 10 · 4) 1–2 series ligeras del primer ejercicio.</p>
        {(a.calentamiento === 'directo' || a.calentamiento === 'ninguno') && <p>Notamos que empiezas sin calentar: probar esto antes de entrenar reduce riesgos evitables.</p>}</div>
      {want('tecnica') && <div className="card"><h3>Técnica</h3><p className="hint">Controla la bajada, mantén la espalda neutra, no rebotes y detén la serie cuando la técnica se rompa.</p></div>}
      {want('movilidad') && <div className="card"><h3>Movilidad</h3><p className="hint">Dedica 5 min a cadera, hombros y tobillos tras entrenar o en días de descanso.</p></div>}
      {want('cargas') && <div className="card"><h3>Progresión gradual</h3><p className="hint">Sube el peso o las repeticiones solo cuando completes todas las series con buena técnica, y no más de un pequeño ajuste por semana.</p></div>}
      {want('errores') && <div className="card"><h3>Errores frecuentes</h3><p className="hint">Saltarse el calentamiento, usar demasiado peso, entrenar con dolor agudo y no descansar.</p></div>}
      <div className="card"><h3>Cuándo ir al médico</h3>
        <p className="hint">• Dolor que no mejora en 1 o 2 semanas, o que empeora.</p>
        <p className="hint">• Hinchazón, hormigueo, pérdida de fuerza o sensación de inestabilidad.</p>
        <p className="hint">• Dolor que te despierta de noche o aparece en reposo.</p>
        <p className="hint" style={{ margin: 0 }}>• Cualquier dolor después de un golpe fuerte o una caída.</p></div>
      <div className="urgent">{URGENT}</div>
      <p className="hint">Esta sección no diagnostica lesiones. Ante dolor persistente, consulta a un profesional sanitario.</p>
      <Link to="/app/lesiones/perfil" className="btn">Editar mis respuestas</Link>
    </>
  )
}

/*------*/

const MUS: Record<string, string> = {
  pecho: 'Pecho', espalda: 'Espalda', hombros: 'Hombros', brazos: 'Bíceps y tríceps', piernas: 'Piernas y glúteos', abdomen: 'Abdomen',
}
const FIT_TEXT = {
  ok: 'No cargan la zona con molestia. Puedes seguir con ellos, con buena técnica y atención al dolor.',
  care: 'Cargan un poco tu zona. Solo con dolor leve (3/10 o menos) o con permiso de tu médico: usa cerca del 50 a 65% de tu carga, descansa más y para si el dolor sube de 3/10. Tu rutina automática los evita; puedes agregarlos tú desde la Biblioteca.',
  avoid: 'Cargan la zona con molestia. No los hagas por ahora.',
} as const

function ExerciseGuide({ reports, blocked }: { reports: Report[]; blocked: boolean }) {
  const [t, setT] = useState<'ok' | 'care' | 'avoid'>('ok')
  const adv = useMemo(() => exerciseAdvice(reports), [reports])

  if (blocked) return (
    <div className="card">
      <h3>¿Qué ejercicios puedo hacer?</h3>
      <p className="hint" style={{ margin: 0 }}>Mientras tus rutinas estén bloqueadas no recomendamos ningún ejercicio. Cuando un médico te autorice o indiques falsa alarma, aquí verás cuáles sí puedes seguir haciendo y cuáles evitar según tu zona.</p>
    </div>
  )

  const all: Ex[] = [...adv.ok, ...adv.care, ...adv.avoid]
  const list = adv[t]
  const groups = Array.from(new Set(list.map(e => e.g)))
  const other = reports.some(r => r.status === 'active' && r.zone === 'otra')

  return (
    <div className="card">
      <h3>¿Qué ejercicios puedo hacer?</h3>
      <p className="hint">Según tus molestias activas. Es una guía general: ante la duda, pregunta a tu médico o fisioterapeuta.</p>
      <div style={{ marginBottom: '.6rem' }}>
        {Object.keys(MUS).map(g => {
          const tot = all.filter(e => e.g === g).length
          const ok = adv.ok.filter(e => e.g === g).length
          return <span key={g} className="tag" style={{ opacity: ok === 0 ? .5 : 1, borderColor: ok === tot ? '#3fae6a' : undefined }}>{MUS[g]} · {ok}/{tot}</span>
        })}
      </div>
      {other && <div className="warn">Indicaste "otra zona": no podemos filtrar ejercicios automáticamente. Evita todo movimiento que te duela.</div>}

      <div className="tabs t3" style={{ marginBottom: '.6rem' }}>
        <button className={t === 'ok' ? 'on' : ''} onClick={() => setT('ok')}>Sí ({adv.ok.length})</button>
        <button className={t === 'care' ? 'on' : ''} onClick={() => setT('care')}>Con cuidado ({adv.care.length})</button>
        <button className={t === 'avoid' ? 'on' : ''} onClick={() => setT('avoid')}>Evitar ({adv.avoid.length})</button>
      </div>
      <p className="hint" style={{ marginTop: 0 }}>{FIT_TEXT[t]}</p>

      {list.length === 0 && <p className="hint">Ningún ejercicio en esta categoría.</p>}
      {groups.map(g => (
        <div key={g}>
          <h4 className="ph" style={{ marginTop: '.6rem' }}>{MUS[g]}</h4>
          {list.filter(e => e.g === g).map(e => (
            <div className="exrow" key={e.n}><div><b>{e.n}</b></div></div>
          ))}
        </div>
      ))}
    </div>
  )
}

/* ---------- Pantalla principal ---------- */
export default function Prevention({ a }: { a: Answers }) {
  const { session, profile } = useAuth()
  const { reports, summary } = useInjury()
  const [tab, setTab] = useState<'estado' | 'historial' | 'consejos'>('estado')
  const [check, setCheck] = useState<{ zone?: ZoneKey } | null>(null)
  const [open, setOpen] = useState<number | null>(null)
  const [dlg, setDlg] = useState<{ kind: 'doctor' | 'false' | 'resolve'; r: Report } | null>(null)
  const [note, setNote] = useState('')
  const [full, setFull] = useState(false)
  const [cur, setCur] = useState(1)
  const [msg, setMsg] = useState('')

  const patch = async (id: number, p: Record<string, unknown>) => {
    await supabase.from('injury_reports').update({ ...p, updated_at: new Date().toISOString() }).eq('id', id)
    await syncInjuries(session!.user.id, profile)
    injuryChanged()
  }
  const openDlg = (kind: 'doctor' | 'false' | 'resolve', r: Report) => { setDlg({ kind, r }); setNote(''); setFull(false); setCur(kind === 'resolve' ? 0 : 1); setMsg('') }

  const confirm = async () => {
    if (!dlg) return
    const { kind, r } = dlg
    const at = new Date().toISOString()
    if (kind === 'doctor') await patch(r.id, { override: { type: 'doctor', note: note.trim(), full, at }, paused: false })
    else if (kind === 'false') {
      if (cur > 2) { setMsg('Con ese nivel de dolor no es prudente continuar. Repite la evaluación o consulta a un médico.'); return }
      await patch(r.id, { override: { type: 'false_alarm', note: '', full: false, pain: cur, at }, paused: false })
    } else {
      if (cur > 1) { setMsg('Si todavía te duele, es mejor seguir con los ajustes hasta que desaparezca.'); return }
      await patch(r.id, { status: 'resolved', paused: false })
    }
    setDlg(null)
  }

  if (check) return (
    <InjuryCheck initialZone={check.zone} onClose={() => setCheck(null)} onSaved={() => { setCheck(null); setTab('estado'); window.scrollTo(0, 0) }} />
  )

  const active = (reports ?? []).filter(r => r.status === 'active')
  const past = (reports ?? []).filter(r => r.status === 'resolved')

  return (
    <>
      <div className="tabs t3">
        <button className={tab === 'estado' ? 'on' : ''} onClick={() => setTab('estado')}>Mi estado</button>
        <button className={tab === 'historial' ? 'on' : ''} onClick={() => setTab('historial')}>Historial</button>
        <button className={tab === 'consejos' ? 'on' : ''} onClick={() => setTab('consejos')}>Consejos</button>
      </div>

      {tab === 'estado' && (
        <>
          {reports === null && <p className="center">Cargando...</p>}
          {summary.mode === 'blocked' && <div className="urgent"><b>Tus rutinas están bloqueadas.</b> Mira abajo qué hacer o cómo cambiar la decisión.</div>}
          {summary.mode === 'adjust' && <InjuryBanner s={summary} />}

          {reports && active.length === 0 && (
            <div className="card" style={{ textAlign: 'center' }}>
              <h3>Sin molestias registradas</h3>
              <p className="hint">Si te duele algo o notas una molestia, cuéntanos y haremos unas mini pruebas para orientarte.</p>
            </div>
          )}

          {active.map(r => {
            const m = modeOf(r)
            const isOpen = open === r.id
            const sideTxt = SIDES.find(s => s[0] === r.side)?.[1]
            return (
              <div className="card" key={r.id}>
                <div className="hrow">
                  <div style={{ minWidth: 0 }}>
                    <h3 style={{ margin: 0 }}>{ZONE_LABEL[r.zone]}</h3>
                    <p className="hint" style={{ margin: 0 }}>{r.part}{sideTxt ? ` · ${sideTxt}` : ''} · dolor {r.pain}/10 · {fmtDate(r.created_at)}</p>
                  </div>
                  <span className={`pill v-${LEVEL_CLS[r.level]}`}>{LEVEL_PILL[r.level]}</span>
                </div>

                <p style={{ margin: '.6rem 0 0' }}>
                  {m.why === 'paused' ? 'Pausaste tus rutinas. Puedes reanudarlas cuando quieras.'
                    : m.why === 'override' ? (r.override?.type === 'doctor'
                      ? `Registraste autorización médica${r.override.note ? `: "${r.override.note}"` : ''}. ${r.override.full ? 'Entrenas con normalidad.' : 'Entrenas con ajustes.'}`
                      : 'Indicaste falsa alarma: entrenas con ajustes y precaución.')
                    : r.level === 'urgent' ? 'Rutinas bloqueadas hasta que te valore un médico.'
                    : r.level === 'rest' ? 'Rutinas bloqueadas. Descansa y consulta a un médico.'
                    : r.level === 'adjust' ? 'Puedes entrenar con ajustes en carga, descansos y ejercicios.'
                    : 'Puedes entrenar con precauciones.'}
                </p>

                <div className="qrow" style={{ marginTop: '.7rem', flexWrap: 'wrap' }}>
                  <button className="qbtn" onClick={() => setOpen(isOpen ? null : r.id)}>{isOpen ? 'Ocultar evaluación' : 'Ver evaluación'}</button>
                  <button className="qbtn" onClick={() => setCheck({ zone: r.zone })}>Repetir evaluación</button>
                </div>

                {isOpen && <div style={{ marginTop: '.6rem' }}><ResultView level={r.level} result={r.result} pain={r.pain} zone={r.zone} /></div>}

                <div className="stack">
                  {r.paused && <button className="btn" onClick={() => patch(r.id, { paused: false })}>Reanudar mis rutinas</button>}
                  {!r.paused && m.mode !== 'blocked' && <button className="btn" onClick={() => patch(r.id, { paused: true })}>Prefiero descansar (pausar rutinas)</button>}
                  {r.override && <button className="btn" onClick={() => patch(r.id, { override: null })}>Quitar mi decisión y volver a la original</button>}
                  {!r.override && (r.level === 'urgent' || r.level === 'rest') && <button className="btn primary" onClick={() => openDlg('doctor', r)}>Un médico me valoró y puedo entrenar</button>}
                  {!r.override && r.level === 'rest' && <button className="btn" onClick={() => openDlg('false', r)}>Fue falsa alarma</button>}
                  {(r.level === 'adjust' || r.level === 'ok' || r.override) && <button className="btn" onClick={() => openDlg('resolve', r)}>Ya no tengo molestias</button>}
                </div>
              </div>
            )
          })}
           {reports && active.length > 0 && <ExerciseGuide reports={reports} blocked={summary.mode === 'blocked'} />}

          <Link to="/app/asistente" state={{ q: 'Revisa mis molestias activas: ¿qué ejercicios debo evitar, cómo cuido la zona y qué técnica debo corregir?' }} className="btn">
            <Icon name="chat" size={16} /> Preguntar al asistente sobre mi molestia
          </Link>

          <button className="btn primary" onClick={() => setCheck({})}><Icon name="plus" size={16} /> {active.length ? 'Reportar otra molestia' : 'Reportar una molestia'}</button>
          <p className="hint">La app no puede dar un diagnóstico exacto: orienta con lo que le cuentas. Ante dolor persistente, hinchazón, hormigueo o pérdida de fuerza, consulta a un médico.</p>
        </>
      )}

      {tab === 'historial' && (
        <>
          {past.length === 0 && <div className="card"><p className="hint" style={{ margin: 0 }}>Aún no hay molestias anteriores.</p></div>}
          {past.map(r => (
            <div className="card" key={r.id}>
              <div className="hrow">
                <div><b>{ZONE_LABEL[r.zone]}</b><p className="hint" style={{ margin: 0 }}>{r.part} · dolor {r.pain}/10 · {fmtDate(r.created_at)}</p></div>
                <span className={`pill v-${LEVEL_CLS[r.level]}`}>{LEVEL_PILL[r.level]}</span>
              </div>
            </div>
          ))}
        </>
      )}

      {tab === 'consejos' && <Injuries a={a} />}

      {dlg && (
        <div className="dlg-bg" onClick={() => setDlg(null)}>
          <div className="dlg" role="dialog" onClick={e => e.stopPropagation()} style={{ textAlign: 'left' }}>
            {dlg.kind === 'doctor' && (<>
              <h3 style={{ textAlign: 'center' }}>Autorización médica</h3>
              <p>Confirma solo si un profesional de la salud te valoró y te permitió entrenar.</p>
              <textarea placeholder="Restricciones o recomendaciones que te dio (opcional)" value={note} onChange={e => setNote(e.target.value)} />
              <label className="chkline"><input type="checkbox" checked={full} onChange={e => setFull(e.target.checked)} /><span>Me dijo que puedo entrenar sin restricciones.</span></label>
              <p className="hint">Si no marcas la casilla, entrenarás con ajustes de carga y descanso en esa zona.</p>
            </>)}
            {dlg.kind === 'false' && (<>
              <h3 style={{ textAlign: 'center' }}>Fue falsa alarma</h3>
              <p>¿Cuánto te duele ahora?</p>
              <PainSlider value={cur} onChange={setCur} />
              <p className="hint">Seguirás entrenando con ajustes y precaución.</p>
            </>)}
            {dlg.kind === 'resolve' && (<>
              <h3 style={{ textAlign: 'center' }}>Ya no tengo molestias</h3>
              <p>¿Cuánto te duele ahora?</p>
              <PainSlider value={cur} onChange={setCur} />
            </>)}
            {msg && <div className="warn">{msg}</div>}
            <button className="btn primary" onClick={confirm}>Confirmar</button>
            <button className="link" onClick={() => setDlg(null)}>Cancelar</button>
          </div>
        </div>
      )}
    </>
  )
}