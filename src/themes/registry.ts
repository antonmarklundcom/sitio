import type { ComponentType } from "react";
import { ComercioTheme } from "./comercio/comercio-theme";
import { GastronomiaTheme } from "./gastronomia/gastronomia-theme";
import { SaludTheme } from "./salud/salud-theme";
import { ServiciosTheme } from "./servicios/servicios-theme";
import type { ThemeProps } from "./types";

/**
 * themeKey → komponent. Teman som ännu inte är byggda faller tillbaka på
 * servicios; fallbacken är avsiktlig och inte tyst — admin visar vilka teman
 * som är byggda, så en fallback betyder att temat är på väg. `belleza` och
 * `taller` får aldrig en egen post: de är kategorier som renderar på
 * `salud` respektive `servicios` med en låst variant (plan §1.12).
 */
const THEMES: Record<string, ComponentType<ThemeProps>> = {
  servicios: ServiciosTheme,
  gastronomia: GastronomiaTheme,
  comercio: ComercioTheme,
  salud: SaludTheme,
};

/** Byggda teman i registerordning — används av admin och av QA-scriptet. */
export const BUILT_THEMES = Object.keys(THEMES);

export function themeComponent(themeKey: string): ComponentType<ThemeProps> {
  return THEMES[themeKey] ?? ServiciosTheme;
}

export function isThemeBuilt(themeKey: string): boolean {
  return themeKey in THEMES;
}
