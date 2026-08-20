import type { Metadata, Viewport } from "next";
import { Caveat, Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "sonner";

import { ServiceWorkerRegister } from "@/components/app/service-worker-register";
import { ThemeScript } from "@/components/theme-script";

import "./globals.css";

const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

/** Solo para el cuerpo de los post-its: es lo que los hace leer como papelitos. */
const handwriting = Caveat({
  subsets: ["latin"],
  variable: "--font-caveat",
  display: "swap",
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "Casa",
    template: "%s · Casa",
  },
  description: "La organización de la familia en un solo lugar.",
  applicationName: "Casa",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Casa",
  },
  // Es una app privada de una familia: nada de esto debería indexarse jamás.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf8f5" },
    { media: "(prefers-color-scheme: dark)", color: "#131217" },
  ],
  width: "device-width",
  initialScale: 1,
  // La PWA instalada dibuja detrás de la muesca y de la barra de gestos; el
  // padding lo ponen las utilidades .safe-* de globals.css.
  viewportFit: "cover",
  // Sin esto, un doble tap sobre un checkbox hace zoom y la lista salta.
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className={`${sans.variable} ${handwriting.variable} font-sans antialiased`}>
        {children}
        <ServiceWorkerRegister />
        <Toaster
          position="top-center"
          richColors
          // Arriba y no abajo: abajo lo tapa la bottom nav.
          toastOptions={{ style: { fontFamily: "var(--font-sans)" } }}
        />
      </body>
    </html>
  );
}
