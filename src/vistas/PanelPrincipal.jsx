import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { MapPin, Users, Calendar as CalendarIcon, Clock, Download, CheckCircle } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export default function PanelPrincipal() {
  const [registros, setRegistros] = useState([])
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  useEffect(() => {
    obtenerRegistros()
    const verificarPantalla = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', verificarPantalla)
    return () => window.removeEventListener('resize', verificarPantalla)
  }, [])

  async function obtenerRegistros() {
    const { data } = await supabase.from('asistencia_registros').select('*').order('hora_entrada', { ascending: false })
    if (data) setRegistros(data)
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

    autoTable(doc, {
      startY: 38,
      head: [['Cédula', 'Fecha', 'Hora Entrada', 'Hora Salida', 'Método']],
      body: tablaDatos,
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42] }
    })
    doc.save('Asistencia_Jornada_Charallave.pdf')
  }

  const hoy = new Date().toISOString().split('T')[0]
  const registrosHoy = registros.filter(r => r.fecha === hoy).length

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: isMobile ? '5px' : '0' }}>
      
      {/* HEADER MODERNO */}
      <div style={{ marginBottom: '30px', background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', padding: '25px', borderRadius: '16px', color: 'white', boxShadow: '0 10px 20px -5px rgba(2, 132, 199, 0.4)', display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', gap: '15px' }}>
        <div>
          <h1 style={{ margin: '0 0 5px 0', fontSize: isMobile ? '24px' : '28px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '10px' }}><Clock size={32}/> Auditoría de Jornada</h1>
          <p style={{ margin: 0, fontSize: '15px', opacity: 0.9 }}>Salas Situacionales - Municipio Cristóbal Rojas</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', width: isMobile ? '100%' : 'auto' }}>
          <button onClick={obtenerRegistros} style={{ flex: isMobile ? 1 : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px 16px', backgroundColor: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', backdropFilter: 'blur(10px)', transition: 'background 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.3)'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)'}>
            Actualizar
          </button>
          <button onClick={generarPDF} style={{ flex: isMobile ? 1 : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px 16px', backgroundColor: 'white', color: '#0369a1', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: '900', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
            <Download size={18} /> Exportar PDF
          </button>
        </div>
      </div>

      {/* TARJETAS DE ESTADÍSTICAS */}
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '20px', marginBottom: '30px' }}>
        <div style={{ flex: 1, backgroundColor: 'white', padding: '25px', borderRadius: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: '20px', border: '1px solid #f1f5f9' }}>
          <div style={{ padding: '15px', backgroundColor: '#e0f2fe', borderRadius: '12px', color: '#0284c7' }}><CalendarIcon size={28} /></div>
          <div><p style={{ margin: 0, color: '#64748b', fontSize: '13px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Asistencias Hoy</p><h3 style={{ margin: 0, color: '#0f172a', fontSize: '32px', fontWeight: '900' }}>{registrosHoy}</h3></div>
        </div>
        <div style={{ flex: 1, backgroundColor: 'white', padding: '25px', borderRadius: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: '20px', border: '1px solid #f1f5f9' }}>
          <div style={{ padding: '15px', backgroundColor: '#f1f5f9', borderRadius: '12px', color: '#475569' }}><Users size={28} /></div>
          <div><p style={{ margin: 0, color: '#64748b', fontSize: '13px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Histórico</p><h3 style={{ margin: 0, color: '#0f172a', fontSize: '32px', fontWeight: '900' }}>{registros.length}</h3></div>
        </div>
      </div>

      {/* TABLA DE AUDITORÍA */}
      <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', overflow: 'hidden', border: '1px solid #f1f5f9' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid #f1f5f9', backgroundColor: '#fafafa' }}><h3 style={{ margin: 0, color: '#1e293b', fontSize: '16px', fontWeight: '800', textTransform: 'uppercase' }}>Bitácora de Ingresos</h3></div>
        <div style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', color: '#475569', fontSize: '12px', textTransform: 'uppercase', fontWeight: '800' }}>
                <th style={{ padding: '18px 20px', borderBottom: '2px solid #e2e8f0' }}>Cédula</th>
                <th style={{ padding: '18px 20px', borderBottom: '2px solid #e2e8f0' }}>Fecha</th>
                <th style={{ padding: '18px 20px', borderBottom: '2px solid #e2e8f0' }}>Entrada</th>
                <th style={{ padding: '18px 20px', borderBottom: '2px solid #e2e8f0' }}>Salida</th>
                <th style={{ padding: '18px 20px', borderBottom: '2px solid #e2e8f0', textAlign: 'center' }}>Ubicación</th>
              </tr>
            </thead>
            <tbody>
              {registros.map((registro) => (
                <tr key={registro.id} style={{ borderBottom: '1px solid #f1f5f9', fontSize: '14px', transition: 'background 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}>
                  <td style={{ padding: '15px 20px', fontWeight: '800', color: '#0369a1' }}>{registro.empleado_id}</td>
                  <td style={{ padding: '15px 20px', color: '#64748b', fontWeight: '600' }}>{registro.fecha}</td>
                  <td style={{ padding: '15px 20px', fontWeight: '700', color: '#0f172a' }}>{new Date(registro.hora_entrada).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                  <td style={{ padding: '15px 20px' }}>
                    {registro.hora_salida ? (
                      <span style={{ color: '#16a34a', fontWeight: '800', display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#dcfce7', padding: '4px 10px', borderRadius: '20px', fontSize: '12px' }}><CheckCircle size={14} />{new Date(registro.hora_salida).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    ) : (
                      <span style={{ color: '#dc2626', fontWeight: '800', backgroundColor: '#fee2e2', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', textTransform: 'uppercase' }}>Pendiente</span>
                    )}
                  </td>
                  <td style={{ padding: '15px 20px', textAlign: 'center' }}>
                    <a href={`https://www.google.com/maps?q=${registro.latitud},${registro.longitud}`} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '6px 12px', backgroundColor: '#f1f5f9', color: '#0284c7', borderRadius: '8px', textDecoration: 'none', fontWeight: '700', fontSize: '12px' }}><MapPin size={14} /> GPS</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}