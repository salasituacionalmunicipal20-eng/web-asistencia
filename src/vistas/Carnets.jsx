import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase'
import { IdCard, Search, Download, Loader2, CheckSquare, Square, ImageOff } from 'lucide-react'
import { jsPDF } from 'jspdf'
import QRCode from 'qrcode'
import { useTema } from '../theme/ThemeProvider'

// ============================================================================
// Carnets.jsx — generador de carnets institucionales en PDF listos para
// impresion en plastico (CR80 / formato tarjeta de credito).
// ----------------------------------------------------------------------------
// Flujo:
//   1. Lista empleados activos con buscador + selector multiple.
//   2. Muestra preview en pantalla (frente + reverso) del primer seleccionado.
//   3. Boton "Generar PDF" produce un PDF con 2 paginas por empleado
//      (frente, reverso), tamano CR80 + 3mm bleed por lado = 91.6 x 60 mm.
//   4. Imprenta de plastico abre el PDF y lo manda directo a la maquina.
// ----------------------------------------------------------------------------
// Datos por carnet:
//   FRENTE: foto (o iniciales), nombre completo, cargo, departamento, cedula.
//   REVERSO: QR con la cedula, horario, sede asignada, contacto institucional.
// ============================================================================

// Dimensiones del carnet en milimetros (CR80 con bleed institucional)
const CARD_W = 85.6   // mm (medida fisica del plastico final)
const CARD_H = 54     // mm
const BLEED = 3       // mm (sobrante que se corta despues de imprimir)
const PAGE_W = CARD_W + BLEED * 2  // 91.6
const PAGE_H = CARD_H + BLEED * 2  // 60

// Paleta institucional (matching App.jsx)
const NAVY = '#0033a1'
const NAVY_DARK = '#001a5c'
const GOLD = '#ffcc00'
const TEXT_DARK = '#0f172a'
const TEXT_MUTED = '#64748b'

