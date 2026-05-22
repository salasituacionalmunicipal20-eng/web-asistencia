import { supabase } from '../supabase'

// Verifica si el email tiene permiso de administrador consultando la tabla
// `administradores_web` (tabla con columnas: correo, nombre, activo).
// Devuelve { admin: true, nombre? } si está autorizado, o { admin: false, motivo } si no.
export async function verificarAdmin(email) {
  if (!email) return { admin: false, motivo: 'Sin email en la sesion.' }

  const { data, error } = await supabase
    .from('administradores_web')
    .select('correo, nombre, activo')
    .eq('correo', email)
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
      motivo: 'Este correo no esta autorizado para acceder al panel.',
    }
  }

  if (data.activo === false) {
    return {
      admin: false,
      motivo: 'Tu cuenta de administrador esta desactivada.',
    }
  }

  return { admin: true, nombre: data.nombre }
}
