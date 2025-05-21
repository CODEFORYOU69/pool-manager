"use client";

import { Match } from "@/types";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { useEffect, useState } from "react";

// Interfaces étendues pour les propriétés additionnelles
interface ExtendedMatch extends Match {
  poolIndex?: number;
  participants?: ExtendedParticipant[];
}

interface ExtendedParticipant {
  id?: string;
  prenom?: string;
  nom?: string;
  gender?: string;
  sexe?: string;
  ageCategory?: string;
  categoryAgeAbbr?: string;
  weightCategory?: string;
  categoryWeightAbbr?: string;
  poids?: string;
  weight?: string;
  category?: string;
  club?: string;
  ligue?: string;
}

interface AllMatchesProps {
  matches: Match[];
  filters: {
    areaNumber: string;
    participantName: string;
    ligue: string;
    club: string;
    status: string;
  };
  formatTime: (dateString?: string) => string;
  getParticipantName: (match: Match, position: string) => string;
  competitionName?: string;
  competitionDate?: Date | null;
}

export default function AllMatches({
  matches,
  filters,
  formatTime,
  getParticipantName,
  competitionName = "Taekwondo Tournament Manager",
  competitionDate = null,
}: AllMatchesProps) {
  const [filteredMatches, setFilteredMatches] = useState<Match[]>([]);
  const [isExporting, setIsExporting] = useState(false);

  // Fonction pour récupérer les informations de catégorie
  const getCategoryInfo = (match: Match): string => {
    try {
      if (!match) return "";

      // Chercher les informations dans le premier participant
      const participant = match.matchParticipants?.[0]?.participant;

      if (!participant) return "";

      // Utiliser les interfaces étendues
      const extMatch = match as ExtendedMatch;
      const extParticipant = participant as ExtendedParticipant;

      // Récupérer les informations de genre, catégorie d'âge, poids et poule
      const gender = extParticipant.gender || extParticipant.sexe || "";
      const ageCategory =
        extParticipant.ageCategory || extParticipant.categoryAgeAbbr || "";

      // Amélioration pour la catégorie de poids - essayer plusieurs propriétés possibles
      const weightCategory =
        extParticipant.weightCategory ||
        extParticipant.categoryWeightAbbr ||
        extParticipant.poids ||
        extParticipant.weight ||
        (extParticipant.category && extParticipant.category.includes("kg")
          ? extParticipant.category
          : "") ||
        "";

      const poolIndex =
        extMatch.poolIndex !== undefined ? extMatch.poolIndex + 1 : "";

      // Déterminer le sexe abrégé
      const genderAbbr = String(gender).toLowerCase().startsWith("f")
        ? "F"
        : "M";

      // Formater la catégorie d'âge en abrégé
      let ageCatAbbr = "";
      if (ageCategory) {
        // Si déjà en abrégé, utiliser tel quel
        if (String(ageCategory).length <= 3) {
          ageCatAbbr = String(ageCategory).toLowerCase();
        } else {
          // Sinon utiliser les trois premières lettres
          ageCatAbbr = String(ageCategory).toLowerCase().substring(0, 3);
        }
      }

      // Ajouter un tiret devant le poids si ce n'est pas déjà le cas
      const formattedWeight =
        weightCategory &&
        !String(weightCategory).startsWith("-") &&
        !String(weightCategory).startsWith("+")
          ? `-${weightCategory}`
          : weightCategory;

      // Formater les informations dans le format souhaité
      return `${genderAbbr}-${ageCatAbbr} ${formattedWeight} P${poolIndex}`.trim();
    } catch (error) {
      console.error(
        "Erreur lors de l'accès aux informations de catégorie:",
        error
      );
      return "";
    }
  };

  // Appliquer les filtres quand ils changent
  useEffect(() => {
    if (!matches) return;

    let result = [...matches];

    // Filtrer par aire
    if (filters.areaNumber) {
      const areaNum = parseInt(filters.areaNumber);
      result = result.filter((match) => {
        let matchAreaNum = null;

        if (match.area && typeof match.area.areaNumber === "number") {
          matchAreaNum = match.area.areaNumber;
        } else if (typeof match.areaNumber === "number") {
          matchAreaNum = match.areaNumber;
        } else if (
          match.area &&
          typeof match.area.areaNumber === "string" &&
          !isNaN(parseInt(match.area.areaNumber))
        ) {
          matchAreaNum = parseInt(match.area.areaNumber);
        } else if (
          typeof match.areaNumber === "string" &&
          !isNaN(parseInt(match.areaNumber))
        ) {
          matchAreaNum = parseInt(match.areaNumber);
        } else {
          matchAreaNum = (match.matchNumber % 6) + 1;
        }

        // Assurer que l'aire est dans la plage valide (1-6)
        if (matchAreaNum < 1 || matchAreaNum > 6) {
          matchAreaNum = (matchAreaNum % 6) + 1;
        }

        return matchAreaNum === areaNum;
      });
    }

    // Filtrer par nom de participant
    if (filters.participantName) {
      const nameFilter = filters.participantName.toLowerCase();
      result = result.filter((match) => {
        return match.matchParticipants?.some((mp) => {
          const participant = mp.participant;
          if (!participant) return false;

          const fullName = `${participant.prenom || ""} ${
            participant.nom || ""
          }`.toLowerCase();
          return fullName.includes(nameFilter);
        });
      });
    }

    // Filtrer par ligue
    if (filters.ligue) {
      result = result.filter((match) => {
        return match.matchParticipants?.some((mp) => {
          const participant = mp.participant;
          if (!participant || !participant.ligue) return false;

          return participant.ligue === filters.ligue;
        });
      });
    }

    // Filtrer par club
    if (filters.club) {
      result = result.filter((match) => {
        return match.matchParticipants?.some((mp) => {
          const participant = mp.participant;
          if (!participant || !participant.club) return false;

          return participant.club === filters.club;
        });
      });
    }

    // Filtrer par statut
    if (filters.status) {
      result = result.filter((match) => match.status === filters.status);
    }

    // Trier les matchs par numéro
    result.sort((a, b) => a.matchNumber - b.matchNumber);

    setFilteredMatches(result);
  }, [matches, filters]);

  // Fonction pour exporter les matchs filtrés en PDF
  const exportToPdf = () => {
    try {
      // Indiquer que l'exportation est en cours
      setIsExporting(true);

      // Créer une nouvelle instance de jsPDF
      const doc = new jsPDF("landscape");

      // Ajouter le nom de la compétition
      doc.setFontSize(22);
      doc.setTextColor(20, 20, 20);
      doc.text(competitionName, doc.internal.pageSize.width / 2, 15, {
        align: "center",
      });

      // Ajouter la date de la compétition si disponible
      if (competitionDate) {
        doc.setFontSize(14);
        doc.setTextColor(60, 60, 60);
        const formattedDate = competitionDate.toLocaleDateString("fr-FR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });
        doc.text(formattedDate, doc.internal.pageSize.width / 2, 23, {
          align: "center",
        });
      }

      // Générer un titre pour le document
      const title = "Liste des matchs";
      const subtitle = generateSubtitle();

      // Ajouter un titre au document (légèrement plus bas pour accommoder le titre principal et la date)
      doc.setFontSize(18);
      doc.setTextColor(40, 40, 40);
      doc.text(
        title,
        doc.internal.pageSize.width / 2,
        competitionDate ? 32 : 25,
        { align: "center" }
      );

      // Ajouter un sous-titre avec les filtres appliqués
      doc.setFontSize(12);
      doc.setTextColor(80, 80, 80);
      doc.text(
        subtitle,
        doc.internal.pageSize.width / 2,
        competitionDate ? 42 : 35,
        {
          align: "center",
        }
      );

      // Ajouter la date et l'heure de génération
      const dateStr = new Date().toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      doc.setFontSize(10);
      doc.text(`Généré le ${dateStr}`, doc.internal.pageSize.width - 15, 10, {
        align: "right",
      });

      // Ajouter le nombre de matchs
      doc.text(`Total: ${filteredMatches.length} matchs`, 15, 10);

      // Préparer les données pour le tableau
      const data = filteredMatches.map((match) => {
        const participantA = match.matchParticipants?.find(
          (mp) => mp.position === "A"
        );
        const participantB = match.matchParticipants?.find(
          (mp) => mp.position === "B"
        );
        return [
          match.matchNumber,
          match.area?.areaNumber || match.areaNumber || "-",
          getCategoryInfo(match),
          getParticipantName(match, "A"),
          participantA?.participant?.club || "Inconnu",
          participantA?.participant?.ligue || "Inconnue",
          getParticipantName(match, "B"),
          participantB?.participant?.club || "Inconnu",
          participantB?.participant?.ligue || "Inconnue",
          getStatusText(match.status),
          match.status === "completed" && match.endTime
            ? `${formatTime(match.startTime)} → ${formatTime(match.endTime)}`
            : formatTime(match.startTime),
        ];
      });

      // Générer le tableau avec autoTable (ajusté pour commencer plus bas)
      autoTable(doc, {
        startY: competitionDate ? 52 : 45,
        head: [
          [
            "N° Match",
            "Aire",
            "Catégorie",
            "Bleu",
            "Club (Bleu)",
            "Ligue (Bleu)",
            "Rouge",
            "Club (Rouge)",
            "Ligue (Rouge)",
            "Statut",
            "Heure",
          ],
        ],
        body: data,
        theme: "striped",
        headStyles: {
          fillColor: [41, 128, 185],
          textColor: 255,
          fontStyle: "bold",
        },
        styles: {
          cellPadding: 3,
          fontSize: 10,
          valign: "middle",
        },
        columnStyles: {
          0: { fontStyle: "bold" }, // Numéro de match en gras
          2: { textColor: [41, 128, 185] }, // Bleu en bleu
          3: { textColor: [192, 57, 43] }, // Rouge en rouge
        },
      });

      // Nom du fichier basé sur les filtres
      const fileName = generateFileName();

      // Sauvegarder le PDF
      doc.save(fileName);
    } catch (error) {
      console.error("Erreur lors de l'exportation du PDF:", error);
      alert(
        "Une erreur s'est produite lors de l'exportation du PDF. Veuillez réessayer."
      );
    } finally {
      // Indiquer que l'exportation est terminée
      setIsExporting(false);
    }
  };

  // Générer un sous-titre basé sur les filtres appliqués
  const generateSubtitle = () => {
    const filterTexts = [];

    if (filters.areaNumber) {
      filterTexts.push(`Aire ${filters.areaNumber}`);
    }

    if (filters.ligue) {
      filterTexts.push(`Ligue: ${filters.ligue}`);
    }

    if (filters.club) {
      filterTexts.push(`Club: ${filters.club}`);
    }

    if (filters.participantName) {
      filterTexts.push(`Participant: ${filters.participantName}`);
    }

    if (filters.status) {
      filterTexts.push(`Statut: ${getStatusText(filters.status)}`);
    }

    if (filterTexts.length === 0) {
      return "Tous les matchs";
    }

    return filterTexts.join(" - ");
  };

  // Générer un nom de fichier basé sur les filtres appliqués
  const generateFileName = () => {
    const datePart = new Date().toISOString().split("T")[0];
    let fileNameBase = `matchs_${datePart}`;

    if (filters.areaNumber) {
      fileNameBase += `_aire${filters.areaNumber}`;
    }

    if (filters.ligue) {
      fileNameBase += `_ligue${filters.ligue.replace(/\s+/g, "_")}`;
    }

    if (filters.club) {
      fileNameBase += `_club${filters.club.replace(/\s+/g, "_")}`;
    }

    return `${fileNameBase}.pdf`;
  };

  // Déterminer la couleur de statut
  const getStatusColor = (status: string) => {
    switch (status) {
      case "in_progress":
        return "bg-green-100 text-green-800";
      case "completed":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-yellow-100 text-yellow-800";
    }
  };

  // Déterminer le texte de statut en français
  const getStatusText = (status: string) => {
    switch (status) {
      case "in_progress":
        return "En cours";
      case "completed":
        return "Terminé";
      default:
        return "En attente";
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 bg-white rounded-lg shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-900">
          Tous les matchs ({filteredMatches.length})
        </h2>
        <button
          onClick={exportToPdf}
          disabled={isExporting || filteredMatches.length === 0}
          className={`px-4 py-2 ${
            isExporting ? "bg-gray-500" : "bg-blue-600 hover:bg-blue-700"
          } text-white rounded-md flex items-center`}
        >
          {isExporting ? (
            <>
              <svg
                className="animate-spin -ml-1 mr-2 h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Exportation...
            </>
          ) : (
            <>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 mr-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              Exporter PDF
            </>
          )}
        </button>
      </div>

      {filteredMatches.length === 0 ? (
        <div className="text-center py-10 text-gray-500">
          Aucun match trouvé avec les filtres appliqués
        </div>
      ) : (
        <>
          {/* Affichage tableau pour desktop */}
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wider"
                  >
                    N° Match
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wider"
                  >
                    Aire
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wider"
                  >
                    Catégorie
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wider"
                  >
                    Bleu
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wider"
                  >
                    Club (Bleu)
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wider"
                  >
                    Ligue (Bleu)
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wider"
                  >
                    Rouge
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wider"
                  >
                    Club (Rouge)
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wider"
                  >
                    Ligue (Rouge)
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wider"
                  >
                    Statut
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wider"
                  >
                    Heure
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredMatches.map((match) => {
                  return (
                    <tr key={match.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                        {match.matchNumber}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {match.area?.areaNumber || match.areaNumber || "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {getCategoryInfo(match)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-700">
                        {getParticipantName(match, "A")}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {match.matchParticipants?.find(
                          (mp) => mp.position === "A"
                        )?.participant?.club || "Inconnu"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {match.matchParticipants?.find(
                          (mp) => mp.position === "A"
                        )?.participant?.ligue || "Inconnue"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-rose-700">
                        {getParticipantName(match, "B")}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {match.matchParticipants?.find(
                          (mp) => mp.position === "B"
                        )?.participant?.club || "Inconnu"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {match.matchParticipants?.find(
                          (mp) => mp.position === "B"
                        )?.participant?.ligue || "Inconnue"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-bold rounded-full ${getStatusColor(
                            match.status
                          )}`}
                        >
                          {getStatusText(match.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatTime(match.startTime)}
                        {match.status === "completed" && match.endTime && (
                          <span className="text-xs text-gray-500 ml-1">
                            → {formatTime(match.endTime)}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Affichage cartes pour mobile */}
          <div className="md:hidden space-y-4">
            {filteredMatches.map((match) => (
              <div
                key={match.id}
                className="p-4 border border-gray-200 rounded-lg shadow-sm bg-white"
              >
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-gray-800">
                      #{match.matchNumber}
                    </span>
                    <span className="text-gray-600">
                      Aire {match.area?.areaNumber || match.areaNumber || "-"}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span
                      className={`px-2 py-1 inline-flex text-xs leading-4 font-bold rounded-full ${getStatusColor(
                        match.status
                      )}`}
                    >
                      {getStatusText(match.status)}
                    </span>
                    <span className="text-sm text-gray-600">
                      {formatTime(match.startTime)}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 mt-3">
                  {/* Participant Bleu */}
                  <div className="flex-1 p-2 bg-blue-50 rounded border-l-4 border-blue-500">
                    <div className="font-medium text-blue-700">
                      {getParticipantName(match, "A")}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      {match.matchParticipants?.find(
                        (mp) => mp.position === "A"
                      )?.participant?.club || "Inconnu"}{" "}
                      (
                      {match.matchParticipants?.find(
                        (mp) => mp.position === "A"
                      )?.participant?.ligue || "Inconnue"}
                      )
                    </div>
                  </div>

                  {/* Participant Rouge */}
                  <div className="flex-1 p-2 bg-rose-50 rounded border-l-4 border-rose-500">
                    <div className="font-medium text-rose-700">
                      {getParticipantName(match, "B")}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      {match.matchParticipants?.find(
                        (mp) => mp.position === "B"
                      )?.participant?.club || "Inconnu"}{" "}
                      (
                      {match.matchParticipants?.find(
                        (mp) => mp.position === "B"
                      )?.participant?.ligue || "Inconnue"}
                      )
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
