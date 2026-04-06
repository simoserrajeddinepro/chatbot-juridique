"""
Database Seed Script — Populates the database with realistic demo data.

Usage:
  # Inside Docker:
  docker compose exec backend python seed.py

  # Locally:
  cd backend && python seed.py

  # With --reset flag to wipe and re-seed:
  docker compose exec backend python seed.py --reset
"""

import sys
import os
from datetime import datetime, timedelta
from models import engine, SessionLocal, Base, User, ChatSession
from auth import get_password_hash

def seed_users(db):
    users_data = [
        {"id": "u1", "email": "ahmed@lexbot.ma", "name": "Ahmed Benani", "password": "password123"},
        {"id": "u2", "email": "sarah@lexbot.ma", "name": "Sarah El Fassi", "password": "password123"},
        {"id": "u3", "email": "karim@lexbot.ma", "name": "Karim Tazi", "password": "password123"},
        {"id": "u4", "email": "leila@lexbot.ma", "name": "Leila Chakir", "password": "password123"},
        {"id": "u5", "email": "admin@lexbot.ma", "name": "Admin", "password": "admin2024"},
        {"id": "u6", "email": "demo@lexbot.ma", "name": "Utilisateur Demo", "password": "demo1234"},
    ]
    created = 0
    for u in users_data:
        existing = db.query(User).filter(User.id == u["id"]).first()
        if not existing:
            hashed_pw = get_password_hash(u["password"])
            db_user = User(id=u["id"], email=u["email"], name=u["name"], hashed_password=hashed_pw)
            db.add(db_user)
            created += 1
    db.commit()
    print(f"  Users: {created} created, {len(users_data) - created} already existed")


