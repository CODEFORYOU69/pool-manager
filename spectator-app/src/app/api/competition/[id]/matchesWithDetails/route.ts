import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const competition = await prisma.competition.findUnique({
      where: { id },
    });

    if (!competition) {
      return NextResponse.json(
        { error: "Competition not found" },
        { status: 404 }
      );
    }

    const matches = await prisma.match.findMany({
      where: {
        group: { competitionId: id },
      },
      include: {
        area: true,
        group: true,
        pool: true,
        matchParticipants: {
          include: {
            participant: true,
          },
        },
        rounds: {
          orderBy: { roundNumber: "asc" },
        },
      },
      orderBy: { matchNumber: "asc" },
    });

    return NextResponse.json(matches);
  } catch (error) {
    console.error("Error fetching matches:", error);
    return NextResponse.json(
      { error: "Failed to fetch matches" },
      { status: 500 }
    );
  }
}
