-- Insérer directement l'aire spécifique dont nous avons besoin
INSERT INTO "Area" (id, "areaNumber", "competitionId")
VALUES ('40b689f0-ac29-4124-9aa1-50de7f14ea7a', 1, 'eb2423d5-6b74-4421-8fe0-6ea625532f36');

-- Vérifier que l'aire a bien été créée
SELECT * FROM "Area"; 