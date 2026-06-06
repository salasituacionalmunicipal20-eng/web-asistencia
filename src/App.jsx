import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { LayoutDashboard, Users, LogOut, ShieldCheck, Menu, X, FileText, ClipboardList, BookOpen, Settings, Sun, Moon, ScrollText, Plane, UserCog, KeyRound, Smartphone, Radio, IdCard, HardHat } from 'lucide-react'
import { useTema } from './theme/ThemeProvider'
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
import Vacaciones from './vistas/Vacaciones'
import Auditoria from './vistas/Auditoria'
import Administradores from './vistas/Administradores'
import VersionesApp from './vistas/VersionesApp'
import RadarVista from './vistas/Radar'
import Carnets from './vistas/Carnets'
import Cuadrillas from './vistas/Cuadrillas'

function App() {
  const { tema, toggle: toggleTema, t } = useTema()
  const [sesionActiva, setSesionActiva] = useState(null)
  const [rolUsuario, setRolUsuario] = useState(null)
  const [cargandoSesion, setCargandoSesion] = useState(true)
  const [vistaActual, setVistaActual] = useState('dashboard')
  // Bandera: si el admin acaba de loguearse y aun tiene requiere_cambio_clave=true,
  // bloqueamos el panel y mostramos una pantalla de cambio obligatorio.
  const [debeCambiarClave, setDebeCambiarClave] = useState(false)
  // Cambio voluntario: cuando el admin abre el modal desde el sidebar
  // (no es obligatorio, puede cancelar).
  const [mostrarCambioClave, setMostrarCambioClave] = useState(false)

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
      setRolUsuario(null)
      setDebeCambiarClave(false)
      return
    }
    const { admin, motivo, requiereCambioClave, rol } = await verificarAdmin(session.user.email)
    if (admin) {
      setSesionActiva(session)
      setRolUsuario(rol || 'admin')
      setDebeCambiarClave(!!requiereCambioClave)
    } else {
      // No autorizado: lo sacamos y dejamos el mensaje en la pantalla de login
      await supabase.auth.signOut().catch(() => {})
      setSesionActiva(null)
      setRolUsuario(null)
      setDebeCambiarClave(false)
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

  // Guard: si el rol cambia y la vistaActual ya no es accesible para el menu
  // visible, redirigimos a dashboard para evitar dejar al usuario en una vista
  // a la que perdió permiso (ej. alcaldesa parada en "empleados").
  useEffect(() => {
    if (!sesionActiva) return
    const esSuperAdminLocal = rolUsuario === 'super_admin' || sesionActiva?.user?.email === 'carlos.linares.es@gmail.com'
    const esAlcaldesaLocal = rolUsuario === 'alcaldesa' || rolUsuario === 'supervisor_cuadrilla' || esSuperAdminLocal
    const esSoloAlcaldesaLocal = (rolUsuario === 'alcaldesa' || rolUsuario === 'supervisor_cuadrilla') && !esSuperAdminLocal
    const idsVisibles = new Set(['dashboard', 'configuracion'])
    if (!esSoloAlcaldesaLocal) {
      ;['empleados', 'carnets', 'justificaciones', 'memos', 'reportes', 'vacaciones', 'auditoria', 'administradores'].forEach(id => idsVisibles.add(id))
    }
    if (esAlcaldesaLocal) idsVisibles.add('cuadrillas')
    if (esSuperAdminLocal) { idsVisibles.add('radar'); idsVisibles.add('versiones') }
    if (vistaActual && !idsVisibles.has(vistaActual)) {
      setVistaActual('dashboard')
    }
  }, [rolUsuario, sesionActiva, vistaActual])

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

          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 14, marginBottom: 14, padding: '12px 4px', borderBottom: '3px solid #ffcc00' }}>
              <img src="logos/cristobal-rojas.png" alt="Cristobal Rojas" style={{ height: 56, objectFit: 'contain' }} />
              <img src="logos/yuhismar.png" alt="Yuhismar Hernandez" style={{ height: 32, objectFit: 'contain' }} />
              <img src="logos/psuv.png" alt="PSUV" style={{ height: 40, objectFit: 'contain' }} />
            </div>
            <h2 style={{ fontSize: '18px', color: '#0033a1', margin: '0 0 4px 0', textTransform: 'uppercase', fontWeight: '900', letterSpacing: '0.5px' }}>Alcaldía de Cristóbal Rojas</h2>
            <p style={{ fontSize: '12px', color: '#7c1d2e', margin: 0, fontWeight: 700, letterSpacing: '0.5px' }}>SALA SITUACIONAL · CONTROL DE ACCESO</p>
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
                style={{ width: '100%', padding: '12px', boxSizing: 'border-box', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '15px', color: '#0f172a', backgroundColor: '#ffffff' }}
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
                style={{ width: '100%', padding: '12px', boxSizing: 'border-box', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '15px', color: '#0f172a', backgroundColor: '#ffffff' }}
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

          {/* Enlace cruzado al otro sistema institucional */}
          <div style={{ marginTop: 18, padding: '12px 14px', background: '#f1f5f9', borderLeft: '3px solid #0a2351', borderRadius: 4, textAlign: 'center', fontSize: 13 }}>
            <span style={{ color: '#475569' }}>¿Buscas la Sala Situacional / Censo?</span><br />
            <a href="https://salasituacionalmunicipal20-eng.github.io/registro-alcaldia/"
               style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 6, color: '#0a2351', fontWeight: 800, textDecoration: 'none', padding: '6px 12px', border: '1px solid #0a2351', borderRadius: 4 }}>
              Ir a Sala Situacional →
            </a>
          </div>
        </div>
      </div>
    )
  }

  // Bloqueador: si el admin entro con clave inicial, le exigimos cambiarla
  // antes de mostrar nada del panel. No hay forma de saltarse esto sin cerrar
  // sesion — la unica salida es definir una clave nueva o hacer logout.
  if (debeCambiarClave) {
    return (
      <CambioObligatorioClave
        correo={sesionActiva?.user?.email}
        onListo={() => setDebeCambiarClave(false)}
        onCancelar={cerrarSesion}
      />
    )
  }

  // Super-admin: solo Carlos puede ver el panel de versiones de app por empleado.
  const esSuperAdmin = rolUsuario === 'super_admin' || sesionActiva?.user?.email === 'carlos.linares.es@gmail.com'
  // Vista Cuadrillas: Alcaldesa + supervisores de cuadrilla. El super-admin
  // tambien la ve para soporte. Se gatea por la columna `rol` de administradores_web.
  const esAlcaldesa = rolUsuario === 'alcaldesa' || rolUsuario === 'supervisor_cuadrilla' || esSuperAdmin
  // Vista reducida: alcaldesa y supervisor_cuadrilla solo ven Panel, Cuadrillas y Configuracion.
  const esSoloAlcaldesa = (rolUsuario === 'alcaldesa' || rolUsuario === 'supervisor_cuadrilla') && !esSuperAdmin

  const itemsMenu = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Panel Principal' },
    ...(esSoloAlcaldesa ? [] : [
      { id: 'empleados', icon: Users, label: 'Gestión de Personal' },
      { id: 'carnets', icon: IdCard, label: 'Carnets' },
      { id: 'justificaciones', icon: ClipboardList, label: 'Justificaciones' },
      { id: 'memos', icon: FileText, label: 'Memorándums' },
      { id: 'reportes', icon: BookOpen, label: 'Reportes' },
      { id: 'vacaciones', icon: Plane, label: 'Vacaciones' },
    ]),
    // Cuadrillas (reportes de campo): visible para alcaldesa, supervisores y super-admin
    ...(esAlcaldesa ? [
      { id: 'cuadrillas', icon: HardHat, label: 'Cuadrillas' }
    ] : []),
    ...(esSoloAlcaldesa ? [] : [
      { id: 'auditoria', icon: ScrollText, label: 'Auditoria' },
      { id: 'administradores', icon: UserCog, label: 'Administradores' },
    ]),
    // Solo visible para super-admin
    ...(esSuperAdmin ? [
      { id: 'radar', icon: Radio, label: 'Radar tiempo real' },
      { id: 'versiones', icon: Smartphone, label: 'Versiones App' }
    ] : []),
    { id: 'configuracion', icon: Settings, label: 'Configuracion' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', minHeight: '100vh', backgroundColor: t.bgApp, color: t.text, fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {isMobile && (
        <div style={{ background: 'linear-gradient(180deg, #001a5c 0%, #0033a1 100%)', color: 'white', padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '3px solid #ffcc00', position: 'sticky', top: 0, zIndex: 1000 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'white', padding: '6px 10px', borderRadius: '8px' }}>
            <img src="logos/cristobal-rojas.png" alt="" style={{ height: 30, objectFit: 'contain' }} />
            <img src="logos/psuv.png" alt="" style={{ height: 24, objectFit: 'contain' }} />
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
          <div style={{ padding: '20px 16px', borderBottom: '3px solid #ffcc00', display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', textAlign: 'center', background: 'linear-gradient(180deg, #001a5c 0%, #0033a1 100%)' }}>
            <div style={{ background: 'white', padding: '10px 12px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%' }}>
              <img src="logos/cristobal-rojas.png" alt="" style={{ height: 42, objectFit: 'contain' }} />
              <img src="logos/yuhismar.png" alt="" style={{ height: 24, objectFit: 'contain' }} />
              <img src="logos/psuv.png" alt="" style={{ height: 32, objectFit: 'contain' }} />
            </div>
            <div>
              <h2 style={{ fontSize: '14px', margin: '0 0 4px 0', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '800', color: '#ffcc00' }}>Cristóbal Rojas</h2>
              <p style={{ fontSize: '11px', margin: 0, color: '#cbd5e1', fontWeight: 600 }}>Sala Situacional · Control de Acceso</p>
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
          <button onClick={toggleTema} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: 10, backgroundColor: 'transparent', color: '#cbd5e1', border: '1px solid #334155', borderRadius: 8, cursor: 'pointer', fontWeight: 600, marginBottom: 10, fontSize: 13 }}>
            {tema === 'oscuro' ? <Sun size={16} /> : <Moon size={16} />}
            Modo {tema === 'oscuro' ? 'claro' : 'oscuro'}
          </button>
          <button onClick={() => setMostrarCambioClave(true)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: 10, backgroundColor: 'transparent', color: '#fbbf24', border: '1px solid #fbbf24', borderRadius: 8, cursor: 'pointer', fontWeight: 600, marginBottom: 10, fontSize: 13 }}>
            <KeyRound size={16} /> Cambiar mi clave
          </button>
          <p style={{ fontSize: '11px', color: '#94a3b8', margin: '0 0 10px 0', textAlign: 'center', wordBreak: 'break-all' }}>Sesion: {sesionActiva.user.email}</p>
          <button onClick={cerrarSesion} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', padding: '12px', backgroundColor: 'transparent', color: '#f87171', border: '1px solid #f87171', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
            <LogOut size={18} /> Cerrar Sesion
          </button>
        </div>
      </div>

      {mostrarCambioClave && (
        <CambioObligatorioClave
          correo={sesionActiva?.user?.email}
          esVoluntario={true}
          onListo={() => setMostrarCambioClave(false)}
          onCancelar={() => setMostrarCambioClave(false)}
        />
      )}

      {/* CONTENIDO PRINCIPAL — render persistente (todas las vistas se mantienen montadas)
          para que el estado de cada una NO se pierda al cambiar de pestaña. */}
      <div style={{ flex: 1, padding: isMobile ? '15px' : '30px', boxSizing: 'border-box', overflowY: 'auto' }}>
        <div style={{ display: vistaActual === 'dashboard' ? 'block' : 'none' }}><PanelPrincipal /></div>
        <div style={{ display: vistaActual === 'empleados' ? 'block' : 'none' }}><Empleados /></div>
        <div style={{ display: vistaActual === 'carnets' ? 'block' : 'none' }}><Carnets /></div>
        <div style={{ display: vistaActual === 'justificaciones' ? 'block' : 'none' }}><Justificaciones /></div>
        <div style={{ display: vistaActual === 'memos' ? 'block' : 'none' }}><Memos /></div>
        <div style={{ display: vistaActual === 'reportes' ? 'block' : 'none' }}><Reportes /></div>
        <div style={{ display: vistaActual === 'vacaciones' ? 'block' : 'none' }}><Vacaciones /></div>
        <div style={{ display: vistaActual === 'auditoria' ? 'block' : 'none' }}><Auditoria /></div>
        <div style={{ display: vistaActual === 'administradores' ? 'block' : 'none' }}><Administradores /></div>
        {esAlcaldesa && vistaActual === 'cuadrillas' && (
          /* Cuadrillas se monta/desmonta como Radar porque trae mapa Leaflet
              y los tiles se rompen si arranca con display:none. */
          <Cuadrillas rolUsuario={rolUsuario} correoUsuario={sesionActiva?.user?.email} />
        )}
        {esSuperAdmin && (
          <>
            {/* Radar se monta/desmonta (no display:none) porque Leaflet
                calcula dimensiones erroneas si su padre arranca oculto. */}
            {vistaActual === 'radar' && <RadarVista />}
            <div style={{ display: vistaActual === 'versiones' ? 'block' : 'none' }}><VersionesApp /></div>
          </>
        )}
        <div style={{ display: vistaActual === 'configuracion' ? 'block' : 'none' }}><Configuracion /></div>
      </div>

      <ModalInactividad segundos={segundosRestantes} onContinuar={reiniciarInactividad} />
    </div>
  )
}

