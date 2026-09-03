import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import AppProviders from "../components/AppProviders";
import "./globals.css";
import "./controller-theme.css";
import "./dark-theme.css";
import "./theme-contrast.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans-ui",
  display: "swap",
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-whats-new",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Admin | FinderB",
  description: "FinderB admin dashboard",
  icons: {
    icon: [
      { url: "/icon.png?v=3", type: "image/png", sizes: "any" },
      { url: "/icon.png?v=3", type: "image/png", sizes: "32x32" },
      { url: "/icon.png?v=3", type: "image/png", sizes: "16x16" },
    ],
    shortcut: "/icon.png?v=3",
    apple: [{ url: "/icon.png?v=3", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`h-full antialiased ${inter.variable} ${plusJakarta.variable}`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