export default function Carnets() {
  const { t } = useTema()
  const [empleados, setEmpleados] = useState([])
  const [oficinas, setOficinas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [seleccionados, setSeleccionados] = useState(new Set())
  const [previewIdx, setPreviewIdx] = useState(0)
  const [generandoPDF, setGenerandoPDF] = useState(false)

  // Carga empleados + oficinas en paralelo. Solo empleados activos (los
  // inactivos no deberian tener carnet vigente).
  useEffect(() => {
    let cancelado = false
    async function cargar() {
      setCargando(true)
      setError('')
      try {
        const [emp, ofi] = await Promise.all([
          supabase
            .from('empleados')
            .select('id, cedula, nombres, apellidos, departamento, cargo, hora_entrada, hora_salida, foto_url, oficina_id, fecha_cumpleanos, activo')
            .order('apellidos', { ascending: true }),
          supabase.from('oficinas').select('id, nombre, direccion, latitud, longitud'),
        ])
        if (emp.error) throw emp.error
        if (ofi.error) throw ofi.error
        if (cancelado) return
        const empleadosActivos = (emp.data || []).filter(e => e.activo !== false)
        setEmpleados(empleadosActivos)
        setOficinas(ofi.data || [])
      } catch (e) {
        if (!cancelado) setError(e.message || 'No se pudieron cargar los empleados')
      } finally {
        if (!cancelado) setCargando(false)
      }
    }
    cargar()
    return () => { cancelado = true }
  }, [])

  const oficinaPorId = useMemo(() => {
    const m = new Map()
    oficinas.forEach(o => m.set(o.id, o))
    return m
  }, [oficinas])

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return empleados
    return empleados.filter(e => {
      const blob = `${e.nombres || ''} ${e.apellidos || ''} ${e.cedula || ''} ${e.cargo || ''} ${e.departamento || ''}`.toLowerCase()
      return blob.includes(q)
    })
  }, [empleados, busqueda])

  const toggleSeleccion = (id) => {
    setSeleccionados(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const seleccionarTodos = () => {
    const todosVisiblesSeleccionados = filtrados.every(e => seleccionados.has(e.id))
    if (todosVisiblesSeleccionados) {
      // deseleccionar los visibles
      setSeleccionados(prev => {
        const next = new Set(prev)
        filtrados.forEach(e => next.delete(e.id))
        return next
      })
    } else {
      // seleccionar todos los visibles
      setSeleccionados(prev => {
        const next = new Set(prev)
        filtrados.forEach(e => next.add(e.id))
        return next
      })
    }
  }

  const empleadoPreview = filtrados[previewIdx] || filtrados[0] || null

  const handleGenerarPDF = async () => {
    const seleccion = empleados.filter(e => seleccionados.has(e.id))
    if (seleccion.length === 0) {
      alert('Selecciona al menos un empleado para generar carnets.')
      return
    }
    setGenerandoPDF(true)
    try {
      await generarPDFCarnets(seleccion, oficinaPorId)
    } catch (e) {
      alert('Error generando PDF: ' + (e.message || e))
      console.error(e)
    } finally {
      setGenerandoPDF(false)
    }
  }

  // ─── Estilos del listado ─────────────────────────────────────────────────
  const headerCardStyle = {
    background: 'linear-gradient(135deg, #001a5c 0%, #0033a1 100%)',
    color: 'white',
    padding: '20px 24px',
    borderRadius: 12,
    borderLeft: `4px solid ${GOLD}`,
    marginBottom: 18,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  }

  return (
    <div style={{ color: t.text }}>
      <div style={headerCardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <IdCard size={32} color={GOLD} />
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, letterSpacing: 0.3 }}>Carnets institucionales</h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#cbd5e1', fontWeight: 600 }}>
              Genera carnets en PDF listos para imprenta de plástico — formato CR80 (85.6 × 54 mm + 3mm de bleed).
            </p>
          </div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700 }}>
          {seleccionados.size} seleccionado{seleccionados.size === 1 ? '' : 's'}
        </div>
      </div>

      {error && (
        <div style={{ background: '#fee2e2', borderLeft: '3px solid #dc2626', color: '#991b1b', padding: '10px 14px', borderRadius: 6, marginBottom: 14, fontWeight: 600, fontSize: 13 }}>
          ⛔ {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: 18, alignItems: 'start' }}>
        {/* ─── LISTA EMPLEADOS ──────────────────────────────────────────── */}
        <div style={{ background: t.card, border: `1px solid ${t.cardBorder}`, borderRadius: 12, padding: 16 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
              <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: TEXT_MUTED, pointerEvents: 'none' }} />
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre, cédula, cargo..."
                style={{ width: '100%', padding: '9px 10px 9px 32px', border: `1px solid ${t.cardBorder}`, borderRadius: 8, fontSize: 13, color: t.text, background: t.bgInput || '#f8fafc', boxSizing: 'border-box', outline: 'none' }}
              />
            </div>
            <button onClick={seleccionarTodos} style={btnSecundario(t)}>
              {filtrados.length > 0 && filtrados.every(e => seleccionados.has(e.id))
                ? '✗ Quitar todos'
                : '✓ Seleccionar todos'}
            </button>
            <button
              onClick={handleGenerarPDF}
              disabled={generandoPDF || seleccionados.size === 0}
              style={btnPrincipal(generandoPDF || seleccionados.size === 0)}
            >
              {generandoPDF
                ? <><Loader2 size={16} className="spin" /> Generando...</>
                : <><Download size={16} /> Generar PDF ({seleccionados.size})</>
              }
            </button>
          </div>

          <div style={{ maxHeight: 520, overflowY: 'auto', border: `1px solid ${t.cardBorder}`, borderRadius: 8 }}>
            {cargando ? (
              <div style={{ padding: 40, textAlign: 'center', color: TEXT_MUTED, fontSize: 13 }}>
                <Loader2 size={20} className="spin" style={{ display: 'inline-block', marginRight: 6 }} />
                Cargando empleados...
              </div>
            ) : filtrados.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: TEXT_MUTED, fontSize: 13 }}>
                {empleados.length === 0 ? 'No hay empleados activos registrados.' : 'Sin coincidencias para esa búsqueda.'}
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <tbody>
                  {filtrados.map((emp, idx) => {
                    const seleccionado = seleccionados.has(emp.id)
                    const enPreview = empleadoPreview?.id === emp.id
                    return (
                      <tr
                        key={emp.id}
                        onClick={() => setPreviewIdx(idx)}
                        style={{
                          cursor: 'pointer',
                          background: enPreview ? (t.bgHover || '#eff6ff') : 'transparent',
                          borderBottom: `1px solid ${t.cardBorder}`,
                        }}
                      >
                        <td style={{ padding: '8px 10px', width: 30 }}>
                          <span
                            onClick={(e) => { e.stopPropagation(); toggleSeleccion(emp.id) }}
                            style={{ display: 'inline-flex', cursor: 'pointer', color: seleccionado ? '#0284c7' : TEXT_MUTED }}
                          >
                            {seleccionado ? <CheckSquare size={18} /> : <Square size={18} />}
                          </span>
                        </td>
                        <td style={{ padding: '8px 10px', width: 40 }}>
                          <MiniFoto emp={emp} />
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          <div style={{ fontWeight: 700, color: t.text }}>{emp.nombres} {emp.apellidos}</div>
                          <div style={{ fontSize: 11, color: TEXT_MUTED, fontWeight: 600 }}>
                            {emp.cedula} · {emp.cargo || '—'}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* ─── PREVIEW ─────────────────────────────────────────────────── */}
        <div style={{ position: 'sticky', top: 20 }}>
          <div style={{ background: t.card, border: `1px solid ${t.cardBorder}`, borderRadius: 12, padding: 16 }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 800, color: t.text, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Vista previa
            </h3>
            <p style={{ margin: '0 0 14px', fontSize: 12, color: TEXT_MUTED, fontWeight: 600 }}>
              Selecciona un empleado de la lista para ver su carnet
            </p>

            {!empleadoPreview ? (
              <div style={{ padding: 30, textAlign: 'center', color: TEXT_MUTED, fontSize: 12, border: `1px dashed ${t.cardBorder}`, borderRadius: 8 }}>
                Sin selección.
              </div>
            ) : (
              <>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: TEXT_MUTED, marginBottom: 6, letterSpacing: 0.8, textTransform: 'uppercase' }}>Frente</div>
                  <CarnetFrente emp={empleadoPreview} />
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 800, color: TEXT_MUTED, marginBottom: 6, letterSpacing: 0.8, textTransform: 'uppercase' }}>Reverso</div>
                  <CarnetReverso emp={empleadoPreview} oficina={oficinaPorId.get(empleadoPreview.oficina_id)} />
                </div>
              </>
            )}
          </div>

          <div style={{ background: '#fef3c7', borderLeft: `3px solid ${GOLD}`, color: '#78350f', padding: '10px 12px', borderRadius: 6, marginTop: 12, fontSize: 11.5, fontWeight: 600, lineHeight: 1.4 }}>
            <strong>FORMATO:</strong> CR80 (85.6 × 54 mm) + 3 mm de bleed.
            Cada empleado seleccionado ocupa 2 páginas del PDF (frente + reverso).
            La imprenta corta los 3 mm sobrantes despues de imprimir.
          </div>
        </div>
      </div>

      <style>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

