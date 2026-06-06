import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { supabase } from '../supabase'
import { useTema } from '../theme/ThemeProvider'
import { useIsMobile } from '../hooks/useIsMobile'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { RefreshCcw, Filter, CheckCircle, XCircle, Clock, MapPin, Share2, FileDown, Search, X, Image as ImageIcon } from 'lucide-react'
import jsPDF from 'jspdf'

// Limites para no traer todo el universo por accidente
const CAP_REPORTES = 2000
const RANGO_DIAS_DEFAULT = 30
const CHARALLAVE_CENTRO = [10.2406, -66.8530]

const toNum = (v) => { const n = typeof v === "number" ? v : parseFloat(v); return Number.isFinite(n) ? n : null }
const normalizar = (r) => r ? ({ ...r, gps_lat: toNum(r.gps_lat), gps_lng: toNum(r.gps_lng) }) : r

// ---------- Helpers Leaflet ----------
function MapaAutoResize({ trigger }) {
  const map = useMap()
  useEffect(() => {
    const id = setTimeout(() => map.invalidateSize(), 50)
    return () => clearTimeout(id)
  }, [trigger, map])
  useEffect(() => {
    const onResize = () => map.invalidateSize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [map])
  return null
}

function FitBoundsAReportes({ reportes }) {
  const map = useMap()
  const fpRef = useRef("")
  useEffect(() => {
    const conGps = reportes.filter(r => Number.isFinite(r.gps_lat) && Number.isFinite(r.gps_lng))
    const fp = conGps.map(r => r.id).sort().join(",")
    if (fp === fpRef.current) return
    fpRef.current = fp
    if (conGps.length === 0) return
    if (conGps.length === 1) { map.setView([conGps[0].gps_lat, conGps[0].gps_lng], 15); return }
    const bounds = L.latLngBounds(conGps.map(r => [r.gps_lat, r.gps_lng]))
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 })
  }, [reportes, map])
  return null
}

