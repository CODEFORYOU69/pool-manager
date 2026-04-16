import React, { useEffect, useState } from "react";
import { useCompetition } from "../context/CompetitionContext";
import {
  API_URL,
  deleteCompetition,
  fetchCompetitions,
} from "../services/dbService";
import "../styles/CompetitionList.css";

const CompetitionList = ({ onNewCompetition, onSelectCompetition }) => {
  const { setCompetitionId, setCompetitionName, competitionId } =
    useCompetition();
  const [competitions, setCompetitions] = useState([]);
  const [neonOnlyCompetitions, setNeonOnlyCompetitions] = useState([]);
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

      // Charger les compétitions Neon en parallèle, garder uniquement celles
      // qui n'existent pas en local.
      try {
        const neonRes = await fetch(`${API_URL}/neon/competitions`);
        if (neonRes.ok) {
          const neonData = await neonRes.json();
          const localIds = new Set(data.map((c) => c.id));
          setNeonOnlyCompetitions(
            neonData.filter((c) => !localIds.has(c.id))
          );
        } else {
          setNeonOnlyCompetitions([]);
        }
      } catch (neonErr) {
        console.warn("Neon indisponible:", neonErr);
        setNeonOnlyCompetitions([]);
      }
    } catch (error) {
      console.error("Erreur lors du chargement des compétitions:", error);
      setError("Impossible de charger les compétitions");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleNeonVisibility = async (id, currentVisible) => {
    try {
      const res = await fetch(`${API_URL}/neon/competition/${id}/visibility`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibleInSpectator: !currentVisible }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setNeonOnlyCompetitions((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, visibleInSpectator: !currentVisible } : c
        )
      );
    } catch (err) {
      console.error("Erreur toggle Neon:", err);
      setError("Impossible de mettre à jour la visibilité (Neon)");
    }
  };

  const handleDeleteNeon = async (id) => {
    if (
      !window.confirm(
        "Supprimer définitivement cette compétition de Neon ? (irréversible)"
      )
    )
      return;
    try {
      const res = await fetch(`${API_URL}/neon/competition/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setNeonOnlyCompetitions((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      console.error("Erreur DELETE Neon:", err);
      setError("Impossible de supprimer la compétition Neon");
    }
  };

  const handleSelectCompetition = (competition) => {
    setCompetitionId(competition.id);
    setCompetitionName(competition.name);
    onSelectCompetition(competition);
  };

  const handleToggleVisibility = async (id, currentVisible, event) => {
    event.stopPropagation();
    try {
      const res = await fetch(`${API_URL}/competition/${id}/visibility`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibleInSpectator: !currentVisible }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setCompetitions((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, visibleInSpectator: !currentVisible } : c
        )
      );
    } catch (err) {
      console.error("Erreur toggle visibilité:", err);
      setError("Impossible de mettre à jour la visibilité");
    }
  };

  const handleDeleteCompetition = async (id, event) => {
    event.stopPropagation(); // Empêcher la propagation au parent (sélection)

    if (
      window.confirm("Êtes-vous sûr de vouloir supprimer cette compétition ?")
    ) {
      try {
        await deleteCompetition(id);

        // Si l'ID supprimé est l'ID actuellement sélectionné, le réinitialiser
        if (id === competitionId) {
          setCompetitionId(null);
          setCompetitionName("Compétition de Taekwondo");
        }

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
              <div className="competition-actions">
                <button
                  className={`visibility-btn ${
                    competition.visibleInSpectator === false
                      ? "hidden"
                      : "visible"
                  }`}
                  onClick={(e) =>
                    handleToggleVisibility(
                      competition.id,
                      competition.visibleInSpectator !== false,
                      e
                    )
                  }
                  title={
                    competition.visibleInSpectator === false
                      ? "Compétition cachée du spectator — cliquer pour afficher"
                      : "Compétition visible dans le spectator — cliquer pour cacher"
                  }
                >
                  {competition.visibleInSpectator === false
                    ? "Cachée"
                    : "Visible spectator"}
                </button>
                <button
                  className="delete-btn"
                  onClick={(e) => handleDeleteCompetition(competition.id, e)}
                >
                  Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {neonOnlyCompetitions.length > 0 && (
        <div className="neon-only-section">
          <h3 className="neon-section-title">
            Compétitions cloud uniquement ({neonOnlyCompetitions.length})
          </h3>
          <p className="neon-section-desc">
            Présentes dans Neon mais pas dans cette machine. Tu peux quand
            même contrôler leur visibilité côté spectator.
          </p>
          <div className="competitions-grid">
            {neonOnlyCompetitions.map((competition) => (
              <div
                key={competition.id}
                className="competition-card neon-only-card"
              >
                <h3 className="competition-name">
                  {competition.name}
                  <span className="cloud-badge">Cloud</span>
                </h3>
                <div className="competition-date">
                  <span className="label">Date:</span>{" "}
                  {formatDate(competition.date)}
                </div>
                <div className="competition-stats">
                  <div className="stat">
                    <span className="label">Participants:</span>{" "}
                    {competition._count?.participants ?? "—"}
                  </div>
                  <div className="stat">
                    <span className="label">Groupes:</span>{" "}
                    {competition._count?.groups ?? "—"}
                  </div>
                </div>
                <div className="competition-actions">
                  <button
                    className={`visibility-btn ${
                      competition.visibleInSpectator === false
                        ? "hidden"
                        : "visible"
                    }`}
                    onClick={() =>
                      handleToggleNeonVisibility(
                        competition.id,
                        competition.visibleInSpectator !== false
                      )
                    }
                  >
                    {competition.visibleInSpectator === false
                      ? "Cachée"
                      : "Visible spectator"}
                  </button>
                  <button
                    className="delete-btn"
                    onClick={() => handleDeleteNeon(competition.id)}
                  >
                    Supprimer (Neon)
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CompetitionList;
