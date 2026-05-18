import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { LayoutDashboard, Users, LogOut, ShieldCheck } from 'lucide-react'
import PanelPrincipal from './vistas/PanelPrincipal'
import Empleados from './vistas/Empleados'

function App() {
  const [sesionActiva, setSesionActiva] = useState(null)
  const [vistaActual, setVistaActual] = useState('dashboard')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSesionActiva(session))
  }, [])

  if (!sesionActiva) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9' }}>
        <button onClick={() => supabase.auth.signInWithPassword({ email: prompt("Correo institucional:"), password: prompt("Contraseña:") }).then(r => setSesionActiva(r.data.session))} style={{ padding: '15px 25px', backgroundColor: '#0f172a', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
          🔒 Iniciar Sesión - Sistema Alcaldía
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f8fafc', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* MENÚ LATERAL INSTITUCIONAL */}
      <div style={{ width: '280px', backgroundColor: '#0f172a', color: 'white', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '25px 20px', borderBottom: '1px solid #1e293b', display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center', textAlign: 'center' }}>
          <ShieldCheck size={40} color="#38bdf8" />
          <div>
            <h2 style={{ fontSize: '16px', margin: '0 0 5px 0', textTransform: 'uppercase', letterSpacing: '1px' }}>Alcaldía de Charallave</h2>
            <p style={{ fontSize: '12px', margin: 0, color: '#94a3b8' }}>Municipio Cristóbal Rojas</p>
          </div>
        </div>
        
        <div style={{ padding: '20px', flex: 1 }}>
          <div onClick={() => setVistaActual('dashboard')} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', backgroundColor: vistaActual === 'dashboard' ? '#0369a1' : 'transparent', color: vistaActual === 'dashboard' ? 'white' : '#cbd5e1', borderRadius: '8px', marginBottom: '10px', cursor: 'pointer', transition: 'all 0.2s' }}>
            <LayoutDashboard size={20} /> <span style={{ fontWeight: '500' }}>Panel Principal</span>
          </div>
          <div onClick={() => setVistaActual('empleados')} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', backgroundColor: vistaActual === 'empleados' ? '#0369a1' : 'transparent', color: vistaActual === 'empleados' ? 'white' : '#cbd5e1', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s' }}>
            <Users size={20} /> <span style={{ fontWeight: '500' }}>Gestión de Personal</span>
          </div>
        </div>

        <div style={{ padding: '20px', borderTop: '1px solid #1e293b' }}>
          <button onClick={() => { supabase.auth.signOut(); setSesionActiva(null); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', padding: '12px', backgroundColor: 'transparent', color: '#f87171', border: '1px solid #f87171', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
            <LogOut size={18} /> Cerrar Sesión
          </button>
        </div>
      </div>

      <div style={{ flex: 1, padding: '30px', overflowY: 'auto' }}>
        {vistaActual === 'dashboard' ? <PanelPrincipal /> : <Empleados />}
      </div>
    </div>
  )
}

export default App