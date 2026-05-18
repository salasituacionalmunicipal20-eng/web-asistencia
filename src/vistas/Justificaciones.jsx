import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { CheckCircle, XCircle, ClipboardList, Camera } from 'lucide-react'

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
    obtenerDatos()
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: isMobile ? '5px' : '0' }}>
      
      <div style={{ marginBottom: '30px', background: 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)', padding: '25px', borderRadius: '16px', color: 'white', boxShadow: '0 10px 20px -5px rgba(14, 165, 233, 0.4)' }}>
        <h1 style={{ margin: '0 0 5px 0', fontSize: isMobile ? '24px' : '28px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '10px' }}><ClipboardList size={32}/> Bandeja de Justificaciones</h1>
        <p style={{ margin: 0, fontSize: '15px', opacity: 0.9 }}>Audita y procesa las faltas reportadas por el personal desde sus teléfonos.</p>
      </div>

      <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', overflow: 'hidden', border: '1px solid #f1f5f9' }}>
        <div style={{ width: '100%', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '750px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', color: '#475569', fontSize: '12px', textTransform: 'uppercase', fontWeight: '800' }}>
                <th style={{ padding: '18px 20px', borderBottom: '2px solid #e2e8f0' }}>Cédula</th>
                <th style={{ padding: '18px 20px', borderBottom: '2px solid #e2e8f0' }}>Fecha Falta</th>
                <th style={{ padding: '18px 20px', borderBottom: '2px solid #e2e8f0' }}>Motivo</th>
                <th style={{ padding: '18px 20px', borderBottom: '2px solid #e2e8f0', textAlign: 'center' }}>Soporte (Foto)</th>
                <th style={{ padding: '18px 20px', borderBottom: '2px solid #e2e8f0', textAlign: 'center' }}>Estado</th>
                <th style={{ padding: '18px 20px', borderBottom: '2px solid #e2e8f0', textAlign: 'center' }}>Decisión</th>
              </tr>
            </thead>
            <tbody>
              {lista?.map((item) => (
                <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9', fontSize: '14px', transition: 'background 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}>
                  <td style={{ padding: '15px 20px', fontWeight: '800', color: '#0ea5e9' }}>{item?.empleado_id}</td>
                  <td style={{ padding: '15px 20px', fontWeight: '700', color: '#64748b' }}>{String(item?.fecha_falta || '').substring(0,10)}</td>
                  <td style={{ padding: '15px 20px', color: '#334155', fontWeight: '500' }}>{item?.motivo}</td>
                  <td style={{ padding: '15px 20px', textAlign: 'center' }}>
                    {/* BOTÓN PARA VER FOTO SI EXISTE */}
                    {item?.foto_url ? (
                      <a href={item.foto_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '6px 12px', backgroundColor: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', borderRadius: '8px', fontSize: '12px', fontWeight: '800', textDecoration: 'none', cursor: 'pointer' }}>
                        <Camera size={14} /> Ver Foto
                      </a>
                    ) : (
                      <span style={{ fontSize: '12px', color: '#cbd5e1', fontWeight: '600' }}>Sin soporte</span>
                    )}
                  </td>
                  <td style={{ padding: '15px 20px', textAlign: 'center' }}>
                    <span style={{ 
                      color: item?.estado === 'Aprobado' ? '#16a34a' : (item?.estado === 'Rechazado' ? '#dc2626' : '#ea580c'),
                      backgroundColor: item?.estado === 'Aprobado' ? '#dcfce7' : (item?.estado === 'Rechazado' ? '#fee2e2' : '#ffedd5'),
                      padding: '6px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px'
                    }}>
                      {item?.estado || 'Pendiente'}
                    </span>
                  </td>
                  <td style={{ padding: '15px 20px', textAlign: 'center', display: 'flex', gap: '10px', justifyContent: 'center' }}>
                    {item?.estado === 'Pendiente' ? (
                      <>
                        <button onClick={() => cambiarEstado(item.id, 'Aprobado')} style={{ backgroundColor: '#16a34a', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', boxShadow: '0 2px 4px rgba(22,163,74,0.3)', transition: 'transform 0.1s' }} onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.9)'} onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'} title="Aprobar"><CheckCircle size={18} /></button>
                        <button onClick={() => cambiarEstado(item.id, 'Rechazado')} style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', boxShadow: '0 2px 4px rgba(239,68,68,0.3)', transition: 'transform 0.1s' }} onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.9)'} onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'} title="Rechazar"><XCircle size={18} /></button>
                      </>
                    ) : (
                      <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '700' }}>Procesado ✔</span>
                    )}
                  </td>
                </tr>
              ))}
              {(!lista || lista.length === 0) && (
                <tr><td colSpan="6" style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontWeight: '600' }}>No hay justificaciones pendientes de revisión.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}