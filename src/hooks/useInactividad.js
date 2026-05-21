import { useEffect, useRef, useState } from 'react'

// Detecta inactividad del usuario y dispara onTimeout tras `timeoutMs` sin acción.
// Cualquier mousemove, mousedown, keydown, scroll, touchstart o click reinicia el contador.
// Expone `segundosRestantes`: número entre 0 y warningMs/1000 cuando estamos en la ventana
// de aviso (faltan <=warningMs ms para expirar), o null cuando todavía hay tiempo.
//
// Permite pausar el conteo manualmente durante operaciones largas:
//   const { pausar, reanudar, segundosRestantes } = useInactividad({...})
export function useInactividad({
  timeoutMs = 10 * 60 * 1000,
  warningMs = 30 * 1000,
  checkIntervalMs = 1000,
  onTimeout,
  enabled = true,
}) {
  const [segundosRestantes, setSegundosRestantes] = useState(null)
  const ultimaActividadRef = useRef(0)
  const pausadoRef = useRef(false)
  const expiradoRef = useRef(false)

  useEffect(() => {
    if (!enabled) return
    ultimaActividadRef.current = Date.now()

    const reset = () => {
      if (expiradoRef.current) return
      ultimaActividadRef.current = Date.now()
      setSegundosRestantes(null)
    }

    const eventos = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click']
    eventos.forEach((ev) =>
      window.addEventListener(ev, reset, { passive: true, capture: true })
    )

    const interval = setInterval(() => {
      if (expiradoRef.current || pausadoRef.current) return
      const restante = timeoutMs - (Date.now() - ultimaActividadRef.current)
      if (restante <= 0) {
        expiradoRef.current = true
        setSegundosRestantes(0)
        if (onTimeout) onTimeout()
        return
      }
      if (restante <= warningMs) {
        setSegundosRestantes(Math.ceil(restante / 1000))
      } else {
        setSegundosRestantes(null)
      }
    }, checkIntervalMs)

    return () => {
      eventos.forEach((ev) => window.removeEventListener(ev, reset, { capture: true }))
      clearInterval(interval)
    }
  }, [timeoutMs, warningMs, checkIntervalMs, onTimeout, enabled])

  const pausar = () => {
    pausadoRef.current = true
    setSegundosRestantes(null)
  }
  const reanudar = () => {
    pausadoRef.current = false
    ultimaActividadRef.current = Date.now()
  }
  const reiniciar = () => {
    expiradoRef.current = false
    ultimaActividadRef.current = Date.now()
    setSegundosRestantes(null)
  }

  return { segundosRestantes, pausar, reanudar, reiniciar }
}
