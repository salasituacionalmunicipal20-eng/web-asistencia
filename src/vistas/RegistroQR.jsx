// ============================================================================
// RegistroQR — pagina PUBLICA a la que lleva el codigo QR
// ----------------------------------------------------------------------------
// No pide login: la persona escanea el QR con el telefono, llena sus datos y
// el sistema le guarda la hora en que se registro. Es una asistencia aparte
// del control diario de empleados (tabla asistencia_qr, no asistencia_registros).
//
// Al escribir la cedula se consulta el CNE (misma Edge Function que usa la Sala
// Situacional) y se autocompletan nombre, apellido y municipio.
//
// Pensada para telefono: una sola columna, campos de 16px (menos de eso iOS
// hace zoom solo al enfocar) y botones altos para el dedo.
// ============================================================================
import { useState } from 'react'
import { supabase } from '../supabase'
import { MUNICIPIO_PROPIO, COMUNAS, UBCHS, comunidadesDe, datosDeComunidad } from '../lib/territorio'

const CNE_ENDPOINT = 'https://tfbzghjjfcaqmkzsxrrs.supabase.co/functions/v1/consultar-cedula'

// Valor centinela del desplegable de municipio. No se guarda nunca: solo sirve
// para saber que hay que mostrar el campo de texto libre.
const OTRO_MUNICIPIO = '__OTRO__'

const MUNICIPIOS_MIRANDA = [
  'Acevedo', 'Andrés Bello', 'Baruta', 'Brión', 'Buroz', 'Carrizal', 'Chacao',
  'Cristóbal Rojas', 'El Hatillo', 'Guaicaipuro', 'Independencia', 'Lander',
  'Los Salias', 'Páez', 'Paz Castillo', 'Pedro Gual', 'Plaza', 'Simón Bolívar',
  'Sucre', 'Urdaneta', 'Zamora'
]

