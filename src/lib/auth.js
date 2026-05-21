import { supabase } from '../supabase'

// Verifica si el email tiene permiso de administrador consultando la tabla `administradores`.
// La tabla debe existir en Supabase (ver SUPABASE_SETUP.sql) con `email` como primary key.
// Devuelve { admin: true, nombre? } si está autorizado, o { admin: false, motivo } si no.
export async function verificarAdmin(email) {
  if (!email) return { admin: false, motivo: 'Sin email en la sesión.' }

  const { data, error } = await supabase
    .from('administradores')
    .select('email, nombre')
    .eq('email', email)
    .maybeSingle()

  if (error) {
    // Si la tabla no existe o RLS bloquea, fallar cerrado (deniega acceso)
    return {
      admin: false,
      motivo: `No se pudo validar tu permiso de administrador: ${error.message}`,
    }
  }

  if (!data) {
    return {
      admin: false,
      motivo: 'Este correo no está autorizado para acceder al panel.',
    }
  }

  return { admin: true, nombre: data.nombre }
}
