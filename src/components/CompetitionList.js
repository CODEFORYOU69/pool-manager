import React, { useEffect, useState } from "react";
import { useCompetition } from "../context/CompetitionContext";
import { deleteCompetition, fetchCompetitions } from "../services/dbService";
import "../styles/CompetitionList.css";

const CompetitionList = ({ onNewCompetition, onSelectCompetition }) => {
  const { setCompetitionId, setCompetitionName } = useCompetition();
  const [competitions, setCompetitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadCompetitions();
  }, []);

  const loadCompetitions = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchCompetitions();
      setCompetitions(data);
    } catch (error) {
      console.error("Erreur lors du chargement des compétitions:", error);
      setError("Impossible de charger les compétitions");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCompetition = (competition) => {
    setCompetitionId(competition.id);
    setCompetitionName(competition.name);
    onSelectCompetition(competition);
  };

  const handleDeleteCompetition = async (id, event) => {
    event.stopPropagation(); // Empêcher la propagation au parent (sélection)

    if (
      window.confirm("Êtes-vous sûr de vouloir supprimer cette compétition ?")
    ) {
      try {
        await deleteCompetition(id);
        // Recharger la liste après suppression
        loadCompetitions();
      } catch (error) {
        console.error("Erreur lors de la suppression:", error);
        setError("Erreur lors de la suppression de la compétition");
      }
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="competition-list-container">
        <h2>Compétitions existantes</h2>
        <div className="loading">Chargement des compétitions...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="competition-list-container">
        <h2>Compétitions existantes</h2>
        <div className="error">{error}</div>
        <button className="retry-btn" onClick={loadCompetitions}>
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="competition-list-container">
      <h2>Gestionnaire de compétitions de Taekwondo</h2>

      <div className="action-buttons">
        <button className="new-competition-btn" onClick={onNewCompetition}>
          Créer une nouvelle compétition
        </button>
        <button className="refresh-btn" onClick={loadCompetitions}>
          Rafraîchir la liste
        </button>
      </div>

      {competitions.length === 0 ? (
        <div className="no-competitions">
          <p>Aucune compétition trouvée.</p>
          <p>Cliquez sur "Créer une nouvelle compétition" pour commencer.</p>
        </div>
      ) : (
        <div className="competitions-grid">
          {competitions.map((competition) => (
            <div
              key={competition.id}
              className="competition-card"
              onClick={() => handleSelectCompetition(competition)}
            >
              <h3 className="competition-name">{competition.name}</h3>
              <div className="competition-date">
                <span className="label">Date:</span>{" "}
                {formatDate(competition.date)}
              </div>
              <div className="competition-stats">
                <div className="stat">
                  <span className="label">Participants:</span>{" "}
                  {competition._count.participants}
                </div>
                <div className="stat">
                  <span className="label">Groupes:</span>{" "}
                  {competition._count.groups}
                </div>
              </div>
              <button
                className="delete-btn"
                onClick={(e) => handleDeleteCompetition(competition.id, e)}
              >
                Supprimer
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CompetitionList;
