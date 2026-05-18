import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { Save, UserPlus } from 'lucide-react'

export default function Empleados() {
  // Estado para detectar de forma automática si es un teléfono celular
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  useEffect(() => {
    const verificarPantalla = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', verificarPantalla)
    return () => window.removeEventListener('resize', verificarPantalla)
  }, [])

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

  const manejarCambio = (e) => {
    setFormulario({ ...formulario, [e.target.name]: e.target.value })
  }

  // Función matemática para convertir la selección de 12h a la estructura de 24h de Supabase
  const convertirA24Horas = (hora, minuto, periodo) => {
    let h = parseInt(hora, 10)
    if (periodo === 'PM' && h < 12) h += 12
    if (periodo === 'AM' && h === 12) h = 0
    const horaString = h.toString().padStart(2, '0')
    return `${horaString}:${minuto}:00`
  }

  const guardarEmpleado = async (e) => {
    e.preventDefault()
    setMensaje({ texto: 'Procesando registro en el servidor...', tipo: 'info' })

    // Traducimos los dropdowns cliqueables al formato de tiempo requerido
    const horaEntradaFinal = convertirA24Horas(entHora, entMinuto, entPeriodo)
    const horaSalidaFinal = convertirA24Horas(salHora, salMinuto, salPeriodo)

    const datosEmpleado = {
      ...formulario,
      hora_entrada: horaEntradaFinal,
      hora_salida: horaSalidaFinal
    }
    
    const { error } = await supabase.from('empleados').insert([datosEmpleado])
    
    if (error) {
      setMensaje({ 
        texto: '⛔ Error de Consistencia: Verifique que esta Cédula no esté registrada.', 
        tipo: 'error' 
      })
    } else {
      setMensaje({ 
        texto: `✅ Servidor Público Registrado. Usuario App: ${formulario.cedula} | Clave Inicial: 123456`, 
        tipo: 'exito' 
      })
      // Reiniciar formulario
      setFormulario({ cedula: '', nombres: '', apellidos: '', departamento: '', cargo: '', tolerancia_minutos: 15 })
      setEntHora('08')
      setEntMinuto('00')
      setEntPeriodo('AM')
      setSalHora('04')
      setSalMinuto('00')
      setSalPeriodo('PM')
    }
  }

  // Estilos de alto contraste blindados contra temas oscuros del sistema
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

  // Arreglos para renderizar las opciones numéricas
  const horasDisponibles = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'))
  const minutosDisponibles = ['00', '15', '30', '45']

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: isMobile ? '5px' : '0' }}>
      <div style={{ marginBottom: '30px' }}>
        <h1 style={{ margin: '0 0 5px 0', color: '#0f172a', fontSize: isMobile ? '24px' : '28px', fontWeight: '800' }}>
          Gestión de Talento Humano
        </h1>
        <p style={{ margin: 0, color: '#64748b', fontSize: '15px' }}>
          Alta oficial de personal, asignación de jornadas laborales y credenciales para la App móvil.
        </p>
      </div>

      <div style={{ backgroundColor: 'white', padding: isMobile ? '20px' : '35px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: 0, color: '#0284c7', borderBottom: '2px solid #f1f5f9', paddingBottom: '15px', fontSize: '18px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          <UserPlus size={22} /> Formulario de Registro Oficial
        </h3>
        
        {/* Cambia dinámicamente de 2 columnas en PC a 1 columna en teléfonos celulares */}
        <form onSubmit={guardarEmpleado} style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '25px', marginTop: '25px' }}>
          
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
              style={estiloInputBase} 
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
              style={estiloInputBase} 
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#0284c7', marginBottom: '8px', textTransform: 'uppercase' }}>
              Cédula (Usuario App Android)
            </label>
            <input 
              type="text"
              name="cedula" 
              value={formulario.cedula} 
              onChange={manejarCambio} 
              required 
              placeholder="Ej: V12345678"
              style={{ ...estiloInputBase, border: '2px solid #bae6fd', backgroundColor: '#f0f9ff', fontWeight: '700' }} 
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
              style={estiloInputBase} 
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
              style={estiloInputBase} 
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#0f172a', marginBottom: '8px', textTransform: 'uppercase' }}>
              Tolerancia (Minutos de Gracia)
            </label>
            <input 
              type="number" 
              name="tolerancia_minutos" 
              value={formulario.tolerancia_minutos} 
              onChange={manejarCambio} 
              required 
              min="0"
              max="60"
              style={estiloInputBase} 
            />
          </div>

          {/* SELECTOR DESPLEGABLE HORARIO DE ENTRADA VENEZUELA */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#0f172a', marginBottom: '8px', textTransform: 'uppercase' }}>
              Hora de Entrada (Formatos Líquidos)
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

          {/* SELECTOR DESPLEGABLE HORARIO DE SALIDA VENEZUELA */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#0f172a', marginBottom: '8px', textTransform: 'uppercase' }}>
              Hora de Salida (Formatos Líquidos)
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
            <button 
              type="submit" 
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', width: '100%', padding: '15px', backgroundColor: '#0f172a', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.15)' }}
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