import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '../supabase'
import { BookOpen, Download, Search, UserCheck, Calendar, Clock, AlertCircle } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { useIsMobile } from '../hooks/useIsMobile'

export default function Reportes() {
  const isMobile = useIsMobile()
  const [empleados, setEmpleados] = useState([])
  const [asistencias, setAsistencias] = useState([])
  const [justificaciones, setJustificaciones] = useState([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  const [busqueda, setBusqueda] = useState('')
  const [empleadoSeleccionado, setEmpleadoSeleccionado] = useState(null)

  const cargarTodaLaData = useCallback(async () => {
    setCargando(true)
    setError('')
    const [resEmp, resAsist, resJust] = await Promise.all([
      supabase.from('empleados').select('*').order('nombres', { ascending: true }),
      supabase.from('asistencia_registros').select('*').order('fecha', { ascending: false }),
      supabase.from('justificaciones').select('*').order('fecha_falta', { ascending: false }),
    ])
    const errBd = resEmp.error || resAsist.error || resJust.error
    if (errBd) {
      setError(`No se pudo cargar la data: ${errBd.message}`)
    } else {
      setEmpleados(resEmp.data || [])
      setAsistencias(resAsist.data || [])
      setJustificaciones(resJust.data || [])
    }
    setCargando(false)
  }, [])

  useEffect(() => {
    cargarTodaLaData()
  }, [cargarTodaLaData])

  // Indexamos asistencias y justificaciones por cédula UNA SOLA VEZ por cambio de datos,
  // así obtenerHistorialCombinado() ya no hace .filter() sobre toda la lista en cada render.
  const indicePorCedula = useMemo(() => {
    const indice = new Map()
    asistencias.forEach((a) => {
      if (!indice.has(a.empleado_id)) indice.set(a.empleado_id, { asis: [], just: [] })
      indice.get(a.empleado_id).asis.push(a)
    })
    justificaciones.forEach((j) => {
      if (!indice.has(j.empleado_id)) indice.set(j.empleado_id, { asis: [], just: [] })
      indice.get(j.empleado_id).just.push(j)
    })
    return indice
  }, [asistencias, justificaciones])

  // Formatea "HH:mm:ss" -> "HH:mm". La columna hora_entrada/hora_salida ahora
  // es TEXT en Supabase (no timestamptz), por eso parseamos con substring.
  const formatearHoraTexto = (h) => {
    if (!h) return 'Sin Marcar'
    const s = String(h)
    return s.length >= 5 ? s.substring(0, 5) : s
  }

  const obtenerHistorialCombinado = useCallback((cedula) => {
    const datos = indicePorCedula.get(cedula) || { asis: [], just: [] }
    const asis = datos.asis.map(a => ({
      tipo: 'Asistencia',
      fecha: a.fecha,
      detalle: `Entrada: ${formatearHoraTexto(a.hora_entrada)} | Salida: ${formatearHoraTexto(a.hora_salida)}`
    }))
    const just = datos.just.map(j => ({
      tipo: 'Justificación',
      fecha: String(j.fecha_falta).substring(0,10),
      detalle: `Motivo: ${j.motivo} | Estatus: ${j.estado}`
    }))
    return [...asis, ...just].sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
  }, [indicePorCedula])

  // Historial del empleado actualmente seleccionado — recalculado solo si cambian datos
  const historialEmpleadoActual = useMemo(
    () => empleadoSeleccionado ? obtenerHistorialCombinado(empleadoSeleccionado.cedula) : [],
    [empleadoSeleccionado, obtenerHistorialCombinado]
  )

  const empleadosFiltrados = empleados.filter(emp => 
    `${emp.nombres} ${emp.apellidos} ${emp.cedula}`.toLowerCase().includes(busqueda.toLowerCase())
  )

  const generarPDFGlobal = () => {
    const doc = new jsPDF()
    doc.setFontSize(16)
    doc.setFont("helvetica", "bold")
    doc.text('ALCALDÍA DEL MUNICIPIO CRISTÓBAL ROJAS', 14, 20)
    doc.setFontSize(12)
    doc.text('Expediente Completo de Personal - Asistencias y Faltas', 14, 28)

    const tablaDatos = []

    empleados.forEach(emp => {
      const historial = obtenerHistorialCombinado(emp.cedula)
      
      // Fila de encabezado del empleado
      tablaDatos.push([{ 
        content: `SERVIDOR: ${emp.nombres} ${emp.apellidos} - C.I: ${emp.cedula} (${emp.cargo})`, 
        colSpan: 3, 
        styles: { fillColor: [224, 231, 255], fontStyle: 'bold', textColor: [30, 27, 75] } 
      }])

      if (historial.length === 0) {
        tablaDatos.push(['-', 'Sin registros de actividad', '-'])
      } else {
        historial.forEach(h => {
          tablaDatos.push([h.fecha, h.tipo, h.detalle])
        })
      }
    })

    autoTable(doc, {
      startY: 38,
      head: [['Fecha', 'Tipo de Registro', 'Detalle de Operación']],
      body: tablaDatos,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] },
      styles: { fontSize: 10 }
    })

    doc.save('Expediente_Laboral_Alcaldia.pdf')
  }

  const estiloInput = { width: '100%', padding: '14px', boxSizing: 'border-box', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '15px', outline: 'none', backgroundColor: '#f8fafc', color: '#0f172a', fontWeight: 600 }

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: isMobile ? '5px' : '0' }}>
      
      <div style={{ marginBottom: '30px', background: 'linear-gradient(135deg, #4f46e5 0%, #312e81 100%)', padding: '25px', borderRadius: '16px', color: 'white', boxShadow: '0 10px 20px -5px rgba(79, 70, 229, 0.4)', display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', gap: '15px' }}>
        <div>
          <h1 style={{ margin: '0 0 5px 0', fontSize: isMobile ? '24px' : '28px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '10px' }}><BookOpen size={32}/> Expedientes y Reportes</h1>
          <p style={{ margin: 0, fontSize: '15px', opacity: 0.9 }}>Búsqueda en tiempo real y exportación de historiales.</p>
        </div>
        <button onClick={generarPDFGlobal} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px 20px', backgroundColor: 'white', color: '#4f46e5', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: '900', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
          <Download size={18} /> Exportar Reporte Global
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '25px' }}>
        
        {/* COLUMNA IZQUIERDA: Buscador y Lista */}
        <div style={{ flex: '1', backgroundColor: 'white', padding: '25px', borderRadius: '16px', border: '1px solid #e0e7ff', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', maxHeight: '70vh', overflowY: 'auto' }}>
          <div style={{ position: 'relative', marginBottom: '20px' }}>
            <Search size={18} color="#64748b" style={{ position: 'absolute', left: '12px', top: '15px' }} />
            <input 
              type="text" 
              value={busqueda} 
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar servidor público..." 
              style={{ ...estiloInput, paddingLeft: '40px', border: '2px solid #c7d2fe', backgroundColor: '#e0e7ff', fontWeight: '600', color: '#1e1b4b' }} 
            />
          </div>

          {error && (
            <div style={{ padding: '12px 15px', backgroundColor: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', borderRadius: '8px', marginBottom: '15px', fontSize: '13px', fontWeight: 600 }}>
              ⛔ {error}
            </div>
          )}
          {cargando && empleados.length === 0 && (
            <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontWeight: 600 }}>Cargando data...</div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {empleadosFiltrados.map(emp => (
              <div 
                key={emp.cedula} 
                onClick={() => setEmpleadoSeleccionado(emp)}
                style={{ padding: '15px', borderRadius: '10px', cursor: 'pointer', border: empleadoSeleccionado?.cedula === emp.cedula ? '2px solid #4f46e5' : '1px solid #f1f5f9', backgroundColor: empleadoSeleccionado?.cedula === emp.cedula ? '#eef2ff' : 'white', display: 'flex', alignItems: 'center', gap: '15px', transition: 'all 0.2s' }}
              >
                <div style={{ padding: '10px', backgroundColor: empleadoSeleccionado?.cedula === emp.cedula ? '#c7d2fe' : '#f1f5f9', borderRadius: '10px', color: empleadoSeleccionado?.cedula === emp.cedula ? '#3730a3' : '#64748b' }}>
                  <UserCheck size={20} />
                </div>
                <div>
                  <div style={{ fontWeight: '800', color: '#1e1b4b', fontSize: '14px' }}>{emp.nombres} {emp.apellidos}</div>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>{emp.cedula} - {emp.cargo}</div>
                </div>
              </div>
            ))}
            {empleadosFiltrados.length === 0 && <div style={{ textAlign: 'center', color: '#94a3b8', padding: '20px', fontWeight: '600' }}>No hay resultados</div>}
          </div>
        </div>

        {/* COLUMNA DERECHA: Visor en Tiempo Real */}
        <div style={{ flex: '2', backgroundColor: 'white', padding: '25px', borderRadius: '16px', border: '1px solid #e0e7ff', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
          {empleadoSeleccionado ? (
            <>
              <h3 style={{ margin: '0 0 20px 0', color: '#1e1b4b', borderBottom: '2px solid #e0e7ff', paddingBottom: '15px', textTransform: 'uppercase', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '10px' }}>
                Expediente: {empleadoSeleccionado.nombres}
              </h3>
              
              <div style={{ maxHeight: '55vh', overflowY: 'auto', paddingRight: '10px' }}>
                {historialEmpleadoActual.map((item, index) => (
                  <div key={index} style={{ marginBottom: '15px', padding: '15px', borderRadius: '12px', borderLeft: `4px solid ${item.tipo === 'Asistencia' ? '#10b981' : '#f59e0b'}`, backgroundColor: '#f8fafc' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '12px', fontWeight: '800', color: '#64748b', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <Calendar size={14} /> {item.fecha}
                      </span>
                      <span style={{ fontSize: '11px', fontWeight: '900', padding: '4px 10px', borderRadius: '20px', backgroundColor: item.tipo === 'Asistencia' ? '#d1fae5' : '#fef3c7', color: item.tipo === 'Asistencia' ? '#047857' : '#b45309', textTransform: 'uppercase' }}>
                        {item.tipo}
                      </span>
                    </div>
                    <div style={{ color: '#1e293b', fontSize: '14px', fontWeight: '600', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      {item.tipo === 'Asistencia' ? <Clock size={16} color="#10b981" style={{marginTop:'3px'}}/> : <AlertCircle size={16} color="#f59e0b" style={{marginTop:'3px'}}/>}
                      <span>{item.detalle}</span>
                    </div>
                  </div>
                ))}

                {historialEmpleadoActual.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', fontWeight: '600' }}>El servidor público no presenta actividad reciente.</div>
                )}
              </div>
            </>
          ) : (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', textAlign: 'center' }}>
              <UserCheck size={64} style={{ opacity: 0.2, marginBottom: '15px' }} />
              <h3 style={{ margin: 0, fontWeight: '800' }}>Seleccione un Servidor Público</h3>
              <p style={{ margin: '5px 0 0 0', fontSize: '14px' }}>Busque en la lista de la izquierda para ver su expediente en tiempo real.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}