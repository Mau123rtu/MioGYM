import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Icon from '../components/Icons'
import { useOnline } from '../components/PwaStatus'
import { buildContext, type Alert, type Built } from '../lib/assistantContext'

interface Msg { role: 'user' | 'assistant'; content: string }

const ROUTES: Record<string, [string, string]> = {
  rutinas: ['/app/ejercicios', 'Rutinas'], nutricion: ['/app/nutricion', 'Nutrición'], prevencion: ['/app/lesiones', 'Prevención'],
  suplementos: ['/app/suplementos', 'Suplementos'], perfil: ['/app/mas/cuenta', 'Mi perfil'], inicio: ['/app', 'Inicio'],
}
const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const EMERGENCY = /dolor (de|en el) pecho|opresion en el pecho|no puedo respirar|falta de aire|me desmay|desmayo|perdi el conocimiento|no siento (las|mis) piernas|perdi el control (de la orina|del esfinter)|adormecimiento en la entrepierna|quiero morir|quitarme la vida|suicid|hacerme dano/

/** Convierte [[video:…]], [[ir:…]] y **negritas** en elementos. Nunca interpreta HTML ni enlaza URLs sueltas. */
function inline(line: string, k: string): ReactNode[] {
  const out: ReactNode[] = []
  const re = /\[\[(video|ir):([^\]]{1,80})\]\]|\*\*([^*]{1,80})\*\*/g
  let last = 0, m: RegExpExecArray | null, i = 0
  while ((m = re.exec(line))) {
    if (m.index > last) out.push(line.slice(last, m.index))
    const id = `${k}-${i++}`
    if (m[1] === 'video') {
      const n = m[2].trim()
      out.push(
        <a key={id} className="chatlink" target="_blank" rel="noopener noreferrer"
          href={`https://www.youtube.com/results?search_query=${encodeURIComponent(`${n} técnica correcta`)}`}>
          <Icon name="video" size={14} /> Ver técnica: {n}
        </a>)
    } else if (m[1] === 'ir') {
      const r = ROUTES[m[2].trim().toLowerCase()]
      if (r) out.push(<Link key={id} className="chatlink" to={r[0]}>Ir a {r[1]}</Link>)
    } else out.push(<b key={id}>{m[3]}</b>)
    last = re.lastIndex
  }
  if (last < line.length) out.push(line.slice(last))
  return out
}

function Rich({ text }: { text: string }) {
  const blocks: ReactNode[] = []
  let list: string[] = []
  const flush = (k: number) => {
    if (!list.length) return
    blocks.push(<ul key={`u${k}`}>{list.map((l, i) => <li key={i}>{inline(l, `l${k}-${i}`)}</li>)}</ul>)
    list = []
  }
  text.split('\n').forEach((raw, i) => {
    const b = raw.match(/^\s*(?:[-•]|\*(?=\s))\s*(.+)$/)
    if (b) { list.push(b[1]); return }
    flush(i)
    if (raw.trim()) blocks.push(<p key={`p${i}`}>{inline(raw.trim(), `p${i}`)}</p>)
  })
  flush(9999)
  return <>{blocks}</>
}

