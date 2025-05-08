import React, { useEffect, useState } from "react";
import { fetchCompetitionDetails } from "../services/dbService";
import "../styles/ImportCSV.css";
import { parseCSV } from "../utils/csvParser";

const ImportCSV = ({
  setParticipants,
  nextStep,
  prevStep,
  selectedCompetition,
}) => {
  const [file, setFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [participantsLoaded, setParticipantsLoaded] = useState(false);

  // Si une compétition est sélectionnée, charger ses participants existants
  useEffect(() => {
    if (selectedCompetition && !participantsLoaded) {
      loadExistingParticipants();
    }
  }, [selectedCompetition, participantsLoaded]);

  const loadExistingParticipants = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const competitionDetails = await fetchCompetitionDetails(
        selectedCompetition.id
      );

      if (
        competitionDetails.participants &&
        competitionDetails.participants.length > 0
      ) {
        // Mettre à jour les participants
        setParticipants(competitionDetails.participants);
        setPreviewData(competitionDetails.participants.slice(0, 5));
        setParticipantsLoaded(true);
        setFile({ name: "Participants existants" });
      } else {
        // Aucun participant trouvé
        setError("Aucun participant existant trouvé pour cette compétition.");
      }
    } catch (err) {
      setError(
        `Erreur lors du chargement des participants existants: ${err.message}`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Utiliser l'API Electron pour sélectionner un fichier
      const result = await window.electronAPI.openFileDialog();

      if (result.canceled) {
        setIsLoading(false);
        return;
      }

      if (result.error) {
        throw new Error(result.error);
      }

      // Analyser le contenu CSV
      const { data, errors } = parseCSV(result.content);

      if (errors && errors.length > 0) {
        throw new Error(`Erreur dans le fichier CSV: ${errors[0].message}`);
      }

      setFile({
        name:
          result.filePath.split("/").pop() || result.filePath.split("\\").pop(),
      });

      // Validation des données
      validateData(data);

      // Prévisualisation des données
      setPreviewData(data.slice(0, 5));

      // Mettre à jour l'état global
      setParticipants(data);
    } catch (err) {
      setError(err.message);
      setFile(null);
      setPreviewData(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Validation des données CSV
  const validateData = (data) => {
    if (!data || data.length === 0) {
      throw new Error("Le fichier CSV est vide.");
    }

    // Vérifier les champs obligatoires dans chaque entrée
    const requiredFields = ["nom", "prenom", "sexe", "age", "poids", "ligue"];

    for (const participant of data) {
      const missingFields = requiredFields.filter(
        (field) => !participant[field]
      );

      if (missingFields.length > 0) {
        throw new Error(
          `Champs manquants pour un participant: ${missingFields.join(", ")}`
        );
      }

      // Validation des types de données
      if (isNaN(parseFloat(participant.age))) {
        throw new Error("L'âge doit être un nombre.");
      }

      if (isNaN(parseFloat(participant.poids))) {
        throw new Error("Le poids doit être un nombre.");
      }
    }
  };

  return (
    <div className="import-csv-container">
      <h2>Étape 1: Importation des participants</h2>

      <div className="import-actions">
        <button
          className="select-file-btn"
          onClick={handleFileSelect}
          disabled={isLoading}
        >
          {isLoading ? "Importation..." : "Sélectionner un fichier CSV"}
        </button>

        {file && (
          <div className="file-info">
            <span>Fichier sélectionné: {file.name}</span>
          </div>
        )}
      </div>

      {error && <div className="error-message">{error}</div>}

      {previewData && (
        <div className="preview-container">
          <h3>Aperçu des données</h3>
          <table className="preview-table">
            <thead>
              <tr>
                {Object.keys(previewData[0]).map((header) => (
                  <th key={header}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewData.map((row, index) => (
                <tr key={index}>
                  {Object.values(row).map((value, i) => (
                    <td key={i}>{value}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="preview-info">
            Affichage des 5 premiers participants sur {previewData.length} au
            total.
          </p>
        </div>
      )}

      <div className="navigation-buttons">
        <button className="prev-btn" onClick={prevStep}>
          Retour
        </button>
        <button
          className="next-btn"
          onClick={nextStep}
          disabled={!previewData || isLoading}
        >
          Suivant
        </button>
      </div>
    </div>
  );
};

export default ImportCSV;
