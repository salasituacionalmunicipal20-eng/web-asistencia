import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from '../supabase'
import { useTema } from '../theme/ThemeProvider'
import { useIsMobile } from '../hooks/useIsMobile'
import * as XLSX from 'xlsx'
import { Play, Square, Timer, FolderKanban, Plus, Trash2, Download } from 'lucide-react'
import { fmtDuracion, ymdLocal } from '../lib/horas'

export default function TiempoTareas() {
  const { t } = useTema()
  const isMobile = useIsMobile()

  const inputStyle = { width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${t.border}`, fontSize: 14, backgroundColor: t.bgInput, color: t.text, fontWeight: 600, outline: 'none', boxSizing: 'border-box' }
  const cardStyle = { backgroundColor: t.bgPanel, border: `1px solid ${t.border}`, borderRadius: 14, padding: 20, marginBottom: 20 }
  const labelStyle = { display: 'block', fontSize: 12, fontWeight: 700, color: t.textSoft, marginBottom: 6 }
  const btn = (bg, fg) => ({ padding: '10px 16px', borderRadius: 8, border: 'none', backgroundColor: bg, color: fg, fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 })

  const [miCorreo, setMiCorreo] = useState('')
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setMiCorreo(data?.user?.email || '')) }, [])

  // Datos base
  const [proyectos, setProyectos] = useState([])
  const [tareas, setTareas] = useState([])
  const [empleados, setEmpleados] = useState([])
  const [registros, setRegistros] = useState([])
  const [cargando, setCargando] = useState(false)
  const [verArchivados, setVerArchivados] = useState(false)

  // Alta de proyecto
  const [nuevoProy, setNuevoProy] = useState({ nombre: '', descripcion: '', color: '#7c3aed' })
  const [nuevaTarea, setNuevaTarea] = useState({}) // { [proyecto_id]: nombre }

  // Cronómetro
  const [crono, setCrono] = useState({ empleado_id: '', proyecto_id: '', tarea_id: '', descripcion: '' })
  const [corriendo, setCorriendo] = useState(null) // { inicio, proyecto_id, tarea_id, empleado_id, cedula, descripcion }
  const [segundos, setSegundos] = useState(0)
  const intervaloRef = useRef(null)

  // Registro manual
  const hoy = ymdLocal(new Date())
  const [manual, setManual] = useState({ empleado_id: '', proyecto_id: '', tarea_id: '', fecha: hoy, inicio: '', fin: '', descripcion: '' })

  // Filtros de la lista
  const primerDia = `${hoy.slice(0, 7)}-01`
  const [filtros, setFiltros] = useState({ proyecto_id: '', empleado_id: '', desde: primerDia, hasta: hoy })

  // Mapas de consulta rápida
  const mapProy = useMemo(() => Object.fromEntries(proyectos.map(p => [p.id, p])), [proyectos])
  const mapTarea = useMemo(() => Object.fromEntries(tareas.map(x => [x.id, x])), [tareas])
  const mapEmp = useMemo(() => Object.fromEntries(empleados.map(e => [e.id, e])), [empleados])

  // ---- Cargadores ----
  const cargarBase = useCallback(async () => {
    const [p, ta, e] = await Promise.all([
      supabase.from('proyectos').select('*').order('creado_en', { ascending: false }),
      supabase.from('tareas').select('*').order('creado_en', { ascending: true }),
      supabase.from('empleados').select('id, cedula, nombres, apellidos').eq('activo', true).order('nombres')
    ])
    setProyectos(p.data || [])
    setTareas(ta.data || [])
    setEmpleados(e.data || [])
  }, [])

  const cargarRegistros = useCallback(async () => {
    setCargando(true)
    let q = supabase.from('registros_tiempo').select('*')
      .gte('fecha', filtros.desde).lte('fecha', filtros.hasta)
      .order('inicio', { ascending: false })
    if (filtros.proyecto_id) q = q.eq('proyecto_id', filtros.proyecto_id)
    if (filtros.empleado_id) q = q.eq('empleado_id', filtros.empleado_id)
    const { data } = await q
    setRegistros(data || [])
    setCargando(false)
  }, [filtros])

  useEffect(() => { cargarBase() }, [cargarBase])
  useEffect(() => { cargarRegistros() }, [cargarRegistros])

  // Limpieza del intervalo al desmontar
  useEffect(() => () => { if (intervaloRef.current) clearInterval(intervaloRef.current) }, [])

  // ---- Proyectos / Tareas ----
  const crearProyecto = async () => {
    if (!nuevoProy.nombre.trim()) { alert('El nombre del proyecto es obligatorio.'); return }
    const { error } = await supabase.from('proyectos').insert({
      nombre: nuevoProy.nombre.trim(), descripcion: nuevoProy.descripcion.trim() || null,
      color: nuevoProy.color, activo: true
    })
    if (error) { alert(`Error: ${error.message}`); return }
    setNuevoProy({ nombre: '', descripcion: '', color: '#7c3aed' })
    cargarBase()
  }
  const alternarProyecto = async (p) => {
    await supabase.from('proyectos').update({ activo: p.activo === false }).eq('id', p.id)
    cargarBase()
  }
  const borrarProyecto = async (p) => {
    if (!window.confirm(`¿Eliminar el proyecto "${p.nombre}" y sus tareas?`)) return
    await supabase.from('proyectos').delete().eq('id', p.id)
    cargarBase()
  }
  const agregarTarea = async (proyecto_id) => {
    const nombre = (nuevaTarea[proyecto_id] || '').trim()
    if (!nombre) return
    const { error } = await supabase.from('tareas').insert({ proyecto_id, nombre, activa: true })
    if (error) { alert(`Error: ${error.message}`); return }
    setNuevaTarea(prev => ({ ...prev, [proyecto_id]: '' }))
    cargarBase()
  }
  const alternarTarea = async (ta) => {
    await supabase.from('tareas').update({ activa: ta.activa === false }).eq('id', ta.id)
    cargarBase()
  }
  const borrarTarea = async (ta) => {
    if (!window.confirm(`¿Eliminar la tarea "${ta.nombre}"?`)) return
    await supabase.from('tareas').delete().eq('id', ta.id)
    cargarBase()
  }

  // ---- Cronómetro ----
  const iniciar = () => {
    if (!crono.proyecto_id || corriendo) return
    const emp = crono.empleado_id ? mapEmp[crono.empleado_id] : null
    const inicio = new Date()
    setCorriendo({
      inicio, proyecto_id: crono.proyecto_id, tarea_id: crono.tarea_id || null,
      empleado_id: crono.empleado_id || null, cedula: emp?.cedula || null, descripcion: crono.descripcion || null
    })
    setSegundos(0)
    if (intervaloRef.current) clearInterval(intervaloRef.current)
    intervaloRef.current = setInterval(() => {
      setSegundos(Math.floor((Date.now() - inicio.getTime()) / 1000))
    }, 1000)
  }
  const detener = async () => {
    if (!corriendo) return
    if (intervaloRef.current) { clearInterval(intervaloRef.current); intervaloRef.current = null }
    const fin = new Date()
    const dur = Math.max(0, Math.floor((fin.getTime() - corriendo.inicio.getTime()) / 1000))
    const { error } = await supabase.from('registros_tiempo').insert({
      empleado_id: corriendo.empleado_id || null, cedula: corriendo.cedula || null,
      proyecto_id: corriendo.proyecto_id, tarea_id: corriendo.tarea_id || null,
      descripcion: corriendo.descripcion || null,
      inicio: corriendo.inicio.toISOString(), fin: fin.toISOString(),
      duracion_segundos: dur, fecha: ymdLocal(corriendo.inicio), creado_por: miCorreo || null
    })
    if (error) { alert(`Error al guardar: ${error.message}`); return }
    setCorriendo(null)
    setSegundos(0)
    setCrono({ empleado_id: '', proyecto_id: '', tarea_id: '', descripcion: '' })
    cargarRegistros()
  }

  // ---- Registro manual ----
  const guardarManual = async () => {
    if (!manual.proyecto_id) { alert('Elige un proyecto.'); return }
    if (!manual.inicio || !manual.fin) { alert('Indica hora de inicio y fin.'); return }
    const [hi, mi] = manual.inicio.split(':').map(Number)
    const [hf, mf] = manual.fin.split(':').map(Number)
    let dur = ((hf * 60 + mf) - (hi * 60 + mi)) * 60
    if (dur < 0) dur += 86400 // fin < inicio => cruce de medianoche (+24h)
    const emp = manual.empleado_id ? mapEmp[manual.empleado_id] : null
    const inicioISO = new Date(`${manual.fecha}T${manual.inicio}:00`).toISOString()
    const finISO = new Date(new Date(inicioISO).getTime() + dur * 1000).toISOString()
    const { error } = await supabase.from('registros_tiempo').insert({
      empleado_id: manual.empleado_id || null, cedula: emp?.cedula || null,
      proyecto_id: manual.proyecto_id, tarea_id: manual.tarea_id || null,
      descripcion: manual.descripcion || null, inicio: inicioISO, fin: finISO,
      duracion_segundos: dur, fecha: manual.fecha, creado_por: miCorreo || null
    })
    if (error) { alert(`Error: ${error.message}`); return }
    setManual({ empleado_id: '', proyecto_id: '', tarea_id: '', fecha: hoy, inicio: '', fin: '', descripcion: '' })
    cargarRegistros()
  }

  const borrarRegistro = async (id) => {
    if (!window.confirm('¿Eliminar este registro de tiempo?')) return
    await supabase.from('registros_tiempo').delete().eq('id', id)
    cargarRegistros()
  }

  // ---- Totales ----
  const totalSeg = useMemo(() => registros.reduce((s, r) => s + (r.duracion_segundos || 0), 0), [registros])
  const porProyecto = useMemo(() => {
    const acc = {}
    registros.forEach(r => { acc[r.proyecto_id] = (acc[r.proyecto_id] || 0) + (r.duracion_segundos || 0) })
    return Object.entries(acc).sort((a, b) => b[1] - a[1])
  }, [registros])

  const nombreEmp = (r) => {
    const e = r.empleado_id ? mapEmp[r.empleado_id] : null
    if (e) return `${e.nombres} ${e.apellidos}`.trim()
    return r.cedula || '—'
  }
  const horaDe = (iso) => { try { return new Date(iso).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }) } catch { return '' } }

  // ---- Excel ----
  const exportarExcel = () => {
    const filas = registros.map(r => ({
      Fecha: r.fecha,
      Empleado: nombreEmp(r),
      Cédula: r.cedula || '',
      Proyecto: mapProy[r.proyecto_id]?.nombre || '',
      Tarea: r.tarea_id ? (mapTarea[r.tarea_id]?.nombre || '') : '',
      Descripción: r.descripcion || '',
      Inicio: horaDe(r.inicio),
      Fin: r.fin ? horaDe(r.fin) : '',
      Duración: fmtDuracion(r.duracion_segundos)
    }))
    const ws = XLSX.utils.json_to_sheet(filas)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Tiempos')
    XLSX.writeFile(wb, `Tiempos_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  const proyectosVisibles = proyectos.filter(p => verArchivados || p.activo !== false)
  const tareasDe = (pid, soloActivas = false) => tareas.filter(x => x.proyecto_id === pid && (!soloActivas || x.activa !== false))

  return (
    <div style={{ maxWidth: 1150, margin: '0 auto', padding: isMobile ? 5 : 0 }}>
      <div style={{ marginBottom: 24, background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)', padding: 25, borderRadius: 16, color: 'white' }}>
        <h1 style={{ margin: 0, fontSize: isMobile ? 22 : 28, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}><Timer size={32} /> Tiempo por tarea</h1>
        <p style={{ margin: '6px 0 0', opacity: .9, fontSize: 14 }}>Cronómetro y registro de tiempo por proyecto y tarea.</p>
      </div>

      {/* ===== Cronómetro en vivo ===== */}
      <div style={cardStyle}>
        <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 800, color: t.text, display: 'flex', alignItems: 'center', gap: 8 }}><Play size={20} color={t.primario} /> Cronómetro en vivo</h2>
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: isMobile ? 40 : 56, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: corriendo ? t.exito : t.textMuted, letterSpacing: 2 }}>
            {fmtDuracion(corriendo ? segundos : 0)}
          </div>
          {corriendo && (
            <div style={{ fontSize: 13, color: t.textSoft, marginTop: 4 }}>
              {mapProy[corriendo.proyecto_id]?.nombre}{corriendo.tarea_id ? ` · ${mapTarea[corriendo.tarea_id]?.nombre || ''}` : ''}
            </div>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={labelStyle}>Empleado (opcional)</label>
            <select style={inputStyle} value={crono.empleado_id} disabled={!!corriendo} onChange={e => setCrono({ ...crono, empleado_id: e.target.value })}>
              <option value="">— Sin empleado —</option>
              {empleados.map(e => <option key={e.id} value={e.id}>{e.nombres} {e.apellidos} ({e.cedula})</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Proyecto *</label>
            <select style={inputStyle} value={crono.proyecto_id} disabled={!!corriendo} onChange={e => setCrono({ ...crono, proyecto_id: e.target.value, tarea_id: '' })}>
              <option value="">— Elige proyecto —</option>
              {proyectos.filter(p => p.activo !== false).map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Tarea (opcional)</label>
            <select style={inputStyle} value={crono.tarea_id} disabled={!!corriendo || !crono.proyecto_id} onChange={e => setCrono({ ...crono, tarea_id: e.target.value })}>
              <option value="">— Sin tarea —</option>
              {tareasDe(crono.proyecto_id, true).map(x => <option key={x.id} value={x.id}>{x.nombre}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Descripción</label>
            <input style={inputStyle} value={crono.descripcion} disabled={!!corriendo} placeholder="¿En qué estás trabajando?" onChange={e => setCrono({ ...crono, descripcion: e.target.value })} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {!corriendo
            ? <button style={{ ...btn(t.exito, '#fff'), opacity: crono.proyecto_id ? 1 : .5, cursor: crono.proyecto_id ? 'pointer' : 'not-allowed' }} disabled={!crono.proyecto_id} onClick={iniciar}><Play size={18} /> Iniciar</button>
            : <button style={btn(t.error, '#fff')} onClick={detener}><Square size={18} /> Detener y guardar</button>}
        </div>
      </div>

      {/* ===== Registro manual ===== */}
      <div style={cardStyle}>
        <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 800, color: t.text, display: 'flex', alignItems: 'center', gap: 8 }}><Plus size={20} color={t.info} /> Registro manual</h2>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 12 }}>
          <div>
            <label style={labelStyle}>Empleado (opcional)</label>
            <select style={inputStyle} value={manual.empleado_id} onChange={e => setManual({ ...manual, empleado_id: e.target.value })}>
              <option value="">— Sin empleado —</option>
              {empleados.map(e => <option key={e.id} value={e.id}>{e.nombres} {e.apellidos}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Proyecto *</label>
            <select style={inputStyle} value={manual.proyecto_id} onChange={e => setManual({ ...manual, proyecto_id: e.target.value, tarea_id: '' })}>
              <option value="">— Elige proyecto —</option>
              {proyectos.filter(p => p.activo !== false).map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Tarea (opcional)</label>
            <select style={inputStyle} value={manual.tarea_id} disabled={!manual.proyecto_id} onChange={e => setManual({ ...manual, tarea_id: e.target.value })}>
              <option value="">— Sin tarea —</option>
              {tareasDe(manual.proyecto_id, true).map(x => <option key={x.id} value={x.id}>{x.nombre}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Fecha</label>
            <input type="date" style={inputStyle} value={manual.fecha} onChange={e => setManual({ ...manual, fecha: e.target.value })} />
          </div>
          <div>
            <label style={labelStyle}>Hora inicio</label>
            <input type="time" style={inputStyle} value={manual.inicio} onChange={e => setManual({ ...manual, inicio: e.target.value })} />
          </div>
          <div>
            <label style={labelStyle}>Hora fin</label>
            <input type="time" style={inputStyle} value={manual.fin} onChange={e => setManual({ ...manual, fin: e.target.value })} />
          </div>
          <div style={{ gridColumn: isMobile ? 'auto' : '1 / -1' }}>
            <label style={labelStyle}>Descripción</label>
            <input style={inputStyle} value={manual.descripcion} placeholder="Detalle del trabajo" onChange={e => setManual({ ...manual, descripcion: e.target.value })} />
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <button style={btn(t.info, '#fff')} onClick={guardarManual}><Plus size={18} /> Guardar registro</button>
        </div>
      </div>

      {/* ===== Proyectos y tareas ===== */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: t.text, display: 'flex', alignItems: 'center', gap: 8 }}><FolderKanban size={20} color="#7c3aed" /> Proyectos y tareas</h2>
          <label style={{ fontSize: 13, color: t.textSoft, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontWeight: 600 }}>
            <input type="checkbox" checked={verArchivados} onChange={e => setVerArchivados(e.target.checked)} /> Ver archivados
          </label>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 100px auto', gap: 10, marginBottom: 18, alignItems: 'end' }}>
          <div>
            <label style={labelStyle}>Nombre del proyecto *</label>
            <input style={inputStyle} value={nuevoProy.nombre} onChange={e => setNuevoProy({ ...nuevoProy, nombre: e.target.value })} />
          </div>
          <div>
            <label style={labelStyle}>Descripción</label>
            <input style={inputStyle} value={nuevoProy.descripcion} onChange={e => setNuevoProy({ ...nuevoProy, descripcion: e.target.value })} />
          </div>
          <div>
            <label style={labelStyle}>Color</label>
            <input type="color" style={{ ...inputStyle, padding: 4, height: 44 }} value={nuevoProy.color} onChange={e => setNuevoProy({ ...nuevoProy, color: e.target.value })} />
          </div>
          <button style={btn('#7c3aed', '#fff')} onClick={crearProyecto}><Plus size={18} /> Crear</button>
        </div>

        {proyectosVisibles.length === 0
          ? <div style={{ textAlign: 'center', color: t.textMuted, padding: 20 }}>No hay proyectos aún.</div>
          : proyectosVisibles.map(p => (
            <div key={p.id} style={{ border: `1px solid ${t.borderSoft}`, borderRadius: 10, padding: 14, marginBottom: 12, opacity: p.activo === false ? .6 : 1, backgroundColor: t.bgInputAlt }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ width: 14, height: 14, borderRadius: '50%', background: p.color || '#7c3aed', flexShrink: 0 }} />
                <span style={{ fontWeight: 800, color: t.text, fontSize: 15 }}>{p.nombre}</span>
                {p.descripcion && <span style={{ fontSize: 12, color: t.textSoft }}>{p.descripcion}</span>}
                {p.activo === false && <span style={{ fontSize: 11, fontWeight: 700, color: t.aviso, background: t.avisoBg, padding: '2px 8px', borderRadius: 20 }}>Archivado</span>}
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                  <button style={btn(t.bgHover, t.text)} onClick={() => alternarProyecto(p)}>{p.activo === false ? 'Reactivar' : 'Archivar'}</button>
                  <button style={btn(t.errorBg, t.error)} onClick={() => borrarProyecto(p)}><Trash2 size={16} /></button>
                </div>
              </div>

              <div style={{ marginTop: 10, paddingLeft: isMobile ? 0 : 24 }}>
                {tareasDe(p.id).length === 0
                  ? <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 8 }}>Sin tareas.</div>
                  : tareasDe(p.id).map(ta => (
                    <div key={ta.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', opacity: ta.activa === false ? .5 : 1 }}>
                      <span style={{ fontSize: 13, color: t.text, fontWeight: 600 }}>• {ta.nombre}</span>
                      {ta.activa === false && <span style={{ fontSize: 10, color: t.textMuted }}>(inactiva)</span>}
                      <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                        <button style={{ ...btn(t.bgHover, t.textSoft), padding: '4px 10px', fontSize: 12 }} onClick={() => alternarTarea(ta)}>{ta.activa === false ? 'Activar' : 'Desactivar'}</button>
                        <button style={{ ...btn(t.errorBg, t.error), padding: '4px 8px' }} onClick={() => borrarTarea(ta)}><Trash2 size={14} /></button>
                      </div>
                    </div>
                  ))}
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <input style={{ ...inputStyle, padding: 8 }} placeholder="Nueva tarea…" value={nuevaTarea[p.id] || ''}
                    onChange={e => setNuevaTarea(prev => ({ ...prev, [p.id]: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') agregarTarea(p.id) }} />
                  <button style={{ ...btn(t.primarioBg, t.primario), whiteSpace: 'nowrap' }} onClick={() => agregarTarea(p.id)}><Plus size={16} /> Agregar tarea</button>
                </div>
              </div>
            </div>
          ))}
      </div>

      {/* ===== Registros + filtros + totales ===== */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: t.text }}>Registros de tiempo</h2>
          <button style={btn(t.exitoBg, t.exito)} onClick={exportarExcel}><Download size={18} /> Exportar Excel</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
          <div>
            <label style={labelStyle}>Proyecto</label>
            <select style={inputStyle} value={filtros.proyecto_id} onChange={e => setFiltros({ ...filtros, proyecto_id: e.target.value })}>
              <option value="">Todos</option>
              {proyectos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Empleado</label>
            <select style={inputStyle} value={filtros.empleado_id} onChange={e => setFiltros({ ...filtros, empleado_id: e.target.value })}>
              <option value="">Todos</option>
              {empleados.map(e => <option key={e.id} value={e.id}>{e.nombres} {e.apellidos}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Desde</label>
            <input type="date" style={inputStyle} value={filtros.desde} onChange={e => setFiltros({ ...filtros, desde: e.target.value })} />
          </div>
          <div>
            <label style={labelStyle}>Hasta</label>
            <input type="date" style={inputStyle} value={filtros.hasta} onChange={e => setFiltros({ ...filtros, hasta: e.target.value })} />
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16, alignItems: 'center' }}>
          <div style={{ background: t.primarioBg, color: t.primario, padding: '8px 14px', borderRadius: 10, fontWeight: 800, fontSize: 15 }}>
            Total: {fmtDuracion(totalSeg)}
          </div>
          {porProyecto.map(([pid, seg]) => (
            <div key={pid} style={{ background: t.bgHover, color: t.textSoft, padding: '6px 12px', borderRadius: 10, fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: mapProy[pid]?.color || '#7c3aed' }} />
              {mapProy[pid]?.nombre || '—'}: {fmtDuracion(seg)}
            </div>
          ))}
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: t.bgTableHead, color: t.textSoft, textAlign: 'left' }}>
                {['Fecha', 'Empleado', 'Proyecto', 'Tarea', 'Descripción', 'Inicio', 'Fin', 'Duración', ''].map((h, i) => (
                  <th key={i} style={{ padding: '10px 8px', fontWeight: 700, whiteSpace: 'nowrap', borderBottom: `1px solid ${t.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {registros.length === 0
                ? <tr><td colSpan={9} style={{ textAlign: 'center', color: t.textMuted, padding: 24 }}>{cargando ? 'Cargando...' : 'Sin registros.'}</td></tr>
                : registros.map(r => (
                  <tr key={r.id} style={{ background: t.bgTableRow, borderBottom: `1px solid ${t.borderSoft}` }}>
                    <td style={{ padding: '8px', whiteSpace: 'nowrap', color: t.text }}>{r.fecha}</td>
                    <td style={{ padding: '8px', color: t.text }}>{nombreEmp(r)}</td>
                    <td style={{ padding: '8px', color: t.text }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 9, height: 9, borderRadius: '50%', background: mapProy[r.proyecto_id]?.color || '#7c3aed' }} />
                        {mapProy[r.proyecto_id]?.nombre || '—'}
                      </span>
                    </td>
                    <td style={{ padding: '8px', color: t.textSoft }}>{r.tarea_id ? (mapTarea[r.tarea_id]?.nombre || '—') : '—'}</td>
                    <td style={{ padding: '8px', color: t.textSoft, maxWidth: 220 }}>{r.descripcion || '—'}</td>
                    <td style={{ padding: '8px', whiteSpace: 'nowrap', color: t.textSoft }}>{horaDe(r.inicio)}</td>
                    <td style={{ padding: '8px', whiteSpace: 'nowrap', color: t.textSoft }}>{r.fin ? horaDe(r.fin) : '—'}</td>
                    <td style={{ padding: '8px', whiteSpace: 'nowrap', fontWeight: 800, color: t.text, fontVariantNumeric: 'tabular-nums' }}>{fmtDuracion(r.duracion_segundos)}</td>
                    <td style={{ padding: '8px' }}>
                      <button style={{ ...btn(t.errorBg, t.error), padding: '6px 8px' }} onClick={() => borrarRegistro(r.id)}><Trash2 size={14} /></button>
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
