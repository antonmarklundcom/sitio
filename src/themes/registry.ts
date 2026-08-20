import type { ComponentType } from "react";
import { ServiciosTheme } from "./servicios/servicios-theme";
import type { ThemeProps } from "./types";

/**
 * themeKey → komponent. Teman som ännu inte är byggda faller tillbaka på
 * servicios; fallbacken är avsiktlig och inte tyst — admin väljer bara teman
 * ur listan, så en fallback betyder att temat är på väg (PR-07, PR-15).
 */
const THEMES: Record<string, ComponentType<ThemeProps>> = {
  servicios: ServiciosTheme,
};

export function themeComponent(themeKey: string): ComponentType<ThemeProps> {
  return THEMES[themeKey] ?? ServiciosTheme;
}

export function isThemeBuilt(themeKey: string): boolean {
  return themeKey in THEMES;
}
