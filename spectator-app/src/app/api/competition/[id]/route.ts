import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// Cache la réponse 10s côté Vercel pour absorber les pics de spectateurs
// (jusqu'à 30x moins de requêtes DB en cas d'affluence).
export const revalidate = 10;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const competition = await prisma.competition.findUnique({
      where: { id },
      include: {
        areas: true,
      },
    });

    if (!competition || !competition.visibleInSpectator) {
      return NextResponse.json(
        { error: "Competition not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(competition);
  } catch (error) {
    console.error("Error fetching competition:", error);
    return NextResponse.json(
      { error: "Failed to fetch competition" },
      { status: 500 }
    );
  }
}
