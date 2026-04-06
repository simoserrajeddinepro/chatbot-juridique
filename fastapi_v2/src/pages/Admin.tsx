import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Settings, Save, ArrowLeft, Sliders, FileText, Database, ShieldAlert, CheckCircle2 } from "lucide-react";

export default function Admin() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [purging, setPurging] = useState(false);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  
  const [config, setConfig] = useState({
    system_prompt_fr: "",
    system_prompt_ar: "",
    rag_threshold: 1.4,
    top_k: 3
  });

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const token = localStorage.getItem("auth_token");
      const res = await axios.get("/api/admin/config", {
        headers: { Authorization: `Bearer ${token}` }
      });
      setConfig(res.data);
    } catch (err) {
      setMessage({ type: 'error', text: "Erreur de connexion au serveur" });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const token = localStorage.getItem("auth_token");
      await axios.post("/api/admin/config", config, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessage({ type: 'success', text: "Configuration sauvegardée avec succès !" });
      setTimeout(() => setMessage(null), 4000);
    } catch (err) {
      setMessage({ type: 'error', text: "Échec de la sauvegarde" });
    } finally {
      setSaving(false);
    }
  };

  const handlePurge = async () => {
    if (!window.confirm("ATTENTION : Cette action va effacer de la mémoire vive tous vos documents PDF indexés ! Vous devrez les ré-uploader. Êtes-vous sûr ?")) return;
    
    setPurging(true);
    try {
      const token = localStorage.getItem("auth_token");
      await axios.delete("/api/admin/purge", {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessage({ type: 'success', text: "Base de données vectorielle FAISS purgée !" });
    } catch (err) {
      setMessage({ type: 'error', text: "Échec de la purge" });
    } finally {
      setPurging(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <div className="w-8 h-8 border-2 border-t-transparent border-emerald-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-8 font-sans selection:bg-emerald-500/30">
      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-800">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate("/chat")}
              className="p-2 hover:bg-slate-800 rounded-xl transition-colors text-slate-400 hover:text-slate-200"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <Settings size={20} className="text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight">Espace Administrateur</h1>
                <p className="text-sm text-slate-400 font-medium">Contrôle neuronal et Base Vectorielle</p>
              </div>
            </div>
          </div>
          <button 
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl font-medium transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
          >
            {saving ? <div className="w-4 h-4 border-2 border-t-transparent border-white rounded-full animate-spin"></div> : <Save size={18} />}
            Enregistrer
          </button>
        </div>

        {message && (
          <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 font-medium border ${message.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-400'}`}>
            <CheckCircle2 size={18} className="shrink-0" />
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Main Controls (2/3 width) */}
          <div className="md:col-span-2 space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center gap-2 mb-6">
                <FileText size={18} className="text-indigo-400" />
                <h2 className="text-lg font-semibold text-white">Directives IA (System Prompts)</h2>
              </div>
              
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Comportement Général (Français)</label>
                  <textarea 
                    value={config.system_prompt_fr}
                    onChange={(e) => setConfig({...config, system_prompt_fr: e.target.value})}
                    className="w-full h-32 bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-slate-300 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all resize-none leading-relaxed"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Comportement Général (Arabe)</label>
                  <textarea 
                    dir="rtl"
                    value={config.system_prompt_ar}
                    onChange={(e) => setConfig({...config, system_prompt_ar: e.target.value})}
                    className="w-full h-32 bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-slate-300 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all resize-none leading-relaxed font-sans"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar Controls (1/3 width) */}
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center gap-2 mb-6">
                <Sliders size={18} className="text-emerald-400" />
                <h2 className="text-lg font-semibold text-white">Moteur RAG (FAISS)</h2>
              </div>
              
              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-slate-400">Seuil de Tolérance</label>
                    <span className="text-xs font-bold text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-md">{config.rag_threshold}</span>
                  </div>
                  <input 
                    type="range" 
                    min="0.5" max="2.0" step="0.1"
                    value={config.rag_threshold}
                    onChange={(e) => setConfig({...config, rag_threshold: parseFloat(e.target.value)})}
                    className="w-full accent-emerald-500 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
                  />
                  <p className="text-xs text-slate-500 mt-2 font-medium">Un seuil bas (ex: 0.8) force l'IA à être ultra-stricte. Un seuil haut (ex: 1.6) permet de trouver des textes lointains.</p>
                </div>

                <div className="pt-2">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-slate-400">Extraits retournés (Top K)</label>
                    <span className="text-xs font-bold text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-md">{config.top_k}</span>
                  </div>
                  <input 
                    type="range" 
                    min="1" max="10" step="1"
                    value={config.top_k}
                    onChange={(e) => setConfig({...config, top_k: parseInt(e.target.value)})}
                    className="w-full accent-emerald-500 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              </div>
            </div>

            <div className="bg-rose-500/5 border border-rose-500/20 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center gap-2 mb-4">
                <Database size={18} className="text-rose-400" />
                <h2 className="text-lg font-semibold text-rose-400">Zone de Danger</h2>
              </div>
              <p className="text-xs text-rose-300/70 mb-5 font-medium leading-relaxed">
                Purgez la mémoire vectorielle interne si l'index est corrompu ou pour libérer la RAM du serveur.
              </p>
              <button 
                onClick={handlePurge}
                disabled={purging}
                className="w-full flex items-center justify-center gap-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
              >
                {purging ? <div className="w-4 h-4 border-2 border-t-transparent border-rose-500 rounded-full animate-spin"></div> : <ShieldAlert size={16} />}
                Purger la FAISS DB
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
