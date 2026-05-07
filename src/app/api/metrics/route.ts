import { NextResponse } from "next/server";
import { getSnapshot } from "@/lib/graph/store";
import {
  practiceAdoption,
  expertReach,
  expertEarnings,
  deepestChain,
} from "@/lib/graph/metrics";

export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = await getSnapshot();
  return NextResponse.json({
    practiceAdoption: practiceAdoption(snapshot),
    expertReach: expertReach(snapshot),
    expertEarnings: expertEarnings(snapshot),
    deepestChain: deepestChain(snapshot),
    round: snapshot.round,
  });
}
