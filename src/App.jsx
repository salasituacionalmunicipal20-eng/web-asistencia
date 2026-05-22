import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { LayoutDashboard, Users, LogOut, ShieldCheck, Menu, X, FileText, ClipboardList, BookOpen, Settings } from 'lucide-react'
import { useIsMobile } from './hooks/useIsMobile'
import { useInactividad } from './hooks/useInactividad'
import { verificarAdmin } from './lib/auth'
import ModalInactividad from './components/ModalInactividad'
import PanelPrincipal from './vistas/PanelPrincipal'
import Empleados from './vistas/Empleados'
import Justificaciones from './vistas/Justificaciones'
import Memos from './vistas/Memos'
import Reportes from './vistas/Reportes'
import Configuracion from './vistas/Configuracion'

function App() {
  const [sesionActiva, setSesionActiva] = useState(null)
  const [cargandoSesion, setCargandoSesion] = useState(true)
  const [vistaActual, setVistaActual] = useState('dashboard')

  const isMobile = useIsMobile()
  const [menuAbiertoMobile, setMenuAbiertoMobile] = useState(false)

  const [correoInput, setCorreoInput] = useState('')
  const [passwordInput, setPasswordInput] = useState('')
  const [cargandoLogin, setCargandoLogin] = useState(false)
  const [errorLogin, setErrorLogin] = useState('')

  // Toda sesión que entre acá pasa por la puerta de admin. Si no está en la tabla
  // `administradores`, hacemos signOut y mostramos por qué.
  const validarSesionAdmin = useCallback(async (session) => {
    if (!session) {
      setSesionActiva(null)
      return
    }
    const { admin, motivo } = await verificarAdmin(session.user.email)
    if (admin) {
      setSesionActiva(session)
    } else {
      // No autorizado: lo sacamos y dejamos el mensaje en la pantalla de login
      await supabase.auth.signOut().catch(() => {})
      setSesionActiva(null)
      setErrorLogin(`⛔ ${motivo} Esta plataforma es solo para administradores.`)
    }
  }, [])

  // 1) Lee sesión inicial y se suscribe a cambios (token refresh, logout en otra pestaña, etc.)
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      await validarSesionAdmin(session)
      setCargandoSesion(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      validarSesionAdmin(session)
    })
    return () => subscription.unsubscribe()
  }, [validarSesionAdmin])

  const cerrarSesion = useCallback(async () => {
    try {
      await supabase.auth.signOut()
    } catch (e) {
      console.error('Error al cerrar sesión:', e)
    } finally {
      setSesionActiva(null)
    }
  }, [])

  // 2) Timer de inactividad — 10 min sin acción cierra sesión, modal de aviso a los 9:30
  const manejarTimeoutInactividad = useCallback(() => {
    alert('Tu sesión se cerró por inactividad (10 minutos sin acción).')
    cerrarSesion()
  }, [cerrarSesion])

  const { segundosRestantes, reiniciar: reiniciarInactividad } = useInactividad({
    timeoutMs: 10 * 60 * 1000,
    warningMs: 30 * 1000,
    onTimeout: manejarTimeoutInactividad,
    enabled: !!sesionActiva, // solo cuenta cuando hay sesión activa
  })

  const manejarLoginDirecto = async (e) => {
    e.preventDefault()
    setCargandoLogin(true)
    setErrorLogin('')

    const { data, error } = await supabase.auth.signInWithPassword({
      email: correoInput,
      password: passwordInput,
    })

    if (error) {
      setErrorLogin('⛔ Credenciales inválidas. Acceso denegado.')
      setCargandoLogin(false)
      return
    }

    // Las credenciales son correctas pero todavía falta verificar que sea admin.
    // validarSesionAdmin escribe el mensaje en errorLogin si falla la verificación.
    await validarSesionAdmin(data.session)
    setPasswordInput('')
    setCargandoLogin(false)
  }

  // Pantalla de carga mientras Supabase resuelve la sesión inicial
  if (cargandoSesion) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a', color: '#94a3b8', fontFamily: 'system-ui, sans-serif' }}>
        Cargando sesión...
      </div>
    )
  }

  if (!sesionActiva) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a', fontFamily: 'system-ui, -apple-system, sans-serif', padding: '15px', boxSizing: 'border-box' }}>
        <div style={{ backgroundColor: 'white', padding: isMobile ? '25px' : '40px', borderRadius: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.3)', width: '100%', maxWidth: '400px', boxSizing: 'border-box' }}>

          <div style={{ textAlign: 'center', marginBottom: '30px' }}>
            <ShieldCheck size={48} color="#0284c7" style={{ margin: '0 auto 10px' }} />
            <h2 style={{ fontSize: '20px', color: '#1e293b', margin: '0 0 5px 0', textTransform: 'uppercase', fontWeight: '800' }}>Alcaldía de Charallave</h2>
            <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>SALA SITUACIONAL - CONTROL DE ACCESO</p>
          </div>

          <form onSubmit={manejarLoginDirecto} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '6px', textTransform: 'uppercase' }}>Correo Electrónico</label>
              <input
                type="email"
                placeholder="usuario@charallave.gob.ve"
                value={correoInput}
                onChange={(e) => setCorreoInput(e.target.value)}
                required
                autoComplete="email"
                style={{ width: '100%', padding: '12px', boxSizing: 'border-box', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '15px' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '6px', textTransform: 'uppercase' }}>Contraseña de Seguridad</label>
              <input
                type="password"
                placeholder="••••••••"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                required
                autoComplete="current-password"
                style={{ width: '100%', padding: '12px', boxSizing: 'border-box', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '15px' }}
              />
            </div>

            <button
              type="submit"
              disabled={cargandoLogin}
              style={{ width: '100%', padding: '14px', backgroundColor: '#0284c7', color: 'white', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: 'bold', cursor: cargandoLogin ? 'not-allowed' : 'pointer', opacity: cargandoLogin ? 0.7 : 1, transition: 'background 0.2s', marginTop: '10px' }}
            >
              {cargandoLogin ? 'Autenticando Servidor...' : 'Ingresar al Panel'}
            </button>
          </form>

          {errorLogin && (
            <div style={{ marginTop: '15px', padding: '10px', borderRadius: '6px', backgroundColor: '#fee2e2', color: '#ef4444', fontSize: '13px', fontWeight: '600', textAlign: 'center', border: '1px solid #f87171' }}>
              {errorLogin}
            </div>
          )}
        </div>
      </div>
    )
  }

  const itemsMenu = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Panel Principal' },
    { id: 'empleados', icon: Users, label: 'Gestión de Personal' },
    { id: 'justificaciones', icon: ClipboardList, label: 'Justificaciones' },
    { id: 'memos', icon: FileText, label: 'Memorándums' },
    { id: 'reportes', icon: BookOpen, label: 'Expedientes y Reportes' },
    { id: 'configuracion', icon: Settings, label: 'Configuracion' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', minHeight: '100vh', backgroundColor: '#f8fafc', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {isMobile && (
        <div style={{ backgroundColor: '#0f172a', color: 'white', padding: '15px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e293b', position: 'sticky', top: 0, zIndex: 1000 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShieldCheck size={24} color="#38bdf8" />
            <span style={{ fontWeight: '700', fontSize: '14px', textTransform: 'uppercase' }}>Alcaldía de Charallave</span>
          </div>
          <button onClick={() => setMenuAbiertoMobile(!menuAbiertoMobile)} style={{ backgroundColor: 'transparent', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            {menuAbiertoMobile ? <X size={26} /> : <Menu size={26} />}
          </button>
        </div>
      )}

      <div style={{
        width: isMobile ? '100%' : '280px',
        backgroundColor: '#0f172a',
        color: 'white',
        display: isMobile ? (menuAbiertoMobile ? 'flex' : 'none') : 'flex',
        flexDirection: 'column',
        position: isMobile ? 'fixed' : 'static',
        top: '57px',
        left: 0,
        height: isMobile ? 'calc(100vh - 57px)' : 'auto',
        zIndex: 999
      }}>
        {!isMobile && (
          <div style={{ padding: '25px 20px', borderBottom: '1px solid #1e293b', display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center', textAlign: 'center' }}>
            <ShieldCheck size={40} color="#38bdf8" />
            <div>
              <h2 style={{ fontSize: '15px', margin: '0 0 5px 0', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '700' }}>Alcaldía de Charallave</h2>
              <p style={{ fontSize: '12px', margin: 0, color: '#94a3b8' }}>Municipio Cristóbal Rojas</p>
            </div>
          </div>
        )}

        <div style={{ padding: '20px', flex: 1, overflowY: 'auto' }}>
          {itemsMenu.map((item, idx) => {
            const Icon = item.icon
            const activo = vistaActual === item.id
            return (
              <div
                key={item.id}
                onClick={() => { setVistaActual(item.id); setMenuAbiertoMobile(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px', padding: '12px',
                  backgroundColor: activo ? '#0284c7' : 'transparent',
                  color: activo ? 'white' : '#cbd5e1',
                  borderRadius: '8px',
                  marginBottom: idx === itemsMenu.length - 1 ? 0 : '10px',
                  cursor: 'pointer',
                }}
              >
                <Icon size={20} /> <span style={{ fontWeight: '500' }}>{item.label}</span>
              </div>
            )
          })}
        </div>

        <div style={{ padding: '20px', borderTop: '1px solid #1e293b' }}>
          <p style={{ fontSize: '11px', color: '#94a3b8', margin: '0 0 10px 0', textAlign: 'center', wordBreak: 'break-all' }}>Sesión: {sesionActiva.user.email}</p>
          <button onClick={cerrarSesion} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', padding: '12px', backgroundColor: 'transparent', color: '#f87171', border: '1px solid #f87171', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
            <LogOut size={18} /> Cerrar Sesión
          </button>
        </div>
      </div>

      {/* CONTENIDO PRINCIPAL — render persistente (todas las vistas se mantienen montadas)
          para que el estado de cada una NO se pierda al cambiar de pestaña. */}
      <div style={{ flex: 1, padding: isMobile ? '15px' : '30px', boxSizing: 'border-box', overflowY: 'auto' }}>
        <div style={{ display: vistaActual === 'dashboard' ? 'block' : 'none' }}><PanelPrincipal /></div>
        <div style={{ display: vistaActual === 'empleados' ? 'block' : 'none' }}><Empleados /></div>
        <div style={{ display: vistaActual === 'justificaciones' ? 'block' : 'none' }}><Justificaciones /></div>
        <div style={{ display: vistaActual === 'memos' ? 'block' : 'none' }}><Memos /></div>
        <div style={{ display: vistaActual === 'reportes' ? 'block' : 'none' }}><Reportes /></div>
        <div style={{ display: vistaActual === 'configuracion' ? 'block' : 'none' }}><Configuracion /></div>
      </div>

      <ModalInactividad segundos={segundosRestantes} onContinuar={reiniciarInactividad} />
    </div>
  )
}

export default App
