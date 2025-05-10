-- Script pour exporter les données importantes
\COPY (SELECT * FROM "Competition") TO 'competition_data.csv' WITH CSV HEADER;
\COPY (SELECT * FROM "Group") TO 'group_data.csv' WITH CSV HEADER;
\COPY (SELECT * FROM "Pool") TO 'pool_data.csv' WITH CSV HEADER;
\COPY (SELECT * FROM "Participant") TO 'participant_data.csv' WITH CSV HEADER;
\COPY (SELECT * FROM "Match" WHERE "matchNumber" <= 120) TO 'match_data.csv' WITH CSV HEADER;
\COPY (SELECT * FROM "MatchParticipant" mp WHERE EXISTS (SELECT 1 FROM "Match" m WHERE m.id = mp."matchId" AND m."matchNumber" <= 120)) TO 'matchparticipant_data.csv' WITH CSV HEADER;
\COPY (SELECT * FROM "Round" r WHERE EXISTS (SELECT 1 FROM "Match" m WHERE m.id = r."matchId" AND m."matchNumber" <= 120)) TO 'round_data.csv' WITH CSV HEADER; 