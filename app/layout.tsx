import type { Metadata } from "next";
import { Archivo, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { ThemeProvider } from "@/components/ThemeProvider";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { SITE_URL } from "@/lib/site";

// The same three faces as royabes.com
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains-mono", display: "swap" });
const archivo = Archivo({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-archivo",
  display: "swap",
});

// Applies the saved theme before first paint so a dark-mode visitor never sees a light flash.
const THEME_INIT = `(function(){try{var t=localStorage.getItem('theme');var d=t==='dark'?true:t==='system'?window.matchMedia('(prefers-color-scheme: dark)').matches:false;var r=document.documentElement;if(d){r.classList.add('dark');r.style.colorScheme='dark'}else{r.classList.remove('dark');r.style.colorScheme='light'}}catch(e){}})();`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "CCA-F Trainer | Claude Certified Architect exam prep by Roy Abes",
  description:
    "An evidence-based trainer for the Claude Certified Architect - Foundations (CCAR-F) exam: study briefs, adaptive practice, a full mock-exam simulator, spaced repetition, and a level-aware AI tutor.",
  icons: { icon: "/icon.svg" },
  openGraph: {
    title: "CCA-F Trainer",
    description: "Study briefs, adaptive practice, a timed mock exam and spaced repetition for the Claude Certified Architect exam.",
    url: SITE_URL,
    siteName: "Roy Abes",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className={`${inter.variable} ${mono.variable} ${archivo.variable}`}>
        <ThemeProvider>
          <Providers>
            <Nav />
            <main className="mx-auto max-w-6xl px-5 py-7">{children}</main>
            <Footer />
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