def seed_chat_sessions(db):
    now = datetime.utcnow()

    sessions_data = [
        # --- Ahmed's sessions (Moroccan Labor Law) ---
        {
            "id": "s1",
            "user_id": "u1",
            "title": "Licenciement abusif - Code du travail",
            "messages": [
                {"role": "user", "text": "Quelles sont les conditions d'un licenciement abusif selon le code du travail marocain ?"},
                {"role": "assistant", "text": "Selon le Code du travail marocain (Loi n° 65-99), un licenciement est considéré comme abusif lorsqu'il intervient sans motif valable ou sans respect de la procédure légale.\n\nLes principaux cas de licenciement abusif incluent :\n\n1. **Absence de motif valable** (Art. 35) : Le licenciement doit être justifié par un motif lié à la conduite du salarié ou aux nécessités de fonctionnement de l'entreprise.\n\n2. **Non-respect de la procédure disciplinaire** (Art. 62-63) : L'employeur doit convoquer le salarié à un entretien préalable et lui permettre de se défendre.\n\n3. **Licenciement discriminatoire** : Fondé sur le sexe, la religion, l'appartenance syndicale, etc.\n\n(Source: Code du travail.pdf, Page 45)", "source": "pdf"},
                {"role": "user", "text": "Quelles sont les indemnités en cas de licenciement abusif ?"},
                {"role": "assistant", "text": "En cas de licenciement abusif, le salarié a droit à plusieurs indemnités :\n\n1. **Indemnité de licenciement** (Art. 52-53) :\n   - 96h de salaire par année pour les 5 premières années\n   - 144h par année de la 6e à la 10e année\n   - 192h par année de la 11e à la 15e année\n   - 240h par année au-delà de 15 ans\n\n2. **Dommages et intérêts** (Art. 41) : 1,5 mois de salaire par année d'ancienneté, plafonné à 36 mois.\n\n3. **Indemnité de préavis** (Art. 43) : Variable selon l'ancienneté et la catégorie professionnelle.\n\n(Source: Code du travail.pdf, Page 52)", "source": "pdf"}
            ],
            "created_at": now - timedelta(days=5),
            "updated_at": now - timedelta(days=5),
        },
        {
            "id": "s2",
            "user_id": "u1",
            "title": "Congés payés - Droits du salarié",
            "messages": [
                {"role": "user", "text": "Combien de jours de congé annuel a un salarié au Maroc ?"},
                {"role": "assistant", "text": "Selon l'article 231 du Code du travail marocain, tout salarié a droit à un congé annuel payé dont la durée est fixée comme suit :\n\n- **1,5 jour ouvrable** par mois de service, soit **18 jours ouvrables** par an\n- Ce droit augmente de **1,5 jour** par période de 5 années d'ancienneté, sans que le total ne dépasse **30 jours ouvrables**\n\nLe salarié acquiert ce droit après **6 mois de service continu** dans la même entreprise.\n\n(Source: Code du travail.pdf, Page 120)", "source": "pdf"}
            ],
            "created_at": now - timedelta(days=3),
            "updated_at": now - timedelta(days=3),
        },

        # --- Sarah's sessions (Family Law) ---
        {
            "id": "s3",
            "user_id": "u2",
            "title": "Procédure de divorce au Maroc",
            "messages": [
                {"role": "user", "text": "Quelles sont les étapes d'une procédure de divorce au Maroc ?"},
                {"role": "assistant", "text": "La procédure de divorce au Maroc, régie par le Code de la Famille (Moudawana), comprend plusieurs étapes :\n\n1. **Dépôt de la demande** : Auprès du tribunal de la famille compétent\n2. **Tentative de réconciliation** : Le juge convoque les deux parties pour une tentative de conciliation (obligatoire)\n3. **Médiation** : Si le couple a des enfants, deux médiateurs (un de chaque famille) sont désignés\n4. **Fixation des droits** : Le tribunal fixe la pension alimentaire, le logement, et la garde des enfants\n5. **Jugement** : Si la réconciliation échoue, le tribunal prononce le divorce\n\nLa procédure prend généralement entre 3 et 6 mois.", "source": "api"},
            ],
            "created_at": now - timedelta(days=7),
            "updated_at": now - timedelta(days=7),
        },

        # --- Karim's sessions (Commercial Law) ---
        {
            "id": "s4",
            "user_id": "u3",
            "title": "Création de SARL au Maroc",
            "messages": [
                {"role": "user", "text": "ما هي الخطوات القانونية لتأسيس شركة ذات مسؤولية محدودة في المغرب؟"},
                {"role": "assistant", "text": "لتأسيس شركة ذات مسؤولية محدودة (SARL) في المغرب، يجب اتباع الخطوات التالية:\n\n1. **اختيار الاسم التجاري**: التحقق من توفره لدى المكتب المغربي للملكية الصناعية (OMPIC)\n\n2. **تحرير النظام الأساسي**: يجب أن يتضمن:\n   - اسم الشركة ومقرها\n   - رأس المال (الحد الأدنى 10,000 درهم)\n   - أسماء الشركاء وحصصهم\n   - مدة الشركة\n\n3. **إيداع رأس المال**: في حساب بنكي مجمد باسم الشركة\n\n4. **التسجيل لدى مصلحة الضرائب**: الحصول على رقم التعريف الضريبي\n\n5. **التسجيل في السجل التجاري**: لدى المحكمة التجارية المختصة\n\n6. **النشر في الجريدة الرسمية**: إعلان عن تأسيس الشركة\n\nالمدة الإجمالية: من 2 إلى 4 أسابيع عبر منصة CRI الإلكترونية.", "source": "api"},
            ],
            "created_at": now - timedelta(days=2),
            "updated_at": now - timedelta(days=2),
        },

        # --- Leila's sessions (Real Estate Law) ---
        {
            "id": "s5",
            "user_id": "u4",
            "title": "Achat immobilier - Droits et obligations",
            "messages": [
                {"role": "user", "text": "Quelles sont les étapes légales pour acheter un bien immobilier au Maroc ?"},
                {"role": "assistant", "text": "L'achat d'un bien immobilier au Maroc suit un processus juridique précis :\n\n1. **Vérification du titre foncier** : S'assurer que le bien est immatriculé à la Conservation Foncière et qu'il n'y a pas d'hypothèques ou de charges\n\n2. **Compromis de vente** : Contrat préliminaire avec versement d'un acompte (généralement 10%)\n\n3. **Acte de vente définitif** : Doit être rédigé par un notaire ou un adoul\n\n4. **Frais à prévoir** :\n   - Droits d'enregistrement : 4% du prix de vente\n   - Conservation foncière : 1,5% + frais fixes\n   - Honoraires du notaire : 1% à 2,5%\n   - Timbres fiscaux\n\n5. **Inscription à la Conservation Foncière** : Transfert de propriété officiel\n\nDurée totale : 1 à 3 mois selon la complexité du dossier.", "source": "api"},
            ],
            "created_at": now - timedelta(days=1),
            "updated_at": now - timedelta(days=1),
        },

        # --- Demo user session ---
        {
            "id": "s6",
            "user_id": "u6",
            "title": "Session de démonstration",
            "messages": [
                {"role": "assistant", "text": "Bienvenue sur LexBot MA ! Je suis votre assistant juridique intelligent spécialisé en droit marocain. Posez-moi vos questions en français ou en arabe."},
                {"role": "user", "text": "Quel est le salaire minimum au Maroc ?"},
                {"role": "assistant", "text": "Le Salaire Minimum Interprofessionnel Garanti (SMIG) au Maroc est fixé par décret gouvernemental et révisé périodiquement.\n\n**Secteur industriel, commercial et professions libérales** :\n- Le SMIG horaire est fixé à **15,55 MAD/heure** (dernière révision)\n- Soit environ **2,970.05 MAD/mois** pour 191 heures de travail\n\n**Secteur agricole (SMAG)** :\n- Le salaire minimum agricole garanti est fixé à **84,37 MAD/jour**\n\nCes montants sont définis par l'article 356 du Code du travail et les décrets d'application correspondants.\n\n(Source: Code du travail.pdf, Page 180)", "source": "pdf", "tokens": 285},
            ],
            "created_at": now - timedelta(hours=2),
            "updated_at": now - timedelta(hours=2),
        },
    ]

    created = 0
    for s in sessions_data:
        existing = db.query(ChatSession).filter(ChatSession.id == s["id"]).first()
        if not existing:
            session = ChatSession(
                id=s["id"],
                user_id=s["user_id"],
                title=s["title"],
                messages=s["messages"],
                created_at=s["created_at"],
                updated_at=s["updated_at"],
            )
            db.add(session)
            created += 1
    db.commit()
    print(f"  Chat sessions: {created} created, {len(sessions_data) - created} already existed")


