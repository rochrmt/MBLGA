import { useState, useEffect, useRef } from 'react'
import {
  Building2, SlidersHorizontal, FileText, Tag, Briefcase, ShieldCheck,
  KeyRound, Database, Info, Save, Plus, Pencil, Trash2, RefreshCw, UserPlus,
  Copy, Check, Sparkles, Palette, Moon, Sun, Type, Download, Upload, AlertTriangle,
  Mail, MessageCircle, LifeBuoy,
} from 'lucide-react'
import api, { formatMoney, formatDate } from '../lib/api'
import { useSettings } from '../context/Settings'
import { useAuth } from '../context/Auth'
import { useTheme, BRAND_PRESETS, FONT_PRESETS, THEME_PRESETS } from '../context/Theme'
import { Modal, Spinner, Badge, useToast } from '../components/ui'
import { useLocation } from 'react-router-dom'

const SECTIONS = [
  { key: 'apparence', label: 'Apparence', icon: Palette },
  { key: 'entreprise', label: 'Entreprise', icon: Building2 },
  { key: 'preferences', label: 'Préférences', icon: SlidersHorizontal },
  { key: 'facture', label: 'Modèle facture', icon: FileText },
  { key: 'categories', label: 'Catégories', icon: Tag },
  { key: 'departements', label: 'Départements', icon: Briefcase },
  { key: 'securite', label: 'Sécurité', icon: ShieldCheck, admin: true },
  { key: 'licence', label: 'Licence', icon: KeyRound, superAdmin: true },
  { key: 'database', label: 'Base de données', icon: Database },
  { key: 'apropos', label: 'À propos', icon: Info },
]

export default function Parametres() {
  const { isAdmin, user } = useAuth()
  const isSuperAdmin = user?.role === 'super_admin'
  const location = useLocation()
  const initialSection = location.state?.section || 'entreprise'
  const [section, setSection] = useState(initialSection)
  const visible = SECTIONS.filter((s) => (!s.admin || isAdmin) && (!s.superAdmin || isSuperAdmin))

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-1.5">
        {visible.map((s) => (
          <button key={s.key} onClick={() => setSection(s.key)}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition
              ${section === s.key ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}>
            <s.icon size={16} /> {s.label}
          </button>
        ))}
      </div>
      <div>
        {section === 'apparence' && <Apparence />}
        {section === 'entreprise' && <Entreprise />}
        {section === 'preferences' && <Preferences />}
        {section === 'facture' && <ModeleFacture />}
        {section === 'categories' && <Categories />}
        {section === 'departements' && <Departements />}
        {section === 'securite' && <Securite />}
        {section === 'licence' && <Licence onNavigate={setSection} />}
        {section === 'database' && <BaseDonnees />}
        {section === 'apropos' && <APropos />}
      </div>
    </div>
  )
}

function SectionHeader({ title, desc }) {
  return (
    <div className="mb-5">
      <h2 className="text-xl font-bold" style={{ color: 'rgb(var(--text-primary))' }}>{title}</h2>
      {desc && <p className="text-sm" style={{ color: 'rgb(var(--text-muted))' }}>{desc}</p>}
    </div>
  )
}

