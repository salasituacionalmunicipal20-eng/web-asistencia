import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../supabase'
import { Plane, CheckCircle, XCircle, Trash2 } from 'lucide-react'
import { useIsMobile } from '../hooks/useIsMobile'
import { useTema } from '../theme/ThemeProvider'

/**
 * Workflow de vacaciones / permisos largos. El empleado solicita desde la app
 * (o el admin desde aqui) y este panel los aprueba o rechaza con comentario.
 */
export default function Vacaciones() {
  const isMobile = useIsMobile()
  const { t } = useTema()
  const [lista, setLista] = useState([])
  const [cargando, setCargando] = useState(false)
  const [filtroEstado, setFiltroEstado] = useState('Pendiente')

  const cargar = useCallback(async () => {
    setCargando(true)
    const { data, error } = await supabase.from('vacaciones').select('*').order('fecha_solicitud', { ascending: false })
    if (!error) setLista(data || [])
    setCargando(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  // Realtime: si llega una nueva solicitud, refrescamos
  useEffect(() => {
    const canal = supabase.channel('vacaciones-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vacaciones' }, () => cargar())
      .subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [cargar])

  const filtradas = useMemo(() => filtroEstado === 'Todos' ? lista : lista.filter(v => v.estado === filtroEstado), [lista, filtroEstado])

  const decidir = async (id, aprobar) => {
    const comentario = prompt(`${aprobar ? 'Aprobar' : 'Rechazar'} solicitud. Comentario opcional:`, '')
    if (comentario === null) return
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.rpc('aprobar_vacaciones', {
      p_id: id,
      p_aprobar: aprobar,
      p_comentario: comentario || null,
      p_admin_email: user?.email || null
    })
    if (error) { alert(`Error: ${error.message}`); return }
    cargar()
  }

  const borrar = async (id) => {
    if (!confirm('¿Eliminar esta solicitud? Esta accion queda registrada en auditoria.')) return
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.rpc('eliminar_con_auditoria', {
      p_tabla: 'vacaciones',
      p_id: id,
      p_admin_email: user?.email || null
    })
    if (error) { alert(`Error: ${error.message}`); return }
    cargar()
  }

  const colorEstado = (estado) => {
    switch (estado) {
      case 'Aprobado':   return { bg: t.exitoBg, fg: t.exito }
      case 'Rechazado':  return { bg: t.errorBg, fg: t.error }
      default:           return { bg: t.avisoBg, fg: t.aviso }
    }
  }

  const diasEntre = (a, b) => {
    if (!a || !b) return 0
    const d1 = new Date(a), d2 = new Date(b)
    return Math.round((d2 - d1) / (1000*60*60*24)) + 1
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: isMobile ? 5 : 0 }}>
      <div style={{ marginBottom: 24, background: 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)', padding: 25, borderRadius: 16, color: 'white', boxShadow: '0 10px 20px -5px rgba(14, 165, 233, 0.4)' }}>
        <h1 style={{ margin: '0 0 5px 0', fontSize: isMobile ? 22 : 28, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Plane size={32} /> Solicitudes de Vacaciones
        </h1>
        <p style={{ margin: 0, fontSize: 14, opacity: 0.9 }}>Workflow de permisos largos. Aprueba o rechaza con comentario.</p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {['Pendiente', 'Aprobado', 'Rechazado', 'Todos'].map(estado => (
          <button key={estado} onClick={() => setFiltroEstado(estado)}
            style={{ padding: '8px 14px', borderRadius: 8, backgroundColor: filtroEstado === estado ? t.primario : t.bgPanel, color: filtroEstado === estado ? 'white' : t.text, border: `1px solid ${filtroEstado === estado ? t.primario : t.border}`, cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
            {estado} {estado !== 'Todos' && `(${lista.filter(v => v.estado === estado).length})`}
          </button>
        ))}
      </div>

      <div style={{ backgroundColor: t.bgPanel, borderRadius: 14, boxShadow: '0 4px 15px rgba(0,0,0,0.05)', border: `1px solid ${t.border}`, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
            <thead>
              <tr style={{ backgroundColor: t.bgTableHead, color: t.textSoft, fontSize: 12, textTransform: 'uppercase', fontWeight: 800 }}>
                <th style={{ padding: '14px 16px', borderBottom: `2px solid ${t.border}`, textAlign: 'left' }}>Cedula</th>
                <th style={{ padding: '14px 16px', borderBottom: `2px solid ${t.border}`, textAlign: 'left' }}>Inicio</th>
                <th style={{ padding: '14px 16px', borderBottom: `2px solid ${t.border}`, textAlign: 'left' }}>Fin</th>
                <th style={{ padding: '14px 16px', borderBottom: `2px solid ${t.border}`, textAlign: 'center' }}>Dias</th>
                <th style={{ padding: '14px 16px', borderBottom: `2px solid ${t.border}`, textAlign: 'left' }}>Motivo</th>
                <th style={{ padding: '14px 16px', borderBottom: `2px solid ${t.border}`, textAlign: 'center' }}>Estado</th>
                <th style={{ padding: '14px 16px', borderBottom: `2px solid ${t.border}`, textAlign: 'center' }}>Accion</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.length === 0 && (
                <tr><td colSpan="7" style={{ padding: 32, textAlign: 'center', color: t.textMuted, fontWeight: 600 }}>
                  {cargando ? 'Cargando...' : 'No hay solicitudes en este filtro.'}
                </td></tr>
              )}
              {filtradas.map(v => {
                const c = colorEstado(v.estado)
                return (
                  <tr key={v.id} style={{ borderBottom: `1px solid ${t.borderSoft}` }}>
                    <td style={{ padding: '14px 16px', fontWeight: 800, color: t.primario }}>{v.empleado_id}</td>
                    <td style={{ padding: '14px 16px', color: t.text, fontWeight: 600 }}>{v.fecha_inicio}</td>
                    <td style={{ padding: '14px 16px', color: t.text, fontWeight: 600 }}>{v.fecha_fin}</td>
                    <td style={{ padding: '14px 16px', textAlign: 'center', color: t.text, fontWeight: 700 }}>{diasEntre(v.fecha_inicio, v.fecha_fin)}</td>
                    <td style={{ padding: '14px 16px', color: t.text, maxWidth: 280 }}>
                      {v.motivo}
                      {v.comentario_admin && <div style={{ marginTop: 4, fontSize: 11, color: t.textSoft, fontStyle: 'italic' }}>Admin: {v.comentario_admin}</div>}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', backgroundColor: c.bg, color: c.fg }}>{v.estado}</span>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      {v.estado === 'Pendiente' ? (
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          <button onClick={() => decidir(v.id, true)}  title="Aprobar" style={{ backgroundColor: t.exito, color: 'white', border: 'none', padding: 8, borderRadius: 8, cursor: 'pointer' }}><CheckCircle size={14} /></button>
                          <button onClick={() => decidir(v.id, false)} title="Rechazar" style={{ backgroundColor: t.error, color: 'white', border: 'none', padding: 8, borderRadius: 8, cursor: 'pointer' }}><XCircle size={14} /></button>
                        </div>
                      ) : (
                        <button onClick={() => borrar(v.id)} title="Eliminar" style={{ backgroundColor: t.errorBg, color: t.error, border: `1px solid ${t.error}`, padding: 6, borderRadius: 6, cursor: 'pointer' }}><Trash2 size={12} /></button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
