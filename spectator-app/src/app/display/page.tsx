"use client";

import LiveMatches from "@/components/LiveMatches";
import MatchHistory from "@/components/MatchHistory";
import { Competition, Match } from "@/types";
import { useEffect, useMemo, useState } from "react";

const API_URL = "/api";
const REFRESH_INTERVAL_MS = 30_000;
const ROTATE_INTERVAL_MS = 15_000;
const AREAS_PER_PAGE = 6;

interface DelayInfo {
  delayInMinutes: number;
  lastCompletedMatch: number | null;
}

export default function DisplayPage() {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [competitionId, setCompetitionId] = useState<string | null>(null);
  const [competitionDetails, setCompetitionDetails] =
    useState<Competition | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [recentMatches, setRecentMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageIndex, setPageIndex] = useState(0);

  // ─── Charger la liste des compétitions visibles ───
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${API_URL}/competitions`);
        if (!res.ok) return;
        const data: Competition[] = await res.json();
        setCompetitions(data);
        if (data.length > 0 && !competitionId) {
          setCompetitionId(data[0].id);
        }
      } catch (e) {
        console.error(e);
      }
    };
    load();
  }, [competitionId]);

  // ─── Détails de la compétition (numAreas) ───
  useEffect(() => {
    if (!competitionId) return;
    fetch(`${API_URL}/competition/${competitionId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setCompetitionDetails(data))
      .catch(() => {});
  }, [competitionId]);

  // ─── Polling matches ───
  useEffect(() => {
    if (!competitionId) return;
    const fetchMatches = async () => {
      try {
        const res = await fetch(
          `${API_URL}/competition/${competitionId}/matchesWithDetails`
        );
        if (!res.ok) return;
        const data: Match[] = await res.json();
        setMatches(data);
        const recent = data
          .filter((m) => m.status === "completed" && m.endTime)
          .sort(
            (a, b) =>
              new Date(b.endTime!).getTime() - new Date(a.endTime!).getTime()
          )
          .slice(0, 30);
        setRecentMatches(recent);
        setLoading(false);
      } catch (e) {
        console.error(e);
        setLoading(false);
      }
    };
    fetchMatches();
    const id = setInterval(fetchMatches, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [competitionId]);

  // ─── Calcul numAreas + grouping par aire ───
  const numAreas = useMemo(() => {
    const fromMatches = matches.reduce((max, m) => {
      const a =
        (m.area && typeof m.area.areaNumber === "number"
          ? m.area.areaNumber
          : null) ??
        (typeof m.areaNumber === "number" ? m.areaNumber : null) ??
        0;
      return a > max ? a : max;
    }, 0);
    return Math.max(competitionDetails?.numAreas || 0, fromMatches, 1);
  }, [matches, competitionDetails]);

  const matchesByArea = useMemo(() => {
    const byArea: { [key: number]: Match[] } = {};
    for (let i = 1; i <= numAreas; i++) byArea[i] = [];
    matches.forEach((m) => {
      let a = 0;
      if (m.area && typeof m.area.areaNumber === "number") a = m.area.areaNumber;
      else if (typeof m.areaNumber === "number") a = m.areaNumber;
      if (a < 1 || a > numAreas) return;
      byArea[a].push(m);
    });
    Object.keys(byArea).forEach((k) => {
      const areaNum = parseInt(k);
      byArea[areaNum] = byArea[areaNum]
        .filter((m) => m.status !== "completed")
        .sort((a, b) => a.matchNumber - b.matchNumber)
        .slice(0, 3);
    });
    return byArea;
  }, [matches, numAreas]);

  // ─── Pagination : pages d'aires + page historique ───
  const pages = useMemo(() => {
    const out: Array<{ type: "live"; areas: number[] } | { type: "history" }> =
      [];
    for (let i = 0; i < numAreas; i += AREAS_PER_PAGE) {
      out.push({
        type: "live",
        areas: Array.from(
          { length: Math.min(AREAS_PER_PAGE, numAreas - i) },
          (_, k) => i + k + 1
        ),
      });
    }
    if (recentMatches.length > 0) out.push({ type: "history" });
    return out.length > 0 ? out : [{ type: "live" as const, areas: [1] }];
  }, [numAreas, recentMatches]);

  // ─── Rotation auto ───
  useEffect(() => {
    if (pages.length <= 1) return;
    const id = setInterval(() => {
      setPageIndex((p) => (p + 1) % pages.length);
    }, ROTATE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [pages.length]);

  // Reset pageIndex si pages.length change
  useEffect(() => {
    if (pageIndex >= pages.length) setPageIndex(0);
  }, [pages.length, pageIndex]);

  const formatTime = (s?: string) => {
    if (!s) return "--:--";
    return new Date(s).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };
  const getParticipantName = (match: Match, position: string) => {
    const p = match.matchParticipants?.find((mp) => mp.position === position)
      ?.participant;
    if (!p) return "—";
    return `${p.prenom || ""} ${p.nom || ""}`.trim() || "—";
  };

  const currentPage = pages[pageIndex];
  const competition = competitions.find((c) => c.id === competitionId);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white text-2xl">
        Chargement…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Bandeau compact en haut */}
      <header className="bg-gray-900 text-white px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold">
            {competition?.name || "Compétition"}
          </h1>
          {competitionDetails?.numAreas && (
            <span className="text-sm text-gray-300">
              {competitionDetails.numAreas} aires
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {pages.map((_, i) => (
            <span
              key={i}
              className={`w-2 h-2 rounded-full ${
                i === pageIndex ? "bg-white" : "bg-gray-600"
              }`}
            />
          ))}
          <span className="text-xs text-gray-400 ml-2">
            {currentPage.type === "history"
              ? "Historique"
              : `Aires ${currentPage.areas[0]}–${
                  currentPage.areas[currentPage.areas.length - 1]
                }`}
          </span>
        </div>
      </header>

      {/* Contenu */}
      <main className="flex-1 p-4 overflow-hidden">
        {currentPage.type === "live" ? (
          <LiveMatches
            upcomingMatchesByArea={Object.fromEntries(
              currentPage.areas.map((a) => [a, matchesByArea[a] || []])
            )}
            delayInfoByArea={{} as { [key: number]: DelayInfo }}
            getParticipantName={getParticipantName}
            formatTime={formatTime}
          />
        ) : (
          <MatchHistory
            recentMatches={recentMatches}
            getParticipantName={getParticipantName}
            formatTime={formatTime}
          />
        )}
      </main>
    </div>
  );
}