/* ── Apparence ─────────────────────────────────────────────────────────── */
function Apparence() {
  const { mode, setMode, brand, setBrand, font, setFont } = useTheme()

  const themePreviews = {
    light:      { bg: '#f8fafc', surface: '#ffffff', accent: 'rgb(79 70 229)', text: '#1e293b' },
    dark:       { bg: '#0f172a', surface: '#1e293b', accent: 'rgb(129 140 248)', text: '#e2e8f0' },
    'blue-night': { bg: '#080f23', surface: '#0f1937', accent: 'rgb(129 140 248)', text: '#c8dcff' },
    sepia:      { bg: '#f3e9d8', surface: '#fcf5e7', accent: 'rgb(79 70 229)', text: '#4a3420' },
  }

  return (
    <div className="space-y-5">
      <SectionHeader title="Apparence" desc="Personnalisez le thème, les couleurs et la police de l'application." />

      {/* Thème */}
      <div className="card p-5">
        <div className="mb-4 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-500/15 text-brand-400">
            <Palette size={20} />
          </span>
          <div>
            <p className="font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>Thème de l'interface</p>
            <p className="text-sm" style={{ color: 'rgb(var(--text-muted))' }}>Choisissez le thème global de l'application</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {THEME_PRESETS.map((t) => {
            const p = themePreviews[t.key]
            const active = mode === t.key
            return (
              <button key={t.key} onClick={() => setMode(t.key)}
                className="overflow-hidden rounded-xl border-2 transition"
                style={{
                  borderColor: active ? 'rgb(var(--brand-600))' : 'rgb(var(--border))',
                  background: active ? 'rgb(var(--brand-500) / 0.08)' : 'transparent',
                }}>
                <div className="flex items-center gap-2 px-3 py-2.5" style={{ background: p.bg }}>
                  <div className="flex flex-1 items-center gap-2">
                    <div className="h-8 w-8 rounded-lg" style={{ background: p.surface, border: `1px solid ${p.accent}30` }} />
                    <div className="flex flex-1 flex-col gap-1">
                      <div className="h-1.5 w-full rounded-full" style={{ background: p.accent, opacity: 0.6 }} />
                      <div className="h-1.5 w-2/3 rounded-full" style={{ background: p.text, opacity: 0.3 }} />
                    </div>
                  </div>
                  {t.icon === 'moon' ? <Moon size={14} style={{ color: p.text }} /> : <Sun size={14} style={{ color: p.text }} />}
                </div>
                <p className="py-2 text-center text-xs font-semibold" style={{ color: active ? 'rgb(var(--brand-600))' : 'rgb(var(--text-secondary))' }}>{t.label}</p>
              </button>
            )
          })}
        </div>
      </div>

      {/* Couleur principale */}
      <div className="card p-5">
        <div className="mb-4 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-500/15 text-brand-400">
            <Palette size={20} />
          </span>
          <div>
            <p className="font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>Couleur principale</p>
            <p className="text-sm" style={{ color: 'rgb(var(--text-muted))' }}>Choisissez la couleur d'accent de l'application</p>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
          {Object.entries(BRAND_PRESETS).map(([key, preset]) => (
            <button key={key} onClick={() => setBrand(key)}
              className={`flex flex-col items-center gap-2 rounded-xl border-2 p-3 transition`}
              style={{
                borderColor: brand === key ? `rgb(var(--brand-600))` : 'rgb(var(--border))',
                background: brand === key ? 'rgb(var(--brand-500) / 0.1)' : 'transparent',
              }}>
              <span className="h-8 w-8 rounded-full" style={{ background: `rgb(${preset.vars[600]})` }} />
              <span className="text-xs font-medium" style={{ color: 'rgb(var(--text-secondary))' }}>{preset.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Police d'écriture */}
      <div className="card p-5">
        <div className="mb-4 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-500/15 text-brand-400">
            <Type size={20} />
          </span>
          <div>
            <p className="font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>Police d'écriture</p>
            <p className="text-sm" style={{ color: 'rgb(var(--text-muted))' }}>Choisissez la police de l'interface</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {FONT_PRESETS.map((f) => (
            <button key={f.key} onClick={() => setFont(f.key)}
              className={`rounded-xl border-2 p-4 text-center transition`}
              style={{
                borderColor: font === f.key ? 'rgb(var(--brand-600))' : 'rgb(var(--border))',
                background: font === f.key ? 'rgb(var(--brand-500) / 0.1)' : 'transparent',
                fontFamily: `'${f.key}', system-ui, sans-serif`,
              }}>
              <p className="text-base font-bold" style={{ color: 'rgb(var(--text-primary))' }}>{f.label}</p>
              <p className="mt-1 text-xs" style={{ color: 'rgb(var(--text-muted))' }}>Aa Bb Cc 123</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── Entreprise ─────────────────────────────────────────────────────────── */
function Entreprise() {
  const { settings, save } = useSettings()
  const toast = useToast()
  const [form, setForm] = useState(settings)
  const [saving, setSaving] = useState(false)
  useEffect(() => { setForm(settings) }, [settings])

  const onLogo = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setForm((f) => ({ ...f, logo: reader.result }))
    reader.readAsDataURL(file)
  }
  const onSignature = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setForm((f) => ({ ...f, signature: reader.result }))
    reader.readAsDataURL(file)
  }
  const submit = async () => {
    setSaving(true)
    try {
      await save({
        raison_sociale: form.raison_sociale || '', slogan: form.slogan || '', editeur: form.editeur || '',
        rccm: form.rccm || '', telephone: form.telephone || '', email: form.email || '',
        site_web: form.site_web || '', adresse: form.adresse || '', logo: form.logo || '',
        signature: form.signature || '',
      })
      toast.success('Profil enregistré')
    } catch { toast.error('Erreur') } finally { setSaving(false) }
  }

  return (
    <div className="space-y-5">
      <SectionHeader title="Profil de l'entreprise" desc="Ces informations apparaissent dans vos rapports et documents." />
      <div className="card p-5">
        <p className="mb-3 text-xs font-semibold uppercase text-slate-500">Logo</p>
        <div className="flex flex-wrap items-center gap-4">
          <div className="grid h-24 w-24 place-items-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
            {form.logo ? <img src={form.logo} alt="logo" className="h-full w-full object-cover" /> : <Building2 className="text-slate-300" size={32} />}
          </div>
          <label className="flex-1 cursor-pointer rounded-xl border-2 border-dashed border-slate-200 px-6 py-8 text-center hover:border-brand-300">
            <input type="file" accept="image/*" className="hidden" onChange={onLogo} />
            <span className="font-semibold text-brand-600">Cliquez</span> <span className="text-slate-500">ou glissez une image ici</span>
            <p className="mt-1 text-xs text-slate-400">PNG, JPG, SVG, WebP — max 5 Mo</p>
          </label>
        </div>
        {form.logo && <button onClick={() => setForm({ ...form, logo: '' })} className="mt-3 flex items-center gap-1 text-sm text-red-600"><Trash2 size={14} /> Supprimer le logo</button>}
      </div>

      <div className="card p-5">
        <p className="mb-3 text-xs font-semibold uppercase text-slate-500">Signature & cachet</p>
        <div className="flex flex-wrap items-center gap-4">
          <div className="grid h-24 w-24 place-items-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
            {form.signature ? <img src={form.signature} alt="signature" className="h-full w-full object-contain" /> : <FileText className="text-slate-300" size={32} />}
          </div>
          <label className="flex-1 cursor-pointer rounded-xl border-2 border-dashed border-slate-200 px-6 py-8 text-center hover:border-brand-300">
            <input type="file" accept="image/*" className="hidden" onChange={onSignature} />
            <span className="font-semibold text-brand-600">Cliquez</span> <span className="text-slate-500">ou glissez une image ici</span>
            <p className="mt-1 text-xs text-slate-400">PNG, JPG, SVG, WebP — max 5 Mo</p>
          </label>
        </div>
        {form.signature && <button onClick={() => setForm({ ...form, signature: '' })} className="mt-3 flex items-center gap-1 text-sm text-red-600"><Trash2 size={14} /> Supprimer la signature</button>}
      </div>

      <div className="card space-y-4 p-5">
        <p className="text-xs font-semibold uppercase text-slate-500">Identité</p>
        <div><label className="label">Raison sociale</label><input className="input" value={form.raison_sociale || ''} onChange={(e) => setForm({ ...form, raison_sociale: e.target.value })} placeholder="Nom de votre entreprise" /></div>
        <div><label className="label">Slogan / Activité</label><input className="input" value={form.slogan || ''} onChange={(e) => setForm({ ...form, slogan: e.target.value })} placeholder="Votre partenaire de confiance" /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label">Éditeur / Développeur</label><input className="input" value={form.editeur || ''} onChange={(e) => setForm({ ...form, editeur: e.target.value })} placeholder="Affiché « par ... »" /></div>
          <div><label className="label">N° RCCM / RC</label><input className="input" value={form.rccm || ''} onChange={(e) => setForm({ ...form, rccm: e.target.value })} placeholder="CI-ABJ-2024-A-12345" /></div>
        </div>
      </div>

      <div className="card space-y-4 p-5">
        <p className="text-xs font-semibold uppercase text-slate-500">Coordonnées</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label">Téléphone</label><input className="input" value={form.telephone || ''} onChange={(e) => setForm({ ...form, telephone: e.target.value })} placeholder="+000 00 00 00 00" /></div>
          <div><label className="label">Email</label><input type="email" className="input" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="info@exemple.com" /></div>
        </div>
        <div><label className="label">Site web</label><input className="input" value={form.site_web || ''} onChange={(e) => setForm({ ...form, site_web: e.target.value })} placeholder="https://www.exemple.com" /></div>
        <div><label className="label">Adresse</label><textarea className="input" rows={2} value={form.adresse || ''} onChange={(e) => setForm({ ...form, adresse: e.target.value })} /></div>
      </div>

      <button onClick={submit} disabled={saving} className="btn-primary"><Save size={17} /> Enregistrer</button>
    </div>
  )
}

/* ── Préférences ────────────────────────────────────────────────────────── */
function Preferences() {
  const { settings, save } = useSettings()
  const toast = useToast()
  const [form, setForm] = useState(settings)
  useEffect(() => { setForm(settings) }, [settings])

  const submit = async () => {
    try {
      await save({
        tva_defaut: form.tva_defaut, stock_min_defaut: form.stock_min_defaut,
        delai_livraison: form.delai_livraison, devise: form.devise || 'FCFA',
      })
      toast.success('Préférences enregistrées')
    } catch { toast.error('Erreur') }
  }

  return (
    <div className="space-y-5">
      <SectionHeader title="Préférences" desc="Valeurs appliquées par défaut lors de la création de nouveaux enregistrements." />
      <div className="card space-y-4 p-5">
        <p className="text-xs font-semibold uppercase text-slate-500">Produits & tarification</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label">TVA par défaut (%)</label><input type="number" className="input" value={form.tva_defaut || ''} onChange={(e) => setForm({ ...form, tva_defaut: e.target.value })} /><p className="mt-1 text-xs text-slate-400">Appliquée lors de la création d'un nouveau produit.</p></div>
          <div><label className="label">Stock minimum par défaut</label><input type="number" className="input" value={form.stock_min_defaut || ''} onChange={(e) => setForm({ ...form, stock_min_defaut: e.target.value })} /><p className="mt-1 text-xs text-slate-400">Seuil d'alerte appliqué aux nouveaux produits.</p></div>
        </div>
      </div>
      <div className="card space-y-4 p-5">
        <p className="text-xs font-semibold uppercase text-slate-500">Commandes</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label">Délai de livraison (jours)</label><input type="number" className="input" value={form.delai_livraison || ''} onChange={(e) => setForm({ ...form, delai_livraison: e.target.value })} /><p className="mt-1 text-xs text-slate-400">Délai indicatif affiché aux clients.</p></div>
          <div><label className="label">Devise</label><input className="input" value={form.devise || 'FCFA'} onChange={(e) => setForm({ ...form, devise: e.target.value })} /><p className="mt-1 text-xs text-slate-400">Symbole monétaire utilisé dans toute l'application.</p></div>
        </div>
      </div>
      <button onClick={submit} className="btn-primary"><Save size={17} /> Enregistrer</button>
    </div>
  )
}

/* ── Modèle facture ─────────────────────────────────────────────────────── */
function ModeleFacture() {
  const { settings, save } = useSettings()
  const toast = useToast()
  const [form, setForm] = useState(settings)
  useEffect(() => { setForm(settings) }, [settings])
  const submit = async () => {
    try {
      await save({
        couleur_principale: form.couleur_principale || '#1e293b', couleur_sombre: form.couleur_sombre || '#2992f5',
        siret: form.siret || '', message_remerciement: form.message_remerciement || '',
        coordonnees_bancaires: form.coordonnees_bancaires || '', mentions_legales: form.mentions_legales || '',
      })
      toast.success('Modèle enregistré')
    } catch { toast.error('Erreur') }
  }
  return (
    <div className="space-y-5">
      <SectionHeader title="Modèle de facture" desc="Ces informations apparaissent dans l'en-tête et le pied de page de vos factures imprimées." />
      <div className="card space-y-4 p-5">
        <p className="text-xs font-semibold uppercase text-slate-500">En-tête</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label">Couleur principale</label><div className="flex items-center gap-2"><input type="color" className="h-10 w-14 rounded border border-slate-200" value={form.couleur_principale || '#1e293b'} onChange={(e) => setForm({ ...form, couleur_principale: e.target.value })} /><input className="input" value={form.couleur_principale || '#1e293b'} onChange={(e) => setForm({ ...form, couleur_principale: e.target.value })} /></div></div>
          <div><label className="label">Couleur sombre (barres & badges)</label><div className="flex items-center gap-2"><input type="color" className="h-10 w-14 rounded border border-slate-200" value={form.couleur_sombre || '#2992f5'} onChange={(e) => setForm({ ...form, couleur_sombre: e.target.value })} /><input className="input" value={form.couleur_sombre || '#2992f5'} onChange={(e) => setForm({ ...form, couleur_sombre: e.target.value })} /></div></div>
        </div>
        <div><label className="label">SIRET / N° RCCM / Identifiant fiscal</label><input className="input" value={form.siret || ''} onChange={(e) => setForm({ ...form, siret: e.target.value })} placeholder="SIRET : 123 456 789 00010" /></div>
      </div>
      <div className="card space-y-4 p-5">
        <p className="text-xs font-semibold uppercase text-slate-500">Pied de page</p>
        <div><label className="label">Message de remerciement</label><input className="input" value={form.message_remerciement || ''} onChange={(e) => setForm({ ...form, message_remerciement: e.target.value })} placeholder="Merci pour votre confiance." /></div>
        <div><label className="label">Coordonnées bancaires (RIB / IBAN)</label><textarea className="input" rows={2} value={form.coordonnees_bancaires || ''} onChange={(e) => setForm({ ...form, coordonnees_bancaires: e.target.value })} placeholder="Banque : ... · RIB : ... · IBAN : ..." /></div>
        <div><label className="label">Mentions légales (conditions de paiement, pénalités...)</label><textarea className="input" rows={2} value={form.mentions_legales || ''} onChange={(e) => setForm({ ...form, mentions_legales: e.target.value })} placeholder="Paiement à 30 jours..." /></div>
      </div>
      <button onClick={submit} className="btn-primary"><Save size={17} /> Enregistrer</button>
    </div>
  )
}

/* ── Catégories ─────────────────────────────────────────────────────────── */
function Categories() {
  const toast = useToast()
  const [items, setItems] = useState([])
  const [nom, setNom] = useState('')
  const [loading, setLoading] = useState(true)
  const load = async () => { setLoading(true); try { const { data } = await api.get('/parametres/categories'); setItems(data) } finally { setLoading(false) } }
  useEffect(() => { load() }, [])
  const add = async (e) => { e.preventDefault(); if (!nom.trim()) return; try { await api.post('/parametres/categories', { nom }); setNom(''); load() } catch (err) { toast.error(err.response?.data?.error || 'Erreur') } }
  const edit = async (c) => { const n = prompt('Nom de la catégorie', c.nom); if (!n) return; try { await api.put(`/parametres/categories/${c.id}`, { nom: n }); load() } catch { toast.error('Erreur') } }
  const remove = async (c) => { if (!confirm(`Supprimer "${c.nom}" ?`)) return; try { await api.delete(`/parametres/categories/${c.id}`); load() } catch { toast.error('Erreur') } }
  return (
    <div className="space-y-5">
      <SectionHeader title="Catégories de produits" desc="Gérez les catégories utilisées pour classer vos produits." />
      <form onSubmit={add} className="card flex flex-wrap items-end gap-3 p-5">
        <div className="flex-1"><label className="label">Ajouter une catégorie</label><input className="input" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nom de la catégorie..." /></div>
        <button type="submit" className="btn-primary"><Plus size={17} /> Ajouter</button>
      </form>
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3"><p className="text-xs font-semibold uppercase text-slate-500">{items.length} catégorie(s)</p><button onClick={load} className="flex items-center gap-1 text-sm text-slate-500 hover:text-brand-600"><RefreshCw size={14} /> Actualiser</button></div>
        {loading ? <Spinner /> : (
          <div className="divide-y divide-slate-100">
            {items.map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-5 py-3">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-violet-100 text-violet-600"><Tag size={16} /></span>
                <span className="flex-1 font-semibold text-slate-800">{c.nom}</span>
                <span className="text-sm text-slate-400">{c.nb_produits} produit(s)</span>
                <button onClick={() => edit(c)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600"><Pencil size={16} /></button>
                <button onClick={() => remove(c)} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Départements ───────────────────────────────────────────────────────── */
function Departements() {
  const toast = useToast()
  const [items, setItems] = useState([])
  const [nom, setNom] = useState('')
  const [loading, setLoading] = useState(true)
  const load = async () => { setLoading(true); try { const { data } = await api.get('/departements'); setItems(data) } finally { setLoading(false) } }
  useEffect(() => { load() }, [])
  const add = async (e) => { e.preventDefault(); if (!nom.trim()) return; try { await api.post('/departements', { nom }); setNom(''); load() } catch (err) { toast.error(err.response?.data?.error || 'Erreur') } }
  const edit = async (d) => { const n = prompt('Nom du département', d.nom); if (!n) return; try { await api.put(`/departements/${d.id}`, { nom: n }); load() } catch { toast.error('Erreur') } }
  const remove = async (d) => { if (!confirm(`Supprimer "${d.nom}" ?`)) return; try { await api.delete(`/departements/${d.id}`); load() } catch { toast.error('Erreur') } }
  return (
    <div className="space-y-5">
      <SectionHeader title="Départements" desc="Gérez les départements proposés lors de la création d'un employé." />
      <form onSubmit={add} className="card flex flex-wrap items-end gap-3 p-5">
        <div className="flex-1"><label className="label">Ajouter un département</label><input className="input" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nom du département..." /></div>
        <button type="submit" className="btn-primary"><Plus size={17} /> Ajouter</button>
      </form>
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3"><p className="text-xs font-semibold uppercase text-slate-500">{items.length} département(s)</p><button onClick={load} className="flex items-center gap-1 text-sm text-slate-500 hover:text-brand-600"><RefreshCw size={14} /> Actualiser</button></div>
        {loading ? <Spinner /> : (
          <div className="divide-y divide-slate-100">
            {items.map((d) => (
              <div key={d.id} className="flex items-center gap-3 px-5 py-3">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-violet-100 text-violet-600"><Briefcase size={16} /></span>
                <span className="flex-1 font-semibold text-slate-800">{d.nom}</span>
                <button onClick={() => edit(d)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600"><Pencil size={16} /></button>
                <button onClick={() => remove(d)} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Sécurité ───────────────────────────────────────────────────────────── */
const MODULES = ['dashboard', 'clients', 'produits', 'commandes', 'ventes', 'caisse', 'facturation', 'personnel', 'rapports', 'journal', 'parametres']
const POSTES = [
  { value: '', label: 'Aucun (par défaut)' },
  { value: 'comptable', label: 'Comptable' },
  { value: 'caissier', label: 'Caissier' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'magasinier', label: 'Magasinier' },
  { value: 'rh', label: 'Ressources Humaines' },
  { value: 'autre', label: 'Autre' },
]
function Securite() {
  const toast = useToast()
  const [pwd, setPwd] = useState({ ancien: '', nouveau: '', confirm: '', show: false })
  const [users, setUsers] = useState([])
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ username: '', email: '', nom: '', password: '', role: 'user', poste: '', permissions: [] })

  const loadUsers = async () => { try { const { data } = await api.get('/parametres/users'); setUsers(data) } catch { /* */ } }
  useEffect(() => { loadUsers() }, [])

  const changePwd = async (e) => {
    e.preventDefault()
    if (pwd.nouveau !== pwd.confirm) return toast.error('Les mots de passe ne correspondent pas')
    try { await api.post('/parametres/password', { ancien: pwd.ancien, nouveau: pwd.nouveau }); toast.success('Mot de passe modifié'); setPwd({ ancien: '', nouveau: '', confirm: '', show: false }) }
    catch (err) { toast.error(err.response?.data?.error || 'Erreur') }
  }

  const openNew = () => { setForm({ username: '', email: '', nom: '', password: '', role: 'user', poste: '', permissions: [] }); setEditing(null); setModal(true) }
  const openEdit = (u) => {
    let perms = []
    try { perms = JSON.parse(u.permissions) || [] } catch { perms = [] }
    setForm({ username: u.username || '', email: u.email || '', nom: u.nom, password: '', role: u.role, poste: u.poste || '', permissions: Array.isArray(perms) ? perms : [] })
    setEditing(u); setModal(true)
  }
  const toggle = (m) => setForm((f) => ({ ...f, permissions: f.permissions.includes(m) ? f.permissions.filter((x) => x !== m) : [...f.permissions, m] }))
  const submit = async (e) => {
    e.preventDefault()
    const payload = { ...form, permissions: form.role === 'user' ? form.permissions : null }
    try {
      if (editing) { await api.put(`/parametres/users/${editing.id}`, payload); toast.success('Utilisateur modifié') }
      else { await api.post('/parametres/users', payload); toast.success('Utilisateur créé') }
      setModal(false); loadUsers()
    } catch (err) { toast.error(err.response?.data?.error || 'Erreur') }
  }
  const remove = async (u) => { if (!confirm(`Supprimer ${u.nom} ?`)) return; try { await api.delete(`/parametres/users/${u.id}`); loadUsers() } catch (err) { toast.error(err.response?.data?.error || 'Erreur') } }

  const { user } = useAuth()
  const isSuperAdmin = user?.role === 'super_admin'
  const roleLabel = isSuperAdmin
    ? { super_admin: 'Super Admin', admin: 'Admin', user: 'Utilisateur' }
    : { admin: 'Admin', user: 'Utilisateur' }
  const roleColor = isSuperAdmin
    ? { super_admin: 'bg-violet-500/15 text-violet-400', admin: 'bg-brand-500/15 text-brand-400', user: '' }
    : { admin: 'bg-brand-500/15 text-brand-400', user: '' }
  const posteLabel = { comptable: 'Comptable', caissier: 'Caissier', commercial: 'Commercial', magasinier: 'Magasinier', rh: 'RH', autre: 'Autre' }

  return (
    <div className="space-y-5">
      <SectionHeader title="Sécurité" desc="Gestion du mot de passe et des comptes utilisateurs." />
      <form onSubmit={changePwd} className="card space-y-3 p-5">
        <p className="text-xs font-semibold uppercase text-slate-500">Changer mon mot de passe</p>
        <input type={pwd.show ? 'text' : 'password'} className="input" placeholder="Mot de passe actuel" value={pwd.ancien} onChange={(e) => setPwd({ ...pwd, ancien: e.target.value })} required />
        <input type={pwd.show ? 'text' : 'password'} className="input" placeholder="Nouveau mot de passe" value={pwd.nouveau} onChange={(e) => setPwd({ ...pwd, nouveau: e.target.value })} required />
        <input type={pwd.show ? 'text' : 'password'} className="input" placeholder="Confirmer le nouveau" value={pwd.confirm} onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })} required />
        <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={pwd.show} onChange={(e) => setPwd({ ...pwd, show: e.target.checked })} /> Afficher les mots de passe</label>
        <button type="submit" className="btn-primary w-fit"><Save size={16} /> Modifier le mot de passe</button>
      </form>
      <div className="table-wrap">
        <div className="flex items-center justify-between px-5 py-4"><p className="text-xs font-semibold uppercase text-slate-500">Utilisateurs</p><button onClick={openNew} className="btn-secondary py-2"><UserPlus size={15} /> Ajouter</button></div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-th">Utilisateur</th>
                <th className="table-th">Identifiant</th>
                <th className="table-th">Email</th>
                <th className="table-th">Rôle</th>
                <th className="table-th">Poste</th>
                <th className="table-th">Modules</th>
                <th className="table-th">Statut</th>
                <th className="table-th"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                let perms = null; try { perms = JSON.parse(u.permissions) } catch { perms = null }
                const isSA = u.role === 'super_admin'
                return (
                  <tr key={u.id} className="table-row-hover">
                    <td className="table-td"><div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-full bg-brand-50 text-xs font-bold text-brand-600">{u.nom[0].toUpperCase()}</span><span className="font-semibold text-slate-800">{u.nom}</span></div></td>
                    <td className="table-td font-mono text-xs text-slate-500">{u.username}</td>
                    <td className="table-td font-mono text-xs text-slate-500">{u.email}</td>
                    <td className="table-td"><span className={`badge ${roleColor[u.role]}`}>{roleLabel[u.role]}</span></td>
                    <td className="table-td text-sm text-slate-600">{u.poste ? (posteLabel[u.poste] || u.poste) : '—'}</td>
                    <td className="table-td text-sm text-slate-500">{u.role === 'user' ? <span className="flex flex-col gap-0.5"><span>{perms?.length ? `${perms.length} modules` : 'Aucun'}</span>{perms?.includes('can_delete') && <span className="badge bg-red-100 text-red-700 w-fit">Suppression</span>}</span> : <span className="font-semibold text-emerald-600">Accès complet</span>}</td>
                    <td className="table-td"><Badge status={u.actif ? 'actif' : 'inactif'} /></td>
                    <td className="table-td">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openEdit(u)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600"><Pencil size={16} /></button>
                        {u.id !== user?.id && <button onClick={() => remove(u)} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={16} /></button>}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'} icon={UserPlus}>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label">Nom complet</label><input className="input" required value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} /></div>
            <div><label className="label">Nom d'utilisateur</label><input className="input" required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="admin" /></div>
          </div>
          <div><label className="label">Email</label><input type="email" className="input" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="vous@entreprise.com" /></div>
          <div><label className="label">Mot de passe {editing && <span className="text-xs font-normal text-slate-400">(laisser vide pour ne pas changer)</span>}</label><input type="password" className="input" required={!editing} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
          <div><label className="label">Rôle</label>
            <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} disabled={editing?.role === 'super_admin'}>
              {isSuperAdmin && <option value="super_admin">Super Admin</option>}
              <option value="user">Utilisateur</option><option value="admin">Admin</option>
            </select>
          </div>
          <div><label className="label">Poste / Fonction</label>
            <select className="input" value={form.poste} onChange={(e) => setForm({ ...form, poste: e.target.value })}>
              {POSTES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
            <p className="mt-1 text-xs text-slate-400">Le poste détermine certains privilèges (ex: seul le comptable et les admins peuvent approvisionner la petite caisse)</p>
          </div>
          {form.role === 'user' && (
            <>
              <div>
                <label className="label">Modules autorisés</label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {MODULES.map((m) => (
                    <label key={m} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm capitalize ${form.permissions.includes(m) ? 'border-brand-400 bg-brand-50 text-brand-600' : 'border-slate-200 text-slate-600'}`}>
                      <input type="checkbox" checked={form.permissions.includes(m)} onChange={() => toggle(m)} /> {m}
                    </label>
                  ))}
                </div>
              </div>
              <label className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-semibold ${form.permissions.includes('can_delete') ? 'border-red-400 bg-red-50 text-red-700' : 'border-slate-200 text-slate-600'}`}>
                <input type="checkbox" checked={form.permissions.includes('can_delete')} onChange={() => toggle('can_delete')} /> Droit de suppression (toutes les données)
              </label>
              <label className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-semibold ${form.permissions.includes('can_print') ? 'border-brand-400 bg-brand-50 text-brand-600' : 'border-slate-200 text-slate-600'}`}>
                <input type="checkbox" checked={form.permissions.includes('can_print')} onChange={() => toggle('can_print')} /> Droit d'impression (factures, reçus, états de caisse)
              </label>
            </>
          )}
          <div className="flex gap-3 pt-2"><button type="button" onClick={() => setModal(false)} className="btn-secondary flex-1">Annuler</button><button type="submit" className="btn-primary flex-1"><Save size={17} /> {editing ? 'Enregistrer' : 'Créer'}</button></div>
        </form>
      </Modal>
    </div>
  )
}

/* ── Licence ────────────────────────────────────────────────────────────── */
function Licence({ onNavigate }) {
  const { user } = useAuth()
  const isSuperAdmin = user?.role === 'super_admin'
  const toast = useToast()
  const [info, setInfo] = useState(null)
  const reloadInfo = () => api.get('/licence/info').then(({ data }) => setInfo(data)).catch(() => setInfo(null))
  useEffect(() => { reloadInfo() }, [])

  // Licence management form (apply/renew directly)
  const [manageForm, setManageForm] = useState({ entreprise: '', expiration: '', max_users: '' })
  const [applying, setApplying] = useState(false)

  // Licence generation form (for other installations)
  const [form, setForm] = useState({ entreprise: '', expiration: '', max_users: '', modules: 'all' })
  const [generated, setGenerated] = useState(null)
  const [copied, setCopied] = useState(false)
  const [generating, setGenerating] = useState(false)

  const doApply = async (e) => {
    e.preventDefault()
    if (!manageForm.expiration) return
    setApplying(true)
    try {
      const payload = { expiration: manageForm.expiration }
      if (manageForm.entreprise) payload.entreprise = manageForm.entreprise
      if (manageForm.max_users) payload.max_users = parseInt(manageForm.max_users, 10)
      await api.post('/licence/apply', payload)
      toast.success('Licence appliquée avec succès')
      setManageForm({ entreprise: '', expiration: '', max_users: '' })
      reloadInfo()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur lors de l\'application de la licence')
    } finally { setApplying(false) }
  }

  const doRemove = async () => {
    if (!confirm('Supprimer la licence ? L\'application repassera en mode interne.')) return
    try {
      await api.delete('/licence/apply')
      toast.success('Licence supprimée')
      reloadInfo()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur')
    }
  }

  const doGenerate = async (e) => {
    e.preventDefault()
    if (!form.entreprise || !form.expiration) return
    setGenerating(true)
    try {
      const payload = { entreprise: form.entreprise, expiration: form.expiration }
      if (form.max_users) payload.max_users = parseInt(form.max_users, 10)
      if (form.modules) payload.modules = form.modules.split(',').map((m) => m.trim())
      const { data } = await api.post('/licence/generate', payload)
      setGenerated(data.key)
      setCopied(false)
      toast.success('Licence générée avec succès')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur lors de la génération')
    } finally { setGenerating(false) }
  }

  const copyKey = () => {
    navigator.clipboard.writeText(generated)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!info) return <Spinner />
  const rows = [
    ['Entreprise', info.entreprise || '—'],
    ['Expiration', info.expiration ? formatDate(info.expiration) : '—'],
    ['Jours restants', info.jours_restants != null ? `${info.jours_restants} jour(s)` : '—'],
    ['Utilisateurs max', info.max_users ?? 'Illimité'],
    ['Modules', Array.isArray(info.modules) ? info.modules.join(', ') : (info.modules || 'all')],
    ['Émise le', info.issued_at ? formatDate(info.issued_at) : '—'],
  ]
  return (
    <div className="space-y-5">
      <SectionHeader title="Licence" desc="Gérez la licence de cette installation." />
      <div className="card overflow-hidden">
        <div className={`flex items-center justify-between px-5 py-4 ${info.valid ? 'bg-emerald-50' : 'bg-red-50'}`}>
          <span className="flex items-center gap-2 font-semibold">
            <span className={`h-2.5 w-2.5 rounded-full ${info.valid ? 'bg-emerald-500' : 'bg-red-500'}`} />
            {info.valid ? 'Licence active' : (info.expired ? 'Licence expirée' : 'Licence invalide')}
          </span>
          {info.jours_restants != null && info.jours_restants <= 30 && info.valid && (
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-amber-600">Expire dans {info.jours_restants} jour(s)</span>
              {!isSuperAdmin && (
                <button type="button" onClick={() => onNavigate?.('apropos')} className="btn-secondary py-1.5 text-xs">
                  <LifeBuoy size={14} /> Renouveler
                </button>
              )}
            </div>
          )}
        </div>
        <div className="divide-y divide-slate-100">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between px-5 py-3.5"><span className="text-slate-500">{k}</span><span className="font-semibold text-slate-800">{v}</span></div>
          ))}
        </div>
      </div>
      {info.reason && <p className="text-sm text-slate-400">{info.reason}</p>}

      {/* Bouton renouveler pour les non-super_admin — redirige vers le support client */}
      {!isSuperAdmin && (info.expired || !info.valid) && (
        <div className="card p-5 space-y-3">
          <div className="flex items-center gap-2 text-red-700">
            <AlertTriangle size={18} />
            <span className="font-semibold">Licence expirée ou invalide</span>
          </div>
          <p className="text-sm text-slate-600">
            Votre licence a expiré. Veuillez contacter le support client pour la renouveler.
          </p>
          <button type="button" onClick={() => onNavigate?.('apropos')} className="btn-primary">
            <LifeBuoy size={16} /> Contacter le support client
          </button>
        </div>
      )}

      {/* Gestion de la licence — super_admin uniquement */}
      {isSuperAdmin && (
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4 font-bold text-slate-800">
            <ShieldCheck size={18} /> Gérer la licence de cette installation
          </div>
          <div className="p-5 space-y-4">
            <p className="text-sm text-slate-500">
              Définissez la durée de la licence pour cette application. À l'expiration, seuls les super administrateurs pourront se connecter pour la renouveler.
            </p>
            <form onSubmit={doApply} className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="label">Nom de l'entreprise</label>
                <input className="input" placeholder="Ex: Mbila Service" value={manageForm.entreprise} onChange={(e) => setManageForm({ ...manageForm, entreprise: e.target.value })} />
              </div>
              <div>
                <label className="label">Date d'expiration *</label>
                <input type="date" className="input" value={manageForm.expiration} onChange={(e) => setManageForm({ ...manageForm, expiration: e.target.value })} required />
              </div>
              <div>
                <label className="label">Utilisateurs max (vide = illimité)</label>
                <input type="number" className="input" placeholder="Ex: 10" value={manageForm.max_users} onChange={(e) => setManageForm({ ...manageForm, max_users: e.target.value })} />
              </div>
              <div className="sm:col-span-2 flex gap-3">
                <button type="submit" disabled={applying} className="btn-primary">
                  <ShieldCheck size={16} /> {applying ? 'Application...' : (info.expired ? 'Renouveler la licence' : 'Appliquer / Renouveler')}
                </button>
                {info.expiration && (
                  <button type="button" onClick={doRemove} className="btn-secondary text-red-600 hover:bg-red-50">
                    Supprimer la licence
                  </button>
                )}
              </div>
            </form>
            {info.expired && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-4 space-y-3">
                <p className="text-sm text-red-800">
                  <b>Licence expirée.</b> Les utilisateurs normaux ne peuvent plus se connecter. Renouvelez la licence pour rétablir l'accès.
                </p>
                <button type="button" onClick={() => onNavigate?.('apropos')} className="btn-secondary text-sm py-2">
                  <LifeBuoy size={15} /> Contacter le support client
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Générateur de licence pour autres installations — super_admin uniquement */}
      {isSuperAdmin && (
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4 font-bold text-slate-800">
            <Sparkles size={18} /> Générer une licence pour une autre installation
          </div>
          <div className="p-5 space-y-4">
            <p className="text-sm text-slate-500">
              Générez une clé de licence pour une autre machine. La clé utilisera le secret défini dans <code className="rounded bg-slate-100 px-1 text-xs">LICENCE_SECRET</code>.
            </p>
            <form onSubmit={doGenerate} className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="label">Nom de l'entreprise *</label>
                <input className="input" placeholder="Ex: Société ABC SARL" value={form.entreprise} onChange={(e) => setForm({ ...form, entreprise: e.target.value })} required />
              </div>
              <div>
                <label className="label">Date d'expiration *</label>
                <input type="date" className="input" value={form.expiration} onChange={(e) => setForm({ ...form, expiration: e.target.value })} required />
              </div>
              <div>
                <label className="label">Utilisateurs max (vide = illimité)</label>
                <input type="number" className="input" placeholder="Ex: 10" value={form.max_users} onChange={(e) => setForm({ ...form, max_users: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Modules (séparés par virgule)</label>
                <input className="input" placeholder="all" value={form.modules} onChange={(e) => setForm({ ...form, modules: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <button type="submit" disabled={generating} className="btn-secondary">
                  <KeyRound size={16} /> {generating ? 'Génération...' : 'Générer la clé'}
                </button>
              </div>
            </form>

            {generated && (
              <div className="rounded-lg border-2 border-brand-200 bg-brand-50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-brand-600">Clé de licence générée</span>
                  <button onClick={copyKey} className="btn-secondary py-1.5 text-xs">
                    {copied ? <><Check size={14} /> Copié !</> : <><Copy size={14} /> Copier</>}
                  </button>
                </div>
                <textarea readOnly className="w-full rounded-lg border border-brand-200 bg-white p-3 font-mono text-xs text-slate-700" rows={4} value={generated} onClick={(e) => e.target.select()} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Base de données ────────────────────────────────────────────────────── */
function BaseDonnees() {
  const { devise, reload: reloadSettings } = useSettings()
  const toast = useToast()
  const [data, setData] = useState(null)
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false)
  const [pendingFile, setPendingFile] = useState(null)
  const fileRef = useRef(null)
  const load = () => api.get('/parametres/database').then(({ data }) => setData(data)).catch(() => setData(null))
  useEffect(() => { load() }, [])

  const doExport = async () => {
    setExporting(true)
    try {
      const resp = await api.get('/parametres/backup', { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([resp.data]))
      const a = document.createElement('a')
      a.href = url
      const disposition = resp.headers['content-disposition'] || ''
      const match = disposition.match(/filename="([^"]+)"/)
      a.download = match ? match[1] : `sauvegarde_${new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-')}.bak`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      toast.success('Sauvegarde téléchargée avec succès')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur lors de la sauvegarde')
    } finally { setExporting(false) }
  }

  const onFileSelected = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setPendingFile(file)
    setShowRestoreConfirm(true)
  }

  const doRestore = async () => {
    if (!pendingFile) return
    setImporting(true)
    try {
      const text = await pendingFile.text()
      const json = JSON.parse(text)
      await api.post('/parametres/restore', json)
      toast.success('Données restaurées avec succès')
      setShowRestoreConfirm(false)
      setPendingFile(null)
      // Reload settings context so configuration changes are applied
      await reloadSettings()
      load()
      // Full page reload after a short delay to refresh all data across the app
      setTimeout(() => window.location.reload(), 1500)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Fichier invalide ou erreur lors de la restauration')
    } finally { setImporting(false) }
  }

  if (!data) return <Spinner />
  const cards = [
    { label: 'Clients', value: `${data.clients.actifs} / ${data.clients.total}`, sub: 'actifs / total', color: 'bg-brand-100 text-brand-600' },
    { label: 'Produits', value: `${data.produits.actifs} / ${data.produits.total}`, sub: 'actifs / total', color: 'bg-violet-100 text-violet-600' },
    { label: 'Catégories', value: data.categories, sub: 'familles produit', color: 'bg-emerald-100 text-emerald-600' },
    { label: 'Commandes', value: data.commandes.total, sub: `${data.commandes.livrees} livrée(s)`, color: 'bg-amber-100 text-amber-600' },
    { label: 'CA total livré', value: formatMoney(data.ca_livre, devise), sub: 'toutes périodes', color: 'bg-emerald-100 text-emerald-600' },
    { label: 'Lignes de cmd', value: data.lignes_commande, sub: 'articles commandés', color: 'bg-slate-100 text-slate-500' },
  ]
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <SectionHeader title="Base de données" desc="Statistiques, sauvegarde et restauration des données." />
        <button onClick={load} className="btn-secondary py-2"><RefreshCw size={15} /> Actualiser</button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="card p-5">
            <span className={`mb-3 grid h-10 w-10 place-items-center rounded-lg ${c.color}`}><Database size={18} /></span>
            <p className="text-2xl font-bold text-slate-800">{c.value}</p>
            <p className="text-sm font-medium text-slate-600">{c.label}</p>
            <p className="text-xs text-slate-400">{c.sub}</p>
          </div>
        ))}
      </div>
      <div className="card space-y-3 p-5">
        <p className="text-xs font-semibold uppercase text-slate-500">Informations</p>
        <div className="flex justify-between text-sm"><span className="text-slate-500">Première commande</span><span className="font-medium">{data.premiere_commande ? formatDate(data.premiere_commande) : '—'}</span></div>
        <div className="flex justify-between text-sm"><span className="text-slate-500">Dernière commande</span><span className="font-medium">{data.derniere_commande ? formatDate(data.derniere_commande) : '—'}</span></div>
      </div>

      {/* Sauvegarde / Restauration */}
      <div className="card space-y-4 p-5">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-500/15 text-brand-600"><Database size={20} /></span>
          <div>
            <p className="font-semibold text-slate-800">Sauvegarde & Restauration</p>
            <p className="text-sm text-slate-500">Exportez toutes vos données dans un fichier, ou restaurez-les sur cette machine ou une autre.</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 p-4">
            <div className="mb-2 flex items-center gap-2 text-slate-700"><Download size={18} className="text-brand-600" /><span className="font-semibold">Exporter les données</span></div>
            <p className="mb-3 text-xs text-slate-500">Télécharge un fichier contenant toutes les données de l'application (clients, produits, commandes, employés, paie, etc.).</p>
            <button onClick={doExport} disabled={exporting} className="btn-primary w-full py-2.5">
              {exporting ? <><RefreshCw size={16} className="animate-spin" /> Export en cours...</> : <><Download size={16} /> Télécharger la sauvegarde</>}
            </button>
          </div>
          <div className="rounded-xl border border-slate-200 p-4">
            <div className="mb-2 flex items-center gap-2 text-slate-700"><Upload size={18} className="text-violet-600" /><span className="font-semibold">Restaurer les données</span></div>
            <p className="mb-3 text-xs text-slate-500">Importe un fichier de sauvegarde. <b className="text-red-600">Toutes les données actuelles seront remplacées.</b></p>
            <input ref={fileRef} type="file" accept=".bak,.json" onChange={onFileSelected} className="hidden" />
            <button onClick={() => fileRef.current?.click()} disabled={importing} className="btn-secondary w-full py-2.5">
              {importing ? <><RefreshCw size={16} className="animate-spin" /> Restauration...</> : <><Upload size={16} /> Choisir un fichier</>}
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <b>Sauvegarde recommandée</b> — Effectuez des sauvegardes régulières de votre base de données pour protéger vos données.
      </div>

      {/* Modal confirmation restauration */}
      <Modal open={showRestoreConfirm} onClose={() => { setShowRestoreConfirm(false); setPendingFile(null) }} title="Confirmer la restauration" icon={AlertTriangle} size="sm">
        <div className="space-y-4">
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <p className="font-semibold">⚠️ Attention</p>
            <p className="mt-1">Cette action va <b>remplacer toutes les données actuelles</b> par celles du fichier <b>{pendingFile?.name}</b>. Cette opération est irréversible.</p>
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => { setShowRestoreConfirm(false); setPendingFile(null) }} className="btn-secondary py-2">Annuler</button>
            <button onClick={doRestore} disabled={importing} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">
              {importing ? <><RefreshCw size={16} className="animate-spin" /> Restauration...</> : 'Confirmer la restauration'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

/* ── À propos ───────────────────────────────────────────────────────────── */
function APropos() {
  const { appName, settings } = useSettings()
  return (
    <div className="space-y-5">
      <SectionHeader title="À propos" desc="Informations sur l'application." />
      <div className="card p-5">
        <p className="text-xs font-semibold uppercase text-slate-500">Support client</p>
        <div className="mt-3 space-y-3">
          <div className="flex items-center gap-3 text-sm text-slate-700">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-100 text-brand-600"><Mail size={17} /></span>
            <a href="mailto:rochrmt55@gmail.com" className="font-medium hover:text-brand-600">rochrmt55@gmail.com</a>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-700">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-100 text-emerald-600"><MessageCircle size={17} /></span>
            <span className="font-medium">WhatsApp : 72679175</span>
          </div>
        </div>
      </div>
      <div className="card overflow-hidden">
        <div className="flex items-center gap-4 bg-slate-900 px-6 py-6 text-white">
          <span className="grid h-16 w-16 place-items-center overflow-hidden rounded-2xl bg-brand-600 text-2xl font-bold">
            {settings.logo ? <img src={settings.logo} alt="logo" className="h-full w-full object-cover" /> : appName[0].toUpperCase()}
          </span>
          <div><h3 className="text-2xl font-bold">{appName}</h3><p className="text-brand-300">Application de Gestion d'Entreprise</p></div>
        </div>
        <div className="divide-y divide-slate-100">
          {[
            ['Version', '1.0.0'],
            ['Éditeur', settings.editeur || '—'],
            ['Contact', settings.email || '—'],
            ['Licence', 'Usage interne entreprise'],
            ['Année', String(new Date().getFullYear())],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between px-6 py-3.5"><span className="text-slate-500">{k}</span><span className="font-semibold text-slate-800">{v}</span></div>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-center gap-2 pt-2">
        <img src="/mbila-logo.png" alt="Mbila Service" className="h-14 w-auto opacity-80" />
        <span className="text-base text-slate-400">by Mbila Service</span>
      </div>
    </div>
  )
}
