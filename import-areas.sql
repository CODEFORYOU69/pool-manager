-- Vider la table Area (avec CASCADE pour éviter les problèmes de clé étrangère)
TRUNCATE TABLE "Area" CASCADE;

-- Importer les données du fichier CSV
\COPY "Area" FROM 'areas_data.csv' WITH CSV HEADER; 