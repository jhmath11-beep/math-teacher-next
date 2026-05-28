import { NextResponse } from "next/server";
import { getBootstrapData } from "@/lib/services/contentService";

export async function GET() {
  try {
    return NextResponse.json(await getBootstrapData());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
