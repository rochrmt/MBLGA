import { useState, useEffect, useRef } from 'react'
import {
  FileText, Upload, Download, Trash2, CheckCircle2, Clock, FileCheck,
} from 'lucide-react'
import api, { formatDateTime } from '../lib/api'
import { useAuth } from '../context/Auth'
import { Modal, Spinner, useToast } from '../components/ui'

export default function MesRapports() {
  const { user } = useAuth()
  const toast = useToast()
  const [rapports, setRapports] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ titre: '', periode: '', description: '' })
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef(null)

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/rapports-employes')
      setRapports(data)
    } catch {
      toast.error('Erreur lors du chargement')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const submit = async (e) => {
    e.preventDefault()
    if (!file) { toast.error('Veuillez sélectionner un fichier'); return }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('titre', form.titre)
      fd.append('periode', form.periode)
      fd.append('description', form.description)
      fd.append('fichier', file)
      await api.post('/rapports-employes/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      toast.success('Rapport envoyé avec succès')
      setModal(false)
      setForm({ titre: '', periode: '', description: '' })
      setFile(null)
      if (fileRef.current) fileRef.current.value = ''
      load()
    } catch (err) {
      toast.error(err.response?.data?.error || "Erreur lors de l'envoi")
    } finally {
      setUploading(false)
    }
  }

  const download = async (id) => {
    try {
      const res = await api.get(`/rapports-employes/${id}/download`, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = rapports.find(r => r.id === id)?.nom_original || 'rapport'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Erreur lors du téléchargement')
    }
  }

  const remove = async (id) => {
    if (!confirm('Supprimer ce rapport ?')) return
    try {
      await api.delete(`/rapports-employes/${id}`)
      toast.success('Rapport supprimé')
      load()
    } catch {
      toast.error('Erreur lors de la suppression')
    }
  }

  if (loading) return <Spinner />

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Mes Rapports d'Activité</h2>
          <p className="text-sm text-slate-400">Uploadez vos rapports pour l'administration</p>
        </div>
        <button type="button" onClick={() => setModal(true)} className="btn-primary">
          <Upload size={18} /> Nouveau rapport
        </button>
      </div>

      <div className="table-wrap">
        <div className="flex items-center gap-2 px-5 py-4 font-bold text-slate-800">
          <FileText size={17} /> Mes rapports envoyés ({rapports.length})
        </div>
        <div className="overflow-x-auto">
          {rapports.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <span className="grid h-16 w-16 place-items-center rounded-full bg-slate-100 text-slate-400"><FileText size={30} /></span>
              <p className="text-sm text-slate-500">Aucun rapport envoyé pour le moment</p>
              <button type="button" onClick={() => setModal(true)} className="btn-primary mt-2"><Upload size={18} /> Envoyer mon premier rapport</button>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-th">Titre</th>
                  <th className="table-th">Période</th>
                  <th className="table-th">Fichier</th>
                  <th className="table-th">Date</th>
                  <th className="table-th">Statut</th>
                  <th className="table-th text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rapports.map((r) => (
                  <tr key={r.id} className="table-row-hover">
                    <td className="table-td">
                      <p className="font-semibold text-slate-800">{r.titre}</p>
                      {r.description && <p className="text-xs text-slate-400">{r.description}</p>}
                    </td>
                    <td className="table-td text-slate-600">{r.periode || '—'}</td>
                    <td className="table-td text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1"><FileText size={14} /> {r.nom_original}</span>
                    </td>
                    <td className="table-td text-slate-500">{formatDateTime(r.date_upload)}</td>
                    <td className="table-td">
                      {r.lu_admin ? (
                        <span className="badge bg-emerald-100 text-emerald-700"><CheckCircle2 size={13} /> Lu par admin</span>
                      ) : (
                        <span className="badge bg-amber-100 text-amber-700"><Clock size={13} /> En attente</span>
                      )}
                    </td>
                    <td className="table-td text-right">
                      <div className="flex justify-end gap-1">
                        <button type="button" onClick={() => download(r.id)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" title="Télécharger">
                          <Download size={16} />
                        </button>
                        <button type="button" onClick={() => remove(r.id)} className="rounded-lg p-2 text-red-500 hover:bg-red-50" title="Supprimer">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Envoyer un rapport d'activité" icon={Upload} size="md">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Titre du rapport *</label>
            <input className="input" value={form.titre} onChange={(e) => setForm({ ...form, titre: e.target.value })} required placeholder="Ex: Rapport mensuel Juillet 2026" autoFocus />
          </div>
          <div>
            <label className="label">Période</label>
            <input className="input" value={form.periode} onChange={(e) => setForm({ ...form, periode: e.target.value })} placeholder="Ex: Juillet 2026, Semaine 30, Q3 2026..." />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Résumé de votre activité..." />
          </div>
          <div>
            <label className="label">Fichier * (PDF, Word, Excel — 20 Mo max)</label>
            <input ref={fileRef} type="file" className="input" onChange={(e) => setFile(e.target.files[0])} required />
            {file && <p className="mt-1 text-xs text-slate-500">{file.name} ({(file.size / 1024).toFixed(0)} Ko)</p>}
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setModal(false)} className="btn-secondary flex-1">Annuler</button>
            <button type="submit" disabled={uploading} className="btn-primary flex-1">
              {uploading ? 'Envoi...' : <><Upload size={17} /> Envoyer</>}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
