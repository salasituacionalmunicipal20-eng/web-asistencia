import { createContext, useContext, useEffect, useMemo, useState } from 'react'

/**
 * Sistema de tema global. Persiste la preferencia en localStorage y respeta
 * prefers-color-scheme del sistema en el primer arranque.
 */
const TemaCtx = createContext({ tema: 'claro', toggle: () => {}, t: temaClaro() })

function temaClaro() {
  return {
    nombre: 'claro',
    bgApp:       '#f8fafc',
    bgPanel:     '#ffffff',
    bgSidebar:   '#0f172a',
    bgInput:     '#f8fafc',
    bgInputAlt:  '#ffffff',
    bgHover:     '#f1f5f9',
    bgTableRow:  '#ffffff',
    bgTableHead: '#f8fafc',
    border:      '#e2e8f0',
    borderSoft:  '#f1f5f9',
    text:        '#0f172a',
    textSoft:    '#64748b',
    textMuted:   '#94a3b8',
    primario:    '#0284c7',
    primarioBg:  '#e0f2fe',
    exito:       '#16a34a',
    exitoBg:     '#dcfce7',
    error:       '#dc2626',
    errorBg:     '#fee2e2',
    aviso:       '#d97706',
    avisoBg:     '#fef3c7',
    info:        '#4f46e5',
    infoBg:      '#e0e7ff'
  }
}

function temaOscuro() {
  return {
    nombre: 'oscuro',
    bgApp:       '#020617',
    bgPanel:     '#0f172a',
    bgSidebar:   '#020617',
    bgInput:     '#1e293b',
    bgInputAlt:  '#0f172a',
    bgHover:     '#1e293b',
    bgTableRow:  '#0f172a',
    bgTableHead: '#0b1220',
    border:      '#1e293b',
    borderSoft:  '#1e293b',
    text:        '#f1f5f9',
    textSoft:    '#94a3b8',
    textMuted:   '#64748b',
    primario:    '#38bdf8',
    primarioBg:  '#0c4a6e',
    exito:       '#4ade80',
    exitoBg:     '#14532d',
    error:       '#f87171',
    errorBg:     '#7f1d1d',
    aviso:       '#fbbf24',
    avisoBg:     '#78350f',
    info:        '#818cf8',
    infoBg:      '#3730a3'
  }
}

export function ThemeProvider({ children }) {
  const [tema, setTema] = useState(() => {
    try {
      const guardado = localStorage.getItem('tema_web_asistencia')
      if (guardado === 'oscuro' || guardado === 'claro') return guardado
    } catch { /* noop */ }
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'oscuro'
    return 'claro'
  })

  useEffect(() => {
    try { localStorage.setItem('tema_web_asistencia', tema) } catch { /* noop */ }
    document.documentElement.style.colorScheme = tema === 'oscuro' ? 'dark' : 'light'
    document.body.style.backgroundColor = tema === 'oscuro' ? '#020617' : '#f8fafc'
  }, [tema])

  const valor = useMemo(() => ({
    tema,
    toggle: () => setTema(t => t === 'claro' ? 'oscuro' : 'claro'),
    t: tema === 'oscuro' ? temaOscuro() : temaClaro()
  }), [tema])

  return <TemaCtx.Provider value={valor}>{children}</TemaCtx.Provider>
}

export function useTema() { return useContext(TemaCtx) }
