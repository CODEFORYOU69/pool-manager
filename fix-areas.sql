-- Script pour exporter les données des aires de la base locale
\COPY (SELECT * FROM "Area") TO 'areas_data.csv' WITH CSV HEADER;

-- Ce fichier peut ensuite être importé dans la base distante avec:
-- \COPY "Area" FROM 'areas_data.csv' WITH CSV HEADER; 