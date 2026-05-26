"use client";

import * as React from "react";

export type ThemeMode = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "uniid-theme";
const THEME_MODES: ThemeMode[] = ["system", "light", "dark"];
const MEDIA_QUERY = "(prefers-color-scheme: dark)";

type ThemeContextValue = {
  themeMode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setThemeMode: (mode: ThemeMode) => void;
};

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

function isThemeMode(value: string | null): value is ThemeMode {
  return value === "system" || value === "light" || value === "dark";
}

function getSystemTheme(): ResolvedTheme {
  return window.matchMedia(MEDIA_QUERY).matches ? "dark" : "light";
}

function resolveTheme(mode: ThemeMode): ResolvedTheme {
  return mode === "system" ? getSystemTheme() : mode;
}

function applyTheme(theme: ResolvedTheme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
}

function getStoredThemeMode(): ThemeMode {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isThemeMode(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [initialized, setInitialized] = React.useState(false);
  const [themeMode, setThemeModeState] = React.useState<ThemeMode>("system");
  const [resolvedTheme, setResolvedTheme] = React.useState<ResolvedTheme>("light");

  React.useEffect(() => {
    const storedThemeMode = getStoredThemeMode();
    const nextResolvedTheme = resolveTheme(storedThemeMode);

    setThemeModeState(storedThemeMode);
    setResolvedTheme(nextResolvedTheme);
    applyTheme(nextResolvedTheme);
    setInitialized(true);
  }, []);

  React.useEffect(() => {
    if (!initialized) return;

    const sync = () => {
      const nextResolvedTheme = resolveTheme(themeMode);
      setResolvedTheme(nextResolvedTheme);
      applyTheme(nextResolvedTheme);
    };

    sync();

    if (themeMode !== "system") return;

    const query = window.matchMedia(MEDIA_QUERY);
    query.addEventListener("change", sync);

    return () => query.removeEventListener("change", sync);
  }, [initialized, themeMode]);

  const setThemeMode = React.useCallback((mode: ThemeMode) => {
    const nextResolvedTheme = resolveTheme(mode);

    setThemeModeState(mode);
    setResolvedTheme(nextResolvedTheme);
    applyTheme(nextResolvedTheme);

    try {
      if (THEME_MODES.includes(mode)) {
        window.localStorage.setItem(STORAGE_KEY, mode);
      }
    } catch {
      // localStorage 可能在隐私模式或嵌入环境中不可用。
    }
  }, []);

  const value = React.useMemo(
    () => ({ themeMode, resolvedTheme, setThemeMode }),
    [resolvedTheme, setThemeMode, themeMode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = React.useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}