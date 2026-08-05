// ============================================================================
// RegistroQR — pagina PUBLICA a la que lleva el codigo QR
// ----------------------------------------------------------------------------
// No pide login: la persona escanea el QR con el telefono, llena sus datos y
// el sistema le guarda la hora en que se registro. Es una asistencia aparte
// del control diario de empleados (tabla asistencia_qr, no asistencia_registros).
//
// La hora de SALIDA no se pide aca: queda en blanco a proposito porque se
// escribe a mano sobre la planilla impresa.
// ============================================================================
import { useState } from 'react'
import { supabase } from '../supabase'

const MUNICIPIOS_MIRANDA = [
  'Acevedo', 'Andrés Bello', 'Baruta', 'Brión', 'Buroz', 'Carrizal', 'Chacao',
  'Cristóbal Rojas', 'El Hatillo', 'Guaicaipuro', 'Independencia', 'Lander',
  'Los Salias', 'Páez', 'Paz Castillo', 'Pedro Gual', 'Plaza', 'Simón Bolívar',
  'Sucre', 'Urdaneta', 'Zamora'
]

// Hora y fecha del dispositivo. La jornada es presencial y el telefono esta en
// Venezuela, asi que la hora local del equipo es la correcta.
const dosDig = (n) => String(n).padStart(2, '0')
const ahoraLocal = () => {
  const d = new Date()
  return {
    fecha: `${d.getFullYear()}-${dosDig(d.getMonth() + 1)}-${dosDig(d.getDate())}`,
    hora: `${dosDig(d.getHours())}:${dosDig(d.getMinutes())}`
  }
}

const VACIO = { nombre: '', apellido: '', cedula: '', telefono: '', municipio: '', vec: '', cargo: '' }

