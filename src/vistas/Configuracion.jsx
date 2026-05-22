import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase'
import { Settings, MapPin, Clock, CalendarDays, Plus, Trash2, RefreshCw } from 'lucide-react'
import { useIsMobile } from '../hooks/useIsMobile'

/**
 * Pantalla de configuracion: oficinas (sedes con geofence), turnos y feriados.
 * Tres sub-tabs. Todas las operaciones van directo a Supabase con las policies
 * abiertas; cuando se ajusten las policies habra que migrar a RPCs.
 */
export default function Configuracion() {
  const isMobile = useIsMobile()
  const [tab, setTab] = useState('oficinas')

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: isMobile ? '5px' : '0' }}>
      <div style={{ marginBottom: '24px', background: 'linear-gradient(135deg, #475569 0%, #1e293b 100%)', padding: '25px', borderRadius: '16px', color: 'white', boxShadow: '0 10px 20px -5px rgba(71, 85, 105, 0.4)' }}>
        <h1 style={{ margin: '0 0 5px 0', fontSize: isMobile ? '22px' : '28px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Settings size={32} /> Configuracion del sistema
        </h1>
        <p style={{ margin: 0, fontSize: '14px', opacity: 0.9 }}>Sedes con geofence, turnos laborales y dias feriados.</p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { id: 'oficinas',  icono: MapPin,        label: 'Sedes / Geofence' },
          { id: 'turnos',    icono: Clock,         label: 'Turnos laborales' },
          { id: 'feriados',  icono: CalendarDays,  label: 'Dias feriados' }
        ].map(({ id, icono: Ic, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{
              padding: '10px 16px', borderRadius: 10,
              backgroundColor: tab === id ? '#0284c7' : 'white',
              color: tab === id ? 'white' : '#475569',
              border: '1px solid ' + (tab === id ? '#0284c7' : '#e2e8f0'),
              cursor: 'pointer', fontWeight: 800, fontSize: 13,
              display: 'inline-flex', alignItems: 'center', gap: 8
            }}>
            <Ic size={16} /> {label}
          </button>
        ))}
      </div>

      {tab === 'oficinas' && <PanelOficinas />}
      {tab === 'turnos'   && <PanelTurnos />}
      {tab === 'feriados' && <PanelFeriados />}
    </div>
  )
}

