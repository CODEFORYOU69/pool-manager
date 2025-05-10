import React, { createContext, useContext, useState } from "react";
import { saveCompetitionState } from "../services/dbService";

const CompetitionContext = createContext();

export const CompetitionProvider = ({ children }) => {
  const [competitionId, setCompetitionId] = useState(null);
  const [competitionName, setCompetitionName] = useState(
    "Compétition de Taekwondo"
  );

  const initializeCompetition = async (config) => {
    try {
      console.log("Début de l'initialisation de la compétition");
      console.log("Configuration reçue:", config);

      const competitionData = {
        id: competitionId,
        name: config.name || competitionName,
        date: new Date(),
        startTime: config.startTime || new Date(),
        roundDuration: config.roundDuration,
        breakDuration: config.breakDuration,
        breakFrequency: config.breakFrequency,
        poolSize: config.poolSize, // Ajout du poolSize
      };

      console.log("Données de la compétition à sauvegarder:", competitionData);
      console.log("ID de compétition existant:", competitionId);

      // Si un ID existe déjà, c'est une mise à jour plutôt qu'une création
      const operation = competitionId ? "mise à jour" : "création";
      console.log(`Opération: ${operation} de la compétition`);

      try {
        const savedCompetition = await saveCompetitionState(competitionData);
        console.log(`Compétition ${operation} avec succès:`, savedCompetition);

        // Ne mettre à jour l'ID que s'il n'existe pas déjà
        if (!competitionId) {
          setCompetitionId(savedCompetition.id);
        }

        return savedCompetition.id;
      } catch (error) {
        // Si l'erreur est 404 (Not Found) et qu'on essayait de mettre à jour
        // Cela signifie que la compétition n'existe plus dans la base de données
        if (competitionId && error.statusCode === 404) {
          console.log(
            "La compétition n'existe plus dans la base de données. Création d'une nouvelle compétition."
          );

          // Réinitialiser l'ID pour créer une nouvelle compétition
          setCompetitionId(null);

          // Recréer sans ID
          const newCompetitionData = {
            ...competitionData,
            id: null, // Forcer la création d'une nouvelle compétition
          };

          // Nouvelle tentative avec création plutôt que mise à jour
          const savedCompetition = await saveCompetitionState(
            newCompetitionData
          );
          console.log(
            "Nouvelle compétition créée avec succès:",
            savedCompetition
          );

          setCompetitionId(savedCompetition.id);
          return savedCompetition.id;
        } else {
          // Pour les autres types d'erreurs, propager l'erreur
          throw error;
        }
      }
    } catch (error) {
      console.error("Erreur détaillée lors de l'initialisation:", error);

      // Créer un message d'erreur plus détaillé
      let errorMessage = "Erreur lors de l'initialisation de la compétition.";

      if (error.message) {
        errorMessage += `\nDétails: ${error.message}`;
      }

      if (error.cause) {
        errorMessage += `\nCause: ${error.cause}`;
      }

      throw new Error(errorMessage);
    }
  };

  return (
    <CompetitionContext.Provider
      value={{
        competitionId,
        setCompetitionId,
        competitionName,
        setCompetitionName,
        initializeCompetition,
      }}
    >
      {children}
    </CompetitionContext.Provider>
  );
};

export const useCompetition = () => useContext(CompetitionContext);
