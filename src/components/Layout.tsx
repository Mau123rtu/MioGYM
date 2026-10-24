import { NavLink, Outlet } from 'react-router-dom'
import Icon from './Icons'
import { WorkoutProvider, useWorkout } from './Workout'
import MealReminderWatcher from './MealReminderWatcher'

const tabs = [
  { to: '/app', end: true, icon: 'home', label: 'Inicio' },
  { to: '/app/ejercicios', icon: 'dumbbell', label: 'Rutinas' },
  { to: '/app/nutricion', icon: 'food', label: 'Nutrición' },
  { to: '/app/lesiones', icon: 'shield', label: 'Prevención' },
  { to: '/app/suplementos', icon: 'pill', label: 'Suplem.' },
  { to: '/app/mas', icon: 'menu', label: 'Más' },
]

function Shell() {
  const { day, min } = useWorkout()

  
  return (
    
      <div className={`app${day && min ? ' has-mini' : ''}`}>
      <MealReminderWatcher />
      <main className="content"><Outlet /></main>
      <nav className="bottom-nav">
        {tabs.map(t => (
          <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => (isActive ? 'tab active' : 'tab')}>
            <Icon name={t.icon} size={22} /><small>{t.label}</small>
          </NavLink>
        ))}
      </nav>
    </div>

    
  )
}

export default function Layout() {
  return <WorkoutProvider><Shell /></WorkoutProvider>
}