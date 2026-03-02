import React, { useState, useEffect } from "react";
import "../styles/ParticipantModal.css";

const ParticipantModal = ({ isOpen, onClose, onSave, participant }) => {
  const [form, setForm] = useState({
    nom: "",
    prenom: "",
    sexe: "M",
    age: "",
    poids: "",
    ligue: "",
    club: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (participant) {
      setForm({
        nom: participant.nom || "",
        prenom: participant.prenom || "",
        sexe: participant.sexe || "M",
        age: participant.age || "",
        poids: participant.poids || "",
        ligue: participant.ligue || "",
        club: participant.club || "",
      });
    } else {
      setForm({ nom: "", prenom: "", sexe: "M", age: "", poids: "", ligue: "", club: "" });
    }
  }, [participant, isOpen]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nom || !form.prenom || !form.age || !form.poids) return;
    setSaving(true);
    try {
      await onSave({
        ...form,
        age: parseInt(form.age, 10),
        poids: parseFloat(form.poids),
      });
      onClose();
    } catch (err) {
      alert(`Erreur : ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const isEdit = !!participant;

  return (
    <div className="participant-modal-overlay" onClick={onClose}>
      <div className="participant-modal-card" onClick={(e) => e.stopPropagation()}>
        <h3>{isEdit ? "Modifier l'athlete" : "Ajouter un athlete"}</h3>
        <form onSubmit={handleSubmit}>
          <div className="pm-form-row">
            <div className="pm-field">
              <label>Nom *</label>
              <input name="nom" value={form.nom} onChange={handleChange} required />
            </div>
            <div className="pm-field">
              <label>Prenom *</label>
              <input name="prenom" value={form.prenom} onChange={handleChange} required />
            </div>
          </div>
          <div className="pm-form-row">
            <div className="pm-field">
              <label>Sexe *</label>
              <select name="sexe" value={form.sexe} onChange={handleChange}>
                <option value="M">Masculin</option>
                <option value="F">Feminin</option>
              </select>
            </div>
            <div className="pm-field">
              <label>Age *</label>
              <input name="age" type="number" min="1" value={form.age} onChange={handleChange} required />
            </div>
            <div className="pm-field">
              <label>Poids (kg) *</label>
              <input name="poids" type="number" step="0.1" min="0" value={form.poids} onChange={handleChange} required />
            </div>
          </div>
          <div className="pm-form-row">
            <div className="pm-field">
              <label>Ligue</label>
              <input name="ligue" value={form.ligue} onChange={handleChange} />
            </div>
            <div className="pm-field">
              <label>Club</label>
              <input name="club" value={form.club} onChange={handleChange} />
            </div>
          </div>
          <div className="pm-actions">
            <button type="button" className="pm-cancel-btn" onClick={onClose}>
              Annuler
            </button>
            <button type="submit" className="pm-save-btn" disabled={saving}>
              {saving ? "Enregistrement..." : isEdit ? "Modifier" : "Ajouter"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ParticipantModal;
