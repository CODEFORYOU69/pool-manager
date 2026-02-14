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

    const groups = await prisma.group.findMany({
      where: { competitionId: id },
      include: {
        pools: {
          include: {
            poolParticipants: {
              include: {
                participant: true,
              },
            },
            matches: {
              select: { id: true, matchNumber: true, status: true, phase: true },
              orderBy: { matchNumber: "asc" },
            },
          },
        },
        participants: {
          include: {
            participant: true,
          },
        },
      },
      orderBy: [
        { gender: "asc" },
        { ageCategoryName: "asc" },
        { weightCategoryName: "asc" },
      ],
    });

    return NextResponse.json(groups);
  } catch (error) {
    console.error("Error fetching groups:", error);
    return NextResponse.json(
      { error: "Failed to fetch groups" },
      { status: 500 }
    );
  }
}
