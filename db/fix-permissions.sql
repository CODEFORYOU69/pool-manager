-- Donner les privilèges sur la table sync_events
GRANT ALL PRIVILEGES ON TABLE sync_events TO codeforyou69;

-- Donner les privilèges sur les séquences associées
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO codeforyou69;

-- S'assurer que les triggers fonctionnent correctement
GRANT EXECUTE ON FUNCTION log_match_changes() TO codeforyou69;
GRANT EXECUTE ON FUNCTION log_round_changes() TO codeforyou69;
GRANT EXECUTE ON FUNCTION log_matchparticipant_changes() TO codeforyou69;
GRANT EXECUTE ON FUNCTION log_participant_changes() TO codeforyou69;

-- Corriger la séquence sync_events_id_seq
GRANT USAGE, SELECT, UPDATE ON SEQUENCE sync_events_id_seq TO codeforyou69; 