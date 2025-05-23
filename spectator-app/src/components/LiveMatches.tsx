"use client";

import { Match } from "@/types";

// Interfaces étendues pour les propriétés additionnelles
interface ExtendedMatch extends Match {
  poolIndex?: number;
  participants?: ExtendedParticipant[];
  group?: {
    id?: string;
    gender?: string;
    ageCategoryName?: string;
    weightCategoryName?: string;
  };
  groupId?: string;
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

interface DelayInfo {
  delayInMinutes: number;
  lastCompletedMatch: number | null;
}

type LiveMatchesProps = {
  upcomingMatchesByArea: { [key: number]: Match[] };
  getParticipantName: (match: Match, position: string) => string;
  formatTime: (dateString?: string) => string;
  delayInfoByArea?: { [key: number]: DelayInfo };
  getAdjustedStartTime?: (match: Match) => string;
};

export default function LiveMatches({
  upcomingMatchesByArea,
  getParticipantName,
  formatTime,
  delayInfoByArea = {},
  getAdjustedStartTime,
}: LiveMatchesProps) {
  // Obtenir la liste des aires triées
  const areaNumbers = Object.keys(upcomingMatchesByArea)
    .map(Number)
    .sort((a, b) => a - b);

  // Fonction pour récupérer les informations de catégorie
  const getCategoryInfo = (match: Match): string => {
    try {
      if (!match) return "";

      // Utiliser des interfaces étendues pour accéder aux propriétés optionnelles
      const extMatch = match as ExtendedMatch;

      // Si nous avons les données du groupe, les utiliser en priorité
      if (extMatch.group) {
        const group = extMatch.group;
        const gender = group.gender || "";
        const ageCategory = group.ageCategoryName || "";
        const weightCategory = group.weightCategoryName || "";
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

        return `${genderAbbr}-${ageCatAbbr} ${formattedWeight} P${poolIndex}`.trim();
      }

      // Fallback sur les informations du participant si le groupe n'est pas disponible
      const participant =
        match.matchParticipants?.[0]?.participant || extMatch.participants?.[0];

      if (!participant) return "";

      const extParticipant = participant as ExtendedParticipant;

      // Récupérer les informations de genre, catégorie d'âge, poids et poule
      const gender = extParticipant.gender || extParticipant.sexe || "";
      const ageCategory =
        extParticipant.ageCategory || extParticipant.categoryAgeAbbr || "";

      // Essayer de récupérer la catégorie de poids, en favorisant les propriétés les plus spécifiques
      let weightCategory = "";

      // Si on a un ID de groupe, essayer de récupérer les infos du groupe (asynchrone)
      if (extMatch.groupId && !weightCategory) {
        // On ne peut pas faire de requête asynchrone ici, mais on peut indiquer qu'il faudrait
        // implémenter un système de cache pour les données de groupe
        console.log(
          `Pour une meilleure précision, implémenter un cache pour le groupe ${extMatch.groupId}`
        );
      }

      // Fallback sur les propriétés du participant
      weightCategory =
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

  if (areaNumbers.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6 text-center">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Aucun match programmé
        </h2>
        <p className="text-gray-800">
          Les matchs apparaîtront ici dès qu&apos;ils seront programmés.
        </p>
      </div>
    );
  }

  // Fonction pour déterminer si on affiche l'indicateur d'avance ou de retard
  const getDelayIndicator = (areaNumber: number) => {
    const delayInfo = delayInfoByArea[areaNumber];
    if (!delayInfo) return null;

    const { delayInMinutes } = delayInfo;

    if (delayInMinutes > 0) {
      return (
        <span className="ml-2 bg-red-100 text-red-800 text-xs px-2 py-1 rounded font-medium">
          Retard de {delayInMinutes} min.
        </span>
      );
    } else if (delayInMinutes < 0) {
      return (
        <span className="ml-2 bg-green-100 text-green-800 text-xs px-2 py-1 rounded font-medium">
          Avance de {Math.abs(delayInMinutes)} min.
        </span>
      );
    } else {
      return (
        <span className="ml-2 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded font-medium">
          Dans les temps
        </span>
      );
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 2xl:grid-cols-6 gap-3 p-2 sm:p-0">
      {areaNumbers.map((areaNumber) => (
        <div
          key={areaNumber}
          className="mb-4 bg-white rounded-lg shadow-sm p-3 h-full flex flex-col"
        >
          <h2 className="text-xl font-bold text-gray-900 mb-2 flex flex-wrap items-center">
            Aire {areaNumber}{" "}
            <span className="text-sm font-medium text-gray-700 ml-2">
              ({upcomingMatchesByArea[areaNumber].length})
            </span>
            {delayInfoByArea[areaNumber] && getDelayIndicator(areaNumber)}
          </h2>
          {delayInfoByArea[areaNumber]?.lastCompletedMatch && (
            <div className="text-xs text-gray-500 mb-2">
              Dernier match: #{delayInfoByArea[areaNumber].lastCompletedMatch}
            </div>
          )}

          <div className="space-y-3 flex-grow overflow-y-auto">
            {upcomingMatchesByArea[areaNumber].map((match, index) => {
              const isFirstMatch = index === 0;
              const isPending = match.status === "pending";
              const isInProgress = match.status === "in_progress";

              // Utiliser l'heure ajustée si disponible, sinon l'heure originale
              const adjustedStartTime = getAdjustedStartTime
                ? getAdjustedStartTime(match)
                : match.startTime;

              return (
                <div
                  key={match.id}
                  className={`bg-white rounded-lg shadow-sm overflow-hidden border ${
                    isFirstMatch ? "border-yellow-500" : "border-gray-200"
                  }`}
                >
                  <div
                    className={`px-3 py-2 flex flex-wrap justify-between items-center border-b ${
                      isFirstMatch
                        ? "bg-yellow-50 border-yellow-200"
                        : "bg-gray-50 border-gray-200"
                    }`}
                  >
                    <div className="flex items-center flex-wrap">
                      <span className="font-bold text-gray-900 text-sm">
                        #{match.matchNumber}
                      </span>
                      <span
                        className={`ml-1 px-1.5 py-0.5 text-xs rounded ${
                          isInProgress
                            ? "bg-green-100 text-green-800"
                            : isPending
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {match.status === "in_progress"
                          ? "En cours"
                          : match.status === "completed"
                          ? "Terminé"
                          : "En attente"}
                      </span>
                    </div>
                    <span className="text-xs bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">
                      {getCategoryInfo(match)}
                    </span>
                  </div>

                  <div className="p-2">
                    {/* Combattant BLEU en haut */}
                    <div className="flex flex-col gap-1 mb-2">
                      <div className="flex-1 flex flex-col border-l-4 border-blue-500 bg-blue-50 rounded-r pl-2 py-1.5">
                        <span className="font-medium text-blue-700 text-sm line-clamp-1">
                          {getParticipantName(match, "A")}
                        </span>
                        <span className="text-xs text-gray-600 line-clamp-1">
                          {match.matchParticipants?.find(
                            (mp) => mp.position === "A"
                          )?.participant?.club || "Club inconnu"}{" "}
                          {match.matchParticipants?.find(
                            (mp) => mp.position === "A"
                          )?.participant?.ligue
                            ? `(${
                                match.matchParticipants?.find(
                                  (mp) => mp.position === "A"
                                )?.participant?.ligue
                              })`
                            : ""}
                        </span>
                      </div>

                      {/* Combattant ROUGE en bas */}
                      <div className="flex-1 flex flex-col border-l-4 border-rose-500 bg-rose-50 rounded-r pl-2 py-1.5">
                        <span className="font-medium text-rose-700 text-sm line-clamp-1">
                          {getParticipantName(match, "B")}
                        </span>
                        <span className="text-xs text-gray-600 line-clamp-1">
                          {match.matchParticipants?.find(
                            (mp) => mp.position === "B"
                          )?.participant?.club || "Club inconnu"}{" "}
                          {match.matchParticipants?.find(
                            (mp) => mp.position === "B"
                          )?.participant?.ligue
                            ? `(${
                                match.matchParticipants?.find(
                                  (mp) => mp.position === "B"
                                )?.participant?.ligue
                              })`
                            : ""}
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-xs">
                      {isPending ? (
                        <div>
                          <div className="text-gray-700">
                            {/* Afficher l'heure originale prévue */}
                            Prévu: {formatTime(match.startTime)}
                          </div>
                          {/* Afficher l'heure ajustée si différente de l'originale */}
                          {adjustedStartTime !== match.startTime &&
                            delayInfoByArea[areaNumber] && (
                              <div
                                className={
                                  delayInfoByArea[areaNumber].delayInMinutes > 0
                                    ? "text-red-700"
                                    : delayInfoByArea[areaNumber]
                                        .delayInMinutes < 0
                                    ? "text-green-700"
                                    : "text-blue-700"
                                }
                              >
                                Est.: {formatTime(adjustedStartTime)}
                              </div>
                            )}
                        </div>
                      ) : (
                        <div className="text-gray-700">
                          Début: {formatTime(match.startTime)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
