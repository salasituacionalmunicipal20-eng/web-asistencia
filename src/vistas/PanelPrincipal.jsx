import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { MapPin, Users, Calendar as CalendarIcon, Clock, Download } from 'lucide-react'
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

  // Generador de PDF Ejecutivo para la Alcaldía
  const generarPDF = () => {
    const doc = new jsPDF()
    
    // Membrete Oficial
    doc.setFontSize(16)
    doc.setFont("helvetica", "bold")
    doc.text('ALCALDÍA DEL MUNICIPIO CRISTÓBAL ROJAS - CHARALLAVE', 14, 20)
    doc.setFontSize(12)
    doc.setFont("helvetica", "normal")
    doc.text('Despacho de la Alcaldesa', 14, 28)
    doc.text('Reporte Oficial de Asistencia del Personal', 14, 34)
    
    doc.setFontSize(10)
    doc.setTextColor(100)
    doc.text(`Generado el: ${new Date().toLocaleString()}`, 14, 42)

    const tablaDatos = registros.map(registro => [
      registro.empleado_id,
      registro.fecha,
      new Date(registro.hora_entrada).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
      registro.tipo_red || 'GPS'
    ])

    doc.autoTable({
      startY: 48,
      head: [['Cédula Empleado', 'Fecha', 'Hora de Entrada', 'Red / Método']],
      body: tablaDatos,
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42] }, // Azul muy oscuro institucional
      styles: { fontSize: 10 }
    })

    doc.save('Asistencia_Alcaldia_Charallave.pdf')
  }

  const hoy = new Date().toISOString().split('T')[0]
  const registrosHoy = registros.filter(r => r.fecha === hoy).length

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <div>
          <h1 style={{ margin: '0 0 5px 0', color: '#0f172a', fontSize: '28px' }}>Panel de Control y Auditoría</h1>
          <p style={{ margin: 0, color: '#64748b' }}>Monitoreo en tiempo real - Salas Situacionales</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={obtenerRegistros} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 15px', backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            <Clock size={18} /> Actualizar
          </button>
          <button onClick={generarPDF} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 15px', backgroundColor: '#0284c7', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
            <Download size={18} /> Exportar Reporte PDF
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '20px', marginBottom: '30px' }}>
        <div style={{ flex: 1, backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', gap: '15px', borderLeft: '4px solid #0284c7' }}>
          <div style={{ padding: '15px', backgroundColor: '#e0f2fe', borderRadius: '50%', color: '#0284c7' }}><CalendarIcon size={24} /></div>
          <div><p style={{ margin: 0, color: '#64748b', fontSize: '14px', fontWeight: '600', textTransform: 'uppercase' }}>Asistencias Hoy</p><h3 style={{ margin: 0, color: '#0f172a', fontSize: '28px' }}>{registrosHoy}</h3></div>
        </div>
        <div style={{ flex: 1, backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', gap: '15px', borderLeft: '4px solid #475569' }}>
          <div style={{ padding: '15px', backgroundColor: '#f1f5f9', borderRadius: '50%', color: '#475569' }}><Users size={24} /></div>
          <div><p style={{ margin: 0, color: '#64748b', fontSize: '14px', fontWeight: '600', textTransform: 'uppercase' }}>Total Histórico</p><h3 style={{ margin: 0, color: '#0f172a', fontSize: '28px' }}>{registros.length}</h3></div>
        </div>
      </div>

      <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid #e2e8f0' }}><h3 style={{ margin: 0, color: '#0f172a' }}>Bitácora de Ingresos Recientes</h3></div>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc', color: '#475569', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              <th style={{ padding: '15px 20px', borderBottom: '1px solid #e2e8f0' }}>Cédula</th>
              <th style={{ padding: '15px 20px', borderBottom: '1px solid #e2e8f0' }}>Fecha / Hora</th>
              <th style={{ padding: '15px 20px', borderBottom: '1px solid #e2e8f0' }}>Ubicación GPS</th>
            </tr>
          </thead>
          <tbody>
            {registros.map((registro) => (
              <tr key={registro.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '15px 20px', fontWeight: '600', color: '#0f172a' }}>{registro.empleado_id}</td>
                <td style={{ padding: '15px 20px', color: '#64748b' }}>{registro.fecha} - <span style={{color: '#0f172a', fontWeight: '500'}}>{new Date(registro.hora_entrada).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span></td>
                <td style={{ padding: '15px 20px' }}><a href={`https://www.google.com/maps?q=${registro.latitud},${registro.longitud}`} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#0284c7', textDecoration: 'none', fontWeight: '600' }}><MapPin size={16} /> Mapa</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}