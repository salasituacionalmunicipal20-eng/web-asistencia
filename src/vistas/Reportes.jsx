import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '../supabase'
import { BookOpen, Download, Search, UserCheck, Calendar, Clock, AlertCircle, BarChart3, UserX, Award, FileSpreadsheet, Pencil, Plus, X, Save } from 'lucide-react'
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
  // modal de edicion/creacion manual de un registro de asistencia
  // shape: { tipo: 'editar'|'crear', registro: {...}|null }
  const [modalReg, setModalReg] = useState(null)
  const [miCorreo, setMiCorreo] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMiCorreo(data?.user?.email || ''))
  }, [])

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
    // Mantenemos el registro original en el item para poder editarlo
    d.asis.forEach(a => items.push({ tipo: 'Asistencia', fecha: a.fecha, detalle: `Entrada: ${fmtHora(a.hora_entrada)} | Salida: ${fmtHora(a.hora_salida)}`, registro: a }))
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `2px solid ${t.borderSoft}`, paddingBottom: 12, marginBottom: 16, gap: 10, flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0, color: t.text, fontWeight: 900 }}>
                  {empleadoSel.nombres} {empleadoSel.apellidos}
                </h3>
                <button onClick={() => setModalReg({ tipo: 'crear', registro: null })}
                  title="Crear manualmente una marca para una fecha que no tiene registro"
                  style={{ padding: '8px 14px', backgroundColor: t.exito, color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  <Plus size={14} /> Agregar marca manual
                </button>
              </div>
              <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                {historial.map((h, i) => (
                  <div key={i} style={{ marginBottom: 10, padding: 12, borderRadius: 10, borderLeft: `4px solid ${h.tipo === 'Asistencia' ? t.exito : h.tipo === 'Justificacion' ? t.aviso : t.info}`, backgroundColor: t.bgInput }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, alignItems: 'center' }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: t.textSoft, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Calendar size={12} /> {h.fecha}
                      </span>
                      <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                        {h.tipo === 'Asistencia' && h.registro && (
                          <button onClick={() => setModalReg({ tipo: 'editar', registro: h.registro })}
                            title="Corregir hora de entrada o salida"
                            style={{ padding: '3px 8px', backgroundColor: t.primarioBg, color: t.primario, border: `1px solid ${t.primario}`, borderRadius: 6, cursor: 'pointer', fontWeight: 800, fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <Pencil size={11} /> Editar
                          </button>
                        )}
                        <span style={{ fontSize: 10, fontWeight: 900, padding: '2px 8px', borderRadius: 12, backgroundColor: h.tipo === 'Asistencia' ? t.exitoBg : h.tipo === 'Justificacion' ? t.avisoBg : t.infoBg, color: h.tipo === 'Asistencia' ? t.exito : h.tipo === 'Justificacion' ? t.aviso : t.info, textTransform: 'uppercase' }}>{h.tipo}</span>
                      </div>
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

      {modalReg && empleadoSel && (
        <ModalEditarAsistencia
          tipo={modalReg.tipo}
          registro={modalReg.registro}
          empleado={empleadoSel}
          adminEmail={miCorreo}
          onCerrar={() => setModalReg(null)}
          onGuardado={() => { setModalReg(null); cargar() }}
        />
      )}
    </>
  )
}

// ============================================================================
// Modal de edicion / creacion manual de un registro de asistencia
// ----------------------------------------------------------------------------
// - Tipo 'editar': UPDATE en asistencia_registros por id
// - Tipo 'crear':  INSERT en asistencia_registros (lat/lon = 0 marca manual)
// En ambos casos guarda fila en auditoria con el motivo escrito por el admin.
// ============================================================================
function ModalEditarAsistencia({ tipo, registro, empleado, adminEmail, onCerrar, onGuardado }) {
  const { t } = useTema()
  const esEditar = tipo === 'editar'
  const hoyIso = new Date().toISOString().substring(0, 10)

  const [fecha, setFecha] = useState(esEditar ? registro.fecha : hoyIso)
  const [horaEntrada, setHoraEntrada] = useState(esEditar ? String(registro.hora_entrada || '').substring(0, 5) : '')
  const [horaSalida, setHoraSalida] = useState(esEditar ? String(registro.hora_salida || '').substring(0, 5) : '')
  const [motivo, setMotivo] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const guardar = async () => {
    setError('')
    if (!horaEntrada && !horaSalida) {
      setError('Debes indicar al menos la hora de entrada o la de salida.'); return
    }
    if (!motivo.trim()) {
      setError('El motivo es obligatorio para dejar trazabilidad en la auditoría.'); return
    }
    setGuardando(true)

    try {
      let registroId, valorAnterior, valorNuevo
      const horaEntradaFinal = horaEntrada ? `${horaEntrada}:00` : null
      const horaSalidaFinal  = horaSalida  ? `${horaSalida}:00`  : null

      if (esEditar) {
        valorAnterior = `entrada=${registro.hora_entrada || '--'} | salida=${registro.hora_salida || '--'}`
        const { error: upErr } = await supabase
          .from('asistencia_registros')
          .update({ hora_entrada: horaEntradaFinal, hora_salida: horaSalidaFinal })
          .eq('id', registro.id)
        if (upErr) throw upErr
        registroId = registro.id
        valorNuevo = `entrada=${horaEntradaFinal || '--'} | salida=${horaSalidaFinal || '--'}`
      } else {
        // Marca manual: lat/lon = 0 indica que no vino del GPS de la app.
        // device_id se manda explicitamente como 'WEB_ADMIN_MANUAL' por
        // consistencia — antes lo omitiamos y eso podia romper la decodificacion
        // del historial en algunas versiones viejas de la app Android (campo
        // declarado no-nullable).
        const { data: insData, error: insErr } = await supabase
          .from('asistencia_registros')
          .insert({
            empleado_id: empleado.cedula,
            fecha,
            hora_entrada: horaEntradaFinal,
            hora_salida: horaSalidaFinal,
            latitud: 0,
            longitud: 0,
            device_id: 'WEB_ADMIN_MANUAL',
            network_type: 'MANUAL_ADMIN'
          })
          .select('id')
          .single()
        if (insErr) throw insErr
        registroId = insData.id
        valorAnterior = 'sin registro'
        valorNuevo = `entrada=${horaEntradaFinal || '--'} | salida=${horaSalidaFinal || '--'} | fecha=${fecha}`
      }

      // Auditoria — siempre, tanto en update como en insert
      await supabase.from('auditoria').insert({
        tabla: 'asistencia_registros',
        registro_id: String(registroId),
        accion: esEditar ? 'EDITAR_MARCA' : 'CREAR_MARCA_MANUAL',
        campo: `empleado=${empleado.cedula}`,
        valor_anterior: valorAnterior,
        valor_nuevo: `${valorNuevo} | motivo=${motivo.trim()}`,
        usuario_email: adminEmail || 'admin'
      })

      onGuardado()
    } catch (e) {
      setError(e.message || 'No se pudo guardar')
      setGuardando(false)
    }
  }

  const estiloInput = { width: '100%', padding: 11, borderRadius: 8, border: `1px solid ${t.border}`, fontSize: 14, backgroundColor: t.bgInput, color: t.text, fontWeight: 600, outline: 'none', boxSizing: 'border-box' }

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onCerrar() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: t.bgPanel, borderRadius: 14, padding: 24, maxWidth: 480, width: '100%', boxShadow: '0 20px 50px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, paddingBottom: 12, borderBottom: `1px solid ${t.borderSoft}` }}>
          <h3 style={{ margin: 0, color: t.text, fontSize: 16, fontWeight: 900, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            {esEditar ? <Pencil size={18} color={t.primario} /> : <Plus size={18} color={t.exito} />}
            {esEditar ? 'Editar marca de asistencia' : 'Agregar marca manual'}
          </h3>
          <button onClick={onCerrar} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: t.textSoft, padding: 4 }}><X size={20} /></button>
        </div>

        <div style={{ fontSize: 12, color: t.textSoft, fontWeight: 700, marginBottom: 14 }}>
          {empleado.nombres} {empleado.apellidos} · <span style={{ color: t.primario }}>{empleado.cedula}</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div style={{ gridColumn: esEditar ? '1 / -1' : 'auto' }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: t.textSoft, marginBottom: 4, textTransform: 'uppercase' }}>Fecha</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} disabled={esEditar} max={hoyIso} style={{ ...estiloInput, opacity: esEditar ? 0.7 : 1 }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: t.exito, marginBottom: 4, textTransform: 'uppercase' }}>Hora de entrada</label>
            <input type="time" value={horaEntrada} onChange={e => setHoraEntrada(e.target.value)} style={estiloInput} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: t.aviso, marginBottom: 4, textTransform: 'uppercase' }}>Hora de salida</label>
            <input type="time" value={horaSalida} onChange={e => setHoraSalida(e.target.value)} style={estiloInput} />
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: t.error, marginBottom: 4, textTransform: 'uppercase' }}>
            Motivo del cambio (obligatorio)
          </label>
          <textarea value={motivo} onChange={e => setMotivo(e.target.value)} rows={2}
            placeholder="Ej: empleado olvidó marcar entrada, marcó hora equivocada, etc."
            style={{ ...estiloInput, resize: 'vertical', fontFamily: 'inherit' }} />
          <div style={{ fontSize: 11, color: t.textMuted, marginTop: 4, fontWeight: 600 }}>
            Queda registrado en la auditoría junto a tu correo ({adminEmail || 'admin'}).
          </div>
        </div>

        {error && <div style={{ padding: 10, background: t.errorBg, color: t.error, borderLeft: `3px solid ${t.error}`, borderRadius: 6, fontSize: 13, fontWeight: 700, marginBottom: 12 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCerrar} disabled={guardando}
            style={{ padding: '10px 16px', background: t.bgInput, color: t.textSoft, border: `1px solid ${t.border}`, borderRadius: 8, cursor: 'pointer', fontWeight: 800, fontSize: 13 }}>
            Cancelar
          </button>
          <button onClick={guardar} disabled={guardando}
            style={{ padding: '10px 16px', background: esEditar ? t.primario : t.exito, color: 'white', border: 'none', borderRadius: 8, cursor: guardando ? 'wait' : 'pointer', fontWeight: 800, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6, opacity: guardando ? 0.7 : 1 }}>
            <Save size={14} /> {guardando ? 'Guardando...' : (esEditar ? 'Guardar cambios' : 'Crear marca')}
          </button>
        </div>
      </div>
    </div>
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
// 3. AUSENTES — vista en vivo (hoy) + historico (fechas pasadas)
// ----------------------------------------------------------------------------
// - Si la fecha seleccionada es HOY: consulta `vw_ausentes_hoy` (reactiva).
// - Si es fecha pasada: consulta `ausencias_diarias` (snapshot guardado).
// - Boton "Guardar snapshot" llama al RPC snapshot_ausencias_dia(fecha).
// - Exporta a Excel.
// ============================================================================
function PanelAusentes() {
  const { t } = useTema()
  const hoyIso = new Date().toISOString().substring(0, 10)
  const [fecha, setFecha] = useState(hoyIso)
  const [lista, setLista] = useState([])
  const [cargando, setCargando] = useState(false)
  const [snapshotInfo, setSnapshotInfo] = useState(null)  // { count, generada_en } | null
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState('')

  const esHoy = fecha === hoyIso

  const cargar = useCallback(async () => {
    setCargando(true)
    setMensaje('')
    if (esHoy) {
      // Vista en vivo
      const { data, error } = await supabase.from('vw_ausentes_hoy').select('*')
      if (error) {
        setMensaje(`⚠️ ${error.message}. ¿Corriste el SQL de REPORTES_AUSENCIAS?`)
        setLista([])
      } else {
        setLista(data || [])
      }
      // Tambien chequea si ya hay un snapshot guardado de hoy
      const { data: snap } = await supabase
        .from('ausencias_diarias')
        .select('generada_en')
        .eq('fecha', fecha)
        .limit(1)
        .maybeSingle()
      setSnapshotInfo(snap ? { generada_en: snap.generada_en } : null)
    } else {
      // Historico desde la tabla
      const { data, error } = await supabase
        .from('ausencias_diarias')
        .select('*')
        .eq('fecha', fecha)
        .order('apellidos')
      if (error) {
        setMensaje(`⚠️ ${error.message}`)
        setLista([])
      } else {
        setLista(data || [])
        setSnapshotInfo(data && data.length > 0 ? { generada_en: data[0].generada_en } : null)
      }
    }
    setCargando(false)
  }, [fecha, esHoy])

  useEffect(() => { cargar() }, [cargar])

  const guardarSnapshot = async () => {
    setGuardando(true)
    setMensaje('')
    const { data, error } = await supabase.rpc('snapshot_ausencias_dia', { p_fecha: fecha })
    setGuardando(false)
    if (error) {
      setMensaje(`⛔ Error al guardar snapshot: ${error.message}`)
    } else {
      setMensaje(`✅ Snapshot guardado: ${data ?? 0} ausencias registradas para ${fecha}`)
      cargar()
    }
  }

  const exportarExcel = () => {
    if (lista.length === 0) return
    const filas = lista.map(a => ({
      Fecha: fecha,
      Cedula: a.cedula || a.empleado_id,
      Nombres: a.nombres,
      Apellidos: a.apellidos,
      Departamento: a.departamento,
      Cargo: a.cargo,
      Estado: a.estado_falta || a.estado,
      'Hora programada': String(a.hora_programada || '').substring(0, 5)
    }))
    const ws = XLSX.utils.json_to_sheet(filas)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Ausencias')
    XLSX.writeFile(wb, `Ausencias_${fecha}.xlsx`)
  }

  const colorEstado = (s) => {
    if (s === 'JUSTIFICADO')    return { bg: t.exitoBg, fg: t.exito }
    if (s === 'EN_VACACIONES')  return { bg: t.infoBg,  fg: t.info }
    return { bg: t.errorBg, fg: t.error }
  }

  // El estado viene como estado_falta (vista en vivo) o estado (snapshot)
  const getEstado = (a) => a.estado_falta || a.estado || 'AUSENTE'
  const getCedula = (a) => a.cedula || a.empleado_id

  return (
    <div style={{ backgroundColor: t.bgPanel, padding: 20, borderRadius: 14, border: `1px solid ${t.border}` }}>
      <h3 style={{ margin: '0 0 16px 0', color: t.text, fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
        <UserX size={20} color={t.error} /> Ausencias del día — {esHoy ? 'HOY (en vivo)' : 'snapshot histórico'}
      </h3>

      {/* Controles */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'end', marginBottom: 14, paddingBottom: 14, borderBottom: `1px solid ${t.borderSoft}` }}>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: t.textSoft, marginBottom: 4, textTransform: 'uppercase' }}>Fecha</label>
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} max={hoyIso}
            style={{ padding: 10, borderRadius: 8, border: `1px solid ${t.border}`, backgroundColor: t.bgInput, color: t.text, fontWeight: 700, fontSize: 13 }} />
        </div>
        <button onClick={guardarSnapshot} disabled={guardando}
          title="Genera/refresca el snapshot de ausencias para la fecha seleccionada"
          style={{ padding: '10px 14px', backgroundColor: t.primario, color: 'white', border: 'none', borderRadius: 8, cursor: guardando ? 'wait' : 'pointer', fontWeight: 800, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Save size={14} /> {guardando ? 'Guardando...' : (snapshotInfo ? 'Refrescar snapshot' : 'Guardar snapshot del día')}
        </button>
        {lista.length > 0 && (
          <button onClick={exportarExcel}
            style={{ padding: '10px 14px', backgroundColor: t.exito, color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 800, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <FileSpreadsheet size={14} /> Excel
          </button>
        )}
        {snapshotInfo && (
          <div style={{ fontSize: 11, color: t.textSoft, fontWeight: 600, marginLeft: 4 }}>
            Snapshot generado: {new Date(snapshotInfo.generada_en).toLocaleString('es-VE')}
          </div>
        )}
      </div>

      {mensaje && (
        <div style={{ marginBottom: 14, padding: 10, borderRadius: 8, backgroundColor: mensaje.startsWith('✅') ? t.exitoBg : t.errorBg, color: mensaje.startsWith('✅') ? t.exito : t.error, fontWeight: 700, fontSize: 13, borderLeft: `3px solid ${mensaje.startsWith('✅') ? t.exito : t.error}` }}>
          {mensaje}
        </div>
      )}

      <h4 style={{ margin: '0 0 12px 0', color: t.text, fontSize: 14, fontWeight: 800 }}>
        {lista.length} {lista.length === 1 ? 'ausencia' : 'ausencias'} {esHoy ? 'sin marca aún' : `el ${fecha}`}
      </h4>

      {lista.length === 0 ? (
        <div style={{ padding: 30, textAlign: 'center', color: t.textMuted, fontWeight: 600 }}>
          {cargando
            ? 'Cargando...'
            : (esHoy
                ? 'Todos los empleados ya marcaron hoy 🎉 (o no hay día laborable / es feriado)'
                : (snapshotInfo
                    ? 'Esta fecha tuvo 0 ausencias en su snapshot.'
                    : 'No hay snapshot guardado de esta fecha. Genera uno con el botón "Guardar snapshot del día".'))}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
          {lista.map(a => {
            const estado = getEstado(a)
            const c = colorEstado(estado)
            return (
              <div key={getCedula(a)} style={{ padding: 14, borderRadius: 10, backgroundColor: c.bg, borderLeft: `4px solid ${c.fg}` }}>
                <div style={{ fontWeight: 800, color: t.text, fontSize: 14 }}>{a.nombres} {a.apellidos}</div>
                <div style={{ fontSize: 12, color: t.textSoft, fontWeight: 600, marginTop: 2 }}>{getCedula(a)} · {a.departamento}</div>
                <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: t.textSoft, fontWeight: 600 }}>Programada: {String(a.hora_programada || '').substring(0, 5)}</span>
                  <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 800, backgroundColor: c.fg + '33', color: c.fg, textTransform: 'uppercase' }}>{estado}</span>
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
