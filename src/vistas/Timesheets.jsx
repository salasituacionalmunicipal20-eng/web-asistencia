import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../supabase'
import { useTema } from '../theme/ThemeProvider'
import { useIsMobile } from '../hooks/useIsMobile'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { dibujarHeaderPDF, dibujarFooterPDF } from '../lib/pdfHeader'
import { CalendarClock, ChevronLeft, ChevronRight, Check, X, Download, Pencil, Save, FileText } from 'lucide-react'
import { horaHM, horasEntre, ymdLocal, lunesDe, fmtHoras, DIAS_SEMANA } from '../lib/horas'

const ESTADO_INFO = {
  pendiente: { txt: 'Pendiente', bg: '#fef3c7', fg: '#92400e' },
  aprobada: { txt: 'Aprobada', bg: '#dcfce7', fg: '#166534' },
  rechazada: { txt: 'Rechazada', bg: '#fee2e2', fg: '#991b1b' },
}

export default function Timesheets() {
  const { t } = useTema()
  const isMobile = useIsMobile()
  const [empleados, setEmpleados] = useState([])
  const [turnos, setTurnos] = useState([])
  const [empId, setEmpId] = useState('')
  const [weekStart, setWeekStart] = useState(() => lunesDe(new Date()))
  const [rows, setRows] = useState([])
  const [aprob, setAprob] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [edit, setEdit] = useState(null) // { ymd, entrada, salida }
  const [nota, setNota] = useState('')
  const [miCorreo, setMiCorreo] = useState('')

  useEffect(() => { supabase.auth.getUser().then(({ data }) => setMiCorreo(data?.user?.email || '')) }, [])

  const estiloInput = { padding: '8px 10px', borderRadius: 8, border: `1px solid ${t.border}`, fontSize: 14, backgroundColor: t.bgInput, color: t.text, fontWeight: 600, outline: 'none', boxSizing: 'border-box' }

  useEffect(() => {
    supabase.from('empleados').select('id, cedula, nombres, apellidos, hora_entrada, hora_salida, turno_id').eq('activo', true).order('nombres')
      .then(({ data }) => { const l = data || []; setEmpleados(l); if (!empId && l.length) setEmpId(l[0].id) })
    supabase.from('turnos').select('id, nombre, hora_entrada, hora_salida').then(({ data }) => setTurnos(data || []))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const emp = useMemo(() => empleados.find(e => e.id === empId) || null, [empleados, empId])
  const cedula = emp?.cedula || ''
  const weekEnd = useMemo(() => { const d = new Date(weekStart); d.setDate(d.getDate() + 6); return d }, [weekStart])
  const periodo = { inicio: ymdLocal(weekStart), fin: ymdLocal(weekEnd) }

  const jornada = useMemo(() => {
    if (!emp) return 0
    const tn = turnos.find(x => x.id === emp.turno_id)
    return horasEntre(tn ? tn.hora_entrada : emp.hora_entrada, tn ? tn.hora_salida : emp.hora_salida)
  }, [emp, turnos])

  const cargar = useCallback(async () => {
    if (!cedula) { setRows([]); setAprob(null); return }
    setCargando(true)
    const { data } = await supabase.from('asistencia_registros')
      .select('id, empleado_id, fecha, hora_entrada, hora_salida')
      .eq('empleado_id', cedula).gte('fecha', periodo.inicio).lte('fecha', periodo.fin).order('fecha')
    setRows(data || [])
    const { data: ap } = await supabase.from('timesheets_aprobaciones')
      .select('*').eq('empleado_id', empId).eq('periodo_inicio', periodo.inicio).eq('periodo_fin', periodo.fin).maybeSingle()
    setAprob(ap || null)
    setNota(ap?.nota || '')
    setCargando(false)
  }, [cedula, empId, periodo.inicio, periodo.fin])
  useEffect(() => { cargar() }, [cargar])

  const dias = useMemo(() => {
    const arr = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart); d.setDate(d.getDate() + i)
      const ymd = ymdLocal(d)
      const marks = rows.filter(r => r.fecha === ymd)
      let horas = 0, entrada = '', salida = ''
      marks.forEach(m => {
        horas += horasEntre(m.hora_entrada, m.hora_salida)
        const e = horaHM(m.hora_entrada), s = horaHM(m.hora_salida)
        if (e && (!entrada || e < entrada)) entrada = e
        if (s && (!salida || s > salida)) salida = s
      })
      arr.push({ i, d, ymd, marks, horas: Math.round(horas * 100) / 100, entrada, salida, esperado: i >= 5 ? 0 : jornada })
    }
    return arr
  }, [weekStart, rows, jornada])

  const totalHoras = useMemo(() => Math.round(dias.reduce((a, d) => a + d.horas, 0) * 100) / 100, [dias])
  const totalEsperado = useMemo(() => Math.round(dias.reduce((a, d) => a + d.esperado, 0) * 100) / 100, [dias])

  const moverSemana = (delta) => { const d = new Date(weekStart); d.setDate(d.getDate() + delta * 7); setWeekStart(lunesDe(d)); setEdit(null) }

  const guardarDia = async (dia) => {
    const ent = edit.entrada ? edit.entrada + ':00' : null
    const sal = edit.salida ? edit.salida + ':00' : null
    const existente = dia.marks[0]
    if (existente) {
      await supabase.from('asistencia_registros').update({ hora_entrada: ent, hora_salida: sal }).eq('id', existente.id)
      await supabase.from('auditoria').insert({ tabla: 'asistencia_registros', registro_id: String(existente.id), accion: 'EDITAR_MARCA_TIMESHEET', campo: `empleado=${cedula} fecha=${dia.ymd}`, valor_anterior: `${horaHM(existente.hora_entrada) || '—'}/${horaHM(existente.hora_salida) || '—'}`, valor_nuevo: `${edit.entrada || '—'}/${edit.salida || '—'}`, usuario_email: miCorreo || 'admin' })
    } else {
      const { data: ins } = await supabase.from('asistencia_registros').insert({ empleado_id: cedula, fecha: dia.ymd, hora_entrada: ent, hora_salida: sal, latitud: 0, longitud: 0, device_id: 'WEB_ADMIN_MANUAL', network_type: 'MANUAL_ADMIN' }).select('id').single()
      await supabase.from('auditoria').insert({ tabla: 'asistencia_registros', registro_id: ins ? String(ins.id) : '', accion: 'CREAR_MARCA_TIMESHEET', campo: `empleado=${cedula} fecha=${dia.ymd}`, valor_nuevo: `${edit.entrada || '—'}/${edit.salida || '—'}`, usuario_email: miCorreo || 'admin' })
    }
    setEdit(null); cargar()
  }

  const decidir = async (estado) => {
    if (!empId) return
    const rec = { empleado_id: empId, periodo_inicio: periodo.inicio, periodo_fin: periodo.fin, horas_total: totalHoras, estado, nota: nota || null, aprobado_por: miCorreo || null, aprobado_en: new Date().toISOString() }
    const { error } = await supabase.from('timesheets_aprobaciones').upsert(rec, { onConflict: 'empleado_id,periodo_inicio,periodo_fin' })
    if (error) { alert('No se pudo guardar la aprobación: ' + error.message); return }
    cargar()
  }

  const nombreEmp = emp ? `${emp.nombres} ${emp.apellidos}` : ''
  const rango = `${periodo.inicio} al ${periodo.fin}`

  const exportarExcel = () => {
    const filas = dias.map(d => ({ Día: DIAS_SEMANA[d.i], Fecha: d.ymd, Entrada: d.entrada || '', Salida: d.salida || '', 'Horas trabajadas': d.horas, 'Horas esperadas': d.esperado }))
    filas.push({ Día: 'TOTAL', Fecha: '', Entrada: '', Salida: '', 'Horas trabajadas': totalHoras, 'Horas esperadas': totalEsperado })
    const ws = XLSX.utils.json_to_sheet(filas)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Hoja de tiempo')
    XLSX.writeFile(wb, `Hoja_tiempo_${(nombreEmp || 'empleado').replace(/\s+/g, '_')}_${periodo.inicio}.xlsx`)
  }

  const exportarPDF = () => {
    const doc = new jsPDF()
    const y = dibujarHeaderPDF(doc, { titulo: 'Hoja de tiempo', subtitulo: `${nombreEmp} · ${rango}` })
    autoTable(doc, {
      startY: y + 4,
      head: [['Día', 'Fecha', 'Entrada', 'Salida', 'Horas', 'Esperadas']],
      body: dias.map(d => [DIAS_SEMANA[d.i], d.ymd, d.entrada || '—', d.salida || '—', fmtHoras(d.horas), fmtHoras(d.esperado)]),
      foot: [['TOTAL', '', '', '', fmtHoras(totalHoras), fmtHoras(totalEsperado)]],
      theme: 'grid', styles: { fontSize: 9 }, headStyles: { fillColor: [10, 35, 81] }, footStyles: { fillColor: [226, 232, 240], textColor: 20, fontStyle: 'bold' },
      didDrawPage: () => dibujarFooterPDF(doc),
    })
    const est = aprob?.estado ? (ESTADO_INFO[aprob.estado]?.txt || aprob.estado) : 'Sin revisar'
    doc.setFontSize(10); doc.text(`Estado: ${est}${aprob?.aprobado_por ? ' · por ' + aprob.aprobado_por : ''}`, 14, doc.lastAutoTable.finalY + 8)
    doc.save(`Hoja_tiempo_${(nombreEmp || 'empleado').replace(/\s+/g, '_')}_${periodo.inicio}.pdf`)
  }

  const card = { backgroundColor: t.bgPanel, border: `1px solid ${t.border}`, borderRadius: 14, padding: isMobile ? 14 : 20, marginBottom: 18 }
  const estadoAct = aprob?.estado || 'pendiente'
  const ei = ESTADO_INFO[estadoAct] || ESTADO_INFO.pendiente

  return (
    <div style={{ maxWidth: 1050, margin: '0 auto', padding: isMobile ? 5 : 0 }}>
      <div style={{ marginBottom: 24, background: 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)', padding: 25, borderRadius: 16, color: 'white' }}>
        <h1 style={{ margin: 0, fontSize: isMobile ? 22 : 28, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}><CalendarClock size={32} /> Hojas de tiempo</h1>
        <p style={{ margin: '6px 0 0', opacity: .9, fontSize: 14 }}>Horas por empleado, semana a semana, con aprobación del período.</p>
      </div>

      {/* Controles */}
      <div style={{ ...card, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
        <div style={{ flex: '1 1 260px' }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: t.textSoft, textTransform: 'uppercase', marginBottom: 6 }}>Empleado</label>
          <select value={empId} onChange={e => { setEmpId(e.target.value); setEdit(null) }} style={{ ...estiloInput, width: '100%' }}>
            {empleados.length === 0 && <option value="">— sin empleados —</option>}
            {empleados.map(e => <option key={e.id} value={e.id}>{e.nombres} {e.apellidos} · {e.cedula}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: t.textSoft, textTransform: 'uppercase', marginBottom: 6 }}>Semana</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button onClick={() => moverSemana(-1)} style={{ ...estiloInput, cursor: 'pointer', display: 'flex' }} title="Semana anterior"><ChevronLeft size={16} /></button>
            <input type="date" value={ymdLocal(weekStart)} onChange={e => { if (e.target.value) { const [y, m, d] = e.target.value.split('-').map(Number); setWeekStart(lunesDe(new Date(y, m - 1, d))); setEdit(null) } }} style={estiloInput} />
            <button onClick={() => moverSemana(1)} style={{ ...estiloInput, cursor: 'pointer', display: 'flex' }} title="Semana siguiente"><ChevronRight size={16} /></button>
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button onClick={exportarExcel} style={{ ...estiloInput, cursor: 'pointer', backgroundColor: t.exitoBg, color: t.exito, border: `1px solid ${t.exito}`, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800 }}><Download size={15} /> Excel</button>
          <button onClick={exportarPDF} style={{ ...estiloInput, cursor: 'pointer', backgroundColor: t.errorBg, color: t.error, border: `1px solid ${t.error}`, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800 }}><FileText size={15} /> PDF</button>
        </div>
      </div>

      {/* Resumen */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 12, marginBottom: 18 }}>
        {[
          { l: 'Empleado', v: nombreEmp || '—' },
          { l: 'Horas trabajadas', v: fmtHoras(totalHoras) },
          { l: 'Horas esperadas', v: fmtHoras(totalEsperado) },
          { l: 'Estado del período', v: ei.txt, chip: true },
        ].map((k, idx) => (
          <div key={idx} style={{ ...card, marginBottom: 0, padding: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: t.textMuted, textTransform: 'uppercase' }}>{k.l}</div>
            {k.chip
              ? <span style={{ display: 'inline-block', marginTop: 6, padding: '3px 10px', borderRadius: 20, fontSize: 13, fontWeight: 800, background: ei.bg, color: ei.fg }}>{k.v}</span>
              : <div style={{ fontSize: 18, fontWeight: 800, color: t.text, marginTop: 4 }}>{k.v}</div>}
          </div>
        ))}
      </div>

      {/* Grilla semanal */}
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
            <thead>
              <tr style={{ backgroundColor: t.bgTableHead, color: t.textSoft, fontSize: 12, textTransform: 'uppercase', fontWeight: 800 }}>
                {['Día', 'Fecha', 'Entrada', 'Salida', 'Horas', 'Esperadas', ''].map((h, i) => (
                  <th key={i} style={{ padding: '13px 14px', borderBottom: `2px solid ${t.border}`, textAlign: i >= 2 && i <= 5 ? 'center' : 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!cedula && <tr><td colSpan="7" style={{ padding: 30, textAlign: 'center', color: t.textMuted, fontWeight: 600 }}>Selecciona un empleado.</td></tr>}
              {cedula && dias.map(dia => {
                const enEd = edit && edit.ymd === dia.ymd
                const finde = dia.i >= 5
                return (
                  <tr key={dia.ymd} style={{ borderBottom: `1px solid ${t.borderSoft}`, backgroundColor: finde ? t.bgHover : 'transparent' }}>
                    <td style={{ padding: '11px 14px', color: t.text, fontWeight: 800 }}>{DIAS_SEMANA[dia.i]}</td>
                    <td style={{ padding: '11px 14px', color: t.textSoft, fontWeight: 600 }}>{dia.ymd}</td>
                    <td style={{ padding: '11px 14px', textAlign: 'center' }}>
                      {enEd ? <input type="time" value={edit.entrada} onChange={e => setEdit({ ...edit, entrada: e.target.value })} style={{ ...estiloInput, padding: '5px 6px' }} /> : <span style={{ color: t.text, fontWeight: 700 }}>{dia.entrada || '—'}</span>}
                    </td>
                    <td style={{ padding: '11px 14px', textAlign: 'center' }}>
                      {enEd ? <input type="time" value={edit.salida} onChange={e => setEdit({ ...edit, salida: e.target.value })} style={{ ...estiloInput, padding: '5px 6px' }} /> : <span style={{ color: t.text, fontWeight: 700 }}>{dia.salida || '—'}</span>}
                    </td>
                    <td style={{ padding: '11px 14px', textAlign: 'center', color: dia.horas ? t.primario : t.textMuted, fontWeight: 800 }}>{fmtHoras(dia.horas)}</td>
                    <td style={{ padding: '11px 14px', textAlign: 'center', color: t.textMuted, fontWeight: 600 }}>{fmtHoras(dia.esperado)}</td>
                    <td style={{ padding: '11px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {enEd ? (
                        <>
                          <button onClick={() => guardarDia(dia)} style={{ padding: '6px 9px', background: t.exito, color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 800, fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Save size={12} /> Guardar</button>
                          <button onClick={() => setEdit(null)} style={{ marginLeft: 6, padding: '6px 9px', background: 'transparent', color: t.textSoft, border: `1px solid ${t.border}`, borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: 12 }}>Cancelar</button>
                        </>
                      ) : (
                        <button onClick={() => setEdit({ ymd: dia.ymd, entrada: dia.entrada, salida: dia.salida })} style={{ padding: '6px 9px', background: t.bgHover, color: t.text, border: `1px solid ${t.border}`, borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Pencil size={12} /> Editar</button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Aprobación */}
      {cedula && (
        <div style={{ ...card, marginTop: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: t.text, marginBottom: 4 }}>Aprobación del período</div>
          <div style={{ fontSize: 12, color: t.textSoft, marginBottom: 12 }}>
            {aprob ? <>Estado <strong style={{ color: ei.fg }}>{ei.txt}</strong>{aprob.aprobado_por ? ` · por ${aprob.aprobado_por}` : ''}{aprob.aprobado_en ? ` · ${new Date(aprob.aprobado_en).toLocaleString('es-VE')}` : ''}</> : 'Este período aún no ha sido revisado.'}
          </div>
          <textarea value={nota} onChange={e => setNota(e.target.value)} placeholder="Nota (opcional): observaciones sobre la hoja de tiempo…" style={{ ...estiloInput, width: '100%', minHeight: 60, resize: 'vertical', marginBottom: 12 }} />
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button onClick={() => decidir('aprobada')} style={{ padding: '10px 16px', background: t.exito, color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}><Check size={16} /> Aprobar hoja</button>
            <button onClick={() => decidir('rechazada')} style={{ padding: '10px 16px', background: t.error, color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}><X size={16} /> Rechazar</button>
            {aprob && <button onClick={() => decidir('pendiente')} style={{ padding: '10px 16px', background: 'transparent', color: t.textSoft, border: `1px solid ${t.border}`, borderRadius: 8, cursor: 'pointer', fontWeight: 700 }}>Marcar pendiente</button>}
          </div>
        </div>
      )}
    </div>
  )
}
