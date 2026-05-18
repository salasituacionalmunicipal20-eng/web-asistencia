import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { Save, UserPlus, Pencil, X } from 'lucide-react'

export default function Empleados() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [listaEmpleados, setListaEmpleados] = useState([])
  const [editandoId, setEditandoId] = useState(null)

  // Estados para los campos de texto estándar
  const [formulario, setFormulario] = useState({
    cedula: '',
    nombres: '',
    apellidos: '',
    departamento: '',
    cargo: '',
    tolerancia_minutos: 15
  })

  // Estados independientes para el control horario AM/PM (100% cliqueable)
  const [entHora, setEntHora] = useState('08')
  const [entMinuto, setEntMinuto] = useState('00')
  const [entPeriodo, setEntPeriodo] = useState('AM')

  const [salHora, setSalHora] = useState('04')
  const [salMinuto, setSalMinuto] = useState('00')
  const [salPeriodo, setSalPeriodo] = useState('PM')

  const [mensaje, setMensaje] = useState({ texto: '', tipo: '' })

  // ==========================================
  // FUNCIÓN RESTAURADA: Manejador de eventos de teclado
  // ==========================================
  const manejarCambio = (e) => {
    setFormulario({ ...formulario, [e.target.name]: e.target.value })
  }

  useEffect(() => {
    obtenerEmpleados()
    const verificarPantalla = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', verificarPantalla)
    return () => window.removeEventListener('resize', verificarPantalla)
  }, [])

  // Cargar lista de empleados desde Supabase
  async function obtenerEmpleados() {
    const { data } = await supabase.from('empleados').select('*').order('nombres', { ascending: true })
    if (data) setListaEmpleados(data)
  }

  // Función matemática para convertir la selección de 12h a la estructura de 24h de Supabase
  const convertirA24Horas = (hora, minuto, periodo) => {
    let h = parseInt(hora, 10)
    if (periodo === 'PM' && h < 12) h += 12
    if (periodo === 'AM' && h === 12) h = 0
    const horaString = h.toString().padStart(2, '0')
    return `${horaString}:${minuto}:00`
  }

  // Función inversa para transformar el formato 24h de Supabase a los dropdowns de 12h
  const desglosarHoraA12h = (hora24) => {
    const horaSegura = String(hora24 || '08:00:00')
    if (!horaSegura.includes(':')) return { hora: '08', minuto: '00', periodo: 'AM' }
    const partes = horaSegura.split(':')
    let h = parseInt(partes[0], 10) || 8
    let mStr = partes[1] || '00'
    let periodo = 'AM'
    
    if (h >= 12) {
      periodo = 'PM'
      if (h > 12) h -= 12
    }
    if (h === 0) h = 12
    
    return {
      hora: h.toString().padStart(2, '0'),
      minuto: mStr,
      periodo
    }
  }

  // Carga un empleado en el formulario para proceder con la edición
  const activarModoEdicion = (empleado) => {
    setEditandoId(empleado.id)
    setFormulario({
      cedula: empleado.cedula,
      nombres: empleado.nombres,
      apellidos: empleado.apellidos,
      departamento: empleado.departamento,
      cargo: empleado.cargo,
      tolerancia_minutos: empleado.tolerancia_minutos
    })

    const entrada = desglosarHoraA12h(empleado.hora_entrada)
    setEntHora(entrada.hora)
    setEntMinuto(entrada.minuto)
    setEntPeriodo(entrada.periodo)

    const salida = desglosarHoraA12h(empleado.hora_salida)
    setSalHora(salida.hora)
    setSalMinuto(salida.minuto)
    setSalPeriodo(salida.periodo)
    
    setMensaje({ texto: 'Modo edición activado. Modifique los campos arriba.', tipo: 'info' })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const cancelarEdicion = () => {
    setEditandoId(null)
    setFormulario({ cedula: '', nombres: '', apellidos: '', departamento: '', cargo: '', tolerancia_minutos: 15 })
    setEntHora('08')
    setEntMinuto('00')
    setEntPeriodo('AM')
    setSalHora('04')
    setSalMinuto('00')
    setSalPeriodo('PM')
    setMensaje({ texto: '', tipo: '' })
  }

  const guardarEmpleado = async (e) => {
    e.preventDefault()
    setMensaje({ texto: 'Procesando operación en el servidor...', tipo: 'info' })

    const horaEntradaFinal = convertirA24Horas(entHora, entMinuto, entPeriodo)
    const horaSalidaFinal = convertirA24Horas(salHora, salMinuto, salPeriodo)

    const datosEmpleado = {
      ...formulario,
      hora_entrada: horaEntradaFinal,
      hora_salida: horaSalidaFinal
    }
    
    let resultadoError = null

    if (editandoId) {
      const { error } = await supabase.from('empleados').update(datosEmpleado).eq('id', editandoId)
      resultadoError = error
    } else {
      const { error } = await supabase.from('empleados').insert([datosEmpleado])
      resultadoError = error
    }
    
    if (resultadoError) {
      setMensaje({ 
        texto: '⛔ Error: Verifique consistencia de datos o duplicidad de Cédula.', 
        tipo: 'error' 
      })
    } else {
      setMensaje({ 
        texto: editandoId ? '✅ Datos modificados y actualizados con éxito.' : `✅ Servidor Público Registrado. Usuario App: ${formulario.cedula}`, 
        tipo: 'exito' 
      })
      cancelarEdicion()
      obtenerEmpleados()
    }
  }

  // Estilos de alto contraste
  const estiloInputBase = {
    width: '100%',
    padding: '12px',
    boxSizing: 'border-box',
    borderRadius: '8px',
    border: '1px solid #475569',
    fontSize: '16px',
    backgroundColor: '#ffffff',
    color: '#0f172a',
    fontWeight: '500',
    outline: 'none'
  }

  const estiloSelectTiempo = {
    flex: 1,
    padding: '12px',
    borderRadius: '8px',
    border: '2px solid #0284c7',
    backgroundColor: '#ffffff',
    color: '#0f172a',
    fontSize: '16px',
    fontWeight: '700',
    textAlign: 'center',
    cursor: 'pointer',
    outline: 'none'
  }

  const estiloOption = {
    color: '#0f172a',
    backgroundColor: '#ffffff',
    fontWeight: '600'
  }

  const horasDisponibles = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'))
  const minutosDisponibles = ['00', '15', '30', '45']

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: isMobile ? '5px' : '0' }}>
      <div style={{ marginBottom: '30px' }}>
        <h1 style={{ margin: '0 0 5px 0', color: '#0f172a', fontSize: isMobile ? '24px' : '28px', fontWeight: '800' }}>
          Gestión de Talento Humano
        </h1>
        <p style={{ margin: 0, color: '#64748b', fontSize: '15px' }}>
          Alta, modificación de jornadas laborales y auditoría interna de credenciales de la Alcaldía.
        </p>
      </div>

      {/* FORMULARIO DE ACCIONES */}
      <div style={{ backgroundColor: 'white', padding: isMobile ? '20px' : '35px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0', marginBottom: '40px' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 0, color: editandoId ? '#0284c7' : '#0f172a', borderBottom: '2px solid #f1f5f9', paddingBottom: '15px', fontSize: '18px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <UserPlus size={22} /> {editandoId ? 'Modificar Servidor Público' : 'Formulario de Registro Oficial'}
          </span>
          {editandoId && (
            <button onClick={cancelarEdicion} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', fontWeight: 'bold' }}>
              <X size={14} /> Cancelar Edición
            </button>
          )}
        </h3>
        
        <form onSubmit={guardarEmpleado} style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '25px', marginTop: '25px' }}>
          
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '8px', textTransform: 'uppercase' }}>
              Nombres Completos
            </label>
            <input type="text" name="nombres" value={formulario.nombres} onChange={manejarCambio} required placeholder="Ej: Juan José" style={estiloInputBase} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '8px', textTransform: 'uppercase' }}>
              Apellidos Completos
            </label>
            <input type="text" name="apellidos" value={formulario.apellidos} onChange={manejarCambio} required placeholder="Ej: Pérez Rodríguez" style={estiloInputBase} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#0284c7', marginBottom: '8px', textTransform: 'uppercase' }}>
              Cédula (Usuario App Android)
            </label>
            <input type="text" name="cedula" value={formulario.cedula} onChange={manejarCambio} required disabled={!!editandoId} placeholder="Ej: V12345678" style={{ ...estiloInputBase, border: '2px solid #bae6fd', backgroundColor: editandoId ? '#f1f5f9' : '#f0f9ff', fontWeight: '700', cursor: editandoId ? 'not-allowed' : 'text' }} />
          </div>
          
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '8px', textTransform: 'uppercase' }}>
              Dirección General / Departamento
            </label>
            <input type="text" name="departamento" value={formulario.departamento} onChange={manejarCambio} required placeholder="Ej: Servicios Públicos" style={estiloInputBase} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '8px', textTransform: 'uppercase' }}>
              Cargo Asignado
            </label>
            <input type="text" name="cargo" value={formulario.cargo} onChange={manejarCambio} required placeholder="Ej: Inspector de Campo" style={estiloInputBase} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#0f172a', marginBottom: '8px', textTransform: 'uppercase' }}>
              Tolerancia (Minutos de Gracia)
            </label>
            <input type="number" name="tolerancia_minutos" value={formulario.tolerancia_minutos} onChange={manejarCambio} required min="0" max="60" style={estiloInputBase} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#0f172a', marginBottom: '8px', textTransform: 'uppercase' }}>
              Hora de Entrada
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <select value={entHora} onChange={(e) => setEntHora(e.target.value)} style={estiloSelectTiempo}>
                {horasDisponibles.map(h => <option key={h} value={h} style={estiloOption}>{h} h</option>)}
              </select>
              <select value={entMinuto} onChange={(e) => setEntMinuto(e.target.value)} style={estiloSelectTiempo}>
                {minutosDisponibles.map(m => <option key={m} value={m} style={estiloOption}>{m} min</option>)}
              </select>
              <select value={entPeriodo} onChange={(e) => setEntPeriodo(e.target.value)} style={{ ...estiloSelectTiempo, backgroundColor: '#f0f9ff' }}>
                <option value="AM" style={estiloOption}>AM</option>
                <option value="PM" style={estiloOption}>PM</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#0f172a', marginBottom: '8px', textTransform: 'uppercase' }}>
              Hora de Salida
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <select value={salHora} onChange={(e) => setSalHora(e.target.value)} style={estiloSelectTiempo}>
                {horasDisponibles.map(h => <option key={h} value={h} style={estiloOption}>{h} h</option>)}
              </select>
              <select value={salMinuto} onChange={(e) => setSalMinuto(e.target.value)} style={estiloSelectTiempo}>
                {minutosDisponibles.map(m => <option key={m} value={m} style={estiloOption}>{m} min</option>)}
              </select>
              <select value={salPeriodo} onChange={(e) => setSalPeriodo(e.target.value)} style={{ ...estiloSelectTiempo, backgroundColor: '#f0f9ff' }}>
                <option value="AM" style={estiloOption}>AM</option>
                <option value="PM" style={estiloOption}>PM</option>
              </select>
            </div>
          </div>

          <div style={{ gridColumn: isMobile ? 'auto' : 'span 2', marginTop: '15px' }}>
            <button type="submit" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', width: '100%', padding: '15px', backgroundColor: editandoId ? '#0284c7' : '#0f172a', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.15)' }}>
              <Save size={20}/> {editandoId ? 'Guardar Cambios Oficiales' : 'Registrar en el Sistema del Municipio'}
            </button>
          </div>
        </form>

        {mensaje.texto && (
          <div style={{ marginTop: '25px', padding: '15px', borderRadius: '8px', backgroundColor: mensaje.tipo === 'error' ? '#fee2e2' : (mensaje.tipo === 'info' ? '#e0f2fe' : '#d1fae5'), color: mensaje.tipo === 'error' ? '#ef4444' : (mensaje.tipo === 'info' ? '#0369a1' : '#059669'), fontWeight: '600', textAlign: 'center', border: `1px solid ${mensaje.tipo === 'error' ? '#f87171' : (mensaje.tipo === 'info' ? '#7dd3fc' : '#34d399')}`, fontSize: '14px' }}>
            {mensaje.texto}
          </div>
        )}
      </div>

      {/* BITÁCORA / LISTADO DE EMPLEADOS REGISTRADOS */}
      <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
          <h3 style={{ margin: 0, color: '#0f172a', fontSize: '16px', fontWeight: '700', textTransform: 'uppercase' }}>Listado Oficial de Servidores Públicos</h3>
        </div>
        <div style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '750px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f1f5f9', color: '#475569', fontSize: '12px', textTransform: 'uppercase', fontWeight: 'bold' }}>
                <th style={{ padding: '12px 20px', borderBottom: '1px solid #e2e8f0' }}>Cédula</th>
                <th style={{ padding: '12px 20px', borderBottom: '1px solid #e2e8f0' }}>Nombre Completo</th>
                <th style={{ padding: '12px 20px', borderBottom: '1px solid #e2e8f0' }}>Dirección / Cargo</th>
                <th style={{ padding: '12px 20px', borderBottom: '1px solid #e2e8f0' }}>Horario Asignado</th>
                <th style={{ padding: '12px 20px', borderBottom: '1px solid #e2e8f0', textAlign: 'center' }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {listaEmpleados?.map((emp) => (
                <tr key={emp.id} style={{ borderBottom: '1px solid #e2e8f0', fontSize: '14px', backgroundColor: editandoId === emp.id ? '#f0f9ff' : 'transparent' }}>
                  <td style={{ padding: '14px 20px', fontWeight: '700', color: '#0f172a' }}>{emp?.cedula}</td>
                  <td style={{ padding: '14px 20px', color: '#1e293b', fontWeight: '500' }}>{emp?.nombres} {emp?.apellidos}</td>
                  <td style={{ padding: '14px 20px', color: '#64748b' }}>
                    <div style={{ fontWeight: 'bold', color: '#334155' }}>{emp?.departamento}</div>
                    <div style={{ fontSize: '12px' }}>{emp?.cargo}</div>
                  </td>
                  <td style={{ padding: '14px 20px', color: '#0f172a', fontWeight: '600' }}>
                    <span style={{ color: '#0284c7' }}>{String(emp?.hora_entrada || '08:00:00').substring(0,5)}</span> a <span style={{ color: '#0f172a' }}>{String(emp?.hora_salida || '16:00:00').substring(0,5)}</span>
                    <span style={{ fontSize: '11px', color: '#64748b', display: 'block', fontWeight: 'normal' }}> (+{emp?.tolerancia_minutos || 0}m)</span>
                  </td>
                  <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                    <button onClick={() => activarModoEdicion(emp)} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '8px 14px', backgroundColor: '#0f172a', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>
                      <Pencil size={14} /> Editar
                    </button>
                  </td>
                </tr>
              ))}
              {(!listaEmpleados || listaEmpleados.length === 0) && (
                <tr>
                  <td colSpan="5" style={{ padding: '30px', textAlign: 'center', color: '#64748b', fontWeight: '500' }}>No existen empleados registrados en el sistema de la Alcaldía.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}