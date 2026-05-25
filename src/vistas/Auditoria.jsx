import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../supabase'
import { ScrollText, Filter, RefreshCw, Download } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { useIsMobile } from '../hooks/useIsMobile'
import { dibujarHeaderPDF, dibujarFooterPDF } from '../lib/pdfHeader'
import { useTema } from '../theme/ThemeProvider'

/**
 * Visor del log de auditoria. Filtros por tabla, accion, fecha y usuario.
 * Export a PDF para cumplimiento legal.
 */
export default function Auditoria() {
  const isMobile = useIsMobile()
  const { t } = useTema()
  const [registros, setRegistros] = useState([])
  const [cargando, setCargando] = useState(false)
  const [filtros, setFiltros] = useState({ tabla: '', accion: '', usuario: '', desde: '', hasta: '' })

  const cargar = useCallback(async () => {
    setCargando(true)
    let q = supabase.from('auditoria').select('*').order('ocurrido_en', { ascending: false }).limit(1000)
    if (filtros.tabla)   q = q.eq('tabla', filtros.tabla)
    if (filtros.accion)  q = q.eq('accion', filtros.accion)
    if (filtros.usuario) q = q.ilike('usuario_email', `%${filtros.usuario}%`)
    if (filtros.desde)   q = q.gte('ocurrido_en', filtros.desde)
    if (filtros.hasta)   q = q.lte('ocurrido_en', filtros.hasta + 'T23:59:59')
    const { data } = await q
    setRegistros(data || [])
    setCargando(false)
  }, [filtros])

  useEffect(() => { cargar() }, [cargar])

  const tablas = useMemo(() => Array.from(new Set(registros.map(r => r.tabla))).sort(), [registros])
  const acciones = useMemo(() => Array.from(new Set(registros.map(r => r.accion))).sort(), [registros])

  const exportarPDF = () => {
    const doc = new jsPDF()
    const yInicio = dibujarHeaderPDF(doc, {
      titulo: 'Log de Auditoria del Sistema',
      subtitulo: `${registros.length} registros - Trazabilidad de acciones administrativas`
    })
    autoTable(doc, {
      startY: yInicio + 4,
      head: [['Fecha', 'Tabla', 'Accion', 'Registro', 'Usuario', 'Valor nuevo']],
      body: registros.map(r => [
        new Date(r.ocurrido_en).toLocaleString('es-VE'),
        r.tabla,
        r.accion,
        (r.registro_id || '').substring(0, 12),
        r.usuario_email || '--',
        (r.valor_nuevo || '').substring(0, 50)
      ]),
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [10, 35, 81] },
      didDrawPage: () => dibujarFooterPDF(doc)
    })
    doc.save(`Auditoria_${new Date().toISOString().substring(0,10)}.pdf`)
  }

  const colorAccion = (accion) => {
    if (['APROBAR', 'ACTIVAR', 'CREADO'].includes(accion)) return { bg: t.exitoBg, fg: t.exito }
    if (['RECHAZAR', 'ELIMINAR', 'DESACTIVAR'].includes(accion)) return { bg: t.errorBg, fg: t.error }
    if (accion === 'RESET_CLAVE') return { bg: t.avisoBg, fg: t.aviso }
    return { bg: t.infoBg, fg: t.info }
  }

  const estiloFiltro = { padding: '10px 12px', borderRadius: 8, border: `1px solid ${t.border}`, fontSize: 13, backgroundColor: t.bgInput, color: t.text, fontWeight: 600 }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: isMobile ? 5 : 0 }}>
      <div style={{ marginBottom: 24, background: 'linear-gradient(135deg, #475569 0%, #1e293b 100%)', padding: 25, borderRadius: 16, color: 'white', display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', gap: 15 }}>
        <div>
          <h1 style={{ margin: '0 0 5px 0', fontSize: isMobile ? 22 : 28, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}>
            <ScrollText size={32} /> Auditoria de Acciones
          </h1>
          <p style={{ margin: 0, fontSize: 14, opacity: 0.9 }}>Trazabilidad legal de todos los cambios sensibles del sistema.</p>
        </div>
        <button onClick={exportarPDF} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 16px', backgroundColor: 'white', color: '#1e293b', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 900 }}>
          <Download size={16} /> Exportar PDF
        </button>
      </div>

      {/* FILTROS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 20, padding: 16, backgroundColor: t.bgPanel, borderRadius: 12, border: `1px solid ${t.border}` }}>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: t.textSoft, marginBottom: 4, textTransform: 'uppercase' }}>Tabla</label>
          <select value={filtros.tabla} onChange={e => setFiltros({ ...filtros, tabla: e.target.value })} style={estiloFiltro}>
            <option value="">Todas</option>
            {tablas.map(x => <option key={x} value={x}>{x}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: t.textSoft, marginBottom: 4, textTransform: 'uppercase' }}>Accion</label>
          <select value={filtros.accion} onChange={e => setFiltros({ ...filtros, accion: e.target.value })} style={estiloFiltro}>
            <option value="">Todas</option>
            {acciones.map(x => <option key={x} value={x}>{x}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: t.textSoft, marginBottom: 4, textTransform: 'uppercase' }}>Usuario</label>
          <input type="text" value={filtros.usuario} onChange={e => setFiltros({ ...filtros, usuario: e.target.value })} placeholder="email@..." style={estiloFiltro} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: t.textSoft, marginBottom: 4, textTransform: 'uppercase' }}>Desde</label>
          <input type="date" value={filtros.desde} onChange={e => setFiltros({ ...filtros, desde: e.target.value })} style={estiloFiltro} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: t.textSoft, marginBottom: 4, textTransform: 'uppercase' }}>Hasta</label>
          <input type="date" value={filtros.hasta} onChange={e => setFiltros({ ...filtros, hasta: e.target.value })} style={estiloFiltro} />
        </div>
        <button onClick={cargar} disabled={cargando} style={{ alignSelf: 'end', padding: '10px 14px', backgroundColor: t.primario, color: 'white', border: 'none', borderRadius: 8, cursor: cargando ? 'wait' : 'pointer', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <RefreshCw size={14} /> Refrescar
        </button>
      </div>

      {/* TABLA */}
      <div style={{ backgroundColor: t.bgPanel, borderRadius: 14, border: `1px solid ${t.border}`, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto', maxHeight: '60vh' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
            <thead style={{ position: 'sticky', top: 0 }}>
              <tr style={{ backgroundColor: t.bgTableHead, color: t.textSoft, fontSize: 11, textTransform: 'uppercase', fontWeight: 800 }}>
                <th style={{ padding: '12px 14px', borderBottom: `2px solid ${t.border}`, textAlign: 'left' }}>Fecha y hora</th>
                <th style={{ padding: '12px 14px', borderBottom: `2px solid ${t.border}`, textAlign: 'left' }}>Tabla</th>
                <th style={{ padding: '12px 14px', borderBottom: `2px solid ${t.border}`, textAlign: 'center' }}>Accion</th>
                <th style={{ padding: '12px 14px', borderBottom: `2px solid ${t.border}`, textAlign: 'left' }}>Registro</th>
                <th style={{ padding: '12px 14px', borderBottom: `2px solid ${t.border}`, textAlign: 'left' }}>Usuario</th>
                <th style={{ padding: '12px 14px', borderBottom: `2px solid ${t.border}`, textAlign: 'left' }}>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {registros.length === 0 && (
                <tr><td colSpan="6" style={{ padding: 28, textAlign: 'center', color: t.textMuted, fontWeight: 600 }}>
                  {cargando ? 'Cargando registros...' : 'Sin coincidencias con los filtros aplicados.'}
                </td></tr>
              )}
              {registros.map(r => {
                const c = colorAccion(r.accion)
                return (
                  <tr key={r.id} style={{ borderBottom: `1px solid ${t.borderSoft}`, fontSize: 13 }}>
                    <td style={{ padding: '10px 14px', color: t.textSoft, fontWeight: 600, whiteSpace: 'nowrap' }}>{new Date(r.ocurrido_en).toLocaleString('es-VE')}</td>
                    <td style={{ padding: '10px 14px', color: t.text, fontWeight: 700 }}>{r.tabla}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                      <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', backgroundColor: c.bg, color: c.fg }}>{r.accion}</span>
                    </td>
                    <td style={{ padding: '10px 14px', color: t.textSoft, fontWeight: 600, fontFamily: 'monospace', fontSize: 12 }}>{(r.registro_id || '').substring(0, 12)}</td>
                    <td style={{ padding: '10px 14px', color: t.text, fontWeight: 600 }}>{r.usuario_email || '--'}</td>
                    <td style={{ padding: '10px 14px', color: t.textSoft, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.valor_nuevo || '--'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '10px 16px', borderTop: `1px solid ${t.borderSoft}`, color: t.textSoft, fontSize: 12, fontWeight: 600 }}>
          Mostrando {registros.length} registros (limite 1000)
        </div>
      </div>
    </div>
  )
}
