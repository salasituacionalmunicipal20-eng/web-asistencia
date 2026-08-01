import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../supabase'
import { useTema } from '../theme/ThemeProvider'
import { useIsMobile } from '../hooks/useIsMobile'
import * as XLSX from 'xlsx'
import { Wallet, Save, Download, Settings2, Calculator } from 'lucide-react'
import { horasEntre, ymdLocal, fmtHoras } from '../lib/horas'

/**
 * Nómina y horas extra (estilo Hubstaff).
 *   1) Parámetros de nómina  -> nomina_config (fila unica id=1)
 *   2) Tarifas por empleado  -> empleados.tarifa_hora / sueldo_mensual
 *   3) Cálculo por período   -> asistencia_registros agrupado por cédula
 *
 * Reglas: por cada día, horas = horasEntre(entrada, salida). De esas horas,
 * las primeras `horas_dia_normal` son normales y el resto son extra. El pago
 * extra usa el `multiplicador_extra` sobre la tarifa. RLS abierto: se usa
 * .select/.update directo, sin RPCs.
 */
export default function Nomina() {
  const { t } = useTema()
  const isMobile = useIsMobile()

  // --- Parámetros de nómina (nomina_config id=1) ---
  const [horasDiaNormal, setHorasDiaNormal] = useState(8)
  const [multiplicadorExtra, setMultiplicadorExtra] = useState(1.5)
  const [moneda, setMoneda] = useState('Bs')
  const [guardandoParam, setGuardandoParam] = useState(false)
  const [paramOk, setParamOk] = useState(false)

  // --- Empleados activos + tarifas ---
  const [empleados, setEmpleados] = useState([])
  const [cargandoEmp, setCargandoEmp] = useState(false)
  const [tarifasEdit, setTarifasEdit] = useState({})   // { [empId]: { tarifa_hora, sueldo_mensual } }
  const [guardandoFila, setGuardandoFila] = useState(null)

  // --- Cálculo de nómina por período ---
  const [periodo, setPeriodo] = useState(() => ymdLocal(new Date()).substring(0, 7)) // "YYYY-MM"
  const [calculando, setCalculando] = useState(false)
  const [calculo, setCalculo] = useState(null)          // { periodo, filas: [...] } | null

  const estiloInput = { width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${t.border}`, fontSize: 14, backgroundColor: t.bgInput, color: t.text, fontWeight: 600, outline: 'none', boxSizing: 'border-box' }
  const nfMoneda = useMemo(() => new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), [])
  const fmtDinero = useCallback((x) => `${nfMoneda.format(Number(x) || 0)} ${moneda}`, [nfMoneda, moneda])

  // Cargar configuración
  useEffect(() => {
    supabase.from('nomina_config').select('*').eq('id', 1).maybeSingle().then(({ data }) => {
      if (data) {
        setHorasDiaNormal(Number(data.horas_dia_normal) || 8)
        setMultiplicadorExtra(Number(data.multiplicador_extra) || 1.5)
        setMoneda(data.moneda || 'Bs')
      }
    })
  }, [])

  // Cargar empleados activos
  const cargarEmpleados = useCallback(async () => {
    setCargandoEmp(true)
    const { data } = await supabase
      .from('empleados')
      .select('id, cedula, nombres, apellidos, departamento, cargo, tarifa_hora, sueldo_mensual')
      .eq('activo', true)
      .order('nombres')
    const lista = data || []
    setEmpleados(lista)
    const edit = {}
    lista.forEach(e => { edit[e.id] = { tarifa_hora: e.tarifa_hora ?? '', sueldo_mensual: e.sueldo_mensual ?? '' } })
    setTarifasEdit(edit)
    setCargandoEmp(false)
  }, [])
  useEffect(() => { cargarEmpleados() }, [cargarEmpleados])

  const guardarParametros = async () => {
    setGuardandoParam(true)
    setParamOk(false)
    const { error } = await supabase.from('nomina_config').update({
      horas_dia_normal: Number(horasDiaNormal) || 8,
      multiplicador_extra: Number(multiplicadorExtra) || 1.5,
      moneda: (moneda || 'Bs').trim() || 'Bs',
      actualizado_en: new Date().toISOString()
    }).eq('id', 1)
    setGuardandoParam(false)
    if (!error) { setParamOk(true); setTimeout(() => setParamOk(false), 2500) }
    else alert(`No se pudo guardar: ${error.message}`)
  }

  const guardarTarifaFila = async (emp) => {
    setGuardandoFila(emp.id)
    const edit = tarifasEdit[emp.id] || {}
    const { error } = await supabase.from('empleados').update({
      tarifa_hora: Number(edit.tarifa_hora) || null,
      sueldo_mensual: Number(edit.sueldo_mensual) || null
    }).eq('id', emp.id)
    setGuardandoFila(null)
    if (error) { alert(`No se pudo guardar la tarifa: ${error.message}`); return }
    // Refrescar el estado local del empleado sin recargar toda la lista
    setEmpleados(prev => prev.map(e => e.id === emp.id
      ? { ...e, tarifa_hora: Number(edit.tarifa_hora) || null, sueldo_mensual: Number(edit.sueldo_mensual) || null }
      : e))
  }

  const setEditCampo = (empId, campo, valor) => {
    setTarifasEdit(prev => ({ ...prev, [empId]: { ...prev[empId], [campo]: valor } }))
  }

  const calcularNomina = useCallback(async () => {
    setCalculando(true)
    setCalculo(null)
    // Derivar desde/hasta del mes elegido
    const [anio, mes] = periodo.split('-').map(Number)
    const desde = ymdLocal(new Date(anio, (mes || 1) - 1, 1))
    const hasta = ymdLocal(new Date(anio, mes || 1, 0)) // día 0 del mes siguiente = último día del mes

    const { data, error } = await supabase
      .from('asistencia_registros')
      .select('empleado_id, fecha, hora_entrada, hora_salida')
      .gte('fecha', desde)
      .lte('fecha', hasta)

    if (error) { setCalculando(false); alert(`Error al leer asistencia: ${error.message}`); return }

    // Mapa cédula -> empleado (para nombre / tarifa)
    const mapaEmp = new Map(empleados.map(e => [String(e.cedula), e]))
    const hnMax = Number(horasDiaNormal) || 8
    const mult = Number(multiplicadorExtra) || 1.5

    // Agrupar por cédula (empleado_id) y sumar horas normales/extra + días
    const acum = new Map() // cedula -> { horasNormales, horasExtra, dias }
    ;(data || []).forEach(r => {
      const ced = String(r.empleado_id || '')
      if (!ced) return
      const horasDia = horasEntre(r.hora_entrada, r.hora_salida)
      if (horasDia <= 0) return
      const normal = Math.min(horasDia, hnMax)
      const extra = Math.max(0, horasDia - hnMax)
      const a = acum.get(ced) || { horasNormales: 0, horasExtra: 0, dias: 0 }
      a.horasNormales += normal
      a.horasExtra += extra
      a.dias += 1
      acum.set(ced, a)
    })

    const filas = Array.from(acum.entries()).map(([ced, a]) => {
      const emp = mapaEmp.get(ced)
      const tarifa = emp ? (Number(emp.tarifa_hora) || 0) : 0
      const pagoNormal = a.horasNormales * tarifa
      const pagoExtra = a.horasExtra * tarifa * mult
      return {
        cedula: ced,
        nombre: emp ? `${emp.nombres} ${emp.apellidos}` : `(cédula ${ced})`,
        departamento: emp?.departamento || '—',
        cargo: emp?.cargo || '—',
        dias: a.dias,
        horasNormales: a.horasNormales,
        horasExtra: a.horasExtra,
        tarifa,
        pagoNormal,
        pagoExtra,
        total: pagoNormal + pagoExtra
      }
    }).sort((x, y) => y.total - x.total || x.nombre.localeCompare(y.nombre, 'es'))

    setCalculo({ periodo, desde, hasta, filas })
    setCalculando(false)
  }, [periodo, empleados, horasDiaNormal, multiplicadorExtra])

  const totales = useMemo(() => {
    const f = calculo?.filas || []
    return {
      horasNormales: f.reduce((s, r) => s + r.horasNormales, 0),
      horasExtra: f.reduce((s, r) => s + r.horasExtra, 0),
      total: f.reduce((s, r) => s + r.total, 0)
    }
  }, [calculo])

  const exportarExcel = () => {
    if (!calculo || calculo.filas.length === 0) return
    const filas = calculo.filas.map(r => ({
      Cedula: r.cedula,
      Empleado: r.nombre,
      Departamento: r.departamento,
      Cargo: r.cargo,
      Periodo: calculo.periodo,
      'Dias trabajados': r.dias,
      'Horas normales': Math.round(r.horasNormales * 100) / 100,
      'Horas extra': Math.round(r.horasExtra * 100) / 100,
      [`Tarifa/hora (${moneda})`]: Math.round(r.tarifa * 100) / 100,
      [`Pago normal (${moneda})`]: Math.round(r.pagoNormal * 100) / 100,
      [`Pago extra (${moneda})`]: Math.round(r.pagoExtra * 100) / 100,
      [`Total (${moneda})`]: Math.round(r.total * 100) / 100
    }))
    const ws = XLSX.utils.json_to_sheet(filas)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Nomina')
    XLSX.writeFile(wb, `Nomina_${periodo}.xlsx`)
  }

  const thStyle = { padding: '12px 14px', borderBottom: `2px solid ${t.border}`, textAlign: 'left' }
  const thNum = { ...thStyle, textAlign: 'right' }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: isMobile ? 5 : 0 }}>
      {/* HEADER */}
      <div style={{ marginBottom: 24, background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)', padding: 25, borderRadius: 16, color: 'white' }}>
        <h1 style={{ margin: 0, fontSize: isMobile ? 22 : 28, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}><Wallet size={32} /> Nómina y horas extra</h1>
        <p style={{ margin: '6px 0 0 0', fontSize: 14, opacity: 0.9 }}>Tarifas por empleado, reglas de horas extra y cálculo de pagos por período.</p>
      </div>

      {/* 1) PARÁMETROS */}
      <div style={{ backgroundColor: t.bgPanel, border: `1px solid ${t.border}`, borderRadius: 14, padding: 20, marginBottom: 20 }}>
        <h3 style={{ margin: '0 0 16px 0', color: t.text, fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Settings2 size={20} color={t.primario} /> Parámetros de nómina
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 14, marginBottom: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: t.textSoft, marginBottom: 6, textTransform: 'uppercase' }}>Horas normales por día</label>
            <input type="number" min="0" step="0.5" value={horasDiaNormal} onChange={e => setHorasDiaNormal(e.target.value)} style={estiloInput} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: t.textSoft, marginBottom: 6, textTransform: 'uppercase' }}>Multiplicador horas extra</label>
            <input type="number" min="1" step="0.1" value={multiplicadorExtra} onChange={e => setMultiplicadorExtra(e.target.value)} style={estiloInput} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: t.textSoft, marginBottom: 6, textTransform: 'uppercase' }}>Moneda</label>
            <input type="text" value={moneda} onChange={e => setMoneda(e.target.value)} placeholder="Bs" style={estiloInput} />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button onClick={guardarParametros} disabled={guardandoParam}
            style={{ padding: '10px 16px', backgroundColor: t.primario, color: 'white', border: 'none', borderRadius: 8, cursor: guardandoParam ? 'wait' : 'pointer', fontWeight: 800, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6, opacity: guardandoParam ? 0.7 : 1 }}>
            <Save size={14} /> {guardandoParam ? 'Guardando...' : 'Guardar parámetros'}
          </button>
          {paramOk && <span style={{ color: t.exito, fontWeight: 800, fontSize: 13 }}>guardado ✓</span>}
          <span style={{ fontSize: 12, color: t.textMuted, fontWeight: 600 }}>Ej: 8 horas normales, extras a 1.5×, moneda "{moneda}".</span>
        </div>
      </div>

      {/* 2) TARIFAS POR EMPLEADO */}
      <div style={{ backgroundColor: t.bgPanel, border: `1px solid ${t.border}`, borderRadius: 14, padding: 20, marginBottom: 20 }}>
        <h3 style={{ margin: '0 0 16px 0', color: t.text, fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Wallet size={20} color={t.exito} /> Tarifas por empleado <span style={{ fontSize: 12, color: t.textMuted, fontWeight: 600 }}>({empleados.length} activos)</span>
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
            <thead>
              <tr style={{ backgroundColor: t.bgTableHead, color: t.textSoft, fontSize: 12, textTransform: 'uppercase', fontWeight: 800 }}>
                <th style={thStyle}>Cédula</th>
                <th style={thStyle}>Nombre</th>
                <th style={thStyle}>Cargo</th>
                <th style={{ ...thStyle, width: 170 }}>Tarifa/hora ({moneda})</th>
                <th style={{ ...thStyle, width: 170 }}>Sueldo mensual ({moneda})</th>
                <th style={{ ...thStyle, width: 110 }}></th>
              </tr>
            </thead>
            <tbody>
              {cargandoEmp && <tr><td colSpan="6" style={{ padding: 30, textAlign: 'center', color: t.textMuted, fontWeight: 600 }}>Cargando empleados...</td></tr>}
              {!cargandoEmp && empleados.length === 0 && <tr><td colSpan="6" style={{ padding: 30, textAlign: 'center', color: t.textMuted, fontWeight: 600 }}>No hay empleados activos.</td></tr>}
              {empleados.map(emp => {
                const edit = tarifasEdit[emp.id] || {}
                const sinTarifa = !(Number(emp.tarifa_hora) > 0)
                return (
                  <tr key={emp.id} style={{ borderBottom: `1px solid ${t.borderSoft}`, fontSize: 13 }}>
                    <td style={{ padding: '12px 14px', color: t.textSoft, fontWeight: 700 }}>{emp.cedula}</td>
                    <td style={{ padding: '12px 14px', color: t.text, fontWeight: 700 }}>
                      {emp.nombres} {emp.apellidos}
                      {sinTarifa && <span style={{ marginLeft: 8, fontSize: 11, color: t.textMuted, fontWeight: 600 }}>sin tarifa</span>}
                    </td>
                    <td style={{ padding: '12px 14px', color: t.textSoft }}>{emp.cargo}</td>
                    <td style={{ padding: '8px 14px' }}>
                      <input type="number" min="0" step="0.01" value={edit.tarifa_hora ?? ''}
                        onChange={e => setEditCampo(emp.id, 'tarifa_hora', e.target.value)}
                        onBlur={() => guardarTarifaFila(emp)}
                        placeholder="0.00"
                        style={{ ...estiloInput, padding: 8, textAlign: 'right' }} />
                    </td>
                    <td style={{ padding: '8px 14px' }}>
                      <input type="number" min="0" step="0.01" value={edit.sueldo_mensual ?? ''}
                        onChange={e => setEditCampo(emp.id, 'sueldo_mensual', e.target.value)}
                        onBlur={() => guardarTarifaFila(emp)}
                        placeholder="0.00"
                        style={{ ...estiloInput, padding: 8, textAlign: 'right' }} />
                    </td>
                    <td style={{ padding: '8px 14px', textAlign: 'center' }}>
                      <button onClick={() => guardarTarifaFila(emp)} disabled={guardandoFila === emp.id}
                        style={{ padding: '7px 12px', backgroundColor: t.exito, color: 'white', border: 'none', borderRadius: 8, cursor: guardandoFila === emp.id ? 'wait' : 'pointer', fontWeight: 800, fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 5, opacity: guardandoFila === emp.id ? 0.7 : 1 }}>
                        <Save size={12} /> {guardandoFila === emp.id ? '...' : 'Guardar'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3) CÁLCULO POR PERÍODO */}
      <div style={{ backgroundColor: t.bgPanel, border: `1px solid ${t.border}`, borderRadius: 14, padding: 20, marginBottom: 20 }}>
        <h3 style={{ margin: '0 0 16px 0', color: t.text, fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Calculator size={20} color={t.primario} /> Cálculo de nómina por período
        </h3>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: t.textSoft, marginBottom: 6, textTransform: 'uppercase' }}>Mes / período</label>
            <input type="month" value={periodo} onChange={e => setPeriodo(e.target.value)}
              style={{ ...estiloInput, width: 'auto' }} />
          </div>
          <button onClick={calcularNomina} disabled={calculando}
            style={{ padding: '11px 16px', backgroundColor: t.primario, color: 'white', border: 'none', borderRadius: 8, cursor: calculando ? 'wait' : 'pointer', fontWeight: 800, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6, opacity: calculando ? 0.7 : 1 }}>
            <Calculator size={14} /> {calculando ? 'Calculando...' : 'Calcular'}
          </button>
          {calculo && calculo.filas.length > 0 && (
            <button onClick={exportarExcel}
              style={{ padding: '11px 16px', backgroundColor: t.exito, color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 800, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Download size={14} /> Exportar Excel
            </button>
          )}
        </div>

        {!calculo && (
          <div style={{ padding: 40, textAlign: 'center', color: t.textMuted, fontWeight: 600 }}>
            {calculando ? 'Calculando...' : 'Elige un mes y presiona "Calcular" para generar la nómina del período.'}
          </div>
        )}

        {calculo && calculo.filas.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: t.textMuted, fontWeight: 600 }}>
            No hay asistencia registrada entre {calculo.desde} y {calculo.hasta}.
          </div>
        )}

        {calculo && calculo.filas.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
              <thead>
                <tr style={{ backgroundColor: t.bgTableHead, color: t.textSoft, fontSize: 12, textTransform: 'uppercase', fontWeight: 800 }}>
                  <th style={thStyle}>Empleado</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>Días</th>
                  <th style={thNum}>Horas normales</th>
                  <th style={thNum}>Horas extra</th>
                  <th style={thNum}>Tarifa/h</th>
                  <th style={thNum}>Pago normal</th>
                  <th style={thNum}>Pago extra</th>
                  <th style={thNum}>Total</th>
                </tr>
              </thead>
              <tbody>
                {calculo.filas.map(r => {
                  const sinTarifa = !(r.tarifa > 0)
                  return (
                    <tr key={r.cedula} style={{ borderBottom: `1px solid ${t.borderSoft}`, fontSize: 13 }}>
                      <td style={{ padding: '12px 14px', color: t.text, fontWeight: 700 }}>
                        {r.nombre} <span style={{ color: t.textMuted, fontWeight: 500 }}>({r.cedula})</span>
                        {sinTarifa && <span style={{ marginLeft: 8, fontSize: 11, color: t.aviso, fontWeight: 700 }}>definir tarifa</span>}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center', color: t.text, fontWeight: 700 }}>{r.dias}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', color: t.textSoft, fontWeight: 600 }}>{fmtHoras(r.horasNormales)}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        {r.horasExtra > 0
                          ? <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 800, backgroundColor: t.avisoBg, color: t.aviso }}>{fmtHoras(r.horasExtra)}</span>
                          : <span style={{ color: t.textMuted, fontWeight: 600 }}>—</span>}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', color: t.textSoft, fontWeight: 600 }}>{sinTarifa ? '—' : fmtDinero(r.tarifa)}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', color: t.text, fontWeight: 600 }}>{fmtDinero(r.pagoNormal)}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', color: t.text, fontWeight: 600 }}>{fmtDinero(r.pagoExtra)}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', color: t.primario, fontWeight: 900 }}>{fmtDinero(r.total)}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr style={{ backgroundColor: t.bgTableHead, fontSize: 13 }}>
                  <td style={{ padding: '12px 14px', color: t.text, fontWeight: 900, textTransform: 'uppercase' }}>Totales</td>
                  <td style={{ padding: '12px 14px', textAlign: 'center', color: t.text, fontWeight: 800 }}>{calculo.filas.length}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', color: t.text, fontWeight: 800 }}>{fmtHoras(totales.horasNormales)}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', color: t.aviso, fontWeight: 800 }}>{fmtHoras(totales.horasExtra)}</td>
                  <td colSpan="3"></td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', color: t.exito, fontWeight: 900 }}>{fmtDinero(totales.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