const iconoPorEstado = (estado) => {
  const color =
    estado === 'validado'  ? '#16a34a' :
    estado === 'rechazado' ? '#dc2626' :
                             '#f59e0b' // pendiente
  return L.divIcon({
    className: 'cuadrilla-pin',
    html: `<div style="background:${color};width:20px;height:20px;border-radius:50%;border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  })
}

// ---------- Imagen con transformacion + lazy ----------
// Si la URL es de Supabase storage, le metemos width/quality usando el endpoint
// /render/image/public para que el navegador no descargue 5MB por miniatura.
function urlConTransform(url, width = 400, quality = 70) {
  if (!url) return ''
  try {
    if (url.includes('/storage/v1/object/public/')) {
      return url.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/') +
        (url.includes('?') ? '&' : '?') + `width=${width}&quality=${quality}&resize=cover`
    }
  } catch {}
  return url
}

// ---------- Helper estado ----------
const estadoLabel = (e) => e === 'validado' ? 'Validado' : e === 'rechazado' ? 'Rechazado' : 'Pendiente'
const estadoColor = (e) => e === 'validado' ? '#16a34a' : e === 'rechazado' ? '#dc2626' : '#f59e0b'

export default function Cuadrillas({ rolUsuario, correoUsuario }) {
  const { t } = useTema()
  const isMobile = useIsMobile()

  const [reportes, setReportes] = useState([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [refresco, setRefresco] = useState(0)

  // Filtros
  const [filtroEstado, setFiltroEstado] = useState('pendiente')
  const [filtroBusqueda, setFiltroBusqueda] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [rangoDias, setRangoDias] = useState(RANGO_DIAS_DEFAULT)
  const [tipos, setTipos] = useState([])
  const [errorTipos, setErrorTipos] = useState(false)

  // Modal de detalle + accion
  const [reporteSel, setReporteSel] = useState(null)
  const [tabMobile, setTabMobile] = useState('lista') // 'mapa' | 'lista'
  const [observacionesRechazo, setObservacionesRechazo] = useState('')
  const [accionEnCurso, setAccionEnCurso] = useState(false)

  // mute pattern: cuando hagamos un upsert local (validar/rechazar) no queremos
  // que el realtime sobrescriba lo que ya escribimos optimisticamente.
  const muteRef = useRef(new Set())

  const rangoRef = useRef(rangoDias)
  useEffect(() => { rangoRef.current = rangoDias }, [rangoDias])

  // ---------- Carga inicial + tipos ----------
  const cargarReportes = useCallback(async () => {
    setCargando(true)
    setError('')
    try {
      const desde = new Date()
      desde.setDate(desde.getDate() - rangoDias)
      const { data, error: errQ } = await supabase
        .from('reportes_cuadrilla')
        .select('*')
        .gte('created_at', desde.toISOString())
        .order('created_at', { ascending: false })
        .limit(CAP_REPORTES)
      if (errQ) throw errQ
      setReportes((data || []).map(normalizar))
    } catch (e) {
      console.error('[Cuadrillas] error cargando:', e)
      setError(`No se pudieron cargar los reportes: ${e.message || e}`)
    } finally {
      setCargando(false)
    }
  }, [rangoDias])

  const cargarTipos = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('tipos_actividad_cuadrilla')
        .select('codigo, nombre')
        .order('nombre')
      setTipos(data || [])
      setErrorTipos(false)
    } catch (e) {
      console.warn('[Cuadrillas] tipos no disponibles:', e?.message || e)
      setErrorTipos(true)
    }
  }, [])

  useEffect(() => { cargarReportes() }, [cargarReportes, refresco])
  useEffect(() => { cargarTipos() }, [cargarTipos])
  useEffect(() => { setObservacionesRechazo("") }, [reporteSel?.id])

  // ---------- Realtime: INSERT/UPDATE/DELETE en reportes_cuadrilla ----------
  useEffect(() => {
    const canal = supabase
      .channel('reportes-cuadrilla-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reportes_cuadrilla' }, (payload) => {
        const fila = payload.new || payload.old
        if (!fila?.id) return
        // si nosotros mismos acabamos de mutar este id, ignorar 1 echo
        if (muteRef.current.has(fila.id)) {
          muteRef.current.delete(fila.id)
          return
        }
        if (payload.eventType === "INSERT" && payload.new?.created_at) {
          const limite = Date.now() - rangoRef.current * 86400000
          if (new Date(payload.new.created_at).getTime() < limite) return
        }
        setReportes(prev => {
          if (payload.eventType === 'DELETE') {
            return prev.filter(r => r.id !== fila.id)
          }
          const idx = prev.findIndex(r => r.id === fila.id)
          if (idx === -1) {
            // INSERT nuevo: lo metemos al principio
            return [normalizar(payload.new), ...prev].slice(0, CAP_REPORTES)
          }
          // UPDATE: reemplaza
          const copia = prev.slice()
          copia[idx] = { ...copia[idx], ...normalizar(payload.new) }
          return copia
        })
        if (payload.eventType === "DELETE") {
          setReporteSel(prev => prev && prev.id === fila.id ? null : prev)
        } else if (payload.new?.id) {
          const norm = normalizar(payload.new)
          setReporteSel(prev => prev && prev.id === norm.id ? { ...prev, ...norm } : prev)
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [])

  // ---------- Filtrado client-side ----------
  const reportesFiltrados = useMemo(() => {
    const q = filtroBusqueda.trim().toLowerCase()
    return reportes.filter(r => {
      if (filtroEstado !== 'todos' && r.estado !== filtroEstado) return false
      if (filtroTipo && r.tipo_actividad_codigo !== filtroTipo) return false
      if (q) {
        const hay = [r.trabajador_cedula, r.direccion, r.descripcion, r.tipo_actividad_codigo]
          .filter(Boolean).join(' ').toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [reportes, filtroEstado, filtroTipo, filtroBusqueda])

  // ---------- Resumen ----------
  const conteos = useMemo(() => {
    const c = { pendiente: 0, validado: 0, rechazado: 0 }
    for (const r of reportes) c[r.estado] = (c[r.estado] || 0) + 1
    return c
  }, [reportes])

  // ---------- Acciones: validar / rechazar ----------
  async function ejecutarValidar(reporte) {
    if (!reporte?.id) return
    const estadoPrev = reporte.estado
    if (!window.confirm(`¿Validar este reporte de ${reporte.trabajador_cedula}?`)) return
    setAccionEnCurso(true)
    muteRef.current.add(reporte.id)
    // optimista
    setReportes(prev => prev.map(r => r.id === reporte.id ? { ...r, estado: 'validado', validado_por: correoUsuario, fecha_validacion: new Date().toISOString() } : r))
    setReporteSel(prev => prev && prev.id === reporte.id ? { ...prev, estado: 'validado' } : prev)
    try {
      const { error: errR } = await supabase.rpc('validar_reporte_cuadrilla', { p_reporte_id: reporte.id })
      if (errR) throw errR
      // disparar notificacion al trabajador (best-effort)
      try {
        await supabase.functions.invoke('enviar-notif-fcm-cuadrilla', {
          body: { reporte_id: reporte.id, tipo_evento: 'REPORTE_VALIDADO' }
        })
      } catch (e) { console.warn('[Cuadrillas] FCM falló:', e) }
    } catch (e) {
      console.error('[Cuadrillas] validar fallo:', e)
      alert(`No se pudo validar: ${e.message || e}`)
      // refrescar para deshacer optimismo
      setReporteSel(prev => prev && prev.id === reporte.id ? { ...prev, estado: estadoPrev } : prev)
      muteRef.current.delete(reporte.id)
      setRefresco(x => x + 1)
    } finally {
      setAccionEnCurso(false)
    }
  }

  async function ejecutarRechazar(reporte) {
    if (!reporte?.id) return
    const estadoPrev = reporte.estado
    const motivo = observacionesRechazo.trim()
    if (motivo.length < 5) {
      alert('Por favor explica brevemente el motivo del rechazo (mín. 5 caracteres).')
      return
    }
    if (!window.confirm(`¿Rechazar este reporte? Se notificará al trabajador.`)) return
    setAccionEnCurso(true)
    muteRef.current.add(reporte.id)
    setReportes(prev => prev.map(r => r.id === reporte.id ? { ...r, estado: 'rechazado', validado_por: correoUsuario, observaciones_validacion: motivo, fecha_validacion: new Date().toISOString() } : r))
    setReporteSel(prev => prev && prev.id === reporte.id ? { ...prev, estado: 'rechazado', observaciones_validacion: motivo } : prev)
    try {
      const { error: errR } = await supabase.rpc('rechazar_reporte_cuadrilla', { p_reporte_id: reporte.id, p_motivo: motivo })
      if (errR) throw errR
      try {
        await supabase.functions.invoke('enviar-notif-fcm-cuadrilla', {
          body: { reporte_id: reporte.id, tipo_evento: 'REPORTE_RECHAZADO' }
        })
      } catch (e) { console.warn('[Cuadrillas] FCM falló:', e) }
      setObservacionesRechazo('')
    } catch (e) {
      console.error('[Cuadrillas] rechazar fallo:', e)
      alert(`No se pudo rechazar: ${e.message || e}`)
      setReporteSel(prev => prev && prev.id === reporte.id ? { ...prev, estado: estadoPrev } : prev)
      muteRef.current.delete(reporte.id)
      setRefresco(x => x + 1)
    } finally {
      setAccionEnCurso(false)
    }
  }

  // ---------- PDF (sin mapa estatico, link a Google Maps) ----------
  function exportarPDF(reporte) {
    const doc = new jsPDF()
    const m = 15
    let y = 20
    doc.setFontSize(16)
    doc.text('Reporte de Cuadrilla', m, y); y += 6
    doc.setLineWidth(0.5); doc.line(m, y, 200 - m, y); y += 6
    doc.setFontSize(10)
    const linea = (label, val) => { doc.text(`${label}: ${val ?? '-'}`, m, y); y += 6 }
    linea('ID', reporte.id)
    linea('Estado', estadoLabel(reporte.estado))
    linea('Cedula trabajador', reporte.trabajador_cedula)
    linea('Tipo', reporte.tipo_actividad_codigo)
    linea('Direccion', reporte.direccion)
    linea('Descripcion', (reporte.descripcion || '').slice(0, 300))
    linea('Creado', reporte.created_at ? new Date(reporte.created_at).toLocaleString('es-VE') : '-')
    if (reporte.validado_por) linea('Revisado por', reporte.validado_por)
    if (reporte.fecha_validacion) linea('Fecha revision', new Date(reporte.fecha_validacion).toLocaleString('es-VE'))
    if (reporte.observaciones_validacion) linea('Observaciones', reporte.observaciones_validacion)
    if (Number.isFinite(reporte.gps_lat) && Number.isFinite(reporte.gps_lng)) {
      linea('GPS', `${reporte.gps_lat.toFixed(6)}, ${reporte.gps_lng.toFixed(6)}`)
      const url = `https://www.google.com/maps?q=${reporte.gps_lat},${reporte.gps_lng}`
      doc.setTextColor(0, 0, 200); doc.textWithLink('Abrir en Google Maps', m, y, { url }); y += 8
      doc.setTextColor(0, 0, 0)
    }
    if (reporte.foto_antes_url) { doc.text('Foto ANTES: ', m, y); doc.setTextColor(0, 0, 200); doc.textWithLink(reporte.foto_antes_url, m + 30, y, { url: reporte.foto_antes_url }); doc.setTextColor(0, 0, 0); y += 6 }
    if (reporte.foto_despues_url) { doc.text('Foto DESPUES: ', m, y); doc.setTextColor(0, 0, 200); doc.textWithLink(reporte.foto_despues_url, m + 30, y, { url: reporte.foto_despues_url }); doc.setTextColor(0, 0, 0); y += 6 }
    doc.save(`reporte-cuadrilla-${reporte.id?.slice(0, 8)}.pdf`)
  }

  function compartirWhatsApp(reporte) {
    const partes = [
      `*Reporte de Cuadrilla*`,
      `Estado: ${estadoLabel(reporte.estado)}`,
      `Tipo: ${reporte.tipo_actividad_codigo}`,
      `Direccion: ${reporte.direccion ?? '-'}`,
      reporte.descripcion ? `Descripcion: ${reporte.descripcion}` : null,
      Number.isFinite(reporte.gps_lat) && Number.isFinite(reporte.gps_lng) ? `Mapa: https://www.google.com/maps?q=${reporte.gps_lat},${reporte.gps_lng}` : null
    ].filter(Boolean).join('\n')
    const url = `https://wa.me/?text=${encodeURIComponent(partes)}`
    window.open(url, '_blank', 'noopener')
  }

  // ---------- Render ----------
  return (
    <div style={{ padding: isMobile ? 12 : 20, color: t.text, minHeight: 'calc(100vh - 60px)' }}>
      {/* Header + resumen */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: isMobile ? 20 : 26, color: t.text, display: 'flex', alignItems: 'center', gap: 10 }}>
            Reportes de Cuadrilla
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: t.textMuted }}>
            Validacion de trabajos de campo (bacheo, limpieza, alumbrado, etc).
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <KPI etiqueta="Pendientes" valor={conteos.pendiente} color="#f59e0b" />
          <KPI etiqueta="Validados" valor={conteos.validado} color="#16a34a" />
          <KPI etiqueta="Rechazados" valor={conteos.rechazado} color="#dc2626" />
          <button onClick={() => setRefresco(x => x + 1)} disabled={cargando} style={btnSecundario(t)}>
            <RefreshCcw size={16} style={{ marginRight: 6, animation: cargando ? 'spin 1s linear infinite' : 'none' }} />
            Recargar
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ background: t.bgCard, border: `1px solid ${t.borde}`, borderRadius: 8, padding: 12, marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Filter size={16} color={t.textMuted} />
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} style={inputEstilo(t)}>
          <option value="pendiente">Pendientes</option>
          <option value="validado">Validados</option>
          <option value="rechazado">Rechazados</option>
          <option value="todos">Todos</option>
        </select>
        <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} style={inputEstilo(t)}>
          <option value="">Todos los tipos</option>
          {tipos.map(tp => <option key={tp.codigo} value={tp.codigo}>{tp.nombre}</option>)}
        </select>
        {errorTipos && <span style={{ fontSize: 11, color: "#dc2626" }}>(tipos no cargados)</span>}
        <select value={rangoDias} onChange={e => setRangoDias(Number(e.target.value))} style={inputEstilo(t)}>
          <option value={7}>Ultimos 7 dias</option>
          <option value={30}>Ultimos 30 dias</option>
          <option value={90}>Ultimos 90 dias</option>
          <option value={365}>Ultimo ano</option>
        </select>
        <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: t.textMuted }} />
          <input
            placeholder="Buscar cedula, direccion, descripcion..."
            value={filtroBusqueda}
            onChange={e => setFiltroBusqueda(e.target.value)}
            style={{ ...inputEstilo(t), paddingLeft: 28, width: '100%' }}
          />
        </div>
      </div>

      {error && <div style={{ background: '#fee2e2', color: '#991b1b', padding: 10, borderRadius: 6, marginBottom: 12 }}>{error}</div>}

      {/* Mobile: tabs */}
      {isMobile && (
        <div style={{ display: 'flex', gap: 0, marginBottom: 10, border: `1px solid ${t.borde}`, borderRadius: 6, overflow: 'hidden' }}>
          <button onClick={() => setTabMobile('lista')} style={tabBtn(t, tabMobile === 'lista')}>Lista ({reportesFiltrados.length})</button>
          <button onClick={() => setTabMobile('mapa')} style={tabBtn(t, tabMobile === 'mapa')}>Mapa</button>
        </div>
      )}

      {/* Cuerpo: layout 60/40 desktop, tabs mobile */}
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 12, minHeight: isMobile ? 'auto' : 'calc(100vh - 280px)' }}>
        {/* Mapa: 60% en desktop */}
        <div style={{
          flex: isMobile ? 'none' : '0 0 60%',
          display: isMobile ? (tabMobile === 'mapa' ? 'block' : 'none') : 'block',
          height: isMobile ? 'calc(100vh - 320px)' : 'auto',
          minHeight: 400,
          border: `1px solid ${t.borde}`,
          borderRadius: 8,
          overflow: 'hidden'
        }}>
          <MapContainer center={CHARALLAVE_CENTRO} zoom={13} style={{ height: '100%', width: '100%', minHeight: 400 }} scrollWheelZoom={true}>
            <TileLayer
              attribution='&copy; OpenStreetMap'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapaAutoResize trigger={tabMobile + ':' + reportesFiltrados.length} />
            <FitBoundsAReportes reportes={reportesFiltrados} />
            {reportesFiltrados
              .filter(r => Number.isFinite(r.gps_lat) && Number.isFinite(r.gps_lng))
              .map(r => (
                <Marker key={r.id} position={[r.gps_lat, r.gps_lng]} icon={iconoPorEstado(r.estado)}>
                  <Popup>
                    <div style={{ minWidth: 200 }}>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>{r.tipo_actividad_codigo}</div>
                      <div style={{ fontSize: 12, marginBottom: 6 }}>{r.direccion}</div>
                      <div style={{ fontSize: 11, color: '#666' }}>Cedula: {r.trabajador_cedula}</div>
                      <button onClick={() => setReporteSel(r)} style={{ marginTop: 6, background: '#0033a1', color: 'white', border: 'none', padding: '4px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>
                        Ver detalle
                      </button>
                    </div>
                  </Popup>
                </Marker>
              ))}
          </MapContainer>
        </div>

        {/* Lista: 40% en desktop */}
        <div style={{
          flex: isMobile ? 'none' : '1',
          display: isMobile ? (tabMobile === 'lista' ? 'block' : 'none') : 'block',
          overflowY: 'auto',
          maxHeight: isMobile ? 'none' : 'calc(100vh - 280px)'
        }}>
          {cargando ? (
            <div style={{ padding: 30, textAlign: 'center', color: t.textMuted }}>Cargando reportes...</div>
          ) : reportesFiltrados.length === 0 ? (
            <div style={{ padding: 30, textAlign: 'center', color: t.textMuted, border: `1px dashed ${t.borde}`, borderRadius: 8 }}>
              No hay reportes con los filtros actuales.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {reportesFiltrados.map(r => (
                <TarjetaReporte key={r.id} reporte={r} onClick={() => setReporteSel(r)} t={t} />
              ))}
              {reportes.length >= CAP_REPORTES && (
                <div style={{ padding: 10, fontSize: 12, color: t.textMuted, textAlign: 'center' }}>
                  Se cargaron los primeros {CAP_REPORTES} reportes del rango ({reportesFiltrados.length} pasan el filtro). Acota el rango si necesitas mas antiguos.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal de detalle */}
      {reporteSel && (
        <ModalDetalle
          reporte={reporteSel}
          t={t}
          isMobile={isMobile}
          accionEnCurso={accionEnCurso}
          observacionesRechazo={observacionesRechazo}
          setObservacionesRechazo={setObservacionesRechazo}
          onCerrar={() => { setReporteSel(null); setObservacionesRechazo('') }}
          onValidar={() => ejecutarValidar(reporteSel)}
          onRechazar={() => ejecutarRechazar(reporteSel)}
          onPDF={() => exportarPDF(reporteSel)}
          onWhatsApp={() => compartirWhatsApp(reporteSel)}
        />
      )}

      <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// ---------- Subcomponentes ----------
function KPI({ etiqueta, valor, color }) {
  return (
    <div style={{ background: color, color: 'white', padding: '6px 12px', borderRadius: 6, fontSize: 13, minWidth: 100, textAlign: 'center' }}>
      <div style={{ fontSize: 18, fontWeight: 700 }}>{valor}</div>
      <div style={{ fontSize: 11, opacity: 0.9 }}>{etiqueta}</div>
    </div>
  )
}

function TarjetaReporte({ reporte, onClick, t }) {
  const url = urlConTransform(reporte.foto_antes_url || reporte.foto_despues_url, 160, 60)
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        gap: 10,
        padding: 10,
        background: t.bgCard,
        border: `1px solid ${t.borde}`,
        borderLeft: `4px solid ${estadoColor(reporte.estado)}`,
        borderRadius: 6,
        cursor: 'pointer',
        transition: 'background 0.15s'
      }}
      onMouseEnter={e => e.currentTarget.style.background = t.bgHover || t.bgCard}
      onMouseLeave={e => e.currentTarget.style.background = t.bgCard}
    >
      {url ? (
        <img loading="lazy" src={url} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 4, background: '#eee' }} />
      ) : (
        <div style={{ width: 64, height: 64, borderRadius: 4, background: t.borde, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.textMuted }}>
          <ImageIcon size={20} />
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
          <strong style={{ fontSize: 14, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {reporte.tipo_actividad_codigo || 'Sin tipo'}
          </strong>
          <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 3, background: estadoColor(reporte.estado), color: 'white', whiteSpace: 'nowrap' }}>
            {estadoLabel(reporte.estado)}
          </span>
        </div>
        <div style={{ fontSize: 12, color: t.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <MapPin size={11} style={{ verticalAlign: 'middle', marginRight: 2 }} />
          {reporte.direccion || 'Sin direccion'}
        </div>
        <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2, display: 'flex', justifyContent: 'space-between' }}>
          <span>C.I {reporte.trabajador_cedula}</span>
          <span><Clock size={10} style={{ verticalAlign: 'middle' }} /> {reporte.created_at ? new Date(reporte.created_at).toLocaleString('es-VE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}</span>
        </div>
      </div>
    </div>
  )
}

function ModalDetalle({ reporte, t, isMobile, accionEnCurso, observacionesRechazo, setObservacionesRechazo, onCerrar, onValidar, onRechazar, onPDF, onWhatsApp }) {
  const esPendiente = reporte.estado === 'pendiente'
  return (
    <div onMouseDown={e => { if (e.target === e.currentTarget) onCerrar() }} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 2000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobile ? 0 : 20
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: t.bgCard, color: t.text, borderRadius: isMobile ? 0 : 10,
        width: isMobile ? '100%' : '90%', maxWidth: 800, maxHeight: isMobile ? '100%' : '92vh',
        overflowY: 'auto', boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
      }}>
        {/* Header */}
        <div style={{ padding: 14, borderBottom: `1px solid ${t.borde}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: estadoColor(reporte.estado), color: 'white' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18 }}>{reporte.tipo_actividad_codigo}</h2>
            <small>{estadoLabel(reporte.estado)} · {reporte.created_at ? new Date(reporte.created_at).toLocaleString('es-VE') : '-'}</small>
          </div>
          <button onClick={onCerrar} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', padding: 8, borderRadius: 4, cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        {/* Cuerpo */}
        <div style={{ padding: 16 }}>
          {/* Fotos */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <Foto titulo="ANTES" url={reporte.foto_antes_url} t={t} />
            <Foto titulo="DESPUES" url={reporte.foto_despues_url} t={t} />
          </div>

          {/* Detalle */}
          <Detalle label="Cedula" valor={reporte.trabajador_cedula} t={t} />
          <Detalle label="Direccion" valor={reporte.direccion} t={t} />
          {reporte.descripcion && <Detalle label="Descripcion" valor={reporte.descripcion} t={t} />}
          {Number.isFinite(reporte.gps_lat) && Number.isFinite(reporte.gps_lng) && (
            <div style={{ padding: '8px 0', borderBottom: `1px solid ${t.borde}`, fontSize: 13 }}>
              <strong style={{ color: t.textMuted }}>Ubicacion GPS:</strong>{' '}
              <a href={`https://www.google.com/maps?q=${reporte.gps_lat},${reporte.gps_lng}`} target="_blank" rel="noopener noreferrer" style={{ color: '#0033a1' }}>
                Abrir en Google Maps ({reporte.gps_lat.toFixed(5)}, {reporte.gps_lng.toFixed(5)})
              </a>
            </div>
          )}
          {reporte.validado_por && <Detalle label="Revisado por" valor={reporte.validado_por} t={t} />}
          {reporte.estado === "rechazado"
            ? <Detalle label="Motivo del rechazo" valor={reporte.observaciones_validacion || "(sin motivo registrado)"} t={t} />
            : reporte.observaciones_validacion && <Detalle label="Observaciones" valor={reporte.observaciones_validacion} t={t} />}

          {/* Bloque de rechazo (solo si pendiente) */}
          {esPendiente && (
            <div style={{ marginTop: 14, padding: 10, background: t.bgHover || '#fff8e1', borderRadius: 6, border: `1px solid ${t.borde}` }}>
              <label style={{ fontSize: 12, color: t.textMuted, display: 'block', marginBottom: 4 }}>
                Si rechazas, indica el motivo (visible para el trabajador):
              </label>
              <textarea
                rows={2}
                value={observacionesRechazo}
                onChange={e => setObservacionesRechazo(e.target.value)}
                placeholder="Ej: la foto no muestra claramente el trabajo terminado..."
                style={{ width: '100%', padding: 6, borderRadius: 4, border: `1px solid ${t.borde}`, background: t.bgCard, color: t.text, fontSize: 13, boxSizing: 'border-box' }}
              />
            </div>
          )}
        </div>

        {/* Acciones */}
        <div style={{ padding: 12, borderTop: `1px solid ${t.borde}`, display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button onClick={onPDF} style={btnSecundario(t)}><FileDown size={14} style={{ marginRight: 6 }} />PDF</button>
          <button onClick={onWhatsApp} style={btnSecundario(t)}><Share2 size={14} style={{ marginRight: 6 }} />WhatsApp</button>
          {esPendiente && (
            <>
              <button disabled={accionEnCurso} onClick={onRechazar} style={{ background: '#dc2626', color: 'white', border: 'none', padding: '8px 14px', borderRadius: 4, cursor: accionEnCurso ? 'wait' : 'pointer', fontSize: 13 }}>
                <XCircle size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />Rechazar
              </button>
              <button disabled={accionEnCurso} onClick={onValidar} style={{ background: '#16a34a', color: 'white', border: 'none', padding: '8px 14px', borderRadius: 4, cursor: accionEnCurso ? 'wait' : 'pointer', fontSize: 13 }}>
                <CheckCircle size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />Validar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Foto({ titulo, url, t }) {
  if (!url) {
    return (
      <div style={{ border: `1px dashed ${t.borde}`, borderRadius: 6, padding: 30, textAlign: 'center', color: t.textMuted, fontSize: 12 }}>
        <ImageIcon size={24} /><br />{titulo} no disponible
      </div>
    )
  }
  return (
    <div>
      <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 4, fontWeight: 600, letterSpacing: 1 }}>{titulo}</div>
      <a href={url} target="_blank" rel="noopener noreferrer">
        <img src={urlConTransform(url, 800, 80)} alt={titulo} loading="lazy" style={{ width: '100%', borderRadius: 6, border: `1px solid ${t.borde}`, display: 'block' }} />
      </a>
    </div>
  )
}

function Detalle({ label, valor, t }) {
  return (
    <div style={{ padding: '8px 0', borderBottom: `1px solid ${t.borde}`, fontSize: 13 }}>
      <strong style={{ color: t.textMuted }}>{label}:</strong> {valor || '-'}
    </div>
  )
}

// ---------- Estilos compactos ----------
const inputEstilo = (t) => ({
  padding: '6px 10px', borderRadius: 4, border: `1px solid ${t.borde}`,
  background: t.bgCard, color: t.text, fontSize: 13
})
const btnSecundario = (t) => ({
  background: t.bgCard, color: t.text, border: `1px solid ${t.borde}`,
  padding: '6px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 13,
  display: 'inline-flex', alignItems: 'center'
})
const tabBtn = (t, active) => ({
  flex: 1, padding: 10, border: 'none', background: active ? '#0033a1' : t.bgCard,
  color: active ? 'white' : t.text, cursor: 'pointer', fontSize: 13
})