// ============================================================================
// Pantalla de cambio obligatorio de clave
// ----------------------------------------------------------------------------
// Se muestra a pantalla completa (no modal) cuando el admin acaba de loguearse
// y aun tiene requiere_cambio_clave=true. No hay forma de saltarla: o cambia
// la clave o cierra sesion.
//   1. updateUser({password}) — cambia la clave en Supabase Auth
//   2. update administradores_web set requiere_cambio_clave=false — desactiva el gate
// ============================================================================
function CambioObligatorioClave({ correo, onListo, onCancelar, esVoluntario = false }) {
  const [clave1, setClave1] = useState('')
  const [clave2, setClave2] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const guardar = async (e) => {
    e.preventDefault()
    setError('')

    if (clave1.length < 8) { setError('La nueva clave debe tener al menos 8 caracteres.'); return }
    if (clave1 !== clave2)  { setError('Las dos claves no coinciden.'); return }
    if (!/[A-Z]/.test(clave1) || !/[a-z]/.test(clave1) || !/[0-9]/.test(clave1)) {
      setError('La clave debe combinar mayúsculas, minúsculas y al menos un número.'); return
    }

    setGuardando(true)
    try {
      const { error: authErr } = await supabase.auth.updateUser({ password: clave1 })
      if (authErr) throw authErr

      const { error: dbErr } = await supabase
        .from('administradores_web')
        .update({ requiere_cambio_clave: false })
        .eq('correo', correo)
      // No reventamos si el update falla (RLS, columna ausente) — el cambio
      // de clave en Auth ya esta hecho. Solo logueamos.
      if (dbErr) console.warn('No se pudo desactivar el flag:', dbErr)

      onListo()
    } catch (e) {
      setError(e.message || 'No se pudo cambiar la clave.')
      setGuardando(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,0.85)', padding: 15, fontFamily: 'system-ui, sans-serif', zIndex: 9999 }}>
      <div style={{ background: 'white', padding: 32, borderRadius: 16, maxWidth: 460, width: '100%', boxShadow: '0 20px 50px rgba(0,0,0,0.4)' }}>
        <div style={{ background: esVoluntario ? '#dbeafe' : '#fef3c7', border: `1px solid ${esVoluntario ? '#60a5fa' : '#fbbf24'}`, borderLeft: `4px solid ${esVoluntario ? '#2563eb' : '#d97706'}`, padding: 12, borderRadius: 8, marginBottom: 20, fontSize: 13, color: esVoluntario ? '#1e3a8a' : '#78350f', fontWeight: 600, lineHeight: 1.5 }}>
          {esVoluntario
            ? <>🔑 <strong>Cambiar clave personal.</strong> Define tu nueva clave de acceso al panel. Esta acción no afecta a otros administradores.</>
            : <>🔒 <strong>Cambio de clave obligatorio.</strong> Esta es tu primera vez en el panel. Por seguridad, debes definir una clave propia antes de continuar.</>
          }
        </div>

        <h2 style={{ margin: '0 0 6px', color: '#0f172a', fontSize: 20, fontWeight: 900 }}>{esVoluntario ? 'Cambia tu clave' : 'Define tu nueva clave'}</h2>
        <p style={{ margin: '0 0 18px', color: '#64748b', fontSize: 13, fontWeight: 600 }}>{correo}</p>

        <form onSubmit={guardar} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#475569', marginBottom: 6, textTransform: 'uppercase' }}>Nueva clave</label>
            <input type="password" value={clave1} onChange={e => setClave1(e.target.value)} required minLength={8}
              autoFocus autoComplete="new-password"
              placeholder="Mínimo 8 caracteres, mayúsc + minúsc + número"
              style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 15, color: '#0f172a', background: 'white', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#475569', marginBottom: 6, textTransform: 'uppercase' }}>Repite la nueva clave</label>
            <input type="password" value={clave2} onChange={e => setClave2(e.target.value)} required minLength={8}
              autoComplete="new-password"
              style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 15, color: '#0f172a', background: 'white', boxSizing: 'border-box' }} />
          </div>

          {error && (
            <div style={{ padding: 10, borderRadius: 6, background: '#fee2e2', color: '#991b1b', borderLeft: '3px solid #dc2626', fontSize: 13, fontWeight: 700 }}>{error}</div>
          )}

          <button type="submit" disabled={guardando}
            style={{ padding: 14, background: '#0284c7', color: 'white', border: 'none', borderRadius: 8, fontWeight: 800, fontSize: 14, cursor: guardando ? 'wait' : 'pointer', opacity: guardando ? 0.7 : 1, marginTop: 4 }}>
            {guardando ? 'Guardando...' : 'Cambiar clave y entrar al panel'}
          </button>

          <button type="button" onClick={onCancelar} disabled={guardando}
            style={{ padding: 10, background: 'transparent', color: '#64748b', border: '1px solid #cbd5e1', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
            {esVoluntario ? 'Cancelar' : 'Cerrar sesión y volver al login'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default App