// ─── Estilos compartidos ──────────────────────────────────────────────────
const btnPrincipal = (disabled) => ({
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px',
  background: disabled ? '#94a3b8' : '#0284c7', color: 'white',
  border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 800,
  cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1,
})

const btnSecundario = (t) => ({
  padding: '9px 12px', background: 'transparent', color: t.text,
  border: `1px solid ${t.cardBorder}`, borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
})

// ─── Helpers de identidad visual ──────────────────────────────────────────
function getIniciales(emp) {
  const n = (emp.nombres || '').trim().split(/\s+/)[0] || ''
  const a = (emp.apellidos || '').trim().split(/\s+/)[0] || ''
  return ((n[0] || '') + (a[0] || '')).toUpperCase() || '?'
}

function fmtHora(h) {
  if (!h) return '—'
  // viene como "HH:MM:SS" desde supabase
  return String(h).substring(0, 5)
}

// Formatea cedula a estilo oficial venezolano: V-12.345.678
// Acepta inputs como "V12345678", "v-12345678", "12345678", "E12.345.678".
function fmtCedula(ced) {
  if (!ced) return '—'
  const raw = String(ced).trim().toUpperCase()
  const prefijo = raw.match(/^[VEJPG]/)?.[0] || 'V'
  const digits = raw.replace(/[^0-9]/g, '')
  if (!digits) return raw
  // Inserta puntos cada 3 digitos desde la derecha
  const conPuntos = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${prefijo}-${conPuntos}`
}

// Fecha de emision = hoy. Fecha de vencimiento = hoy + 2 anios.
// Formato ISO YYYY-MM-DD para impresion estable (no depende del locale del PC).
function hoyIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function vencimientoIso(anios = 2) {
  const d = new Date()
  d.setFullYear(d.getFullYear() + anios)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Convierte fecha ISO a formato legible DD/MM/YYYY para mostrar en el carnet.
function fmtFechaCarnet(iso) {
  if (!iso || iso.length < 10) return '—'
  const [y, m, d] = iso.substring(0, 10).split('-')
  return `${d}/${m}/${y}`
}

// Carga el logo institucional (cristobal-rojas.png) como dataURL para embeber
// en el PDF. Se cachea modulo-level para no re-fetchear en cada generacion.
let _logoInstitucionalCache = null
async function loadLogoInstitucional() {
  if (_logoInstitucionalCache) return _logoInstitucionalCache
  try {
    const dataUrl = await fetchImageAsDataURL(new URL('logos/cristobal-rojas.png', window.location.href).toString())
    _logoInstitucionalCache = dataUrl
    return dataUrl
  } catch {
    return null
  }
}

function MiniFoto({ emp }) {
  const [error, setError] = useState(false)
  if (emp.foto_url && !error) {
    return (
      <img
        src={emp.foto_url}
        alt=""
        onError={() => setError(true)}
        style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', border: `1px solid ${NAVY}` }}
      />
    )
  }
  return (
    <div style={{ width: 32, height: 32, borderRadius: '50%', background: NAVY, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12 }}>
      {getIniciales(emp)}
    </div>
  )
}

// ─── PREVIEW HTML del carnet (lo que se ve en pantalla) ──────────────────
// Disenado para REPLICAR exactamente lo que renderiza jsPDF en el PDF, asi
// el cliente aprueba lo que va a recibir impreso. Reglas profesionales
// aplicadas (basadas en investigacion de FIPS 201 / cedula colombiana /
// PIV / corporate badges):
//   - Sin gradientes (los carnets oficiales usan colores planos)
//   - Sin box-shadow (es elemento decorativo de UI web, no de credencial)
//   - Foto sin esquinas redondeadas, ratio 3:4 (estandar pasaporte)
//   - Apellidos en linea superior UPPERCASE (estilo cedula venezolana)
//   - Cedula formato V-XX.XXX.XXX en peso bold
//   - Logo institucional real (cristobal-rojas.png) en el header
//   - Reverso: terminos de uso + contacto + fechas + firma
function CarnetFrenteHeader() {
  return (
    <div style={{
      background: NAVY, color: 'white', padding: '5px 8px',
      display: 'flex', alignItems: 'center', gap: 8,
      borderBottom: `1.5px solid ${GOLD}`,
      height: '21%',  // ~11mm de los 54mm del CR80
      boxSizing: 'border-box',
    }}>
      <img
        src="logos/cristobal-rojas.png"
        alt=""
        style={{ height: '100%', width: 'auto', objectFit: 'contain' }}
      />
      <div style={{ flex: 1, minWidth: 0, lineHeight: 1.05 }}>
        <div style={{ fontSize: 7.5, fontWeight: 900, letterSpacing: 0.3, textTransform: 'uppercase' }}>
          Alcaldía del Municipio
        </div>
        <div style={{ fontSize: 8.5, fontWeight: 900, letterSpacing: 0.3, textTransform: 'uppercase' }}>
          Cristóbal Rojas
        </div>
        <div style={{ fontSize: 5.5, fontWeight: 700, color: GOLD, letterSpacing: 0.5, marginTop: 1, textTransform: 'uppercase' }}>
          Charallave — Estado Miranda
        </div>
      </div>
    </div>
  )
}

function CarnetReversoHeader() {
  return (
    <div style={{
      background: NAVY, color: 'white', padding: '4px 8px',
      borderBottom: `1.5px solid ${GOLD}`,
      textAlign: 'center',
      boxSizing: 'border-box',
    }}>
      <div style={{ fontSize: 7.5, fontWeight: 900, letterSpacing: 1.2, textTransform: 'uppercase' }}>
        Carnet de Identificación Institucional
      </div>
    </div>
  )
}

function CarnetFrente({ emp }) {
  const apellidos = (emp.apellidos || '—').toUpperCase()
  const nombres = (emp.nombres || '—').toUpperCase()
  return (
    <div style={cardShell}>
      <CarnetFrenteHeader />
      <div style={{ flex: 1, display: 'flex', padding: '7px 8px', gap: 8, minHeight: 0 }}>
        {/* Columna foto */}
        <FotoPreview emp={emp} />
        {/* Columna datos */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 5.5, color: TEXT_MUTED, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 0 }}>
              Apellidos
            </div>
            <div style={{ fontSize: 11, fontWeight: 900, color: TEXT_DARK, lineHeight: 1.05, letterSpacing: 0.2, marginBottom: 3 }}>
              {apellidos}
            </div>
            <div style={{ fontSize: 5.5, color: TEXT_MUTED, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase' }}>
              Nombres
            </div>
            <div style={{ fontSize: 9, fontWeight: 800, color: TEXT_DARK, lineHeight: 1.1, letterSpacing: 0.15 }}>
              {nombres}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 5.5, color: TEXT_MUTED, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase' }}>
              Cargo
            </div>
            <div style={{ fontSize: 8, fontWeight: 700, color: TEXT_DARK, lineHeight: 1.1, marginBottom: 2 }}>
              {emp.cargo || '—'}
            </div>
            <div style={{ fontSize: 5.5, color: TEXT_MUTED, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase' }}>
              Departamento
            </div>
            <div style={{ fontSize: 7, fontWeight: 600, color: TEXT_DARK, lineHeight: 1.1 }}>
              {emp.departamento || '—'}
            </div>
          </div>
        </div>
      </div>
      {/* Barra cedula inferior — color solido, sin gradient */}
      <div style={cedulaBar}>
        <div>
          <div style={{ fontSize: 5.5, color: GOLD, fontWeight: 800, letterSpacing: 0.6, lineHeight: 1 }}>
            CÉDULA DE IDENTIDAD
          </div>
          <div style={{ fontSize: 11, fontWeight: 900, color: 'white', letterSpacing: 1.2, fontFamily: 'Consolas, "Roboto Mono", monospace', marginTop: 1 }}>
            {fmtCedula(emp.cedula)}
          </div>
        </div>
      </div>
    </div>
  )
}

function CarnetReverso({ emp, oficina }) {
  const [qrUrl, setQrUrl] = useState('')
  useEffect(() => {
    // Error correction H (30%) — sobrevive abrasion y arrugas en plastico
    QRCode.toDataURL(emp.cedula || '', { width: 200, margin: 1, errorCorrectionLevel: 'H' })
      .then(setQrUrl)
      .catch(() => setQrUrl(''))
  }, [emp.cedula])

  return (
    <div style={cardShell}>
      <CarnetReversoHeader />
      <div style={{ flex: 1, padding: '6px 8px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 0 }}>
        {/* Terminos de uso */}
        <div style={{ fontSize: 6, color: TEXT_DARK, lineHeight: 1.35 }}>
          <div style={{ fontWeight: 800, color: NAVY, letterSpacing: 0.5, marginBottom: 2 }}>CONDICIONES DE USO</div>
          <div>1. Este carnet es propiedad de la Alcaldía de Cristóbal Rojas.</div>
          <div>2. Su uso es personal e intransferible. El uso indebido será sancionado.</div>
          <div>3. En caso de extravío, notifique de inmediato a Recursos Humanos.</div>
          <div>4. Debe ser portado visible durante la jornada laboral.</div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          {/* Bloque info */}
          <div style={{ flex: 1, fontSize: 6, color: TEXT_DARK, lineHeight: 1.3 }}>
            <div style={{ fontWeight: 800, color: NAVY, letterSpacing: 0.5 }}>EN CASO DE EXTRAVÍO DEVOLVER A:</div>
            <div>Alcaldía de Cristóbal Rojas — Recursos Humanos</div>
            <div>{oficina?.direccion || 'Charallave, Estado Miranda'}</div>
            <div style={{ marginTop: 4, display: 'flex', gap: 10 }}>
              <div>
                <div style={{ fontWeight: 800, color: NAVY }}>EMISIÓN</div>
                <div style={{ fontFamily: 'Consolas, monospace' }}>{fmtFechaCarnet(hoyIso())}</div>
              </div>
              <div>
                <div style={{ fontWeight: 800, color: NAVY }}>VENCE</div>
                <div style={{ fontFamily: 'Consolas, monospace' }}>{fmtFechaCarnet(vencimientoIso())}</div>
              </div>
            </div>
            <div style={{ marginTop: 4 }}>
              <div style={{ fontWeight: 800, color: NAVY }}>HORARIO</div>
              <div style={{ fontFamily: 'Consolas, monospace' }}>{fmtHora(emp.hora_entrada)} — {fmtHora(emp.hora_salida)}</div>
            </div>
          </div>
          {/* QR */}
          {qrUrl ? (
            <img src={qrUrl} alt="" style={{ width: 50, height: 50, background: 'white', flexShrink: 0 }} />
          ) : (
            <div style={{ width: 50, height: 50, background: '#f1f5f9', flexShrink: 0 }} />
          )}
        </div>
      </div>
      {/* Cedula repetida abajo */}
      <div style={cedulaBarReverso}>
        <span style={{ fontSize: 5.5, color: GOLD, fontWeight: 800, marginRight: 5 }}>C.I.</span>
        <span style={{ fontSize: 8.5, fontWeight: 900, color: 'white', letterSpacing: 0.8, fontFamily: 'Consolas, monospace' }}>
          {fmtCedula(emp.cedula)}
        </span>
      </div>
    </div>
  )
}

// Foto preview — proporcion 3:4 (estandar pasaporte/cedula), sin border-radius,
// borde fino navy. Si no hay foto_url se muestra silueta gris neutra (NO el
// placeholder con iniciales coloridas que es patron amateur).
function FotoPreview({ emp }) {
  const [error, setError] = useState(false)
  const tieneFoto = emp.foto_url && !error
  // Proporcion 3:4 — ancho ~60px, alto 80px (24mm x 32mm en el PDF)
  return (
    <div style={{
      width: 60, height: 80, flexShrink: 0,
      background: '#e2e8f0',
      border: `1px solid ${NAVY}`,
      overflow: 'hidden',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {tieneFoto ? (
        <img
          src={emp.foto_url}
          alt=""
          onError={() => setError(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="#94a3b8">
          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
        </svg>
      )}
    </div>
  )
}

// Shell del carnet — proporcion CR80, sin border-radius extremo, sin shadow
// llamativo (sutil para indicar que es una tarjeta fisica, no decorativo).
const cardShell = {
  width: 290,
  aspectRatio: '85.6 / 54',
  background: 'white',
  borderRadius: 3,
  border: `1px solid #cbd5e1`,
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  color: TEXT_DARK,
}

