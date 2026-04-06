from fastapi import FastAPI, Depends, HTTPException, status, Form, File, UploadFile
from fastapi.responses import StreamingResponse
import shutil
import os
import json
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from datetime import timedelta
from typing import List
from pydantic import BaseModel

from models import SessionLocal, init_db, User, ChatSession
from auth import verify_password, create_access_token, ACCESS_TOKEN_EXPIRE_MINUTES, ALGORITHM, SECRET_KEY
from jose import JWTError, jwt

app = FastAPI(title="LexBot MA - Backend V2")

# CORS — configurable via CORS_ORIGINS env var (comma-separated)
_default_origins = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174,http://localhost,http://localhost:80"
_cors_origins = os.environ.get("CORS_ORIGINS", _default_origins).split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _cors_origins],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialisation DB au lancement
init_db()

# --- DÉPENDANCES ---
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise credentials_exception
    return user

# --- ROUTES AUTHENTIFICATION ---
@app.post("/token")
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer", "user_email": user.email, "user_name": user.name}

# --- ROUTES CHAT (SÉCURISÉES) ---
class SessionInput(BaseModel):
    id: str
    title: str
    messages: list

@app.get("/api/sessions")
def get_user_sessions(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    sessions = db.query(ChatSession).filter(ChatSession.user_id == current_user.id).order_by(ChatSession.updated_at.desc()).all()
    # Pydantic va serialiser automatiquement mais il faut formater
    return [{"id": s.id, "title": s.title, "messages": s.messages} for s in sessions]

@app.post("/api/sessions")
def save_user_session(session_data: SessionInput, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db_session = db.query(ChatSession).filter(ChatSession.id == session_data.id, ChatSession.user_id == current_user.id).first()
    if db_session:
        db_session.title = session_data.title
        db_session.messages = session_data.messages
    else:
        new_session = ChatSession(
            id=session_data.id,
            user_id=current_user.id,
            title=session_data.title,
            messages=session_data.messages
        )
        db.add(new_session)
    db.commit()
    return {"status": "success"}

@app.delete("/api/sessions/{session_id}")
def delete_user_session(session_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db_session = db.query(ChatSession).filter(ChatSession.id == session_id, ChatSession.user_id == current_user.id).first()
    if db_session:
        db.delete(db_session)
        db.commit()
    return {"status": "success"}

# --- ROUTE IA (RAG & LLM) ---
from groq import Groq
import os
import rag
from rag import init_rag, search_rag

# Initialize RAG on startup
init_rag()

groq_client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

ADMIN_CONFIG_FILE = os.path.join(os.path.dirname(__file__), "admin_config.json")

def load_admin_config():
    if os.path.exists(ADMIN_CONFIG_FILE):
        with open(ADMIN_CONFIG_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {
        "system_prompt_ar": "أنت محامٍ وخبير في القانون المغربي. أجب دائمًا باللغة العربية بأسلوب احترافي. عندما تستخدم النصوص القانونية المرفقة (RAG)، *يجب* عليك ذكر المصدر ورقم الصفحة في نهاية الجملة، مثل: (المصدر: document.pdf، الصفحة 14). لا تجب أبدًا على أسئلة خارج نطاق القانون (כالبرمجة)، بل اعتذر بلباقة.",
        "system_prompt_fr": "Tu es un avocat et expert en droit marocain. Réponds toujours en français avec un ton professionnel. Lorsque tu utilises les extraits juridiques fournis, tu DOIS obligatoirement citer la source et la page exacte à la fin de ton affirmation, sous la forme : (Source: x.pdf, Page Y). Tu ne dois JAMAIS répondre à des questions hors du domaine juridique (informatique, code).",
        "rag_threshold": 1.4,
        "top_k": 4
    }

def save_admin_config(config_data):
    with open(ADMIN_CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(config_data, f, ensure_ascii=False, indent=2)

@app.get("/api/admin/config")
def get_admin_config(current_user: User = Depends(get_current_user)):
    return load_admin_config()

@app.post("/api/admin/config")
def update_admin_config(new_config: dict, current_user: User = Depends(get_current_user)):
    save_admin_config(new_config)
    return {"status": "success"}

@app.delete("/api/admin/purge")
def purge_rag_database(current_user: User = Depends(get_current_user)):
    try:
        import rag
        base_dir = os.path.dirname(rag.__file__)
        index_path = os.path.join(base_dir, "faiss_index_v4.bin")
        chunks_path = os.path.join(base_dir, "chunks_v4.json")
        
        if os.path.exists(index_path): os.remove(index_path)
        if os.path.exists(chunks_path): os.remove(chunks_path)
        
        rag.index = None
        rag.chunks = []
        return {"status": "purged"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class ChatInput(BaseModel):
    history: list
    language: str

@app.post("/api/chat")
def chat_with_llama(data: ChatInput, current_user: User = Depends(get_current_user)):
    user_query = data.history[-1]["text"] if getattr(data.history[-1], "get", None) else data.history[-1].get("text", "")
    if not user_query:
        # Pydantic dict fallback
        user_query = data.history[-1].text if hasattr(data.history[-1], 'text') else ""
    
    # 1. Recherche RAG (Semantic Search)
    rag_context = search_rag(user_query, top_k=3)
    source_type = "pdf" if rag_context else "api"
    
    # 2. System Prompt
    if data.language == "AR":
        system_prompt = "أنت محامٍ وخبير في القانون المغربي. أجب دائمًا باللغة العربية. "
        if rag_context:
            system_prompt += f"\nاستخدم هذه النصوص كأولوية في إجابتك:\n{rag_context}"
        else:
            system_prompt += "\nاعتمد على معرفتك الشاملة بالقانون المغربي."
    else:
        system_prompt = "Tu es un avocat et expert en droit marocain. Réponds toujours en français. "
        if rag_context:
            system_prompt += f"\nVoici des extraits juridiques (RAG) à consulter en priorité :\n{rag_context}"
        else:
            system_prompt += "\nUtilise tes propres connaissances du droit marocain pour répondre."

    # 3. Formater l'historique pour Groq (role: user/assistant, content: text)
    formatted_messages = [{"role": "system", "content": system_prompt}]
    for msg in data.history:
        # dict ou objet selon pydantic
        msg_dict = msg if isinstance(msg, dict) else msg.dict()
        formatted_messages.append({"role": msg_dict["role"], "content": msg_dict["text"]})
    try:
        response = groq_client.chat.completions.create(
            messages=formatted_messages,
            model="llama-3.3-70b-versatile",
            temperature=0.1
        )
        return {"reply": response.choices[0].message.content, "source": source_type}
    except Exception as e:
        print(f"Erreur Groq: {e}")
        raise HTTPException(status_code=500, detail="Erreur IA")

@app.post("/api/chat/stream")
async def chat_with_llama_stream(data: ChatInput, current_user: User = Depends(get_current_user)):
    user_query = data.history[-1]["text"] if getattr(data.history[-1], "get", None) else data.history[-1].get("text", "")
    if not user_query:
        user_query = data.history[-1].text if hasattr(data.history[-1], 'text') else ""
    
    config = load_admin_config()
    
    rag_context = search_rag(user_query, top_k=config.get("top_k", 3), threshold=config.get("rag_threshold", 1.4))
    source_type = "pdf" if rag_context else "api"
    
    if data.language == "AR":
        system_prompt = config.get("system_prompt_ar", "")
        if rag_context:
            system_prompt += f"\nاستخدم هذه النصوص القانونية كأولوية في إجابتك:\n{rag_context}"
        else:
            system_prompt += "\nاعتمد على معرفتك الشاملة بالقانون المغربي."
    else:
        system_prompt = config.get("system_prompt_fr", "")
        if rag_context:
            system_prompt += f"\nVoici des extraits juridiques officiels (RAG) à consulter en priorité :\n{rag_context}"
        else:
            system_prompt += "\nUtilise tes propres connaissances du droit marocain."

    formatted_messages = [{"role": "system", "content": system_prompt}]
    for msg in data.history:
        msg_dict = msg if isinstance(msg, dict) else msg.dict()
        formatted_messages.append({"role": msg_dict["role"], "content": msg_dict["text"]})
        
    try:
        response = groq_client.chat.completions.create(
            messages=formatted_messages,
            model="llama-3.3-70b-versatile",
            temperature=0.1,
            stream=True
        )
        
        async def event_generator():
            total_chars = 0
            for chunk in response:
                if chunk.choices and chunk.choices[0].delta.content is not None:
                    content = chunk.choices[0].delta.content
                    total_chars += len(content)
                    yield content.encode("utf-8")
                
                # Essayons d'extraire l'utilisation exacte si le SDK le supporte silencieusement
                if hasattr(chunk, "x_groq") and getattr(chunk.x_groq, "usage", None):
                    yield f"__USAGE__:{chunk.x_groq.usage.total_tokens}".encode("utf-8")
                    return
                elif hasattr(chunk, "usage") and chunk.usage:
                    yield f"__USAGE__:{chunk.usage.total_tokens}".encode("utf-8")
                    return
            
            # Fallback élégant : Si le SDK ne renvoie vraiment pas le header usage en Stream, on fait une estimation précise
            input_chars = sum(len(m["content"]) for m in formatted_messages)
            approx_tokens = int(total_chars / 3.5) + int(input_chars / 3.5)
            yield f"__USAGE__:{approx_tokens}".encode("utf-8")
                    
        headers = {
            "X-Source-Type": source_type,
            "Access-Control-Expose-Headers": "X-Source-Type" # CRUCIAL pour que javascript lise le header!
        }
        return StreamingResponse(event_generator(), media_type="text/plain", headers=headers)
        
    except Exception as e:
        print(f"Erreur Groq Stream: {e}")
        raise HTTPException(status_code=500, detail="Erreur IA Stream")
@app.get("/api/documents")
def list_documents(current_user: User = Depends(get_current_user)):
    docs_dir = os.path.join(os.path.dirname(__file__), 'documents_juridiques')
    if not os.path.exists(docs_dir):
        return []
    files = [f for f in os.listdir(docs_dir) if f.endswith('.pdf')]
    return [{"name": f} for f in files]

@app.post("/api/documents/upload")
async def upload_document(file: UploadFile = File(...), current_user: User = Depends(get_current_user)):
    docs_dir = os.path.join(os.path.dirname(__file__), 'documents_juridiques')
    if not os.path.exists(docs_dir):
        os.makedirs(docs_dir)
        
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Uniquement des fichiers PDF.")
        
    file_location = os.path.join(docs_dir, file.filename)
    with open(file_location, "wb+") as file_object:
        shutil.copyfileobj(file.file, file_object)
        
    # Ingestion dynamique dans FAISS
    added_chunks = rag.add_pdf_to_faiss(file_location)
    return {"message": "Document ajouté avec succès.", "chunks": added_chunks, "filename": file.filename}
