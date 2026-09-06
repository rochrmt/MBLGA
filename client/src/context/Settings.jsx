import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '../lib/api'

const SettingsContext = createContext(null)

// Valeurs par défaut NEUTRES — aucune marque en dur.
// Tout se configure via Paramètres > Entreprise.
const DEFAULTS = {
  raison_sociale: '',
  slogan: '',
  editeur: '',
  logo: '',
  signature: '',
  devise: 'FCFA',
  tva_defaut: '19',
  stock_min_defaut: '5',
  delai_livraison: '7',
  couleur_principale: '#1e293b',
  couleur_sombre: '#2992f5',
}

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULTS)
  const [loaded, setLoaded] = useState(false)

  const reload = useCallback(async () => {
    try {
      const { data } = await api.get('/parametres')
      setSettings({ ...DEFAULTS, ...data })
    } catch {
      setSettings(DEFAULTS)
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    if (localStorage.getItem('token')) reload()
    else setLoaded(true)
  }, [reload])

  const save = useCallback(async (patch) => {
    await api.put('/parametres', patch)
    setSettings((s) => ({ ...s, ...patch }))
  }, [])

  // Nom d'application affiché : raison sociale si définie, sinon libellé neutre
  const appName = settings.raison_sociale?.trim() || 'Mbila Gestion'
  const devise = settings.devise || 'FCFA'

  return (
    <SettingsContext.Provider value={{ settings, loaded, reload, save, appName, devise }}>
      {children}
    </SettingsContext.Provider>
  )
}

export const useSettings = () => useContext(SettingsContext)
