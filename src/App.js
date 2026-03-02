import React, { useState } from "react";
import CompetitionList from "./components/CompetitionList";
import Footer from "./components/Footer";
import HomePage from "./components/HomePage";
import EliminationBracket from "./components/EliminationBracket";
import GroupDisplay from "./components/GroupDisplay";
import ImportCSV from "./components/ImportCSV";
import MatchSchedule from "./components/MatchSchedule";
import PoolConfig from "./components/PoolConfig";
import PoolFinals from "./components/PoolFinals";
import PoolSchedule from "./components/PoolSchedule";
import Results from "./components/Results";
import ScoreInput from "./components/ScoreInput";
import Sidebar from "./components/Sidebar";
import TournamentSetup from "./components/TournamentSetup";
import {
  CompetitionProvider,
  useCompetition,
} from "./context/CompetitionContext";
import "./styles/App.css";
import "./styles/common.css"; // Importer les styles communs

// Composant interne qui utilise le contexte
function AppContent() {
  const { setCompetitionId, setCompetitionName } = useCompetition();

  const [showLanding, setShowLanding] = useState(true);

  // États globaux de l'application
  const [participants, setParticipants] = useState([]);
  const [tournamentConfig, setTournamentConfig] = useState(null);
  const [groups, setGroups] = useState([]);
  const [matches, setMatches] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [results, setResults] = useState({});
  const [currentStep, setCurrentStep] = useState(0); // Commencer à l'écran d'accueil (étape 0)
  const [selectedCompetition, setSelectedCompetition] = useState(null);
  const [eliminationMatches, setEliminationMatches] = useState([]); // Pour stocker les matchs d'élimination

  // Définir les noms des étapes pour la sidebar (dynamique selon le type de tournoi)
  const getSteps = () => {
    const baseSteps = [
      "Liste des compétitions",
      "Import des participants",
      "Configuration",
    ];

    if (tournamentConfig?.tournamentType === "elimination") {
      return [
        ...baseSteps,
        "Tableaux d'élimination",
        "Planning des matchs",
        "Saisie des scores",
        "Résultats",
      ];
    } else if (tournamentConfig?.tournamentType === "poolFinals") {
      return [
        ...baseSteps,
        "Configuration des poules",
        "Planning par tours",
        "Saisie des scores",
        "Classement & Finales",
        "Résultats",
      ];
    } else {
      return [
        ...baseSteps,
        "Groupes et poules",
        "Planning des matchs",
        "Saisie des scores",
        "Résultats",
      ];
    }
  };

  // Fonctions pour naviguer entre les étapes
  const nextStep = () => setCurrentStep(currentStep + 1);
  const prevStep = () => {
    // Si on revient depuis l'étape 1, retourner à la liste des compétitions
    if (currentStep === 1) {
      setCurrentStep(0);
    } else {
      setCurrentStep(currentStep - 1);
    }
  };

  // Navigation directe vers ScoreInput (étape 5) pour l'élimination
  const goDirectlyToScoreInput = (eliminationMatchesData) => {
    console.log(
      "Navigation directe vers ScoreInput avec matchs d'élimination:",
      eliminationMatchesData.length
    );

    // Les matchs venant de la BDD sont déjà au bon format, on les utilise directement
    console.log("Utilisation des matchs de la BDD tels quels");
    console.log("Premier match exemple:", eliminationMatchesData[0]);

    setEliminationMatches(eliminationMatchesData);
    setCurrentStep(5); // Aller directement à l'étape 5 (ScoreInput)
  };

  // Gérer la sélection d'une compétition existante
  const handleSelectCompetition = async (competition) => {
    try {
      console.log("Chargement de la compétition:", competition.id);

      // Mettre à jour le contexte de compétition
      setCompetitionId(competition.id);
      setCompetitionName(competition.name);

      setSelectedCompetition(competition);

      // Charger les données pour tous les composants
      const loadedState = await loadCompetitionData(competition.id);

      // Déterminer l'étape en fonction de l'état de la compétition
      if (loadedState.hasMatches) {
        // Des matchs existent -> aller directement à la saisie des scores
        console.log("Matchs existants détectés, navigation vers Saisie des scores");
        setCurrentStep(5);
      } else if (loadedState.hasGroups) {
        // Des groupes existent mais pas de matchs -> aller à la config des poules/groupes
        console.log("Groupes existants détectés, navigation vers Configuration des poules");
        setCurrentStep(3);
      } else if (loadedState.hasParticipants) {
        // Des participants existent mais pas de groupes -> aller à la configuration
        console.log("Participants existants détectés, navigation vers Configuration");
        setCurrentStep(2);
      } else {
        // Compétition vide -> commencer à l'import
        setCurrentStep(1);
      }
    } catch (error) {
      console.error("Erreur lors du chargement de la compétition:", error);
      alert(`Erreur lors du chargement de la compétition: ${error.message}`);
    }
  };

  // Fonction pour charger toutes les données d'une compétition
  // Retourne { hasParticipants, hasGroups, hasMatches } pour déterminer l'étape initiale
  const loadCompetitionData = async (competitionId) => {
    const loadedState = { hasParticipants: false, hasGroups: false, hasMatches: false };

    try {
      const {
        fetchCompetitionDetails,
        fetchFormattedGroupsAndPools,
        fetchFormattedMatches,
      } = await import("./services/dbService");

      // 1. Charger les détails de la compétition (y compris les participants)
      const competitionDetails = await fetchCompetitionDetails(competitionId);
      if (
        competitionDetails.participants &&
        competitionDetails.participants.length > 0
      ) {
        console.log(
          `${competitionDetails.participants.length} participants chargés`
        );
        setParticipants(competitionDetails.participants);
        loadedState.hasParticipants = true;
      }

      // 2. Charger les groupes et poules existants
      const groupsData = await fetchFormattedGroupsAndPools(competitionId);
      if (groupsData && groupsData.length > 0) {
        console.log(`${groupsData.length} groupes chargés`);
        setGroups(groupsData);
        loadedState.hasGroups = true;
      }

      // 3. Charger les matchs et le planning
      const { matches: matchesData, schedule: scheduleData } =
        await fetchFormattedMatches(competitionId);
      if (matchesData && matchesData.length > 0) {
        console.log(`${matchesData.length} matchs chargés`);
        setMatches(matchesData);
        setSchedule(scheduleData);
        loadedState.hasMatches = true;
      }

      // 4. Extraire la configuration du tournoi depuis les données de la compétition
      setTournamentConfig({
        numAreas:
          competitionDetails.numAreas ||
          competitionDetails.numberOfAreas ||
          competitionDetails.areas?.length ||
          1,
        roundDuration: competitionDetails.roundDuration || 90,
        breakDuration: competitionDetails.breakDuration || 300,
        breakFrequency: competitionDetails.breakFrequency || 10,
        startTime: new Date(competitionDetails.startTime),
        poolSize: competitionDetails.poolSize || 4,
        tournamentType: competitionDetails.tournamentType || "pools",
      });

      console.log(
        "Toutes les données de la compétition ont été chargées avec succès",
        loadedState
      );

      return loadedState;
    } catch (error) {
      console.error(
        "Erreur lors du chargement des données de la compétition:",
        error
      );
      throw error;
    }
  };

  // Gérer la création d'une nouvelle compétition
  const handleNewCompetition = () => {
    // Réinitialiser le contexte de compétition
    setCompetitionId(null);
    setCompetitionName("Compétition de Taekwondo");

    // Réinitialiser la compétition sélectionnée
    setSelectedCompetition(null);

    // Réinitialiser tous les états liés à la compétition
    setParticipants([]);
    setGroups([]);
    setMatches([]);
    setSchedule([]);
    setResults([]);
    setTournamentConfig({
      numAreas: 1,
      roundDuration: 90,
      breakDuration: 300,
      breakFrequency: 10,
      startTime: new Date(),
      poolSize: 4,
      tournamentType: "pools", // Ajouter le type par défaut
    });

    // Commencer à l'étape 1 (import CSV) pour une nouvelle compétition
    setCurrentStep(1);
  };

  // Rendu conditionnel basé sur l'étape courante
  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <CompetitionList
            onNewCompetition={handleNewCompetition}
            onSelectCompetition={handleSelectCompetition}
          />
        );
      case 1:
        return (
          <ImportCSV
            setParticipants={setParticipants}
            nextStep={nextStep}
            prevStep={prevStep}
            selectedCompetition={selectedCompetition}
          />
        );
      case 2:
        return (
          <TournamentSetup
            participants={participants}
            setTournamentConfig={setTournamentConfig}
            nextStep={nextStep}
            prevStep={prevStep}
            selectedCompetition={selectedCompetition}
          />
        );
      case 3:
        if (tournamentConfig?.tournamentType === "elimination") {
          return (
            <EliminationBracket
              participants={participants}
              tournamentConfig={tournamentConfig}
              setGroups={setGroups}
              nextStep={nextStep}
              prevStep={prevStep}
              goDirectlyToScoreInput={goDirectlyToScoreInput}
            />
          );
        } else if (tournamentConfig?.tournamentType === "poolFinals") {
          return (
            <PoolConfig
              participants={participants}
              tournamentConfig={tournamentConfig}
              setGroups={setGroups}
              nextStep={nextStep}
              prevStep={prevStep}
            />
          );
        } else {
          return (
            <GroupDisplay
              participants={participants}
              tournamentConfig={tournamentConfig}
              setGroups={setGroups}
              nextStep={nextStep}
              prevStep={prevStep}
            />
          );
        }
      case 4:
        if (tournamentConfig?.tournamentType === "poolFinals") {
          return (
            <PoolSchedule
              tournamentConfig={tournamentConfig}
              nextStep={nextStep}
              prevStep={prevStep}
              setSchedule={setSchedule}
              setMatches={setMatches}
            />
          );
        }
        return (
          <MatchSchedule
            groups={groups}
            tournamentConfig={tournamentConfig}
            setMatches={setMatches}
            setSchedule={setSchedule}
            nextStep={nextStep}
            prevStep={prevStep}
          />
        );
      case 5:
        return (
          <ScoreInput
            matches={
              tournamentConfig?.tournamentType === "elimination"
                ? eliminationMatches
                : matches
            }
            schedule={schedule}
            setResults={setResults}
            nextStep={nextStep}
            prevStep={prevStep}
            tournamentType={tournamentConfig?.tournamentType}
          />
        );
      case 6:
        if (tournamentConfig?.tournamentType === "poolFinals") {
          return (
            <PoolFinals
              tournamentConfig={tournamentConfig}
              nextStep={nextStep}
              prevStep={prevStep}
            />
          );
        }
        return (
          <Results
            participants={participants}
            groups={groups}
            matches={matches}
            results={results}
            tournamentConfig={tournamentConfig}
            prevStep={prevStep}
          />
        );
      case 7:
        if (tournamentConfig?.tournamentType === "poolFinals") {
          return (
            <Results
              participants={participants}
              groups={groups}
              matches={matches}
              results={results}
              tournamentConfig={tournamentConfig}
              prevStep={prevStep}
            />
          );
        }
        return null;
      default:
        return null;
    }
  };

  // Ne pas afficher la sidebar à l'étape 0 (liste des compétitions)
  const shouldShowSidebar = currentStep > 0;

  if (showLanding) {
    return <HomePage onStart={() => setShowLanding(false)} />;
  }

  return (
    <div className="app-container">
      {shouldShowSidebar && (
        <Sidebar
          currentStep={currentStep}
          setCurrentStep={setCurrentStep}
          steps={getSteps()}
          competitionName={selectedCompetition?.name || "Nouvelle compétition"}
        />
      )}
      <div className="main-content">
        <header className="App-header">
          {currentStep > 0 && (
            <h1>
              {selectedCompetition
                ? selectedCompetition.name
                : "Nouvelle compétition"}
            </h1>
          )}
        </header>
        <main className="App-main">{renderStep()}</main>
        <Footer />
      </div>
    </div>
  );
}

// Composant App principal qui enveloppe AppContent dans le provider
function App() {
  return (
    <CompetitionProvider>
      <AppContent />
    </CompetitionProvider>
  );
}

export default App;
