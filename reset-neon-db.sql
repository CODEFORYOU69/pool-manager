-- Script pour réinitialiser la base de données Neon
-- Ce script supprime toutes les tables dans l'ordre inverse des dépendances
-- puis force une nouvelle synchronisation

-- Désactiver temporairement les contraintes de clés étrangères
SET session_replication_role = 'replica';

-- Suppression des tables dans l'ordre inverse des dépendances
DROP TABLE IF EXISTS "Round" CASCADE;
DROP TABLE IF EXISTS "MatchParticipant" CASCADE;
DROP TABLE IF EXISTS "Match" CASCADE;
DROP TABLE IF EXISTS "PoolParticipant" CASCADE;
DROP TABLE IF EXISTS "ParticipantGroup" CASCADE;
DROP TABLE IF EXISTS "Participant" CASCADE;
DROP TABLE IF EXISTS "Pool" CASCADE;
DROP TABLE IF EXISTS "Group" CASCADE;
DROP TABLE IF EXISTS "Area" CASCADE;
DROP TABLE IF EXISTS "Break" CASCADE;
DROP TABLE IF EXISTS "Competition" CASCADE;
DROP TABLE IF EXISTS "_prisma_migrations" CASCADE;
DROP TABLE IF EXISTS "sync_events" CASCADE;

-- Réactiver les contraintes de clés étrangères
SET session_replication_role = 'origin';

-- Afficher un message de confirmation
SELECT 'Toutes les tables ont été supprimées. La base de données est prête pour une nouvelle synchronisation.' AS message; 