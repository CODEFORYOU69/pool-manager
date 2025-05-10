import Head from "next/head";
import { useEffect, useState } from "react";
import styles from "../styles/Home.module.css";

// URL de l'API (à configurer selon votre environnement)
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

// Composant pour la page d'accueil
export default function Home() {
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [competitionId, setCompetitionId] = useState(null);
  const [competitions, setCompetitions] = useState([]);

  // Charger la liste des compétitions
  useEffect(() => {
    const fetchCompetitions = async () => {
      try {
        const response = await fetch(`${API_URL}/competitions`);
        if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

        const data = await response.json();
        setCompetitions(data);

        // Sélectionner la première compétition par défaut
        if (data.length > 0 && !competitionId) {
          setCompetitionId(data[0].id);
        }
      } catch (err) {
        console.error("Erreur lors du chargement des compétitions:", err);
        setError(
          "Impossible de charger les compétitions. Vérifiez la connexion à l'API."
        );
      }
    };

    fetchCompetitions();
  }, [competitionId]);

  // Charger les données des matchs
  useEffect(() => {
    if (!competitionId) return;

    const fetchMatches = async () => {
      try {
        setLoading(true);

        // Récupérer les matchs pour la compétition sélectionnée
        const response = await fetch(
          `${API_URL}/competition/${competitionId}/matchesWithDetails`
        );

        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`);
        }

        const matches = await response.json();

        // Filtrer pour garder uniquement les matchs avec une heure de début valide
        const validMatches = matches.filter((match) => match.startTime);

        // Organiser les matchs par aire
        const matchesByArea = {};

        validMatches.forEach((match) => {
          const areaNumber = match.areaNumber || 1;

          if (!matchesByArea[areaNumber]) {
            matchesByArea[areaNumber] = {
              completed: [],
              upcoming: [],
            };
          }

          // Trier entre matchs terminés et à venir
          if (match.status === "completed") {
            matchesByArea[areaNumber].completed.push(match);
          } else {
            matchesByArea[areaNumber].upcoming.push(match);
          }
        });

        // Convertir en format pour l'affichage et trier
        const areasArray = Object.keys(matchesByArea).map((areaNum) => {
          const areaMatches = matchesByArea[areaNum];

          // Trier les matchs à venir par heure de début
          const sortedUpcoming = areaMatches.upcoming.sort(
            (a, b) => new Date(a.startTime) - new Date(b.startTime)
          );

          // Trier les matchs terminés par heure de fin (du plus récent au plus ancien)
          const sortedCompleted = areaMatches.completed.sort(
            (a, b) => new Date(b.endTime || 0) - new Date(a.endTime || 0)
          );

          return {
            areaNumber: parseInt(areaNum),
            upcoming: sortedUpcoming.slice(0, 10), // Garder les 10 prochains matchs
            completed: sortedCompleted.slice(0, 5), // Garder les 5 derniers matchs terminés
          };
        });

        // Trier les aires par numéro
        areasArray.sort((a, b) => a.areaNumber - b.areaNumber);

        setAreas(areasArray);
        setLastUpdate(new Date());
        setLoading(false);
      } catch (err) {
        console.error("Erreur lors du chargement des matchs:", err);
        setError(
          "Impossible de charger les matchs. Vérifiez la connexion à l'API."
        );
        setLoading(false);
      }
    };

    // Charger les données immédiatement
    fetchMatches();

    // Puis rafraîchir toutes les 30 secondes
    const intervalId = setInterval(fetchMatches, 30000);

    // Nettoyer l'intervalle lors du démontage du composant
    return () => clearInterval(intervalId);
  }, [competitionId]);

  // Formater l'heure
  const formatTime = (dateString) => {
    if (!dateString) return "--:--";
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // Obtenir le nom du participant depuis l'objet match
  const getParticipantName = (match, position) => {
    try {
      const participant = match.matchParticipants?.find(
        (p) => p.position === position
      )?.participant;
      if (!participant) return "Inconnu";
      return (
        `${participant.prenom || ""} ${participant.nom || ""}`.trim() ||
        "Inconnu"
      );
    } catch (err) {
      return "Inconnu";
    }
  };

  return (
    <div className={styles.container}>
      <Head>
        <title>Taekwondo Tournament - Vue Spectateur</title>
        <meta
          name="description"
          content="Suivi des matchs de Taekwondo en temps réel"
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <header className={styles.header}>
        <h1 className={styles.title}>Tournoi de Taekwondo</h1>
        <div className={styles.competitionSelector}>
          <select
            value={competitionId || ""}
            onChange={(e) => setCompetitionId(e.target.value)}
            disabled={loading || competitions.length === 0}
          >
            {competitions.length === 0 ? (
              <option value="">Aucune compétition disponible</option>
            ) : (
              competitions.map((comp) => (
                <option key={comp.id} value={comp.id}>
                  {comp.name}
                </option>
              ))
            )}
          </select>
        </div>
        <div className={styles.updateInfo}>
          Dernière mise à jour: {formatTime(lastUpdate)}
        </div>
      </header>

      <main className={styles.main}>
        {loading ? (
          <div className={styles.loading}>Chargement des matchs...</div>
        ) : error ? (
          <div className={styles.error}>{error}</div>
        ) : areas.length === 0 ? (
          <div className={styles.noData}>Aucun match programmé</div>
        ) : (
          <div className={styles.areasGrid}>
            {areas.map((area) => (
              <div key={area.areaNumber} className={styles.areaCard}>
                <h2 className={styles.areaTitle}>Aire {area.areaNumber}</h2>

                <div className={styles.areaContent}>
                  <div className={styles.upcomingMatches}>
                    <h3>Prochains Combats</h3>
                    {area.upcoming.length === 0 ? (
                      <p className={styles.noMatches}>Aucun combat à venir</p>
                    ) : (
                      <div className={styles.matchesList}>
                        {area.upcoming.map((match) => (
                          <div key={match.id} className={styles.matchCard}>
                            <div className={styles.matchHeader}>
                              <span className={styles.matchNumber}>
                                Combat #{match.matchNumber}
                              </span>
                              <span className={styles.matchTime}>
                                {formatTime(match.startTime)}
                              </span>
                            </div>
                            <div className={styles.matchContent}>
                              <div className={styles.blueAthlete}>
                                {getParticipantName(match, "A")}
                              </div>
                              <div className={styles.versus}>VS</div>
                              <div className={styles.redAthlete}>
                                {getParticipantName(match, "B")}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className={styles.completedMatches}>
                    <h3>Derniers Résultats</h3>
                    {area.completed.length === 0 ? (
                      <p className={styles.noMatches}>Aucun combat terminé</p>
                    ) : (
                      <div className={styles.matchesList}>
                        {area.completed.map((match) => {
                          const winnerPosition =
                            match.winnerPosition ||
                            (match.winner ===
                            match.matchParticipants?.find(
                              (p) => p.position === "A"
                            )?.participantId
                              ? "A"
                              : match.winner ===
                                match.matchParticipants?.find(
                                  (p) => p.position === "B"
                                )?.participantId
                              ? "B"
                              : null);

                          return (
                            <div key={match.id} className={styles.matchCard}>
                              <div className={styles.matchHeader}>
                                <span className={styles.matchNumber}>
                                  Combat #{match.matchNumber}
                                </span>
                                <span className={styles.matchTime}>
                                  {formatTime(match.endTime)}
                                </span>
                              </div>
                              <div className={styles.matchContent}>
                                <div
                                  className={`${styles.blueAthlete} ${
                                    winnerPosition === "A" ? styles.winner : ""
                                  }`}
                                >
                                  {getParticipantName(match, "A")}
                                </div>
                                <div className={styles.versus}>VS</div>
                                <div
                                  className={`${styles.redAthlete} ${
                                    winnerPosition === "B" ? styles.winner : ""
                                  }`}
                                >
                                  {getParticipantName(match, "B")}
                                </div>
                              </div>
                              <div className={styles.matchScore}>
                                {match.rounds?.map((round, idx) => (
                                  <div key={idx} className={styles.roundScore}>
                                    R{idx + 1}: {round.scoreA} - {round.scoreB}
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className={styles.footer}>
        <p>Taekwondo Tournament Manager - Vue Spectateur</p>
      </footer>
    </div>
  );
}
