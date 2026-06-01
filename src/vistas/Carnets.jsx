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
            <strong>📐 Formato:</strong> CR80 (85.6 × 54 mm) + 3 mm de bleed.
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
// Replica visualmente lo que se imprime en el PDF, pero en HTML/CSS para
// previsualizar facil. NO es lo que se imprime — el PDF se dibuja aparte
// con jsPDF para que la imprenta tenga el archivo vectorial.
function CarnetFrente({ emp }) {
  return (
    <div style={cardShell}>
      <CardHeader />
      <div style={{ flex: 1, display: 'flex', padding: '8px 10px', gap: 10, alignItems: 'center' }}>
        <Foto emp={emp} grande />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 9, color: TEXT_MUTED, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>Empleado</div>
          <div style={{ fontSize: 13, fontWeight: 900, color: NAVY_DARK, lineHeight: 1.1, marginTop: 1, overflowWrap: 'break-word' }}>
            {emp.nombres}<br/>{emp.apellidos}
          </div>
          <div style={{ fontSize: 9.5, color: TEXT_DARK, marginTop: 4, fontWeight: 700 }}>
            {emp.cargo || '—'}
          </div>
          <div style={{ fontSize: 8.5, color: TEXT_MUTED, fontWeight: 600 }}>
            {emp.departamento || '—'}
          </div>
        </div>
      </div>
      <div style={cedulaBar}>
        <span style={{ fontSize: 8.5, opacity: 0.85, marginRight: 6, fontWeight: 700 }}>C.I.</span>
        <span style={{ fontSize: 13, fontWeight: 900, letterSpacing: 1 }}>{emp.cedula}</span>
      </div>
    </div>
  )
}

function CarnetReverso({ emp, oficina }) {
  const [qrUrl, setQrUrl] = useState('')
  useEffect(() => {
    QRCode.toDataURL(emp.cedula || '', { width: 200, margin: 1, errorCorrectionLevel: 'M' })
      .then(setQrUrl)
      .catch(() => setQrUrl(''))
  }, [emp.cedula])

  return (
    <div style={cardShell}>
      <CardHeader />
      <div style={{ flex: 1, display: 'flex', padding: '8px 10px', gap: 10, alignItems: 'center' }}>
        {qrUrl ? (
          <img src={qrUrl} alt="" style={{ width: 70, height: 70, borderRadius: 4, background: 'white' }} />
        ) : (
          <div style={{ width: 70, height: 70, background: '#f1f5f9', borderRadius: 4 }} />
        )}
        <div style={{ flex: 1, fontSize: 9, lineHeight: 1.35, color: TEXT_DARK }}>
          <div style={{ marginBottom: 4 }}>
            <strong style={{ color: NAVY_DARK, fontSize: 8.5, textTransform: 'uppercase', letterSpacing: 0.5 }}>Horario</strong><br/>
            {fmtHora(emp.hora_entrada)} — {fmtHora(emp.hora_salida)}
          </div>
          <div style={{ marginBottom: 4 }}>
            <strong style={{ color: NAVY_DARK, fontSize: 8.5, textTransform: 'uppercase', letterSpacing: 0.5 }}>Sede</strong><br/>
            {oficina?.nombre || '—'}
            {oficina?.direccion && <><br/><span style={{ color: TEXT_MUTED, fontSize: 8 }}>{oficina.direccion}</span></>}
          </div>
        </div>
      </div>
      <div style={{ ...cedulaBar, justifyContent: 'center', fontSize: 7, fontWeight: 600, padding: '4px 8px', lineHeight: 1.3 }}>
        Si encuentra este carnet, devuélvalo a la Alcaldía de Cristóbal Rojas.
      </div>
    </div>
  )
}

function Foto({ emp, grande = false }) {
  const [error, setError] = useState(false)
  const tam = grande ? 60 : 30
  const iniciales = getIniciales(emp)
  if (emp.foto_url && !error) {
    return (
      <img
        src={emp.foto_url}
        alt=""
        onError={() => setError(true)}
        style={{ width: tam, height: tam * 1.25, objectFit: 'cover', borderRadius: 4, border: `1px solid ${NAVY}` }}
      />
    )
  }
  return (
    <div style={{
      width: tam, height: tam * 1.25, borderRadius: 4,
      background: `linear-gradient(135deg, ${NAVY} 0%, ${NAVY_DARK} 100%)`,
      color: GOLD, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 900, fontSize: grande ? 22 : 11, letterSpacing: 1, border: `1px solid ${NAVY_DARK}`
    }}>
      {iniciales}
    </div>
  )
}

function CardHeader() {
  return (
    <div style={{
      background: `linear-gradient(135deg, ${NAVY_DARK} 0%, ${NAVY} 100%)`,
      color: 'white', padding: '6px 10px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
      borderBottom: `2px solid ${GOLD}`,
    }}>
      <div style={{ fontSize: 8.5, fontWeight: 900, lineHeight: 1, letterSpacing: 0.5, textTransform: 'uppercase' }}>
        Alcaldía de<br/>Cristóbal Rojas
      </div>
      <div style={{ fontSize: 7, fontWeight: 700, color: GOLD, textAlign: 'right', lineHeight: 1.1, textTransform: 'uppercase', letterSpacing: 0.4 }}>
        Sala<br/>Situacional
      </div>
    </div>
  )
}