const cedulaBar = {
  background: NAVY,
  color: 'white',
  padding: '4px 8px',
  borderTop: `1.5px solid ${GOLD}`,
}

const cedulaBarReverso = {
  background: NAVY,
  color: 'white',
  padding: '3px 8px',
  display: 'flex',
  alignItems: 'baseline',
  borderTop: `1.5px solid ${GOLD}`,
}

// ============================================================================
// GENERACION DEL PDF
// ----------------------------------------------------------------------------
// Por cada empleado seleccionado se generan 2 paginas del PDF (frente +
// reverso). Tamano de pagina = CR80 + 3mm bleed por lado. Toda referencia
// a coordenadas es en milimetros desde la esquina superior izquierda
// (jsPDF convencion estandar). El "safe area" empieza en BLEED y termina
// en BLEED + CARD_W (o CARD_H).
// ============================================================================
async function generarPDFCarnets(empleados, oficinaPorId) {
  const doc = new jsPDF({
    unit: 'mm',
    format: [PAGE_W, PAGE_H],
    orientation: 'landscape',
    compress: true,
  })

  // Pre-carga logo institucional (una vez para todo el PDF)
  const logoInstitucional = await loadLogoInstitucional()

  // Pre-carga fotos de empleados
  const fotosPorId = new Map()
  await Promise.all(empleados.map(async (emp) => {
    if (!emp.foto_url) return
    try {
      const dataUrl = await fetchImageAsDataURL(emp.foto_url)
      fotosPorId.set(emp.id, dataUrl)
    } catch {
      // Si la foto no carga (CORS, 404, etc.) seguimos con placeholder.
    }
  }))

  for (let i = 0; i < empleados.length; i++) {
    const emp = empleados[i]
    const foto = fotosPorId.get(emp.id) || null

    if (i > 0) doc.addPage([PAGE_W, PAGE_H], 'landscape')
    dibujarFrente(doc, emp, foto, logoInstitucional)

    doc.addPage([PAGE_W, PAGE_H], 'landscape')
    await dibujarReverso(doc, emp, oficinaPorId.get(emp.oficina_id), logoInstitucional)
  }

  const filename = empleados.length === 1
    ? `Carnet_${empleados[0].cedula || empleados[0].id}.pdf`
    : `Carnets_Alcaldia_${empleados.length}_empleados.pdf`
  doc.save(filename)
}

