import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { MapPin, Users, Calendar as CalendarIcon, Clock, Download, CheckCircle, XCircle } from 'lucide-react'
import jsPDF from 'jspdf'
import 'jspdf-autotable'

export default function PanelPrincipal() {
  const [registros, setRegistros] = useState([])
  const [cargandoDatos, setCargandoDatos] = useState(false)

  useEffect(() => {
    obtenerRegistros()
  }, [])

  async function obtenerRegistros() {
    setCargandoDatos(true)
    const { data } = await supabase.from('asistencia_registros').select('*').order('hora_entrada', { ascending: false })
    if (data) setRegistros(data)
    setCargandoDatos(false)
  }

  const generarPDF = () => {
    const doc = new jsPDF()
    doc.setFontSize(16)
    doc.setFont("helvetica", "bold")
    doc.text('ALCALDÍA DEL MUNICIPIO CRISTÓBAL ROJAS - CHARALLAVE', 14, 20)
    doc.setFontSize(12)
    doc.text('Despacho de la Alcaldesa - Reporte General de Jornada', 14, 28)

    const tablaDatos = registros.map(registro => [
      registro.empleado_id,
      registro.fecha,
      new Date(registro.hora_entrada).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
      registro.hora_salida ? new Date(registro.hora_salida).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Sin Marcar',
      registro.tipo_red || 'GPS'
    ])

    doc.autoTable({
      startY: 38,
      head: [['Cédula', 'Fecha', 'Hora Entrada', 'Hora Salida', 'Método']],
      body: tablaDatos,
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42] }
    })

    doc.save('Asistencia_Jornada_Charallave.pdf')
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <div>
          <h1 style={{ margin: '0 0 5px 0', color: '#0f172a', fontSize: '28px' }}>Auditoría de Jornada Laboral</h1>
          <p style={{ margin: 0, color: '#64748b' }}>Monitoreo de entradas y salidas del personal de la Alcaldía</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={obtenerRegistros} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 15px', backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
            <Clock size={18} /> Actualizar
          </button>
          <button onClick={generarPDF} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 15px', backgroundColor: '#0284c7', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
            <Download size={18} /> Exportar Reporte PDF
          </button>
        </div>
      </div>

      <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc', color: '#475569', fontSize: '13px', textTransform: 'uppercase' }}>
              <th style={{ padding: '15px 20px', borderBottom: '1px solid #e2e8f0' }}>Cédula</th>
              <th style={{ padding: '15px 20px', borderBottom: '1px solid #e2e8f0' }}>Fecha</th>
              <th style={{ padding: '15px 20px', borderBottom: '1px solid #e2e8f0' }}>Hora Entrada</th>
              <th style={{ padding: '15px 20px', borderBottom: '1px solid #e2e8f0' }}>Hora Salida</th>
              <th style={{ padding: '15px 20px', borderBottom: '1px solid #e2e8f0' }}>Ubicación GPS</th>
            </tr>
          </thead>
          <tbody>
            {registros.map((registro) => (
              <tr key={registro.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '15px 20px', fontWeight: '600' }}>{registro.empleado_id}</td>
                <td style={{ padding: '15px 20px', color: '#64748b' }}>{registro.fecha}</td>
                <td style={{ padding: '15px 20px', color: '#0f172a', fontWeight: '500' }}>
                  {new Date(registro.hora_entrada).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </td>
                <td style={{ padding: '15px 20px' }}>
                  {registro.hora_salida ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#16a34a', fontWeight: '600' }}>
                      <CheckCircle size={16} /> {new Date(registro.hora_salida).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </span>
                  ) : (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#dc2626', fontWeight: '600', backgroundColor: '#fee2e2', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}>
                      <XCircle size={14} /> Sin Marcar Salida
                    </span>
                  )}
                </td>
                <td style={{ padding: '15px 20px' }}>
                  <a href={`https://www.google.com/maps?q=${registro.latitud},${registro.longitud}`} target="_blank" rel="noreferrer" style={{ color: '#0284c7', textDecoration: 'none', fontWeight: '600' }}><MapPin size={16} /> Ver Mapa</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}