import type { Business, Media } from "@/db/schema";
import type { MenuSectionRow } from "@/db/menu-queries";

export type ThemeMedia = Pick<Media, "id" | "kind" | "variantsJson" | "altText" | "width" | "height" | "sortOrder">;

export type ThemeProps = {
  business: Business;
  photos: ThemeMedia[];
  logo: ThemeMedia | null;
  hero: ThemeMedia | null;
  /** Aktiva modulnycklar. Sektioner renderas villkorat mot denna. */
  modules: Set<string>;
  /** Menyn (menu-modulen). Tom lista när modulen är av — temat behöver inte fråga. */
  menu: MenuSectionRow[];
};
