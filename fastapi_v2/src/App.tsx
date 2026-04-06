import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Chat from "./pages/Chat";
import Admin from "./pages/Admin";

// Simple guard pour vérifier si on est connecté (simulé pour l'instant avec le localStorage)
const PrivateRoute = ({ children }: { children: JSX.Element }) => {
  const token = localStorage.getItem("auth_token");
  return token ? children : <Navigate to="/login" replace />;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Route par défaut redirige vers /chat ou /login */}
        <Route path="/" element={<Navigate to="/chat" replace />} />
        
        {/* Page de Connexion */}
        <Route path="/login" element={<Login />} />
        
        {/* Interface Principale Chatbot (Protégée) */}
        <Route 
          path="/chat" 
          element={
            <PrivateRoute>
              <Chat />
            </PrivateRoute>
          } 
        />
        
        {/* Panneau d'Administration (Protégé) */}
        <Route 
          path="/admin" 
          element={
            <PrivateRoute>
              <Admin />
            </PrivateRoute>
          } 
        />
        
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
