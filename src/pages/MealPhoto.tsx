import { useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Icon from '../components/Icons'
import { FOODS, VERDICT_LABEL, judge, norm, toItem, totals, type Food, type Item, type VerdictKind } from '../lib/foodDb'

const MEALS: [string, string][] = [['desayuno', 'Desayuno'], ['comida', 'Comida'], ['colacion', 'Colación'], ['cena', 'Cena']]

interface Result { dish: string; items: Item[]; verdict: VerdictKind; reasons: string[]; tips: string[]; source: 'ia' | 'estimado'; confidence?: string }

async function resize(file: File, max = 1024): Promise<{ blob: Blob; b64: string }> {
  const bmp = await createImageBitmap(file)
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k)
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
  const blob = await new Promise<Blob>((res, rej) =>
    c.toBlob(b => (b ? res(b) : rej(new Error('No se pudo procesar la imagen'))), 'image/jpeg', 0.8))
  const b64 = await new Promise<string>(res => {
    const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.readAsDataURL(blob)
  })
  return { blob, b64 }
}

const arr = (x: unknown) => (Array.isArray(x) ? x.slice(0, 5).map(s => String(s).slice(0, 220)) : [])
const clamp = (x: unknown, max: number) => Math.min(max, Math.max(0, Number(x) || 0))

