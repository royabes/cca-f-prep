"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { load, updateSettings, DEFAULT_SETTINGS } from "@/lib/store";
import type { Settings, UserLevel } from "@/lib/types";

interface Ctx {
  settings: Settings;
  ready: boolean;
  setLevel: (l: UserLevel) => void;
  setExamMinutes: (m: number) => void;
}

const SettingsContext = createContext<Ctx | null>(null);

export function Providers({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setSettings(load().settings);
    setReady(true);
  }, []);

  const setLevel = (l: UserLevel) => setSettings(updateSettings({ level: l }).settings);
  const setExamMinutes = (m: number) =>
    setSettings(updateSettings({ examMinutes: m }).settings);

  return (
    <SettingsContext.Provider value={{ settings, ready, setLevel, setExamMinutes }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): Ctx {
  const c = useContext(SettingsContext);
  if (!c) throw new Error("useSettings must be used within Providers");
  return c;
}
