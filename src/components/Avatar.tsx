import { useAuth } from '../context/AuthContext'

export default function Avatar({ size = 44 }: { size?: number }) {
  const { profile } = useAuth()
  const name = profile?.full_name ?? profile?.username ?? ''
  return (
    <div className="avatar" style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {profile?.avatar_url
        ? <img src={profile.avatar_url} alt="Foto de perfil" />
        : name.charAt(0).toUpperCase()}
    </div>
  )
}