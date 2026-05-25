import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '../supabase'
import { BookOpen, Download, Search, UserCheck, Calendar, Clock, AlertCircle, BarChart3, UserX, Award, FileSpreadsheet } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { useIsMobile } from '../hooks/useIsMobile'
import { dibujarHeaderPDF, dibujarFooterPDF } from '../lib/pdfHeader'
import { useTema } from '../theme/ThemeProvider'

/**
 * Reportes avanzados. Cuatro pestanas:
 *   1) Expediente: historial por empleado (con buscador)
 *   2) Horas trabajadas: vw_horas_trabajadas con totales por mes
 *   3) Ausentes hoy: vw_ausentes_hoy
 *   4) Ranking + Heatmap: vw_ranking_puntualidad + vw_tardanzas_por_dia_semana
 */
export default function Reportes() {
  const isMobile = useIsMobile()
  const { t } = useTema()
  const [tab, setTab] = useState('expediente')

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: isMobile ? 5 : 0 }}>
      <div style={{ marginBottom: 24, background: 'linear-gradient(135deg, #4f46e5 0%, #312e81 100%)', padding: 25, borderRadius: 16, color: 'white' }}>
        <h1 style={{ margin: '0 0 5px 0', fontSize: isMobile ? 22 : 28, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}>
          <BookOpen size={32} /> Reportes y Analitica
        </h1>
        <p style={{ margin: 0, fontSize: 14, opacity: 0.9 }}>Horas trabajadas, ausencias, ranking de puntualidad y patrones por dia.</p>
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { id: 'expediente', icono: UserCheck, label: 'Expediente' },
          { id: 'horas',      icono: Clock,     label: 'Horas trabajadas' },
          { id: 'ausentes',   icono: UserX,     label: 'Ausentes hoy' },
          { id: 'puntualidad', icono: Award,    label: 'Puntualidad' }
        ].map(({ id, icono: Ic, label }) => (
          <button key={id} onClick={() => setTab(id)}
            style={{ padding: '10px 16px', borderRadius: 10, backgroundColor: tab === id ? t.primario : t.bgPanel, color: tab === id ? 'white' : t.text, border: `1px solid ${tab === id ? t.primario : t.border}`, cursor: 'pointer', fontWeight: 800, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Ic size={16} /> {label}
          </button>
        ))}
      </div>

      {tab === 'expediente'  && <PanelExpediente />}
      {tab === 'horas'       && <PanelHorasTrabajadas />}
      {tab === 'ausentes'    && <PanelAusentes />}
      {tab === 'puntualidad' && <PanelPuntualidad />}
    </div>
  )
}

