import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import TermsText from './TermsText'
import { TERMS_VERSION } from '../lib/terms'

export default function TermsGate() {
  const { profile, refreshProfile } = useAuth()
  const [ok, setOk] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  if (!profile || profile.terms_version === TERMS_VERSION) return null

  const accept = async () => {
    setBusy(true); setErr('')
    const { error } = await supabase.from('profiles')
      .update({ terms_accepted_at: new Date().toISOString(), terms_version: TERMS_VERSION }).eq('id', profile.id)
    setBusy(false)
    if (error) { setErr(error.message); return }
    await refreshProfile()
  }

  return (
    <div className="dlg-bg top">
      <div className="dlg terms-dlg" role="dialog" aria-label="Términos y condiciones">
        <h3>Términos y condiciones</h3>
        <p style={{ marginBottom: '.5rem' }}>Para seguir usando MioGym, lee y acepta los términos.</p>
        <div className="terms-scroll"><TermsText /></div>
        <label className="chkline">
          <input type="checkbox" checked={ok} onChange={e => setOk(e.target.checked)} />
          <span>He leído y acepto los Términos y condiciones y la política de privacidad.</span>
        </label>
        {err && <p className="error">{err}</p>}
        <button className="btn primary" disabled={!ok || busy} onClick={accept}>{busy ? 'Guardando…' : 'Aceptar y continuar'}</button>
        <button className="link" onClick={() => supabase.auth.signOut()}>No acepto, cerrar sesión</button>
      </div>
    </div>
  )
}