-- 1. D'abord insérer les participants du match
-- Vérifions d'abord si les participants existent déjà dans la base de données
INSERT INTO "Participant" (id, nom, prenom)
VALUES 
  ('46a3606a-53b7-4c0d-974f-6a728707e5c0', 'Doe', 'John'),
  ('ce153594-aad3-4314-8fa4-1aa4e2c4cf4e', 'Smith', 'Jane')
ON CONFLICT (id) DO NOTHING;

-- 2. Insérer les participants du match
INSERT INTO "MatchParticipant" (id, position, "matchId", "participantId")
VALUES 
  ('bb00e811-42d9-4d53-a691-b76bbe192656', 'A', '8aa12d89-d1d2-4df4-9ede-83ebe9605557', '46a3606a-53b7-4c0d-974f-6a728707e5c0'),
  ('435fb0d2-155c-4d9b-a898-9d592d0fd24d', 'B', '8aa12d89-d1d2-4df4-9ede-83ebe9605557', 'ce153594-aad3-4314-8fa4-1aa4e2c4cf4e');

-- 3. Insérer les rounds du match
INSERT INTO "Round" (id, "roundNumber", "scoreA", "scoreB", winner, "createdAt", "updatedAt", "matchId", "winnerPosition")
VALUES 
  ('ea1fd18f-0c4e-4ab9-b4f2-21fa04f89755', 1, 4, 2, '46a3606a-53b7-4c0d-974f-6a728707e5c0', '2025-05-10 13:54:19.369', '2025-05-10 13:54:19.369', '8aa12d89-d1d2-4df4-9ede-83ebe9605557', 'A'),
  ('ae2b6c93-5332-4b39-9567-a464d64dd0d8', 2, 4, 1, '46a3606a-53b7-4c0d-974f-6a728707e5c0', '2025-05-10 13:54:19.372', '2025-05-10 13:54:19.372', '8aa12d89-d1d2-4df4-9ede-83ebe9605557', 'A'),
  ('3c851ec2-6e83-4f35-9992-a6940f93c1c9', 3, 0, 0, NULL, '2025-05-10 13:54:19.375', '2025-05-10 13:54:19.375', '8aa12d89-d1d2-4df4-9ede-83ebe9605557', NULL);

-- Vérifier que tout a bien été inséré
SELECT mp.position, p.nom, p.prenom, r."roundNumber", r."scoreA", r."scoreB"
FROM "Match" m
JOIN "MatchParticipant" mp ON m.id = mp."matchId"
JOIN "Participant" p ON mp."participantId" = p.id
LEFT JOIN "Round" r ON m.id = r."matchId"
WHERE m."matchNumber" = 102
ORDER BY mp.position, r."roundNumber"; 