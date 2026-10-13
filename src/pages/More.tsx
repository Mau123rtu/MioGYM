import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function More() {
  return (
    <>
      <h1>Más</h1>
      <div className="menu">
        <Link to="/app/mas/cuenta"><span className="ic">👤</span>Cuenta</Link>
        <Link to="/app/ejercicios/perfil"><span className="ic">📋</span>Editar perfil de rutinas</Link>
        <Link to="/app/nutricion/perfil"><span className="ic">🍎</span>Editar perfil nutricional</Link>
        <Link to="/app/lesiones/perfil"><span className="ic">🩹</span>Editar perfil de prevención</Link>
        <Link to="/app/suplementos/perfil"><span className="ic">💊</span>Editar perfil de suplementos</Link>
        <button onClick={() => supabase.auth.signOut()}><span className="ic">🚪</span>Cerrar sesión</button>
      </div>
      <p className="hint">MioGym ofrece información general y no sustituye la valoración de un profesional de la salud.</p>
    </>
  )
}