const cardShell = {
  width: 280,
  aspectRatio: '85.6 / 54',
  background: 'white',
  borderRadius: 8,
  border: `1px solid #cbd5e1`,
  boxShadow: '0 6px 20px rgba(0,0,0,0.12)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  color: TEXT_DARK,
}

const cedulaBar = {
  background: `linear-gradient(90deg, ${NAVY_DARK}, ${NAVY})`,
  color: 'white',
  padding: '5px 10px',
  display: 'flex',
  alignItems: 'center',
  borderTop: `2px solid ${GOLD}`,
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

  // Pre-carga fotos para evitar await dentro del loop con jsPDF (que es sync).
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
    dibujarFrente(doc, emp, foto)

    doc.addPage([PAGE_W, PAGE_H], 'landscape')
    await dibujarReverso(doc, emp, oficinaPorId.get(emp.oficina_id))
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

function dibujarFrente(doc, emp, fotoDataUrl) {
  // ─── Fondo blanco (toda la pagina incluyendo bleed) ──────────────────
  doc.setFillColor(255, 255, 255)
  doc.rect(0, 0, PAGE_W, PAGE_H, 'F')

  // ─── Encabezado institucional (banda azul con linea dorada) ──────────
  doc.setFillColor(0, 26, 92) // navy oscuro
  doc.rect(BLEED, BLEED, CARD_W, 11, 'F')
  doc.setFillColor(255, 204, 0) // dorado
  doc.rect(BLEED, BLEED + 11, CARD_W, 0.8, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.text('ALCALDÍA DE CRISTÓBAL ROJAS', BLEED + 3, BLEED + 4.5)
  doc.setFontSize(5.5)
  doc.setTextColor(255, 204, 0)
  doc.text('Sala Situacional · Control de Acceso', BLEED + 3, BLEED + 8.5)

  doc.setTextColor(255, 204, 0)
  doc.setFontSize(6)
  doc.text('EMPLEADO', BLEED + CARD_W - 3, BLEED + 7, { align: 'right' })

  // ─── Foto (a la izquierda, 22x28mm) ──────────────────────────────────
  const fotoX = BLEED + 3
  const fotoY = BLEED + 15
  const fotoW = 22
  const fotoH = 28
  if (fotoDataUrl) {
    try {
      doc.addImage(fotoDataUrl, 'JPEG', fotoX, fotoY, fotoW, fotoH)
    } catch (e) {
      dibujarFotoPlaceholder(doc, emp, fotoX, fotoY, fotoW, fotoH)
    }
  } else {
    dibujarFotoPlaceholder(doc, emp, fotoX, fotoY, fotoW, fotoH)
  }
  // borde alrededor de la foto
  doc.setDrawColor(0, 26, 92)
  doc.setLineWidth(0.3)
  doc.rect(fotoX, fotoY, fotoW, fotoH)

  // ─── Datos del empleado (a la derecha de la foto) ────────────────────
  const datosX = fotoX + fotoW + 4
  let cursorY = fotoY + 3

  doc.setTextColor(100, 116, 139)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(5.5)
  doc.text('NOMBRES', datosX, cursorY)
  cursorY += 3
  doc.setTextColor(15, 23, 42)
  doc.setFontSize(10)
  const nombresLineas = doc.splitTextToSize(emp.nombres || '—', CARD_W - (datosX - BLEED) - 3)
  doc.text(nombresLineas, datosX, cursorY)
  cursorY += nombresLineas.length * 3.8 + 1

  doc.setTextColor(100, 116, 139)
  doc.setFontSize(5.5)
  doc.text('APELLIDOS', datosX, cursorY)
  cursorY += 3
  doc.setTextColor(15, 23, 42)
  doc.setFontSize(10)
  const apellidosLineas = doc.splitTextToSize(emp.apellidos || '—', CARD_W - (datosX - BLEED) - 3)
  doc.text(apellidosLineas, datosX, cursorY)
  cursorY += apellidosLineas.length * 3.8 + 1.5

  doc.setTextColor(100, 116, 139)
  doc.setFontSize(5.5)
  doc.text('CARGO', datosX, cursorY)
  cursorY += 3
  doc.setTextColor(0, 51, 161)
  doc.setFontSize(7.5)
  const cargoLineas = doc.splitTextToSize(emp.cargo || '—', CARD_W - (datosX - BLEED) - 3)
  doc.text(cargoLineas, datosX, cursorY)
  cursorY += cargoLineas.length * 3.2 + 1

  doc.setTextColor(100, 116, 139)
  doc.setFontSize(5)
  doc.setFont('helvetica', 'normal')
  const depLineas = doc.splitTextToSize(emp.departamento || '—', CARD_W - (datosX - BLEED) - 3)
  doc.text(depLineas, datosX, cursorY)

  // ─── Cedula en barra inferior ────────────────────────────────────────
  doc.setFillColor(0, 51, 161) // navy
  doc.rect(BLEED, BLEED + CARD_H - 6.5, CARD_W, 6.5, 'F')
  doc.setFillColor(255, 204, 0) // dorado top
  doc.rect(BLEED, BLEED + CARD_H - 6.5, CARD_W, 0.5, 'F')

  doc.setTextColor(255, 204, 0)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(5.5)
  doc.text('CÉDULA DE IDENTIDAD', BLEED + 3, BLEED + CARD_H - 3.8)
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(11)
  doc.text(emp.cedula || '—', BLEED + 3, BLEED + CARD_H - 1)
}

async function dibujarReverso(doc, emp, oficina) {
  // ─── Fondo blanco ────────────────────────────────────────────────────
  doc.setFillColor(255, 255, 255)
  doc.rect(0, 0, PAGE_W, PAGE_H, 'F')

  // ─── Encabezado (igual al frente para consistencia) ──────────────────
  doc.setFillColor(0, 26, 92)
  doc.rect(BLEED, BLEED, CARD_W, 11, 'F')
  doc.setFillColor(255, 204, 0)
  doc.rect(BLEED, BLEED + 11, CARD_W, 0.8, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.text('ALCALDÍA DE CRISTÓBAL ROJAS', BLEED + 3, BLEED + 4.5)
  doc.setFontSize(5.5)
  doc.setTextColor(255, 204, 0)
  doc.text('Sala Situacional · Control de Acceso', BLEED + 3, BLEED + 8.5)

  doc.setTextColor(255, 204, 0)
  doc.setFontSize(6)
  doc.text('REVERSO', BLEED + CARD_W - 3, BLEED + 7, { align: 'right' })

  // ─── QR (centrado vertical, lado izquierdo) ──────────────────────────
  const qrSize = 25
  const qrX = BLEED + 4
  const qrY = BLEED + 16
  try {
    const qrDataUrl = await QRCode.toDataURL(emp.cedula || '', {
      width: 300,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#FFFFFF' },
    })
    doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize)
  } catch (e) {
    // Si QRCode falla por lo que sea, dejamos un placeholder
    doc.setFillColor(241, 245, 249)
    doc.rect(qrX, qrY, qrSize, qrSize, 'F')
  }

  // ─── Datos a la derecha del QR ───────────────────────────────────────
  const datosX = qrX + qrSize + 4
  const colW = CARD_W - (datosX - BLEED) - 3
  let cursorY = qrY + 2

  doc.setTextColor(0, 26, 92)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(5.5)
  doc.text('HORARIO', datosX, cursorY)
  cursorY += 3
  doc.setTextColor(15, 23, 42)
  doc.setFontSize(8)
  doc.text(`${fmtHora(emp.hora_entrada)} — ${fmtHora(emp.hora_salida)}`, datosX, cursorY)
  cursorY += 4

  doc.setTextColor(0, 26, 92)
  doc.setFontSize(5.5)
  doc.setFont('helvetica', 'bold')
  doc.text('SEDE ASIGNADA', datosX, cursorY)
  cursorY += 3
  doc.setTextColor(15, 23, 42)
  doc.setFontSize(7)
  const sedeNombre = oficina?.nombre || '—'
  const sedeLineas = doc.splitTextToSize(sedeNombre, colW)
  doc.text(sedeLineas, datosX, cursorY)
  cursorY += sedeLineas.length * 2.8 + 0.5
  if (oficina?.direccion) {
    doc.setTextColor(100, 116, 139)
    doc.setFontSize(5.5)
    doc.setFont('helvetica', 'normal')
    const dirLineas = doc.splitTextToSize(oficina.direccion, colW)
    doc.text(dirLineas, datosX, cursorY)
  }

  // ─── Mensaje legal en la parte inferior ──────────────────────────────
  doc.setFillColor(0, 51, 161)
  doc.rect(BLEED, BLEED + CARD_H - 8, CARD_W, 8, 'F')
  doc.setFillColor(255, 204, 0)
  doc.rect(BLEED, BLEED + CARD_H - 8, CARD_W, 0.5, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(5.2)
  const aviso = 'Si encuentra este carnet, devuélvalo a la Alcaldía de Cristóbal Rojas. Documento personal e intransferible.'
  const avisoLineas = doc.splitTextToSize(aviso, CARD_W - 6)
  doc.text(avisoLineas, BLEED + CARD_W / 2, BLEED + CARD_H - 4.5, { align: 'center' })

  // Pequeña linea de cedula reverso (para correlación)
  doc.setTextColor(255, 204, 0)
  doc.setFontSize(5.5)
  doc.setFont('helvetica', 'bold')
  doc.text(`C.I. ${emp.cedula || '—'}`, BLEED + CARD_W - 3, BLEED + CARD_H - 1, { align: 'right' })
}

function dibujarFotoPlaceholder(doc, emp, x, y, w, h) {
  // fondo navy
  doc.setFillColor(0, 51, 161)
  doc.rect(x, y, w, h, 'F')
  // iniciales centradas en dorado
  doc.setTextColor(255, 204, 0)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.text(getIniciales(emp), x + w / 2, y + h / 2 + 4, { align: 'center' })
}
