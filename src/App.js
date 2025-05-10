import React, { useState } from "react";
import CompetitionList from "./components/CompetitionList";
import GroupDisplay from "./components/GroupDisplay";
import ImportCSV from "./components/ImportCSV";
import MatchSchedule from "./components/MatchSchedule";
import Results from "./components/Results";
import ScoreInput from "./components/ScoreInput";
import Sidebar from "./components/Sidebar";
import TournamentSetup from "./components/TournamentSetup";
import { CompetitionProvider } from "./context/CompetitionContext";
import "./styles/App.css";
import "./styles/common.css"; // Importer les styles communs

function App() {
  // États globaux de l'application
  const [participants, setParticipants] = useState([]);
  const [tournamentConfig, setTournamentConfig] = useState(null);
  const [groups, setGroups] = useState([]);
  const [matches, setMatches] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [results, setResults] = useState({});
  const [currentStep, setCurrentStep] = useState(0); // Commencer à l'écran d'accueil (étape 0)
  const [selectedCompetition, setSelectedCompetition] = useState(null);

  // Définir les noms des étapes pour la sidebar
  const steps = [
    "Liste des compétitions",
    "Import des participants",
    "Configuration",
    "Groupes et poules",
    "Planning des matchs",
    "Saisie des scores",
    "Résultats",
  ];

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

  // Gérer la sélection d'une compétition existante
  const handleSelectCompetition = async (competition) => {
    try {
      console.log("Chargement de la compétition:", competition.id);
      setSelectedCompetition(competition);

      // Charger les données pour tous les composants
      await loadCompetitionData(competition.id);

      // Commencer à l'étape 1 (import CSV) lors de la sélection d'une compétition
      setCurrentStep(1);
    } catch (error) {
      console.error("Erreur lors du chargement de la compétition:", error);
      alert(`Erreur lors du chargement de la compétition: ${error.message}`);
    }
  };

  // Fonction pour charger toutes les données d'une compétition
  const loadCompetitionData = async (competitionId) => {
    try {
      // Indiquer que nous sommes en train de charger
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
      }

      // 2. Charger les groupes et poules existants
      const groupsData = await fetchFormattedGroupsAndPools(competitionId);
      if (groupsData && groupsData.length > 0) {
        console.log(`${groupsData.length} groupes chargés`);
        setGroups(groupsData);
      }

      // 3. Charger les matchs et le planning
      const { matches: matchesData, schedule: scheduleData } =
        await fetchFormattedMatches(competitionId);
      if (matchesData && matchesData.length > 0) {
        console.log(`${matchesData.length} matchs chargés`);
        setMatches(matchesData);
        setSchedule(scheduleData);
      }

      // 4. Extraire la configuration du tournoi depuis les données de la compétition
      setTournamentConfig({
        numAreas: competitionDetails.areas?.length || 1,
        roundDuration: competitionDetails.roundDuration || 90,
        breakDuration: competitionDetails.breakDuration || 300,
        breakFrequency: competitionDetails.breakFrequency || 10,
        startTime: new Date(competitionDetails.startTime),
        poolSize: competitionDetails.poolSize || 4,
      });

      console.log(
        "Toutes les données de la compétition ont été chargées avec succès"
      );
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
    setSelectedCompetition(null);
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
        return (
          <GroupDisplay
            participants={participants}
            tournamentConfig={tournamentConfig}
            setGroups={setGroups}
            nextStep={nextStep}
            prevStep={prevStep}
          />
        );
      case 4:
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
            matches={matches}
            schedule={schedule}
            setResults={setResults}
            nextStep={nextStep}
            prevStep={prevStep}
          />
        );
      case 6:
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
      default:
        return null;
    }
  };

  // Ne pas afficher la sidebar à l'étape 0 (liste des compétitions)
  const shouldShowSidebar = currentStep > 0;

  return (
    <CompetitionProvider>
      <div className="app-container">
        {shouldShowSidebar && (
          <Sidebar
            currentStep={currentStep}
            setCurrentStep={setCurrentStep}
            steps={steps}
            competitionName={
              selectedCompetition?.name || "Nouvelle compétition"
            }
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
        </div>
      </div>
    </CompetitionProvider>
  );
}

export default App;
