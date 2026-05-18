import { useState } from 'react'
import { supabase } from '../supabase'
import { Save, UserPlus } from 'lucide-react'

export default function Empleados() {
  const [formulario, setFormulario] = useState({
    cedula: '',
    nombres: '',
    apellidos: '',
    departamento: '',
    cargo: '',
    hora_entrada: '08:00',
    hora_salida: '16:00',
    tolerancia_minutos: 15
  })
  const [mensaje, setMensaje] = useState({ texto: '', tipo: '' })

  const manejarCambio = (e) => {
    setFormulario({ ...formulario, [e.target.name]: e.target.value })
  }

  const guardarEmpleado = async (e) => {
    e.preventDefault()
    setMensaje({ texto: 'Procesando registro en el servidor...', tipo: 'info' })
    
    const { error } = await supabase.from('empleados').insert([formulario])
    
    if (error) {
      setMensaje({ 
        texto: '⛔ Error de Consistencia: Verifique que esta Cédula (Usuario) no esté registrada.', 
        tipo: 'error' 
      })
    } else {
      setMensaje({ 
        texto: `✅ Servidor Público Registrado. Usuario App: ${formulario.cedula} | Clave Inicial: 123456`, 
        tipo: 'exito' 
      })
      // Reiniciar formulario al estado inicial seguro
      setFormulario({ 
        cedula: '', 
        nombres: '', 
        apellidos: '', 
        departamento: '', 
        cargo: '', 
        hora_entrada: '08:00', 
        hora_salida: '16:00', 
        tolerancia_minutos: 15 
      })
    }
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ marginBottom: '30px' }}>
        <h1 style={{ margin: '0 0 5px 0', color: '#0f172a', fontSize: '28px', fontWeight: '800' }}>
          Gestión de Talento Humano
        </h1>
        <p style={{ margin: 0, color: '#64748b', fontSize: '15px' }}>
          Alta oficial de personal, asignación de jornadas laborales y credenciales para la App móvil.
        </p>
      </div>

      <div style={{ backgroundColor: 'white', padding: '35px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: 0, color: '#0284c7', borderBottom: '2px solid #f1f5f9', paddingBottom: '15px', fontSize: '18px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          <UserPlus size={22} /> Formulario de Registro Oficial
        </h3>
        
        <form onSubmit={guardarEmpleado} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '25px', marginTop: '25px' }}>
          
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '8px', textTransform: 'uppercase' }}>
              Nombres Completos
            </label>
            <input 
              type="text"
              name="nombres" 
              value={formulario.nombres} 
              onChange={manejarCambio} 
              required 
              placeholder="Ej: Juan José"
              style={{ width: '100%', padding: '12px', boxSizing: 'border-box', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '15px', backgroundColor: '#f8fafc' }} 
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '8px', textTransform: 'uppercase' }}>
              Apellidos Completos
            </label>
            <input 
              type="text"
              name="apellidos" 
              value={formulario.apellidos} 
              onChange={manejarCambio} 
              required 
              placeholder="Ej: Pérez Rodríguez"
              style={{ width: '100%', padding: '12px', boxSizing: 'border-box', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '15px', backgroundColor: '#f8fafc' }} 
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#0284c7', marginBottom: '8px', textTransform: 'uppercase' }}>
              Cédula (Identificador/Usuario App Android)
            </label>
            <input 
              type="text"
              name="cedula" 
              value={formulario.cedula} 
              onChange={manejarCambio} 
              required 
              placeholder="Ej: V12345678 (Sin puntos ni espacios)"
              style={{ width: '100%', padding: '12px', boxSizing: 'border-box', borderRadius: '8px', border: '2px solid #bae6fd', fontSize: '15px', backgroundColor: '#f0f9ff', fontWeight: '600' }} 
            />
          </div>
          
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '8px', textTransform: 'uppercase' }}>
              Dirección General / Departamento
            </label>
            <input 
              type="text"
              name="departamento" 
              value={formulario.departamento} 
              onChange={manejarCambio} 
              required 
              placeholder="Ej: Servicios Públicos"
              style={{ width: '100%', padding: '12px', boxSizing: 'border-box', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '15px', backgroundColor: '#f8fafc' }} 
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '8px', textTransform: 'uppercase' }}>
              Cargo Asignado
            </label>
            <input 
              type="text"
              name="cargo" 
              value={formulario.cargo} 
              onChange={manejarCambio} 
              required 
              placeholder="Ej: Inspector de Campo"
              style={{ width: '100%', padding: '12px', boxSizing: 'border-box', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '15px', backgroundColor: '#f8fafc' }} 
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '8px', textTransform: 'uppercase' }}>
              Hora Obligatoria de Entrada
            </label>
            <input 
              type="time" 
              name="hora_entrada" 
              value={formulario.hora_entrada} 
              onChange={manejarCambio} 
              required 
              style={{ width: '100%', padding: '12px', boxSizing: 'border-box', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '15px', backgroundColor: '#f8fafc' }} 
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '8px', textTransform: 'uppercase' }}>
              Hora Obligatoria de Salida
            </label>
            <input 
              type="time" 
              name="hora_salida" 
              value={formulario.hora_salida} 
              onChange={manejarCambio} 
              required 
              style={{ width: '100%', padding: '12px', boxSizing: 'border-box', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '15px', backgroundColor: '#f8fafc' }} 
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '8px', textTransform: 'uppercase' }}>
              Tolerancia por Retraso (Minutos de Gracia)
            </label>
            <input 
              type="number" 
              name="tolerancia_minutos" 
              value={formulario.tolerancia_minutos} 
              onChange={manejarCambio} 
              required 
              min="0"
              max="60"
              style={{ width: '100%', padding: '12px', boxSizing: 'border-box', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '15px', backgroundColor: '#f8fafc' }} 
            />
          </div>

          <div style={{ gridColumn: 'span 2', marginTop: '15px' }}>
            <button 
              type="submit" 
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', width: '100%', padding: '15px', backgroundColor: '#0f172a', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.15)', transition: 'background 0.2s' }}
            >
              <Save size={20}/> Registrar en el Sistema del Municipio
            </button>
          </div>
        </form>

        {mensaje.texto && (
          <div style={{ marginTop: '25px', padding: '15px', borderRadius: '8px', backgroundColor: mensaje.tipo === 'error' ? '#fee2e2' : (mensaje.tipo === 'info' ? '#e0f2fe' : '#d1fae5'), color: mensaje.tipo === 'error' ? '#ef4444' : (mensaje.tipo === 'info' ? '#0369a1' : '#059669'), fontWeight: '600', textAlign: 'center', border: `1px solid ${mensaje.tipo === 'error' ? '#f87171' : (mensaje.tipo === 'info' ? '#7dd3fc' : '#34d399')}`, fontSize: '14px' }}>
            {mensaje.texto}
          </div>
        )}
      </div>
    </div>
  )
}