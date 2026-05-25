import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '../supabase'
import {
  MapPin, Users, Calendar as CalendarIcon, Clock, Download,
  CheckCircle, AlertTriangle, UserCheck, FileWarning, Activity, TrendingUp, RefreshCw, Cake
} from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { useIsMobile } from '../hooks/useIsMobile'
import { dibujarHeaderPDF, dibujarFooterPDF } from '../lib/pdfHeader'

/**
 * Panel ejecutivo: KPIs en vivo, presencia actual, ultimos 7 dias, alertas.
 * Polling automatico cada 60 segundos cuando el panel esta visible.
 */
export default function PanelPrincipal() {
  const isMobile = useIsMobile()
  const [kpis, setKpis] = useState(null)
  const [presencia, setPresencia] = useState([])
  const [registros, setRegistros] = useState([])
  const [alertas, setAlertas] = useState([])
  const [cumpleaneros, setCumpleaneros] = useState([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [ultimoRefresh, setUltimoRefresh] = useState(null)

  const cargarTodo = useCallback(async () => {
    setCargando(true)
    setError('')
    const [resKpis, resPres, resReg, resAlert, resCumple] = await Promise.all([
      supabase.from('vw_kpis_hoy').select('*').maybeSingle(),
      supabase.from('vw_presencia_actual').select('*'),
      supabase.from('asistencia_registros')
        .select('*')
        .gte('fecha', new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().substring(0, 10))
        .order('fecha', { ascending: false })
        .limit(500),
      supabase.from('alertas').select('*').eq('resuelta', false).order('creada_en', { ascending: false }).limit(20),
      supabase.from('vw_cumpleanos_proximos').select('*').lte('dias_hasta_cumple', 30)
    ])
    const err = resKpis.error || resPres.error || resReg.error || resAlert.error
    if (err) {
      setError(`No se pudo cargar el dashboard: ${err.message}`)
    } else {
      setKpis(resKpis.data)
      setPresencia(resPres.data || [])
      setRegistros(resReg.data || [])
      setAlertas(resAlert.data || [])
      setCumpleaneros(resCumple.data || [])
    }
    setUltimoRefresh(new Date())
    setCargando(false)
  }, [])

  useEffect(() => {
    cargarTodo()
    // Realtime: nos suscribimos a cambios de asistencia_registros + alertas.
    // Cada INSERT/UPDATE dispara una recarga ligera de KPIs/presencia (sin
    // bloquear UI). El polling cada 60s queda como respaldo por si la conexion
    // realtime se cae (network change, sleep, etc).
    const canal = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'asistencia_registros' }, () => cargarTodo())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alertas' }, () => cargarTodo())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'justificaciones' }, () => cargarTodo())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'empleados' }, () => cargarTodo())
      .subscribe()
    const id = setInterval(cargarTodo, 60_000)
    return () => {
      clearInterval(id)
      supabase.removeChannel(canal)
    }
  }, [cargarTodo])

  // --- Helpers ---------------------------------------------------------
  const fmtHora = (h) => {
    if (!h) return '--:--'
    const s = String(h)
    return s.length >= 5 ? s.substring(0, 5) : s
  }

  const fmtRefresh = (d) => {
    if (!d) return ''
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
  }

  // Datos para barra de 7 dias (registros por fecha)
  const serieSemana = useMemo(() => {
    const mapa = new Map()
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 3600 * 1000)
      const k = d.toISOString().substring(0, 10)
      mapa.set(k, 0)
    }
    registros.forEach(r => {
      if (mapa.has(r.fecha)) mapa.set(r.fecha, mapa.get(r.fecha) + 1)
    })
    return Array.from(mapa.entries()).map(([fecha, cantidad]) => ({ fecha, cantidad }))
  }, [registros])

  const maxBarra = Math.max(1, ...serieSemana.map(p => p.cantidad))

  // --- PDF -------------------------------------------------------------
  const generarPDF = () => {
    const doc = new jsPDF()
    const yInicio = dibujarHeaderPDF(doc, {
      titulo: 'Reporte General de Jornada',
      subtitulo: `${registros.length} registros - Periodo: ultimos 7 dias`
    })

    const tabla = registros.map(r => [
      r.empleado_id,
      r.fecha,
      fmtHora(r.hora_entrada),
      fmtHora(r.hora_salida),
      r.network_type || 'GPS'
    ])

    autoTable(doc, {
      startY: yInicio + 4,
      head: [['Cedula', 'Fecha', 'Hora Entrada', 'Hora Salida', 'Red']],
      body: tabla,
      theme: 'grid',
      headStyles: { fillColor: [10, 35, 81] },  // #0a2351
      didDrawPage: () => dibujarFooterPDF(doc)
    })
    doc.save('Asistencia_Charallave.pdf')
  }

  // --- UI sub-componentes ---------------------------------------------
  const KpiCard = ({ icono: Icono, titulo, valor, color, sub }) => (
    <div style={{
      flex: 1, minWidth: isMobile ? '100%' : 180,
      backgroundColor: 'white', padding: '20px', borderRadius: '14px',
      boxShadow: '0 4px 15px rgba(0,0,0,0.05)',
      border: '1px solid #f1f5f9',
      display: 'flex', alignItems: 'center', gap: '15px'
    }}>
      <div style={{ padding: '12px', backgroundColor: color + '22', borderRadius: '10px', color }}>
        <Icono size={24} />
      </div>
      <div>
        <p style={{ margin: 0, color: '#64748b', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{titulo}</p>
        <h3 style={{ margin: 0, color: '#0f172a', fontSize: '26px', fontWeight: '900', lineHeight: 1.1 }}>{valor}</h3>
        {sub && <p style={{ margin: '2px 0 0 0', color: '#94a3b8', fontSize: '11px', fontWeight: '600' }}>{sub}</p>}
      </div>
    </div>
  )

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: isMobile ? '5px' : '0' }}>

      {/* HEADER */}
      <div style={{ marginBottom: '24px', background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', padding: '25px', borderRadius: '16px', color: 'white', boxShadow: '0 10px 20px -5px rgba(2, 132, 199, 0.4)', display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', gap: '15px' }}>
        <div>
          <h1 style={{ margin: '0 0 5px 0', fontSize: isMobile ? '22px' : '28px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Activity size={32} /> Panel Ejecutivo en Vivo
          </h1>
          <p style={{ margin: 0, fontSize: '14px', opacity: 0.9 }}>
            Alcaldia de Charallave - Municipio Cristobal Rojas
            {ultimoRefresh && <span style={{ marginLeft: 12, opacity: 0.7 }}>(Actualizado {fmtRefresh(ultimoRefresh)})</span>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', width: isMobile ? '100%' : 'auto' }}>
          <button onClick={cargarTodo} disabled={cargando} style={{ flex: isMobile ? 1 : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px 16px', backgroundColor: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '10px', cursor: cargando ? 'wait' : 'pointer', opacity: cargando ? 0.6 : 1, fontWeight: 'bold' }}>
            <RefreshCw size={16} /> {cargando ? 'Actualizando...' : 'Actualizar'}
          </button>
          <button onClick={generarPDF} style={{ flex: isMobile ? 1 : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px 16px', backgroundColor: 'white', color: '#0369a1', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: '900', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
            <Download size={18} /> Exportar PDF
          </button>
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: '20px', padding: '12px 16px', borderRadius: '10px', backgroundColor: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', fontWeight: 600 }}>
          ⛔ {error}
        </div>
      )}

      {/* KPIs */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', marginBottom: '24px' }}>
        <KpiCard icono={Users} titulo="Personal total" valor={kpis?.total_empleados ?? '--'} color="#0284c7" />
        <KpiCard icono={UserCheck} titulo="Marcaron hoy" valor={kpis?.marcaron_entrada ?? '--'} color="#16a34a" />
        <KpiCard icono={Activity} titulo="Dentro ahora" valor={kpis?.dentro_ahora ?? '--'} color="#f59e0b" sub="con entrada sin salida" />
        <KpiCard icono={CheckCircle} titulo="Jornada finalizada" valor={kpis?.jornada_finalizada ?? '--'} color="#475569" />
        <KpiCard icono={FileWarning} titulo="Justif. pendientes" valor={kpis?.justificaciones_pendientes ?? '--'} color="#dc2626" />
        <KpiCard icono={AlertTriangle} titulo="Alertas abiertas" valor={kpis?.alertas_abiertas ?? '--'} color="#7c3aed" />
      </div>

      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '20px', marginBottom: '24px' }}>

        {/* GRAFICA 7 DIAS */}
        <div style={{ flex: 2, backgroundColor: 'white', padding: '22px', borderRadius: '14px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9' }}>
          <h3 style={{ margin: '0 0 18px 0', color: '#1e293b', fontSize: '15px', fontWeight: '800', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrendingUp size={18} color="#0284c7" /> Marcas ultimos 7 dias
          </h3>
          <div style={{ display: 'flex', alignItems: 'flex-end', height: 140, gap: 8 }}>
            {serieSemana.map(p => (
              <div key={p.fecha} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#475569' }}>{p.cantidad}</div>
                <div
                  title={`${p.fecha}: ${p.cantidad} marcas`}
                  style={{
                    width: '100%',
                    height: `${(p.cantidad / maxBarra) * 100}%`,
                    minHeight: 4,
                    background: 'linear-gradient(180deg, #38bdf8 0%, #0369a1 100%)',
                    borderRadius: '6px 6px 0 0'
                  }}
                />
                <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>{p.fecha.substring(5)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ALERTAS */}
        <div style={{ flex: 1, backgroundColor: 'white', padding: '22px', borderRadius: '14px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9' }}>
          <h3 style={{ margin: '0 0 18px 0', color: '#1e293b', fontSize: '15px', fontWeight: '800', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={18} color="#dc2626" /> Alertas abiertas
          </h3>
          {alertas.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: 13, fontWeight: 600 }}>Sin alertas activas.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 200, overflowY: 'auto' }}>
              {alertas.map(a => (
                <div key={a.id} style={{ padding: '10px 12px', borderRadius: 8, backgroundColor: '#fef3c7', borderLeft: '3px solid #f59e0b' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#b45309', textTransform: 'uppercase' }}>{a.tipo}</div>
                  <div style={{ fontSize: 13, color: '#1e293b', fontWeight: 600 }}>{a.mensaje}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{a.empleado_id}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* CUMPLEAÑOS PROXIMOS */}
      {cumpleaneros.length > 0 && (
        <div style={{ marginBottom: '24px', backgroundColor: 'white', padding: '22px', borderRadius: '14px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9' }}>
          <h3 style={{ margin: '0 0 18px 0', color: '#1e293b', fontSize: '15px', fontWeight: '800', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Cake size={18} color="#ec4899" /> Próximos cumpleaños ({cumpleaneros.length})
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
            {cumpleaneros.map(c => {
              const esHoy = c.dias_hasta_cumple === 0
              return (
                <div key={c.cedula} style={{ padding: 12, borderRadius: 10, backgroundColor: esHoy ? '#fce7f3' : '#f8fafc', borderLeft: `3px solid ${esHoy ? '#ec4899' : '#cbd5e1'}`, display: 'flex', alignItems: 'center', gap: 10 }}>
                  {c.foto_url ? (
                    <img src={c.foto_url} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: esHoy ? '#ec4899' : '#94a3b8', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 13 }}>
                      {(c.nombres || '?').charAt(0)}{(c.apellidos || '').charAt(0)}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 13, color: '#1e293b' }}>{c.nombres} {c.apellidos}</div>
                    <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>{c.departamento || ''} · {c.fecha_cumpleanos}</div>
                  </div>
                  <div style={{ padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 800, backgroundColor: esHoy ? '#ec4899' : '#e2e8f0', color: esHoy ? 'white' : '#475569' }}>
                    {esHoy ? 'HOY 🎂' : c.dias_hasta_cumple === 1 ? 'Mañana' : `En ${c.dias_hasta_cumple}d`}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* PRESENCIA EN VIVO */}
      <div style={{ marginBottom: '24px', backgroundColor: 'white', padding: '22px', borderRadius: '14px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9' }}>
        <h3 style={{ margin: '0 0 18px 0', color: '#1e293b', fontSize: '15px', fontWeight: '800', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Activity size={18} color="#16a34a" /> Personal en sede ahora ({presencia.length})
        </h3>
        {presencia.length === 0 ? (
          <p style={{ color: '#94a3b8', fontSize: 13, fontWeight: 600 }}>No hay empleados con entrada pendiente de salida.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
            {presencia.map(p => (
              <div key={p.empleado_id} style={{ padding: 12, borderRadius: 10, backgroundColor: '#f0fdf4', borderLeft: '3px solid #16a34a', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: '#16a34a', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 13 }}>
                  {(p.nombres || '?').charAt(0)}{(p.apellidos || '').charAt(0)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 13, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nombres} {p.apellidos}</div>
                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>{p.empleado_id} · Entro {fmtHora(p.hora_entrada)}</div>
                </div>
                <a href={`https://www.google.com/maps?q=${p.latitud},${p.longitud}`} target="_blank" rel="noreferrer" style={{ padding: '4px 8px', borderRadius: 6, backgroundColor: '#dcfce7', color: '#15803d', textDecoration: 'none', fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <MapPin size={12} /> GPS
                </a>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* TABLA DE REGISTROS */}
      <div style={{ backgroundColor: 'white', borderRadius: '14px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', overflow: 'hidden', border: '1px solid #f1f5f9' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #f1f5f9', backgroundColor: '#fafafa', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, color: '#1e293b', fontSize: '14px', fontWeight: '800', textTransform: 'uppercase' }}>Bitacora (ultimos 7 dias)</h3>
          <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>{registros.length} registros</span>
        </div>
        <div style={{ width: '100%', overflowX: 'auto', maxHeight: 420 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', color: '#475569', fontSize: '11px', textTransform: 'uppercase', fontWeight: '800', position: 'sticky', top: 0 }}>
                <th style={{ padding: '12px 16px', borderBottom: '2px solid #e2e8f0' }}>Cedula</th>
                <th style={{ padding: '12px 16px', borderBottom: '2px solid #e2e8f0' }}>Fecha</th>
                <th style={{ padding: '12px 16px', borderBottom: '2px solid #e2e8f0' }}>Entrada</th>
                <th style={{ padding: '12px 16px', borderBottom: '2px solid #e2e8f0' }}>Salida</th>
                <th style={{ padding: '12px 16px', borderBottom: '2px solid #e2e8f0', textAlign: 'center' }}>GPS</th>
              </tr>
            </thead>
            <tbody>
              {registros.length === 0 && (
                <tr><td colSpan="5" style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontWeight: 600 }}>Sin marcas en los ultimos 7 dias.</td></tr>
              )}
              {registros.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9', fontSize: '13px' }}>
                  <td style={{ padding: '12px 16px', fontWeight: '800', color: '#0369a1' }}>{r.empleado_id}</td>
                  <td style={{ padding: '12px 16px', color: '#64748b', fontWeight: '600' }}>{r.fecha}</td>
                  <td style={{ padding: '12px 16px', fontWeight: '700', color: '#0f172a' }}>{fmtHora(r.hora_entrada)}</td>
                  <td style={{ padding: '12px 16px' }}>
                    {r.hora_salida ? (
                      <span style={{ color: '#16a34a', fontWeight: '800', display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#dcfce7', padding: '3px 10px', borderRadius: '20px', fontSize: '11px' }}><CheckCircle size={12} />{fmtHora(r.hora_salida)}</span>
                    ) : (
                      <span style={{ color: '#dc2626', fontWeight: '800', backgroundColor: '#fee2e2', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', textTransform: 'uppercase' }}>Pendiente</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <a href={`https://www.google.com/maps?q=${r.latitud},${r.longitud}`} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', backgroundColor: '#f1f5f9', color: '#0284c7', borderRadius: '8px', textDecoration: 'none', fontWeight: '700', fontSize: '11px' }}><MapPin size={12} /></a>
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