// ============================================================================
// OFICINAS
// ============================================================================
function PanelOficinas() {
  const [lista, setLista] = useState([])
  const [cargando, setCargando] = useState(false)
  const [nuevo, setNuevo] = useState({ nombre: '', direccion: '', latitud: '', longitud: '', radio_metros: 50 })

  const cargar = useCallback(async () => {
    setCargando(true)
    const { data } = await supabase.from('oficinas').select('*').order('nombre')
    setLista(data || [])
    setCargando(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const guardar = async (e) => {
    e.preventDefault()
    if (!nuevo.nombre || !nuevo.latitud || !nuevo.longitud) {
      alert('Nombre, latitud y longitud son obligatorios')
      return
    }
    const { error } = await supabase.from('oficinas').insert({
      nombre: nuevo.nombre.trim(),
      direccion: nuevo.direccion || null,
      latitud: Number(nuevo.latitud),
      longitud: Number(nuevo.longitud),
      radio_metros: Number(nuevo.radio_metros) || 50
    })
    if (error) { alert(`Error: ${error.message}`); return }
    setNuevo({ nombre: '', direccion: '', latitud: '', longitud: '', radio_metros: 50 })
    cargar()
  }

  const borrar = async (id) => {
    if (!confirm('¿Eliminar esta sede? Los empleados que esten lejos no podran marcar desde ella.')) return
    const { error } = await supabase.from('oficinas').delete().eq('id', id)
    if (error) { alert(`Error: ${error.message}`); return }
    cargar()
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20 }}>
      <Tarjeta titulo="Agregar sede">
        <form onSubmit={guardar} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <Campo label="Nombre" value={nuevo.nombre} onChange={v => setNuevo({...nuevo, nombre: v})} required />
          <Campo label="Direccion" value={nuevo.direccion} onChange={v => setNuevo({...nuevo, direccion: v})} />
          <Campo label="Latitud"  value={nuevo.latitud}  onChange={v => setNuevo({...nuevo, latitud: v})}  type="number" step="any" required />
          <Campo label="Longitud" value={nuevo.longitud} onChange={v => setNuevo({...nuevo, longitud: v})} type="number" step="any" required />
          <Campo label="Radio (m)" value={nuevo.radio_metros} onChange={v => setNuevo({...nuevo, radio_metros: v})} type="number" />
          <button type="submit" style={botonPrimario}><Plus size={16}/> Agregar sede</button>
        </form>
      </Tarjeta>

      <Tarjeta titulo={`Sedes registradas (${lista.length})`} accionDerecha={<BtnRefrescar onClick={cargar} cargando={cargando} />}>
        {lista.length === 0 ? <Vacio mensaje="Aun no hay sedes" /> : (
          <Tabla
            columnas={['Nombre', 'Direccion', 'Lat', 'Lng', 'Radio', 'Activa', 'Accion']}
            filas={lista.map(o => [o.nombre, o.direccion || '--', o.latitud, o.longitud, `${o.radio_metros}m`, o.activa ? 'Si' : 'No',
              <button onClick={() => borrar(o.id)} key={o.id} style={botonBorrar} title="Eliminar"><Trash2 size={14}/></button>])}
          />
        )}
      </Tarjeta>
    </div>
  )
}

// ============================================================================
// TURNOS
// ============================================================================
function PanelTurnos() {
  const [lista, setLista] = useState([])
  const [cargando, setCargando] = useState(false)
  const [nuevo, setNuevo] = useState({ nombre: '', hora_entrada: '08:00', hora_salida: '17:00', tolerancia_minutos: 15 })

  const cargar = useCallback(async () => {
    setCargando(true)
    const { data } = await supabase.from('turnos').select('*').order('nombre')
    setLista(data || [])
    setCargando(false)
  }, [])
  useEffect(() => { cargar() }, [cargar])

  const guardar = async (e) => {
    e.preventDefault()
    if (!nuevo.nombre) { alert('Nombre es obligatorio'); return }
    const { error } = await supabase.from('turnos').insert({
      nombre: nuevo.nombre.trim(),
      hora_entrada: nuevo.hora_entrada + ':00',
      hora_salida: nuevo.hora_salida + ':00',
      tolerancia_minutos: Number(nuevo.tolerancia_minutos) || 15
    })
    if (error) { alert(`Error: ${error.message}`); return }
    setNuevo({ nombre: '', hora_entrada: '08:00', hora_salida: '17:00', tolerancia_minutos: 15 })
    cargar()
  }

  const borrar = async (id) => {
    if (!confirm('¿Eliminar este turno? Empleados con este turno asignado quedaran sin turno.')) return
    const { error } = await supabase.from('turnos').delete().eq('id', id)
    if (error) { alert(`Error: ${error.message}`); return }
    cargar()
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20 }}>
      <Tarjeta titulo="Agregar turno">
        <form onSubmit={guardar} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <Campo label="Nombre"            value={nuevo.nombre}             onChange={v => setNuevo({...nuevo, nombre: v})} required />
          <Campo label="Hora entrada"      value={nuevo.hora_entrada}       onChange={v => setNuevo({...nuevo, hora_entrada: v})} type="time" required />
          <Campo label="Hora salida"       value={nuevo.hora_salida}        onChange={v => setNuevo({...nuevo, hora_salida: v})} type="time" required />
          <Campo label="Tolerancia (min)"  value={nuevo.tolerancia_minutos} onChange={v => setNuevo({...nuevo, tolerancia_minutos: v})} type="number" />
          <button type="submit" style={botonPrimario}><Plus size={16}/> Agregar</button>
        </form>
      </Tarjeta>

      <Tarjeta titulo={`Turnos registrados (${lista.length})`} accionDerecha={<BtnRefrescar onClick={cargar} cargando={cargando} />}>
        {lista.length === 0 ? <Vacio mensaje="Aun no hay turnos" /> : (
          <Tabla
            columnas={['Nombre', 'Entrada', 'Salida', 'Tolerancia', 'Activo', 'Accion']}
            filas={lista.map(t => [t.nombre, String(t.hora_entrada).substring(0,5), String(t.hora_salida).substring(0,5), `${t.tolerancia_minutos}m`, t.activo ? 'Si' : 'No',
              <button onClick={() => borrar(t.id)} key={t.id} style={botonBorrar} title="Eliminar"><Trash2 size={14}/></button>])}
          />
        )}
      </Tarjeta>
    </div>
  )
}

