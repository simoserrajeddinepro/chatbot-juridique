import os
import faiss
import numpy as np
import json
from pypdf import PdfReader
from sentence_transformers import SentenceTransformer

# Utilisation d'un modèle MULTILINGUE pour mapper l'Arabe et le Français dans le même espace vectoriel !
embedder = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')
index = None
chunks = []

def chunk_text(text: str, chunk_size: int = 800, overlap: int = 100) -> list:
    chunks = []
    start = 0
    text_len = len(text)
    while start < text_len:
        end = min(start + chunk_size, text_len)
        if end < text_len:
            last_space = text.rfind(' ', start, end)
            # On s'assure d'avancer au moins pour ne pas boucler à l'infini
            if last_space > start + overlap:
                end = last_space
            else:
                last_space = text.find(' ', end)
                if last_space != -1 and last_space < end + 200:
                    end = last_space
                    
        chunk_str = text[start:end].strip()
        if len(chunk_str) > 50:
            chunks.append(chunk_str)
            
        start = end - overlap
        if end >= text_len:
            break
            
    return chunks

def init_rag():
    global index, chunks
    base_dir = os.path.dirname(__file__)
    docs_dir = os.path.join(os.path.dirname(base_dir), 'documents_juridiques')
    index_path = os.path.join(base_dir, "faiss_index_v4.bin") # Passage en V4 (Métadonnées JSON Dict)
    chunks_path = os.path.join(base_dir, "chunks_v4.json")
    
    # 1. Load from Disk if exists (Saves 100% RAM on restart!)
    if os.path.exists(index_path) and os.path.exists(chunks_path):
        print("⚡ Chargement de l'index FAISS depuis le disque dur...")
        index = faiss.read_index(index_path)
        with open(chunks_path, "r", encoding="utf-8") as f:
            chunks = json.load(f)
        print(f"✅ Base de connaissances chargée de la RAM ! ({len(chunks)} extraits)")
        return

    # 2. Otherwise compute it
    if not os.path.exists(docs_dir):
        print("⚠️ Pas de dossier documents_juridiques trouvé.")
        return

    files = [f for f in os.listdir(docs_dir) if f.endswith('.pdf')]
    if not files:
        print("⚠️ Aucun PDF trouvé dans documents_juridiques.")
        return
        
    print(f"📄 Lecture de {len(files)} document(s) PDF en Python. Cela peut prendre 1 minute...")
    all_chunks_data = [] # Structure: {"text": str, "page": int, "source": str}
    all_texts_for_embed = []
    
    for file in files:
        file_path = os.path.join(docs_dir, file)
        try:
            reader = PdfReader(file_path)
            for i, page in enumerate(reader.pages):
                extracted = page.extract_text()
                if extracted:
                    paragraphs = chunk_text(extracted, chunk_size=800, overlap=100)
                    for p in paragraphs:
                        all_chunks_data.append({"text": p, "page": i + 1, "source": file})
                        all_texts_for_embed.append(p)
        except Exception as e:
            print(f"❌ Erreur lecture {file}: {e}")
            
    if not all_texts_for_embed:
        return
        
    chunks = all_chunks_data
    print(f"🔪 Vectorisation de {len(chunks)} paragraphes. (Veuillez patienter...)")
    
    # Encodage en vecteurs NORMALISÉS pour avoir des distances stables
    embeddings = embedder.encode(all_texts_for_embed, batch_size=16, show_progress_bar=True, convert_to_tensor=False, normalize_embeddings=True)
    
    # Création de l'index FAISS L2
    dimension = embeddings.shape[1]
    index = faiss.IndexFlatL2(dimension)
    index.add(np.array(embeddings).astype('float32'))
    
    # SAUVEGARDE SUR LE DISQUE
    faiss.write_index(index, index_path)
    with open(chunks_path, "w", encoding="utf-8") as f:
        json.dump(chunks, f, ensure_ascii=False)
        
    print(f"✅ BDD FAISS encodée avec succès et sauvegardée sur le disque ! ({len(chunks)} extraits)")

def search_rag(query: str, top_k: int = 3, threshold: float = 1.4) -> str:
    if index is None or not chunks:
        return ""
        
    # Encoder la question avec Normalisation
    query_emb = embedder.encode([query], convert_to_tensor=False, normalize_embeddings=True)
    
    # Recherche FAISS (Search)
    distances, indices = index.search(np.array(query_emb).astype('float32'), top_k)
    
    results = []
    # On filtre les résultats trop éloignés (hors sujet)
    for dist, i in zip(distances[0], indices[0]):
        if i < len(chunks) and dist < threshold:
            chunk = chunks[i]
            # Formatage avec citation pour l'IA
            results.append(f"[Source: {chunk['source']}, Page: {chunk['page']}]\n{chunk['text']}")
            
    return "\n---\n".join(results)

def add_pdf_to_faiss(file_path: str):
    global index, chunks
    if index is None:
        init_rag() # Sécurité
        
    try:
        reader = PdfReader(file_path)
        new_chunks_data = []
        new_texts_for_embed = []
        file_name = os.path.basename(file_path)
        
        for i, page in enumerate(reader.pages):
            extracted = page.extract_text()
            if extracted:
                paragraphs = chunk_text(extracted, chunk_size=800, overlap=100)
                for p in paragraphs:
                    new_chunks_data.append({"text": p, "page": i + 1, "source": file_name})
                    new_texts_for_embed.append(p)
                    
        if not new_texts_for_embed:
            return 0
            
        # Encoder et ajouter à l'index actuel
        new_embeddings = embedder.encode(new_texts_for_embed, batch_size=16, show_progress_bar=False, convert_to_tensor=False, normalize_embeddings=True)
        chunks.extend(new_chunks_data)
        index.add(np.array(new_embeddings).astype('float32'))
        
        # Sauvegarder la mise à jour sur le disque
        base_dir = os.path.dirname(__file__)
        index_path = os.path.join(base_dir, "faiss_index_v4.bin")
        chunks_path = os.path.join(base_dir, "chunks_v4.json")
        faiss.write_index(index, index_path)
        with open(chunks_path, "w", encoding="utf-8") as f:
            json.dump(chunks, f, ensure_ascii=False)
            
        print(f"✅ Nouveau PDF intégré dans FAISS ! (+{len(paragraphs)} extraits)")
        return len(paragraphs)
    except Exception as e:
        print(f"❌ Erreur lors de l'intégration du PDF dynamique : {e}")
        return 0
