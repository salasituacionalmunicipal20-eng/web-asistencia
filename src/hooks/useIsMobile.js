import { useEffect, useState } from 'react'

// Hook compartido para layouts responsivos. Reemplaza el patrón duplicado
// de useState(window.innerWidth < N) + addEventListener('resize') que estaba
// repetido en App, PanelPrincipal, Empleados, Memos, Justificaciones y Reportes.
export function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < breakpoint)

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < breakpoint)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [breakpoint])

  return isMobile
}
