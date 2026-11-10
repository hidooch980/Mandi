import os from "node:os";
import { NextResponse } from "next/server";
import { requireStaffUser } from "@/lib/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireStaffUser();
  if (auth.response) return auth.response;

  const interfaces = os.networkInterfaces();
  const lanIps: string[] = [];

  for (const entries of Object.values(interfaces)) {
    if (!entries) continue;
    for (const info of entries) {
      if (info.family === "IPv4" && !info.internal) {
        lanIps.push(info.address);
      }
    }
  }

  const port = process.env.PORT || "3000";
  const urls = lanIps.map((ip) => `http://${ip}:${port}`);

  return NextResponse.json({
    ok: true,
    hostname: os.hostname(),
    port,
    urls,
  });
}