// Fetch + canvas para convertir cualquier URL de imagen en un dataURL PNG
// que jsPDF pueda embeber. Funciona con URLs publicas de Supabase Storage.
function fetchImageAsDataURL(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        // Re-escala a max 400px de lado para mantener el PDF liviano
        const maxLado = 400
        const ratio = Math.min(1, maxLado / Math.max(img.width, img.height))
        canvas.width = Math.round(img.width * ratio)
        canvas.height = Math.round(img.height * ratio)
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.9))
      } catch (e) { reject(e) }
    }
    img.onerror = reject
    img.src = url
  })
}

function dibujarFrente(doc, emp, fotoDataUrl, logoInstitucional) {
  // ─── Fondo blanco (incluyendo bleed) ─────────────────────────────────
  doc.setFillColor(255, 255, 255)
  doc.rect(0, 0, PAGE_W, PAGE_H, 'F')

  // ─── Encabezado institucional ───────────────────────────────────────
  // Color SOLIDO navy (no gradient — los carnets oficiales usan colores
  // planos; los gradientes son patron amateur).
  // Banda 11mm alto (~20% del CR80) + linea dorada delgada de acento.
  const HEADER_H = 11
  doc.setFillColor(0, 51, 161) // NAVY #0033a1
  doc.rect(BLEED, BLEED, CARD_W, HEADER_H, 'F')
  doc.setFillColor(255, 204, 0) // GOLD
  doc.rect(BLEED, BLEED + HEADER_H, CARD_W, 0.6, 'F')

  // Logo institucional a la izquierda del header
  if (logoInstitucional) {
    try {
      doc.addImage(logoInstitucional, 'PNG', BLEED + 1.5, BLEED + 1, 9, 9)
    } catch {}
  }

  // Texto institucional
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.text('ALCALDÍA DEL MUNICIPIO', BLEED + 12, BLEED + 4)
  doc.setFontSize(8)
  doc.text('CRISTÓBAL ROJAS', BLEED + 12, BLEED + 7.3)
  doc.setFontSize(5)
  doc.setTextColor(255, 204, 0)
  doc.text('CHARALLAVE — ESTADO MIRANDA', BLEED + 12, BLEED + 10)

  // ─── Foto 3:4 (24x32mm = ratio 0.75, estandar pasaporte/cedula) ─────
  // Posicion: tercio izquierdo del cuerpo, sin esquinas redondeadas.
  const fotoX = BLEED + 3
  const fotoY = BLEED + HEADER_H + 2.5
  const fotoW = 24
  const fotoH = 32
  if (fotoDataUrl) {
    try {
      doc.addImage(fotoDataUrl, 'JPEG', fotoX, fotoY, fotoW, fotoH)
    } catch (e) {
      dibujarFotoPlaceholder(doc, emp, fotoX, fotoY, fotoW, fotoH)
    }
  } else {
    dibujarFotoPlaceholder(doc, emp, fotoX, fotoY, fotoW, fotoH)
  }
  // Borde fino navy alrededor de la foto (sin redondeo)
  doc.setDrawColor(0, 51, 161)
  doc.setLineWidth(0.25)
  doc.rect(fotoX, fotoY, fotoW, fotoH)

  // ─── Datos del empleado (columna derecha) ────────────────────────────
  // Patron oficial: apellidos primero (cedula colombiana / venezolana / DNI).
  // Apellidos UPPERCASE en mayor jerarquia, nombres debajo.
  const datosX = fotoX + fotoW + 4
  const colW = BLEED + CARD_W - datosX - 2
  let cursorY = fotoY + 2

  // APELLIDOS (linea superior, mayor peso)
  doc.setTextColor(100, 116, 139)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(4.8)
  doc.text('APELLIDOS', datosX, cursorY)
  cursorY += 2.5
  doc.setTextColor(15, 23, 42)
  doc.setFontSize(10)
  const apellidos = (emp.apellidos || '—').toUpperCase()
  const apellidosLineas = doc.splitTextToSize(apellidos, colW)
  doc.text(apellidosLineas, datosX, cursorY)
  cursorY += apellidosLineas.length * 3.8 + 1

  // NOMBRES (linea inferior, peso un poco menor)
  doc.setTextColor(100, 116, 139)
  doc.setFontSize(4.8)
  doc.text('NOMBRES', datosX, cursorY)
  cursorY += 2.5
  doc.setTextColor(15, 23, 42)
  doc.setFontSize(8.5)
  const nombres = (emp.nombres || '—').toUpperCase()
  const nombresLineas = doc.splitTextToSize(nombres, colW)
  doc.text(nombresLineas, datosX, cursorY)
  cursorY += nombresLineas.length * 3.2 + 2

  // CARGO
  doc.setTextColor(100, 116, 139)
  doc.setFontSize(4.8)
  doc.text('CARGO', datosX, cursorY)
  cursorY += 2.5
  doc.setTextColor(15, 23, 42)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  const cargoLineas = doc.splitTextToSize(emp.cargo || '—', colW)
  doc.text(cargoLineas, datosX, cursorY)
  cursorY += cargoLineas.length * 2.9 + 1.5

  // DEPARTAMENTO
  doc.setTextColor(100, 116, 139)
  doc.setFontSize(4.8)
  doc.setFont('helvetica', 'bold')
  doc.text('DEPARTAMENTO', datosX, cursorY)
  cursorY += 2.5
  doc.setTextColor(15, 23, 42)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  const depLineas = doc.splitTextToSize(emp.departamento || '—', colW)
  doc.text(depLineas, datosX, cursorY)

  // ─── Cedula en barra inferior — formato V-XX.XXX.XXX ────────────────
  const cedulaY = BLEED + CARD_H - 7
  doc.setFillColor(0, 51, 161)
  doc.rect(BLEED, cedulaY, CARD_W, 7, 'F')
  doc.setFillColor(255, 204, 0)
  doc.rect(BLEED, cedulaY, CARD_W, 0.4, 'F')

  doc.setTextColor(255, 204, 0)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(5)
  doc.text('CÉDULA DE IDENTIDAD', BLEED + 3, cedulaY + 3)
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(11)
  // courier es monospaced — los digitos quedan alineados, sin confusion 1/I/l
  doc.setFont('courier', 'bold')
  doc.text(fmtCedula(emp.cedula), BLEED + 3, cedulaY + 6)
  doc.setFont('helvetica', 'normal')
}