export default function RegistroQR() {
  const [f, setF] = useState(VACIO)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [listo, setListo] = useState(null) // { hora, nombre }

  const set = (k) => (e) => setF((prev) => ({ ...prev, [k]: e.target.value }))

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
    const fila = {
      nombre, apellido, cedula,
      telefono: f.telefono.trim() || null,
      municipio: f.municipio || null,
      vec: f.vec.trim() || null,
      cargo: f.cargo.trim() || null,
      fecha,
      hora_entrada: hora
    }

    const { error: err } = await supabase.from('asistencia_qr').insert(fila)
    setEnviando(false)

    if (err) {
      // El indice unico (cedula, fecha) impide que la misma persona quede dos
      // veces en la misma jornada. Se le avisa en cristiano, no con el error crudo.
      if (err.code === '23505') {
        const { data } = await supabase
          .from('asistencia_qr')
          .select('hora_entrada')
          .eq('cedula', cedula).eq('fecha', fecha).maybeSingle()
        setError(`Esa cédula ya se registró hoy${data?.hora_entrada ? ` a las ${data.hora_entrada}` : ''}. No hace falta registrarse de nuevo.`)
        return
      }
      setError('No se pudo guardar. Revisa tu conexión e intenta de nuevo.')
      return
    }

    setListo({ hora, nombre: `${nombre} ${apellido}` })
  }

  // ---------------------------------------------------------------- estilos
  const S = {
    pantalla: { minHeight: '100vh', background: '#f1f5f9', display: 'flex', justifyContent: 'center', padding: '0 0 40px' },
    caja: { width: '100%', maxWidth: 480, background: '#fff', minHeight: '100vh', boxShadow: '0 0 40px rgba(0,0,0,.08)' },
    cintillo: { background: '#0a2351', color: '#fff', padding: '22px 20px', textAlign: 'center' },
    cuerpo: { padding: '22px 20px' },
    label: { display: 'block', fontSize: 13, fontWeight: 700, color: '#334155', margin: '14px 0 6px' },
    input: { width: '100%', padding: '13px 12px', fontSize: 16, border: '1px solid #cbd5e1', borderRadius: 8, background: '#fff', color: '#0f172a', boxSizing: 'border-box' },
    boton: { width: '100%', marginTop: 24, padding: '15px', fontSize: 16, fontWeight: 800, color: '#fff', background: '#0284c7', border: 'none', borderRadius: 8, cursor: 'pointer' },
    error: { marginTop: 16, padding: '12px 14px', background: '#fee2e2', border: '1px solid #f87171', borderLeft: '5px solid #ef4444', borderRadius: 8, color: '#991b1b', fontSize: 14, lineHeight: 1.5 },
    pie: { textAlign: 'center', fontSize: 12, color: '#64748b', padding: '18px 20px 0' }
  }

  // ---------------------------------------------------------------- exito
  if (listo) {
    return (
      <div style={S.pantalla}>
        <div style={S.caja}>
          <div style={S.cintillo}>
            <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: .5 }}>ALCALDÍA DE CRISTÓBAL ROJAS</div>
            <div style={{ fontSize: 12, opacity: .85, marginTop: 3 }}>Charallave · Estado Miranda</div>
          </div>
          <div style={{ ...S.cuerpo, textAlign: 'center', paddingTop: 44 }}>
            <div style={{ fontSize: 58 }}>✅</div>
            <h2 style={{ color: '#0a2351', margin: '10px 0 4px', fontSize: 23 }}>¡Asistencia registrada!</h2>
            <p style={{ color: '#475569', fontSize: 15, margin: 0 }}>{listo.nombre}</p>
            <div style={{ marginTop: 26, padding: '18px', background: '#ecfdf5', border: '1px solid #6ee7b7', borderRadius: 12 }}>
              <div style={{ fontSize: 13, color: '#047857', fontWeight: 700, letterSpacing: .5 }}>HORA DE ENTRADA</div>
              <div style={{ fontSize: 42, fontWeight: 800, color: '#065f46', lineHeight: 1.1, marginTop: 4 }}>{listo.hora}</div>
            </div>
            <p style={{ color: '#64748b', fontSize: 13.5, marginTop: 24, lineHeight: 1.6 }}>
              Ya puedes cerrar esta página. La <b>hora de salida</b> se firma al final de la jornada en la planilla impresa.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------- formulario
  return (
    <div style={S.pantalla}>
      <div style={S.caja}>
        <div style={S.cintillo}>
          <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: .5 }}>ALCALDÍA DE CRISTÓBAL ROJAS</div>
          <div style={{ fontSize: 12, opacity: .85, marginTop: 3 }}>Charallave · Estado Miranda</div>
          <div style={{ marginTop: 14, fontSize: 19, fontWeight: 800 }}>Registro de asistencia</div>
          <div style={{ fontSize: 12.5, opacity: .85, marginTop: 4 }}>Llena tus datos. La hora se toma sola.</div>
        </div>

        <form style={S.cuerpo} onSubmit={enviar}>
          <label style={S.label}>Nombre *</label>
          <input style={S.input} value={f.nombre} onChange={set('nombre')} autoComplete="given-name" />

          <label style={S.label}>Apellido *</label>
          <input style={S.input} value={f.apellido} onChange={set('apellido')} autoComplete="family-name" />

          <label style={S.label}>Cédula *</label>
          <input style={S.input} value={f.cedula} onChange={set('cedula')} inputMode="numeric" placeholder="Solo números" />

          <label style={S.label}>Teléfono</label>
          <input style={S.input} value={f.telefono} onChange={set('telefono')} inputMode="tel" placeholder="0412-1234567" />

          <label style={S.label}>Municipio</label>
          <select style={S.input} value={f.municipio} onChange={set('municipio')}>
            <option value="">Selecciona…</option>
            {MUNICIPIOS_MIRANDA.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>

          <label style={S.label}>VEC</label>
          <input style={S.input} value={f.vec} onChange={set('vec')} />

          <label style={S.label}>Cargo</label>
          <input style={S.input} value={f.cargo} onChange={set('cargo')} placeholder="Cargo que desempeña" />

          {error && <div style={S.error}>{error}</div>}

          <button type="submit" style={{ ...S.boton, opacity: enviando ? .7 : 1, cursor: enviando ? 'not-allowed' : 'pointer' }} disabled={enviando}>
            {enviando ? 'Registrando…' : 'Registrar mi asistencia'}
          </button>

          <p style={S.pie}>Los campos con * son obligatorios.</p>
        </form>
      </div>
    </div>
  )
}
