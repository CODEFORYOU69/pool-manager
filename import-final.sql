-- Réimporter les aires d'abord pour s'assurer qu'elles soient présentes
\COPY "Area" FROM 'areas_data.csv' WITH CSV HEADER;

-- 1. Compétition (sans CASCADE pour ne pas toucher aux aires)
DELETE FROM "Competition";
\COPY "Competition" FROM 'competition_data.csv' WITH CSV HEADER;

-- 2. Groupe
DELETE FROM "Group";
\COPY "Group" FROM 'group_data.csv' WITH CSV HEADER;

-- 3. Pool
DELETE FROM "Pool";
\COPY "Pool" FROM 'pool_data.csv' WITH CSV HEADER;

-- 4. Participant
DELETE FROM "Participant";
\COPY "Participant" FROM 'participant_data.csv' WITH CSV HEADER;

-- 5. Match (dépend de Area, Group, Pool)
DELETE FROM "Match";
\COPY "Match" FROM 'match_data.csv' WITH CSV HEADER;

-- 6. MatchParticipant (dépend de Match et Participant)
DELETE FROM "MatchParticipant";
\COPY "MatchParticipant" FROM 'matchparticipant_data.csv' WITH CSV HEADER;

-- 7. Round (dépend de Match)
DELETE FROM "Round";
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