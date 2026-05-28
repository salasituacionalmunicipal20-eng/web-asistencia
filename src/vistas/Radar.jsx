import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '../supabase'
import { Radio, RefreshCcw, Wifi, WifiOff, Smartphone, Building2 } from 'lucide-react'
import { useTema } from '../theme/ThemeProvider'
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

/**
 * Componente helper que dispara invalidateSize() del mapa de Leaflet cuando
 * el contenedor cambia de tamaño o cuando hacemos resize de ventana. Sin
 * esto, si el mapa se monta dentro de un padre con display:none o con un
 * tamaño no definido todavía, queda cortado (mosaicos en gris).
 */
function MapaAutoResize({ trigger }) {
  const map = useMap()
  useEffect(() => {
    // Pequeño delay para que el DOM termine de pintar
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

// Fix de los iconos por defecto de Leaflet (Webpack no los resuelve solo)
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
})

// Icono personalizado por estado del empleado
const iconoPersona = (estado) => {
  const color =
    estado === 'ACTIVO'       ? '#16a34a' :
    estado === 'INACTIVO'     ? '#f59e0b' :
    estado === 'DESCONECTADO' ? '#dc2626' : '#94a3b8'
  return L.divIcon({
    className: 'radar-pin',
    html: `<div style="background:${color};width:18px;height:18px;border-radius:50%;border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9]
  })
}

const iconoSede = L.divIcon({
  className: 'sede-pin',
  html: '<div style="background:#0a2351;color:white;width:26px;height:26px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:14px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4)">🏢</div>',
  iconSize: [26, 26],
  iconAnchor: [13, 13]
})

/**
 * Mapa en tiempo real con la posicion de cada empleado.
 * Solo accesible para carlos.linares.es@gmail.com (gate en App.jsx).
 *
 * Los datos vienen de `vw_radar_empleados` que junta empleados + ultima
 * ubicacion reportada + sede asignada. Refresca cada 30 segundos via polling.
 */
export default function Radar() {
  const { t } = useTema()
  const [empleados, setEmpleados] = useState([])
  const [error, setError] = useState('')
  const [ultimaActualizacion, setUltimaActualizacion] = useState(null)
  const [seleccionado, setSeleccionado] = useState(null)
  const timerRef = useRef(null)

  const cargar = async () => {
    setError('')
    const { data, error: err } = await supabase
      .from('vw_radar_empleados')
      .select('*')
      .order('apellidos', { ascending: true })
    if (err) {
      setError(err.message + ' — ¿corriste el SQL RADAR_UBICACIONES.sql?')
    } else {
      setEmpleados(data || [])
      setUltimaActualizacion(new Date())
    }
  }

  useEffect(() => {
    cargar()
    timerRef.current = setInterval(cargar, 30_000)
    return () => clearInterval(timerRef.current)
  }, [])

  // Sedes unicas (PSUV, CASA PROGRAMADOR)
  const sedes = useMemo(() => {
    const map = new Map()
    empleados.forEach(e => {
      if (e.sede_asignada && e.sede_lat && e.sede_lon && !map.has(e.sede_asignada)) {
        map.set(e.sede_asignada, {
          nombre: e.sede_asignada,
          lat: e.sede_lat,
          lon: e.sede_lon,
          radio: e.sede_radio || 25
        })
      }
    })
    return Array.from(map.values())
  }, [empleados])

  // Empleados con ubicacion reportada (los demas no se ponen en el mapa)
  const empleadosEnMapa = useMemo(() =>
    empleados.filter(e => e.latitud != null && e.longitud != null),
    [empleados]
  )

  // KPIs
  const resumen = useMemo(() => ({
    total: empleados.length,
    activo: empleados.filter(e => e.estado_radar === 'ACTIVO').length,
    inactivo: empleados.filter(e => e.estado_radar === 'INACTIVO').length,
    desconectado: empleados.filter(e => e.estado_radar === 'DESCONECTADO').length,
    nunca: empleados.filter(e => e.estado_radar === 'NUNCA_REPORTO').length
  }), [empleados])

  // Centro del mapa: si hay sede, usar la primera. Sino, Charallave.
  const centro = sedes[0] ? [sedes[0].lat, sedes[0].lon] : [10.227, -66.858]

  const colorBadge = (estado) => ({
    ACTIVO:       { bg: t.exitoBg, fg: t.exito },
    INACTIVO:     { bg: t.avisoBg, fg: t.aviso },
    DESCONECTADO: { bg: t.errorBg, fg: t.error },
    NUNCA_REPORTO:{ bg: t.bgInput, fg: t.textSoft }
  }[estado] || { bg: t.bgInput, fg: t.textSoft })

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: 0 }}>
      <div style={{ marginBottom: 18, background: 'linear-gradient(135deg, #0ea5e9 0%, #0c4a6e 100%)', padding: 22, borderRadius: 14, color: 'white' }}>
        <h1 style={{ margin: '0 0 4px 0', fontSize: 24, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Radio size={28} /> Radar en tiempo real
        </h1>
        <p style={{ margin: 0, fontSize: 13, opacity: 0.9 }}>
          Mapa con la última ubicación conocida de cada empleado. Cada teléfono reporta cada ~15 min (cuando está logueado).
          Actualizado: <strong>{ultimaActualizacion ? ultimaActualizacion.toLocaleTimeString('es-VE') : '—'}</strong>
        </p>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 14 }}>
        {[
          { label: 'Total',         valor: resumen.total,        color: t.primario, icon: Smartphone },
          { label: 'Activos (<30m)', valor: resumen.activo,       color: t.exito,    icon: Wifi },
          { label: 'Inactivos (<2h)', valor: resumen.inactivo,    color: t.aviso,    icon: WifiOff },
          { label: 'Desconectados',  valor: resumen.desconectado, color: t.error,    icon: WifiOff },
          { label: 'Nunca reportó',  valor: resumen.nunca,        color: t.textSoft, icon: WifiOff }
        ].map(k => {
          const Ic = k.icon
          return (
            <div key={k.label} style={{ background: t.bgPanel, padding: 12, borderRadius: 10, border: `1px solid ${t.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: t.textSoft, fontWeight: 800, textTransform: 'uppercase' }}>
                <Ic size={12} color={k.color} /> {k.label}
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: k.color, marginTop: 2 }}>{k.valor}</div>
            </div>
          )
        })}
      </div>

      {error && (
        <div style={{ padding: 12, borderRadius: 8, background: t.errorBg, color: t.error, borderLeft: `3px solid ${t.error}`, marginBottom: 12, fontSize: 13, fontWeight: 700 }}>
          ⚠️ {error}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 13, color: t.textSoft, fontWeight: 600 }}>
          {empleadosEnMapa.length} de {empleados.length} empleados visibles en el mapa
        </div>
        <button onClick={cargar}
          style={{ padding: '6px 12px', backgroundColor: t.primario, color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 800, fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <RefreshCcw size={12} /> Refrescar
        </button>
      </div>

      {/* MAPA */}
      <div style={{ backgroundColor: t.bgPanel, borderRadius: 14, border: `1px solid ${t.border}`, overflow: 'hidden', height: '70vh', minHeight: 480, position: 'relative' }}>
        <MapContainer center={centro} zoom={16} style={{ height: '100%', width: '100%' }} scrollWheelZoom={true}>
          <MapaAutoResize trigger={empleados.length} />
          <TileLayer
            attribution='&copy; OpenStreetMap'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Sedes con su geofence */}
          {sedes.map(s => (
            <div key={s.nombre}>
              <Marker position={[s.lat, s.lon]} icon={iconoSede}>
                <Popup>
                  <div style={{ fontWeight: 800 }}><Building2 size={14} style={{ verticalAlign: 'middle' }} /> {s.nombre}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Geofence: {s.radio}m</div>
                </Popup>
              </Marker>
              <Circle
                center={[s.lat, s.lon]}
                radius={s.radio}
                pathOptions={{ color: '#0a2351', fillColor: '#0a2351', fillOpacity: 0.1, weight: 2, dashArray: '4 4' }}
              />
            </div>
          ))}

          {/* Empleados */}
          {empleadosEnMapa.map(e => (
            <Marker
              key={e.cedula}
              position={[e.latitud, e.longitud]}
              icon={iconoPersona(e.estado_radar)}
              eventHandlers={{ click: () => setSeleccionado(e.cedula) }}
            >
              <Popup>
                <div style={{ minWidth: 200 }}>
                  <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4 }}>{e.nombres} {e.apellidos}</div>
                  <div style={{ fontSize: 11, color: '#475569', marginBottom: 8 }}>{e.cedula} · {e.departamento}</div>
                  <div style={{ fontSize: 12 }}>
                    <strong>Sede asignada:</strong> {e.sede_asignada || 'Sin asignar'}<br/>
                    <strong>Estado:</strong> <span style={{ color: colorBadge(e.estado_radar).fg, fontWeight: 700 }}>{e.estado_radar}</span><br/>
                    <strong>Último reporte:</strong> {e.minutos_desde_ping != null ? `hace ${Math.round(e.minutos_desde_ping)} min` : 'nunca'}<br/>
                    {e.accuracy_metros && <><strong>Precisión GPS:</strong> ±{Math.round(e.accuracy_metros)} m<br/></>}
                    {e.bateria_pct != null && <><strong>Batería:</strong> {e.bateria_pct}%<br/></>}
                    <strong>App:</strong> {e.app_en_foreground ? 'abierta' : 'en background'}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Lista debajo del mapa */}
      <div style={{ marginTop: 14, backgroundColor: t.bgPanel, borderRadius: 10, border: `1px solid ${t.border}`, overflow: 'hidden' }}>
        <div style={{ padding: 12, borderBottom: `1px solid ${t.borderSoft}`, fontSize: 12, fontWeight: 800, color: t.textSoft, textTransform: 'uppercase', background: t.bgTableHead }}>
          Todos los empleados ({empleados.length}) — incluye los que aún no reportan ubicación
        </div>
        <div style={{ maxHeight: 280, overflowY: 'auto' }}>
          {empleados.map(e => {
            const c = colorBadge(e.estado_radar)
            return (
              <div key={e.cedula}
                style={{ padding: '10px 14px', borderBottom: `1px solid ${t.borderSoft}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, cursor: 'pointer', background: seleccionado === e.cedula ? t.primarioBg : 'transparent' }}
                onClick={() => setSeleccionado(e.cedula)}>
                <div>
                  <div style={{ fontWeight: 700, color: t.text }}>{e.nombres} {e.apellidos}</div>
                  <div style={{ fontSize: 11, color: t.textSoft }}>{e.cedula} · {e.departamento}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 800, backgroundColor: c.bg, color: c.fg, textTransform: 'uppercase' }}>
                    {e.estado_radar.replace('_', ' ')}
                  </span>
                  <div style={{ fontSize: 10, color: t.textMuted, marginTop: 2 }}>
                    {e.minutos_desde_ping != null ? `hace ${Math.round(e.minutos_desde_ping)} min` : 'nunca reportó'}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
