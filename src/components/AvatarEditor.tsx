import { useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { toSquareJpeg } from '../lib/image'
import Icon from './Icons'

export default function AvatarEditor({ size = 78 }: { size?: number }) {
  const { profile, session, refreshProfile } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [ask, setAsk] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const url = profile?.avatar_url

  const flash = (t: string) => { setMsg(t); setTimeout(() => setMsg(''), 3000) }

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (!f.type.startsWith('image/')) { flash('Elige un archivo de imagen.'); return }
    if (f.size > 15 * 1024 * 1024) { flash('La imagen pesa demasiado (máximo 15 MB).'); return }
    setBusy(true)
    try {
      const uid = session!.user.id
      const path = `${uid}/avatar.jpg`
      const up = await supabase.storage.from('avatars').upload(path, await toSquareJpeg(f), { upsert: true, contentType: 'image/jpeg' })
      if (up.error) throw up.error
      const link = `${supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl}?v=${Date.now()}`
      const { error } = await supabase.from('profiles').update({ avatar_url: link }).eq('id', uid)
      if (error) throw error
      await refreshProfile()
      flash('Foto actualizada')
    } catch (err: any) {
      flash(err.message ?? 'No se pudo subir la foto. Prueba con JPG o PNG.')
    } finally { setBusy(false) }
  }

  const remove = async () => {
    setBusy(true)
    const uid = session!.user.id
    await supabase.storage.from('avatars').remove([`${uid}/avatar.jpg`])
    await supabase.from('profiles').update({ avatar_url: null }).eq('id', uid)
    await refreshProfile()
    setBusy(false); setAsk(false); setOpen(false)
    flash('Foto eliminada')
  }

  return (
    <>
      <button className="av-btn" style={{ width: size, height: size }} disabled={busy}
        onClick={() => (url ? setOpen(true) : fileRef.current?.click())}
        aria-label={url ? 'Ver foto de perfil' : 'Poner foto de perfil'}>
        {url ? <img src={url} alt="Foto de perfil" /> : <span className="av-empty"><Icon name="camera" size={22} /><small>Poner foto</small></span>}
      </button>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />

      {open && url && (
        <div className="viewer" onClick={() => setOpen(false)}>
          <div className="viewer-in" onClick={e => e.stopPropagation()}>
            <img src={url} alt="Tu foto de perfil" />
            <div className="row">
              <button className="btn" disabled={busy} onClick={() => fileRef.current?.click()}><Icon name="camera" size={16} /> {busy ? 'Subiendo…' : 'Cambiar'}</button>
              <button className="btn dlg-out" disabled={busy} onClick={() => setAsk(true)}><Icon name="trash" size={16} /> Quitar</button>
            </div>
            <button className="link" onClick={() => setOpen(false)}>Cerrar</button>
          </div>
        </div>
      )}

      {ask && (
        <div className="dlg-bg top" onClick={() => !busy && setAsk(false)}>
          <div className="dlg" role="alertdialog" aria-label="Quitar foto de perfil" onClick={e => e.stopPropagation()}>
            <div className="dlg-ic"><Icon name="trash" size={26} /></div>
            <h3>¿Quitar tu foto de perfil?</h3>
            <p>Se eliminará tu foto y volverás a ver el botón <b>Poner foto</b>. Podrás subir otra cuando quieras.</p>
            <button className="btn primary" disabled={busy} onClick={() => setAsk(false)}>Conservar mi foto</button>
            <button className="btn dlg-out" disabled={busy} onClick={remove}>{busy ? 'Quitando…' : 'Sí, quitar foto'}</button>
          </div>
        </div>
      )}
      {msg && <div className="toast">{msg}</div>}
    </>
  )
}