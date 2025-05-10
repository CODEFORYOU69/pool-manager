-- Effacer toutes les données dans un ordre qui respecte les contraintes de clé étrangère
TRUNCATE TABLE "Round" CASCADE;
TRUNCATE TABLE "MatchParticipant" CASCADE;
TRUNCATE TABLE "Match" CASCADE;
TRUNCATE TABLE "Participant" CASCADE;
TRUNCATE TABLE "Pool" CASCADE;
TRUNCATE TABLE "Group" CASCADE;
TRUNCATE TABLE "Area" CASCADE;
TRUNCATE TABLE "Competition" CASCADE;

-- Réinitialiser la table sync_events dans la base locale
-- Exécuter ceci dans la base locale
-- TRUNCATE TABLE sync_events;

-- Insérer des événements de synchronisation pour tous les enregistrements
-- Exécuter ce code SQL dans votre base locale pour forcer une resynchronisation complète
/*
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

INSERT INTO sync_events(table_name, record_id, operation, data, processed)
SELECT 'Match', id, 'INSERT', row_to_json(t), FALSE
FROM "Match" t WHERE "matchNumber" <= 120;

INSERT INTO sync_events(table_name, record_id, operation, data, processed)
SELECT 'MatchParticipant', id, 'INSERT', row_to_json(t), FALSE
FROM "MatchParticipant" t 
WHERE EXISTS (SELECT 1 FROM "Match" m WHERE m.id = t."matchId" AND m."matchNumber" <= 120);

INSERT INTO sync_events(table_name, record_id, operation, data, processed)
SELECT 'Round', id, 'INSERT', row_to_json(t), FALSE
FROM "Round" t
WHERE EXISTS (SELECT 1 FROM "Match" m WHERE m.id = t."matchId" AND m."matchNumber" <= 120);
*/ 