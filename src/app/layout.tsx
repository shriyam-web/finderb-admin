import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import AppProviders from "../components/AppProviders";
import "./globals.css";
import "./controller-theme.css";
import "./silver-theme.css";
import "./dark-theme.css";
import "./theme-contrast.css";
import "./theme-visibility.css";

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
  applicationName: "FinderB Admin",
  appleWebApp: {
    capable: true,
    title: "FinderB Admin",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icon.png?v=4", type: "image/png", sizes: "any" },
      { url: "/icon-192.png?v=4", type: "image/png", sizes: "192x192" },
    ],
    shortcut: "/icon.png?v=4",
    apple: [{ url: "/icon-192.png?v=4", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#c2410c",
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
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col font-sans">
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var root=document.documentElement;function paint(theme){["admin-theme-controller","admin-theme-dark","admin-theme-silver"].forEach(function(name){root.classList.remove(name)});if(!theme){root.removeAttribute("data-admin-theme");return}root.setAttribute("data-admin-theme",theme);root.classList.add("admin-theme-"+theme)}var raw=localStorage.getItem("admin_session");var session=raw?JSON.parse(raw):null;var signedIn=!!(session&&session.id);var mode=localStorage.getItem("admin_color_mode");var role=signedIn?session.role:localStorage.getItem("admin_color_role");var dark=signedIn?(mode==="dark"||(mode!=="light"&&(role==="developer"||role==="controller"))):mode==="dark";if(!dark){paint(null);return}paint(role==="developer"?"controller":role==="controller"?"silver":"dark")}catch(e){}})();`,
          }}
        />
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
