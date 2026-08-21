import type { Metadata, Viewport } from "next";
import { Caveat, Nunito_Sans, Quicksand } from "next/font/google";
import { Toaster } from "sonner";

import { ServiceWorkerRegister } from "@/components/app/service-worker-register";
import { ThemeScript } from "@/components/theme-script";
import { APP_NAME, APP_TAGLINE } from "@/lib/brand";

import "./globals.css";

/** Cuerpo: redonda pero legible a 13px, que es donde vive casi toda la app. */
const body = Nunito_Sans({
  subsets: ["latin"],
  variable: "--font-nunito",
  display: "swap",
});

/** Títulos: terminaciones redondeadas, contadores abiertos. Se lee amable. */
const display = Quicksand({
  subsets: ["latin"],
  variable: "--font-quicksand",
  display: "swap",
  weight: ["500", "600", "700"],
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
    default: APP_NAME,
    template: `%s · ${APP_NAME}`,
  },
  description: APP_TAGLINE,
  applicationName: APP_NAME,
  manifest: "/manifest.webmanifest",
  /**
   * Los íconos van declarados a mano.
   *
   * Next los detecta solo si están como `app/icon.png` / `app/apple-icon.png`,
   * y acá se generan con `npm run icons` a `public/icons/`. Sin el
   * `apple-touch-icon`, "Agregar a inicio" en un iPhone usa una CAPTURA de la
   * pantalla como ícono: queda un cuadradito borroso con el formulario de
   * login adentro, y no hay ningún error que avise.
   */
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: APP_NAME,
  },
  // Es una app privada de una familia: nada de esto debería indexarse jamás.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f9fd" },
    { media: "(prefers-color-scheme: dark)", color: "#15100e" },
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
      <body
        className={`${body.variable} ${display.variable} ${handwriting.variable} font-sans antialiased`}
      >
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
