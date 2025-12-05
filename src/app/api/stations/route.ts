import { type NextRequest, NextResponse } from "next/server";
import { fetchStationsByRailway } from "@/lib/odpt";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const railwayId = searchParams.get("railwayId");

  if (!railwayId) {
    return NextResponse.json(
      { error: "railwayId is required" },
      { status: 400 },
    );
  }

  try {
    const stations = await fetchStationsByRailway(railwayId);
    return NextResponse.json(stations);
  } catch (error) {
    console.error("Failed to fetch stations via API route:", error);
    return NextResponse.json(
      { error: "Failed to fetch stations" },
      { status: 500 },
    );
  }
}
