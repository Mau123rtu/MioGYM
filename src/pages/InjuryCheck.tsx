import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import {
  DURATIONS, FLAGS, KINDS, ONSETS, PARTS, SIDES, TESTS, TEST_OPTIONS, TRENDS, TRIGGERS, ZONES, ZONE_LABEL,
  adjustments, evaluate, injuryChanged, painLabel, syncInjuries,
  type Check, type Level, type Result, type ZoneKey,
} from '../lib/injury'

const CLS: Record<Level, string> = { ok: 'ok', adjust: 'caution', rest: 'avoid', urgent: 'avoid' }
const TITLE: Record<Level, string> = {
  ok: 'Puedes entrenar con precauciones', adjust: 'Entrena con ajustes',
  rest: 'Descansa y consulta a un médico', urgent: 'Busca atención médica hoy',
}
export const LEVEL_PILL: Record<Level, string> = { ok: 'Con precauciones', adjust: 'Con ajustes', rest: 'Descanso', urgent: 'Urgente' }
export const LEVEL_CLS = CLS

export function PainSlider({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="pain">
      <div className="pain-num"><b>{value}</b><span>/10 · {painLabel(value)}</span></div>
      <input type="range" min={0} max={10} step={1} value={value} onChange={e => onChange(Number(e.target.value))} aria-label="Escala de dolor" />
      <div className="pain-scale"><small>0 sin dolor</small><small>10 el peor</small></div>
    </div>
  )
}

export function ResultView({ level, result, pain, zone }: { level: Level; result: Result; pain: number; zone: string }) {
  const adj = adjustments(level, pain)
  const z = (ZONE_LABEL[zone] ?? 'zona afectada').toLowerCase()
  return (
    <>
      <div className={`vbox ${CLS[level]}`}>
        <b>{TITLE[level]}</b>
        <span>Confianza del resultado: {result.confidence}. Es una orientación, no un diagnóstico.</span>
      </div>

      <div className="card">
        <h3>Por qué</h3>
        {result.reasons.map((r, i) => <p key={i} className="hint">• {r}</p>)}
      </div>

      {(level === 'rest' || level === 'urgent') && (
        <div className={level === 'urgent' ? 'urgent' : 'warn'}>
          {result.steps.map((s, i) => <p key={i} style={{ margin: i ? '.5rem 0 0' : 0 }}>{s}</p>)}
          <p style={{ margin: '.6rem 0 0' }}><b>Tus rutinas quedan bloqueadas</b> hasta que un médico te permita entrenar, o hasta que cambies esta decisión en Prevención.</p>
        </div>
      )}

      {level === 'adjust' && (
        <div className="card">
          <h3>Cómo entrenar con ajustes</h3>
          <p className="hint">• Tus rutinas automáticas evitan los ejercicios que cargan tu {z}.</p>
          <p className="hint">• En cualquier ejercicio que la use, baja la carga a cerca del {Math.round(adj.loadFactor * 100)}% de la habitual.</p>
          <p className="hint">• Descansa {adj.restBonus} segundos más entre series.</p>
          <p className="hint">• Haz una serie menos si notas molestia.</p>
          <p className="hint">• Detente si el dolor sube de {adj.painStop}/10. Usa el botón "Me duele" durante la sesión.</p>
        </div>
      )}
      {level === 'ok' && (
        <div className="card">
          <h3>Recomendaciones</h3>
          <p className="hint">• Calienta bien la zona antes de entrenar.</p>
          <p className="hint">• Baja un poco tus cargas esta semana (≈ {Math.round(adj.loadFactor * 100)}%) y sube con calma.</p>
          <p className="hint">• Detente si el dolor sube de {adj.painStop}/10.</p>
          <p className="hint">• Repite la evaluación si empeora o dura más de 1 o 2 semanas.</p>
        </div>
      )}
      <p className="hint">Esta herramienta no diagnostica ni sustituye a un profesional de la salud. Ante la duda, consulta a un médico.</p>
    </>
  )
}

function Choices({ items, value, onChange }: { items: [string, string][]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="options">
      {items.map(([v, l]) => <button key={v} type="button" className={value === v ? 'option selected' : 'option'} onClick={() => onChange(v)}>{l}</button>)}
    </div>
  )
}

