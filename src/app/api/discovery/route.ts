import { NextResponse } from "next/server";
import { getFullDiscoveryState } from "@/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    ...getFullDiscoveryState(),
  });
}