def reset_db():
    print("Dropping all tables...")
    Base.metadata.drop_all(bind=engine)
    print("Recreating all tables...")
    Base.metadata.create_all(bind=engine)


def main():
    reset = "--reset" in sys.argv

    print("=" * 50)
    print("  LexBot MA — Database Seed Script")
    print("=" * 50)

    if reset:
        print("\n[RESET MODE] Wiping database...")
        reset_db()

    # Ensure tables exist
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        print("\nSeeding users...")
        seed_users(db)

        print("Seeding chat sessions...")
        seed_chat_sessions(db)

        print("\n" + "=" * 50)
        print("  Seed complete!")
        print(f"  Users:    {db.query(User).count()}")
        print(f"  Sessions: {db.query(ChatSession).count()}")
        print("=" * 50)

        print("\n  Demo accounts:")
        print("  ┌──────────────────────┬──────────────┐")
        print("  │ Email                │ Password     │")
        print("  ├──────────────────────┼──────────────┤")
        print("  │ ahmed@lexbot.ma      │ password123  │")
        print("  │ sarah@lexbot.ma      │ password123  │")
        print("  │ karim@lexbot.ma      │ password123  │")
        print("  │ leila@lexbot.ma      │ password123  │")
        print("  │ admin@lexbot.ma      │ admin2024    │")
        print("  │ demo@lexbot.ma       │ demo1234     │")
        print("  └──────────────────────┴──────────────┘")
    finally:
        db.close()


if __name__ == "__main__":
    main()
