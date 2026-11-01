import { useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Icon from '../components/Icons'
import { KINDS, PRESETS, type Kind } from '../lib/suppDb'

interface Row { name: string; amount: string; unit: string }
const UNITS = ['mg', 'g', 'mcg', 'UI', 'ml']

async function resize(file: File, max = 1280): Promise<{ blob: Blob; url: string }> {
  const bmp = await createImageBitmap(file)
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k)
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
  const blob = await new Promise<Blob>((res, rej) =>
    c.toBlob(b => (b ? res(b) : rej(new Error('No se pudo procesar la imagen'))), 'image/jpeg', 0.82))
  return { blob, url: URL.createObjectURL(blob) }
}

export default function SupplementAdd({ onClose, onSaved }: { onClose: () => void; onSaved: (id: number) => void }) {
  const { session } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)
  const [img, setImg] = useState<{ blob: Blob; url: string } | null>(null)
  const [name, setName] = useState('')
  const [brand, setBrand] = useState('')
  const [kind, setKind] = useState<Kind | ''>('')
  const [serving, setServing] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [prop, setProp] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (!f.type.startsWith('image/')) { setErr('Elige un archivo de imagen.'); return }
    try {
      const r = await resize(f)
      if (img) URL.revokeObjectURL(img.url)
      setImg(r); setErr('')
    } catch (x: any) { setErr(x.message ?? 'No se pudo leer la imagen. Prueba con JPG o PNG.') }
  }

  const pickKind = (k: Kind) => {
    setKind(k)
    // Si aún no hay ingredientes, propone los típicos de ese tipo
    if (rows.length === 0 && PRESETS[k]) {
      setRows(PRESETS[k]!.map(i => ({ name: i.name, amount: String(i.amount ?? ''), unit: i.unit })))
    }
  }

  const setRow = (i: number, p: Partial<Row>) => setRows(r => r.map((x, k) => (k === i ? { ...x, ...p } : x)))

  const save = async () => {
    if (!kind) return
    setBusy(true); setErr('')
    const uid = session!.user.id
    let path: string | null = null
    if (img) {
      path = `${uid}/${Date.now()}.jpg`
      const up = await supabase.storage.from('supplement-photos').upload(path, img.blob, { contentType: 'image/jpeg' })
      if (up.error) { setBusy(false); setErr(up.error.message); return }
    }
    const ingredients = rows.filter(r => r.name.trim()).map(r => {
      const n = r.amount.trim() === '' ? NaN : Number(r.amount.replace(',', '.'))
      return { name: r.name.trim().slice(0, 60), amount: Number.isFinite(n) && n >= 0 ? n : null, unit: r.unit }
    })
    const { data, error } = await supabase.from('supplement_items').insert({
      user_id: uid, name: name.trim(), brand: brand.trim() || null, kind, serving: serving.trim() || null,
      ingredients, proprietary: prop, photo_path: path,
    }).select('id').single()
    setBusy(false)
    if (error || !data) {
      setErr(error?.message ?? 'No se pudo guardar')
      if (path) await supabase.storage.from('supplement-photos').remove([path])
      return
    }
    onSaved(data.id)
  }

  return (
    <>
      <button className="back" onClick={onClose}>← Suplementos</button>
      <h2>Agregar suplemento</h2>
      <p className="hint">Escribe los datos que ves en la etiqueta. Al elegir el tipo te proponemos los ingredientes más comunes para que solo ajustes las cantidades.</p>

      <input placeholder="Nombre del producto" value={name} onChange={e => setName(e.target.value)} />
      <input placeholder="Marca (opcional)" value={brand} onChange={e => setBrand(e.target.value)} />

      <h3 style={{ marginTop: '1rem' }}>Tipo de suplemento</h3>
      <div>
        {(Object.keys(KINDS) as Kind[]).map(k => (
          <button key={k} className={`chipbtn${kind === k ? ' on' : ''}`} onClick={() => pickKind(k)}>{KINDS[k].label}</button>
        ))}
      </div>

      <input placeholder="Porción (ej. 1 scoop = 10 g)" value={serving} onChange={e => setServing(e.target.value)} />

      <h3 style={{ marginTop: '1rem' }}>Ingredientes por porción</h3>
      {rows.length === 0 && <p className="hint">Elige un tipo para ver ingredientes sugeridos, o agrégalos tú.</p>}
      {rows.length > 0 && kind && PRESETS[kind] && <p className="hint">Son valores de ejemplo. Cámbialos por los de tu etiqueta.</p>}
      {rows.map((r, i) => (
        <div className="irow" key={i}>
          <input placeholder="Ingrediente" value={r.name} onChange={e => setRow(i, { name: e.target.value })} />
          <input type="number" inputMode="decimal" placeholder="Cant." value={r.amount} onChange={e => setRow(i, { amount: e.target.value })} />
          <select value={r.unit} onChange={e => setRow(i, { unit: e.target.value })}>{UNITS.map(u => <option key={u}>{u}</option>)}</select>
          <button className="mini-ic" onClick={() => setRows(x => x.filter((_, k) => k !== i))} aria-label="Quitar"><Icon name="x" size={16} /></button>
        </div>
      ))}
      <button className="btn" onClick={() => setRows(r => [...r, { name: '', amount: '', unit: 'mg' }])}><Icon name="plus" size={16} /> Agregar ingrediente</button>

      <label className="chkline">
        <input type="checkbox" checked={prop} onChange={e => setProp(e.target.checked)} />
        <span>La etiqueta tiene una "mezcla propietaria" (no indica la cantidad de cada ingrediente).</span>
      </label>

      <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
      {img ? (
        <div className="mphoto">
          <img src={img.url} alt="Etiqueta" />
          <button className="qbtn" onClick={() => fileRef.current?.click()}><Icon name="camera" size={16} />Cambiar foto</button>
        </div>
      ) : (
        <button className="upbox" onClick={() => fileRef.current?.click()}>
          <Icon name="camera" size={26} /><b>Guardar foto de la etiqueta (opcional)</b>
          <small>Solo se guarda de forma privada, no se analiza</small>
        </button>
      )}

      {err && <p className="error">{err}</p>}
      <button className="btn primary" disabled={!name.trim() || !kind || busy} onClick={save}>
        {busy ? 'Guardando…' : 'Guardar y ver análisis'}
      </button>
    </>
  )
}