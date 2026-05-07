import { NextResponse } from "next/server";
import { patchEdge } from "@/lib/graph/store";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    trustWeight?: number;
    confidence?: number;
  };
  const snapshot = await patchEdge(id, body);
  return NextResponse.json(snapshot);
}