// ============================================================================
// 1. EXPEDIENTE
// ============================================================================
function PanelExpediente() {
  const isMobile = useIsMobile()
  const { t } = useTema()
  const [empleados, setEmpleados] = useState([])
  const [asistencias, setAsistencias] = useState([])
  const [justificaciones, setJustificaciones] = useState([])
  const [vacaciones, setVacaciones] = useState([])
  const [cargando, setCargando] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [filtroDepto, setFiltroDepto] = useState('')
  const [empleadoSel, setEmpleadoSel] = useState(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    const [rE, rA, rJ, rV] = await Promise.all([
      supabase.from('empleados').select('*').order('nombres'),
      supabase.from('asistencia_registros').select('*').order('fecha', { ascending: false }),
      supabase.from('justificaciones').select('*').order('fecha_falta', { ascending: false }),
      supabase.from('vacaciones').select('*').order('fecha_inicio', { ascending: false })
    ])
    if (!rE.error) setEmpleados(rE.data || [])
    if (!rA.error) setAsistencias(rA.data || [])
    if (!rJ.error) setJustificaciones(rJ.data || [])
    if (!rV.error) setVacaciones(rV.data || [])
    setCargando(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const departamentos = useMemo(() => Array.from(new Set(empleados.map(e => e.departamento))).sort(), [empleados])

  const indice = useMemo(() => {
    const i = new Map()
    asistencias.forEach(a => {
      if (!i.has(a.empleado_id)) i.set(a.empleado_id, { asis: [], just: [], vac: [] })
      i.get(a.empleado_id).asis.push(a)
    })
    justificaciones.forEach(j => {
      if (!i.has(j.empleado_id)) i.set(j.empleado_id, { asis: [], just: [], vac: [] })
      i.get(j.empleado_id).just.push(j)
    })
    vacaciones.forEach(v => {
      if (!i.has(v.empleado_id)) i.set(v.empleado_id, { asis: [], just: [], vac: [] })
      i.get(v.empleado_id).vac.push(v)
    })
    return i
  }, [asistencias, justificaciones, vacaciones])

  const fmtHora = (h) => h ? String(h).substring(0, 5) : 'Sin marcar'

  const historial = useMemo(() => {
    if (!empleadoSel) return []
    const d = indice.get(empleadoSel.cedula) || { asis: [], just: [], vac: [] }
    const items = []
    d.asis.forEach(a => items.push({ tipo: 'Asistencia', fecha: a.fecha, detalle: `Entrada: ${fmtHora(a.hora_entrada)} | Salida: ${fmtHora(a.hora_salida)}` }))
    d.just.forEach(j => items.push({ tipo: 'Justificacion', fecha: String(j.fecha_falta).substring(0, 10), detalle: `${j.motivo} | Estado: ${j.estado}` }))
    d.vac.forEach(v => items.push({ tipo: 'Vacaciones', fecha: v.fecha_inicio, detalle: `Hasta ${v.fecha_fin} | ${v.motivo} | Estado: ${v.estado}` }))
    return items.sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
  }, [empleadoSel, indice])

  const filtrados = useMemo(() => empleados.filter(e => {
    if (filtroDepto && e.departamento !== filtroDepto) return false
    if (busqueda && !`${e.nombres} ${e.apellidos} ${e.cedula}`.toLowerCase().includes(busqueda.toLowerCase())) return false
    return true
  }), [empleados, busqueda, filtroDepto])

  const exportarPDF = () => {
    const doc = new jsPDF()
    const yInicio = dibujarHeaderPDF(doc, {
      titulo: 'Expediente Completo de Personal',
      subtitulo: `${empleados.length} empleados registrados`
    })
    const body = []
    empleados.forEach(emp => {
      const hist = (indice.get(emp.cedula) || { asis: [], just: [], vac: [] })
      body.push([{ content: `${emp.nombres} ${emp.apellidos} - ${emp.cedula} (${emp.cargo})`, colSpan: 3, styles: { fillColor: [224, 231, 255], fontStyle: 'bold' } }])
      const items = []
      hist.asis.forEach(a => items.push([a.fecha, 'Asistencia', `${fmtHora(a.hora_entrada)} - ${fmtHora(a.hora_salida)}`]))
      hist.just.forEach(j => items.push([String(j.fecha_falta).substring(0,10), 'Justificacion', `${j.motivo} (${j.estado})`]))
      hist.vac.forEach(v => items.push([v.fecha_inicio, 'Vacaciones', `Hasta ${v.fecha_fin} (${v.estado})`]))
      if (items.length === 0) body.push(['-', 'Sin actividad', '-'])
      else items.sort((a, b) => new Date(b[0]) - new Date(a[0])).forEach(r => body.push(r))
    })
    autoTable(doc, {
      startY: yInicio + 4,
      head: [['Fecha', 'Tipo', 'Detalle']],
      body,
      theme: 'grid',
      styles: { fontSize: 9 },
      headStyles: { fillColor: [10, 35, 81] },
      didDrawPage: () => dibujarFooterPDF(doc)
    })
    doc.save('Expediente_Charallave.pdf')
  }

  const exportarExcel = () => {
    const filas = []
    empleados.forEach(emp => {
      const hist = (indice.get(emp.cedula) || { asis: [], just: [], vac: [] })
      hist.asis.forEach(a => filas.push({ Cedula: emp.cedula, Nombre: `${emp.nombres} ${emp.apellidos}`, Cargo: emp.cargo, Tipo: 'Asistencia', Fecha: a.fecha, Detalle: `${fmtHora(a.hora_entrada)} - ${fmtHora(a.hora_salida)}` }))
      hist.just.forEach(j => filas.push({ Cedula: emp.cedula, Nombre: `${emp.nombres} ${emp.apellidos}`, Cargo: emp.cargo, Tipo: 'Justificacion', Fecha: String(j.fecha_falta).substring(0,10), Detalle: `${j.motivo} (${j.estado})` }))
      hist.vac.forEach(v => filas.push({ Cedula: emp.cedula, Nombre: `${emp.nombres} ${emp.apellidos}`, Cargo: emp.cargo, Tipo: 'Vacaciones', Fecha: v.fecha_inicio, Detalle: `Hasta ${v.fecha_fin} (${v.estado})` }))
    })
    const ws = XLSX.utils.json_to_sheet(filas)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Expediente')
    XLSX.writeFile(wb, `Expediente_Charallave_${new Date().toISOString().substring(0,10)}.xlsx`)
  }

  const estiloInput = { width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${t.border}`, fontSize: 14, backgroundColor: t.bgInput, color: t.text, fontWeight: 600, outline: 'none', boxSizing: 'border-box' }

  return (
    <>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <button onClick={exportarPDF}   style={{ padding: '10px 14px', backgroundColor: t.error, color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}><Download size={14} /> PDF</button>
        <button onClick={exportarExcel} style={{ padding: '10px 14px', backgroundColor: t.exito, color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}><FileSpreadsheet size={14} /> Excel</button>
      </div>

      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 20 }}>
        <div style={{ flex: 1, backgroundColor: t.bgPanel, padding: 20, borderRadius: 14, border: `1px solid ${t.border}`, maxHeight: '70vh', overflowY: 'auto' }}>
          <div style={{ marginBottom: 12, position: 'relative' }}>
            <Search size={16} color={t.textSoft} style={{ position: 'absolute', left: 12, top: 14 }} />
            <input type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar..." style={{ ...estiloInput, paddingLeft: 38 }} />
          </div>
          <select value={filtroDepto} onChange={e => setFiltroDepto(e.target.value)} style={{ ...estiloInput, marginBottom: 12 }}>
            <option value="">Todos los departamentos</option>
            {departamentos.map(d => <option key={d}>{d}</option>)}
          </select>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {filtrados.map(emp => {
              const sel = empleadoSel?.cedula === emp.cedula
              return (
                <div key={emp.cedula} onClick={() => setEmpleadoSel(emp)}
                  style={{ padding: 12, borderRadius: 8, cursor: 'pointer', border: `1px solid ${sel ? t.primario : t.borderSoft}`, backgroundColor: sel ? t.primarioBg : t.bgPanel, display: 'flex', alignItems: 'center', gap: 12 }}>
                  {emp.foto_url ? (
                    <img src={emp.foto_url} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: t.primarioBg, color: t.primario, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 13 }}>
                      {(emp.nombres || '?').charAt(0)}{(emp.apellidos || '').charAt(0)}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, color: t.text, fontSize: 13 }}>{emp.nombres} {emp.apellidos}</div>
                    <div style={{ fontSize: 11, color: t.textSoft, fontWeight: 600 }}>{emp.cedula} · {emp.cargo}</div>
                  </div>
                </div>
              )
            })}
            {filtrados.length === 0 && <div style={{ textAlign: 'center', padding: 20, color: t.textMuted, fontWeight: 600 }}>{cargando ? 'Cargando...' : 'Sin resultados'}</div>}
          </div>
        </div>

        <div style={{ flex: 2, backgroundColor: t.bgPanel, padding: 20, borderRadius: 14, border: `1px solid ${t.border}` }}>
          {empleadoSel ? (
            <>
              <h3 style={{ margin: '0 0 16px 0', color: t.text, borderBottom: `2px solid ${t.borderSoft}`, paddingBottom: 12, fontWeight: 900 }}>
                {empleadoSel.nombres} {empleadoSel.apellidos}
              </h3>
              <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                {historial.map((h, i) => (
                  <div key={i} style={{ marginBottom: 10, padding: 12, borderRadius: 10, borderLeft: `4px solid ${h.tipo === 'Asistencia' ? t.exito : h.tipo === 'Justificacion' ? t.aviso : t.info}`, backgroundColor: t.bgInput }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: t.textSoft, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Calendar size={12} /> {h.fecha}
                      </span>
                      <span style={{ fontSize: 10, fontWeight: 900, padding: '2px 8px', borderRadius: 12, backgroundColor: h.tipo === 'Asistencia' ? t.exitoBg : h.tipo === 'Justificacion' ? t.avisoBg : t.infoBg, color: h.tipo === 'Asistencia' ? t.exito : h.tipo === 'Justificacion' ? t.aviso : t.info, textTransform: 'uppercase' }}>{h.tipo}</span>
                    </div>
                    <div style={{ color: t.text, fontSize: 13, fontWeight: 600 }}>{h.detalle}</div>
                  </div>
                ))}
                {historial.length === 0 && <div style={{ textAlign: 'center', padding: 30, color: t.textMuted, fontWeight: 600 }}>Sin actividad registrada.</div>}
              </div>
            </>
          ) : (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: t.textMuted, padding: 40 }}>
              <UserCheck size={64} style={{ opacity: 0.3, marginBottom: 10 }} />
              <h3 style={{ margin: 0, fontWeight: 800 }}>Selecciona un empleado</h3>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ============================================================================
// 2. HORAS TRABAJADAS
// ============================================================================
function PanelHorasTrabajadas() {
  const { t } = useTema()
  const [horas, setHoras] = useState([])
  const [empleados, setEmpleados] = useState([])
  const [cargando, setCargando] = useState(false)
  const [filtroDepto, setFiltroDepto] = useState('')

  useEffect(() => {
    (async () => {
      setCargando(true)
      const [rH, rE] = await Promise.all([
        supabase.from('vw_horas_trabajadas').select('*').order('mes', { ascending: false }),
        supabase.from('empleados').select('cedula, nombres, apellidos, departamento, cargo')
      ])
      setHoras(rH.data || [])
      setEmpleados(rE.data || [])
      setCargando(false)
    })()
  }, [])

  const empleadoMap = useMemo(() => new Map(empleados.map(e => [e.cedula, e])), [empleados])
  const departamentos = useMemo(() => Array.from(new Set(empleados.map(e => e.departamento))).sort(), [empleados])

  const filas = useMemo(() => horas.map(h => ({
    ...h,
    nombre: empleadoMap.get(h.empleado_id)?.nombres + ' ' + (empleadoMap.get(h.empleado_id)?.apellidos || ''),
    departamento: empleadoMap.get(h.empleado_id)?.departamento || '--',
    cargo: empleadoMap.get(h.empleado_id)?.cargo || '--'
  })).filter(f => !filtroDepto || f.departamento === filtroDepto), [horas, empleadoMap, filtroDepto])

  const totalHoras = filas.reduce((acc, f) => acc + (Number(f.horas_trabajadas) || 0), 0)
  const totalExtras = filas.reduce((acc, f) => acc + (Number(f.horas_extras) || 0), 0)

  const exportarExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filas.map(f => ({
      Mes: f.mes, Cedula: f.empleado_id, Nombre: f.nombre, Departamento: f.departamento, Cargo: f.cargo,
      'Horas trabajadas': f.horas_trabajadas, 'Horas esperadas': f.horas_esperadas, 'Horas extras': f.horas_extras, 'Dias completados': f.dias_completados
    })))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Horas')
    XLSX.writeFile(wb, `Horas_Trabajadas_${new Date().toISOString().substring(0,10)}.xlsx`)
  }

  return (
    <div style={{ backgroundColor: t.bgPanel, padding: 20, borderRadius: 14, border: `1px solid ${t.border}` }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', marginBottom: 16 }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: t.textSoft, marginBottom: 4, textTransform: 'uppercase' }}>Departamento</label>
          <select value={filtroDepto} onChange={e => setFiltroDepto(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 8, border: `1px solid ${t.border}`, backgroundColor: t.bgInput, color: t.text, fontWeight: 600, fontSize: 13 }}>
            <option value="">Todos</option>
            {departamentos.map(d => <option key={d}>{d}</option>)}
          </select>
        </div>
        <button onClick={exportarExcel} style={{ padding: '10px 14px', backgroundColor: t.exito, color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}><FileSpreadsheet size={14} /> Exportar Excel</button>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <KPI t={t} titulo="Total horas trabajadas" valor={totalHoras.toFixed(1)} color={t.primario} />
        <KPI t={t} titulo="Total horas extras"     valor={totalExtras.toFixed(1)} color={t.aviso} />
        <KPI t={t} titulo="Empleados activos"      valor={filas.length}            color={t.exito} />
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
          <thead>
            <tr style={{ backgroundColor: t.bgTableHead, color: t.textSoft, fontSize: 11, textTransform: 'uppercase', fontWeight: 800 }}>
              <th style={{ padding: '12px 14px', borderBottom: `2px solid ${t.border}`, textAlign: 'left' }}>Mes</th>
              <th style={{ padding: '12px 14px', borderBottom: `2px solid ${t.border}`, textAlign: 'left' }}>Empleado</th>
              <th style={{ padding: '12px 14px', borderBottom: `2px solid ${t.border}`, textAlign: 'left' }}>Departamento</th>
              <th style={{ padding: '12px 14px', borderBottom: `2px solid ${t.border}`, textAlign: 'center' }}>Dias</th>
              <th style={{ padding: '12px 14px', borderBottom: `2px solid ${t.border}`, textAlign: 'center' }}>Esperadas</th>
              <th style={{ padding: '12px 14px', borderBottom: `2px solid ${t.border}`, textAlign: 'center' }}>Trabajadas</th>
              <th style={{ padding: '12px 14px', borderBottom: `2px solid ${t.border}`, textAlign: 'center' }}>Extras</th>
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 && <tr><td colSpan="7" style={{ padding: 30, textAlign: 'center', color: t.textMuted, fontWeight: 600 }}>{cargando ? 'Cargando...' : 'Sin datos'}</td></tr>}
            {filas.map((f, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${t.borderSoft}`, fontSize: 13 }}>
                <td style={{ padding: '10px 14px', color: t.textSoft, fontWeight: 700 }}>{String(f.mes).substring(0, 7)}</td>
                <td style={{ padding: '10px 14px', color: t.text, fontWeight: 700 }}>{f.nombre} <span style={{ color: t.textMuted, fontWeight: 500 }}>({f.empleado_id})</span></td>
                <td style={{ padding: '10px 14px', color: t.textSoft }}>{f.departamento}</td>
                <td style={{ padding: '10px 14px', textAlign: 'center', color: t.text, fontWeight: 700 }}>{f.dias_completados}</td>
                <td style={{ padding: '10px 14px', textAlign: 'center', color: t.textSoft, fontWeight: 600 }}>{f.horas_esperadas}h</td>
                <td style={{ padding: '10px 14px', textAlign: 'center', color: t.primario, fontWeight: 800 }}>{f.horas_trabajadas}h</td>
                <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                  {Number(f.horas_extras) > 0
                    ? <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 800, backgroundColor: t.avisoBg, color: t.aviso }}>+{f.horas_extras}h</span>
                    : <span style={{ color: t.textMuted, fontWeight: 600 }}>-</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ============================================================================
// 3. AUSENTES HOY
// ============================================================================
function PanelAusentes() {
  const { t } = useTema()
  const [lista, setLista] = useState([])
  const [cargando, setCargando] = useState(false)

  useEffect(() => {
    (async () => {
      setCargando(true)
      const { data } = await supabase.from('vw_ausentes_hoy').select('*')
      setLista(data || [])
      setCargando(false)
    })()
  }, [])

  const colorEstado = (s) => {
    if (s === 'JUSTIFICADO')    return { bg: t.exitoBg, fg: t.exito }
    if (s === 'EN_VACACIONES')  return { bg: t.infoBg,  fg: t.info }
    return { bg: t.errorBg, fg: t.error }
  }

  return (
    <div style={{ backgroundColor: t.bgPanel, padding: 20, borderRadius: 14, border: `1px solid ${t.border}` }}>
      <h3 style={{ margin: '0 0 16px 0', color: t.text, fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
        <UserX size={20} color={t.error} /> Empleados sin marca hoy ({lista.length})
      </h3>
      {lista.length === 0 ? (
        <div style={{ padding: 30, textAlign: 'center', color: t.textMuted, fontWeight: 600 }}>{cargando ? 'Cargando...' : 'Todos los empleados ya marcaron hoy 🎉'}</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
          {lista.map(a => {
            const c = colorEstado(a.estado_falta)
            return (
              <div key={a.cedula} style={{ padding: 14, borderRadius: 10, backgroundColor: c.bg, borderLeft: `4px solid ${c.fg}` }}>
                <div style={{ fontWeight: 800, color: t.text, fontSize: 14 }}>{a.nombres} {a.apellidos}</div>
                <div style={{ fontSize: 12, color: t.textSoft, fontWeight: 600, marginTop: 2 }}>{a.cedula} · {a.departamento}</div>
                <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: t.textSoft, fontWeight: 600 }}>Programada: {String(a.hora_programada || '').substring(0, 5)}</span>
                  <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 800, backgroundColor: c.fg + '33', color: c.fg, textTransform: 'uppercase' }}>{a.estado_falta}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// 4. PUNTUALIDAD (Ranking + Heatmap por dia)
// ============================================================================
function PanelPuntualidad() {
  const { t } = useTema()
  const [ranking, setRanking] = useState([])
  const [heatmap, setHeatmap] = useState([])

  useEffect(() => {
    (async () => {
      const [rR, rH] = await Promise.all([
        supabase.from('vw_ranking_puntualidad').select('*'),
        supabase.from('vw_tardanzas_por_dia_semana').select('*')
      ])
      setRanking(rR.data || [])
      setHeatmap(rH.data || [])
    })()
  }, [])

  const maxPct = Math.max(1, ...heatmap.map(h => Number(h.pct_tardanzas)))

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20 }}>
      <div style={{ backgroundColor: t.bgPanel, padding: 20, borderRadius: 14, border: `1px solid ${t.border}` }}>
        <h3 style={{ margin: '0 0 16px 0', color: t.text, fontSize: 15, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
          <BarChart3 size={18} color={t.aviso} /> Heatmap de tardanzas por dia (ultimos 60 dias)
        </h3>
        <div style={{ display: 'flex', alignItems: 'flex-end', height: 140, gap: 12 }}>
          {heatmap.map(h => (
            <div key={h.dia_semana} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: t.text }}>{h.pct_tardanzas}%</div>
              <div title={`${h.tardanzas} tarde de ${h.total_marcas} marcas`}
                style={{ width: '100%', height: `${(Number(h.pct_tardanzas) / maxPct) * 100}%`, minHeight: 4, background: `linear-gradient(180deg, #fb923c 0%, #c2410c 100%)`, borderRadius: '6px 6px 0 0' }} />
              <div style={{ fontSize: 11, color: t.textSoft, fontWeight: 700 }}>{h.nombre_dia.substring(0, 3)}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ backgroundColor: t.bgPanel, padding: 20, borderRadius: 14, border: `1px solid ${t.border}` }}>
        <h3 style={{ margin: '0 0 16px 0', color: t.text, fontSize: 15, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Award size={18} color={t.exito} /> Ranking de puntualidad (ultimos 30 dias)
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
            <thead>
              <tr style={{ backgroundColor: t.bgTableHead, color: t.textSoft, fontSize: 11, textTransform: 'uppercase', fontWeight: 800 }}>
                <th style={{ padding: '10px 14px', borderBottom: `2px solid ${t.border}`, textAlign: 'center', width: 60 }}>#</th>
                <th style={{ padding: '10px 14px', borderBottom: `2px solid ${t.border}`, textAlign: 'left' }}>Empleado</th>
                <th style={{ padding: '10px 14px', borderBottom: `2px solid ${t.border}`, textAlign: 'left' }}>Departamento</th>
                <th style={{ padding: '10px 14px', borderBottom: `2px solid ${t.border}`, textAlign: 'center' }}>Marcas</th>
                <th style={{ padding: '10px 14px', borderBottom: `2px solid ${t.border}`, textAlign: 'center' }}>Tarde</th>
                <th style={{ padding: '10px 14px', borderBottom: `2px solid ${t.border}`, textAlign: 'center' }}>Min tarde</th>
              </tr>
            </thead>
            <tbody>
              {ranking.length === 0 && <tr><td colSpan="6" style={{ padding: 24, textAlign: 'center', color: t.textMuted, fontWeight: 600 }}>Sin datos en los ultimos 30 dias</td></tr>}
              {ranking.map((r, i) => (
                <tr key={r.empleado_id} style={{ borderBottom: `1px solid ${t.borderSoft}`, fontSize: 13 }}>
                  <td style={{ padding: '10px 14px', textAlign: 'center', color: i < 3 ? t.exito : t.textSoft, fontWeight: 900 }}>{i + 1}{i === 0 ? ' 🥇' : i === 1 ? ' 🥈' : i === 2 ? ' 🥉' : ''}</td>
                  <td style={{ padding: '10px 14px', color: t.text, fontWeight: 700 }}>{r.nombres} {r.apellidos} <span style={{ color: t.textMuted, fontWeight: 500 }}>({r.empleado_id})</span></td>
                  <td style={{ padding: '10px 14px', color: t.textSoft }}>{r.departamento}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'center', color: t.text, fontWeight: 600 }}>{r.dias_marcados}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'center', color: r.dias_tarde === 0 ? t.exito : t.aviso, fontWeight: 800 }}>{r.dias_tarde}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'center', color: r.minutos_tarde_total === 0 ? t.exito : t.error, fontWeight: 800 }}>{r.minutos_tarde_total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function KPI({ t, titulo, valor, color }) {
  return (
    <div style={{ flex: 1, backgroundColor: t.bgPanel, padding: 16, borderRadius: 12, border: `1px solid ${t.border}` }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: t.textSoft, textTransform: 'uppercase' }}>{titulo}</div>
      <div style={{ fontSize: 26, fontWeight: 900, color }}>{valor}</div>
    </div>
  )
}