export default function Assistant() {
  const { profile, session, refreshProfile } = useAuth()
  const online = useOnline()
  const loc = useLocation()
  const initial = (loc.state as { q?: string } | null)?.q

  const [msgs, setMsgs] = useState<Msg[]>([])
  const [loaded, setLoaded] = useState(false)
  const [alerts, setAlerts] = useState<Alert[] | null>(null)
  const [flags, setFlags] = useState({ injury: false, supplements: false, plan: false })
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [urgent, setUrgent] = useState(false)
  const [askClear, setAskClear] = useState(false)
  const built = useRef<{ at: number; b: Built } | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const autoSent = useRef(false)

  const consented = !!profile?.assistant_consent_at
  const uid = session!.user.id

  const getCtx = async (): Promise<Built | null> => {
    if (!profile) return null
    if (built.current && Date.now() - built.current.at < 120000) return built.current.b
    try {
      const b = await buildContext(profile)
      built.current = { at: Date.now(), b }
      setAlerts(b.alerts); setFlags(b.flags)
      return b
    } catch { return built.current?.b ?? null }
  }

  useEffect(() => { getCtx() }, [profile?.id])

  useEffect(() => {
    supabase.from('assistant_messages').select('role,content').order('created_at', { ascending: false }).limit(40)
      .then(({ data }) => { setMsgs(((data as Msg[]) ?? []).reverse()); setLoaded(true) })
  }, [])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [msgs.length, busy])

  const accept = async () => {
    await supabase.from('profiles').update({ assistant_consent_at: new Date().toISOString() }).eq('id', uid)
    await refreshProfile()
  }

  const send = async (text: string) => {
    const t = text.trim().slice(0, 1000)
    if (!t || busy) return
    if (!online) { setErr('Necesitas internet para hablar con el asistente.'); return }
    setErr(''); setInput(''); setBusy(true)
    if (EMERGENCY.test(norm(t))) setUrgent(true)
    const next: Msg[] = [...msgs, { role: 'user', content: t }]
    setMsgs(next)
    supabase.from('assistant_messages').insert({ user_id: uid, role: 'user', content: t })

    const b = await getCtx()
    const { data, error } = await supabase.functions.invoke('assistant', {
      body: { messages: next.slice(-12), context: b?.ctx ?? {} },
    })
    setBusy(false)

    let msg = 'No pude responder ahora. Intenta de nuevo en un momento.'
    if (error) {
      try { const j = await (error as unknown as { context?: Response }).context?.json(); if (j?.message) msg = j.message } catch { /* mensaje genérico */ }
    } else if (data?.error) msg = data.message ?? msg
    else if (data?.reply) {
      const reply = String(data.reply)
      setMsgs([...next, { role: 'assistant', content: reply }])
      supabase.from('assistant_messages').insert({ user_id: uid, role: 'assistant', content: reply })
      return
    }
    setErr(msg)
  }

  // Si llega desde otra pantalla con una pregunta, se envía sola
  useEffect(() => {
    if (initial && consented && loaded && !autoSent.current) { autoSent.current = true; send(initial) }
  }, [consented, loaded])

  const clear = async () => {
    await supabase.from('assistant_messages').delete().eq('user_id', uid)
    setMsgs([]); setAskClear(false); setUrgent(false)
  }

  const chips = [
    '¿Qué me falta hoy?',
    flags.plan ? 'Explícame mi entrenamiento de hoy' : '¿Cómo empiezo a entrenar?',
    flags.injury ? '¿Cómo cuido mi molestia?' : '¿Cómo evito lesionarme?',
    '¿Qué como antes y después de entrenar?',
    flags.supplements ? '¿Cómo tomo mis suplementos?' : '¿Necesito suplementos?',
    'Dame un consejo de técnica',
  ]

  return (
    <div className="chat-page">
      <h1>Asistente</h1>
      <p className="hint" style={{ marginTop: 0 }}>Te orienta con tus datos de rutinas, nutrición, prevención y suplementos.</p>

      <h3 className="sec-t">Tu resumen de hoy</h3>
      {alerts === null && <p className="hint">Revisando tus datos…</p>}
      {alerts && (
        <div className="hscroll">
          {alerts.map((a, i) => (
            <div className={`coach-c ${a.kind}`} key={i}>
              <p style={{ color: '#e6e6e6' }}>{a.text}</p>
              {a.to && <Link to={a.to} className="btn-ver">{a.cta ?? 'Ver'}</Link>}
            </div>
          ))}
        </div>
      )}

      {!consented ? (
        <div className="card" style={{ marginTop: '1rem' }}>
          <h3>Antes de chatear</h3>
          <p className="hint">Para responderte, el asistente usa IA de Google (Gemini). Al enviar un mensaje se envía a Google:</p>
          <ul className="cd-list">
            <li>Tu pregunta y la conversación reciente.</li>
            <li>Un resumen de tus datos: edad, sexo, peso, altura, objetivo, entrenos, comidas de hoy, suplementos y molestias que reportaste.</li>
          </ul>
          <p className="hint">No se envían tus fotos, tu correo ni tu contraseña. Los servicios gratuitos de Google pueden usar lo que envíes para mejorar sus productos, así que no escribas datos que no quieras compartir. Puedes borrar la conversación cuando quieras.</p>
          <p className="hint">Las respuestas son generadas por IA, pueden contener errores y no sustituyen a un médico, nutriólogo o fisioterapeuta.</p>
          <button className="btn primary" onClick={accept}>Acepto y quiero usar el asistente</button>
        </div>
      ) : (
        <>
          <h3 className="sec-t">Pregúntame</h3>

          {msgs.length === 0 && loaded && (
            <div style={{ marginBottom: '.6rem' }}>
              {chips.map(c => <button key={c} className="chipbtn" disabled={busy} onClick={() => send(c)}>{c}</button>)}
            </div>
          )}

          {urgent && (
            <div className="urgent"><b>Si es una emergencia, no esperes.</b> Con dolor u opresión en el pecho, falta de aire, desmayo, pérdida de control de la orina o las heces, o si piensas en hacerte daño, llama al 911 o acude a urgencias ahora.</div>
          )}

          <div className="chat-list">
            {msgs.map((m, i) => (
              <div key={i} className={`bub ${m.role === 'user' ? 'user' : 'bot'}`}>
                {m.role === 'user' ? <p>{m.content}</p> : <Rich text={m.content} />}
              </div>
            ))}
            {busy && <div className="bub bot typing"><span /><span /><span /></div>}
            {err && <div className="warn">{err}</div>}
            <div ref={endRef} />
          </div>

          {msgs.length > 0 && !busy && (
            <div style={{ margin: '.4rem 0' }}>
              {chips.slice(0, 3).map(c => <button key={c} className="chipbtn" onClick={() => send(c)}>{c}</button>)}
            </div>
          )}

          {msgs.length > 0 && (askClear ? (
            <div className="row">
              <button className="btn dlg-out" onClick={clear}>Sí, borrar</button>
              <button className="btn" onClick={() => setAskClear(false)}>Cancelar</button>
            </div>
          ) : <button className="link" onClick={() => setAskClear(true)}>Borrar conversación</button>)}

          <p className="hint">Respuestas generadas por IA; pueden fallar. No sustituyen a un profesional de la salud.</p>

          <div className="chat-in">
            <input placeholder={online ? 'Escribe tu pregunta…' : 'Sin internet'} value={input} maxLength={1000} disabled={!online}
              onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') send(input) }} />
            <button className="chat-send" disabled={busy || !input.trim() || !online} onClick={() => send(input)} aria-label="Enviar"><Icon name="send" size={20} /></button>
          </div>
        </>
      )}
    </div>
  )
}