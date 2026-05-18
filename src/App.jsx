import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { LayoutDashboard, Users, LogOut, ShieldCheck, Menu, X, FileText, ClipboardList, BookOpen } from 'lucide-react'
import PanelPrincipal from './vistas/PanelPrincipal'
import Empleados from './vistas/Empleados'
// Nuevas Vistas Importadas
import Justificaciones from './vistas/Justificaciones'
import Memos from './vistas/Memos'
import Reportes from './vistas/Reportes'

function App() {
  const [sesionActiva, setSesionActiva] = useState(null)
  const [vistaActual, setVistaActual] = useState('dashboard')
  
  // Control responsivo sin alterar tus variables ni funciones
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [menuAbiertoMobile, setMenuAbiertoMobile] = useState(false)
  
  // Estados para el formulario directo en pantalla
  const [correoInput, setCorreoInput] = useState('')
  const [passwordInput, setPasswordInput] = useState('')
  const [cargandoLogin, setCargandoLogin] = useState(false)
  const [errorLogin, setErrorLogin] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSesionActiva(session))
    
    const verificarPantalla = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', verificarPantalla)
    return () => window.removeEventListener('resize', verificarPantalla)
  }, [])

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
    } else {
      setSesionActiva(data.session)
    }
    setCargandoLogin(false)
  }

  // ========================================================
  // FORMULARIO DE ACCESO DIRECTO (SIN PROTOCOLOS NI PROMPTS)
  // ========================================================
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
                style={{ width: '100%', padding: '12px', boxSizing: 'border-box', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '15px' }}
              />
            </div>

            <button 
              type="submit" 
              disabled={cargandoLogin}
              style={{ width: '100%', padding: '14px', backgroundColor: '#0284c7', color: 'white', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer', transition: 'background 0.2s', marginTop: '10px' }}
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

  // ========================================================
  // PANEL ADMINISTRATIVO PRINCIPAL
  // ========================================================
  return (
    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', minHeight: '100vh', backgroundColor: '#f8fafc', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* BARRA SUPERIOR ADAPTABLE SÓLO PARA SMARTPHONES */}
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

      {/* MENÚ LATERAL ORIGINAL (SE OCULTA AUTOMÁTICAMENTE EN MÓVIL SI NO ESTÁ DESPLEGADO) */}
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
          <div onClick={() => { setVistaActual('dashboard'); setMenuAbiertoMobile(false); }} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', backgroundColor: vistaActual === 'dashboard' ? '#0284c7' : 'transparent', color: vistaActual === 'dashboard' ? 'white' : '#cbd5e1', borderRadius: '8px', marginBottom: '10px', cursor: 'pointer' }}>
            <LayoutDashboard size={20} /> <span style={{ fontWeight: '500' }}>Panel Principal</span>
          </div>
          <div onClick={() => { setVistaActual('empleados'); setMenuAbiertoMobile(false); }} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', backgroundColor: vistaActual === 'empleados' ? '#0284c7' : 'transparent', color: vistaActual === 'empleados' ? 'white' : '#cbd5e1', borderRadius: '8px', marginBottom: '10px', cursor: 'pointer' }}>
            <Users size={20} /> <span style={{ fontWeight: '500' }}>Gestión de Personal</span>
          </div>
          {/* NUEVOS BOTONES AÑADIDOS */}
          <div onClick={() => { setVistaActual('justificaciones'); setMenuAbiertoMobile(false); }} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', backgroundColor: vistaActual === 'justificaciones' ? '#0284c7' : 'transparent', color: vistaActual === 'justificaciones' ? 'white' : '#cbd5e1', borderRadius: '8px', marginBottom: '10px', cursor: 'pointer' }}>
            <ClipboardList size={20} /> <span style={{ fontWeight: '500' }}>Justificaciones</span>
          </div>
          <div onClick={() => { setVistaActual('memos'); setMenuAbiertoMobile(false); }} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', backgroundColor: vistaActual === 'memos' ? '#0284c7' : 'transparent', color: vistaActual === 'memos' ? 'white' : '#cbd5e1', borderRadius: '8px', marginBottom: '10px', cursor: 'pointer' }}>
            <FileText size={20} /> <span style={{ fontWeight: '500' }}>Memorándums</span>
          </div>
          <div onClick={() => { setVistaActual('reportes'); setMenuAbiertoMobile(false); }} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', backgroundColor: vistaActual === 'reportes' ? '#0284c7' : 'transparent', color: vistaActual === 'reportes' ? 'white' : '#cbd5e1', borderRadius: '8px', cursor: 'pointer' }}>
            <BookOpen size={20} /> <span style={{ fontWeight: '500' }}>Reportes y Expedientes</span>
          </div>
        </div>

        <div style={{ padding: '20px', borderTop: '1px solid #1e293b' }}>
          <p style={{ fontSize: '11px', color: '#94a3b8', margin: '0 0 10px 0', textAlign: 'center', wordBreak: 'break-all' }}>Sesión: {sesionActiva.user.email}</p>
          <button onClick={() => { supabase.auth.signOut(); setSesionActiva(null); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', padding: '12px', backgroundColor: 'transparent', color: '#f87171', border: '1px solid #f87171', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
            <LogOut size={18} /> Cerrar Sesión
          </button>
        </div>
      </div>

      {/* CONTENIDO PRINCIPAL ADAPTABLE */}
      <div style={{ flex: 1, padding: isMobile ? '15px' : '30px', boxSizing: 'border-box', overflowY: 'auto' }}>
        {vistaActual === 'dashboard' && <PanelPrincipal />}
        {vistaActual === 'empleados' && <Empleados />}
        {vistaActual === 'justificaciones' && <Justificaciones />}
        {vistaActual === 'memos' && <Memos />}
        {vistaActual === 'reportes' && <Reportes />}
      </div>
    </div>
  )
}

export default App