import { useEffect, useState } from 'react'
import Icon from './Icons'

interface BIP extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

export default function InstallApp() {
  const [evt, setEvt] = useState<BIP | null>(null)
  const [installed, setInstalled] = useState(window.matchMedia('(display-mode: standalone)').matches)
  const [help, setHelp] = useState(false)
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)

  useEffect(() => {
    const on = (e: Event) => { e.preventDefault(); setEvt(e as BIP) }
    const done = () => { setInstalled(true); setEvt(null) }
    window.addEventListener('beforeinstallprompt', on)
    window.addEventListener('appinstalled', done)
    return () => { window.removeEventListener('beforeinstallprompt', on); window.removeEventListener('appinstalled', done) }
  }, [])

  if (installed) return <p className="hint">MioGym ya está instalada en este dispositivo.</p>

  return (
    <>
      {evt ? (
        <button className="btn primary" onClick={async () => { await evt.prompt(); await evt.userChoice; setEvt(null) }}>
          <Icon name="plus" size={16} /> Instalar MioGym
        </button>
      ) : (
        <button className="btn" onClick={() => setHelp(h => !h)}>¿Cómo instalar MioGym?</button>
      )}
      {help && !evt && (
        <div className="card">
          {ios
            ? <p className="hint" style={{ margin: 0 }}>En iPhone o iPad, abre esta página en <b>Safari</b>, toca el botón <b>Compartir</b> y elige <b>Agregar a pantalla de inicio</b>.</p>
            : <p className="hint" style={{ margin: 0 }}>En Android (Chrome), abre el menú ⋮ y elige <b>Instalar app</b> o <b>Agregar a pantalla de inicio</b>. En computadora, busca el ícono de instalar en la barra de direcciones.</p>}
        </div>
      )}
    </>
  )
}