-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- The chatbot_db database is auto-created by POSTGRES_DB env var.
-- Tables are auto-created by SQLAlchemy (models.py init_db()).
-- This script runs only on first initialization of the data volume.