// ============================================================================
// FERIADOS
// ============================================================================
function PanelFeriados() {
  const [lista, setLista] = useState([])
  const [cargando, setCargando] = useState(false)
  const [nuevo, setNuevo] = useState({ fecha: '', descripcion: '', tipo: 'NACIONAL' })

  const cargar = useCallback(async () => {
    setCargando(true)
    const { data } = await supabase.from('feriados').select('*').order('fecha', { ascending: false })
    setLista(data || [])
    setCargando(false)
  }, [])
  useEffect(() => { cargar() }, [cargar])

  const guardar = async (e) => {
    e.preventDefault()
    if (!nuevo.fecha || !nuevo.descripcion) { alert('Fecha y descripcion son obligatorias'); return }
    const { error } = await supabase.from('feriados').insert(nuevo)
    if (error) { alert(`Error: ${error.message}`); return }
    setNuevo({ fecha: '', descripcion: '', tipo: 'NACIONAL' })
    cargar()
  }

  const borrar = async (fecha) => {
    if (!confirm('¿Eliminar este feriado?')) return
    const { error } = await supabase.from('feriados').delete().eq('fecha', fecha)
    if (error) { alert(`Error: ${error.message}`); return }
    cargar()
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20 }}>
      <Tarjeta titulo="Agregar feriado">
        <form onSubmit={guardar} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <Campo label="Fecha"        value={nuevo.fecha}       onChange={v => setNuevo({...nuevo, fecha: v})} type="date" required />
          <Campo label="Descripcion"  value={nuevo.descripcion} onChange={v => setNuevo({...nuevo, descripcion: v})} required />
          <div>
            <label style={labelStyle}>Tipo</label>
            <select value={nuevo.tipo} onChange={e => setNuevo({...nuevo, tipo: e.target.value})} style={inputStyle}>
              <option>NACIONAL</option>
              <option>REGIONAL</option>
              <option>INSTITUCIONAL</option>
            </select>
          </div>
          <button type="submit" style={botonPrimario}><Plus size={16}/> Agregar</button>
        </form>
      </Tarjeta>

      <Tarjeta titulo={`Feriados (${lista.length})`} accionDerecha={<BtnRefrescar onClick={cargar} cargando={cargando} />}>
        {lista.length === 0 ? <Vacio mensaje="Aun no hay feriados" /> : (
          <Tabla
            columnas={['Fecha', 'Descripcion', 'Tipo', 'Accion']}
            filas={lista.map(f => [f.fecha, f.descripcion, f.tipo,
              <button onClick={() => borrar(f.fecha)} key={f.fecha} style={botonBorrar} title="Eliminar"><Trash2 size={14}/></button>])}
          />
        )}
      </Tarjeta>
    </div>
  )
}

// ============================================================================
// Componentes/estilos compartidos
// ============================================================================
const inputStyle  = { width: '100%', padding: 10, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, fontWeight: 600, backgroundColor: '#f8fafc', boxSizing: 'border-box' }
const labelStyle  = { display: 'block', fontSize: 11, fontWeight: 800, color: '#475569', marginBottom: 6, textTransform: 'uppercase' }
const botonPrimario = { padding: '10px 16px', backgroundColor: '#0284c7', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 800, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'end' }
const botonBorrar = { padding: 6, backgroundColor: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 6, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }

function Tarjeta({ titulo, children, accionDerecha }) {
  return (
    <div style={{ backgroundColor: 'white', padding: 20, borderRadius: 14, boxShadow: '0 4px 15px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#1e293b', textTransform: 'uppercase' }}>{titulo}</h3>
        {accionDerecha}
      </div>
      {children}
    </div>
  )
}

function Campo({ label, value, onChange, type = 'text', step, required }) {
  return (
    <div>
      <label style={labelStyle}>{label}{required ? ' *' : ''}</label>
      <input type={type} step={step} value={value} onChange={e => onChange(e.target.value)} required={required} style={inputStyle} />
    </div>
  )
}

function Tabla({ columnas, filas }) {
  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ backgroundColor: '#f8fafc', color: '#475569', textTransform: 'uppercase', fontSize: 11, fontWeight: 800 }}>
            {columnas.map(c => <th key={c} style={{ padding: '10px 12px', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {filas.map((fila, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
              {fila.map((celda, j) => <td key={j} style={{ padding: '10px 12px', color: '#1e293b', fontWeight: 600 }}>{celda}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Vacio({ mensaje }) {
  return <div style={{ padding: 30, textAlign: 'center', color: '#94a3b8', fontWeight: 600 }}>{mensaje}</div>
}

function BtnRefrescar({ onClick, cargando }) {
  return (
    <button onClick={onClick} disabled={cargando} style={{ padding: '6px 12px', backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: 6, cursor: cargando ? 'wait' : 'pointer', fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <RefreshCw size={12} /> Refrescar
    </button>
  )
}
