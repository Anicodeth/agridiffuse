import { NextResponse } from "next/server";
import { patchFarmer } from "@/lib/graph/store";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { adoptionRate?: number };
  const snapshot = await patchFarmer(id, body);
  return NextResponse.json(snapshot);
}