// El CNE devuelve el municipio en mayusculas y sin acentos. Se busca el
// equivalente de la lista para poder seleccionarlo en el desplegable.
const sinAcentos = (s) => (s || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase().trim()
const municipioDeLista = (delCne) => {
  const buscado = sinAcentos(delCne)
  if (!buscado) return ''
  return MUNICIPIOS_MIRANDA.find((m) => sinAcentos(m) === buscado) || ''
}

// El CNE devuelve los nombres en mayusculas; se pasan a Tipo Titulo para que
// combinen con el resto de la lista de municipios.
const tituloCase = (s) => (s || '').toLowerCase().replace(/(^|\s|-)([a-záéíóúñ])/g, (_, p, c) => p + c.toUpperCase())

const dosDig = (n) => String(n).padStart(2, '0')
const ahoraLocal = () => {
  const d = new Date()
  return {
    fecha: `${d.getFullYear()}-${dosDig(d.getMonth() + 1)}-${dosDig(d.getDate())}`,
    hora: `${dosDig(d.getHours())}:${dosDig(d.getMinutes())}`
  }
}

const VACIO = { nombre: '', apellido: '', cedula: '', sexo: '', telefono: '', municipio: '', comuna: '', comunidad: '', ubch: '', cargo: '' }

export default function RegistroQR() {
  const [f, setF] = useState(VACIO)
  const [nacionalidad, setNacionalidad] = useState('V')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [listo, setListo] = useState(null)

  const [cneEstado, setCneEstado] = useState('') // '', 'buscando', 'ok', 'nada', 'error'
  const [cneDatos, setCneDatos] = useState(null)
  // true cuando el municipio no esta en la lista y se escribe a mano
  const [muniOtro, setMuniOtro] = useState(false)

  const set = (k) => (e) => setF((prev) => ({ ...prev, [k]: e.target.value }))

  // Solo hay data territorial de Cristobal Rojas. Para otros municipios los
  // campos siguen siendo texto libre, si no la gente de afuera no podria llenarlos.
  const esPropio = f.municipio === MUNICIPIO_PROPIO

  // Al cambiar de municipio se limpian comuna/comunidad/UBCH: los de un
  // municipio no aplican al otro y quedarian datos cruzados.
  const cambiarMunicipio = (e) => {
    const v = e.target.value
    const otro = v === OTRO_MUNICIPIO
    setMuniOtro(otro)
    setF((p) => ({ ...p, municipio: otro ? '' : v, comuna: '', comunidad: '', ubch: '' }))
  }

  const cambiarComuna = (e) =>
    setF((p) => ({ ...p, comuna: e.target.value, comunidad: '', ubch: '' }))

  // Cada comunidad tiene una sola UBCH, asi que al elegirla se llena sola.
  const cambiarComunidad = (e) => {
    const c = e.target.value
    const d = datosDeComunidad(c)
    setF((p) => ({ ...p, comunidad: c, ubch: d ? d.ubch : p.ubch }))
  }

  // ------------------------------------------------------------- CNE
  const consultarCNE = async () => {
    const num = f.cedula.replace(/\D/g, '')
    if (num.length < 4 || num.length > 10) return

    setCneEstado('buscando'); setCneDatos(null)
    try {
      const resp = await fetch(CNE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cedula: num, nacionalidad })
      })
      if (!resp.ok) { setCneEstado('error'); return }
      const json = await resp.json()
      const d = json && json.data
      if (!d || json.error) { setCneEstado('nada'); return }

      const nom = [d.primer_nombre, d.segundo_nombre].filter(Boolean).join(' ').trim()
      const ape = [d.primer_apellido, d.segundo_apellido].filter(Boolean).join(' ').trim()
      const muniCne = ((d.cne && d.cne.municipio) || '').trim()
      const muni = municipioDeLista(muniCne)
      // Si vota fuera de Miranda, el municipio no esta en la lista: se pasa a
      // "Otro" y se escribe el nombre que dio el CNE, para no perder el dato.
      const fueraDeLista = !muni && !!muniCne
      const municipioVacio = !f.municipio

      setF((prev) => ({
        ...prev,
        // Solo se rellena lo que este vacio: si la persona ya escribio algo, manda ella.
        nombre: prev.nombre.trim() ? prev.nombre : nom,
        apellido: prev.apellido.trim() ? prev.apellido : ape,
        municipio: prev.municipio ? prev.municipio : (muni || (fueraDeLista ? tituloCase(muniCne) : ''))
      }))
      if (fueraDeLista && municipioVacio) setMuniOtro(true)
      setCneDatos(d)
      setCneEstado('ok')
    } catch {
      setCneEstado('error')
    }
  }

  // ------------------------------------------------------------- guardar
  const enviar = async (e) => {
    e.preventDefault()
    setError('')

    const nombre = f.nombre.trim()
    const apellido = f.apellido.trim()
    const cedula = f.cedula.replace(/\D/g, '')

    if (!nombre) { setError('Escribe tu nombre.'); return }
    if (!apellido) { setError('Escribe tu apellido.'); return }
    if (cedula.length < 6) { setError('La cédula no parece correcta. Escríbela solo con números.'); return }

    setEnviando(true)
    const { fecha, hora } = ahoraLocal()
    const { error: err } = await supabase.from('asistencia_qr').insert({
      nombre, apellido, cedula,
      sexo: f.sexo || null,
      telefono: f.telefono.trim() || null,
      municipio: f.municipio || null,
      comuna: f.comuna.trim() || null,
      comunidad: f.comunidad.trim() || null,
      ubch: f.ubch.trim() || null,
      cargo: f.cargo.trim() || null,
      fecha,
      hora_entrada: hora
    })
    setEnviando(false)

    if (err) {
      // El indice unico (cedula, fecha) impide que la misma persona quede dos
      // veces en la misma jornada. Se le avisa en cristiano, no con el error crudo.
      if (err.code === '23505') {
        const { data } = await supabase
          .from('asistencia_qr').select('hora_entrada')
          .eq('cedula', cedula).eq('fecha', fecha).maybeSingle()
        setError(`Esa cédula ya se registró hoy${data?.hora_entrada ? ` a las ${data.hora_entrada}` : ''}. No hace falta registrarse de nuevo.`)
        return
      }
      setError('No se pudo guardar. Revisa tu conexión e intenta de nuevo.')
      return
    }

    setListo({ hora, nombre: `${nombre} ${apellido}` })
  }

  // ------------------------------------------------------------- estilos
  const S = {
    pantalla: { minHeight: '100vh', background: '#f1f5f9', display: 'flex', justifyContent: 'center' },
    caja: { width: '100%', maxWidth: 480, background: '#fff', minHeight: '100vh', boxShadow: '0 0 40px rgba(0,0,0,.08)' },
    cintillo: { background: '#0a2351', color: '#fff', padding: '20px 18px', textAlign: 'center' },
    // textAlign left explicito: el #root global de la app trae text-align:center
    // y sin esto las etiquetas del formulario salen centradas.
    cuerpo: { padding: '18px 18px calc(34px + env(safe-area-inset-bottom))', textAlign: 'left' },
    label: { display: 'block', fontSize: 13, fontWeight: 700, color: '#334155', margin: '15px 0 6px' },
    input: { width: '100%', minHeight: 48, padding: '12px', fontSize: 16, border: '1px solid #cbd5e1', borderRadius: 10, background: '#fff', color: '#0f172a', boxSizing: 'border-box', WebkitAppearance: 'none' },
    boton: { width: '100%', marginTop: 26, minHeight: 54, fontSize: 17, fontWeight: 800, color: '#fff', background: '#0284c7', border: 'none', borderRadius: 10 },
    error: { marginTop: 16, padding: '12px 14px', background: '#fee2e2', border: '1px solid #f87171', borderLeft: '5px solid #ef4444', borderRadius: 10, color: '#991b1b', fontSize: 14, lineHeight: 1.5 }
  }

  // ------------------------------------------------------------- exito
  if (listo) {
    return (
      <div style={S.pantalla}>
        <div style={S.caja}>
          <div style={S.cintillo}>
            <div style={{ fontSize: 14.5, fontWeight: 800, letterSpacing: .4 }}>ALCALDÍA DE CRISTÓBAL ROJAS</div>
            <div style={{ fontSize: 12, opacity: .85, marginTop: 3 }}>Charallave · Estado Miranda</div>
          </div>
          <div style={{ ...S.cuerpo, textAlign: 'center', paddingTop: 42 }}>
            <div style={{ fontSize: 58 }}>✅</div>
            <h2 style={{ color: '#0a2351', margin: '10px 0 4px', fontSize: 23 }}>¡Asistencia registrada!</h2>
            <p style={{ color: '#475569', fontSize: 15, margin: 0 }}>{listo.nombre}</p>
            <div style={{ marginTop: 24, padding: 18, background: '#ecfdf5', border: '1px solid #6ee7b7', borderRadius: 12 }}>
              <div style={{ fontSize: 12.5, color: '#047857', fontWeight: 700, letterSpacing: .5 }}>HORA DE ENTRADA</div>
              <div style={{ fontSize: 42, fontWeight: 800, color: '#065f46', lineHeight: 1.1, marginTop: 4 }}>{listo.hora}</div>
            </div>
            <p style={{ color: '#64748b', fontSize: 13.5, marginTop: 22, lineHeight: 1.6 }}>
              Ya puedes cerrar esta página. La <b>hora de salida</b> se firma al final de la jornada en la planilla impresa.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ------------------------------------------------------------- formulario
  const cne = cneDatos?.cne || {}
  return (
    <div style={S.pantalla}>
      <div style={S.caja}>
        <div style={S.cintillo}>
          <div style={{ fontSize: 14.5, fontWeight: 800, letterSpacing: .4 }}>ALCALDÍA DE CRISTÓBAL ROJAS</div>
          <div style={{ fontSize: 12, opacity: .85, marginTop: 3 }}>Charallave · Estado Miranda</div>
          <div style={{ marginTop: 13, fontSize: 19, fontWeight: 800 }}>Registro de asistencia</div>
          <div style={{ fontSize: 12.5, opacity: .85, marginTop: 4 }}>La hora se toma sola al registrarte.</div>
        </div>

        <form style={S.cuerpo} onSubmit={enviar} noValidate>
          {/* Cedula primero: al buscarla en el CNE se llenan solos varios campos */}
          <label style={S.label}>Cédula *</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <select
              style={{ ...S.input, width: 76, flex: 'none', fontWeight: 700, textAlign: 'center' }}
              value={nacionalidad}
              onChange={(e) => setNacionalidad(e.target.value)}
              aria-label="Nacionalidad"
            >
              <option value="V">V</option>
              <option value="E">E</option>
            </select>
            <input
              style={{ ...S.input, flex: 1, minWidth: 0 }}
              value={f.cedula}
              onChange={(e) => { setF((p) => ({ ...p, cedula: e.target.value })); setCneEstado(''); setCneDatos(null) }}
              onBlur={consultarCNE}
              inputMode="numeric"
              placeholder="Solo números"
            />
          </div>
          <button
            type="button"
            onClick={consultarCNE}
            disabled={cneEstado === 'buscando'}
            style={{ width: '100%', marginTop: 8, minHeight: 44, fontSize: 14, fontWeight: 700, color: '#0a2351', background: '#e0f2fe', border: '1px solid #7dd3fc', borderRadius: 10 }}
          >
            {cneEstado === 'buscando' ? 'Consultando CNE…' : '🔍 Buscar mis datos en el CNE'}
          </button>

          {cneEstado === 'ok' && (
            <div style={{ marginTop: 10, padding: '12px 14px', background: '#ecfdf5', border: '1px solid #6ee7b7', borderRadius: 10, fontSize: 13, color: '#065f46', lineHeight: 1.6 }}>
              <b>✓ Encontrado en el CNE.</b> Revisa que los datos estén bien y corrige lo que haga falta.
              {(cne.centro_electoral || cne.parroquia) && (
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #a7f3d0', fontSize: 12.5, color: '#047857' }}>
                  <b>Dónde vota:</b> {[cne.parroquia, cne.municipio].filter(Boolean).join(', ')}
                  {cne.centro_electoral && <><br />{cne.centro_electoral}</>}
                </div>
              )}
            </div>
          )}
          {cneEstado === 'nada' && (
            <div style={{ marginTop: 10, padding: '11px 14px', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 10, fontSize: 13, color: '#78350f', lineHeight: 1.5 }}>
              No apareció en el CNE. No hay problema: llena tus datos a mano y sigue.
            </div>
          )}
          {cneEstado === 'error' && (
            <div style={{ marginTop: 10, padding: '11px 14px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 10, fontSize: 13, color: '#475569', lineHeight: 1.5 }}>
              No se pudo consultar el CNE ahora. Llena tus datos a mano y sigue igual.
            </div>
          )}

          <label style={S.label}>Nombre *</label>
          <input style={S.input} value={f.nombre} onChange={set('nombre')} autoComplete="given-name" autoCapitalize="words" />

          <label style={S.label}>Apellido *</label>
          <input style={S.input} value={f.apellido} onChange={set('apellido')} autoComplete="family-name" autoCapitalize="words" />

          <label style={S.label}>Sexo</label>
          <select style={S.input} value={f.sexo} onChange={set('sexo')}>
            <option value="">Selecciona…</option>
            <option value="Femenino">Femenino</option>
            <option value="Masculino">Masculino</option>
          </select>

          <label style={S.label}>Teléfono</label>
          <input style={S.input} value={f.telefono} onChange={set('telefono')} inputMode="tel" autoComplete="tel" placeholder="0412-1234567" />

          <label style={S.label}>Municipio</label>
          <select style={S.input} value={muniOtro ? OTRO_MUNICIPIO : f.municipio} onChange={cambiarMunicipio}>
            <option value="">Selecciona…</option>
            {MUNICIPIOS_MIRANDA.map((m) => <option key={m} value={m}>{m}</option>)}
            <option value={OTRO_MUNICIPIO}>Otro (no aparece en la lista)</option>
          </select>
          {muniOtro && (
            <input
              style={{ ...S.input, marginTop: 8 }}
              value={f.municipio}
              onChange={set('municipio')}
              autoCapitalize="words"
              placeholder="Escribe tu municipio"
              autoFocus
            />
          )}

          {esPropio ? (
            <>
              <label style={S.label}>Comuna</label>
              <select style={S.input} value={f.comuna} onChange={cambiarComuna}>
                <option value="">Selecciona…</option>
                {COMUNAS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>

              <label style={S.label}>Comunidad</label>
              <select
                style={{ ...S.input, opacity: f.comuna ? 1 : .55 }}
                value={f.comunidad}
                onChange={cambiarComunidad}
                disabled={!f.comuna}
              >
                <option value="">{f.comuna ? 'Selecciona…' : 'Elige primero la comuna'}</option>
                {comunidadesDe(f.comuna).map((c) => <option key={c} value={c}>{c}</option>)}
              </select>

              <label style={S.label}>UBCH</label>
              <select style={S.input} value={f.ubch} onChange={set('ubch')}>
                <option value="">Selecciona…</option>
                {UBCHS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
              {f.comunidad && f.ubch && (
                <div style={{ marginTop: 6, fontSize: 12.5, color: '#047857' }}>
                  Se llenó sola según tu comunidad. Si votas en otra, cámbiala.
                </div>
              )}
            </>
          ) : (
            <>
              <label style={S.label}>Comuna</label>
              <input style={S.input} value={f.comuna} onChange={set('comuna')} autoCapitalize="words" placeholder="Nombre de la comuna" />

              <label style={S.label}>Comunidad</label>
              <input style={S.input} value={f.comunidad} onChange={set('comunidad')} autoCapitalize="words" placeholder="Sector o comunidad donde vive" />

              <label style={S.label}>UBCH</label>
              <input style={S.input} value={f.ubch} onChange={set('ubch')} autoCapitalize="words" placeholder="Unidad de Batalla Bolívar-Chávez" />
            </>
          )}

          <label style={S.label}>Cargo</label>
          <input style={S.input} value={f.cargo} onChange={set('cargo')} autoCapitalize="words" placeholder="Cargo que desempeña" />

          {error && <div style={S.error}>{error}</div>}

          <button
            type="submit"
            style={{ ...S.boton, opacity: enviando ? .7 : 1 }}
            disabled={enviando}
          >
            {enviando ? 'Registrando…' : 'Registrar mi asistencia'}
          </button>

          <p style={{ textAlign: 'center', fontSize: 12, color: '#64748b', marginTop: 16 }}>
            Los campos con * son obligatorios.
          </p>
        </form>
      </div>
    </div>
  )
}
