-- Réinitialiser la table sync_events
TRUNCATE TABLE sync_events;

-- Forcer la synchronisation de toutes les tables
-- Commencer par les tables de base
INSERT INTO sync_events(table_name, record_id, operation, data, processed)
SELECT 'Competition', id, 'INSERT', row_to_json(t), FALSE
FROM "Competition" t;

INSERT INTO sync_events(table_name, record_id, operation, data, processed)
SELECT 'Area', id, 'INSERT', row_to_json(t), FALSE
FROM "Area" t;

INSERT INTO sync_events(table_name, record_id, operation, data, processed)
SELECT 'Group', id, 'INSERT', row_to_json(t), FALSE
FROM "Group" t;

INSERT INTO sync_events(table_name, record_id, operation, data, processed)
SELECT 'Pool', id, 'INSERT', row_to_json(t), FALSE
FROM "Pool" t;

INSERT INTO sync_events(table_name, record_id, operation, data, processed)
SELECT 'Participant', id, 'INSERT', row_to_json(t), FALSE
FROM "Participant" t;

-- Ajouter les tables ParticipantGroup et PoolParticipant
INSERT INTO sync_events(table_name, record_id, operation, data, processed)
SELECT 'ParticipantGroup', id, 'INSERT', row_to_json(t), FALSE
FROM "ParticipantGroup" t;

INSERT INTO sync_events(table_name, record_id, operation, data, processed)
SELECT 'PoolParticipant', id, 'INSERT', row_to_json(t), FALSE
FROM "PoolParticipant" t;

-- Puis les matchs et les détails des matchs
INSERT INTO sync_events(table_name, record_id, operation, data, processed)
SELECT 'Match', id, 'INSERT', row_to_json(t), FALSE
FROM "Match" t;

INSERT INTO sync_events(table_name, record_id, operation, data, processed)
SELECT 'MatchParticipant', id, 'INSERT', row_to_json(t), FALSE
FROM "MatchParticipant" t;

INSERT INTO sync_events(table_name, record_id, operation, data, processed)
SELECT 'Round', id, 'INSERT', row_to_json(t), FALSE
FROM "Round" t;

-- Vérifier le résultat
SELECT table_name, COUNT(*) FROM sync_events GROUP BY table_name; 