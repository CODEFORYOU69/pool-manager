-- Réinitialiser la table sync_events
TRUNCATE TABLE sync_events;

-- Forcer la synchronisation de toutes les tables importantes
-- Ajouter les enregistrements pour les compétitions
INSERT INTO sync_events(table_name, record_id, operation, data, processed)
SELECT 'Competition', id, 'INSERT', row_to_json(t), FALSE
FROM "Competition" t;

-- Ajouter les enregistrements pour les aires
INSERT INTO sync_events(table_name, record_id, operation, data, processed)
SELECT 'Area', id, 'INSERT', row_to_json(t), FALSE
FROM "Area" t;

-- Ajouter les enregistrements pour les groupes
INSERT INTO sync_events(table_name, record_id, operation, data, processed)
SELECT 'Group', id, 'INSERT', row_to_json(t), FALSE
FROM "Group" t;

-- Ajouter les enregistrements pour les poules
INSERT INTO sync_events(table_name, record_id, operation, data, processed)
SELECT 'Pool', id, 'INSERT', row_to_json(t), FALSE
FROM "Pool" t;

-- Ajouter les enregistrements pour les participants
INSERT INTO sync_events(table_name, record_id, operation, data, processed)
SELECT 'Participant', id, 'INSERT', row_to_json(t), FALSE
FROM "Participant" t;

-- Ajouter les enregistrements pour les matchs (limité aux 120 premiers pour test)
INSERT INTO sync_events(table_name, record_id, operation, data, processed)
SELECT 'Match', id, 'INSERT', row_to_json(t), FALSE
FROM "Match" t
WHERE "matchNumber" <= 120;

-- Ajouter les enregistrements pour les participants de match
INSERT INTO sync_events(table_name, record_id, operation, data, processed)
SELECT 'MatchParticipant', id, 'INSERT', row_to_json(t), FALSE
FROM "MatchParticipant" t 
WHERE EXISTS (SELECT 1 FROM "Match" m WHERE m.id = t."matchId" AND m."matchNumber" <= 120);

-- Ajouter les enregistrements pour les rounds
INSERT INTO sync_events(table_name, record_id, operation, data, processed)
SELECT 'Round', id, 'INSERT', row_to_json(t), FALSE
FROM "Round" t
WHERE EXISTS (SELECT 1 FROM "Match" m WHERE m.id = t."matchId" AND m."matchNumber" <= 120);

-- Vérifier le résultat
SELECT table_name, COUNT(*) FROM sync_events GROUP BY table_name; 