-- Script pour corriger le vainqueur du match #103
-- Vérifier d'abord les informations du match
SELECT id, "matchNumber", winner, status 
FROM "Match" 
WHERE "matchNumber" = 103;

-- Vérifier les participants du match
SELECT mp.id, mp.position, mp."participantId", p.nom, p.prenom
FROM "MatchParticipant" mp
JOIN "Participant" p ON mp."participantId" = p.id
JOIN "Match" m ON mp."matchId" = m.id
WHERE m."matchNumber" = 103;

-- Vérifier les rounds du match
SELECT id, "roundNumber", "scoreA", "scoreB", winner, "winnerPosition"
FROM "Round"
WHERE "matchId" = (SELECT id FROM "Match" WHERE "matchNumber" = 103);

-- Déterminer le bon ID du vainqueur (ELEANA Cheron) en fonction des rounds gagnés
-- Ensuite, mettre à jour le match avec le bon vainqueur

-- Une fois que nous connaissons l'ID du vainqueur correct, nous pouvons mettre à jour:
-- UPDATE "Match" 
-- SET winner = '[PARTICIPANT_ID_ELEANA]' 
-- WHERE "matchNumber" = 103; 