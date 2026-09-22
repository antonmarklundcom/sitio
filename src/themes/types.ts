import type { Business, Media } from "@/db/schema";
import type { MenuSectionRow } from "@/db/menu-queries";
import type { ProductRow } from "@/db/product-queries";

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
  /** Produkterna (products-modulen, PR-14). Tom lista när modulen är av. */
  products: ProductRow[];
  /** Länkar till extra sidor (extra_pages, R3-25). Tom lista när modulen är av. */
  pages?: SitePageLink[];
};

export type SitePageLink = { href: string; title: string };
