import type { Metadata, Viewport } from "next";
import {
  Cormorant_Garamond,
  Spectral,
  Inter,
  Noto_Serif_SC,
} from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/Toast";

const cormorant = Cormorant_Garamond({
  subsets: ["latin", "latin-ext", "vietnamese"],
  weight: ["500", "600"],
  variable: "--font-display",
  display: "swap",
});

const spectral = Spectral({
  subsets: ["latin", "latin-ext", "vietnamese"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-body",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin", "latin-ext", "vietnamese"],
  weight: ["500", "600"],
  variable: "--font-ui",
  display: "swap",
});

const notoSerifSC = Noto_Serif_SC({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-han",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Tu Tiên Lục",
  description:
    "Text-based Xianxia cultivation RPG game powered by AI. Embark on your immortal cultivation journey.",
  keywords: ["xianxia", "rpg", "cultivation", "game", "tu tiên", "ai game", "text rpg"],
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#efe5cd" },
    { media: "(prefers-color-scheme: dark)", color: "#181c25" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="vi"
      className={`${cormorant.variable} ${spectral.variable} ${inter.variable} ${notoSerifSC.variable}`}
    >
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
              // Unregister any stale service workers (PWA was removed)
              if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations().then(function(regs) {
                  regs.forEach(function(reg) { reg.unregister(); });
                });
              }
            `,
          }}
        />
      </head>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
