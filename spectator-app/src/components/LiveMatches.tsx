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
        <span className="ml-2 bg-primary-100 text-primary-800 text-xs px-2 py-1 rounded font-medium">
          Dans les temps
        </span>
      );
    }
  };

  // Helper : récupère le club d'un combattant
  const getClub = (match: Match, position: string) => {
    const mp = match.matchParticipants?.find((p) => p.position === position);
    return mp?.participant?.club || "";
  };

  return (
    <div
      className="grid gap-4 p-2 sm:p-0"
      style={{
        gridTemplateColumns: `repeat(auto-fit, minmax(280px, 1fr))`,
      }}
    >
      {areaNumbers.map((areaNumber) => {
        const areaMatches = upcomingMatchesByArea[areaNumber] || [];
        const delay = delayInfoByArea[areaNumber];

        return (
          <div
            key={areaNumber}
            className="mb-2 rounded-xl bg-white shadow-sm border border-gray-100 overflow-hidden flex flex-col"
          >
            {/* Area header - dark & compact */}
            <div className="bg-gray-900 text-white px-4 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold tracking-tight">
                  Aire {areaNumber}
                </span>
                <span className="text-xs text-gray-400 font-medium">
                  {areaMatches.length} combat{areaMatches.length > 1 ? "s" : ""}
                </span>
              </div>
              {delay && getDelayIndicator(areaNumber)}
            </div>

            {/* Matches */}
            <div className="p-2 space-y-2 flex-grow overflow-y-auto">
              {areaMatches.length === 0 && (
                <div className="text-center text-gray-400 text-sm py-6">
                  Aucun combat en attente
                </div>
              )}

              {areaMatches.map((match, index) => {
                const isFirstMatch = index === 0;
                const isPending = match.status === "pending";
                const isInProgress = match.status === "in_progress";
                const adjustedStartTime = getAdjustedStartTime
                  ? getAdjustedStartTime(match)
                  : match.startTime;

                return (
                  <div
                    key={match.id}
                    className={`match-card-enhanced ${
                      isFirstMatch ? "next-up" : ""
                    }`}
                  >
                    {/* Match header */}
                    <div
                      className={`px-3 py-1.5 flex items-center justify-between border-b ${
                        isFirstMatch
                          ? "bg-amber-50 border-amber-200"
                          : "bg-gray-50 border-gray-100"
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-gray-900 text-sm">
                          #{match.matchNumber}
                        </span>
                        {isInProgress && <span className="live-dot" />}
                        <span
                          className={`px-1.5 py-0.5 text-[10px] font-semibold rounded ${
                            isInProgress
                              ? "bg-green-500 text-white"
                              : isPending
                              ? "bg-amber-100 text-amber-800"
                              : "bg-primary-100 text-primary-800"
                          }`}
                        >
                          {isInProgress
                            ? "EN COURS"
                            : match.status === "completed"
                            ? "TERMINÉ"
                            : "ATTENTE"}
                        </span>
                        {match.phase && match.phase !== "pool" && (
                          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-purple-600 text-white">
                            {match.phase === "semi1"
                              ? "DEMI 1"
                              : match.phase === "semi2"
                              ? "DEMI 2"
                              : match.phase === "final"
                              ? "FINALE"
                              : match.phase.toUpperCase()}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-gray-500 font-medium max-w-[50%] text-right truncate">
                        {getCategoryInfo(match)}
                      </span>
                    </div>

                    {/* Fighters */}
                    <div>
                      {/* BLEU (Chung) - position A */}
                      <div className="fighter-row bleu">
                        <span className="corner-label">BLEU</span>
                        <div className="flex-1 min-w-0">
                          <div className="name truncate">
                            {getParticipantName(match, "A")}
                          </div>
                          <div className="club truncate">{getClub(match, "A")}</div>
                        </div>
                      </div>

                      {/* ROUGE (Hong) - position B */}
                      <div className="fighter-row rouge">
                        <span className="corner-label">ROUGE</span>
                        <div className="flex-1 min-w-0">
                          <div className="name truncate">
                            {getParticipantName(match, "B")}
                          </div>
                          <div className="club truncate">{getClub(match, "B")}</div>
                        </div>
                      </div>
                    </div>

                    {/* Time footer */}
                    <div className="px-3 py-1.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-[11px]">
                      {match.tour && match.tour > 0 ? (
                        <span className="text-primary-600 font-semibold">
                          Tour {match.tour}
                        </span>
                      ) : (
                        <span />
                      )}
                      {isPending ? (
                        <div className="text-right">
                          <span className="text-gray-500">
                            {formatTime(match.startTime)}
                          </span>
                          {adjustedStartTime !== match.startTime && delay && (
                            <span
                              className={`ml-1 font-semibold ${
                                delay.delayInMinutes > 0
                                  ? "text-red-600"
                                  : "text-green-600"
                              }`}
                            >
                              → {formatTime(adjustedStartTime)}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-500">
                          {formatTime(match.startTime)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
