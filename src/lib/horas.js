// Utilidades de horas compartidas por Hojas de tiempo (timesheets), Nómina y Cronómetro.
// OJO: en asistencia_registros, hora_entrada / hora_salida son TEXT ("HH:MM" o "HH:MM:SS").

export function horaHM(s) {
  if (!s) return ''
  const m = String(s).match(/(\d{1,2}):(\d{2})/)
  return m ? `${String(m[1]).padStart(2, '0')}:${m[2]}` : ''
}
export function minutosDe(s) {
  const hm = horaHM(s)
  if (!hm) return null
  const [h, mm] = hm.split(':').map(Number)
  return h * 60 + mm
}
// Horas trabajadas entre una entrada y una salida (texto). Si la salida es "menor"
// se asume cruce de medianoche (+24h). Devuelve horas decimales redondeadas a 2.
export function horasEntre(ent, sal) {
  const a = minutosDe(ent), b = minutosDe(sal)
  if (a == null || b == null) return 0
  let d = b - a
  if (d < 0) d += 1440
  return Math.round((d / 60) * 100) / 100
}
// Fecha local -> "YYYY-MM-DD" sin corrimiento por zona horaria.
export function ymdLocal(d) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), da = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${da}`
}
// "YYYY-MM-DD" -> Date local (mediodía para evitar bordes de DST).
export function fechaLocal(ymd) {
  const [y, m, d] = String(ymd).split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}
// Lunes (inicio de semana) de la fecha dada.
export function lunesDe(d) {
  const x = new Date(d)
  const dow = (x.getDay() + 6) % 7 // 0 = lunes
  x.setDate(x.getDate() - dow)
  x.setHours(0, 0, 0, 0)
  return x
}
export function fmtHoras(h) {
  if (!h) return '0h'
  const H = Math.floor(h), M = Math.round((h - H) * 60)
  return M ? `${H}h ${M}m` : `${H}h`
}
export function fmtDuracion(seg) {
  seg = Math.max(0, Math.floor(seg || 0))
  const h = Math.floor(seg / 3600), m = Math.floor((seg % 3600) / 60), s = seg % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
export const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
