import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../supabase'
import { Save, UserPlus, Pencil, X, Users, KeyRound, Upload, Camera, Power, PowerOff } from 'lucide-react'
import { useIsMobile } from '../hooks/useIsMobile'

export default function Empleados() {
  const isMobile = useIsMobile()
  const [listaEmpleados, setListaEmpleados] = useState([])
  const [cargandoLista, setCargandoLista] = useState(false)
  const [errorLista, setErrorLista] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [editandoId, setEditandoId] = useState(null)

  const obtenerEmpleados = useCallback(async () => {
    setCargandoLista(true)
    setErrorLista('')
    const { data, error: errBd } = await supabase.from('empleados').select('*').order('nombres', { ascending: true })
    if (errBd) {
      setErrorLista(`No se pudo cargar el listado: ${errBd.message}`)
    } else {
      setListaEmpleados(data || [])
    }
    setCargandoLista(false)
  }, [])

  // Catalogos para los selects. Si necesitas agregar mas opciones, edita estos
  // arrays. La opcion preseleccionada es siempre la primera.
  // Sala Situacional va al inicio porque es el departamento de la mayoria
  // de empleados ya cargados (no romper el select).
  // Chofer NO esta aqui — Chofer es un CARGO, no un departamento.
  const OPCIONES_DEPARTAMENTOS = [
    'Sala Situacional',
    'CASA DE LA MUJER Y LA FAMILIA',
    'SECRETARIA COORDINADORA DE TRANSPORTE, VIALIDAD Y MOVILIDAD',
    'DIR. TRANSP Y VIAL',
    'REGIST. CIVIL',
    'DIRECCION DE TRANSPORTE Y VIALIDAD',
    'DIRECCION DE REGISTRO CIVIL',
    'DIRECCION DE TALENTO HUMANO',
    'DIRECCION DE CATASTRO MUNICIPAL',
    'DIRECCION DE ORDENACION URBANISTICA Y AMBIENTE',
    'OFICINA PREESCOLAR BICENTENARIO',
    'DIRECCION DE ATENCION AL CIUDADANO Y PROTOCOLOS',
    'DIRECCION DE TECNOLOGIA Y SISTEMA DE INFORMACION',
    'COORDINACION DE SISTEMA DE SALUD PUBLICA',
    'COORDINACION DE SALUD PARROQUIA LAS BRISAS',
    'SINDICATURA MUNICIPAL',
    'DIRECCION DE GESTION SOCIAL',
    'OFICINA MUNICIPAL PARA PERSONAS CON DISCAPACIDAD',
    'SUMINISTROS ESTRATEGICOS',
    'SECRETARIA COORD. SEGURIDAD CIUDADANA, ORDEN PUBL. Y PROT.CIVIL',
    'POLICIA MUNICIPAL BOLIVARIANA CRISTOBAL ROJAS',
    'DIRECCION DE PROTECCION CIVIL Y ADMINISTRACION DE DESASTRE',
    'OFICINA MUNICIPAL SUNAD (ANTIDROGAS)',
    'SECRETARIA COORD. INDUSTRIAS, COMERCIOS, EMPREN. Y PROD. MPAL.',
    'DIRECCION DESARROLLO Y PROD. AGRARIA Y AGROURBANO',
    'SECRETARIA DE COMUNICACIÓN, PRENSA Y ESTRATEGIA COMUNICACIONAL',
    'SECRETARIA DE MANTENIMIENTO URBANO Y SERVICIOS',
    'DIRECCION DE CONSERVACION Y MANTENIMIENTO DE INFRAESTRUCTURA URBANA Y MPAL.',
    'DIRECCION DE SERVICIOS PUBLICOS Y RECOLECCION DE DESECHOS SOLIDOS',
    'DIRECCION DE OBRAS PUBLICAS',
    'SECRETARIA COORDINADORA PARA LA DEMOCRACIA PARTICIPATIVA',
    'DIRECCION DE GOBIERNOS COMUNITARIOS',
    'DIRECCION PODER POPULAR PARA LAS COMUNAS',
    'COORDINACION DE ATENCION AL ADULTO MAYOR',
    'COORDINACION DE MISIONES Y GRANDES MISIONES',
    'INSTITUTO DEPORTE',
    'SALA 1X10',
    'DIRECCION DE RELIGION Y CULTO',
    'DEFENSORIA PARROQUIA LAS BRISAS',
    'OFICINA CONSEJO DE PROTECCION NIÑO, NIÑA Y ADOLESCENTE',
    'DIRECCION DE PLANIFICACION Y PRESUPUESTO',
    'OFICINA DE AUDITORIA INTERNA',
    'DESPACHO DE LA ALCALDESA',
    'DIRECCION DE ADMINISTRACION Y FINANZAS',
    'SECRETARIA GENERAL DE GOBIERNO',
    'CONSEJO MUNICIPAL DE DERECHO, NIÑO, NIÑA Y ADOLESCENTE',
    'DIRECCION DE GESTION PUBLICA MUNICIPAL',
    'CONSEJO LOCAL DE PLANIFICACION PUBLICA',
    'SECRETARIA COORD. ALIMENTACION Y DISTRIBUCION CLAP',
    'DIRECCION DE CULTURA, PATRIMONIO Y ACERVO CULTURAL MUNICIPAL',
    'SECRETARIA COORD. DESARROLLO SOCIAL Y MISIONES',
    'DIRECCION DE EVENTOS, PROTOCOLO Y FERIAS',
    'DIRECCION FORTALECIMIENTO DE PLANES Y PROY. JUVENTUD',
    'DIRECCION DE TURISMO'
  ]
  const OPCIONES_CARGOS = ['Analista de Datos', 'Jefa', 'Informatico', 'Chofer']

  // Estados para los campos de texto estándar (valores por defecto = mas comun)
  const [formulario, setFormulario] = useState({
    cedula: '',
    nombres: '',
    apellidos: '',
    departamento: OPCIONES_DEPARTAMENTOS[0],
    cargo: OPCIONES_CARGOS[0],
    tolerancia_minutos: 15,
    fecha_cumpleanos: '',
    oficina_id: ''  // sede / lugar de trabajo asignado (geofence)
  })

  // Lugares de trabajo (sedes) — se carga de la tabla `oficinas` y alimenta
  // el select del form. Solo lugares activos.
  // Defensa: deduplicamos por nombre por si en la BD hay sedes duplicadas
  // (mismo nombre, distinto uuid). Conservamos la primera (mas antigua,
  // creada_en asc). Asi el dropdown nunca muestra "PSUV PSUV PSUV".
  const [oficinas, setOficinas] = useState([])
  useEffect(() => {
    let cancelado = false
    supabase.from('oficinas').select('id, nombre, direccion, latitud, longitud, radio_metros, activa, creada_en')
      .order('creada_en', { ascending: true })
      .then(({ data }) => {
        if (cancelado) return
        const vistos = new Set()
        const dedupe = (data || []).filter(o => {
          if (o.activa === false) return false
          if (vistos.has(o.nombre)) return false
          vistos.add(o.nombre)
          return true
        })
        // Ordenar alfabeticamente para el select
        dedupe.sort((a, b) => a.nombre.localeCompare(b.nombre))
        setOficinas(dedupe)
      })
    return () => { cancelado = true }
  }, [])

  // Default horario: 7:00 AM - 5:00 PM. El usuario puede cambiarlo en cada alta.
  const [entHora, setEntHora] = useState('07')
  const [entMinuto, setEntMinuto] = useState('00')
  const [entPeriodo, setEntPeriodo] = useState('AM')

  const [salHora, setSalHora] = useState('05')
  const [salMinuto, setSalMinuto] = useState('00')
  const [salPeriodo, setSalPeriodo] = useState('PM')

  const [mensaje, setMensaje] = useState({ texto: '', tipo: '' })

  const archivoCSVRef = useRef(null)
  const archivoFotoRef = useRef(null)
  const [importandoCSV, setImportandoCSV] = useState(false)
  const [empleadoFoto, setEmpleadoFoto] = useState(null)

  // --------------------------------------------------------------------
  // ACTIVAR/DESACTIVAR empleado (soft delete via toggle activo)
  // --------------------------------------------------------------------
  const toggleActivo = async (cedula, nuevoEstado) => {
    const msg = nuevoEstado ? '¿Activar a este empleado? Volvera a poder marcar asistencia.' : '¿Desactivar a este empleado? No podra marcar asistencia hasta reactivarlo.'
    if (!confirm(msg)) return
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.rpc('toggle_activo_empleado', {
      p_cedula: cedula,
      p_activo: nuevoEstado,
      p_admin_email: user?.email || null
    })
    if (error) { alert(`Error: ${error.message}`); return }
    obtenerEmpleados()
  }

  // --------------------------------------------------------------------
  // SUBIR FOTO de perfil. Sube a Supabase Storage (bucket empleados-fotos)
  // y guarda la URL publica en la columna empleados.foto_url.
  // --------------------------------------------------------------------
  const abrirSelectorFoto = (cedula) => {
    setEmpleadoFoto(cedula)
    archivoFotoRef.current?.click()
  }

  const manejarSubidaFoto = async (evento) => {
    const archivo = evento.target.files?.[0]
    if (!archivo || !empleadoFoto) return
    try {
      const ext = archivo.name.split('.').pop()?.toLowerCase() || 'jpg'
      const path = `${empleadoFoto}_${Date.now()}.${ext}`
      const { error: errUp } = await supabase.storage.from('empleados-fotos').upload(path, archivo, { upsert: true, contentType: archivo.type })
      if (errUp) throw errUp
      const { data: { publicUrl } } = supabase.storage.from('empleados-fotos').getPublicUrl(path)
      const { error: errUpd } = await supabase.from('empleados').update({ foto_url: publicUrl }).eq('cedula', empleadoFoto)
      if (errUpd) throw errUpd
      obtenerEmpleados()
    } catch (e) {
      alert(`No se pudo subir la foto: ${e.message}`)
    } finally {
      setEmpleadoFoto(null)
      if (archivoFotoRef.current) archivoFotoRef.current.value = ''
    }
  }

  // --------------------------------------------------------------------
  // RESETEAR CLAVE de un empleado (usa RPC server-side que hashea con bcrypt
  // y queda registrado en la tabla auditoria con el correo del admin).
  // --------------------------------------------------------------------
  const resetearClave = async (cedula) => {
    const claveNueva = prompt(`Nueva clave temporal para ${cedula}\n(El empleado debera cambiarla en su proximo login)`, '123456')
    if (!claveNueva) return
    if (claveNueva.length < 4) {
      alert('La clave debe tener al menos 4 caracteres')
      return
    }
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase.rpc('resetear_clave_empleado', {
      p_cedula: cedula,
      p_clave_nueva: claveNueva,
      p_admin_email: user?.email || null
    })
    if (error) {
      alert(`No se pudo resetear: ${error.message}`)
      return
    }
    if (data === true) {
      alert(`Clave de ${cedula} actualizada. Comunicale al empleado la nueva clave: ${claveNueva}`)
    } else {
      alert('No se encontro el empleado con esa cedula')
    }
  }

  // --------------------------------------------------------------------
  // IMPORTAR CSV. Formato esperado (con header):
  //   cedula,nombres,apellidos,departamento,cargo,hora_entrada,hora_salida,tolerancia_minutos
  // Las filas se procesan con la RPC importar_empleado (upsert por cedula).
  // --------------------------------------------------------------------
  const parsearCSV = (texto) => {
    // Parser minimo: una linea por registro, comas como separador. NO maneja
    // comillas escapadas porque para nuestro caso (datos planos) no aplica.
    const lineas = texto.split(/\r?\n/).filter(l => l.trim().length > 0)
    if (lineas.length < 2) return []
    const headers = lineas[0].split(',').map(h => h.trim().toLowerCase())
    return lineas.slice(1).map(linea => {
      const cols = linea.split(',').map(c => c.trim())
      const obj = {}
      headers.forEach((h, i) => { obj[h] = cols[i] ?? '' })
      return obj
    })
  }

  const manejarImportCSV = async (evento) => {
    const archivo = evento.target.files?.[0]
    if (!archivo) return
    setImportandoCSV(true)
    try {
      const texto = await archivo.text()
      const filas = parsearCSV(texto)
      if (filas.length === 0) {
        alert('El CSV esta vacio o no tiene formato valido')
        return
      }
      let creados = 0
      let actualizados = 0
      let errores = 0
      for (const fila of filas) {
        const { data, error } = await supabase.rpc('importar_empleado', {
          p_cedula: fila.cedula,
          p_nombres: fila.nombres,
          p_apellidos: fila.apellidos,
          p_departamento: fila.departamento || 'Sin asignar',
          p_cargo: fila.cargo || 'Sin asignar',
          p_hora_entrada: fila.hora_entrada || '08:00:00',
          p_hora_salida: fila.hora_salida || '17:00:00',
          p_tolerancia_minutos: Number(fila.tolerancia_minutos) || 15,
          p_clave_inicial: '123456'
        })
        if (error) { errores++; continue }
        if (data === 'CREADO') creados++
        else if (data === 'ACTUALIZADO') actualizados++
      }
      alert(`Importacion finalizada:\n  Creados: ${creados}\n  Actualizados: ${actualizados}\n  Errores: ${errores}`)
      obtenerEmpleados()
    } catch (e) {
      alert(`Error al procesar CSV: ${e.message}`)
    } finally {
      setImportandoCSV(false)
      if (archivoCSVRef.current) archivoCSVRef.current.value = ''
    }
  }

  // ==========================================
  // FUNCIÓN RESTAURADA: Manejador de eventos de teclado
  // ==========================================
  const manejarCambio = (e) => {
    setFormulario({ ...formulario, [e.target.name]: e.target.value })
  }

  useEffect(() => {
    obtenerEmpleados()
  }, [obtenerEmpleados])

  // Función matemática para convertir la selección de 12h a la estructura de 24h de Supabase
  const convertirA24Horas = (hora, minuto, periodo) => {
    let h = parseInt(hora, 10)
    if (periodo === 'PM' && h < 12) h += 12
    if (periodo === 'AM' && h === 12) h = 0
    const horaString = h.toString().padStart(2, '0')
    return `${horaString}:${minuto}:00`
  }

  // Función inversa para transformar el formato 24h de Supabase a los dropdowns de 12h
  const desglosarHoraA12h = (hora24) => {
    const horaSegura = String(hora24 || '08:00:00')
    if (!horaSegura.includes(':')) return { hora: '08', minuto: '00', periodo: 'AM' }
    const partes = horaSegura.split(':')
    let h = parseInt(partes[0], 10) || 8
    let mStr = partes[1] || '00'
    let periodo = 'AM'
    
    if (h >= 12) {
      periodo = 'PM'
      if (h > 12) h -= 12
    }
    if (h === 0) h = 12
    
    return {
      hora: h.toString().padStart(2, '0'),
      minuto: mStr,
      periodo
    }
  }

  // Carga un empleado en el formulario para proceder con la edición
  const activarModoEdicion = (empleado) => {
    setEditandoId(empleado.id)
    setFormulario({
      cedula: empleado.cedula,
      nombres: empleado.nombres,
      apellidos: empleado.apellidos,
      departamento: empleado.departamento,
      cargo: empleado.cargo,
      tolerancia_minutos: empleado.tolerancia_minutos,
      fecha_cumpleanos: empleado.fecha_cumpleanos || '',
      oficina_id: empleado.oficina_id || ''
    })

    const entrada = desglosarHoraA12h(empleado.hora_entrada)
    setEntHora(entrada.hora)
    setEntMinuto(entrada.minuto)
    setEntPeriodo(entrada.periodo)

    const salida = desglosarHoraA12h(empleado.hora_salida)
    setSalHora(salida.hora)
    setSalMinuto(salida.minuto)
    setSalPeriodo(salida.periodo)
    
    setMensaje({ texto: 'Modo edición activado. Modifique los campos arriba.', tipo: 'info' })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const cancelarEdicion = () => {
    setEditandoId(null)
    setFormulario({
      cedula: '', nombres: '', apellidos: '',
      departamento: OPCIONES_DEPARTAMENTOS[0],
      cargo: OPCIONES_CARGOS[0],
      tolerancia_minutos: 15,
      fecha_cumpleanos: '',
      oficina_id: ''
    })
    setEntHora('07')
    setEntMinuto('00')
    setEntPeriodo('AM')
    setSalHora('05')
    setSalMinuto('00')
    setSalPeriodo('PM')
    setMensaje({ texto: '', tipo: '' })
  }

  const guardarEmpleado = async (e) => {
    e.preventDefault()
    setGuardando(true)
    setMensaje({ texto: 'Procesando operación en el servidor...', tipo: 'info' })

    const horaEntradaFinal = convertirA24Horas(entHora, entMinuto, entPeriodo)
    const horaSalidaFinal = convertirA24Horas(salHora, salMinuto, salPeriodo)

    const datosEmpleado = {
      ...formulario,
      tolerancia_minutos: Number(formulario.tolerancia_minutos) || 0,
      hora_entrada: horaEntradaFinal,
      hora_salida: horaSalidaFinal,
      // Null si esta vacio, asi la columna queda null (no string vacio que rompe DATE)
      fecha_cumpleanos: formulario.fecha_cumpleanos || null,
      // oficina_id: '' -> null (no string vacio, eso rompe la FK uuid)
      oficina_id: formulario.oficina_id || null,
    }

    const { error: resultadoError } = editandoId
      ? await supabase.from('empleados').update(datosEmpleado).eq('id', editandoId)
      : await supabase.from('empleados').insert([datosEmpleado])

    setGuardando(false)

    if (resultadoError) {
      const detalle = resultadoError.message || 'Verifique consistencia de datos o duplicidad de cédula.'
      setMensaje({ texto: `⛔ Error: ${detalle}`, tipo: 'error' })
    } else {
      setMensaje({
        texto: editandoId ? '✅ Datos modificados y actualizados con éxito.' : `✅ Servidor Público Registrado. Usuario App: ${formulario.cedula}`,
        tipo: 'exito'
      })
      cancelarEdicion()
      obtenerEmpleados()
    }
  }

  // Estilos visuales actualizados
  const estiloInputBase = {
    width: '100%',
    padding: '14px',
    boxSizing: 'border-box',
    borderRadius: '10px',
    border: '1px solid #cbd5e1',
    fontSize: '15px',
    backgroundColor: '#f8fafc',
    color: '#0f172a',
    fontWeight: '600',
    outline: 'none'
  }

  const estiloSelectTiempo = {
    flex: 1,
    padding: '12px',
    borderRadius: '10px',
    border: '2px solid #10b981',
    backgroundColor: '#ffffff',
    color: '#0f172a',
    fontSize: '15px',
    fontWeight: '800',
    textAlign: 'center',
    cursor: 'pointer',
    outline: 'none'
  }

  const estiloOption = {
    color: '#0f172a',
    backgroundColor: '#ffffff',
    fontWeight: '600'
  }

  const horasDisponibles = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'))
  const minutosDisponibles = ['00', '15', '30', '45']

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: isMobile ? '5px' : '0' }}>
      
      {/* HEADER MODERNO */}
      <div style={{ marginBottom: '30px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', padding: '25px', borderRadius: '16px', color: 'white', boxShadow: '0 10px 20px -5px rgba(16, 185, 129, 0.4)', display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', gap: 15 }}>
        <div>
          <h1 style={{ margin: '0 0 5px 0', fontSize: isMobile ? '24px' : '28px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '10px' }}><Users size={32}/> Gestión de Talento Humano</h1>
          <p style={{ margin: 0, fontSize: '15px', opacity: 0.9 }}>Alta, modificación y auditoría interna de credenciales de la Alcaldía.</p>
        </div>
        <button
          onClick={() => archivoCSVRef.current?.click()}
          disabled={importandoCSV}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 18px', backgroundColor: 'white', color: '#059669', border: 'none', borderRadius: 10, cursor: importandoCSV ? 'wait' : 'pointer', fontWeight: 900, opacity: importandoCSV ? 0.7 : 1, boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
          <Upload size={18} /> {importandoCSV ? 'Importando...' : 'Importar CSV'}
        </button>
        <input ref={archivoCSVRef} type="file" accept=".csv,text/csv" onChange={manejarImportCSV} style={{ display: 'none' }} />
        <input ref={archivoFotoRef} type="file" accept="image/*" onChange={manejarSubidaFoto} style={{ display: 'none' }} />
      </div>

      {/* FORMULARIO DE ACCIONES */}
      <div style={{ backgroundColor: 'white', padding: isMobile ? '25px' : '35px', borderRadius: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9', marginBottom: '40px' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 0 25px 0', color: editandoId ? '#059669' : '#1e293b', borderBottom: '2px solid #e2e8f0', paddingBottom: '15px', fontSize: '18px', textTransform: 'uppercase', fontWeight: '800' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <UserPlus size={22} /> {editandoId ? 'Modificar Servidor Público' : 'Formulario de Registro Oficial'}
          </span>
          {editandoId && (
            <button onClick={cancelarEdicion} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: '800' }}>
              <X size={14} /> Cancelar Edición
            </button>
          )}
        </h3>
        
        <form onSubmit={guardarEmpleado} style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '20px' }}>
          
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: '#475569', marginBottom: '8px', textTransform: 'uppercase' }}>
              Nombres Completos
            </label>
            <input type="text" name="nombres" value={formulario.nombres} onChange={manejarCambio} required placeholder="Ej: Juan José" style={estiloInputBase} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: '#475569', marginBottom: '8px', textTransform: 'uppercase' }}>
              Apellidos Completos
            </label>
            <input type="text" name="apellidos" value={formulario.apellidos} onChange={manejarCambio} required placeholder="Ej: Pérez Rodríguez" style={estiloInputBase} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '900', color: '#059669', marginBottom: '8px', textTransform: 'uppercase' }}>
              Cédula (Usuario App Android)
            </label>
            <input type="text" name="cedula" value={formulario.cedula} onChange={manejarCambio} required disabled={!!editandoId} placeholder="Ej: V12345678" style={{ ...estiloInputBase, border: '2px solid #6ee7b7', backgroundColor: editandoId ? '#f1f5f9' : '#ecfdf5', color: '#064e3b' }} />
          </div>
          
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: '#475569', marginBottom: '8px', textTransform: 'uppercase' }}>
              Dirección / Departamento
            </label>
            <select name="departamento" value={formulario.departamento} onChange={manejarCambio} required style={estiloInputBase}>
              {OPCIONES_DEPARTAMENTOS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: '#475569', marginBottom: '8px', textTransform: 'uppercase' }}>
              Cargo Asignado
            </label>
            <select name="cargo" value={formulario.cargo} onChange={manejarCambio} required style={estiloInputBase}>
              {OPCIONES_CARGOS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: '#475569', marginBottom: '8px', textTransform: 'uppercase' }}>
              Tolerancia (Minutos)
            </label>
            <input type="number" name="tolerancia_minutos" value={formulario.tolerancia_minutos} onChange={manejarCambio} required min="0" style={estiloInputBase} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: '#ec4899', marginBottom: '8px', textTransform: 'uppercase' }}>
              Fecha de Cumpleaños 🎂 (opcional)
            </label>
            <input type="date" name="fecha_cumpleanos" value={formulario.fecha_cumpleanos || ''} onChange={manejarCambio} style={{ ...estiloInputBase, borderColor: '#f9a8d4', backgroundColor: '#fdf2f8', color: '#831843' }} />
          </div>

          <div style={{ gridColumn: isMobile ? 'auto' : 'span 2' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: '#0369a1', marginBottom: '8px', textTransform: 'uppercase' }}>
              📍 Lugar de Trabajo (sede con geofence)
            </label>
            <select name="oficina_id" value={formulario.oficina_id || ''} onChange={manejarCambio}
              style={{ ...estiloInputBase, borderColor: '#7dd3fc', backgroundColor: '#f0f9ff', color: '#0c4a6e', fontWeight: 700 }}>
              <option value="">— Sin sede asignada —</option>
              {oficinas.map(o => (
                <option key={o.id} value={o.id}>
                  {o.nombre} {o.direccion ? `· ${o.direccion}` : ''} (radio {o.radio_metros}m)
                </option>
              ))}
            </select>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginTop: 4 }}>
              El empleado solo podrá marcar asistencia desde esta sede. Para agregar/editar sedes ve a <strong>Configuración → Sedes / Geofence</strong>.
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: '#1e293b', marginBottom: '8px', textTransform: 'uppercase' }}>
              Hora de Entrada
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <select value={entHora} onChange={(e) => setEntHora(e.target.value)} style={estiloSelectTiempo}>
                {horasDisponibles.map(h => <option key={h} value={h} style={estiloOption}>{h} h</option>)}
              </select>
              <select value={entMinuto} onChange={(e) => setEntMinuto(e.target.value)} style={estiloSelectTiempo}>
                {minutosDisponibles.map(m => <option key={m} value={m} style={estiloOption}>{m} min</option>)}
              </select>
              <select value={entPeriodo} onChange={(e) => setEntPeriodo(e.target.value)} style={{ ...estiloSelectTiempo, backgroundColor: '#ecfdf5' }}>
                <option value="AM" style={estiloOption}>AM</option>
                <option value="PM" style={estiloOption}>PM</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: '#1e293b', marginBottom: '8px', textTransform: 'uppercase' }}>
              Hora de Salida
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <select value={salHora} onChange={(e) => setSalHora(e.target.value)} style={estiloSelectTiempo}>
                {horasDisponibles.map(h => <option key={h} value={h} style={estiloOption}>{h} h</option>)}
              </select>
              <select value={salMinuto} onChange={(e) => setSalMinuto(e.target.value)} style={estiloSelectTiempo}>
                {minutosDisponibles.map(m => <option key={m} value={m} style={estiloOption}>{m} min</option>)}
              </select>
              <select value={salPeriodo} onChange={(e) => setSalPeriodo(e.target.value)} style={{ ...estiloSelectTiempo, backgroundColor: '#ecfdf5' }}>
                <option value="AM" style={estiloOption}>AM</option>
                <option value="PM" style={estiloOption}>PM</option>
              </select>
            </div>
          </div>

          <div style={{ gridColumn: isMobile ? 'auto' : 'span 2', marginTop: '15px' }}>
            <button type="submit" disabled={guardando} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '16px', background: editandoId ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', border: 'none', borderRadius: '10px', fontSize: '16px', fontWeight: '900', cursor: guardando ? 'wait' : 'pointer', opacity: guardando ? 0.7 : 1, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
              <Save size={20}/> {guardando ? 'Procesando...' : (editandoId ? 'Guardar Cambios Oficiales' : 'Registrar en el Sistema')}
            </button>
          </div>
        </form>

        {mensaje.texto && (
          <div style={{ marginTop: '20px', padding: '15px', borderRadius: '10px', backgroundColor: mensaje.tipo === 'error' ? '#fef2f2' : '#f0fdf4', color: mensaje.tipo === 'error' ? '#ef4444' : '#16a34a', fontWeight: '800', textAlign: 'center', border: `1px solid ${mensaje.tipo === 'error' ? '#fecaca' : '#bbf7d0'}`, fontSize: '14px' }}>
            {mensaje.texto}
          </div>
        )}
      </div>

      {/* BITÁCORA / LISTADO DE EMPLEADOS REGISTRADOS */}
      <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', overflow: 'hidden', border: '1px solid #f1f5f9' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid #f1f5f9', backgroundColor: '#fafafa' }}>
          <h3 style={{ margin: 0, color: '#1e293b', fontSize: '16px', fontWeight: '800', textTransform: 'uppercase' }}>Listado Oficial de Servidores Públicos</h3>
        </div>
        <div style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '750px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', color: '#475569', fontSize: '12px', textTransform: 'uppercase', fontWeight: '800' }}>
                <th style={{ padding: '18px 20px', borderBottom: '2px solid #e2e8f0' }}>Cédula</th>
                <th style={{ padding: '18px 20px', borderBottom: '2px solid #e2e8f0' }}>Nombre Completo</th>
                <th style={{ padding: '18px 20px', borderBottom: '2px solid #e2e8f0' }}>Dirección / Cargo</th>
                <th style={{ padding: '18px 20px', borderBottom: '2px solid #e2e8f0' }}>Horario Asignado</th>
                <th style={{ padding: '18px 20px', borderBottom: '2px solid #e2e8f0' }}>Sede</th>
                <th style={{ padding: '18px 20px', borderBottom: '2px solid #e2e8f0', textAlign: 'center' }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {listaEmpleados?.map((emp) => (
                <tr key={emp.id} style={{ borderBottom: '1px solid #f1f5f9', fontSize: '14px', backgroundColor: editandoId === emp.id ? '#ecfdf5' : (emp.activo === false ? '#fef2f2' : 'transparent'), opacity: emp.activo === false ? 0.6 : 1 }}>
                  <td style={{ padding: '15px 20px', fontWeight: '800', color: '#10b981' }}>{emp?.cedula}</td>
                  <td style={{ padding: '15px 20px', color: '#1e293b', fontWeight: '700' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {emp.foto_url ? (
                        <img src={emp.foto_url} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', border: '1px solid #cbd5e1' }} />
                      ) : (
                        <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: '#dcfce7', color: '#15803d', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 12 }}>
                          {(emp.nombres || '?').charAt(0)}{(emp.apellidos || '').charAt(0)}
                        </div>
                      )}
                      <span>{emp?.nombres} {emp?.apellidos}{emp.activo === false ? ' (Inactivo)' : ''}</span>
                    </div>
                  </td>
                  <td style={{ padding: '15px 20px', color: '#64748b' }}>
                    <div style={{ fontWeight: '800', color: '#334155' }}>{emp?.departamento}</div>
                    <div style={{ fontSize: '12px', fontWeight: '600' }}>{emp?.cargo}</div>
                  </td>
                  <td style={{ padding: '15px 20px', color: '#0f172a', fontWeight: '700' }}>
                    <span style={{ color: '#059669' }}>{String(emp?.hora_entrada || '08:00:00').substring(0,5)}</span> a <span style={{ color: '#0f172a' }}>{String(emp?.hora_salida || '16:00:00').substring(0,5)}</span>
                    <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block', fontWeight: '600' }}> (+{emp?.tolerancia_minutos || 0}m gracia)</span>
                  </td>
                  <td style={{ padding: '15px 20px', color: '#0c4a6e', fontWeight: '700', fontSize: 13 }}>
                    {(() => {
                      const sede = oficinas.find(o => o.id === emp?.oficina_id)
                      return sede
                        ? <span title={sede.direccion || ''} style={{ padding: '4px 10px', backgroundColor: '#e0f2fe', borderRadius: 12, fontSize: 11, fontWeight: 800 }}>📍 {sede.nombre}</span>
                        : <span style={{ color: '#94a3b8', fontWeight: 600, fontSize: 11 }}>Sin asignar</span>
                    })()}
                  </td>
                  <td style={{ padding: '15px 20px', textAlign: 'center' }}>
                    <div style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
                      <button onClick={() => activarModoEdicion(emp)}    title="Editar"    style={{ padding: '6px 10px', backgroundColor: '#f1f5f9', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Pencil size={12} /> Editar</button>
                      <button onClick={() => abrirSelectorFoto(emp.cedula)} title="Subir foto" style={{ padding: '6px 10px', backgroundColor: '#dbeafe', color: '#1e40af', border: '1px solid #93c5fd', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Camera size={12} /> Foto</button>
                      <button onClick={() => resetearClave(emp.cedula)}   title="Resetear clave" style={{ padding: '6px 10px', backgroundColor: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4 }}><KeyRound size={12} /> Clave</button>
                      {emp.activo !== false ? (
                        <button onClick={() => toggleActivo(emp.cedula, false)} title="Desactivar" style={{ padding: '6px 10px', backgroundColor: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4 }}><PowerOff size={12} /></button>
                      ) : (
                        <button onClick={() => toggleActivo(emp.cedula, true)}  title="Activar"    style={{ padding: '6px 10px', backgroundColor: '#dcfce7', color: '#15803d', border: '1px solid #86efac', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Power size={12} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {cargandoLista && listaEmpleados.length === 0 && (
                <tr><td colSpan="5" style={{ padding: '30px', textAlign: 'center', color: '#94a3b8', fontWeight: 600 }}>Cargando listado...</td></tr>
              )}
              {!cargandoLista && errorLista && (
                <tr><td colSpan="5" style={{ padding: '30px', textAlign: 'center', color: '#ef4444', fontWeight: 700, backgroundColor: '#fef2f2' }}>⛔ {errorLista}</td></tr>
              )}
              {!cargandoLista && !errorLista && listaEmpleados.length === 0 && (
                <tr>
                  <td colSpan="5" style={{ padding: '30px', textAlign: 'center', color: '#64748b', fontWeight: '500' }}>No existen empleados registrados en el sistema de la Alcaldía.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}