import { describe, expect, it } from "vitest";
import { RESERVED_SLUGS, isReservedSlug, slugify, uniqueSlugCandidate, validateSlug } from "@/lib/slug";

describe("isReservedSlug", () => {
  it("fångar systemsökvägar oavsett versaler", () => {
    expect(isReservedSlug("admin")).toBe(true);
    expect(isReservedSlug("ADMIN")).toBe(true);
    expect(isReservedSlug("mi-sitio")).toBe(true);
  });

  it("släpper igenom vanliga kundslugs", () => {
    expect(isReservedSlug("pizzeria-la-nona")).toBe(false);
  });

  it("reserverar routingens egna filer", () => {
    for (const s of ["api", "media", "sitemap.xml", "robots.txt", "_next"]) {
      expect(RESERVED_SLUGS.has(s)).toBe(true);
    }
  });
});

describe("slugify", () => {
  it("strippar accenter och gör om ñ till n", () => {
    expect(slugify("Peluquería Ñandutí")).toBe("peluqueria-nanduti");
  });

  it("slår ihop skiljetecken till ett bindestreck", () => {
    expect(slugify("Taller  &  Repuestos, S.A.")).toBe("taller-repuestos-s-a");
  });

  it("trimmar bindestreck i kanterna", () => {
    expect(slugify("  --hola--  ")).toBe("hola");
  });

  it("kapar vid 60 tecken utan avslutande bindestreck", () => {
    const out = slugify("a".repeat(58) + " bcd");
    expect(out.length).toBeLessThanOrEqual(60);
    expect(out.endsWith("-")).toBe(false);
  });

  it("ger tom sträng när inget kan slugifieras", () => {
    expect(slugify("!!!")).toBe("");
  });
});

describe("validateSlug", () => {
  it("accepterar en giltig slug och normaliserar till gemener", () => {
    expect(validateSlug("  Pizzeria-La-Nona ")).toEqual({ ok: true, slug: "pizzeria-la-nona" });
  });

  it("avvisar för korta slugs", () => {
    expect(validateSlug("ab").ok).toBe(false);
  });

  it("avvisar för långa slugs", () => {
    expect(validateSlug("a".repeat(61)).ok).toBe(false);
  });

  it("avvisar bindestreck i kanterna och dubbla bindestreck", () => {
    expect(validateSlug("-hola").ok).toBe(false);
    expect(validateSlug("hola-").ok).toBe(false);
    expect(validateSlug("ho--la").ok).toBe(false);
  });

  it("avvisar icke-tillåtna tecken", () => {
    expect(validateSlug("hola_mundo").ok).toBe(false);
    expect(validateSlug("peluquería").ok).toBe(false);
  });

  it("avvisar reserverade slugs med eget felmeddelande", () => {
    const result = validateSlug("admin");
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toMatch(/reservado/);
  });
});

describe("uniqueSlugCandidate", () => {
  it("ger basen när den är ledig", () => {
    expect(uniqueSlugCandidate("Pizzería La Nona", new Set())).toBe("pizzeria-la-nona");
  });

  it("räknar upp tills den hittar en ledig", () => {
    const taken = new Set(["taller-lopez", "taller-lopez-2"]);
    expect(uniqueSlugCandidate("Taller López", taken)).toBe("taller-lopez-3");
  });

  it("hoppar över reserverade baser", () => {
    expect(uniqueSlugCandidate("admin", new Set())).toBe("admin-2");
  });

  it("faller tillbaka på 'negocio' när namnet inte går att slugifiera", () => {
    expect(uniqueSlugCandidate("!!!", new Set())).toBe("negocio");
  });
});
