import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase'
import { CheckCircle, XCircle, ClipboardList, Camera, Trash2 } from 'lucide-react'
import { useIsMobile } from '../hooks/useIsMobile'

export default function Justificaciones() {
  const isMobile = useIsMobile()
  const [lista, setLista] = useState([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  const obtenerDatos = useCallback(async () => {
    setCargando(true)
    setError('')
    const { data, error: errBd } = await supabase.from('justificaciones').select('*').order('fecha_solicitud', { ascending: false })
    if (errBd) {
      setError(`No se pudieron cargar las justificaciones: ${errBd.message}`)
    } else {
      setLista(data || [])
    }
    setCargando(false)
  }, [])

  useEffect(() => {
    obtenerDatos()
  }, [obtenerDatos])

  const cambiarEstado = async (id, nuevoEstado) => {
    // Pedimos un comentario al admin (opcional para aprobar, importante para
    // rechazar). Se guarda como acuse de recibo y aparece en la app del empleado.
    const promptMsg = nuevoEstado === 'Aprobado'
      ? 'Aprobar justificacion. Comentario (opcional):'
      : 'Rechazar justificacion. Indique el motivo del rechazo:'
    const comentario = prompt(promptMsg, '')
    if (comentario === null) return  // canceló

    const { data: { user } } = await supabase.auth.getUser()
    const { error: errRpc } = await supabase.rpc('aprobar_justificacion', {
      p_id: id,
      p_aprobar: nuevoEstado === 'Aprobado',
      p_comentario: comentario || null,
      p_admin_email: user?.email || null
    })
    if (errRpc) {
      alert(`No se pudo actualizar la justificacion: ${errRpc.message}`)
      return
    }
    obtenerDatos()
  }

  const borrarJustificacion = async (id) => {
    if (!confirm('¿Eliminar esta justificacion definitivamente? La accion queda en auditoria.')) return
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.rpc('eliminar_con_auditoria', {
      p_tabla: 'justificaciones',
      p_id: id,
      p_admin_email: user?.email || null
    })
    if (error) { alert(`Error: ${error.message}`); return }
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
                        <button onClick={() => cambiarEstado(item.id, 'Aprobado')} style={{ backgroundColor: '#16a34a', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Aprobar"><CheckCircle size={18} /></button>
                        <button onClick={() => cambiarEstado(item.id, 'Rechazado')} style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Rechazar"><XCircle size={18} /></button>
                      </>
                    ) : (
                      <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '700' }}>Procesado ✔</span>
                        <button onClick={() => borrarJustificacion(item.id)} title="Eliminar" style={{ backgroundColor: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', padding: 6, borderRadius: 6, cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}><Trash2 size={12} /></button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {cargando && lista.length === 0 && (
                <tr><td colSpan="6" style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontWeight: '600' }}>Cargando justificaciones...</td></tr>
              )}
              {!cargando && error && (
                <tr><td colSpan="6" style={{ padding: '40px', textAlign: 'center', color: '#ef4444', fontWeight: 700, backgroundColor: '#fef2f2' }}>⛔ {error}</td></tr>
              )}
              {!cargando && !error && lista.length === 0 && (
                <tr><td colSpan="6" style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontWeight: '600' }}>No hay justificaciones pendientes de revisión.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}