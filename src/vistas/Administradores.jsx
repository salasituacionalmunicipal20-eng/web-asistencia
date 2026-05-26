import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { ShieldCheck, UserPlus, Trash2, Power, PowerOff, Mail, KeyRound, User } from 'lucide-react'
import { useIsMobile } from '../hooks/useIsMobile'
import { useTema } from '../theme/ThemeProvider'

/**
 * Gestión de administradores web. Permite al admin actual:
 *   - Ver la whitelist de la tabla administradores_web
 *   - Crear nuevos administradores (auth.users + administradores_web)
 *   - Activar/Desactivar (sin borrar)
 *   - Eliminar (solo de la whitelist; el usuario Auth permanece, se borra desde Studio)
 *
 * El alta usa un cliente Supabase SECUNDARIO para que el signUp del nuevo
 * admin no sobreescriba la sesion del admin actual.
 */
export default function Administradores() {
  const isMobile = useIsMobile()
  const { t } = useTema()
  const [admins, setAdmins] = useState([])
  const [cargando, setCargando] = useState(false)
  const [form, setForm] = useState({ correo: '', nombre: '', clave: '' })
  const [enviando, setEnviando] = useState(false)
  const [mensaje, setMensaje] = useState({ texto: '', tipo: '' })
  const [miCorreo, setMiCorreo] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMiCorreo(data?.user?.email || ''))
  }, [])

  const obtenerAdmins = useCallback(async () => {
    setCargando(true)
    const { data, error } = await supabase
      .from('administradores_web')
      .select('*')
      .order('fecha_creacion', { ascending: false })
    if (!error) setAdmins(data || [])
    setCargando(false)
  }, [])

  useEffect(() => { obtenerAdmins() }, [obtenerAdmins])

  const manejarCambio = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const crearAdmin = async (e) => {
    e.preventDefault()

    const correo = form.correo.toLowerCase().trim()
    const nombre = form.nombre.trim()
    const clave  = form.clave

    if (!correo || !nombre || !clave) {
      setMensaje({ texto: '⛔ Completa correo, nombre y clave', tipo: 'error' }); return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
      setMensaje({ texto: '⛔ El correo no tiene un formato válido', tipo: 'error' }); return
    }
    if (clave.length < 6) {
      setMensaje({ texto: '⛔ La clave debe tener al menos 6 caracteres', tipo: 'error' }); return
    }
    if (admins.some(a => a.correo === correo)) {
      setMensaje({ texto: '⛔ Ese correo ya está registrado como administrador', tipo: 'error' }); return
    }

    setEnviando(true)
    setMensaje({ texto: 'Creando administrador...', tipo: 'info' })

    try {
      // Cliente SECUNDARIO para no tocar la sesion actual del admin que esta logueado.
      const secondary = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY,
        { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
      )

      // 1. Crear el usuario en Supabase Auth
      const { data: signupData, error: signupErr } = await secondary.auth.signUp({
        email: correo,
        password: clave
      })
      if (signupErr) throw signupErr

      // 2. Agregar a la tabla administradores_web (whitelist)
      const { error: insertErr } = await supabase
        .from('administradores_web')
        .insert({ correo, nombre, activo: true })
      if (insertErr) throw insertErr

      // 3. Cerrar el cliente secundario para no dejarlo colgado
      await secondary.auth.signOut().catch(() => {})

      const needsConfirm = signupData?.user && !signupData.user.confirmed_at && !signupData.user.email_confirmed_at
      setMensaje({
        texto: needsConfirm
          ? `✅ Administrador creado. ${correo} recibió un correo de confirmación. Hasta confirmarlo no podrá ingresar.`
          : `✅ Administrador ${correo} creado y listo para iniciar sesión.`,
        tipo: 'exito'
      })
      setForm({ correo: '', nombre: '', clave: '' })
      obtenerAdmins()
    } catch (e) {
      const msg = (e.message || 'Error desconocido').toLowerCase()
      let amigable = e.message
      if (msg.includes('already registered') || msg.includes('already exists')) {
        amigable = 'Ese correo ya tiene una cuenta. Si es admin nuevo, solo agrégalo a la whitelist; si no, contáctame.'
      } else if (msg.includes('password')) {
        amigable = 'La clave no cumple los requisitos de Supabase. Usa al menos 6 caracteres.'
      }
      setMensaje({ texto: `⛔ ${amigable}`, tipo: 'error' })
    } finally {
      setEnviando(false)
    }
  }

  const toggleActivo = async (admin) => {
    if (admin.correo === miCorreo && admin.activo) {
      alert('No puedes desactivarte a ti mismo. Pídele a otro administrador que lo haga.')
      return
    }
    const { error } = await supabase
      .from('administradores_web')
      .update({ activo: !admin.activo })
      .eq('correo', admin.correo)
    if (error) alert(`Error: ${error.message}`)
    else obtenerAdmins()
  }

  const eliminar = async (admin) => {
    if (admin.correo === miCorreo) {
      alert('No puedes eliminarte a ti mismo del panel.')
      return
    }
    const confirma = confirm(`¿Eliminar a ${admin.correo} del listado de administradores?\n\nNota: El usuario en Supabase Auth NO se borra automáticamente. Si quieres eliminarlo del sistema completo, debes borrarlo desde Supabase Studio → Authentication → Users.`)
    if (!confirma) return
    const { error } = await supabase
      .from('administradores_web')
      .delete()
      .eq('correo', admin.correo)
    if (error) alert(`Error: ${error.message}`)
    else obtenerAdmins()
  }

  const estiloInput = {
    width: '100%', padding: '12px 14px', boxSizing: 'border-box',
    borderRadius: 8, border: `1px solid ${t.border}`, fontSize: 14,
    backgroundColor: t.bgInput, color: t.text, fontWeight: 500, outline: 'none'
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: isMobile ? 5 : 0 }}>

      <div style={{ marginBottom: 24, background: 'linear-gradient(135deg, #4f46e5, #1e1b4b)', padding: 25, borderRadius: 16, color: 'white' }}>
        <h1 style={{ margin: 0, fontSize: isMobile ? 22 : 28, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}>
          <ShieldCheck size={32} /> Administradores del Panel
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: 14, opacity: 0.92 }}>
          Crea, activa o elimina administradores con acceso al panel web. Los empleados de la app son otros usuarios distintos.
        </p>
      </div>

      {/* FORM ALTA */}
      <div style={{ backgroundColor: t.bgPanel, padding: 24, borderRadius: 14, border: `1px solid ${t.border}`, marginBottom: 22, boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 800, color: t.text, textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 8 }}>
          <UserPlus size={18} color={t.primario} /> Crear nuevo administrador
        </h3>

        <form onSubmit={crearAdmin} style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: t.textSoft, marginBottom: 6, textTransform: 'uppercase' }}>Correo electrónico</label>
            <input type="email" name="correo" value={form.correo} onChange={manejarCambio} required placeholder="nuevo@charallave.gob.ve" style={estiloInput} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: t.textSoft, marginBottom: 6, textTransform: 'uppercase' }}>Nombre completo</label>
            <input type="text" name="nombre" value={form.nombre} onChange={manejarCambio} required placeholder="Juan Pérez" style={estiloInput} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: t.textSoft, marginBottom: 6, textTransform: 'uppercase' }}>Clave inicial</label>
            <input type="text" name="clave" value={form.clave} onChange={manejarCambio} required minLength={6} placeholder="mínimo 6 caracteres" style={estiloInput} />
          </div>
          <button type="submit" disabled={enviando}
            style={{ gridColumn: isMobile ? '1' : '1 / -1', padding: 14, background: t.primario, color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 800, cursor: enviando ? 'wait' : 'pointer', opacity: enviando ? 0.7 : 1, textTransform: 'uppercase', letterSpacing: 0.5, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <UserPlus size={16} /> {enviando ? 'Creando...' : 'Crear administrador'}
          </button>
        </form>

        {mensaje.texto && (
          <div style={{ marginTop: 14, padding: '11px 14px', borderRadius: 6, backgroundColor: mensaje.tipo === 'error' ? '#fef2f2' : (mensaje.tipo === 'exito' ? '#f0fdf4' : '#eff6ff'), color: mensaje.tipo === 'error' ? '#991b1b' : (mensaje.tipo === 'exito' ? '#166534' : '#1e40af'), borderLeft: `3px solid ${mensaje.tipo === 'error' ? '#dc2626' : (mensaje.tipo === 'exito' ? '#16a34a' : '#2563eb')}`, fontSize: 13.5, fontWeight: 600 }}>
            {mensaje.texto}
          </div>
        )}

        <div style={{ marginTop: 14, padding: 12, background: t.avisoBg, borderLeft: `3px solid ${t.aviso}`, borderRadius: 6, fontSize: 12.5, color: t.text, lineHeight: 1.5 }}>
          <strong>💡 Importante:</strong> Si tu Supabase tiene <strong>"Confirm email"</strong> activado en Authentication → Providers → Email, el nuevo administrador recibirá un correo de confirmación y no podrá entrar hasta hacer clic en el enlace. Para evitar eso, desactiva esa opción o confirma manualmente al usuario desde Supabase Studio → Authentication → Users.
        </div>
      </div>

      {/* LISTA */}
      <div style={{ backgroundColor: t.bgPanel, borderRadius: 14, border: `1px solid ${t.border}`, overflow: 'hidden', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${t.borderSoft}`, backgroundColor: t.bgTableHead }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: t.text, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Administradores registrados ({admins.length})
          </h3>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
            <thead>
              <tr style={{ backgroundColor: t.bgTableHead, color: t.textSoft, fontSize: 11, textTransform: 'uppercase', fontWeight: 800 }}>
                <th style={{ padding: '12px 16px', borderBottom: `2px solid ${t.border}`, textAlign: 'left' }}>Correo</th>
                <th style={{ padding: '12px 16px', borderBottom: `2px solid ${t.border}`, textAlign: 'left' }}>Nombre</th>
                <th style={{ padding: '12px 16px', borderBottom: `2px solid ${t.border}`, textAlign: 'left' }}>Registrado</th>
                <th style={{ padding: '12px 16px', borderBottom: `2px solid ${t.border}`, textAlign: 'center' }}>Estado</th>
                <th style={{ padding: '12px 16px', borderBottom: `2px solid ${t.border}`, textAlign: 'center' }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {admins.length === 0 && (
                <tr><td colSpan="5" style={{ padding: 32, textAlign: 'center', color: t.textMuted, fontWeight: 600 }}>
                  {cargando ? 'Cargando...' : 'No hay administradores registrados.'}
                </td></tr>
              )}
              {admins.map(a => {
                const esYo = a.correo === miCorreo
                return (
                  <tr key={a.correo} style={{ borderBottom: `1px solid ${t.borderSoft}`, fontSize: 13.5 }}>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: t.primario }}>
                      {a.correo} {esYo && <span style={{ marginLeft: 6, fontSize: 11, color: t.exito, fontWeight: 800 }}>(tú)</span>}
                    </td>
                    <td style={{ padding: '12px 16px', color: t.text, fontWeight: 600 }}>{a.nombre || '--'}</td>
                    <td style={{ padding: '12px 16px', color: t.textSoft, fontWeight: 500, fontSize: 12 }}>
                      {a.fecha_creacion ? new Date(a.fecha_creacion).toLocaleDateString('es-VE') : '--'}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <span style={{ padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', backgroundColor: a.activo ? t.exitoBg : t.errorBg, color: a.activo ? t.exito : t.error }}>
                        {a.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <button onClick={() => toggleActivo(a)} disabled={esYo && a.activo}
                          title={a.activo ? 'Desactivar' : 'Activar'}
                          style={{ padding: 8, backgroundColor: a.activo ? t.errorBg : t.exitoBg, color: a.activo ? t.error : t.exito, border: `1px solid ${a.activo ? t.error : t.exito}`, borderRadius: 6, cursor: esYo && a.activo ? 'not-allowed' : 'pointer', opacity: esYo && a.activo ? 0.4 : 1 }}>
                          {a.activo ? <PowerOff size={12} /> : <Power size={12} />}
                        </button>
                        <button onClick={() => eliminar(a)} disabled={esYo}
                          title="Eliminar"
                          style={{ padding: 8, backgroundColor: t.errorBg, color: t.error, border: `1px solid ${t.error}`, borderRadius: 6, cursor: esYo ? 'not-allowed' : 'pointer', opacity: esYo ? 0.4 : 1 }}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
