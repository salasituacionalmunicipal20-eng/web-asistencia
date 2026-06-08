import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { supabase } from '../supabase'
import { Save, FileText, Search, UserCheck, Trash2 } from 'lucide-react'
import { useIsMobile } from '../hooks/useIsMobile'

export default function Memos() {
  const isMobile = useIsMobile()
  const [lista, setLista] = useState([])
  const [empleados, setEmpleados] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [mostrarDropdown, setMostrarDropdown] = useState(false)
  const [cargandoLista, setCargandoLista] = useState(false)
  const [errorLista, setErrorLista] = useState('')
  const [enviando, setEnviando] = useState(false)

  const [formulario, setFormulario] = useState({ empleado_id: '', titulo: '', descripcion: '' })
  const [mensaje, setMensaje] = useState({ texto: '', tipo: '' })
  const [filtroBusqueda, setFiltroBusqueda] = useState('')

  const borrarMemo = async (id) => {
    if (!confirm('¿Eliminar este memorandum? La accion queda en auditoria.')) return
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.rpc('eliminar_con_auditoria', {
      p_tabla: 'memorandums',
      p_id: id,
      p_admin_email: user?.email || null
    })
    if (error) { alert(`Error: ${error.message}`); return }
    obtenerMemos()
  }

  // Cierra el dropdown del buscador cuando se hace click fuera de él
  const buscadorRef = useRef(null)
  useEffect(() => {
    const onClickFuera = (e) => {
      if (buscadorRef.current && !buscadorRef.current.contains(e.target)) {
        setMostrarDropdown(false)
      }
    }
    document.addEventListener('mousedown', onClickFuera)
    return () => document.removeEventListener('mousedown', onClickFuera)
  }, [])

  const obtenerMemos = useCallback(async () => {
    setCargandoLista(true)
    setErrorLista('')
    const { data, error: errBd } = await supabase.from('memorandums').select('*').order('fecha_emision', { ascending: false })
    if (errBd) {
      setErrorLista(`No se pudo cargar el historial: ${errBd.message}`)
    } else {
      setLista(data || [])
    }
    setCargandoLista(false)
  }, [])

  const obtenerEmpleados = useCallback(async () => {
    const { data, error: errBd } = await supabase.from('empleados').select('cedula, nombres, apellidos').order('nombres', { ascending: true })
    if (!errBd && data) setEmpleados(data)
  }, [])

  useEffect(() => {
    obtenerMemos()
    obtenerEmpleados()
  }, [obtenerMemos, obtenerEmpleados])

  const manejarCambio = (e) => setFormulario({ ...formulario, [e.target.name]: e.target.value })

  // Lógica del buscador en tiempo real
  // Mapa cedula -> nombre completo para mostrar el nombre del destinatario en
  // la tabla de memos historicos (la tabla `memos` solo guarda empleado_id=cedula).
  const mapaEmpleados = useMemo(() => {
    const m = {}
    for (const e of empleados) m[e.cedula] = `${e.nombres || ''} ${e.apellidos || ''}`.trim()
    return m
  }, [empleados])

  const empleadosFiltrados = empleados.filter(emp =>
    `${emp.nombres} ${emp.apellidos} ${emp.cedula}`.toLowerCase().includes(busqueda.toLowerCase())
  )

  const seleccionarEmpleado = (emp) => {
    setFormulario({ ...formulario, empleado_id: emp.cedula })
    setBusqueda(`${emp.nombres} ${emp.apellidos} (${emp.cedula})`)
    setMostrarDropdown(false)
  }

  const enviarMemo = async (e) => {
    e.preventDefault()
    if (!formulario.empleado_id) {
      setMensaje({ texto: '⛔ Selecciona un empleado de la lista primero.', tipo: 'error' })
      return
    }
    setEnviando(true)
    setMensaje({ texto: 'Enviando memorándum...', tipo: 'info' })
    const { error } = await supabase.from('memorandums').insert([{ ...formulario }])
    setEnviando(false)

    if (error) {
      setMensaje({ texto: `⛔ Hubo un error al enviar el memorándum: ${error.message}`, tipo: 'error' })
    } else {
      setMensaje({ texto: `✅ Memorándum enviado a la Cédula: ${formulario.empleado_id}`, tipo: 'exito' })
      setFormulario({ empleado_id: '', titulo: '', descripcion: '' })
      setBusqueda('')
      obtenerMemos()
    }
  }

  const estiloInput = { width: '100%', padding: '14px', boxSizing: 'border-box', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '15px', outline: 'none', transition: 'border-color 0.2s', backgroundColor: '#f8fafc', color: '#0f172a', fontWeight: 600 }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: isMobile ? '5px' : '0' }}>
      <div style={{ marginBottom: '30px', background: 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)', padding: '25px', borderRadius: '16px', color: 'white', boxShadow: '0 10px 20px -5px rgba(59, 130, 246, 0.4)' }}>
        <h1 style={{ margin: '0 0 5px 0', fontSize: isMobile ? '24px' : '28px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '10px' }}><FileText size={32}/> Emisión de Memorándums</h1>
        <p style={{ margin: 0, fontSize: '15px', opacity: 0.9 }}>Redacta llamados de atención directamente a la App del servidor público.</p>
      </div>

      <div style={{ backgroundColor: 'white', padding: isMobile ? '25px' : '35px', borderRadius: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9', marginBottom: '40px' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '0 0 25px 0', color: '#1e293b', borderBottom: '2px solid #e0e7ff', paddingBottom: '15px', textTransform: 'uppercase', fontWeight: '800' }}>
          Redactar Nuevo Documento
        </h3>
        
        <form onSubmit={enviarMemo} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '20px' }}>
            
            {/* BUSCADOR DE EMPLEADOS EN TIEMPO REAL */}
            <div ref={buscadorRef} style={{ position: 'relative' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: '#4f46e5', marginBottom: '8px', textTransform: 'uppercase' }}>Buscar Empleado</label>
              <div style={{ position: 'relative' }}>
                <Search size={18} color="#64748b" style={{ position: 'absolute', left: '12px', top: '15px' }} />
                <input 
                  type="text" 
                  value={busqueda} 
                  onChange={(e) => { setBusqueda(e.target.value); setMostrarDropdown(true); setFormulario({...formulario, empleado_id: ''}); }} 
                  onFocus={() => setMostrarDropdown(true)}
                  placeholder="Ej: Buscar por nombre o cédula..." 
                  style={{ ...estiloInput, paddingLeft: '40px', border: '2px solid #c7d2fe', backgroundColor: '#e0e7ff', fontWeight: '600', color: '#1e1b4b' }} 
                />
              </div>
              
              {mostrarDropdown && busqueda.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '10px', marginTop: '5px', zIndex: 10, maxHeight: '200px', overflowY: 'auto', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
                  {empleadosFiltrados.length > 0 ? (
                    empleadosFiltrados.map(emp => (
                      <div key={emp.cedula} onClick={() => seleccionarEmpleado(emp)} style={{ padding: '12px 15px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', transition: 'background 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}>
                        <UserCheck size={16} color="#3b82f6" />
                        <div><div style={{ fontWeight: '700', color: '#0f172a', fontSize: '14px' }}>{emp.nombres} {emp.apellidos}</div><div style={{ fontSize: '12px', color: '#64748b' }}>{emp.cedula}</div></div>
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: '15px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>No se encontraron coincidencias.</div>
                  )}
                </div>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: '#334155', marginBottom: '8px', textTransform: 'uppercase' }}>Título / Asunto</label>
              <input type="text" name="titulo" value={formulario.titulo} onChange={manejarCambio} required placeholder="Ej: Llamado de atención institucional" style={estiloInput} />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: '#334155', marginBottom: '8px', textTransform: 'uppercase' }}>Cuerpo del Mensaje</label>
            <textarea name="descripcion" value={formulario.descripcion} onChange={manejarCambio} required rows="4" placeholder="Redacte aquí el motivo oficial..." style={{ ...estiloInput, resize: 'vertical' }}></textarea>
          </div>

          <button type="submit" disabled={enviando} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '16px', background: 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)', color: 'white', border: 'none', borderRadius: '10px', fontSize: '16px', fontWeight: 'bold', cursor: enviando ? 'wait' : 'pointer', opacity: enviando ? 0.7 : 1, boxShadow: '0 4px 6px -1px rgba(79, 70, 229, 0.3)' }}>
            <Save size={20}/> {enviando ? 'Enviando...' : 'Emitir Memorándum Oficial'}
          </button>
        </form>
        {mensaje.texto && <div style={{ marginTop: '20px', padding: '15px', borderRadius: '10px', backgroundColor: mensaje.tipo === 'error' ? '#fef2f2' : '#f0fdf4', color: mensaje.tipo === 'error' ? '#ef4444' : '#16a34a', fontWeight: '700', textAlign: 'center', fontSize: '14px', border: `1px solid ${mensaje.tipo === 'error' ? '#fecaca' : '#bbf7d0'}` }}>{mensaje.texto}</div>}
      </div>

      <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', overflow: 'hidden', border: '1px solid #f1f5f9' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid #f1f5f9', backgroundColor: '#fafafa', display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', gap: 10 }}>
          <h3 style={{ margin: 0, color: '#1e293b', fontSize: '16px', fontWeight: '800', textTransform: 'uppercase' }}>Historial de Envíos</h3>
          <div style={{ position: 'relative', minWidth: 220 }}>
            <Search size={14} color="#64748b" style={{ position: 'absolute', left: 10, top: 10 }} />
            <input type="text" value={filtroBusqueda} onChange={e => setFiltroBusqueda(e.target.value)} placeholder="Buscar por nombre, cédula o asunto..."
              style={{ width: '100%', padding: '8px 8px 8px 32px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, color: '#0f172a', backgroundColor: '#f8fafc', fontWeight: 600, boxSizing: 'border-box' }} />
          </div>
        </div>
        <div style={{ width: '100%', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '700px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', color: '#475569', fontSize: '12px', textTransform: 'uppercase' }}>
                <th style={{ padding: '15px 20px', borderBottom: '1px solid #e2e8f0' }}>Fecha</th>
                <th style={{ padding: '15px 20px', borderBottom: '1px solid #e2e8f0' }}>Empleado Destino</th>
                <th style={{ padding: '15px 20px', borderBottom: '1px solid #e2e8f0' }}>Asunto</th>
                <th style={{ padding: '15px 20px', borderBottom: '1px solid #e2e8f0' }}>Estatus App</th>
                <th style={{ padding: '15px 20px', borderBottom: '1px solid #e2e8f0', textAlign: 'center' }}>Accion</th>
              </tr>
            </thead>
            <tbody>
              {lista?.filter(item => {
                if (!filtroBusqueda) return true
                const q = filtroBusqueda.toLowerCase()
                const nombreEmp = (mapaEmpleados[item.empleado_id] || '').toLowerCase()
                return (item.empleado_id || '').toLowerCase().includes(q)
                    || (item.titulo || '').toLowerCase().includes(q)
                    || nombreEmp.includes(q)
              }).map((item) => (
                <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9', fontSize: '14px' }}>
                  <td style={{ padding: '15px 20px', fontWeight: '600', color: '#64748b' }}>{String(item?.fecha_emision || '').substring(0,10)}</td>
                  <td style={{ padding: '15px 20px' }}>
                    <div style={{ fontWeight: '700', color: '#0f172a' }}>
                      {mapaEmpleados[item?.empleado_id] || <span style={{ color: '#94a3b8', fontWeight: 600, fontStyle: 'italic' }}>(empleado eliminado)</span>}
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: '#4f46e5', marginTop: 2 }}>C.I. {item?.empleado_id}</div>
                  </td>
                  <td style={{ padding: '15px 20px', color: '#1e293b', fontWeight: '600' }}>{item?.titulo}</td>
                  <td style={{ padding: '15px 20px' }}>
                    <span style={{ padding: '6px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: '800', backgroundColor: item?.leido ? '#dcfce7' : '#fee2e2', color: item?.leido ? '#16a34a' : '#ef4444', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {item?.leido ? 'Visto ✔' : 'Sin Leer'}
                    </span>
                  </td>
                  <td style={{ padding: '15px 20px', textAlign: 'center' }}>
                    <button onClick={() => borrarMemo(item.id)} title="Eliminar" style={{ backgroundColor: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', padding: 6, borderRadius: 6, cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}><Trash2 size={12} /></button>
                  </td>
                </tr>
              ))}
              {cargandoLista && lista.length === 0 && (
                <tr><td colSpan="4" style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontWeight: '600' }}>Cargando historial...</td></tr>
              )}
              {!cargandoLista && errorLista && (
                <tr><td colSpan="4" style={{ padding: '40px', textAlign: 'center', color: '#ef4444', fontWeight: 700, backgroundColor: '#fef2f2' }}>⛔ {errorLista}</td></tr>
              )}
              {!cargandoLista && !errorLista && lista.length === 0 && (
                <tr><td colSpan="4" style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontWeight: '600' }}>No se han emitido memorándums.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}