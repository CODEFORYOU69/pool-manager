import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const competitionId = searchParams.get("competitionId");

    if (!competitionId) {
      return NextResponse.json(
        { error: "competitionId is required" },
        { status: 400 }
      );
    }

    const participants = await prisma.participant.findMany({
      where: { competitionId },
      orderBy: [{ nom: "asc" }, { prenom: "asc" }],
    });

    return NextResponse.json(participants);
  } catch (error) {
    console.error("Error fetching participants:", error);
    return NextResponse.json(
      { error: "Failed to fetch participants" },
      { status: 500 }
    );
  }
}
