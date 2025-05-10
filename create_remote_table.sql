-- Script pour créer uniquement la table sync_events sur la base de données distante

-- Créer une table pour stocker les événements de synchronisation
CREATE TABLE IF NOT EXISTS sync_events (
  id SERIAL PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  data JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  processed BOOLEAN DEFAULT FALSE
); 