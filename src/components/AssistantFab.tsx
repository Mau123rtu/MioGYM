import { useEffect, useState, type CSSProperties } from 'react'
import { Link, useLocation } from 'react-router-dom'
import Icon from './Icons'
import { useWorkout } from './Workout'

const DESK = '(min-width:1024px) and (hover:hover) and (pointer:fine)'

function useDesktop() {
  const [on, setOn] = useState(() => window.matchMedia(DESK).matches)
  useEffect(() => {
    const m = window.matchMedia(DESK)
    const f = () => setOn(m.matches)
    m.addEventListener('change', f)
    return () => m.removeEventListener('change', f)
  }, [])
  return on
}

export default function AssistantFab() {
  const { pathname } = useLocation()
  const { day, min } = useWorkout()
  const desk = useDesktop()
  const [hover, setHover] = useState(false)

  // En el propio asistente y en los cuestionarios no hace falta
  if (pathname.startsWith('/app/asistente') || pathname.endsWith('/perfil')) return null

  const safe = 'env(safe-area-inset-bottom, 0px)'
  const style: CSSProperties = {
    position: 'fixed',
    zIndex: 40,
    right: desk ? '2rem' : 'max(14px, calc((100vw - 430px) / 2 + 14px))',
    bottom: desk ? '2rem' : `calc(${day && min ? 144 : 76}px + ${safe})`,
    height: desk ? 58 : 56,
    minWidth: desk ? 58 : 56,
    padding: desk && hover ? '0 1.1rem' : 0,
    borderRadius: 29,
    background: '#ffd400',
    color: '#000',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '.6rem',
    textDecoration: 'none',
    fontWeight: 700,
    fontSize: '.9rem',
    boxShadow: '0 6px 20px rgba(0,0,0,.6), 0 0 0 3px rgba(255,212,0,.18)',
    transition: 'padding .2s',
  }

  return (
    <Link to="/app/asistente" style={style} aria-label="Abrir el asistente" title="Asistente"
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <Icon name="chat" size={26} />
      {desk && hover && <span>Asistente</span>}
    </Link>
  )
}