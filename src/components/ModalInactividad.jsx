import { Clock } from 'lucide-react'

// Modal que aparece cuando faltan menos de N segundos para que la sesión expire por inactividad.
// El usuario puede hacer click en "Continuar Sesión" o simplemente mover el mouse para extender.
export default function ModalInactividad({ segundos, onContinuar }) {
  if (segundos === null || segundos === undefined) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.85)',
        zIndex: 999999,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        padding: '15px',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          backgroundColor: '#fff',
          padding: '30px 40px',
          borderRadius: '16px',
          maxWidth: '420px',
          width: '100%',
          textAlign: 'center',
          borderTop: '6px solid #ef4444',
          boxShadow: '0 10px 40px rgba(0,0,0,0.6)',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ fontSize: '48px', marginBottom: '10px', color: '#ef4444' }}>
          <Clock size={56} strokeWidth={2.5} />
        </div>
        <h2
          style={{
            margin: '0 0 8px 0',
            color: '#ef4444',
            fontSize: '20px',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            fontWeight: 800,
          }}
        >
          Sesión por expirar
        </h2>
        <p style={{ margin: '0 0 15px 0', color: '#334155', fontSize: '14px' }}>
          Tu sesión se cerrará por inactividad en:
        </p>
        <div
          style={{
            fontSize: '56px',
            fontWeight: 'bold',
            color: '#ef4444',
            margin: '5px 0',
            fontFamily: '"Courier New", monospace',
            lineHeight: 1,
          }}
        >
          {segundos}
        </div>
        <p style={{ margin: '8px 0 18px 0', color: '#64748b', fontSize: '11px' }}>segundos</p>
        <button
          type="button"
          onClick={onContinuar}
          style={{
            background: '#16a34a',
            color: '#fff',
            border: 'none',
            padding: '12px 30px',
            fontSize: '14px',
            fontWeight: 'bold',
            borderRadius: '8px',
            cursor: 'pointer',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            boxShadow: '0 3px 8px rgba(22,163,74,0.4)',
          }}
        >
          ✓ Continuar Sesión
        </button>
      </div>
    </div>
  )
}
