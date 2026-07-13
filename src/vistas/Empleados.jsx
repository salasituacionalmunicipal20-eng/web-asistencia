import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../supabase'
import { Save, UserPlus, Pencil, X, Users, KeyRound, Upload, Camera, Power, PowerOff, Eye, AlertTriangle, Copy, IdCard, RefreshCw, Search } from 'lucide-react'
import { useIsMobile } from '../hooks/useIsMobile'

export default function Empleados() {
  const isMobile = useIsMobile()
  const [listaEmpleados, setListaEmpleados] = useState([])
  const [cargandoLista, setCargandoLista] = useState(false)
  const [errorLista, setErrorLista] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [busquedaLista, setBusquedaLista] = useState('')

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
    'DIRECCION DE TURISMO',
    'SECRETARIA TRIBUTARIA'
  ]
  // OPCIONES_CARGOS: los 4 originales + nomencladores oficiales de la Alcaldia,
  // deduplicados (ignorando whitespace y casing). Ordenados alfabeticamente con
  // localeCompare para que el dropdown sea facil de scanear visualmente.
  const OPCIONES_CARGOS = [
    'ABOGADA', 'ABOGADO I', 'AFORADOR', 'AMB.SIMON BOLIVAR', 'AMBULANCIA',
    'ANALISTA', 'ANALISTA I', 'ANALISTA II', 'ANALISTA III', 'ANALISTA VI',
    'ANALISTA VII', 'ANALISTA I. DESPACHO', 'ANALISTA INGRESO', 'ANALISTA LIQUIDADOR',
    'Analista de Datos',
    'APOYO', 'ARCHIVISTA III', 'ASEADORA', 'ASESOR LEGAL',
    'ASIC BRISAS', 'ASIST.ADMON', 'ASIST.ADMON I', 'ASIST. ADMON II',
    'ASIST. OFICINA', 'ASIST.TEC.ADMON', 'ASISTENTE', 'ASISTENTE JURIDICO',
    'AUTORIDAD UNICA SALUD', 'AUX.OFICINA', 'AUXILIAR',
    'CAJERA TERMINAL', 'CASO ESPECIAL', 'CHARALLAVE', 'Chofer', 'COCINERA',
    'COM SER CASA MUJER', 'CONCORD', 'CONTRATACION PUBLICA',
    'COORD.(E)', 'COORD.AGUA CIST.C.M', 'COORD. EMPRENDIM.', 'COORD. LEGAL',
    'COORD.PAR.BRISAS', 'COORD.PAR.CHARA', 'COORD. PSICOLOGICA',
    'COORD. TERMINAL', 'COORD.TERR.ACT. ECON', 'COORDINADOR',
    'DIR. ENC. CULTURA', 'DIRECCION DE COMUNICACIONES',
    'DIRECTOR', 'DIRECTOR (A) EMPREND.', 'DIRECTOR (A) HACIENDA',
    'DIRECTORA', 'DIRECTORA COM.', 'DOCTORA',
    'EDITOR DE AUDIOV.', 'ENCARGADA', 'ESCRIBIENTE II',
    'ESTE PERSONAL ESTA A LA ORDEN DE SECRETARIA YULI PEREZ',
    'FISCAL', 'FISCAL I',
    'Informatico', 'INSP. URB. I', 'INSP.URB II', 'INSPECTOR', 'INSPECTOR III',
    'JEFE DIV.AGUAMCR', 'JEFE DIV BRISAS', 'JEFE DIV.PARQ.JAR',
    'JEFE REC. DES.SOL.', 'JEFE SEG. INTERNA', 'JEFE SERV.GRALES', 'Jefa',
    'MAD. LAS BRISAS', 'MAMA PANCHA', 'MERCADO', 'MOD. ALI PRIMERA',
    'MOD. JABILLITO', 'MOD. MAMA BRUNA', 'MOTORIZADO',
    'NOMINA CONS.DERECHO',
    'ODONTOL.CURACIRI', 'ORIENTADOR AGRARIO',
    'PRESIDENTA', 'PROMOTOR AGRARIO I', 'PROMOTORA',
    'RECEPCIONISTA', 'REPOSO',
    'SECRET. EJEC.', 'SECRET.EJEC. I', 'SECRET.EJEC.II', 'SECRETARIA',
    'SECRETARIA EJEC. I', 'SECRETARIO COORD.',
    'SERV.PUB. II', 'SERV. PUB.COM', 'SERV.PUB.COM II', 'SINDICAL',
    'SUPERV.MTTO.SERV',
    'TERAPEUTA', 'TRABAJ. SOCIAL', 'TRASLADO A DIR.REL. FE',
    'VACACIONES', 'VIGILANTE', 'VIGILANTE EN REGIST.C',
    'ASIST. FORMACION INTEGRAL',
    'ASIST. INGENIERIA III',
    'ASIST. SERV. GENERALES',
    'ASIST.ADMON III',
    'ASIST.TEC.ADMON III',
    'ASISTENTE ADMINISTRATIVO',
    'ASISTENTE ADMON',
    'ASISTENTE DE OFICINA',
    'CONSEJEROS',
    'COORD. INSP.OBRAS',
    'COORD.PLANIF. OBRA',
    'DIRECTOR/A',
    'DIRECTORA ( E )',
    'INSPECTOR DE OBRAS',
    'SECRETARIA EJECUT.',
    'SECRETARIA EJECUTIVA',
    'SECRETARIA I',
    'SECRETARIA TECNICA',
    'SECRETARIO COORDINADOR',
    'SECRETARIO(A)',
    'SERV.PUB.CULTURAL',
    'SERVIDOR PUBLICO COMUNITARIO',
    'TRABAJADOR SOCIAL',
    // Cargos del Listado de Personal de la Alcaldia (jun 2026) — validados 1x1 con el usuario
    'SEGURIDAD', 'EJECUTIVO ADMON', 'SERV.PUB.C.CUL', 'ASIST.ANALISTA III', 'SERV. PUBLICO',
    'ANALISTA ADMON', 'AUDITOR I', 'AUDITOR III', 'AUDITOR INTERNO', 'COORD. REG.TEN.TIE',
    'COORD.S.P', 'SINDICA', 'COORD.RENTAS MPALES', 'ANALISTA RECAUDADOR', 'I.C.A.P.',
    'JEFE (A)', 'DEFENSOR', 'DEFENSORA', 'ASIST.ANAL.III', 'ASESOR', 'COORD.ADMON DE',
    'ASESOR (A)', 'COM.DEPORTE', 'COORD. BIENES M', 'COORD. TESORERIA', 'EJECUTIVO LAB.',
    'ADMINIST. ( E )', 'PROM. CUL. II', 'POLITICAS PUB.', 'ATENCION PUB.', 'PSICOLOGO',
    'COORD.GEST.CAUJAR', 'DIBUJANTE II'
  ].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }))

  // Rol principal: define si el empleado participa en el modulo Cuadrillas y
  // si recibe push de FCM cuando entra un reporte nuevo. La Edge Function
  // enviar-notif-fcm-cuadrilla filtra empleados con rol_principal IN
  // ('supervisor_cuadrilla','alcaldesa') para mandarles el push.
  const OPCIONES_ROL_PRINCIPAL = [
    { valor: 'empleado',             etiqueta: 'Empleado normal (default)' },
    { valor: 'trabajador_cuadrilla', etiqueta: 'Trabajador de cuadrilla (envia reportes)' },
    { valor: 'supervisor_cuadrilla', etiqueta: 'Supervisor de cuadrilla (recibe push de nuevos reportes)' },
    { valor: 'alcaldesa',            etiqueta: 'Alcaldesa (recibe push de nuevos reportes)' }
  ]

  // Estados para los campos de texto estándar (valores por defecto = mas comun)
  const [formulario, setFormulario] = useState({
    cedula: '',
    nombres: '',
    apellidos: '',
    departamento: OPCIONES_DEPARTAMENTOS[0],
    cargo: OPCIONES_CARGOS[0],
    tolerancia_minutos: 105,
    fecha_cumpleanos: '',
    telefono: '',
    oficina_id: '',  // sede / lugar de trabajo asignado (geofence)
    rol_principal: 'empleado'  // modulo Cuadrillas: empleado | trabajador_cuadrilla | supervisor_cuadrilla | alcaldesa
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

  // Super-admin gate para el boton "Ver clave". Solo Carlos.
  const [esSuperAdmin, setEsSuperAdmin] = useState(false)
  const [miCorreo, setMiCorreo] = useState('')
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const correo = data?.user?.email || ''
      setMiCorreo(correo)
      setEsSuperAdmin(correo === 'carlos.linares.es@gmail.com')
    })
  }, [])

  // Modal de ver clave
  const [verClaveModal, setVerClaveModal] = useState(null) // { cedula, nombre, clave, cargando, error }
  const verClaveDe = async (emp) => {
    setVerClaveModal({ cedula: emp.cedula, nombre: `${emp.nombres} ${emp.apellidos}`, clave: null, cargando: true, error: null })
    const { data, error } = await supabase.rpc('obtener_clave_empleado', {
      p_cedula: emp.cedula,
      p_admin_email: miCorreo
    })
    if (error) {
      setVerClaveModal(m => ({ ...m, cargando: false, error: error.message }))
    } else {
      setVerClaveModal(m => ({ ...m, cargando: false, clave: data, error: null }))
    }
  }

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

  // ───────────────────────────────────────────────────────────────────
  // Consulta CNE via Edge Function `consultar-cedula`. La function corre
  // en Deno dentro del dominio Supabase del proyecto y proxiya
  // api.cedula.com.ve (que no expone CORS). Las credenciales viven como
  // secrets de Supabase, NO en el cliente.
  //
  // Flujo: click → modal con loading → muestra los datos del CNE al
  // lado de los actuales del empleado → boton "Guardar cambios" hace
  // UPDATE en la tabla empleados solo de los campos que cambien.
  // ───────────────────────────────────────────────────────────────────
  const [modalCNE, setModalCNE] = useState({
    abierto: false,
    empleado: null,
    cargando: false,
    error: '',
    datos: null,        // payload.data de cedula.com.ve
    propuesta: null,    // { nombres, apellidos, fecha_cumpleanos } sugeridos
    guardando: false,
  })
  // Autocompletado por cedula en el formulario de Agregar Empleado: reusa el
  // Edge Function 'consultar-cedula' para prellenar nombres/apellidos/fecha_nac.
  const [buscandoCedula, setBuscandoCedula] = useState(false)
  const [errorBusquedaCedula, setErrorBusquedaCedula] = useState('')
  const cerrarModalCNE = () => setModalCNE({ abierto: false, empleado: null, cargando: false, error: '', datos: null, propuesta: null, guardando: false })

  const consultarCNE = async (emp) => {
    setModalCNE({ abierto: true, empleado: emp, cargando: true, error: '', datos: null, propuesta: null, guardando: false })
    const cedulaSoloNumeros = String(emp.cedula || '').replace(/\D/g, '')
    if (!cedulaSoloNumeros) {
      setModalCNE(s => ({ ...s, cargando: false, error: 'El empleado no tiene una cédula numérica válida.' }))
      return
    }
    try {
      const { data: resp, error: errFn } = await supabase.functions.invoke('consultar-cedula', {
        body: { cedula: cedulaSoloNumeros },
      })
      if (errFn) {
        setModalCNE(s => ({ ...s, cargando: false, error: `No se pudo invocar la función: ${errFn.message}. ¿Ya la desplegaste en Supabase?` }))
        return
      }
      if (resp?.error) {
        const mapa = {
          RECORD_NOT_FOUND: 'No se encontró esta cédula en el CNE.',
          INVALID_TOKEN: 'Credenciales de cedula.com.ve inválidas o vencidas.',
          MISSING_CREDENTIALS: 'Faltan los secrets CEDULA_APP_ID y CEDULA_TOKEN en Supabase.',
          DB_ERROR: 'El servicio devolvió un error de base de datos. Revisa el formato.',
          INVALID_CEDULA: 'Formato de cédula inválido (debe ser solo números, 5-9 dígitos).',
          PROXY_ERROR: 'No se pudo contactar a cedula.com.ve (problema de red del proxy).',
        }
        setModalCNE(s => ({ ...s, cargando: false, error: mapa[resp.error_str] || `Error: ${resp.error_str || 'desconocido'}` }))
        return
      }
      const d = resp?.data
      if (!d) {
        setModalCNE(s => ({ ...s, cargando: false, error: 'Respuesta vacía del servicio.' }))
        return
      }
      // Construir propuesta: nombres = primer_nombre + segundo (si lo hubiera);
      // apellidos = primer_apellido + segundo. El API a veces devuelve null en
      // segundo_nombre/segundo_apellido, por eso filtramos.
      const nombresProp = [d.primer_nombre, d.segundo_nombre].filter(Boolean).join(' ').trim()
      const apellidosProp = [d.primer_apellido, d.segundo_apellido].filter(Boolean).join(' ').trim()
      const fechaProp = d.fecha_nac || ''  // ya viene en formato YYYY-MM-DD
      setModalCNE(s => ({
        ...s,
        cargando: false,
        datos: d,
        propuesta: { nombres: nombresProp, apellidos: apellidosProp, fecha_cumpleanos: fechaProp },
      }))
    } catch (e) {
      setModalCNE(s => ({ ...s, cargando: false, error: `Error inesperado: ${e.message}` }))
    }
  }

  const aplicarCNE = async () => {
    if (!modalCNE.empleado || !modalCNE.propuesta) return
    setModalCNE(s => ({ ...s, guardando: true, error: '' }))
    // Solo actualizamos los campos que realmente cambian (asi el log de auditoria
    // queda mas limpio). Cualquier campo vacio en la propuesta se omite tambien.
    const patch = {}
    const { propuesta, empleado } = modalCNE
    if (propuesta.nombres && propuesta.nombres !== empleado.nombres) patch.nombres = propuesta.nombres
    if (propuesta.apellidos && propuesta.apellidos !== empleado.apellidos) patch.apellidos = propuesta.apellidos
    if (propuesta.fecha_cumpleanos && propuesta.fecha_cumpleanos !== empleado.fecha_cumpleanos) patch.fecha_cumpleanos = propuesta.fecha_cumpleanos
    if (Object.keys(patch).length === 0) {
      setModalCNE(s => ({ ...s, guardando: false, error: 'No hay cambios para guardar — los datos ya coinciden.' }))
      return
    }
    const { error: errUp } = await supabase.from('empleados').update(patch).eq('cedula', empleado.cedula)
    if (errUp) {
      setModalCNE(s => ({ ...s, guardando: false, error: `Error al guardar: ${errUp.message}` }))
      return
    }
    cerrarModalCNE()
    await obtenerEmpleados()
  }

  // Autocompleta los campos nombres/apellidos/fecha_cumpleanos del formulario
  // consultando el CNE por la cedula que el operador ya escribio. Mismo Edge
  // Function que consultarCNE() pero el destino es el state formulario, no un
  // modal de comparacion.
  const buscarCedulaParaForm = async () => {
    const cedulaSoloNumeros = String(formulario.cedula || '').replace(/\D/g, '')
    if (!cedulaSoloNumeros || cedulaSoloNumeros.length < 5) {
      setErrorBusquedaCedula('Escribe la cedula primero (solo numeros, 5-9 digitos).')
      return
    }
    setBuscandoCedula(true)
    setErrorBusquedaCedula('')
    try {
      const { data: resp, error: errFn } = await supabase.functions.invoke('consultar-cedula', {
        body: { cedula: cedulaSoloNumeros },
      })
      if (errFn) {
        setErrorBusquedaCedula(`No se pudo invocar el servicio: ${errFn.message}`)
        return
      }
      if (resp?.error) {
        const mapa = {
          RECORD_NOT_FOUND: 'No se encontro esta cedula en el CNE.',
          INVALID_TOKEN: 'Credenciales de cedula.com.ve invalidas o vencidas.',
          MISSING_CREDENTIALS: 'Faltan secrets en Supabase (CEDULA_APP_ID/CEDULA_TOKEN).',
          DB_ERROR: 'El servicio devolvio un error de base de datos.',
          INVALID_CEDULA: 'Formato invalido (solo numeros, 5-9 digitos).',
          PROXY_ERROR: 'No se pudo contactar a cedula.com.ve.',
        }
        setErrorBusquedaCedula(mapa[resp.error_str] || `Error: ${resp.error_str || 'desconocido'}`)
        return
      }
      const d = resp?.data
      if (!d) {
        setErrorBusquedaCedula('Respuesta vacia del servicio.')
        return
      }
      const nombresProp = [d.primer_nombre, d.segundo_nombre].filter(Boolean).join(' ').trim()
      const apellidosProp = [d.primer_apellido, d.segundo_apellido].filter(Boolean).join(' ').trim()
      const fechaProp = d.fecha_nac || ''
      setFormulario(f => ({
        ...f,
        nombres: nombresProp || f.nombres,
        apellidos: apellidosProp || f.apellidos,
        fecha_cumpleanos: fechaProp || f.fecha_cumpleanos,
      }))
      setMensaje({ texto: `Datos prellenados desde el CNE para V-${cedulaSoloNumeros}.`, tipo: 'success' })
    } catch (e) {
      setErrorBusquedaCedula(`Error inesperado: ${e.message}`)
    } finally {
      setBuscandoCedula(false)
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
      telefono: empleado.telefono || '',
      oficina_id: empleado.oficina_id || '',
      rol_principal: empleado.rol_principal || 'empleado'
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
      tolerancia_minutos: 105,
      fecha_cumpleanos: '',
      telefono: '',
      oficina_id: '',
      rol_principal: 'empleado'
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
      telefono: formulario.telefono?.trim() || null,
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

  // Filtro de busqueda del listado de servidores publicos (cedula, nombre, cargo, etc.)
  const _normLista = (s) => (s || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const _qLista = _normLista(busquedaLista.trim())
  const empleadosFiltrados = _qLista
    ? (listaEmpleados || []).filter(e => _normLista(`${e.cedula || ''} ${e.nombres || ''} ${e.apellidos || ''} ${e.telefono || ''} ${e.departamento || ''} ${e.cargo || ''}`).includes(_qLista))
    : (listaEmpleados || [])

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
            <div style={{ display: 'flex', gap: 6 }}>
              <input type="text" name="cedula" value={formulario.cedula} onChange={manejarCambio} required disabled={!!editandoId} placeholder="Ej: V12345678" style={{ ...estiloInputBase, flex: 1, border: '2px solid #6ee7b7', backgroundColor: editandoId ? '#f1f5f9' : '#ecfdf5', color: '#064e3b' }} />
              {!editandoId && (
                <button
                  type="button"
                  onClick={buscarCedulaParaForm}
                  disabled={buscandoCedula}
                  title="Buscar nombres/apellidos/fecha de nacimiento en el CNE"
                  style={{
                    padding: '0 14px',
                    backgroundColor: buscandoCedula ? '#cbd5e1' : '#0e7490',
                    color: 'white',
                    border: 'none',
                    borderRadius: 8,
                    cursor: buscandoCedula ? 'wait' : 'pointer',
                    fontSize: 12,
                    fontWeight: 800,
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}
                >
                  <IdCard size={14} /> {buscandoCedula ? 'Buscando…' : 'Buscar CNE'}
                </button>
              )}
            </div>
            {errorBusquedaCedula && (
              <div style={{ fontSize: 11, color: '#dc2626', fontWeight: 700, marginTop: 4 }}>
                {errorBusquedaCedula}
              </div>
            )}
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
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: '#b45309', marginBottom: '8px', textTransform: 'uppercase' }}>
              🦺 Tipo de Rol (Cuadrillas)
            </label>
            <select name="rol_principal" value={formulario.rol_principal || 'empleado'} onChange={manejarCambio} required
              style={{ ...estiloInputBase, borderColor: '#fbbf24', backgroundColor: '#fffbeb', color: '#92400e', fontWeight: 700 }}>
              {OPCIONES_ROL_PRINCIPAL.map(r => <option key={r.valor} value={r.valor}>{r.etiqueta}</option>)}
            </select>
            <div style={{ fontSize: 11, color: '#92400e', fontWeight: 600, marginTop: 4 }}>
              Define si el empleado participa en el módulo Cuadrillas. <strong>Supervisores</strong> y <strong>Alcaldesa</strong> reciben notificación push cuando entra un reporte nuevo.
            </div>
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

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: '#0e7490', marginBottom: '8px', textTransform: 'uppercase' }}>
              📞 Teléfono
            </label>
            <input type="tel" name="telefono" value={formulario.telefono || ''} onChange={manejarCambio} placeholder="Ej: 04141234567" style={{ ...estiloInputBase, borderColor: '#67e8f9', backgroundColor: '#ecfeff', color: '#155e75' }} />
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
        <div style={{ padding: '20px', borderBottom: '1px solid #f1f5f9', backgroundColor: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, color: '#1e293b', fontSize: '16px', fontWeight: '800', textTransform: 'uppercase' }}>Listado Oficial de Servidores Públicos</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
              <input value={busquedaLista} onChange={(e) => setBusquedaLista(e.target.value)} placeholder="Buscar por cédula, nombre o cargo…" aria-label="Buscar servidor público"
                style={{ padding: '10px 34px 10px 36px', border: '1px solid #cbd5e1', borderRadius: 10, fontSize: 14, width: 300, maxWidth: '72vw', outline: 'none', backgroundColor: 'white', color: '#0f172a' }} />
              {busquedaLista && (
                <button onClick={() => setBusquedaLista('')} title="Limpiar búsqueda" style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 2, display: 'inline-flex' }}><X size={15} /></button>
              )}
            </div>
            <span style={{ fontSize: 13, color: '#64748b', fontWeight: 700, whiteSpace: 'nowrap' }}>{empleadosFiltrados.length} de {(listaEmpleados || []).length}</span>
          </div>
        </div>
        <div style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '750px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', color: '#475569', fontSize: '12px', textTransform: 'uppercase', fontWeight: '800' }}>
                <th style={{ padding: '18px 20px', borderBottom: '2px solid #e2e8f0' }}>Cédula</th>
                <th style={{ padding: '18px 20px', borderBottom: '2px solid #e2e8f0' }}>Nombre Completo</th>
                <th style={{ padding: '18px 20px', borderBottom: '2px solid #e2e8f0' }}>Teléfono</th>
                <th style={{ padding: '18px 20px', borderBottom: '2px solid #e2e8f0' }}>Dirección / Cargo</th>
                <th style={{ padding: '18px 20px', borderBottom: '2px solid #e2e8f0' }}>Horario Asignado</th>
                <th style={{ padding: '18px 20px', borderBottom: '2px solid #e2e8f0' }}>Sede</th>
                <th style={{ padding: '18px 20px', borderBottom: '2px solid #e2e8f0', textAlign: 'center' }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {empleadosFiltrados.map((emp) => (
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
                      {emp.rol_principal && emp.rol_principal !== 'empleado' && (
                        <span style={{ backgroundColor: '#fef3c7', color: '#92400e', border: '1px solid #fbbf24', borderRadius: 10, padding: '3px 8px', fontSize: 10, fontWeight: 800, marginLeft: 8 }}>
                          {emp.rol_principal === 'trabajador_cuadrilla' ? '🦺 Cuadrilla' : emp.rol_principal === 'supervisor_cuadrilla' ? '🦺 Supervisor' : emp.rol_principal === 'alcaldesa' ? '🦺 Alcaldesa' : ''}
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '15px 20px', color: '#334155', fontWeight: '700' }}>{emp?.telefono || <span style={{ color: '#94a3b8', fontWeight: 600 }}>—</span>}</td>
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
                      <button onClick={() => consultarCNE(emp)}          title="Consultar datos en el CNE y previsualizar"   style={{ padding: '6px 10px', backgroundColor: '#ecfeff', color: '#0e7490', border: '1px solid #67e8f9', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4 }}><IdCard size={12} /> CNE</button>
                      <button onClick={() => activarModoEdicion(emp)}    title="Editar"    style={{ padding: '6px 10px', backgroundColor: '#f1f5f9', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Pencil size={12} /> Editar</button>
                      <button onClick={() => abrirSelectorFoto(emp.cedula)} title="Subir foto" style={{ padding: '6px 10px', backgroundColor: '#dbeafe', color: '#1e40af', border: '1px solid #93c5fd', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Camera size={12} /> Foto</button>
                      <button onClick={() => resetearClave(emp.cedula)}   title="Resetear clave" style={{ padding: '6px 10px', backgroundColor: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4 }}><KeyRound size={12} /> Clave</button>
                      {esSuperAdmin && (
                        <button onClick={() => verClaveDe(emp)} title="Ver clave actual (solo super-admin)"
                          style={{ padding: '6px 10px', backgroundColor: '#ede9fe', color: '#5b21b6', border: '1px solid #c4b5fd', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Eye size={12} /> Ver
                        </button>
                      )}
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
                <tr><td colSpan="7" style={{ padding: '30px', textAlign: 'center', color: '#94a3b8', fontWeight: 600 }}>Cargando listado...</td></tr>
              )}
              {!cargandoLista && errorLista && (
                <tr><td colSpan="7" style={{ padding: '30px', textAlign: 'center', color: '#ef4444', fontWeight: 700, backgroundColor: '#fef2f2' }}>⛔ {errorLista}</td></tr>
              )}
              {!cargandoLista && !errorLista && listaEmpleados.length === 0 && (
                <tr>
                  <td colSpan="7" style={{ padding: '30px', textAlign: 'center', color: '#64748b', fontWeight: '500' }}>No existen empleados registrados en el sistema de la Alcaldía.</td>
                </tr>
              )}
              {!cargandoLista && !errorLista && listaEmpleados.length > 0 && empleadosFiltrados.length === 0 && (
                <tr>
                  <td colSpan="7" style={{ padding: '30px', textAlign: 'center', color: '#64748b', fontWeight: '600' }}>No se encontró ningún servidor público con “{busquedaLista}”. Prueba otro término.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL VER CLAVE — solo super-admin */}
      {verClaveModal && (
        <div onClick={(e) => { if (e.target === e.currentTarget) setVerClaveModal(null) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'white', borderRadius: 14, padding: 24, maxWidth: 460, width: '100%', boxShadow: '0 20px 50px rgba(0,0,0,0.4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid #e2e8f0' }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, display: 'inline-flex', alignItems: 'center', gap: 8, color: '#5b21b6' }}>
                <Eye size={20} /> Clave actual del empleado
              </h3>
              <button onClick={() => setVerClaveModal(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b', padding: 4 }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ background: '#fef3c7', border: '1px solid #fbbf24', borderLeft: '4px solid #d97706', padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 12, color: '#78350f', fontWeight: 600, display: 'flex', gap: 8 }}>
              <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <strong>Información confidencial.</strong> Esta acción queda registrada en la auditoría con tu correo. No compartas esta clave con terceros ni la guardes fuera del sistema.
              </div>
            </div>

            <div style={{ fontSize: 13, color: '#475569', fontWeight: 700, marginBottom: 4 }}>{verClaveModal.nombre}</div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 14 }}>{verClaveModal.cedula}</div>

            {verClaveModal.cargando ? (
              <div style={{ padding: 30, textAlign: 'center', color: '#64748b', fontWeight: 600 }}>Descifrando...</div>
            ) : verClaveModal.error ? (
              <div style={{ padding: 12, background: '#fef2f2', color: '#991b1b', borderLeft: '3px solid #dc2626', borderRadius: 6, fontWeight: 700, fontSize: 13 }}>
                ⛔ {verClaveModal.error}
              </div>
            ) : verClaveModal.clave === null ? (
              <div style={{ padding: 14, background: '#f1f5f9', color: '#475569', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
                ⚠️ <strong>Clave no disponible.</strong> Este empleado tenía su clave antes de habilitar el registro reversible.
                Para verla, debes resetearle la clave con el botón <strong>"Clave"</strong>. La próxima vez que el empleado entre o cambie su clave, podrás verla aquí.
              </div>
            ) : (
              <>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', marginBottom: 6, textTransform: 'uppercase' }}>Clave actual</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14 }}>
                  <code style={{ flex: 1, padding: '14px 16px', backgroundColor: '#0f172a', color: '#f1f5f9', borderRadius: 8, fontSize: 18, fontWeight: 800, fontFamily: 'monospace', letterSpacing: 1, textAlign: 'center', wordBreak: 'break-all' }}>
                    {verClaveModal.clave}
                  </code>
                  <button onClick={() => { navigator.clipboard.writeText(verClaveModal.clave); alert('Clave copiada al portapapeles') }}
                    title="Copiar al portapapeles"
                    style={{ padding: 12, backgroundColor: '#5b21b6', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Copy size={16} />
                  </button>
                </div>
              </>
            )}

            <button onClick={() => setVerClaveModal(null)}
              style={{ width: '100%', padding: 12, background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', borderRadius: 8, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* MODAL CONSULTA CNE — muestra datos del CNE vs actuales y permite aplicar */}
      {modalCNE.abierto && (
        <div onClick={(e) => { if (e.target === e.currentTarget && !modalCNE.guardando) cerrarModalCNE() }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'white', borderRadius: 14, padding: 24, maxWidth: 560, width: '100%', boxShadow: '0 20px 50px rgba(0,0,0,0.4)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid #e2e8f0' }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, display: 'inline-flex', alignItems: 'center', gap: 8, color: '#0e7490' }}>
                <IdCard size={20} /> Consulta CNE — V-{modalCNE.empleado?.cedula}
              </h3>
              <button onClick={cerrarModalCNE} disabled={modalCNE.guardando}
                style={{ background: 'transparent', border: 'none', cursor: modalCNE.guardando ? 'not-allowed' : 'pointer', color: '#64748b', padding: 4, opacity: modalCNE.guardando ? 0.4 : 1 }}>
                <X size={20} />
              </button>
            </div>

            {modalCNE.cargando && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#0e7490', fontWeight: 700 }}>
                <RefreshCw size={32} style={{ animation: 'spin 1s linear infinite' }} />
                <div style={{ marginTop: 10 }}>Consultando registro electoral...</div>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            )}

            {modalCNE.error && (
              <div style={{ background: '#fef2f2', borderLeft: '4px solid #dc2626', padding: 12, borderRadius: 8, color: '#991b1b', fontSize: 13, fontWeight: 600, marginBottom: 14, display: 'flex', gap: 8 }}>
                <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
                <div>{modalCNE.error}</div>
              </div>
            )}

            {modalCNE.propuesta && !modalCNE.cargando && (
              <>
                <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: 12, marginBottom: 14, fontSize: 12, color: '#0c4a6e', fontWeight: 600 }}>
                  Compara los datos actuales en el sistema vs lo que devuelve el CNE. Al guardar, se actualizan solo los campos diferentes.
                </div>

                {[
                  { label: 'Nombres completos', key: 'nombres' },
                  { label: 'Apellidos completos', key: 'apellidos' },
                  { label: 'Fecha de nacimiento', key: 'fecha_cumpleanos' },
                ].map(({ label, key }) => {
                  const actual = modalCNE.empleado?.[key] || '—'
                  const propuesto = modalCNE.propuesta?.[key] || '—'
                  const igual = String(actual).trim().toUpperCase() === String(propuesto).trim().toUpperCase()
                  return (
                    <div key={key} style={{ marginBottom: 12, padding: 12, background: igual ? '#f1f5f9' : '#fefce8', borderRadius: 8, border: igual ? '1px solid #e2e8f0' : '1px solid #facc15' }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>{label}</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 13 }}>
                        <div>
                          <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, marginBottom: 2 }}>ACTUAL</div>
                          <div style={{ color: '#475569', fontWeight: 600 }}>{actual}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10, color: '#0e7490', fontWeight: 700, marginBottom: 2 }}>CNE</div>
                          <div style={{ color: igual ? '#475569' : '#92400e', fontWeight: igual ? 600 : 800 }}>{propuesto} {igual && '✓'}</div>
                        </div>
                      </div>
                    </div>
                  )
                })}

                {modalCNE.datos?.cne && (
                  <details style={{ marginTop: 8, marginBottom: 14, fontSize: 12, color: '#64748b' }}>
                    <summary style={{ cursor: 'pointer', fontWeight: 700, color: '#475569' }}>Otros datos del CNE (no se guardan aún)</summary>
                    <div style={{ marginTop: 8, padding: 10, background: '#f8fafc', borderRadius: 6, lineHeight: 1.7 }}>
                      <div><strong>RIF:</strong> {modalCNE.datos.rif || '—'}</div>
                      <div><strong>Estado:</strong> {modalCNE.datos.cne.estado || '—'}</div>
                      <div><strong>Municipio:</strong> {modalCNE.datos.cne.municipio || '—'}</div>
                      <div><strong>Parroquia:</strong> {modalCNE.datos.cne.parroquia || '—'}</div>
                      <div><strong>Centro electoral:</strong> {modalCNE.datos.cne.centro_electoral || '—'}</div>
                    </div>
                  </details>
                )}

                <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                  <button onClick={cerrarModalCNE} disabled={modalCNE.guardando}
                    style={{ flex: 1, padding: 12, background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', borderRadius: 8, fontWeight: 800, fontSize: 13, cursor: modalCNE.guardando ? 'not-allowed' : 'pointer', opacity: modalCNE.guardando ? 0.5 : 1 }}>
                    Cancelar
                  </button>
                  <button onClick={aplicarCNE} disabled={modalCNE.guardando}
                    style={{ flex: 2, padding: 12, background: '#0e7490', color: 'white', border: 'none', borderRadius: 8, fontWeight: 800, fontSize: 13, cursor: modalCNE.guardando ? 'not-allowed' : 'pointer', opacity: modalCNE.guardando ? 0.6 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    {modalCNE.guardando ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Guardando...</> : <><Save size={14} /> Guardar cambios</>}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}