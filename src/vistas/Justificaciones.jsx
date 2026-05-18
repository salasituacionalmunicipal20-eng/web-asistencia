import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { CheckCircle, XCircle, Clock } from 'lucide-react'

export default function Justificaciones() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [lista, setLista] = useState([])

  useEffect(() => {
    obtenerDatos()
    const verificarPantalla = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', verificarPantalla)
    return () => window.removeEventListener('resize', verificarPantalla)
  }, [])

  async function obtenerDatos() {
    const { data } = await supabase.from('justificaciones').select('*').order('fecha_solicitud', { ascending: false })
    if (data) setLista(data)
  }

  const cambiarEstado = async (id, nuevoEstado) => {
    await supabase.from('justificaciones').update({ estado: nuevoEstado }).eq('id', id)
    obtenerDatos() // Recargar lista al instante
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: isMobile ? '5px' : '0' }}>
      <div style={{ marginBottom: '30px' }}>
        <h1 style={{ margin: '0 0 5px 0', color: '#0f172a', fontSize: isMobile ? '24px' : '28px', fontWeight: '800' }}>Bandeja de Justificaciones</h1>
        <p style={{ margin: 0, color: '#64748b', fontSize: '15px' }}>Aprueba o rechaza las faltas reportadas por el personal desde la App.</p>
      </div>

      <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
        <div style={{ width: '100%', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '700px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f1f5f9', color: '#475569', fontSize: '12px', textTransform: 'uppercase', fontWeight: 'bold' }}>
                <th style={{ padding: '15px 20px', borderBottom: '1px solid #e2e8f0' }}>Cédula</th>
                <th style={{ padding: '15px 20px', borderBottom: '1px solid #e2e8f0' }}>Fecha Falta</th>
                <th style={{ padding: '15px 20px', borderBottom: '1px solid #e2e8f0' }}>Motivo</th>
                <th style={{ padding: '15px 20px', borderBottom: '1px solid #e2e8f0' }}>Estado</th>
                <th style={{ padding: '15px 20px', borderBottom: '1px solid #e2e8f0', textAlign: 'center' }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {lista?.map((item) => (
                <tr key={item.id} style={{ borderBottom: '1px solid #e2e8f0', fontSize: '14px' }}>
                  <td style={{ padding: '15px 20px', fontWeight: '700', color: '#0f172a' }}>{item?.empleado_id}</td>
                  <td style={{ padding: '15px 20px', fontWeight: '600' }}>{String(item?.fecha_falta || '').substring(0,10)}</td>
                  <td style={{ padding: '15px 20px', color: '#475569' }}>{item?.motivo}</td>
                  <td style={{ padding: '15px 20px', fontWeight: 'bold' }}>
                    <span style={{ 
                      color: item?.estado === 'Aprobado' ? '#16a34a' : (item?.estado === 'Rechazado' ? '#dc2626' : '#ea580c'),
                      backgroundColor: item?.estado === 'Aprobado' ? '#dcfce7' : (item?.estado === 'Rechazado' ? '#fee2e2' : '#ffedd5'),
                      padding: '4px 8px', borderRadius: '6px', fontSize: '12px' 
                    }}>
                      {item?.estado || 'Pendiente'}
                    </span>
                  </td>
                  <td style={{ padding: '15px 20px', textAlign: 'center', display: 'flex', gap: '10px', justifyContent: 'center' }}>
                    {item?.estado === 'Pendiente' ? (
                      <>
                        <button onClick={() => cambiarEstado(item.id, 'Aprobado')} style={{ backgroundColor: '#16a34a', color: 'white', border: 'none', padding: '8px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><CheckCircle size={16} /></button>
                        <button onClick={() => cambiarEstado(item.id, 'Rechazado')} style={{ backgroundColor: '#dc2626', color: 'white', border: 'none', padding: '8px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><XCircle size={16} /></button>
                      </>
                    ) : (
                      <span style={{ fontSize: '12px', color: '#94a3b8' }}>Procesado</span>
                    )}
                  </td>
                </tr>
              ))}
              {(!lista || lista.length === 0) && (
                <tr><td colSpan="5" style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>No hay justificaciones pendientes.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}