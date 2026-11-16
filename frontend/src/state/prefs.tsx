import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { ProfileKey } from "../api/types";

export type Density = "guided" | "terminal";

interface Prefs {
  profile: ProfileKey | null;
  setProfile: (p: ProfileKey | null) => void;
  density: Density;
  setDensity: (d: Density) => void;
}

const PrefsContext = createContext<Prefs | null>(null);

// Per-browser conveniences only; every read/write is guarded (private mode, blocked storage).
function load<T extends string>(key: string, allowed: readonly T[]): T | null {
  try {
    const v = localStorage.getItem(key);
    return v && (allowed as readonly string[]).includes(v) ? (v as T) : null;
  } catch {
    return null;
  }
}
function save(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: keep in memory only */
  }
}

const PROFILES = ["conservative", "moderate", "aggressive"] as const;
const DENSITIES = ["guided", "terminal"] as const;

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [profile, setProfileState] = useState<ProfileKey | null>(() => load("ie.profile", PROFILES));
  const [density, setDensityState] = useState<Density>(() => load("ie.density", DENSITIES) ?? "guided");

  useEffect(() => {
    document.documentElement.dataset.density = density;
  }, [density]);

  const value = useMemo<Prefs>(
    () => ({
      profile,
      setProfile: (p) => {
        setProfileState(p);
        save("ie.profile", p);
      },
      density,
      setDensity: (d) => {
        setDensityState(d);
        save("ie.density", d);
      },
    }),
    [profile, density],
  );
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs(): Prefs {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error("usePrefs must be used inside PrefsProvider");
  return ctx;
}
