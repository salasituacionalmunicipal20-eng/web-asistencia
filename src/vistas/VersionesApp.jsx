import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabase'
import { Smartphone, RefreshCcw, CheckCircle2, AlertCircle, HelpCircle, Calendar } from 'lucide-react'
import { useIsMobile } from '../hooks/useIsMobile'
import { useTema } from '../theme/ThemeProvider'

/**
 * Panel solo para super-admin (Carlos Linares). Muestra que version del APK
 * tiene instalada cada empleado y agrupa por estado:
 *   - AL_DIA: tiene la version mas reciente publicada
 *   - DESACTUALIZADO: corre una version mas vieja
 *   - NUNCA_ABRIO: aun no ha abierto la app desde que se publico el tracking
 *
 * Los datos vienen de la vista `vw_versiones_app`. Cada empleado reporta su
 * version al abrir la app (RPC reportar_version_app desde MainActivity).
 */
export default function VersionesApp() {
  const isMobile = useIsMobile()
  const { t } = useTema()
  const [empleados, setEmpleados] = useState([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [filtro, setFiltro] = useState('TODOS') // TODOS | AL_DIA | DESACTUALIZADO | NUNCA_ABRIO

  const cargar = async () => {
    setCargando(true)
    setError('')
    const { data, error: err } = await supabase
      .from('vw_versiones_app')
      .select('*')
    if (err) {
      setError(err.message + ' — ¿corriste el SQL TRACKING_VERSIONES_APP.sql?')
    } else {
      setEmpleados(data || [])
    }
    setCargando(false)
  }

  useEffect(() => { cargar() }, [])

  // Resumen / KPIs
  const resumen = useMemo(() => {
    const r = { TOTAL: empleados.length, AL_DIA: 0, DESACTUALIZADO: 0, NUNCA_ABRIO: 0 }
    empleados.forEach(e => { r[e.estado_version] = (r[e.estado_version] || 0) + 1 })
    return r
  }, [empleados])

  const versionActual = empleados[0]?.version_actual_nombre || '—'

  // Lista filtrada
  const filtrados = useMemo(() => {
    if (filtro === 'TODOS') return empleados
    return empleados.filter(e => e.estado_version === filtro)
  }, [empleados, filtro])

  // Tags por estado
  const tagEstado = (estado) => {
    const cfg = {
      AL_DIA:          { bg: t.exitoBg, fg: t.exito, icon: CheckCircle2, label: 'Al día' },
      DESACTUALIZADO:  { bg: t.avisoBg, fg: t.aviso, icon: AlertCircle, label: 'Desactualizado' },
      NUNCA_ABRIO:     { bg: t.errorBg, fg: t.error, icon: HelpCircle, label: 'Nunca abrió' }
    }[estado] || { bg: t.bgInput, fg: t.textSoft, icon: HelpCircle, label: estado }
    const Ic = cfg.icon
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 800, backgroundColor: cfg.bg, color: cfg.fg, textTransform: 'uppercase' }}>
        <Ic size={11} /> {cfg.label}
      </span>
    )
  }

  const fmtFecha = (iso) => {
    if (!iso) return '—'
    try {
      return new Date(iso).toLocaleString('es-VE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
    } catch { return iso }
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: isMobile ? 5 : 0 }}>
      <div style={{ marginBottom: 24, background: 'linear-gradient(135deg, #7c3aed 0%, #4c1d95 100%)', padding: 25, borderRadius: 16, color: 'white' }}>
        <h1 style={{ margin: '0 0 5px 0', fontSize: isMobile ? 22 : 28, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Smartphone size={32} /> Versiones de la App por empleado
        </h1>
        <p style={{ margin: 0, fontSize: 14, opacity: 0.9 }}>Quién actualizó el APK y quién sigue con una versión vieja. Versión actual publicada: <strong>v{versionActual}</strong>.</p>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 18 }}>
        {[
          { key: 'TODOS',          label: 'Total activos', valor: resumen.TOTAL,          color: t.primario, icon: Smartphone },
          { key: 'AL_DIA',         label: 'Al día',         valor: resumen.AL_DIA,         color: t.exito,    icon: CheckCircle2 },
          { key: 'DESACTUALIZADO', label: 'Desactualizado', valor: resumen.DESACTUALIZADO, color: t.aviso,    icon: AlertCircle },
          { key: 'NUNCA_ABRIO',    label: 'Nunca abrió',    valor: resumen.NUNCA_ABRIO,    color: t.error,    icon: HelpCircle }
        ].map(k => {
          const Ic = k.icon
          const activo = filtro === k.key
          return (
            <button key={k.key} onClick={() => setFiltro(k.key)}
              style={{ background: t.bgPanel, padding: 16, borderRadius: 12, border: `2px solid ${activo ? k.color : t.border}`, cursor: 'pointer', textAlign: 'left', boxShadow: activo ? `0 4px 12px ${k.color}33` : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: t.textSoft, fontWeight: 800, textTransform: 'uppercase' }}>
                <Ic size={14} color={k.color} /> {k.label}
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: k.color, marginTop: 2 }}>{k.valor}</div>
            </button>
          )
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, alignItems: 'center' }}>
        <div style={{ fontSize: 13, color: t.textSoft, fontWeight: 700 }}>
          {filtrados.length} empleado{filtrados.length === 1 ? '' : 's'} {filtro !== 'TODOS' ? `(filtro: ${filtro.replace('_', ' ').toLowerCase()})` : ''}
        </div>
        <button onClick={cargar} disabled={cargando}
          style={{ padding: '8px 14px', backgroundColor: t.primario, color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 800, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <RefreshCcw size={14} /> {cargando ? 'Cargando…' : 'Refrescar'}
        </button>
      </div>

      {error && (
        <div style={{ padding: 12, borderRadius: 8, background: t.errorBg, color: t.error, borderLeft: `3px solid ${t.error}`, marginBottom: 12, fontSize: 13, fontWeight: 700 }}>
          ⚠️ {error}
        </div>
      )}

      <div style={{ backgroundColor: t.bgPanel, borderRadius: 14, border: `1px solid ${t.border}`, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 850 }}>
            <thead>
              <tr style={{ backgroundColor: t.bgTableHead, color: t.textSoft, fontSize: 11, textTransform: 'uppercase', fontWeight: 800 }}>
                <th style={{ padding: '12px 14px', borderBottom: `2px solid ${t.border}`, textAlign: 'left' }}>Empleado</th>
                <th style={{ padding: '12px 14px', borderBottom: `2px solid ${t.border}`, textAlign: 'left' }}>Departamento</th>
                <th style={{ padding: '12px 14px', borderBottom: `2px solid ${t.border}`, textAlign: 'center' }}>Versión instalada</th>
                <th style={{ padding: '12px 14px', borderBottom: `2px solid ${t.border}`, textAlign: 'center' }}>Último ping</th>
                <th style={{ padding: '12px 14px', borderBottom: `2px solid ${t.border}`, textAlign: 'center' }}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 && (
                <tr><td colSpan="5" style={{ padding: 32, textAlign: 'center', color: t.textMuted, fontWeight: 600 }}>
                  {cargando ? 'Cargando...' : 'Sin empleados para este filtro.'}
                </td></tr>
              )}
              {filtrados.map(e => (
                <tr key={e.cedula} style={{ borderBottom: `1px solid ${t.borderSoft}`, fontSize: 13 }}>
                  <td style={{ padding: '10px 14px', color: t.text, fontWeight: 700 }}>
                    {e.nombres} {e.apellidos}
                    <div style={{ fontSize: 11, color: t.textSoft, fontWeight: 600, marginTop: 2 }}>{e.cedula}</div>
                  </td>
                  <td style={{ padding: '10px 14px', color: t.textSoft, fontWeight: 600 }}>
                    <div>{e.departamento || '—'}</div>
                    <div style={{ fontSize: 11, color: t.textMuted }}>{e.cargo || ''}</div>
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 800, color: t.text }}>
                    {e.app_version_nombre ? `v${e.app_version_nombre}` : <span style={{ color: t.textMuted, fontWeight: 500 }}>—</span>}
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'center', color: t.textSoft, fontSize: 12 }}>
                    {e.app_ultimo_ping ? (
                      <div>
                        <Calendar size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                        {fmtFecha(e.app_ultimo_ping)}
                        {e.dias_desde_ping != null && (
                          <div style={{ fontSize: 10, color: t.textMuted, marginTop: 2 }}>
                            hace {Math.round(e.dias_desde_ping)} día{Math.round(e.dias_desde_ping) === 1 ? '' : 's'}
                          </div>
                        )}
                      </div>
                    ) : <span style={{ color: t.textMuted }}>nunca</span>}
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                    {tagEstado(e.estado_version)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ marginTop: 14, fontSize: 12, color: t.textMuted, fontWeight: 600, lineHeight: 1.5 }}>
        💡 Cada empleado reporta su versión cuando abre la app o se loguea. Si nunca abrió la app v1.0.7+, aparecerá como <em>NUNCA_ABRIO</em> hasta que lo haga al menos una vez.
      </div>
    </div>
  )
}
