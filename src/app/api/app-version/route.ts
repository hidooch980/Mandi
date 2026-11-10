import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readAndroidVersion(): { versionCode: number; versionName: string } {
  const propPath = path.join(process.cwd(), "android", "version.properties");
  let versionCode = 1;
  let versionName = "1.0.0";
  try {
    if (fs.existsSync(propPath)) {
      const content = fs.readFileSync(propPath, "utf8");
      const codeMatch = content.match(/VERSION_CODE\s*=\s*(\d+)/);
      const nameMatch = content.match(/VERSION_NAME\s*=\s*([^\r\n]+)/);
      if (codeMatch) versionCode = Number(codeMatch[1]);
      if (nameMatch) versionName = nameMatch[1].trim();
    }
  } catch {
    // Fallback to defaults
  }
  return { versionCode, versionName };
}

export async function GET() {
  const { versionCode, versionName } = readAndroidVersion();
  const apkExists = fs.existsSync(
    path.join(process.cwd(), "public", "downloads", "petronabz-latest.apk")
  );

  return NextResponse.json({
    ok: true,
    packageId: "ir.petronabz.app",
    versionCode,
    versionName,
    apkAvailable: apkExists,
    apkUrl: "/downloads/petronabz-latest.apk",
    releaseNotes:
      "نسخه رسمی امضاشده پترونبض: خرید و فروش بنزین و گازوئیل، کشف قیمت دلال‌ها و واتساپ، پیامک ساعتی و فاکتور PDF.",
  });
}
