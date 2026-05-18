import { useState } from 'react'
import { supabase } from '../supabase'
import { Save, UserPlus } from 'lucide-react'

export default function Empleados() {
  const [formulario, setFormulario] = useState({ cedula: '', nombres: '', apellidos: '', departamento: '', cargo: '', hora_entrada: '08:00', hora_salida: '16:00', tolerancia_minutos: 15 })
  const [mensaje, setMensaje] = useState({ texto: '', tipo: '' })

  const manejarCambio = (e) => setFormulario({ ...formulario, [e.target.name]: e.target.value })

  const guardarEmpleado = async (e) => {
    e.preventDefault()
    setMensaje({ texto: 'Procesando registro...', tipo: 'info' })
    const { error } = await supabase.from('empleados').insert([formulario])
    if (error) {
      setMensaje({ texto: '⛔ Error: Verifica que la cédula no esté duplicada en la base de datos.', tipo: 'error' })
    } else {
      setMensaje({ texto: '✅ Empleado de la Alcaldía registrado exitosamente. Clave inicial: 123456', tipo: 'exito' })
      setFormulario({ cedula: '', nombres: '', apellidos: '', departamento: '', cargo: '', hora_entrada: '08:00', hora_salida: '16:00', tolerancia_minutos: 15 })
    }
  }

  return (
    <div>
      <div style={{ marginBottom: '30px' }}>
        <h1 style={{ margin: '0 0 5px 0', color: '#0f172a', fontSize: '28px' }}>Gestión de Talento Humano</h1>
        <p style={{ margin: 0, color: '#64748b' }}>Registro oficial de empleados y asignación de horarios permitidos</p>
      </div>

      <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', maxWidth: '800px' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: 0, color: '#0284c7', borderBottom: '1px solid #e2e8f0', paddingBottom: '15px' }}><UserPlus /> Alta de Nuevo Servidor Público</h3>
        
        <form onSubmit={guardarEmpleado} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
          <div><label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#475569', marginBottom: '5px', textTransform: 'uppercase' }}>Cédula de Identidad</label>
          <input name="cedula" value={formulario.cedula} onChange={manejarCambio} required placeholder="Ej: V-12345678" style={{ width: '90%', padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc' }} /></div>
          
          <div><label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#475569', marginBottom: '5px', textTransform: 'uppercase' }}>Departamento / Dirección</label>
          <input name="departamento" value={formulario.departamento} onChange={manejarCambio} required placeholder="Ej: Despacho, Servicios Públicos..." style={{ width: '90%', padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc' }} /></div>

          <div><label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#475569', marginBottom: '5px', textTransform: 'uppercase' }}>Nombres</label>
          <input name="nombres" value={formulario.nombres} onChange={manejarCambio} required style={{ width: '90%', padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc' }} /></div>

          <div><label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#475569', marginBottom: '5px', textTransform: 'uppercase' }}>Apellidos</label>
          <input name="apellidos" value={formulario.apellidos} onChange={manejarCambio} required style={{ width: '90%', padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc' }} /></div>

          <div><label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#475569', marginBottom: '5px', textTransform: 'uppercase' }}>Cargo Oficial</label>
          <input name="cargo" value={formulario.cargo} onChange={manejarCambio} required style={{ width: '90%', padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc' }} /></div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ flex: 1 }}><label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#475569', marginBottom: '5px', textTransform: 'uppercase' }}>Entrada</label>
            <input type="time" name="hora_entrada" value={formulario.hora_entrada} onChange={manejarCambio} required style={{ width: '80%', padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc' }} /></div>
            <div style={{ flex: 1 }}><label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#475569', marginBottom: '5px', textTransform: 'uppercase' }}>Tolerancia (Min)</label>
            <input type="number" name="tolerancia_minutos" value={formulario.tolerancia_minutos} onChange={manejarCambio} required style={{ width: '80%', padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc' }} /></div>
          </div>

          <div style={{ gridColumn: 'span 2', marginTop: '10px' }}>
            <button type="submit" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', width: '100%', padding: '14px', backgroundColor: '#0f172a', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}><Save size={20}/> Guardar Registro Oficial</button>
          </div>
        </form>
        {mensaje.texto && <div style={{ marginTop: '20px', padding: '15px', borderRadius: '8px', backgroundColor: mensaje.tipo === 'error' ? '#fee2e2' : '#d1fae5', color: mensaje.tipo === 'error' ? '#ef4444' : '#059669', fontWeight: 'bold', textAlign: 'center', border: `1px solid ${mensaje.tipo === 'error' ? '#f87171' : '#34d399'}` }}>{mensaje.texto}</div>}
      </div>
    </div>
  )
}