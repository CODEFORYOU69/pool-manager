// Types partagés pour l'application

export interface Competition {
  id: string;
  name: string;
  date?: string; // Date de la compétition
}

export interface Participant {
  id: string;
  prenom?: string;
  nom?: string;
  ligue?: string;
  age?: number;
  poids?: number;
}

export interface MatchParticipant {
  id?: string;
  position: string;
  participantId: string;
  participant?: Participant;
}

export interface Round {
  roundNumber: number;
  scoreA: number;
  scoreB: number;
  winnerPosition?: string;
}

export interface Match {
  id: string;
  matchNumber: number;
  areaNumber: number;
  startTime: string;
  endTime?: string;
  status: "pending" | "in_progress" | "completed";
  winner?: string;
  winnerPosition?: string;
  matchParticipants?: MatchParticipant[];
  rounds?: Round[];
  area?: {
    areaNumber: number;
  };
}
