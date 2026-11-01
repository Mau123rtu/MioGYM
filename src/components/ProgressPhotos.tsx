import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { calcAge } from '../lib/utils'
import { resizeJpeg } from '../lib/image'
import Icon from './Icons'
import { MFIELDS, MIN_DAYS, feedback, periodStats, useProgressData, weightAt, type Tip } from '../lib/progress'

interface Photo { id: number; angle: string; path: string; taken_at: string }
const ANGLES: [string, string][] = [['frente', 'Frente'], ['lado', 'Lado'], ['espalda', 'Espalda']]
const ALABEL = Object.fromEntries(ANGLES)
const today = () => new Date().toLocaleDateString('en-CA')
const d12 = (s: string) => new Date(`${s}T12:00:00`)
const fmt = (s: string) => d12(s).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })
const monthName = (k: string) => new Date(`${k}-01T12:00:00`).toLocaleDateString('es', { month: 'long', year: 'numeric' })
const r1 = (x: number) => Math.round(x * 10) / 10
const sgn = (x: number) => `${x > 0 ? '+' : ''}${r1(x)}`

function Tips({ tips }: { tips: Tip[] }) {
  return <>{tips.map((t, i) => <div key={i} className={t.kind === 'warn' ? 'urgent' : t.kind === 'tip' ? 'warn' : 'okbox'}>{t.text}</div>)}</>
}