async function dibujarReverso(doc, emp, oficina, logoInstitucional) {
  // ─── Fondo blanco ────────────────────────────────────────────────────
  doc.setFillColor(255, 255, 255)
  doc.rect(0, 0, PAGE_W, PAGE_H, 'F')

  // ─── Encabezado slim del reverso ────────────────────────────────────
  // El reverso NO repite el header completo del frente (eso desperdicia
  // espacio util). Solo una banda navy delgada con el titulo del documento.
  const HEADER_H = 6
  doc.setFillColor(0, 51, 161)
  doc.rect(BLEED, BLEED, CARD_W, HEADER_H, 'F')
  doc.setFillColor(255, 204, 0)
  doc.rect(BLEED, BLEED + HEADER_H, CARD_W, 0.4, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6)
  doc.text('CARNET DE IDENTIFICACIÓN INSTITUCIONAL', BLEED + CARD_W / 2, BLEED + 4, { align: 'center' })

  // ─── CONDICIONES DE USO (terminos numerados) ─────────────────────────
  let cursorY = BLEED + HEADER_H + 4
  doc.setTextColor(0, 51, 161)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(5.5)
  doc.text('CONDICIONES DE USO', BLEED + 3, cursorY)
  cursorY += 3

  doc.setTextColor(30, 41, 59)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(5.2)
  const terminos = [
    '1. Este carnet es propiedad de la Alcaldía de Cristóbal Rojas.',
    '2. Su uso es personal e intransferible. El uso indebido será sancionado.',
    '3. En caso de extravío, notifique a Recursos Humanos de inmediato.',
    '4. Debe ser portado visible durante toda la jornada laboral.',
  ]
  terminos.forEach(t => {
    const lineas = doc.splitTextToSize(t, CARD_W - 6)
    doc.text(lineas, BLEED + 3, cursorY)
    cursorY += lineas.length * 2.3
  })

  cursorY += 1.5

  // ─── EN CASO DE EXTRAVIO + datos ─────────────────────────────────────
  doc.setTextColor(0, 51, 161)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(5.5)
  doc.text('EN CASO DE EXTRAVÍO, DEVOLVER A:', BLEED + 3, cursorY)
  cursorY += 2.8

  doc.setTextColor(30, 41, 59)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(5.2)
  doc.text('Alcaldía de Cristóbal Rojas — Recursos Humanos', BLEED + 3, cursorY)
  cursorY += 2.5
  const direccion = oficina?.direccion || 'Charallave, Estado Miranda'
  const dirLineas = doc.splitTextToSize(direccion, CARD_W - 38)
  doc.text(dirLineas, BLEED + 3, cursorY)
  cursorY += dirLineas.length * 2.3 + 1.5

  // ─── Bloque fechas + horario (compacto, izquierda) ──────────────────
  const fechaX = BLEED + 3
  let fechaY = cursorY
  // Fila: EMISION | VENCE | HORARIO
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(4.8)
  doc.setTextColor(0, 51, 161)
  doc.text('EMISIÓN', fechaX, fechaY)
  doc.text('VENCE', fechaX + 16, fechaY)
  doc.text('HORARIO', fechaX + 32, fechaY)

  fechaY += 2.5
  doc.setFont('courier', 'bold')
  doc.setFontSize(6)
  doc.setTextColor(30, 41, 59)
  doc.text(fmtFechaCarnet(hoyIso()), fechaX, fechaY)
  doc.text(fmtFechaCarnet(vencimientoIso()), fechaX + 16, fechaY)
  doc.text(`${fmtHora(emp.hora_entrada)}-${fmtHora(emp.hora_salida)}`, fechaX + 32, fechaY)
  doc.setFont('helvetica', 'normal')

  // ─── QR esquina inferior derecha (error correction H = 30%) ─────────
  // En el reverso del carnet, no compitiendo con la foto del frente.
  // Error correction H permite que sobreviva abrasion y arrugas en plastico.
  const qrSize = 18
  const qrX = BLEED + CARD_W - qrSize - 3
  const qrY = BLEED + CARD_H - qrSize - 9
  try {
    const qrDataUrl = await QRCode.toDataURL(emp.cedula || '', {
      width: 300,
      margin: 1,
      errorCorrectionLevel: 'H',
      color: { dark: '#000000', light: '#FFFFFF' },
    })
    doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize)
  } catch (e) {
    doc.setFillColor(241, 245, 249)
    doc.rect(qrX, qrY, qrSize, qrSize, 'F')
  }
  // Etiqueta debajo del QR
  doc.setTextColor(100, 116, 139)
  doc.setFontSize(4)
  doc.setFont('helvetica', 'bold')
  doc.text('VERIFICACIÓN', qrX + qrSize / 2, qrY + qrSize + 1.5, { align: 'center' })

  // ─── Cedula repetida en barra inferior (correlacion con frente) ─────
  doc.setFillColor(0, 51, 161)
  doc.rect(BLEED, BLEED + CARD_H - 5, CARD_W, 5, 'F')
  doc.setFillColor(255, 204, 0)
  doc.rect(BLEED, BLEED + CARD_H - 5, CARD_W, 0.4, 'F')

  doc.setTextColor(255, 204, 0)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(4.5)
  doc.text('C.I.', BLEED + 3, BLEED + CARD_H - 2)
  doc.setTextColor(255, 255, 255)
  doc.setFont('courier', 'bold')
  doc.setFontSize(8)
  doc.text(fmtCedula(emp.cedula), BLEED + 6, BLEED + CARD_H - 1.5)
  doc.setFont('helvetica', 'normal')
}

function dibujarFotoPlaceholder(doc, emp, x, y, w, h) {
  // Fondo gris claro neutro (estandar de carnets institucionales cuando
  // falta la foto — NO el navy con iniciales coloridas que es patron
  // amateur de "avatar de app web").
  doc.setFillColor(226, 232, 240) // gris claro
  doc.rect(x, y, w, h, 'F')
  // Silueta gris media (cabeza + hombros)
  doc.setFillColor(148, 163, 184)
  // Cabeza (circulo aproximado con elipse)
  const cx = x + w / 2
  const cyHead = y + h * 0.32
  const rHead = w * 0.22
  doc.ellipse(cx, cyHead, rHead, rHead, 'F')
  // Hombros (trapecio aproximado con elipse alargada en la parte baja)
  const cyShoulders = y + h * 0.92
  doc.ellipse(cx, cyShoulders, w * 0.45, h * 0.32, 'F')
  // Texto pequeno "SIN FOTO" debajo del centro
  doc.setTextColor(71, 85, 105)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(4.5)
  doc.text('SIN FOTO', x + w / 2, y + h - 1.5, { align: 'center' })
}
