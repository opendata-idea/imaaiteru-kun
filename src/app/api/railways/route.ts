import { fetchRailwayOptions } from "@/lib/odpt";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const railways = await fetchRailwayOptions();
    return NextResponse.json(railways);
  } catch (error) {
    console.error("Failed to fetch railways:", error);
    return NextResponse.json(
      { error: "Failed to fetch railways" },
      { status: 500 },
    );
  }
}