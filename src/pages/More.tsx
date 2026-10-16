import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Icon from '../components/Icons'

export default function More() {
  return (
    <>
      <h1>Más</h1>
      <div className="menu">
        <Link to="/app/mas/cuenta"><span className="ic"><Icon name="user" /></span>Cuenta<i><Icon name="chevron" size={18} /></i></Link>
        <Link to="/app/nutricion/perfil"><span className="ic"><Icon name="food" /></span>Editar perfil nutricional<i><Icon name="chevron" size={18} /></i></Link>
        <Link to="/app/lesiones/perfil"><span className="ic"><Icon name="shield" /></span>Editar perfil de prevención<i><Icon name="chevron" size={18} /></i></Link>
        <Link to="/app/suplementos/perfil"><span className="ic"><Icon name="pill" /></span>Editar perfil de suplementos<i><Icon name="chevron" size={18} /></i></Link>
        <button onClick={() => supabase.auth.signOut()}><span className="ic"><Icon name="logout" /></span>Cerrar sesión</button>
      </div>
      <p className="hint">MioGym ofrece información general y no sustituye la valoración de un profesional de la salud.</p>
    </>
  )
}