/** Branding settings types and defaults — shared between API route and hooks. */

export interface BrandingSettings {
  serverName: string;
  serverNameAccent: string;
  pageTitle: string;
  serverUrl: string;
  faviconUrl: string;
  logoUrl: string;
  iconUrl: string;
  colors: {
    accent: string;
    accentHover: string;
    bgPrimary: string;
    bgSecondary: string;
    bgCard: string;
    textPrimary: string;
    textSecondary: string;
  };
  gettingStarted: {
    serverAddress: string;
    downloadLink: string;
    downloadText: string;
    customMessage: string;
  };
}

export const DEFAULT_BRANDING: BrandingSettings = {
  serverName: "RealmManager",
  serverNameAccent: "Manager",
  pageTitle: "RealmManager",
  serverUrl: "",
  faviconUrl: "",
  logoUrl: "",
  iconUrl: "",
  colors: {
    accent: "#f59e0b",
    accentHover: "#d97706",
    bgPrimary: "#0c0e14",
    bgSecondary: "#14171f",
    bgCard: "#1a1e2a",
    textPrimary: "#f5f0e6",
    textSecondary: "#8b8fa8",
  },
  gettingStarted: {
    serverAddress: "YOUR_SERVER_ADDRESS",
    downloadLink: "",
    downloadText: "",
    customMessage: "",
  },
};
