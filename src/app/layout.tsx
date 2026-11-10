import type { Metadata, Viewport } from "next";
import { Vazirmatn } from "next/font/google";
import { PwaManager } from "@/components/PwaManager";
import "./globals.css";

const vazirmatn = Vazirmatn({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-vazirmatn",
  display: "swap",
});

export const metadata: Metadata = {
  title: "پترونبض | سامانه کشف قیمت چندمنبعی و فروش بشکه‌ای گازوئیل",
  description:
    "سامانه پیشرفته کشف قیمت از چندین منبع، مدیریت انبار بشکه، صدور پیش‌فاکتور PDF و پرتال سفارش آنلاین مشتریان روی ویندوز، مک، اندروید و آیفون",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "پترونبض",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" className={vazirmatn.variable}>
      <body className="min-h-screen antialiased selection:bg-amber-200 selection:text-slate-900">
        {children}
        <PwaManager />
      </body>
    </html>
  );
}
