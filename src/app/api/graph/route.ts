import { NextResponse } from "next/server";
import { getSnapshot } from "@/lib/graph/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = await getSnapshot();
  return NextResponse.json(snapshot);
}
