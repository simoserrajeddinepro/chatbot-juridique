import os
from sqlalchemy import create_engine, Column, String, JSON, DateTime, ForeignKey
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from datetime import datetime
from auth import get_password_hash
from dotenv import load_dotenv

load_dotenv()

# Connexion PostgreSQL (configurable via env vars for Docker)
DB_HOST = os.environ.get("DB_HOST", "localhost")
DB_PORT = os.environ.get("DB_PORT", "5432")
DB_NAME = os.environ.get("DB_NAME", "chatbot_db")
DB_USER = os.environ.get("DB_USER", "postgres")
DB_PASSWORD = os.environ.get("DB_PASSWORD", "admin")
SQLALCHEMY_DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    
    # Relation avec les sessions de chat
    sessions = relationship("ChatSession", back_populates="user")

class ChatSession(Base):
    __tablename__ = "chat_sessions_v2" # Nouvelle table propre pour la V2

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"))
    title = Column(String, nullable=False)
    messages = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relation inverse
    user = relationship("User", back_populates="sessions")

# Fonction d'initialisation de la BDD et création des 4 faux utilisateurs
def init_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    # Vérification si les utilisateurs existent déjà
    if db.query(User).count() == 0:
        print("🌱 Création (Seed) des 4 utilisateurs de test...")
        users_data = [
            {"id": "u1", "email": "ahmed@test.com", "name": "Ahmed", "password": "password123"},
            {"id": "u2", "email": "sarah@test.com", "name": "Sarah", "password": "password123"},
            {"id": "u3", "email": "karim@test.com", "name": "Karim", "password": "password123"},
            {"id": "u4", "email": "leila@test.com", "name": "Leila", "password": "password123"},
        ]
        for u in users_data:
            hashed_pw = get_password_hash(u["password"])
            db_user = User(id=u["id"], email=u["email"], name=u["name"], hashed_password=hashed_pw)
            db.add(db_user)
        db.commit()
    
    db.close()