export default function ProgressPhotos() {
  const { session, profile } = useAuth()
  const data = useProgressData()
  const fileRef = useRef<HTMLInputElement>(null)
  const [photos, setPhotos] = useState<Photo[] | null>(null)
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [tab, setTab] = useState<'fotos' | 'comparar' | 'semanal'>('fotos')
  const [angle, setAngle] = useState('frente')
  const [filter, setFilter] = useState('todas')
  const [date, setDate] = useState(today())
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [view, setView] = useState<Photo | null>(null)
  const [cA, setCA] = useState('frente')
  const [bId, setBId] = useState<number | null>(null)
  const [aId, setAId] = useState<number | null>(null)

  const load = async () => {
    const { data: rows } = await supabase.from('progress_photos').select('*')
      .order('taken_at', { ascending: true }).order('created_at', { ascending: true }).limit(300)
    const list = (rows as Photo[]) ?? []
    setPhotos(list)
    if (!list.length) { setUrls({}); return }
    const { data: s } = await supabase.storage.from('progress-photos').createSignedUrls(list.map(p => p.path), 3600)
    const m: Record<string, string> = {}
    s?.forEach(x => { if (x.path && x.signedUrl) m[x.path] = x.signedUrl })
    setUrls(m)
  }
  useEffect(() => { load() }, [])

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (!f.type.startsWith('image/')) { setMsg('Elige un archivo de imagen.'); return }
    if (f.size > 25 * 1024 * 1024) { setMsg('La imagen pesa demasiado (máximo 25 MB).'); return }
    setBusy(true); setMsg('')
    try {
      const uid = session!.user.id
      const path = `${uid}/${angle}-${Date.now()}.jpg`
      const up = await supabase.storage.from('progress-photos').upload(path, await resizeJpeg(f), { contentType: 'image/jpeg' })
      if (up.error) throw up.error
      const ins = await supabase.from('progress_photos').insert({ user_id: uid, angle, path, taken_at: date })
      if (ins.error) { await supabase.storage.from('progress-photos').remove([path]); throw ins.error }
      await load()
      setMsg(`Foto de ${ALABEL[angle].toLowerCase()} guardada.`)
    } catch (err: any) { setMsg(err.message ?? 'No se pudo subir la foto. Prueba con JPG o PNG.') }
    finally { setBusy(false) }
  }

  const del = async (p: Photo) => {
    if (!window.confirm('¿Eliminar esta foto?')) return
    await supabase.storage.from('progress-photos').remove([p.path])
    await supabase.from('progress_photos').delete().eq('id', p.id)
    setView(null); setBId(null); setAId(null); load()
  }

  const age = calcAge(profile?.birth_date ?? null)
  const target = MIN_DAYS[profile?.days_per_week ?? '3-4'] ?? 3
  const weightKg = Number(profile?.weight_kg) || 70

  /* ---- Fotos por mes ---- */
  const shown = (photos ?? []).filter(p => filter === 'todas' || p.angle === filter)
  const months = useMemo(() => {
    const m = new Map<string, Photo[]>()
    shown.forEach(p => { const k = p.taken_at.slice(0, 7); m.set(k, [...(m.get(k) ?? []), p]) })
    return [...m.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1))
  }, [photos, filter])

  /* ---- Comparar ---- */
  const list = (photos ?? []).filter(p => p.angle === cA)
  let before = list.find(p => p.id === bId) ?? list[0]
  let after = list.find(p => p.id === aId) ?? list[list.length - 1]
  if (before && after && before.taken_at > after.taken_at) [before, after] = [after, before]
  const near = (days: number) => {
    if (!after) return
    const t = d12(after.taken_at).getTime() - days * 86400000
    const c = list.filter(p => p.id !== after!.id).sort((a, b) => Math.abs(d12(a.taken_at).getTime() - t) - Math.abs(d12(b.taken_at).getTime() - t))[0]
    if (c) { setBId(c.id); setAId(after.id) }
  }
  const cmp = before && after && before.id !== after.id ? (() => {
    const st = periodStats(data, d12(before.taken_at), d12(after.taken_at))
    return { st, tips: feedback({ goal: profile?.goal ?? null, target, st, weightKg, age }) }
  })() : null

  /* ---- Semanal ---- */
  const weekly = useMemo(() => {
    const now = new Date(); now.setHours(0, 0, 0, 0)
    const mon = new Date(now); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7))
    const rows = [0, 1, 2, 3].map(k => {
      const s = new Date(mon); s.setDate(s.getDate() - 7 * k)
      const e = new Date(s); e.setDate(e.getDate() + 6)
      const end = e > now ? now : e
      const st = periodStats(data, s, end)
      const w = weightAt(data, end.getTime())
      const wPrev = weightAt(data, s.getTime() - 86400000)
      return { s, end, st, w, dw: w !== null && wPrev !== null ? w - wPrev : null, cur: k === 0 }
    })
    const all = periodStats(data, rows[3].s, now)
    return { rows, tips: feedback({ goal: profile?.goal ?? null, target, st: all, weightKg, age }) }
  }, [data.weights, data.meas, data.sess, data.logs, target])

  return (
    <>
      <div className="tabs t3" style={{ marginTop: '.4rem' }}>
        <button className={tab === 'fotos' ? 'on' : ''} onClick={() => setTab('fotos')}>Fotos</button>
        <button className={tab === 'comparar' ? 'on' : ''} onClick={() => setTab('comparar')}>Comparar</button>
        <button className={tab === 'semanal' ? 'on' : ''} onClick={() => setTab('semanal')}>Semanal</button>
      </div>

      {/* ---------- FOTOS ---------- */}
      {tab === 'fotos' && (
        <>
          <div className="pbox">
            <h4 className="ph">Agregar foto de progreso</h4>
            <div>{ANGLES.map(([k, l]) => <button key={k} className={`chipbtn${angle === k ? ' on' : ''}`} onClick={() => setAngle(k)}>{l}</button>)}</div>
            <label><span className="hint">Fecha de la foto</span><input type="date" max={today()} value={date} onChange={e => e.target.value && setDate(e.target.value)} /></label>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
            <button className="btn primary" disabled={busy} onClick={() => fileRef.current?.click()}>
              <Icon name="camera" size={16} /> {busy ? 'Subiendo…' : `Elegir foto de ${ALABEL[angle].toLowerCase()}`}
            </button>
            {msg && <p className="hint">{msg}</p>}
            <p className="hint" style={{ marginBottom: 0 }}>Para que sirva al comparar: misma luz, misma distancia, ropa parecida y cuerpo relajado. Tus fotos son privadas.</p>
          </div>

          <div style={{ margin: '.8rem 0 .2rem' }}>
            {[['todas', 'Todas'], ...ANGLES].map(([k, l]) => <button key={k} className={`chipbtn${filter === k ? ' on' : ''}`} onClick={() => setFilter(k)}>{l}</button>)}
          </div>
          {photos === null && <p className="hint">Cargando...</p>}
          {photos && shown.length === 0 && <p className="hint">Aún no hay fotos. Sube la primera para empezar a comparar tu progreso.</p>}
          {months.map(([k, ps]) => (
            <div key={k}>
              <h4 className="ph" style={{ textTransform: 'capitalize', marginTop: '.8rem' }}>{monthName(k)}</h4>
              <div className="pgrid">
                {ps.map(p => (
                  <button className="pthumb" key={p.id} onClick={() => setView(p)}>
                    {urls[p.path] ? <img src={urls[p.path]} alt={`${ALABEL[p.angle]} ${p.taken_at}`} /> : <span />}
                    <small>{ALABEL[p.angle]} · {d12(p.taken_at).getDate()}</small>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      {/* ---------- COMPARAR ---------- */}
      {tab === 'comparar' && (
        <>
          <p className="hint" style={{ marginTop: 0 }}>Compara dos fotos del mismo ángulo, por ejemplo mes por mes.</p>
          <div>{ANGLES.map(([k, l]) => <button key={k} className={`chipbtn${cA === k ? ' on' : ''}`} onClick={() => { setCA(k); setBId(null); setAId(null) }}>{l}</button>)}</div>

          {list.length < 2 ? (
            <div className="warn">Necesitas al menos 2 fotos de {ALABEL[cA].toLowerCase()} para comparar. Tienes {list.length}. Sube otra en la pestaña Fotos.</div>
          ) : before && after && (
            <>
              <div>
                <button className="chipbtn" onClick={() => near(30)}>Hace 1 mes</button>
                <button className="chipbtn" onClick={() => near(90)}>Hace 3 meses</button>
                <button className="chipbtn" onClick={() => { setBId(list[0].id); setAId(list[list.length - 1].id) }}>La primera foto</button>
              </div>
              <div className="cmp">
                {[['Antes', before], ['Después', after]].map(([lab, p]) => (
                  <figure key={String(lab)}>
                    <button onClick={() => setView(p as Photo)} aria-label={`Ver foto ${lab}`}>
                      {urls[(p as Photo).path] ? <img src={urls[(p as Photo).path]} alt={`${lab}`} /> : <span />}
                    </button>
                    <figcaption><b>{String(lab)}</b><small>{fmt((p as Photo).taken_at)}</small></figcaption>
                  </figure>
                ))}
              </div>
              <div className="row">
                <label style={{ flex: 1 }}><span className="hint">Antes</span>
                  <select value={before.id} onChange={e => setBId(Number(e.target.value))}>{list.map(p => <option key={p.id} value={p.id}>{fmt(p.taken_at)}</option>)}</select></label>
                <label style={{ flex: 1 }}><span className="hint">Después</span>
                  <select value={after.id} onChange={e => setAId(Number(e.target.value))}>{list.map(p => <option key={p.id} value={p.id}>{fmt(p.taken_at)}</option>)}</select></label>
              </div>

              {cmp && (
                <>
                  <div className="kv" style={{ marginTop: '.6rem' }}>
                    <div><small>Tiempo entre fotos</small><b>{cmp.st.days} días</b></div>
                    <div><small>Entrenos hechos</small><b>{cmp.st.sessions}</b></div>
                    <div><small>Cambio de peso</small><b>{cmp.st.weightDelta === null ? '–' : `${sgn(cmp.st.weightDelta)} kg`}</b></div>
                    <div><small>Medidas</small><b>{MFIELDS.filter(([k]) => cmp.st.deltas[k] !== undefined).map(([k, l]) => `${l} ${sgn(cmp.st.deltas[k]!)}`).join(' · ') || '–'}</b></div>
                  </div>
                  <h4 className="ph" style={{ marginTop: '1rem' }}>¿Cómo vas?</h4>
                  <Tips tips={cmp.tips} />
                </>
              )}
            </>
          )}
        </>
      )}

      {/* ---------- SEMANAL ---------- */}
      {tab === 'semanal' && (
        <>
          <p className="hint" style={{ marginTop: 0 }}>Tus últimas 4 semanas (de lunes a domingo).</p>
          <div className="hscroll in">
            {weekly.rows.map(w => (
              <div className="mcard" key={w.s.getTime()}>
                <small>{w.cur ? 'Esta semana' : `Semana del ${w.s.toLocaleDateString('es', { day: 'numeric', month: 'short' })}`}</small>
                <b>{w.st.sessions}<span> / {target} entrenos</span></b>
                <div className="hbar"><i style={{ width: `${Math.min(100, (w.st.sessions / target) * 100)}%` }} /></div>
                <small>{w.w !== null ? `Peso: ${r1(w.w)} kg` : 'Sin peso registrado'}</small>
                {w.dw !== null && w.dw !== 0 && <span className="pill">{w.dw > 0 ? '▲' : '▼'} {sgn(w.dw)} kg vs semana anterior</span>}
              </div>
            ))}
          </div>
          <h4 className="ph">Resumen de las últimas 4 semanas</h4>
          <Tips tips={weekly.tips} />
        </>
      )}

      {view && (
        <div className="viewer" onClick={() => setView(null)}>
          <div className="viewer-in" onClick={e => e.stopPropagation()}>
            {urls[view.path] && <img src={urls[view.path]} alt="Foto de progreso" />}
            <p className="hint" style={{ textAlign: 'center', margin: '.4rem 0' }}>{ALABEL[view.angle]} · {fmt(view.taken_at)}</p>
            <button className="btn dlg-out" onClick={() => del(view)}><Icon name="trash" size={16} /> Eliminar foto</button>
            <button className="link" onClick={() => setView(null)}>Cerrar</button>
          </div>
        </div>
      )}
    </>
  )
}