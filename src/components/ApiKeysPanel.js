import React, { useEffect, useState } from "react";
import { API_URL } from "../services/dbService";
import "../styles/ApiKeysPanel.css";

const ApiKeysPanel = ({ competition, onClose }) => {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newKeyName, setNewKeyName] = useState("");
  const [creating, setCreating] = useState(false);
  const [revealedKey, setRevealedKey] = useState(null); // affiché une seule fois
  const [lanIps, setLanIps] = useState([]);
  const [lanPort, setLanPort] = useState(3001);
  const [selectedHost, setSelectedHost] = useState("");
  const [mdnsHost, setMdnsHost] = useState("");
  const [testStatus, setTestStatus] = useState(null); // null | "testing" | "ok" | "ko"
  const [testError, setTestError] = useState("");

  useEffect(() => {
    loadKeys();
    loadLanIps();
  }, [competition.id]);

  const loadLanIps = async () => {
    try {
      const res = await fetch(`${API_URL}/network/lan-ips`);
      if (!res.ok) return;
      const data = await res.json();
      setLanIps(data.ips || []);
      setLanPort(data.port || 3001);
      setMdnsHost(data.hostname || "");
      // Priorité par défaut : hostname .local s'il existe (marche en wifi ET
      // en cable direct), sinon première IP triée.
      if (data.hostname) {
        setSelectedHost(data.hostname);
      } else if (data.ips && data.ips.length > 0) {
        setSelectedHost(data.ips[0].address);
      }
    } catch (_) {
      // silencieux : l'utilisateur peut copier l'URL générique
    }
  };

  const loadKeys = async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `${API_URL}/competition/${competition.id}/apiKeys`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setKeys(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_URL}/competition/${competition.id}/apiKey`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newKeyName.trim() || null }),
        }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRevealedKey(data); // afficher le secret une seule fois
      setNewKeyName("");
      loadKeys();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id) => {
    if (!window.confirm("Révoquer cette clé ? FightandCo ne pourra plus l'utiliser."))
      return;
    try {
      await fetch(`${API_URL}/apiKey/${id}`, { method: "DELETE" });
      loadKeys();
    } catch (err) {
      setError(err.message);
    }
  };

  const copy = (text) => {
    navigator.clipboard.writeText(text).catch(() => {});
  };

  const testEndpoint = async () => {
    setTestStatus("testing");
    setTestError("");
    try {
      const url = `http://${host}:${lanPort}/api/health`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const r = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      if (data.status !== "ok") throw new Error("Réponse inattendue");
      setTestStatus("ok");
    } catch (err) {
      setTestStatus("ko");
      setTestError(err.name === "AbortError" ? "Timeout (4s)" : err.message);
    }
  };

  const host = selectedHost || "localhost";
  const endpointUrl = `http://${host}:${lanPort}/api/live/results`;

  return (
    <div className="api-keys-modal-backdrop" onClick={onClose}>
      <div className="api-keys-modal" onClick={(e) => e.stopPropagation()}>
        <div className="api-keys-header">
          <h2>Clés API · {competition.name}</h2>
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="endpoint-info">
          {(mdnsHost || lanIps.length > 0) && (
            <div className="endpoint-row">
              <label>Hôte :</label>
              <select
                value={selectedHost}
                onChange={(e) => {
                  setSelectedHost(e.target.value);
                  setTestStatus(null);
                }}
              >
                {mdnsHost && (
                  <option value={mdnsHost}>
                    {mdnsHost} (Bonjour — recommandé)
                  </option>
                )}
                {lanIps.map((i) => (
                  <option key={i.address} value={i.address}>
                    {i.interface} — {i.address}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="endpoint-row">
            <label>URL endpoint :</label>
            <code>{endpointUrl}</code>
            <button
              type="button"
              className="copy-btn"
              onClick={() => copy(endpointUrl)}
            >
              Copier
            </button>
            <button
              type="button"
              className="copy-btn"
              onClick={testEndpoint}
              disabled={testStatus === "testing"}
            >
              {testStatus === "testing" ? "Test…" : "Tester"}
            </button>
            {testStatus === "ok" && (
              <span className="test-badge ok">✓ Joignable</span>
            )}
            {testStatus === "ko" && (
              <span className="test-badge ko" title={testError}>
                ✗ Échec ({testError})
              </span>
            )}
          </div>
          <p className="endpoint-help">
            La console PSS doit être sur le même réseau local. Elle POSTera les
            résultats finaux ici avec le header{" "}
            <code>X-API-Key: &lt;clé&gt;</code>.
            {lanIps.length === 0 && (
              <>
                {" "}
                <strong>Aucune IP LAN détectée</strong> — vérifie ta connexion
                réseau.
              </>
            )}
          </p>
        </div>

        {revealedKey && (
          <div className="revealed-key-box">
            <strong>⚠️ Copie cette clé maintenant — elle ne sera plus affichée.</strong>
            <div className="revealed-key-row">
              <code>{revealedKey.key}</code>
              <button
                type="button"
                className="copy-btn primary"
                onClick={() => copy(revealedKey.key)}
              >
                Copier la clé
              </button>
            </div>
            <button
              type="button"
              className="dismiss-btn"
              onClick={() => setRevealedKey(null)}
            >
              J'ai copié, masquer
            </button>
          </div>
        )}

        <form className="create-key-form" onSubmit={handleCreate}>
          <input
            type="text"
            placeholder="Nom (optionnel) — ex: FightandCo prod"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
          />
          <button type="submit" disabled={creating}>
            {creating ? "Création…" : "Générer une clé"}
          </button>
        </form>

        {error && <div className="error-msg">{error}</div>}

        <div className="keys-list">
          {loading ? (
            <p>Chargement…</p>
          ) : keys.length === 0 ? (
            <p className="empty">Aucune clé active.</p>
          ) : (
            <table className="keys-table">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Aperçu</th>
                  <th>Créée</th>
                  <th>Expire</th>
                  <th>Dernière utilisation</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k.id}>
                    <td>{k.name || "—"}</td>
                    <td>
                      <code>{k.keyPreview}</code>
                    </td>
                    <td>{new Date(k.createdAt).toLocaleDateString("fr-FR")}</td>
                    <td>{new Date(k.expiresAt).toLocaleDateString("fr-FR")}</td>
                    <td>
                      {k.lastUsedAt
                        ? new Date(k.lastUsedAt).toLocaleString("fr-FR")
                        : "Jamais"}
                    </td>
                    <td>
                      <button
                        className="revoke-btn"
                        onClick={() => handleRevoke(k.id)}
                      >
                        Révoquer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default ApiKeysPanel;
