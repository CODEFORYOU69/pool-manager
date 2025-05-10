-- Script pour importer toutes les données dans le bon ordre
-- Note: Les aires ont déjà été importées

-- 1. Compétition
TRUNCATE TABLE "Competition" CASCADE;
\COPY "Competition" FROM 'competition_data.csv' WITH CSV HEADER;

-- 2. Groupe
TRUNCATE TABLE "Group" CASCADE;
\COPY "Group" FROM 'group_data.csv' WITH CSV HEADER;

-- 3. Pool
TRUNCATE TABLE "Pool" CASCADE;
\COPY "Pool" FROM 'pool_data.csv' WITH CSV HEADER;

-- 4. Participant
TRUNCATE TABLE "Participant" CASCADE;
\COPY "Participant" FROM 'participant_data.csv' WITH CSV HEADER;

-- 5. Match (dépend de Area, Group, Pool)
TRUNCATE TABLE "Match" CASCADE;
\COPY "Match" FROM 'match_data.csv' WITH CSV HEADER;

-- 6. MatchParticipant (dépend de Match et Participant)
TRUNCATE TABLE "MatchParticipant" CASCADE;
\COPY "MatchParticipant" FROM 'matchparticipant_data.csv' WITH CSV HEADER;

-- 7. Round (dépend de Match)
TRUNCATE TABLE "Round" CASCADE;
\COPY "Round" FROM 'round_data.csv' WITH CSV HEADER;

-- Vérification du nombre de lignes importées
SELECT 'Competition' as table_name, COUNT(*) FROM "Competition" UNION ALL
SELECT 'Group', COUNT(*) FROM "Group" UNION ALL
SELECT 'Pool', COUNT(*) FROM "Pool" UNION ALL
SELECT 'Area', COUNT(*) FROM "Area" UNION ALL
SELECT 'Participant', COUNT(*) FROM "Participant" UNION ALL
SELECT 'Match', COUNT(*) FROM "Match" UNION ALL
SELECT 'MatchParticipant', COUNT(*) FROM "MatchParticipant" UNION ALL
SELECT 'Round', COUNT(*) FROM "Round"
ORDER BY table_name; 