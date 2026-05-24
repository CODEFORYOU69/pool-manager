import React, { useEffect, useRef, useState } from "react";
import {
  API_URL,
  moveMatchToArea,
  getNextMatchNumber,
} from "../services/dbService";
import "../styles/MatchMover.css";

/**
 * Petit panneau pour déplacer un combat d'une aire à une autre.
 * - L'utilisateur tape un numéro de combat → l'app cherche le match dans la
 *   compétition et affiche un récap.
 * - Une dropdown choisit l'aire cible.
 * - Le bouton "Déplacer" ouvre une modale de confirmation qui montre le futur
 *   matchNumber, puis applique via l'endpoint backend.
 *
 * Props :
 *  - competitionId
 *  - numAreas
 *  - onMoved : callback après déplacement (pour rafraîchir la liste)
 */
const MatchMover = ({ competitionId, numAreas, onMoved }) => {
  const [inputNumber, setInputNumber] = useState("");
  const [foundMatch, setFoundMatch] = useState(null); // null | "loading" | "notfound" | match
  const [targetArea, setTargetArea] = useState("");
  const [previewNumber, setPreviewNumber] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [moving, setMoving] = useState(false);
  const debounceRef = useRef(null);

  // Recherche debounced du combat
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!inputNumber || !competitionId) {
      setFoundMatch(null);
      return;
    }
    const n = parseInt(inputNumber, 10);
    if (isNaN(n)) {
      setFoundMatch(null);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setFoundMatch("loading");
      try {
        const res = await fetch(
          `${API_URL}/match/byNumber/${competitionId}/${n}`
        );
        if (!res.ok) {
          setFoundMatch("notfound");
          return;
        }
        const m = await res.json();
        setFoundMatch(m);
      } catch (_) {
        setFoundMatch("notfound");
      }
    }, 300);
    return () => debounceRef.current && clearTimeout(debounceRef.current);
  }, [inputNumber, competitionId]);

  const currentAreaNumber = foundMatch?.area?.areaNumber;

  // Pré-calcul du futur matchNumber quand target change
  useEffect(() => {
    if (!targetArea || !competitionId) {
      setPreviewNumber(null);
      return;
    }
    const num = parseInt(targetArea, 10);
    if (isNaN(num)) return;
    getNextMatchNumber(competitionId, num)
      .then((r) => setPreviewNumber(r.nextMatchNumber))
      .catch(() => setPreviewNumber(null));
  }, [targetArea, competitionId]);

  const openConfirm = () => {
    if (!foundMatch || typeof foundMatch === "string") return;
    if (!targetArea) return;
    setConfirmOpen(true);
  };

  const confirmMove = async () => {
    setMoving(true);
    try {
      const result = await moveMatchToArea(foundMatch.id, parseInt(targetArea, 10));
      setConfirmOpen(false);
      setInputNumber("");
      setFoundMatch(null);
      setTargetArea("");
      setPreviewNumber(null);
      if (typeof onMoved === "function") {
        onMoved(result);
      }
    } catch (err) {
      alert(`Erreur lors du déplacement : ${err.message}`);
    } finally {
      setMoving(false);
    }
  };

  const fighterName = (mp) =>
    mp && mp.participant
      ? `${mp.participant.prenom} ${mp.participant.nom}`
      : "?";

  const matchIsValid = foundMatch && typeof foundMatch !== "string";
  const blockedStatus =
    matchIsValid &&
    (foundMatch.status === "running" || foundMatch.status === "completed");

  const areaOptions = [];
  for (let i = 1; i <= numAreas; i++) {
    if (i === currentAreaNumber) continue;
    areaOptions.push(i);
  }

  return (
    <div className="match-mover">
      <div className="match-mover-row">
        <label>Déplacer un combat :</label>
        <input
          type="number"
          placeholder="N° combat"
          value={inputNumber}
          onChange={(e) => setInputNumber(e.target.value)}
          min={1}
        />
        <select
          value={targetArea}
          onChange={(e) => setTargetArea(e.target.value)}
          disabled={!matchIsValid || blockedStatus}
        >
          <option value="">Aire cible…</option>
          {areaOptions.map((n) => (
            <option key={n} value={n}>
              Aire {n}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={openConfirm}
          disabled={!matchIsValid || blockedStatus || !targetArea}
        >
          Déplacer
        </button>
      </div>

      {foundMatch === "loading" && (
        <div className="match-mover-info muted">Recherche…</div>
      )}
      {foundMatch === "notfound" && (
        <div className="match-mover-info error">
          Combat introuvable pour cette compétition.
        </div>
      )}
      {matchIsValid && (
        <div className="match-mover-info">
          <strong>Combat {foundMatch.matchNumber}</strong> —{" "}
          {fighterName(
            foundMatch.matchParticipants?.find((p) => p.position === "A")
          )}{" "}
          vs{" "}
          {fighterName(
            foundMatch.matchParticipants?.find((p) => p.position === "B")
          )}
          {" · "}
          Aire {currentAreaNumber} · Statut {foundMatch.status}
          {blockedStatus && (
            <span className="badge-blocked"> Déplacement impossible</span>
          )}
        </div>
      )}

      {confirmOpen && matchIsValid && (
        <div
          className="match-mover-backdrop"
          onClick={() => !moving && setConfirmOpen(false)}
        >
          <div
            className="match-mover-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Confirmer le déplacement</h3>
            <p>
              <strong>De</strong> : Aire {currentAreaNumber} (n°{" "}
              {foundMatch.matchNumber})
            </p>
            <p>
              <strong>Vers</strong> : Aire {targetArea} — nouveau n°{" "}
              {previewNumber ?? "…"} (premier libre)
            </p>
            <p className="muted">
              Combattants :{" "}
              {fighterName(
                foundMatch.matchParticipants?.find((p) => p.position === "A")
              )}{" "}
              vs{" "}
              {fighterName(
                foundMatch.matchParticipants?.find((p) => p.position === "B")
              )}
            </p>
            <div className="match-mover-actions">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={moving}
              >
                Annuler
              </button>
              <button
                type="button"
                className="primary"
                onClick={confirmMove}
                disabled={moving}
              >
                {moving ? "Déplacement…" : "Confirmer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MatchMover;
