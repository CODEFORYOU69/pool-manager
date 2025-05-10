-- Script pour ajouter les triggers de Change Data Capture

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

-- Fonction pour enregistrer les changements dans la table Match
CREATE OR REPLACE FUNCTION log_match_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    INSERT INTO sync_events(table_name, record_id, operation, data)
    VALUES('Match', NEW.id, TG_OP, row_to_json(NEW));
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO sync_events(table_name, record_id, operation, data)
    VALUES('Match', OLD.id, TG_OP, row_to_json(OLD));
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Créer le trigger pour la table Match
DROP TRIGGER IF EXISTS match_changes ON "Match";
CREATE TRIGGER match_changes
AFTER INSERT OR UPDATE OR DELETE ON "Match"
FOR EACH ROW EXECUTE FUNCTION log_match_changes();

-- Fonction pour enregistrer les changements dans la table Round
CREATE OR REPLACE FUNCTION log_round_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    INSERT INTO sync_events(table_name, record_id, operation, data)
    VALUES('Round', NEW.id, TG_OP, row_to_json(NEW));
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO sync_events(table_name, record_id, operation, data)
    VALUES('Round', OLD.id, TG_OP, row_to_json(OLD));
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Créer le trigger pour la table Round
DROP TRIGGER IF EXISTS round_changes ON "Round";
CREATE TRIGGER round_changes
AFTER INSERT OR UPDATE OR DELETE ON "Round"
FOR EACH ROW EXECUTE FUNCTION log_round_changes();

-- Fonction pour enregistrer les changements dans la table MatchParticipant
CREATE OR REPLACE FUNCTION log_matchparticipant_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    INSERT INTO sync_events(table_name, record_id, operation, data)
    VALUES('MatchParticipant', NEW.id, TG_OP, row_to_json(NEW));
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO sync_events(table_name, record_id, operation, data)
    VALUES('MatchParticipant', OLD.id, TG_OP, row_to_json(OLD));
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Créer le trigger pour la table MatchParticipant
DROP TRIGGER IF EXISTS matchparticipant_changes ON "MatchParticipant";
CREATE TRIGGER matchparticipant_changes
AFTER INSERT OR UPDATE OR DELETE ON "MatchParticipant"
FOR EACH ROW EXECUTE FUNCTION log_matchparticipant_changes();

-- Fonction pour enregistrer les changements dans la table Participant
CREATE OR REPLACE FUNCTION log_participant_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    INSERT INTO sync_events(table_name, record_id, operation, data)
    VALUES('Participant', NEW.id, TG_OP, row_to_json(NEW));
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO sync_events(table_name, record_id, operation, data)
    VALUES('Participant', OLD.id, TG_OP, row_to_json(OLD));
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Créer le trigger pour la table Participant
DROP TRIGGER IF EXISTS participant_changes ON "Participant";
CREATE TRIGGER participant_changes
AFTER INSERT OR UPDATE OR DELETE ON "Participant"
FOR EACH ROW EXECUTE FUNCTION log_participant_changes(); 