// Types partagés pour l'application

export interface Competition {
  id: string;
  name: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  roundDuration?: number;
  breakDuration?: number;
  numAreas?: number;
  location?: string;
}

export interface Participant {
  id: string;
  prenom?: string;
  nom?: string;
  ligue?: string;
  club?: string;
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
  penaltyA?: number;
  penaltyB?: number;
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
  phase?: string; // 'pool' | 'semi1' | 'semi2' | 'final' | 'bronze'
  tour?: number;
  matchParticipants?: MatchParticipant[];
  rounds?: Round[];
  area?: {
    areaNumber: number;
  };
  pool?: {
    id: string;
    fightsPerPerson?: number;
    phase?: string;
  };
}
