import { NavLink, Outlet } from 'react-router-dom'

const tabs = [
  { to: '/app', end: true, icon: '🏠', label: 'Inicio' },
  { to: '/app/ejercicios', icon: '🏋️', label: 'Ejercicios' },
  { to: '/app/nutricion', icon: '🥗', label: 'Nutrición' },
  { to: '/app/lesiones', icon: '🩹', label: 'Lesiones' },
  { to: '/app/suplementos', icon: '💊', label: 'Suplem.' },
  { to: '/app/mas', icon: '☰', label: 'Más' },
]

export default function Layout() {
  return (
    <div className="app">
      <main className="content"><Outlet /></main>
      <nav className="bottom-nav">
        {tabs.map(t => (
          <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => (isActive ? 'tab active' : 'tab')}>
            <span>{t.icon}</span><small>{t.label}</small>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}