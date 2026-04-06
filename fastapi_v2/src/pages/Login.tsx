import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const formData = new URLSearchParams();
      formData.append("username", email);
      formData.append("password", password);

      const res = await axios.post("/token", formData, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      localStorage.setItem("auth_token", res.data.access_token);
      localStorage.setItem("user_email", email);
      navigate("/chat");
    } catch (err) {
      alert("Erreur de connexion : Identifiants incorrects.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-full items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 overflow-hidden relative">
      
      {/* Background Decorative Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-600/20 blur-[120px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl rounded-3xl p-8 max-w-sm w-full mx-4 z-10 transition-all duration-300 hover:shadow-emerald-900/20 hover:border-white/20">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-gradient-to-tr from-emerald-500 to-teal-400 rounded-2xl shadow-lg flex items-center justify-center transform transition-transform hover:scale-110">
            <span className="text-3xl text-white">⚖️</span>
          </div>
        </div>
        
        <h2 className="text-3xl font-bold text-center text-white mb-2 tracking-tight">LexBot MA</h2>
        <p className="text-center text-slate-400 mb-8 text-sm font-medium">Assistant Juridique Marocain</p>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1 ml-1" htmlFor="email">Adresse Email</label>
            <input
              id="email"
              type="email"
              required
              className="w-full px-4 py-3 rounded-xl bg-slate-900/50 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
              placeholder="ahmed@test.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1 ml-1" htmlFor="password">Mot de passe</label>
            <input
              id="password"
              type="password"
              required
              className="w-full px-4 py-3 rounded-xl bg-slate-900/50 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-md text-sm font-semibold text-white bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 focus:ring-offset-slate-900 disabled:opacity-50 transition-all transform active:scale-[0.98]"
          >
            {isLoading ? "Connexion..." : "Se connecter"}
          </button>
        </form>

        <div className="mt-8 text-center text-xs text-slate-500">
          Comptes de test : ahmed, sarah, karim, leila.<br/>Mot de passe : <span className="text-slate-400 font-mono">password123</span>
        </div>
      </div>
    </div>
  );
}
