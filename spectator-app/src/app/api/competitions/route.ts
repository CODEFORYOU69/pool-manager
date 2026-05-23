import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// Cache la réponse 10s côté Vercel pour absorber les pics de spectateurs
// (jusqu'à 30x moins de requêtes DB en cas d'affluence). 10s de latence est
// invisible pour un visiteur, et la sync Supabase dépasse déjà ce délai.
export const revalidate = 10;

export async function GET() {
  try {
    const competitions = await prisma.competition.findMany({
      where: { visibleInSpectator: true },
      orderBy: { date: "desc" },
    });
    return NextResponse.json(competitions);
  } catch (error) {
    console.error("Error fetching competitions:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Failed to fetch competitions", details: message },
      { status: 500 }
    );
  }
}
