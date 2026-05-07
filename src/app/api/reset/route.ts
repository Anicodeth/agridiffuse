import { NextResponse } from "next/server";
import { resetSnapshot } from "@/lib/graph/store";

export const dynamic = "force-dynamic";

export async function POST() {
  const snapshot = await resetSnapshot();
  return NextResponse.json(snapshot);
}
