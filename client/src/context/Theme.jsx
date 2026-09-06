import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const ThemeContext = createContext(null)

/* ── Brand color presets ── */
export const BRAND_PRESETS = {
  indigo:   { label: 'Indigo',   vars: { 50:'238 242 255',100:'224 231 255',200:'199 210 254',300:'165 180 252',400:'129 140 248',500:'99 102 241',600:'79 70 229',700:'67 56 202',800:'55 48 163',900:'49 46 129' } },
  blue:     { label: 'Bleu',     vars: { 50:'239 246 255',100:'219 234 254',200:'191 219 254',300:'147 197 253',400:'96 165 250',500:'59 130 246',600:'37 99 235',700:'29 78 216',800:'30 64 175',900:'30 58 138' } },
  emerald:  { label: 'Émeraude', vars: { 50:'236 253 245',100:'209 250 229',200:'167 243 208',300:'110 231 183',400:'52 211 153',500:'16 185 129',600:'5 150 105',700:'4 120 87',800:'6 95 70',900:'6 78 59' } },
  violet:   { label: 'Violet',   vars: { 50:'245 243 255',100:'237 233 254',200:'221 214 254',300:'196 181 253',400:'167 139 250',500:'139 92 246',600:'124 58 237',700:'109 40 217',800:'91 33 182',900:'76 29 149' } },
  rose:     { label: 'Rose',     vars: { 50:'255 241 242',100:'255 228 230',200:'254 205 211',300:'253 164 175',400:'251 113 133',500:'244 63 94',600:'225 29 72',700:'190 18 60',800:'159 18 57',900:'136 19 55' } },
  amber:    { label: 'Ambre',    vars: { 50:'255 251 235',100:'254 243 199',200:'253 230 138',300:'252 211 77',400:'251 191 36',500:'245 158 11',600:'217 119 6',700:'180 83 9',800:'146 64 14',900:'120 53 15' } },
  cyan:     { label: 'Cyan',     vars: { 50:'236 254 255',100:'207 250 254',200:'165 243 252',300:'103 232 249',400:'34 211 238',500:'6 182 212',600:'8 145 178',700:'14 116 144',800:'21 94 117',900:'22 78 99' } },
  teal:     { label: 'Sarcelle', vars: { 50:'240 253 250',100:'204 251 241',200:'153 246 228',300:'94 234 212',400:'45 212 191',500:'20 184 166',600:'13 148 136',700:'15 118 110',800:'17 94 89',900:'19 78 74' } },
}

export const FONT_PRESETS = [
  { key: 'Outfit',        label: 'Outfit' },
  { key: 'Inter',         label: 'Inter' },
  { key: 'Poppins',       label: 'Poppins' },
  { key: 'DM Sans',       label: 'DM Sans' },
  { key: 'Space Grotesk', label: 'Space Grotesk' },
]

export const THEME_PRESETS = [
  { key: 'light',       label: 'Clair',       icon: 'sun',   dark: false },
  { key: 'dark',        label: 'Sombre',      icon: 'moon',  dark: true },
  { key: 'blue-night',  label: 'Nuit bleue',  icon: 'moon',  dark: true },
  { key: 'sepia',       label: 'Sépia',       icon: 'sun',   dark: false },
]

function loadTheme() {
  try {
    const raw = localStorage.getItem('theme')
    if (raw) {
      const parsed = JSON.parse(raw)
      // Migrate old format { dark: true/false } to new { mode: 'dark'|'light' }
      if (parsed.mode === undefined && parsed.dark !== undefined) {
        parsed.mode = parsed.dark ? 'dark' : 'light'
        delete parsed.dark
      }
      if (!parsed.mode) parsed.mode = 'light'
      return parsed
    }
  } catch { /* */ }
  return { mode: 'light', brand: 'cyan', font: 'Outfit' }
}

function saveTheme(t) {
  localStorage.setItem('theme', JSON.stringify(t))
}

function applyTheme({ mode, brand, font }) {
  const root = document.documentElement
  // Remove all theme classes
  root.classList.remove('dark', 'light', 'theme-blue-night', 'theme-sepia')
  // Apply the right class(es)
  if (mode === 'dark') {
    root.classList.add('dark')
  } else if (mode === 'blue-night') {
    root.classList.add('theme-blue-night')
  } else if (mode === 'sepia') {
    root.classList.add('theme-sepia')
  } else {
    root.classList.add('light')
  }
  root.style.setProperty('--font-app', `'${font}', system-ui, sans-serif`)

  const preset = BRAND_PRESETS[brand] || BRAND_PRESETS.indigo
  for (const [k, v] of Object.entries(preset.vars)) {
    root.style.setProperty(`--brand-${k}`, v)
  }
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(loadTheme)

  useEffect(() => {
    applyTheme(theme)
    saveTheme(theme)
  }, [theme])

  const setMode = useCallback((mode) => setTheme((t) => ({ ...t, mode })), [])
  const setBrand = useCallback((brand) => setTheme((t) => ({ ...t, brand })), [])
  const setFont = useCallback((font) => setTheme((t) => ({ ...t, font })), [])

  return (
    <ThemeContext.Provider value={{ ...theme, setMode, setBrand, setFont }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
