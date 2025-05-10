-- Insérer directement le match 102
INSERT INTO "Match" (
  id, "matchNumber", status, "startTime", "endTime", 
  winner, "groupId", "poolId", "areaId", "poolIndex", "pointMatch"
)
VALUES (
  '8aa12d89-d1d2-4df4-9ede-83ebe9605557', 102, 'completed', 
  '2025-05-10 06:36:00', '2025-05-10 13:54:19.36',
  '46a3606a-53b7-4c0d-974f-6a728707e5c0', 
  '3eb8597e-ca5f-48ba-b2b5-78cf87e116f6',
  '035caadc-2a4b-45ef-99e4-4e450e1185b9',
  '40b689f0-ac29-4124-9aa1-50de7f14ea7a',
  2, 3
);

-- Vérifier que le match a bien été inséré
SELECT * FROM "Match" WHERE "matchNumber" = 102; 