import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MessageSquare, Plus, LogOut, Send, Globe, Printer, BookOpen, Upload, X, Trash2, Edit2, Bot, Zap, Settings, Search } from "lucide-react";
import axios from "axios";

export default function Chat() {
  const navigate = useNavigate();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const [input, setInput] = useState("");
  const [language, setLanguage] = useState<"FR" | "AR">("FR");
  const [sessions, setSessions] = useState<any[]>([]);
  const [filteredSessions, setFilteredSessions] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Document Mngmt State
  const [showDocs, setShowDocs] = useState(false);
  const [documents, setDocuments] = useState<{name: string}[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const userEmail = localStorage.getItem("user_email") || "User";
  const token = localStorage.getItem("auth_token");

  useEffect(() => {
    if (!token) {
      navigate("/login");
      return;
    }
    axios.get("/api/sessions", {
      headers: { Authorization: `Bearer ${token}` }
    }).then(res => {
      setSessions(res.data);
      if (res.data.length > 0) setActiveSessionId(res.data[0].id);
    }).catch(err => {
      if (err.response?.status === 401) handleLogout();
    });
  }, [navigate, token]);

  // Sync Search Filtering
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredSessions(sessions);
    } else {
      const q = searchQuery.toLowerCase();
      setFilteredSessions(sessions.filter((s: any) => 
        s.title.toLowerCase().includes(q) || 
        s.messages.some((m: any) => m.text.toLowerCase().includes(q))
      ));
    }
  }, [searchQuery, sessions]);

  const activeSession = sessions.find(s => s.id === activeSessionId);
  const messages = activeSession ? activeSession.messages : [];

  const handleLogout = () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("user_email");
    navigate("/login");
  };

  const openDocsModal = async () => {
    setShowDocs(true);
    fetchDocuments();
  };

  const fetchDocuments = async () => {
    try {
      const res = await axios.get("/api/documents", {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDocuments(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append("file", file);
    
    setIsUploading(true);
    try {
      await axios.post("/api/documents/upload", formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data" 
        }
      });
      fetchDocuments();
    } catch (err: any) {
      alert("Erreur: " + (err.response?.data?.detail || err.message));
    } finally {
      setIsUploading(false);
    }
  };

  const generatePDF = () => {
    // Le nouveau hack d'impression CSS (print-color-adjust: exact)
    // va conserver tous les dégradés et OKLCH parfaitement !
    window.print();
  };

  const handleNewChat = () => {
    const newId = Date.now().toString();
    const newSession = {
      id: newId,
      title: language === "FR" ? "Nouvelle Discussion" : "محادثة جديدة",
      messages: [{ role: "assistant", text: language === "FR" ? "Bonjour ! Je suis connecté et prêt. (Version V2 UI)" : "مرحباً! أنا متصل وجاهز." }]
    };
    setSessions([newSession, ...sessions]);
    setActiveSessionId(newId);
    
    // Save to DB
    axios.post("/api/sessions", newSession, {
      headers: { Authorization: `Bearer ${token}` }
    }).catch(console.error);
  };

  const handleDeleteSession = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm(language === "FR" ? "Supprimer cette discussion ?" : "حذف هذه المحادثة ؟")) return;
    
    try {
      await axios.delete(`/api/sessions/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const newSessions = sessions.filter(s => s.id !== id);
      setSessions(newSessions);
      if (activeSessionId === id) {
        setActiveSessionId(newSessions.length > 0 ? newSessions[0].id : null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRenameSession = async (e: React.MouseEvent, session: any) => {
    e.stopPropagation();
    const newTitle = window.prompt(language === "FR" ? "Nouveau nom :" : "اسم جديد :", session.title);
    if (!newTitle || newTitle.trim() === "" || newTitle === session.title) return;
    
    const updatedSession = { ...session, title: newTitle.trim() };
    
    try {
      setSessions(sessions.map(s => s.id === session.id ? updatedSession : s));
      await axios.post("/api/sessions", updatedSession, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !activeSessionId || !activeSession || isLoading) return;
    
    const userMsg = { role: "user", text: input };
    const newMessages = [...messages, userMsg];
    let newTitle = activeSession.title;
    
    // Titre dynamique si c'est la 1ère question
    if (newMessages.length === 2 && input.length > 3) {
      newTitle = input.substring(0, 25) + "...";
    }

    const updatedSession = { ...activeSession, title: newTitle, messages: newMessages };

    // MAJ React Immédiate
    setSessions(sessions.map(s => s.id === activeSessionId ? updatedSession : s));
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'; // Reset de la hauteur
    }
    setIsLoading(true);

    // Sauvegarde en DB du message de l'utilisateur
    try {
      await axios.post("/api/sessions", updatedSession, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Appel de l'IA (Streaming) !
      const streamRes = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}` 
        },
        body: JSON.stringify({
          history: newMessages,
          language: language
        })
      });

      if (!streamRes.ok) throw new Error("Erreur HTTP de l'API Stream");

      const sourceType = streamRes.headers.get("X-Source-Type") || "api";
      
      const reader = streamRes.body?.getReader();
      const decoder = new TextDecoder("utf-8");
      
      // On prépare le conteneur du message bot vide
      let accumulatedText = "";
      const botMsg = { role: "assistant", text: "", source: sourceType };
      const currentMessagesWithBot = [...newMessages, botMsg];
      
      const sessionWithBot = { ...updatedSession, messages: currentMessagesWithBot };
      setSessions(prev => prev.map(s => s.id === activeSessionId ? sessionWithBot : s));
      setIsLoading(false); // Le spinner s'arrête, la frappe commence.

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          accumulatedText += decoder.decode(value, { stream: true });
          
          let displayTokens = 0;
          let displayText = accumulatedText;
          const usageMatch = accumulatedText.match(/__USAGE__:(\d+)/);
          
          if (usageMatch) {
            displayTokens = parseInt(usageMatch[1], 10);
            displayText = accumulatedText.replace(usageMatch[0], "");
          }
          
          // Mise à jour de React syllabe par syllabe
          setSessions(prevSessions => prevSessions.map(s => {
            if (s.id === activeSessionId) {
              const msgs = [...s.messages];
              msgs[msgs.length - 1] = { 
                ...msgs[msgs.length - 1], 
                text: displayText,
                ...(displayTokens > 0 ? { tokens: displayTokens } : {})
              };
              return { ...s, messages: msgs };
            }
            return s;
          }));
        }
        
        // Finalement (quand terminé), on extract encore pour la bdd
        let finalTokens = 0;
        let finalStr = accumulatedText;
        const finalMatch = accumulatedText.match(/__USAGE__:(\d+)/);
        if (finalMatch) {
            finalTokens = parseInt(finalMatch[1], 10);
            finalStr = accumulatedText.replace(finalMatch[0], "");
        }

        const finalSession = { 
          ...updatedSession, 
          messages: [...newMessages, { role: "assistant", text: finalStr, source: sourceType, ...(finalTokens > 0 ? { tokens: finalTokens } : {}) }] 
        };
        await axios.post("/api/sessions", finalSession, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }

    } catch (err) {
      console.error(err);
      setIsLoading(false);
      // Fallback
      const errorMsg = { role: "assistant", text: "❌ Erreur lors de l'analyse IA. Vérifiez le terminal FastAPI." };
      setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...updatedSession, messages: [...newMessages, errorMsg] } : s));
    }
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 overflow-hidden font-sans print:bg-slate-950 print:text-slate-200 print:h-auto selection:bg-emerald-500/30" dir={language === "AR" ? "rtl" : "ltr"}>
      
      {/* Sidebar (Desktop) */}
      <div className="hidden md:flex flex-col w-[280px] bg-slate-900 border-r border-slate-800 p-3 print:hidden shadow-xl z-20">
        <button 
          onClick={handleNewChat}
          className="flex items-center gap-3 bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 rounded-xl p-3 mb-4 transition-all duration-200 text-sm font-medium shadow-sm hover:shadow-emerald-900/20 active:scale-[0.98]"
        >
          <Plus size={18} />
          {language === "FR" ? "Nouveau Chat" : "محادثة جديدة"}
        </button>
        
        {/* Search Bar */}
        <div className="relative mb-5 group">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={14} className="text-slate-500 group-hover:text-indigo-400 transition-colors" />
          </div>
          <input
            type="text"
            placeholder={language === "FR" ? "Rechercher..." : "البحث في المحادثات..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950/50 border border-slate-800 text-slate-300 text-xs font-medium rounded-lg pl-9 pr-8 py-2.5 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all placeholder:text-slate-600 shadow-sm"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute inset-y-0 right-0 pr-3 flex items-center hover:text-slate-300 transition-colors">
              <X size={12} className="text-slate-500" />
            </button>
          )}
        </div>
        
        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
          {filteredSessions.length === 0 && (
            <div className="text-slate-500 text-xs text-center mt-6 font-medium px-2">
              {searchQuery 
                ? (language === "FR" ? "Aucun résultat trouvé." : "لا توجد نتائج.") 
                : (language === "FR" ? "Aucune discussion." : "لا توجد محادثات.")}
            </div>
          )}
          {filteredSessions.map(s => (
            <div 
              key={s.id}
              onClick={() => setActiveSessionId(s.id)}
              className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer text-sm transition-all duration-200 group ${activeSessionId === s.id ? 'bg-slate-800 shadow-sm border border-slate-700/50' : 'hover:bg-slate-800/50 border border-transparent'}`}
            >
              <MessageSquare size={16} className={`shrink-0 transition-colors ${activeSessionId === s.id ? "text-emerald-400" : "text-slate-500 group-hover:text-slate-400"}`} />
              <span className={`flex-1 truncate font-medium ${activeSessionId === s.id ? "text-slate-200" : "text-slate-400 group-hover:text-slate-300"}`}>{s.title}</span>
              
              <div className="hidden group-hover:flex items-center gap-1 shrink-0">
                <button onClick={(e) => handleRenameSession(e, s)} className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-700/50 rounded-lg transition-all" title="Renommer">
                  <Edit2 size={14} />
                </button>
                <button onClick={(e) => handleDeleteSession(e, s.id)} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-700/50 rounded-lg transition-all" title="Supprimer">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Footer Sidebar */}
        <div className="border-t border-slate-800 pt-3 mt-3 space-y-1">
          <button 
            onClick={() => navigate('/admin')}
            className="flex w-full items-center gap-3 p-3 rounded-xl hover:bg-indigo-500/10 transition-all duration-200 text-sm font-medium text-slate-300 hover:text-indigo-400 group mb-2"
          >
            <Settings size={18} className="text-slate-500 group-hover:text-indigo-400 transition-colors" />
            {language === "FR" ? "Paramètres IA (Admin)" : "إعدادات الذكاء الاصطناعي"}
          </button>
          
          <div className="flex justify-between items-center p-2 mb-1 border-t border-slate-800/50 pt-3">
             <div className="flex items-center gap-2 text-sm font-medium text-slate-400">
               <Globe size={16} />
               <span>{language === "FR" ? "Langue" : "اللغة"}</span>
             </div>
             <div className="flex gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                <button onClick={() => setLanguage("FR")} className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${language === "FR" ? "bg-slate-800 text-white shadow-sm" : "text-slate-500 hover:text-slate-300"}`}>FR</button>
                <button onClick={() => setLanguage("AR")} className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${language === "AR" ? "bg-slate-800 text-white shadow-sm" : "text-slate-500 hover:text-slate-300"}`}>AR</button>
             </div>
          </div>
          
          <button onClick={openDocsModal} className="flex w-full items-center gap-3 p-3 rounded-xl hover:bg-slate-800/80 transition-all duration-200 text-sm font-medium text-slate-300 group">
            <BookOpen size={18} className="text-slate-500 group-hover:text-indigo-400 transition-colors" />
            {language === "FR" ? "Base Documentaire" : "إدارة الوثائق"}
          </button>
          
          <button onClick={handleLogout} className="flex w-full items-center gap-3 p-3 rounded-xl hover:bg-red-500/10 transition-all duration-200 text-sm font-medium text-slate-300 hover:text-red-400 group">
            <LogOut size={18} className="text-slate-500 group-hover:text-red-400 transition-colors" />
            Déconnexion ({userEmail.split('@')[0]})
          </button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative print:w-full print:block bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950">
        
        {/* Header (Top bar for print button) */}
        {activeSessionId && (
          <div className="w-full flex justify-end p-4 absolute top-0 right-0 z-10 print:hidden bg-gradient-to-b from-slate-900 to-transparent">
            <button 
              onClick={generatePDF}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800/80 hover:bg-slate-700 backdrop-blur-md transition-all rounded-full text-sm font-medium border border-slate-700 shadow-md text-slate-300 hover:text-white"
              title="Générer un PDF de la discussion"
            >
              <Printer size={16} />
              <span className="hidden sm:inline">
                {language === "FR" ? "Télécharger PDF" : "حفظ بصيغة PDF"}
              </span>
            </button>
          </div>
        )}

        {/* --- EXPORT AREA START --- */}
        <div id="chat-export-area" className="flex-1 overflow-y-auto pb-40 pt-20 px-4 md:px-0 print:overflow-visible print:pb-0 print:pt-4 bg-slate-950 min-h-full">
          <div className="max-w-4xl mx-auto flex flex-col gap-6 p-4">
            {messages.map((msg: any, i: number) => (
              <div key={i} className={`flex w-full ${msg.role === "assistant" ? "justify-start" : "justify-end"} print:p-2 print:border-b print:border-slate-800`}>
                <div className={`flex gap-4 max-w-[85%] md:max-w-[75%] ${msg.role === "assistant" ? "flex-row" : "flex-row-reverse"}`}>
                  
                  {/* Avatar Avatar */}
                  {msg.role === "assistant" ? (
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0 shadow-sm print:opacity-100 border border-emerald-400/30">
                      <Bot size={18} className="text-white" />
                    </div>
                  ) : (
                    <img src={`https://api.dicebear.com/9.x/adventurer-neutral/svg?seed=${userEmail}&backgroundColor=6366f1`} alt="User Avatar" className="w-9 h-9 rounded-full object-cover shrink-0 shadow-sm print:opacity-100 border border-indigo-400/50 bg-indigo-600" />
                  )}
                  
                  {/* Bubble Content */}
                  <div className={`p-4 md:p-5 flex flex-col leading-relaxed whitespace-pre-wrap text-[15px] shadow-sm print:backdrop-blur-none print:shadow-none ${
                    msg.role === "assistant" 
                      ? "bg-slate-800/80 border border-slate-700/50 backdrop-blur-md text-slate-200 rounded-2xl rounded-tl-sm" 
                      : "bg-emerald-600 text-white rounded-2xl rounded-tr-sm"
                  }`}>
                    {msg.text}
                    {msg.source === "pdf" && (
                      <div className="mt-4 flex items-center gap-2 text-xs font-medium text-emerald-400 bg-emerald-950/30 w-fit px-3 py-1.5 rounded-full border border-emerald-500/20 print:bg-emerald-950 print:border-emerald-500/30">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                        {language === "FR" ? "Extrait du Code Marocain (PDF)" : "مستخرج من القانون المغربي"}
                      </div>
                    )}
                    {msg.source === "api" && (
                      <div className="mt-4 flex items-center gap-2 text-xs font-medium text-indigo-400 bg-indigo-950/30 w-fit px-3 py-1.5 rounded-full border border-indigo-500/20 print:bg-indigo-950 print:border-indigo-500/30">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"></path><path d="M12 16v-4"></path><path d="M12 8h.01"></path></svg>
                        {language === "FR" ? "Connaissances Générales (IA)" : "معرفة عامة (الذكاء الاصطناعي)"}
                      </div>
                    )}
                    
                    {msg.tokens && (
                      <div className="mt-4 flex items-center gap-1.5 text-xs font-medium text-slate-400 bg-slate-900/40 w-fit px-2.5 py-1 rounded-full border border-slate-700/50 print:hidden">
                        <Zap size={14} className="text-amber-400" />
                        {msg.tokens} tokens
                      </div>
                    )}
                  </div>

                </div>
              </div>
            ))}
            
            {/* Loading Indicator */}
            {isLoading && (
              <div className="flex w-full justify-start print:hidden">
                <div className="flex gap-4 max-w-[85%]">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0 shadow-sm border border-emerald-400/30">
                    <Bot size={18} className="text-white" />
                  </div>
                  <div className="p-4 bg-slate-800/80 border border-slate-700/50 backdrop-blur-md rounded-2xl rounded-tl-sm flex items-center gap-3">
                    <div className="w-4 h-4 border-2 border-t-transparent border-emerald-500 rounded-full animate-spin"></div>
                    <span className="text-sm font-medium text-slate-400 bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-teal-400 animate-pulse">
                      {language === "FR" ? "Analyse juridique en cours..." : "جارٍ التحليل القانوني..."}
                    </span>
                  </div>
                </div>
              </div>
            )}
            {/* --- EXPORT AREA END --- */}
          </div>
        </div>

        {/* Input Area */}
        <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-slate-950 via-slate-950 to-transparent pt-12 pb-6 print:hidden">
          <div className="max-w-3xl mx-auto px-4 w-full relative">
            <div className="relative flex items-end w-full p-2.5 bg-slate-800/60 backdrop-blur-xl border border-slate-700/60 rounded-3xl shadow-2xl shadow-emerald-900/10 focus-within:bg-slate-800/80 focus-within:border-emerald-500/50 transition-all duration-300">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  if (textareaRef.current) {
                    textareaRef.current.style.height = 'auto';
                    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 250)}px`;
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                className="w-full min-h-[50px] bg-transparent text-slate-100 focus:outline-none resize-none px-4 py-3.5 overflow-y-auto leading-relaxed text-[15.5px]"
                placeholder={language === "FR" ? "Posez votre question juridique ici..." : "اطرح سؤالك القانوني هنا..."}
                rows={1}
              />
              <button 
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="p-3.5 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center min-w-[44px] min-h-[44px] disabled:opacity-40 disabled:from-slate-600 disabled:to-slate-700 transition-all transform hover:scale-105 active:scale-95 shadow-md ml-2"
              >
                {isLoading ? <div className="w-5 h-5 border-2 border-t-transparent border-white rounded-full animate-spin"></div> : <Send size={18} className={`${language === "AR" ? "rotate-180" : ""}`} />}
              </button>
            </div>
            <div className="text-center text-xs font-medium text-slate-500 mt-4 tracking-wide">
              L'IA juridique LexBot peut faire des erreurs. Vérifiez toujours les clauses réelles.
            </div>
          </div>
        </div>
      </div>
      
      {/* Modal Documents (RAG Admin) */}
      {showDocs && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 print:hidden p-4 animation-fade-in">
          <div className="bg-slate-900 w-full max-w-lg rounded-3xl shadow-2xl shadow-emerald-900/20 overflow-hidden border border-slate-700/60 flex flex-col transform transition-all">
            <div className="flex justify-between items-center p-5 border-b border-slate-800 bg-slate-900/50">
              <h2 className="text-xl font-bold flex items-center gap-3 text-white">
                <div className="p-2 bg-indigo-500/10 rounded-xl">
                  <BookOpen size={20} className="text-indigo-400" />
                </div>
                {language === "FR" ? "Bibliothèque Juridique" : "قاعدة المعرفة"}
              </h2>
              <button onClick={() => setShowDocs(false)} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>
            
            <div className="p-6 flex-1 overflow-y-auto max-h-[65vh]">
              <div className="mb-6">
                <label className="flex flex-col items-center justify-center w-full h-36 border-2 border-slate-700 hover:border-indigo-500/50 border-dashed rounded-2xl cursor-pointer bg-slate-800/30 hover:bg-slate-800/50 transition-all group relative overflow-hidden">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    {isUploading ? (
                      <div className="flex flex-col items-center">
                        <div className="w-8 h-8 border-4 border-t-transparent border-indigo-500 rounded-full animate-spin mb-3"></div>
                        <p className="text-sm font-medium text-slate-300 text-center px-4 animate-pulse">Indexation FAISS en cours...</p>
                      </div>
                    ) : (
                      <>
                        <div className="p-3 bg-slate-800 rounded-full group-hover:scale-110 transition-transform duration-300 mb-3">
                          <Upload size={24} className="text-indigo-400" />
                        </div>
                        <p className="text-sm font-medium text-slate-300">
                          <span className="text-indigo-400">{language === "FR" ? "Parcourir" : "انقر للرفع"}</span> ou glissez un PDF ici
                        </p>
                      </>
                    )}
                  </div>
                  <input type="file" className="hidden" accept="application/pdf" onChange={handleUpload} disabled={isUploading} />
                </label>
              </div>
              
              <h3 className="text-sm font-semibold text-slate-400 mb-3 ml-1 uppercase tracking-wider">{language === "FR" ? "Documents Indexés" : "ملفات PDF الحالية"}</h3>
              <ul className="space-y-2.5">
                {documents.length === 0 && <li className="text-sm text-slate-500 text-center py-4 bg-slate-800/30 rounded-xl">{language === "FR" ? "Aucun document." : "لا توجد وثائق."}</li>}
                {documents.map((doc, idx) => (
                  <li key={idx} className="bg-slate-800/50 hover:bg-slate-800 px-4 py-3 rounded-xl flex items-center gap-4 text-sm font-medium text-slate-200 border border-slate-700/50 cursor-pointer transition-colors group">
                    <div className="p-2 bg-emerald-500/10 rounded-lg group-hover:bg-emerald-500/20 transition-colors">
                      <BookOpen size={16} className="text-emerald-500 shrink-0" />
                    </div>
                    <span className="truncate flex-1" title={doc.name}>{doc.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
