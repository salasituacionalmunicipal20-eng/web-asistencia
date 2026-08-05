// ============================================================================
// AsistenciaQR — panel de la asistencia por codigo QR
// ----------------------------------------------------------------------------
// Es una asistencia APARTE del control diario de empleados. Aca el admin:
//   1. saca el codigo QR (y el enlace) que la gente escanea para registrarse
//   2. ve quien se registro en la fecha elegida
//   3. imprime la PLANILLA DE FIRMAS en PDF
//
// La planilla sale con la hora de entrada ya impresa (la que capto el sistema
// al escanear) y deja EN BLANCO la hora de salida y las dos firmas, porque eso
// se llena a mano sobre el papel.
// ============================================================================
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase'
import QRCode from 'qrcode'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { dibujarHeaderPDF, dibujarFooterPDF } from '../lib/pdfHeader'
import { QrCode, Download, Copy, Check, FileText, Sheet, RefreshCw, Trash2 } from 'lucide-react'

const dosDig = (n) => String(n).padStart(2, '0')
const hoyLocal = () => {
  const d = new Date()
  return `${d.getFullYear()}-${dosDig(d.getMonth() + 1)}-${dosDig(d.getDate())}`
}
const fechaLarga = (iso) => {
  if (!iso) return ''
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

// La pagina publica vive en el hash para que GitHub Pages no devuelva 404 al
// recargar (el sitio es estatico, no hay servidor que resuelva rutas).
const enlacePublico = () => `${window.location.origin}${window.location.pathname}#/registro`

export default function AsistenciaQR() {
  const [fecha, setFecha] = useState(hoyLocal())
  const [filas, setFilas] = useState([])
  const [cargando, setCargando] = useState(false)
  const [qr, setQr] = useState('')
  const [copiado, setCopiado] = useState(false)
  const [busqueda, setBusqueda] = useState('')

  const url = enlacePublico()

  useEffect(() => {
    QRCode.toDataURL(url, { width: 640, margin: 2, errorCorrectionLevel: 'H', color: { dark: '#0a2351', light: '#ffffff' } })
      .then(setQr)
      .catch(() => setQr(''))
  }, [url])

  const cargar = useCallback(async () => {
    setCargando(true)
    const { data, error } = await supabase
      .from('asistencia_qr')
      .select('*')
      .eq('fecha', fecha)
      .order('hora_entrada', { ascending: true })
    setFilas(error ? [] : (data || []))
    setCargando(false)
  }, [fecha])

  useEffect(() => { cargar() }, [cargar])

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return filas
    return filas.filter((r) =>
      [r.nombre, r.apellido, r.cedula, r.cargo, r.municipio, r.comuna, r.comunidad, r.ubch]
        .filter(Boolean).join(' ').toLowerCase().includes(q)
    )
  }, [filas, busqueda])

  const copiarEnlace = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch { /* el navegador puede bloquearlo; el enlace igual se ve en pantalla */ }
  }

  const descargarQR = () => {
    if (!qr) return
    const a = document.createElement('a')
    a.href = qr
    a.download = 'qr-asistencia.png'
    a.click()
  }

  const borrar = async (r) => {
    if (!window.confirm(`¿Quitar a ${r.nombre} ${r.apellido} de la lista del ${fechaLarga(fecha)}?`)) return
    const { error } = await supabase.from('asistencia_qr').delete().eq('id', r.id)
    if (error) { window.alert('No se pudo eliminar: ' + error.message); return }
    cargar()
  }

  // -------------------------------------------------------------- PDF
  // Planilla de firmas: una fila por persona. Entrada impresa; salida y firmas
  // van vacias para llenarlas a mano.
  const generarPDF = () => {
    if (!visibles.length) { window.alert('No hay registros en esa fecha.'); return }

    const doc = new jsPDF({ orientation: 'landscape', format: 'letter' })
    const y = dibujarHeaderPDF(doc, {
      titulo: 'Planilla de asistencia',
      subtitulo: `${fechaLarga(fecha)} · ${visibles.length} persona(s)`
    })

    autoTable(doc, {
      startY: y + 4,
      // Municipio, comuna y comunidad van juntos en una sola columna: separados
      // no caben en la hoja sin dejar las firmas demasiado angostas para firmar.
      head: [['Nº', 'Nombre y apellido', 'Cédula', 'Teléfono', 'UBCH', 'Municipio / Comuna / Comunidad', 'Cargo', 'Entrada', 'Firma entrada', 'Salida', 'Firma salida']],
      body: visibles.map((r, i) => ([
        String(i + 1),
        `${r.nombre || ''} ${r.apellido || ''}`.trim(),
        r.cedula || '',
        r.telefono || '',
        r.ubch || '',
        [r.municipio, r.comuna, r.comunidad].filter(Boolean).join(' · '),
        r.cargo || '',
        r.hora_entrada || '',
        '',                       // firma de entrada: se firma a mano
        r.hora_salida || '',      // normalmente vacio: se escribe a mano
        ''                        // firma de salida: se firma a mano
      ])),
      styles: { fontSize: 8, cellPadding: 2.4, lineColor: [148, 163, 184], lineWidth: 0.15, valign: 'middle' },
      headStyles: { fillColor: [10, 35, 81], textColor: 255, fontSize: 7.6, fontStyle: 'bold', halign: 'center' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      // Filas altas: sin espacio real no se puede firmar encima.
      bodyStyles: { minCellHeight: 13 },
      // Los anchos suman 246 mm y el area util de una carta horizontal con los
      // margenes de autoTable (~14,1 mm por lado) es ~251 mm. Si se tocan, hay
      // que volver a cuadrarlos o la tabla se sale de la hoja.
      // El telefono necesita 23 mm: con menos, un numero tipo 0424-1234567 se
      // parte en dos lineas y la planilla se ve sucia.
      // Nº y Entrada llevan 9 y 17 mm porque con menos el propio TITULO de la
      // columna se parte en dos lineas ("N/º", "Entrad/a") y se ve descuidado.
      columnStyles: {
        0: { cellWidth: 9, halign: 'center' },
        1: { cellWidth: 35 },
        2: { cellWidth: 18, halign: 'center' },
        3: { cellWidth: 23, halign: 'center' },
        4: { cellWidth: 22 },
        5: { cellWidth: 30 },
        6: { cellWidth: 23 },
        7: { cellWidth: 17, halign: 'center', fontStyle: 'bold' },
        8: { cellWidth: 29, fillColor: [255, 255, 255] },
        9: { cellWidth: 13, fillColor: [255, 255, 255] },
        10: { cellWidth: 29, fillColor: [255, 255, 255] }
      },
      didDrawPage: () => dibujarFooterPDF(doc)
    })

    // Cierre para firmar quien levanta la asistencia.
    const fin = (doc.lastAutoTable?.finalY || y) + 14
    const pageH = doc.internal.pageSize.getHeight()
    if (fin < pageH - 26) {
      doc.setDrawColor(100, 116, 139); doc.setLineWidth(0.3)
      doc.line(20, fin, 95, fin)
      doc.line(120, fin, 195, fin)
      doc.setFontSize(8.5); doc.setTextColor(71, 85, 105)
      doc.text('Responsable de la jornada', 20, fin + 4.5)
      doc.text('Sello / Coordinación', 120, fin + 4.5)
    }

    doc.save(`planilla-asistencia-${fecha}.pdf`)
  }

  // -------------------------------------------------------------- Excel
  const generarExcel = () => {
    if (!visibles.length) { window.alert('No hay registros en esa fecha.'); return }
    const datos = visibles.map((r, i) => ({
      'Nº': i + 1,
      'Nombre': r.nombre || '',
      'Apellido': r.apellido || '',
      'Cédula': r.cedula || '',
      'Teléfono': r.telefono || '',
      'Municipio': r.municipio || '',
      'Comuna': r.comuna || '',
      'Comunidad': r.comunidad || '',
      'UBCH': r.ubch || '',
      'Cargo': r.cargo || '',
      'Hora de entrada': r.hora_entrada || '',
      'Hora de salida': r.hora_salida || ''
    }))
    const ws = XLSX.utils.json_to_sheet(datos)
    ws['!cols'] = [{ wch: 5 }, { wch: 18 }, { wch: 18 }, { wch: 13 }, { wch: 15 }, { wch: 16 }, { wch: 20 }, { wch: 22 }, { wch: 26 }, { wch: 24 }, { wch: 15 }, { wch: 15 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Asistencia')
    XLSX.writeFile(wb, `asistencia-qr-${fecha}.xlsx`)
  }

  // -------------------------------------------------------------- estilos
  const card = { background: 'var(--card, #fff)', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20 }
  const btn = { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 14px', fontSize: 13.5, fontWeight: 700, border: 'none', borderRadius: 8, cursor: 'pointer', color: '#fff' }
  const input = { padding: '9px 11px', fontSize: 14, border: '1px solid #cbd5e1', borderRadius: 8, background: '#fff', color: '#0f172a' }
  const th = { textAlign: 'left', padding: '10px 12px', fontSize: 11, letterSpacing: .5, textTransform: 'uppercase', color: '#64748b', fontWeight: 800, borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap' }
  const td = { padding: '10px 12px', fontSize: 13.5, borderBottom: '1px solid #f1f5f9', color: '#0f172a' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 22, color: '#0a2351', display: 'flex', alignItems: 'center', gap: 9 }}>
          <QrCode size={22} /> Asistencia por QR
        </h2>
        <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: 13.5 }}>
          Registro de jornadas y actividades, independiente del control diario de personal.
        </p>
      </div>

      {/* ---------------- QR + enlace ---------------- */}
      <div style={{ ...card, display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          {qr
            ? <img src={qr} alt="Código QR de registro" style={{ width: 190, height: 190, border: '1px solid #e2e8f0', borderRadius: 10 }} />
            : <div style={{ width: 190, height: 190, display: 'grid', placeItems: 'center', color: '#94a3b8', border: '1px dashed #cbd5e1', borderRadius: 10 }}>Generando…</div>}
        </div>
        <div style={{ flex: 1, minWidth: 260 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#0a2351' }}>Código para registrarse</div>
          <p style={{ fontSize: 13.5, color: '#475569', margin: '8px 0 14px', lineHeight: 1.6 }}>
            Imprime este QR o muéstralo en pantalla. Quien lo escanee llena sus datos y el sistema
            le guarda <b>la hora exacta</b> en que se registró.
          </p>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '9px 11px', fontSize: 12.5, wordBreak: 'break-all', color: '#334155', marginBottom: 12 }}>
            {url}
          </div>
          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
            <button style={{ ...btn, background: '#0284c7' }} onClick={descargarQR}><Download size={15} /> Descargar QR</button>
            <button style={{ ...btn, background: copiado ? '#16a34a' : '#475569' }} onClick={copiarEnlace}>
              {copiado ? <Check size={15} /> : <Copy size={15} />} {copiado ? 'Copiado' : 'Copiar enlace'}
            </button>
          </div>
        </div>
      </div>

      {/* ---------------- filtros + exportar ---------------- */}
      <div style={{ ...card, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 5 }}>FECHA</label>
          <input type="date" style={input} value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 5 }}>BUSCAR</label>
          <input style={{ ...input, width: '100%', boxSizing: 'border-box' }} placeholder="Nombre, cédula, cargo…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        </div>
        <button style={{ ...btn, background: '#475569' }} onClick={cargar}><RefreshCw size={15} /> Actualizar</button>
        <button style={{ ...btn, background: '#b91c1c' }} onClick={generarPDF}><FileText size={15} /> Planilla de firmas (PDF)</button>
        <button style={{ ...btn, background: '#15803d' }} onClick={generarExcel}><Sheet size={15} /> Excel</button>
      </div>

      {/* ---------------- tabla ---------------- */}
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #e2e8f0', fontSize: 14, fontWeight: 700, color: '#0a2351' }}>
          {cargando ? 'Cargando…' : `${visibles.length} registro(s) · ${fechaLarga(fecha)}`}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1040 }}>
            <thead>
              <tr>
                <th style={th}>Nº</th>
                <th style={th}>Nombre y apellido</th>
                <th style={th}>Cédula</th>
                <th style={th}>Teléfono</th>
                <th style={th}>Municipio</th>
                <th style={th}>Comuna</th>
                <th style={th}>Comunidad</th>
                <th style={th}>UBCH</th>
                <th style={th}>Cargo</th>
                <th style={{ ...th, textAlign: 'center' }}>Entrada</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {!cargando && visibles.length === 0 && (
                <tr><td colSpan={11} style={{ ...td, textAlign: 'center', color: '#94a3b8', padding: '34px 12px' }}>
                  Nadie se ha registrado en esta fecha todavía.
                </td></tr>
              )}
              {visibles.map((r, i) => (
                <tr key={r.id}>
                  <td style={{ ...td, color: '#94a3b8' }}>{i + 1}</td>
                  <td style={{ ...td, fontWeight: 600 }}>{`${r.nombre || ''} ${r.apellido || ''}`.trim()}</td>
                  <td style={td}>{r.cedula}</td>
                  <td style={td}>{r.telefono || '—'}</td>
                  <td style={td}>{r.municipio || '—'}</td>
                  <td style={td}>{r.comuna || '—'}</td>
                  <td style={td}>{r.comunidad || '—'}</td>
                  <td style={td}>{r.ubch || '—'}</td>
                  <td style={td}>{r.cargo || '—'}</td>
                  <td style={{ ...td, textAlign: 'center', fontWeight: 800, color: '#0a2351' }}>{r.hora_entrada}</td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    <button
                      onClick={() => borrar(r)}
                      title="Quitar de la lista"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 4 }}
                    ><Trash2 size={16} /></button>
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
