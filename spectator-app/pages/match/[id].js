import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import styles from "../../styles/MatchDetail.module.css";

// URL de l'API
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

export default function MatchDetail() {
  const router = useRouter();
  const { id } = router.query;

  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // Récupérer les données du match
  useEffect(() => {
    if (!id) return;

    const fetchMatch = async () => {
      try {
        setLoading(true);

        const response = await fetch(`${API_URL}/match/${id}`);

        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`);
        }

        const matchData = await response.json();
        setMatch(matchData);
        setLastUpdate(new Date());
        setLoading(false);
      } catch (err) {
        console.error("Erreur lors du chargement du match:", err);
        setError(
          "Impossible de charger les informations du match. Vérifiez la connexion à l'API."
        );
        setLoading(false);
      }
    };

    // Charger les données immédiatement
    fetchMatch();

    // Puis rafraîchir toutes les 10 secondes
    const intervalId = setInterval(fetchMatch, 10000);

    // Nettoyer l'intervalle lors du démontage du composant
    return () => clearInterval(intervalId);
  }, [id]);

  // Formater l'heure
  const formatTime = (dateString) => {
    if (!dateString) return "--:--";
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // Formater la date
  const formatDate = (dateString) => {
    if (!dateString) return "Date inconnue";
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  // Obtenir le nom complet du participant
  const getParticipantName = (participant) => {
    if (!participant) return "Inconnu";
    return (
      `${participant.prenom || ""} ${participant.nom || ""}`.trim() || "Inconnu"
    );
  };

  // Obtenir la couleur associée à une position
  const getPositionColor = (position) => {
    return position === "A" ? styles.blue : styles.red;
  };

  // Déterminer le statut du match
  const getMatchStatus = (status) => {
    switch (status) {
      case "completed":
        return "Terminé";
      case "in_progress":
        return "En cours";
      case "pending":
        return "À venir";
      default:
        return "Statut inconnu";
    }
  };

  return (
    <div className={styles.container}>
      <Head>
        <title>Match #{match?.matchNumber || ""} - Taekwondo Tournament</title>
        <meta name="description" content="Détails du match de Taekwondo" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <header className={styles.header}>
        <Link href="/" className={styles.backLink}>
          &larr; Retour
        </Link>
        <h1 className={styles.title}>Match #{match?.matchNumber || ""}</h1>
        <div className={styles.updateInfo}>
          Dernière mise à jour: {formatTime(lastUpdate)}
        </div>
      </header>

      <main className={styles.main}>
        {loading ? (
          <div className={styles.loading}>Chargement des informations...</div>
        ) : error ? (
          <div className={styles.error}>{error}</div>
        ) : !match ? (
          <div className={styles.error}>Match introuvable</div>
        ) : (
          <div className={styles.matchDetails}>
            <div className={styles.matchHeader}>
              <div className={styles.matchInfo}>
                <div className={styles.matchInfoItem}>
                  <span className={styles.label}>Statut:</span>
                  <span className={`${styles.status} ${styles[match.status]}`}>
                    {getMatchStatus(match.status)}
                  </span>
                </div>
                <div className={styles.matchInfoItem}>
                  <span className={styles.label}>Aire:</span>
                  <span>
                    {match.areaNumber || match.area?.areaNumber || "N/A"}
                  </span>
                </div>
                <div className={styles.matchInfoItem}>
                  <span className={styles.label}>Heure prévue:</span>
                  <span>{formatTime(match.startTime)}</span>
                </div>
                {match.endTime && (
                  <div className={styles.matchInfoItem}>
                    <span className={styles.label}>Heure de fin:</span>
                    <span>{formatTime(match.endTime)}</span>
                  </div>
                )}
                <div className={styles.matchInfoItem}>
                  <span className={styles.label}>Date:</span>
                  <span>{formatDate(match.startTime)}</span>
                </div>
              </div>
            </div>

            <div className={styles.participants}>
              {match.matchParticipants?.map((mp) => {
                const isWinner = match.winner === mp.participantId;
                return (
                  <div
                    key={mp.id}
                    className={`${styles.participant} ${getPositionColor(
                      mp.position
                    )} ${isWinner ? styles.winner : ""}`}
                  >
                    <div className={styles.position}>
                      Position {mp.position}
                    </div>
                    <div className={styles.participantName}>
                      {getParticipantName(mp.participant)}
                    </div>
                    {mp.participant && (
                      <div className={styles.participantDetails}>
                        <div>
                          <span className={styles.label}>Ligue:</span>{" "}
                          {mp.participant.ligue || "N/A"}
                        </div>
                        <div>
                          <span className={styles.label}>Âge:</span>{" "}
                          {mp.participant.age || "N/A"}
                        </div>
                        <div>
                          <span className={styles.label}>Poids:</span>{" "}
                          {mp.participant.poids
                            ? `${mp.participant.poids} kg`
                            : "N/A"}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {match.status === "completed" && (
              <div className={styles.results}>
                <h2>Résultats</h2>
                <div className={styles.rounds}>
                  {match.rounds?.map((round, index) => (
                    <div key={index} className={styles.round}>
                      <div className={styles.roundHeader}>
                        <span className={styles.roundNumber}>
                          Round {round.roundNumber}
                        </span>
                        <span
                          className={`${styles.roundWinner} ${getPositionColor(
                            round.winnerPosition
                          )}`}
                        >
                          Vainqueur: {round.winnerPosition}
                        </span>
                      </div>
                      <div className={styles.score}>
                        <div
                          className={`${styles.scoreA} ${
                            round.winnerPosition === "A" ? styles.winner : ""
                          }`}
                        >
                          {round.scoreA}
                        </div>
                        <div className={styles.scoreSeparator}>-</div>
                        <div
                          className={`${styles.scoreB} ${
                            round.winnerPosition === "B" ? styles.winner : ""
                          }`}
                        >
                          {round.scoreB}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className={styles.matchResult}>
                  <h3>Résultat Final</h3>
                  <div className={styles.winnerInfo}>
                    <span className={styles.label}>Vainqueur:</span>
                    <span
                      className={`${styles.winnerName} ${getPositionColor(
                        match.winnerPosition
                      )}`}
                    >
                      {match.winnerParticipant
                        ? getParticipantName(match.winnerParticipant)
                        : "Inconnu"}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className={styles.footer}>
        <p>Taekwondo Tournament Manager - Vue Spectateur</p>
      </footer>
    </div>
  );
}
