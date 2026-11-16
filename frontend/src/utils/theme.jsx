import { createContext, useContext, useEffect, useMemo, useState } from 'react'

const TOKENS = ['paper', 'sunk', 'card', 'ink', 'ink-2', 'muted', 'rule', 'accent', 'moss', 'ochre', 'blueprint']

function readPalette() {
  const style = getComputedStyle(document.documentElement)
  const palette = {}
  for (const name of TOKENS) {
    const [r, g, b] = style.getPropertyValue(`--${name}`).trim().split(/\s+/).map(Number)
    palette[name.replace('-2', '2')] = `rgb(${r}, ${g}, ${b})`
  }
  palette.alpha = (name, a) => palette[name].replace('rgb(', 'rgba(').replace(')', `, ${a})`)
  return palette
}

const ThemeContext = createContext(null)

// Only the colour theme is persisted; resume data never touches storage.
export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || 'morning')
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem('rm-theme', theme)
    } catch {
      /* storage may be disabled */
    }
  }, [theme])
  // Charts draw with concrete colours (SVG attributes do not resolve CSS variables reliably).
  const palette = useMemo(() => readPalette(), [theme]) // eslint-disable-line react-hooks/exhaustive-deps
  const value = useMemo(
    () => ({ theme, palette, toggle: () => setTheme((t) => (t === 'night' ? 'morning' : 'night')) }),
    [theme, palette],
  )
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export const useTheme = () => useContext(ThemeContext)
