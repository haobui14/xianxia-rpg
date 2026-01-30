import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Xianxia RPG",
  description:
    "Text-based Xianxia cultivation RPG game powered by AI. Embark on your immortal cultivation journey.",
  applicationName: "Xianxia RPG",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Xianxia RPG",
  },
  formatDetection: {
    telephone: false,
  },
  keywords: [
    "xianxia",
    "rpg",
    "cultivation",
    "game",
    "tu tiên",
    "ai game",
    "text rpg",
  ],
};

export const viewport: Viewport = {
  themeColor: "#d4af37",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
