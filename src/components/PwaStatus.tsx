import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { flushQueue, pendingCount } from '../lib/offline'

export function useOnline() {
  const [on, setOn] = useState(navigator.onLine)
  useEffect(() => {
    const a = () => setOn(true), b = () => setOn(false)
    window.addEventListener('online', a); window.addEventListener('offline', b)
    return () => { window.removeEventListener('online', a); window.removeEventListener('offline', b) }
  }, [])
  return on
}

export default function PwaStatus() {
  const online = useOnline()
  const [pending, setPending] = useState(pendingCount())
  const [synced, setSynced] = useState(0)
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW()

  useEffect(() => {
    const upd = () => setPending(pendingCount())
    window.addEventListener('queue-changed', upd)
    return () => window.removeEventListener('queue-changed', upd)
  }, [])

  useEffect(() => {
    const run = async () => {
      const n = await flushQueue()
      if (n > 0) { setSynced(n); setTimeout(() => setSynced(0), 4000) }
      setPending(pendingCount())
    }
    if (online) run()
    const id = setInterval(() => { if (navigator.onLine) run() }, 30000)
    return () => clearInterval(id)
  }, [online])

  return (
    <>
      {!online && (
        <div className="net-bar off">
          Sin conexión. Puedes seguir usando la app{pending > 0 ? ` · ${pending} registro${pending === 1 ? '' : 's'} por enviar` : ''}.
        </div>
      )}
      {online && pending > 0 && <div className="net-bar sync">Enviando {pending} registro{pending === 1 ? '' : 's'} guardado{pending === 1 ? '' : 's'}…</div>}
      {online && synced > 0 && pending === 0 && <div className="net-bar ok">Se sincronizaron {synced} registro{synced === 1 ? '' : 's'}.</div>}
      {needRefresh && (
        <div className="net-bar upd">
          <span>Hay una versión nueva de MioGym.</span>
          <button onClick={() => updateServiceWorker(true)}>Actualizar</button>
        </div>
      )}
    </>
  )
}