import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Xianxia RPG",
  description:
    "Text-based Xianxia cultivation RPG game powered by AI. Embark on your immortal cultivation journey.",
  keywords: ["xianxia", "rpg", "cultivation", "game", "tu tiên", "ai game", "text rpg"],
};

export const viewport: Viewport = {
  themeColor: "#d4af37",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Disable console in production
              if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
                const noop = function() {};
                console.log = noop;
                console.debug = noop;
                console.info = noop;
                console.warn = noop;
              }
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
