import React, { useState } from "react";
import { useCompetition } from "../context/CompetitionContext";
import { saveGroupsAndPools, saveParticipants } from "../services/dbService";
import "../styles/TournamentSetup.css";
import { createGroups } from "../utils/groupManager";

// Import des constantes de catégories
import {
  AGE_CATEGORIES,
  KYORUGI_CATEGORIES,
  OLYMPIC_CATEGORIES,
  PARA_CATEGORIES,
} from "../utils/categories";

const TournamentSetup = ({
  participants,
  setTournamentConfig,
  nextStep,
  prevStep,
}) => {
  const { competitionName, setCompetitionName, initializeCompetition } =
    useCompetition();
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Définition des catégories d'âge basées sur les constantes
  const generateAgeCategories = () => {
    return [
      { min: 4, max: 5, name: "Baby" },
      { min: 6, max: 7, name: "Pupille" },
      { min: 8, max: 9, name: "Benjamin" },
      { min: 10, max: 11, name: "Minime" },
      { min: 12, max: 14, name: "Cadet" },
      { min: 15, max: 17, name: "Junior" },
      { min: 18, max: 21, name: "Espoir" },
      { min: 18, max: 30, name: "Senior" },
      { min: 31, max: 99, name: "Master" },
    ];
  };

  // Convertir les catégories de poids du format "-58kg" ou du format objet avec propriété name
  const convertWeightCategories = (categoriesArray) => {
    return categoriesArray.map((category) => {
      // Si category est déjà un objet avec une propriété 'name'
      if (typeof category === "object" && category.name) {
        return {
          max: category.name.startsWith("+")
            ? 999
            : parseInt(category.name.replace(/[^0-9]/g, ""), 10),
          name: category.name,
          pss: category.pss || null,
          hitLevel: category.hitLevel || null,
        };
      }

      // Sinon, c'est une chaîne (ancien format)
      const isPlus = category.startsWith("+");
      const weight = parseInt(category.replace(/[^0-9]/g, ""), 10);

      return {
        max: isPlus ? 999 : weight,
        name: category,
      };
    });
  };

  // Générer les catégories de poids pour hommes et femmes
  const generateWeightCategories = () => {
    const maleCategories = {};
    const femaleCategories = {};

    // Ajouter toutes les catégories pour chaque tranche d'âge
    Object.keys(AGE_CATEGORIES).forEach((ageKey) => {
      if (KYORUGI_CATEGORIES.MALE[ageKey]) {
        maleCategories[ageKey] = convertWeightCategories(
          KYORUGI_CATEGORIES.MALE[ageKey]
        );
      }
      if (KYORUGI_CATEGORIES.FEMALE[ageKey]) {
        femaleCategories[ageKey] = convertWeightCategories(
          KYORUGI_CATEGORIES.FEMALE[ageKey]
        );
      }
    });

    return {
      male: maleCategories.MINIME || [], // Par défaut, on utilise les catégories Minime
      female: femaleCategories.MINIME || [],
    };
  };

  // États pour le type de catégories et l'âge sélectionnés
  const [categoryType, setCategoryType] = useState("KYORUGI");
  const [selectedMaleAge, setSelectedMaleAge] = useState("MINIME");
  const [selectedFemaleAge, setSelectedFemaleAge] = useState("MINIME");

  // État initial de la configuration
  const [config, setConfig] = useState({
    name: "France Minime",
    date: new Date(),
    startTime: (() => {
      const defaultTime = new Date();
      defaultTime.setHours(8, 30, 0, 0); // 8h30
      return defaultTime;
    })(),
    roundDuration: 60, // 1 minute
    breakDuration: 30, // 30 secondes
    breakFrequency: 30, // Pause tous les 30 combats
    numberOfAreas: 6, // 6 aires de combat
    poolSize: 4, // Taille par défaut des poules
    ageCategories: generateAgeCategories(),
    weightCategories: generateWeightCategories(),
  });

  // Convertir les secondes en format minutes:secondes pour l'affichage
  const secondsToMinSec = (totalSeconds) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return { minutes, seconds };
  };

  // Convertir minutes:secondes en total de secondes
  const minSecToSeconds = (minutes, seconds) => {
    return parseInt(minutes, 10) * 60 + parseInt(seconds, 10);
  };

  // Mise à jour de la fonction de gestion des changements pour les durées
  const handleTimeChange = (field, type, value) => {
    const currentTime = secondsToMinSec(config[field]);
    let newTime;

    if (type === "minutes") {
      newTime = minSecToSeconds(value, currentTime.seconds);
    } else {
      newTime = minSecToSeconds(currentTime.minutes, value);
    }

    setConfig({
      ...config,
      [field]: newTime,
    });
  };

  // Ensuite ajoutez cette fonction pour gérer le changement d'heure
  const handleStartTimeChange = (e) => {
    const [hours, minutes] = e.target.value.split(":").map(Number);
    const newStartTime = new Date(config.startTime);
    newStartTime.setHours(hours, minutes, 0, 0);

    setConfig({
      ...config,
      startTime: newStartTime,
    });
  };

  // Mise à jour des catégories de poids lorsque le type de catégorie change
  const updateWeightCategoriesByType = (type, maleAge, femaleAge) => {
    let categories = {};

    switch (type) {
      case "OLYMPIC":
        categories = {
          male: convertWeightCategories(OLYMPIC_CATEGORIES.MALE[maleAge] || []),
          female: convertWeightCategories(
            OLYMPIC_CATEGORIES.FEMALE[femaleAge] || []
          ),
        };
        break;
      case "PARA":
        categories = {
          male: convertWeightCategories(PARA_CATEGORIES.MALE.K44_K41 || []),
          female: convertWeightCategories(PARA_CATEGORIES.FEMALE.K44_K41 || []),
        };
        break;
      case "KYORUGI":
      default:
        categories = {
          male: convertWeightCategories(KYORUGI_CATEGORIES.MALE[maleAge] || []),
          female: convertWeightCategories(
            KYORUGI_CATEGORIES.FEMALE[femaleAge] || []
          ),
        };
        break;
    }

    setConfig({
      ...config,
      weightCategories: categories,
    });
  };

  // Gestion du changement de type de catégories
  const handleCategoryTypeChange = (e) => {
    const newType = e.target.value;
    setCategoryType(newType);
    updateWeightCategoriesByType(newType, selectedMaleAge, selectedFemaleAge);
  };

  // Gestion du changement de catégorie d'âge pour les poids
  const handleAgeWeightCategoryChange = (gender, e) => {
    const newAge = e.target.value;

    if (gender === "male") {
      setSelectedMaleAge(newAge);
      updateWeightCategoriesByType(categoryType, newAge, selectedFemaleAge);
    } else {
      setSelectedFemaleAge(newAge);
      updateWeightCategoriesByType(categoryType, selectedMaleAge, newAge);
    }
  };

  // Gestion des changements de formulaire
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setConfig({
      ...config,
      [name]: parseInt(value, 10),
    });
  };

  // Ajouter une catégorie d'âge
  const addAgeCategory = () => {
    setConfig({
      ...config,
      ageCategories: [
        ...config.ageCategories,
        { min: 0, max: 0, name: "Nouvelle catégorie" },
      ],
    });
  };

  // Modifier une catégorie d'âge
  const updateAgeCategory = (index, field, value) => {
    const newCategories = [...config.ageCategories];
    newCategories[index] = {
      ...newCategories[index],
      [field]: field === "name" ? value : parseInt(value, 10),
    };
    setConfig({
      ...config,
      ageCategories: newCategories,
    });
  };

  // Supprimer une catégorie d'âge
  const deleteAgeCategory = (index) => {
    const newCategories = [...config.ageCategories];
    newCategories.splice(index, 1);
    setConfig({
      ...config,
      ageCategories: newCategories,
    });
  };

  // Ajouter une catégorie de poids
  const addWeightCategory = (gender) => {
    setConfig({
      ...config,
      weightCategories: {
        ...config.weightCategories,
        [gender]: [
          ...config.weightCategories[gender],
          { max: 0, name: "Nouvelle catégorie" },
        ],
      },
    });
  };

  // Modifier une catégorie de poids
  const updateWeightCategory = (gender, index, field, value) => {
    const newCategories = [...config.weightCategories[gender]];
    newCategories[index] = {
      ...newCategories[index],
      [field]: field === "name" ? value : parseInt(value, 10),
    };
    setConfig({
      ...config,
      weightCategories: {
        ...config.weightCategories,
        [gender]: newCategories,
      },
    });
  };

  // Supprimer une catégorie de poids
  const deleteWeightCategory = (gender, index) => {
    const newCategories = [...config.weightCategories[gender]];
    newCategories.splice(index, 1);
    setConfig({
      ...config,
      weightCategories: {
        ...config.weightCategories,
        [gender]: newCategories,
      },
    });
  };

  // Sauvegarder la configuration
  const handleSaveConfiguration = async () => {
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      // S'assurer que poolSize est correctement inclus dans la configuration
      const configToSave = {
        ...config,
        name: competitionName,
      };

      const savedCompetitionId = await initializeCompetition(configToSave);
      console.log("Configuration sauvegardée avec ID:", savedCompetitionId);

      setSaveSuccess(true);
      // Masquer le message de succès après 3 secondes
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error("Erreur lors de la sauvegarde de la configuration:", error);
      alert(
        "Erreur lors de la sauvegarde de la configuration. Veuillez réessayer."
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Valider et passer à l'étape suivante
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      // Mettre à jour la configuration globale
      setTournamentConfig({
        ...config,
        stats: {
          totalParticipants: participants.length,
          maleCount: participants.filter((p) => p.sexe === "male").length,
          femaleCount: participants.filter((p) => p.sexe === "female").length,
        },
      });

      // Préparer la configuration
      const configToSave = {
        startTime: config.startTime,
        roundDuration: config.roundDuration,
        breakDuration: config.breakDuration,
        breakFrequency: config.breakFrequency,
        poolSize: config.poolSize,
        numAreas: config.numberOfAreas,
        name: competitionName,
      };

      console.log("Configuration à sauvegarder:", configToSave);

      // Initialiser la compétition et obtenir l'ID
      const savedCompetitionId = await initializeCompetition(configToSave);
      console.log("ID de la compétition sauvegardée:", savedCompetitionId);

      // Sauvegarder les participants
      console.log("Sauvegarde des participants...");
      const savedParticipants = await saveParticipants(
        savedCompetitionId,
        participants
      );
      console.log("Participants sauvegardés:", savedParticipants.length);

      // Créer les groupes avec les IDs des participants sauvegardés
      // MODIFICATION: Améliorer la correspondance en normalisant les chaînes

      // Fonction utilitaire pour normaliser les chaînes (supprimer les espaces superflus, mettre en minuscules, etc.)
      const normalizeString = (str) => {
        if (!str) return "";
        // Supprimer les espaces multiples, mettre en minuscules, supprimer les caractères spéciaux
        return str
          .trim()
          .toLowerCase()
          .replace(/\s+/g, " ") // Normaliser les espaces
          .normalize("NFD") // Normaliser les caractères accentués
          .replace(/[\u0300-\u036f]/g, ""); // Supprimer les diacritiques
      };

      // Créer différentes maps pour différentes stratégies de correspondance
      const exactMap = new Map();
      const normalizedMap = new Map();
      const nameMap = new Map();
      const lastNameMap = new Map();

      savedParticipants.forEach((p) => {
        // Clé exacte (comme avant)
        exactMap.set(`${p.nom}-${p.prenom}-${p.poids}`, p.id);

        // Clé normalisée (sans espaces superflus, insensible à la casse)
        const normKey = `${normalizeString(p.nom)}-${normalizeString(
          p.prenom
        )}-${p.poids}`;
        normalizedMap.set(normKey, p.id);

        // Clé basée sur le nom complet (pourrait avoir des doublons)
        const nameKey = `${normalizeString(p.nom)}-${normalizeString(
          p.prenom
        )}`;
        nameMap.set(nameKey, p.id);

        // Clé basée sur le nom de famille (secours)
        const lastNameKey = `${normalizeString(p.nom)}`;
        lastNameMap.set(lastNameKey, p.id);
      });

      const participantsWithIds = participants.map((p) => {
        // Stratégie 1: Essayer avec une clé exacte (ancien système)
        let id = exactMap.get(`${p.nom}-${p.prenom}-${p.poids}`);

        // Stratégie 2: Si pas trouvé, essayer avec une clé normalisée
        if (!id) {
          const normKey = `${normalizeString(p.nom)}-${normalizeString(
            p.prenom
          )}-${p.poids}`;
          id = normalizedMap.get(normKey);
        }

        // Stratégie 3: Si toujours pas trouvé, essayer juste avec le nom (ignorer le poids)
        if (!id) {
          const nameKey = `${normalizeString(p.nom)}-${normalizeString(
            p.prenom
          )}`;
          id = nameMap.get(nameKey);
        }

        // Stratégie 4: En dernier recours, essayer juste avec le nom de famille
        if (!id) {
          const lastNameKey = `${normalizeString(p.nom)}`;
          id = lastNameMap.get(lastNameKey);
        }

        if (!id) {
          console.error(
            `Impossible de trouver l'ID pour le participant: ${p.nom} ${p.prenom} (Poids: ${p.poids})`
          );
        }

        return {
          ...p,
          id: id,
        };
      });

      // Afficher un résumé des correspondances
      const withIds = participantsWithIds.filter((p) => p.id).length;
      const withoutIds = participantsWithIds.filter((p) => !p.id).length;
      console.log(
        `Correspondance des IDs: ${withIds} trouvés, ${withoutIds} non trouvés sur ${participantsWithIds.length} total`
      );

      // S'assurer que poolSize est correctement passé aux fonctions de création de groupes
      const configWithPoolSize = {
        ...config,
        poolSize: config.poolSize, // Utiliser 4 comme valeur par défaut si non défini
      };

      // Créer les groupes avec les participants ayant des IDs
      const { groups, stats } = createGroups(
        participantsWithIds,
        configWithPoolSize
      );
      console.log("Groupes créés:", groups);
      console.log("Statistiques des groupes:", stats);

      // Sauvegarder les groupes
      await saveGroupsAndPools(savedCompetitionId, groups);
      console.log("Groupes sauvegardés avec succès");

      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        nextStep();
      }, 1500);
    } catch (error) {
      console.error("Erreur détaillée lors de la sauvegarde:", error);
      let errorMessage = "Erreur lors de la sauvegarde de la configuration.";

      if (error.message) {
        errorMessage += `\nDétails: ${error.message}`;
      }

      if (error.response?.data?.message) {
        errorMessage += `\nMessage serveur: ${error.response.data.message}`;
      }

      alert(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="tournament-setup-container">
      <h2>Étape 2: Configuration de la compétition</h2>

      <div className="participants-summary">
        <h3>Résumé des participants</h3>
        <p>Nombre total: {participants.length}</p>
        <p>
          Hommes:{" "}
          {
            participants.filter(
              (p) =>
                p.sexe.toLowerCase() === "homme" ||
                p.sexe.toLowerCase() === "h" ||
                p.sexe.toLowerCase() === "m"
            ).length
          }
        </p>
        <p>
          Femmes:{" "}
          {
            participants.filter(
              (p) =>
                p.sexe.toLowerCase() === "femme" || p.sexe.toLowerCase() === "f"
            ).length
          }
        </p>
        <p>
          Nombre de ligues:{" "}
          {[...new Set(participants.map((p) => p.ligue))].length}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="tournament-form">
        <div className="form-section">
          <h3>Informations de la compétition</h3>
          <div className="form-group">
            <label htmlFor="competitionName">Nom de la compétition:</label>
            <input
              type="text"
              id="competitionName"
              value={competitionName}
              onChange={(e) => setCompetitionName(e.target.value)}
              required
            />
          </div>

          <h3>Paramètres généraux</h3>

          <div className="form-group">
            <label htmlFor="numberOfAreas">Nombre d'aires de combat:</label>
            <input
              type="number"
              id="numberOfAreas"
              name="numberOfAreas"
              min="1"
              value={config.numberOfAreas}
              onChange={handleInputChange}
              required
            />
          </div>

          {/* Remplacer les inputs de durée existants par ces nouveaux contrôles */}

          <div className="form-group">
            <label htmlFor="roundDuration">Durée des rounds:</label>
            <div className="time-input">
              <input
                type="number"
                id="roundDuration-min"
                min="0"
                value={secondsToMinSec(config.roundDuration).minutes}
                onChange={(e) =>
                  handleTimeChange("roundDuration", "minutes", e.target.value)
                }
                required
              />
              <span>min</span>
              <select
                id="roundDuration-sec"
                value={secondsToMinSec(config.roundDuration).seconds}
                onChange={(e) =>
                  handleTimeChange("roundDuration", "seconds", e.target.value)
                }
              >
                <option value="0">0</option>
                <option value="30">30</option>
              </select>
              <span>sec</span>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="breakDuration">Durée des pauses:</label>
            <div className="time-input">
              <input
                type="number"
                id="breakDuration-min"
                min="0"
                value={secondsToMinSec(config.breakDuration).minutes}
                onChange={(e) =>
                  handleTimeChange("breakDuration", "minutes", e.target.value)
                }
                required
              />
              <span>min</span>
              <select
                id="breakDuration-sec"
                value={secondsToMinSec(config.breakDuration).seconds}
                onChange={(e) =>
                  handleTimeChange("breakDuration", "seconds", e.target.value)
                }
              >
                <option value="0">0</option>
                <option value="30">30</option>
              </select>
              <span>sec</span>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="breakFrequency">
              Fréquence des pauses (après combien de combats):
            </label>
            <input
              type="number"
              id="breakFrequency"
              name="breakFrequency"
              min="1"
              value={config.breakFrequency}
              onChange={handleInputChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="poolSize">Taille des poules:</label>
            <input
              type="number"
              id="poolSize"
              name="poolSize"
              min="3"
              max="8"
              value={config.poolSize}
              onChange={handleInputChange}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="startTime">Heure de début de la compétition:</label>
            <input
              type="time"
              id="startTime"
              value={`${config.startTime
                .getHours()
                .toString()
                .padStart(2, "0")}:${config.startTime
                .getMinutes()
                .toString()
                .padStart(2, "0")}`}
              onChange={handleStartTimeChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="categoryType">Type de compétition:</label>
            <select
              id="categoryType"
              value={categoryType}
              onChange={handleCategoryTypeChange}
            >
              <option value="KYORUGI">Kyorugi Standard</option>
              <option value="OLYMPIC">Catégories Olympiques</option>
              <option value="PARA">Para-Taekwondo</option>
            </select>
          </div>
        </div>

        <div className="action-buttons">
          <button
            type="button"
            className="save-btn"
            onClick={handleSaveConfiguration}
            disabled={isSaving}
          >
            {isSaving
              ? "Sauvegarde en cours..."
              : "Sauvegarder la configuration"}
          </button>

          {saveSuccess && (
            <div className="success-message">
              La configuration a été sauvegardée avec succès !
            </div>
          )}
        </div>

        <div className="form-section">
          <h3>Catégories d'âge</h3>

          <table className="categories-table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Âge minimum</th>
                <th>Âge maximum</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {config.ageCategories.map((category, index) => (
                <tr key={index}>
                  <td>
                    <input
                      type="text"
                      value={category.name}
                      onChange={(e) =>
                        updateAgeCategory(index, "name", e.target.value)
                      }
                      required
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      value={category.min}
                      onChange={(e) =>
                        updateAgeCategory(index, "min", e.target.value)
                      }
                      required
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      value={category.max}
                      onChange={(e) =>
                        updateAgeCategory(index, "max", e.target.value)
                      }
                      required
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="delete-btn"
                      onClick={() => deleteAgeCategory(index)}
                    >
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <button type="button" className="add-btn" onClick={addAgeCategory}>
            Ajouter une catégorie d'âge
          </button>
        </div>

        <div className="form-section">
          <h3>Catégories de poids - Hommes</h3>

          <div className="form-group">
            <label htmlFor="maleAgeCategory">Catégorie d'âge:</label>
            <select
              id="maleAgeCategory"
              value={selectedMaleAge}
              onChange={(e) => handleAgeWeightCategoryChange("male", e)}
            >
              {Object.keys(AGE_CATEGORIES).map((key) => (
                <option key={key} value={key}>
                  {AGE_CATEGORIES[key].name}
                </option>
              ))}
            </select>
          </div>

          <table className="categories-table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Poids maximum (kg)</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {config.weightCategories.male.map((category, index) => (
                <tr key={index}>
                  <td>
                    <input
                      type="text"
                      value={category.name}
                      onChange={(e) =>
                        updateWeightCategory(
                          "male",
                          index,
                          "name",
                          e.target.value
                        )
                      }
                      required
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      value={category.max}
                      onChange={(e) =>
                        updateWeightCategory(
                          "male",
                          index,
                          "max",
                          e.target.value
                        )
                      }
                      required
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="delete-btn"
                      onClick={() => deleteWeightCategory("male", index)}
                    >
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <button
            type="button"
            className="add-btn"
            onClick={() => addWeightCategory("male")}
          >
            Ajouter une catégorie de poids (Hommes)
          </button>
        </div>

        <div className="form-section">
          <h3>Catégories de poids - Femmes</h3>

          <div className="form-group">
            <label htmlFor="femaleAgeCategory">Catégorie d'âge:</label>
            <select
              id="femaleAgeCategory"
              value={selectedFemaleAge}
              onChange={(e) => handleAgeWeightCategoryChange("female", e)}
            >
              {Object.keys(AGE_CATEGORIES).map((key) => (
                <option key={key} value={key}>
                  {AGE_CATEGORIES[key].name}
                </option>
              ))}
            </select>
          </div>

          <table className="categories-table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Poids maximum (kg)</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {config.weightCategories.female.map((category, index) => (
                <tr key={index}>
                  <td>
                    <input
                      type="text"
                      value={category.name}
                      onChange={(e) =>
                        updateWeightCategory(
                          "female",
                          index,
                          "name",
                          e.target.value
                        )
                      }
                      required
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      value={category.max}
                      onChange={(e) =>
                        updateWeightCategory(
                          "female",
                          index,
                          "max",
                          e.target.value
                        )
                      }
                      required
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="delete-btn"
                      onClick={() => deleteWeightCategory("female", index)}
                    >
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <button
            type="button"
            className="add-btn"
            onClick={() => addWeightCategory("female")}
          >
            Ajouter une catégorie de poids (Femmes)
          </button>
        </div>
      </form>

      <div className="navigation-buttons">
        <button type="button" className="prev-btn" onClick={prevStep}>
          Précédent
        </button>
        <button
          type="button"
          className="next-btn"
          onClick={handleSubmit}
          disabled={isSaving}
        >
          {isSaving ? "Sauvegarde en cours..." : "Suivant"}
        </button>
      </div>
    </div>
  );
};

export default TournamentSetup;