export default function InjuryCheck({ initialZone, onClose, onSaved }: { initialZone?: ZoneKey; onClose: () => void; onSaved: () => void }) {
  const { session, profile } = useAuth()
  const [step, setStep] = useState(0)
  const [ti, setTi] = useState(0)
  const [zone, setZone] = useState<ZoneKey | ''>(initialZone ?? '')
  const [part, setPart] = useState('')
  const [side, setSide] = useState('')
  const [pain, setPain] = useState(3)
  const [kind, setKind] = useState('')
  const [onset, setOnset] = useState('')
  const [duration, setDuration] = useState('')
  const [trend, setTrend] = useState('')
  const [triggers, setTriggers] = useState<string[]>([])
  const [flags, setFlags] = useState<string[]>([])
  const [scores, setScores] = useState<Record<string, number>>({})
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [res, setRes] = useState<Result | null>(null)

  const tests = zone ? TESTS[zone] : []
  const danger = FLAGS.some(f => (f.cls === 'emergency' || f.cls === 'urgent') && flags.includes(f.id))
  const emergency = FLAGS.some(f => f.cls === 'emergency' && flags.includes(f.id))
  const skipTests = pain >= 8 || danger
  const tog = (list: string[], set: (l: string[]) => void, v: string) => set(list.includes(v) ? list.filter(x => x !== v) : [...list, v])

  const finish = async (sc: Record<string, number>) => {
    setBusy(true); setErr('')
    const check: Check = {
      zone: zone as ZoneKey, part, side, pain, kind, onset, duration, trend, triggers, flags,
      tests: tests.map(t => ({ id: t.id, title: t.title, score: skipTests || sc[t.id] === undefined || sc[t.id] === -1 ? null : sc[t.id] })),
    }
    const r = evaluate(check)
    const uid = session!.user.id
    const ins = await supabase.from('injury_reports').insert({
      user_id: uid, zone, part: part || null, side: side || null, pain, details: check, level: r.level, result: r,
    }).select('id').single()
    if (ins.error || !ins.data) { setBusy(false); setErr(ins.error?.message ?? 'No se pudo guardar'); return }
    await supabase.from('injury_reports').update({ status: 'resolved', updated_at: new Date().toISOString() })
      .eq('user_id', uid).eq('zone', zone).eq('status', 'active').neq('id', ins.data.id)
    await syncInjuries(uid, profile)
    injuryChanged()
    setBusy(false); setRes(r); setStep(6); window.scrollTo(0, 0)
  }

  const canNext = [
    !!zone && !!side && !!part.trim(), !!kind, !!onset && !!duration && !!trend, true, true,
  ][step] ?? true

  const next = () => {
    window.scrollTo(0, 0)
    if (step === 4) { if (skipTests) finish(scores); else { setTi(0); setStep(5) } ; return }
    setStep(step + 1)
  }
  const back = () => { window.scrollTo(0, 0); if (step === 5 && ti > 0) setTi(ti - 1); else setStep(step - 1) }

  if (step === 6 && res) return (
    <>
      <h2>Resultado</h2>
      <p className="hint">{ZONE_LABEL[zone]} · {part} · dolor {pain}/10</p>
      <ResultView level={res.level} result={res} pain={pain} zone={zone} />
      <button className="btn primary" onClick={onSaved}>Listo</button>
    </>
  )

  const total = 6
  return (
    <div>
      <div className="progress"><div style={{ width: `${((step + 1) / total) * 100}%` }} /></div>
      <p className="hint">Evaluación de molestia · paso {step + 1} de {total}</p>

      {step === 0 && (
        <>
          <h2>¿Dónde te duele?</h2>
          <div>{ZONES.map(([k, l]) => <button key={k} className={`chipbtn${zone === k ? ' on' : ''}`} onClick={() => { setZone(k); setPart('') }}>{l}</button>)}</div>
          {zone === 'otra' && <input placeholder="Describe la zona (ej. muslo, codo, costillas…)" value={part} onChange={e => setPart(e.target.value)} />}
          {zone && zone !== 'otra' && (<>
            <h3 style={{ marginTop: '1rem' }}>¿En qué parte o músculo?</h3>
            <Choices items={PARTS[zone].map(p => [p, p])} value={part} onChange={setPart} />
          </>)}
          {zone && (<>
            <h3 style={{ marginTop: '1rem' }}>¿De qué lado?</h3>
            <Choices items={SIDES} value={side} onChange={setSide} />
          </>)}
        </>
      )}

      {step === 1 && (
        <>
          <h2>¿Cuánto te duele ahora?</h2>
          <p className="hint">0 es sin dolor y 10 es el peor dolor que imaginas.</p>
          <PainSlider value={pain} onChange={setPain} />
          <h3 style={{ marginTop: '1rem' }}>¿Cómo se siente?</h3>
          <Choices items={KINDS} value={kind} onChange={setKind} />
        </>
      )}

      {step === 2 && (
        <>
          <h2>¿Cómo empezó?</h2>
          <Choices items={ONSETS} value={onset} onChange={setOnset} />
          <h3>¿Desde cuándo?</h3>
          <Choices items={DURATIONS} value={duration} onChange={setDuration} />
          <h3>¿Cómo va?</h3>
          <Choices items={TRENDS} value={trend} onChange={setTrend} />
        </>
      )}

      {step === 3 && (
        <>
          <h2>¿Qué lo provoca o empeora?</h2>
          <p className="hint">Elige todo lo que aplique. Puedes dejarlo vacío.</p>
          <div className="options">
            {TRIGGERS.map(([v, l]) => <button key={v} type="button" className={triggers.includes(v) ? 'option selected' : 'option'} onClick={() => tog(triggers, setTriggers, v)}>{l}</button>)}
          </div>
        </>
      )}

      {step === 4 && (
        <>
          <h2>Señales de alarma</h2>
          <p className="hint">Marca lo que te pase. Si no te pasa nada de esto, sigue.</p>
          <div className="options">
            {FLAGS.map(f => <button key={f.id} type="button" className={flags.includes(f.id) ? 'option selected' : 'option'} onClick={() => tog(flags, setFlags, f.id)}>{f.label}</button>)}
          </div>
          {emergency && <div className="urgent"><b>Esto puede ser una emergencia.</b> Si tienes dolor de pecho, falta de aire, desmayo o pérdida de control de la orina o las heces, llama ahora a emergencias o acude a urgencias.</div>}
          {!emergency && danger && <div className="urgent">Marcaste una señal que requiere atención médica. No haremos pruebas de movimiento; verás tu resultado.</div>}
          {!danger && pain >= 8 && <div className="warn">Con un dolor tan alto no hacemos pruebas de movimiento.</div>}
        </>
      )}

      {step === 5 && tests[ti] && (
        <>
          <h2>Mini prueba {ti + 1} de {tests.length}</h2>
          <div className="card">
            <h3>{tests[ti].title}</h3>
            <p style={{ margin: 0 }}>{tests[ti].how}</p>
          </div>
          <div className="warn">Hazla despacio, sin peso y sin rebotes. Si el dolor sube de 5/10, detente y marca "Dolor fuerte".</div>
          <div className="options">
            {TEST_OPTIONS.map(([v, l]) => (
              <button key={v} type="button" className={scores[tests[ti].id] === v ? 'option selected' : 'option'}
                onClick={() => setScores(s => ({ ...s, [tests[ti].id]: v }))}>{l}</button>
            ))}
          </div>
        </>
      )}

      {err && <p className="error">{err}</p>}
      {step === 5 ? (
        <button className="btn primary" disabled={busy || scores[tests[ti].id] === undefined}
          onClick={() => (ti < tests.length - 1 ? (setTi(ti + 1), window.scrollTo(0, 0)) : finish(scores))}>
          {busy ? 'Calculando…' : ti < tests.length - 1 ? 'Siguiente' : 'Ver resultado'}
        </button>
      ) : (
        <button className="btn primary" disabled={!canNext || busy} onClick={next}>
          {busy ? 'Calculando…' : step === 4 && skipTests ? 'Ver resultado' : 'Siguiente'}
        </button>
      )}
      {step > 0 ? <button className="link" onClick={back}>Atrás</button> : <button className="link" onClick={onClose}>Cancelar</button>}
    </div>
  )
}