export default function MealPhoto({ day, defaultMeal, phase, onClose, onSaved }: {
  day: string; defaultMeal: string; phase?: string; onClose: () => void; onSaved: () => void
}) {
  const { session } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<'form' | 'ing' | 'result'>('form')
  const [meal, setMeal] = useState(defaultMeal)
  const [time, setTime] = useState(new Date().toTimeString().slice(0, 5))
  const [notes, setNotes] = useState('')
  const [img, setImg] = useState<{ blob: Blob; b64: string; url: string } | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [res, setRes] = useState<Result | null>(null)
  const [kcalE, setKcalE] = useState('')
  const [protE, setProtE] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const [q, setQ] = useState('')
  const [pick, setPick] = useState<Food | null>(null)
  const [qty, setQty] = useState('1')
  const [unit, setUnit] = useState('g')
  const [cName, setCName] = useState('')
  const [cK, setCK] = useState('')
  const [cP, setCP] = useState('')

  const found = useMemo(() => {
    const s = norm(q.trim())
    return (s ? FOODS.filter(f => norm(f.n).includes(s)) : FOODS.slice(0, 8)).slice(0, 8)
  }, [q])

  const show = (r: Result) => {
    const t = totals(r.items)
    setRes(r); setKcalE(String(Math.round(t.kcal))); setProtE(String(Math.round(t.p)))
    setStep('result'); window.scrollTo(0, 0)
  }

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (!f.type.startsWith('image/')) { setErr('Elige un archivo de imagen.'); return }
    try {
      const r = await resize(f)
      if (img) URL.revokeObjectURL(img.url)
      setImg({ ...r, url: URL.createObjectURL(r.blob) }); setErr('')
    } catch (x: any) { setErr(x.message ?? 'No se pudo leer la imagen. Prueba con JPG o PNG.') }
  }

  const analyze = async () => {
    if (!img) return
    setBusy(true); setErr('')
    const { data, error } = await supabase.functions.invoke('analyze-meal', {
      body: { image: img.b64, mediaType: 'image/jpeg', notes: notes.trim(), meal, phase },
    })
    setBusy(false)
    if (error || !data || data.error) { setErr('No pudimos analizar la foto con IA ahora mismo. Puedes calcularla por ingredientes.'); return }
    if (data.isFood === false) { setErr('No parece haber comida en la foto. Prueba con otra o calcula por ingredientes.'); return }
    const its: Item[] = (Array.isArray(data.items) ? data.items : []).slice(0, 15).map((i: any) => ({
      name: String(i.name ?? '').slice(0, 60) || 'Ingrediente',
      grams: i.grams ? clamp(i.grams, 3000) : null,
      kcal: clamp(i.kcal, 3000), p: clamp(i.protein, 300), c: clamp(i.carbs, 500), f: clamp(i.fat, 300),
    }))
    if (!its.length) { setErr('La IA no pudo identificar ingredientes. Calcúlalo por ingredientes.'); return }
    const verdict: VerdictKind = ['equilibrado', 'aceptable', 'mejorable'].includes(data.verdict) ? data.verdict : 'aceptable'
    setItems(its)
    show({ dish: String(data.dish ?? '').slice(0, 80) || 'Comida', items: its, verdict, reasons: arr(data.reasons), tips: arr(data.suggestions), source: 'ia', confidence: data.confidence })
  }

  const fromItems = () => {
    const j = judge(items, meal)
    const dish = notes.trim().slice(0, 80) || items.slice(0, 3).map(i => i.name).join(', ')
    show({ dish, items, verdict: j.kind, reasons: j.reasons, tips: j.tips, source: 'estimado' })
  }

  const addIng = () => {
    if (!pick) return
    const n = Number(qty)
    if (!(n > 0)) return
    const grams = unit === 'g' ? n : n * (pick.u?.[1] ?? 100)
    setItems(it => [...it, toItem(pick, grams)])
    setPick(null); setQ('')
  }
  const addCustom = () => {
    if (!cName.trim()) return
    setItems(it => [...it, { name: cName.trim().slice(0, 60), grams: null, kcal: clamp(cK, 5000), p: clamp(cP, 500), c: 0, f: 0 }])
    setCName(''); setCK(''); setCP('')
  }

  const save = async () => {
    if (!res) return
    setBusy(true); setErr('')
    const uid = session!.user.id
    let path: string | null = null
    if (img) {
      path = `${uid}/${Date.now()}.jpg`
      const up = await supabase.storage.from('meal-photos').upload(path, img.blob, { contentType: 'image/jpeg' })
      if (up.error) { setBusy(false); setErr(up.error.message); return }
    }
    const t = totals(res.items)
    const { error } = await supabase.from('food_logs').insert({
      user_id: uid, meal, description: res.dish,
      logged_at: new Date(`${day}T${time}`).toISOString(),
      calories: Math.round(Number(kcalE)) || null, protein_g: Number(protE) || null,
      carbs_g: Math.round(t.c * 10) / 10, fat_g: Math.round(t.f * 10) / 10,
      photo_path: path, verdict: res.verdict, verdict_note: res.reasons.join(' '),
      source: res.source, items: res.items,
    })
    setBusy(false)
    if (error) {
      setErr(error.message)
      if (path) await supabase.storage.from('meal-photos').remove([path])
      return
    }
    onSaved()
  }

  /* ---------- Paso 1: foto y datos ---------- */
  if (step === 'form') return (
    <>
      <button className="back" onClick={onClose}>← Nutrición</button>
      <h2>Foto de mi comida</h2>
      <div className="row">
        <select value={meal} onChange={e => setMeal(e.target.value)}>{MEALS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        <input type="time" value={time} onChange={e => setTime(e.target.value)} />
      </div>

      <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
      {img ? (
        <div className="mphoto">
          <img src={img.url} alt="Tu comida" />
          <button className="qbtn" onClick={() => fileRef.current?.click()}><Icon name="camera" size={16} />Cambiar foto</button>
        </div>
      ) : (
        <button className="upbox" onClick={() => fileRef.current?.click()}>
          <Icon name="camera" size={30} /><b>Tomar o elegir foto</b><small>Opcional si calculas por ingredientes</small>
        </button>
      )}

      <textarea placeholder="Ingredientes o descripción (opcional). Ayuda a la IA a acertar." value={notes} onChange={e => setNotes(e.target.value)} />

      {err && <div className="warn">{err}</div>}
      <button className="btn primary" disabled={!img || busy} onClick={analyze}>
        <Icon name="spark" size={16} /> {busy ? 'Analizando…' : 'Analizar con IA'}
      </button>
      <button className="btn" disabled={busy} onClick={() => { setErr(''); setStep('ing') }}>Calcular por ingredientes</button>
      <p className="hint">Al pulsar "Analizar con IA", la foto se envía a un servicio de IA (Anthropic) solo para estimar tu comida. Tu foto se guarda de forma privada. Las cifras son estimaciones y pueden fallar.</p>
    </>
  )

  /* ---------- Paso 2: ingredientes ---------- */
  if (step === 'ing') {
    const t = totals(items)
    return (
      <>
        <button className="back" onClick={() => setStep('form')}>← Atrás</button>
        <h2>Ingredientes</h2>
        <p className="hint">Agrega lo que tiene tu plato. Calcularemos una estimación aproximada.</p>

        <input placeholder="Buscar ingrediente (pollo, arroz, frijoles…)" value={q} onChange={e => { setQ(e.target.value); setPick(null) }} />

        {pick ? (
          <div className="card">
            <b>{pick.n}</b>
            <div className="row">
              <input type="number" inputMode="decimal" value={qty} onChange={e => setQty(e.target.value)} />
              <select value={unit} onChange={e => { setUnit(e.target.value); setQty(e.target.value === 'g' ? String(pick.g) : '1') }}>
                <option value="g">gramos</option>
                {pick.u && <option value={pick.u[0]}>{pick.u[0]}(s)</option>}
              </select>
            </div>
            <button className="btn primary" onClick={addIng}>Agregar</button>
            <button className="link" onClick={() => setPick(null)}>Cancelar</button>
          </div>
        ) : (
          <div className="card" style={{ padding: '.2rem 1rem' }}>
            {found.length === 0 && <p className="hint">No está en la lista. Agrégalo como ingrediente propio abajo.</p>}
            {found.map(f => (
              <button key={f.n} className="frow" onClick={() => { setPick(f); setUnit('g'); setQty(String(f.g)) }}>
                <span>{f.n}</span><small>{f.kcal} kcal/100 g</small>
              </button>
            ))}
          </div>
        )}

        <h3 style={{ marginTop: '1rem' }}>Tu plato ({items.length})</h3>
        {items.length === 0 && <p className="hint">Aún no agregaste ingredientes.</p>}
        {items.length > 0 && (
          <div className="card" style={{ padding: '.2rem 1rem' }}>
            {items.map((i, k) => (
              <div className="exrow" key={k}>
                <div style={{ flex: 1 }}><b>{i.name}</b><small>{i.grams ? `${i.grams} g · ` : ''}{Math.round(i.kcal)} kcal · {Math.round(i.p)} g prot</small></div>
                <button className="mini-ic" onClick={() => setItems(it => it.filter((_, j) => j !== k))} aria-label="Quitar"><Icon name="x" size={16} /></button>
              </div>
            ))}
            <p className="hint" style={{ margin: '.6rem 0' }}>Total aproximado: <b style={{ color: 'var(--y)' }}>{Math.round(t.kcal)} kcal · {Math.round(t.p)} g proteína</b></p>
          </div>
        )}

        <div className="card">
          <h3>Ingrediente propio</h3>
          <input placeholder="Nombre" value={cName} onChange={e => setCName(e.target.value)} />
          <div className="row">
            <input type="number" inputMode="numeric" placeholder="Calorías" value={cK} onChange={e => setCK(e.target.value)} />
            <input type="number" inputMode="decimal" placeholder="Proteína g" value={cP} onChange={e => setCP(e.target.value)} />
          </div>
          <button className="btn" disabled={!cName.trim()} onClick={addCustom}>Agregar</button>
        </div>

        <button className="btn primary" disabled={items.length === 0} onClick={fromItems}>Calcular</button>
      </>
    )
  }

  /* ---------- Paso 3: resultado ---------- */
  const r = res!
  const t = totals(r.items)
  return (
    <>
      <button className="back" onClick={() => setStep('form')}>← Atrás</button>
      <h2>{r.dish}</h2>
      {img && <div className="mphoto"><img src={img.url} alt="Tu comida" /></div>}

      <div className={`vbox ${r.verdict}`}>
        <b>{VERDICT_LABEL[r.verdict]}</b>
        <span>{r.source === 'ia' ? 'Estimado por IA' : 'Estimado por ingredientes'}{r.confidence ? ` · confianza ${r.confidence}` : ''}</span>
      </div>

      <div className="stats" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        <div className="stat"><b>{Math.round(t.kcal)}</b><small>kcal</small></div>
        <div className="stat"><b>{Math.round(t.p)}g</b><small>Proteína</small></div>
        <div className="stat"><b>{Math.round(t.c)}g</b><small>Carbos</small></div>
        <div className="stat"><b>{Math.round(t.f)}g</b><small>Grasa</small></div>
      </div>
      <p className="hint">Es una aproximación: las porciones y la preparación cambian mucho las cifras.</p>

      <div className="card">
        <h3>Ingredientes</h3>
        {r.items.map((i, k) => (
          <p key={k} className="logrow"><span>{i.name}{i.grams ? ` · ${i.grams} g` : ''}</span><b>{Math.round(i.kcal)} kcal</b></p>
        ))}
        <button className="link" style={{ marginTop: '.4rem' }} onClick={() => setStep('ing')}>Corregir ingredientes</button>
      </div>

      {r.reasons.length > 0 && <div className="card"><h3>Por qué</h3>{r.reasons.map((x, i) => <p key={i} className="hint">• {x}</p>)}</div>}
      {r.tips.length > 0 && <div className="card"><h3>Ideas para mejorarla</h3>{r.tips.map((x, i) => <p key={i} className="hint">• {x}</p>)}</div>}

      <div className="card">
        <h3>Ajustar antes de guardar</h3>
        <div className="row">
          <label style={{ flex: 1 }}><span className="hint">Calorías</span><input type="number" inputMode="numeric" value={kcalE} onChange={e => setKcalE(e.target.value)} /></label>
          <label style={{ flex: 1 }}><span className="hint">Proteína (g)</span><input type="number" inputMode="decimal" value={protE} onChange={e => setProtE(e.target.value)} /></label>
        </div>
      </div>

      {err && <p className="error">{err}</p>}
      <button className="btn primary" disabled={busy} onClick={save}>{busy ? 'Guardando…' : 'Guardar en mi registro'}</button>
      <p className="hint">Esta valoración es orientativa y no sustituye a un nutriólogo.</p>
    </>
  )
}