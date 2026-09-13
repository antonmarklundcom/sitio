import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  MISSING_KEY_MESSAGE,
  POLISH_FIELDS,
  POLISH_LIMITS,
  SYSTEM_PROMPT,
  buildPolishInput,
  clampText,
  diffFields,
  hoursSummary,
  polishInputBlockers,
  renderUserPrompt,
  servicesToText,
  supportsEffort,
  validateProposal,
  wordCount,
  type PolishInput,
  type PolishResult,
} from "@/lib/ai-polish";

const business = {
  name: "Electricidad Mendoza",
  category: "servicios",
  city: "Asunción",
  zone: "Barrio Jara",
  rawDescription: "Hacemos instalaciones electricas y arreglos urgentes desde hace anos en la zona.",
  description: "Texto ya guardado",
  servicesJson: [
    { name: "Instalaciones", desc: "cables nuevos" },
    { name: "Urgencias 24h" },
    { name: "Tableros" },
  ],
  hoursJson: {
    mon: [{ open: "08:00", close: "17:00" }],
    tue: [{ open: "08:00", close: "17:00" }],
    wed: [{ open: "08:00", close: "17:00" }],
    thu: [{ open: "08:00", close: "17:00" }],
    fri: [{ open: "08:00", close: "17:00" }],
    sat: null,
    sun: null,
  },
};

const words = (n: number) => Array.from({ length: n }, (_, i) => `palabra${i}`).join(" ");

function proposal(overrides: Partial<PolishResult> = {}): PolishResult {
  return {
    description: words(100),
    seoTitle: "Electricista en Barrio Jara — Asunción",
    seoDescription: "Instalaciones y urgencias eléctricas en Asunción. Escribinos por WhatsApp.",
    services: [
      { name: "Instalaciones", desc: "Cableado nuevo y reformas." },
      { name: "Urgencias 24h", desc: "Salimos el mismo día." },
      { name: "Tableros", desc: "Armado y normalización." },
    ],
    ...overrides,
  };
}

describe("buildPolishInput", () => {
  it("plockar ut namn, bransch, ort, zon, tjänster och öppettider", () => {
    const input = buildPolishInput(business);
    expect(input.name).toBe("Electricidad Mendoza");
    expect(input.category).toBe("servicios");
    expect(input.categoryLabel).toContain("Servicios");
    expect(input.city).toBe("Asunción");
    expect(input.zone).toBe("Barrio Jara");
    expect(input.services.map((s) => s.name)).toEqual(["Instalaciones", "Urgencias 24h", "Tableros"]);
    expect(input.hoursSummary).toContain("08:00");
  });

  it("faller tillbaka på sparad description när råtexten saknas", () => {
    expect(buildPolishInput({ ...business, rawDescription: null }).rawDescription).toBe("Texto ya guardado");
    expect(buildPolishInput({ ...business, rawDescription: null, description: null }).rawDescription).toBe("");
  });

  it("kastar aldrig på trasig servicesJson", () => {
    expect(buildPolishInput({ ...business, servicesJson: null }).services).toEqual([]);
    expect(buildPolishInput({ ...business, servicesJson: "nej" }).services).toEqual([]);
    expect(buildPolishInput({ ...business, servicesJson: [{ name: "" }, null] }).services).toEqual([]);
  });
});

describe("hoursSummary", () => {
  it("säger ifrån när inga tider är laddade", () => {
    expect(hoursSummary(null)).toBe("sin horario cargado");
  });

  it("slår ihop dagar och markerar stängt", () => {
    const summary = hoursSummary(business.hoursJson);
    expect(summary).toContain("08:00–17:00");
    expect(summary).toContain("cerrado");
  });
});

describe("polishInputBlockers", () => {
  it("släpper igenom en komplett sajt", () => {
    expect(polishInputBlockers(buildPolishInput(business))).toEqual([]);
  });

  it("stoppar anropet när underlaget inte räcker", () => {
    const thin = buildPolishInput({ ...business, rawDescription: "kort", description: null, servicesJson: [], city: null });
    expect(thin.rawDescription.length).toBeLessThan(20);
    expect(polishInputBlockers(thin)).toHaveLength(3);
  });
});

describe("systemprompten", () => {
  it("bär varje guardrail från plan.md §5.3", () => {
    expect(SYSTEM_PROMPT).toContain("voseo");
    expect(SYSTEM_PROMPT).toContain("Nunca inventes datos");
    expect(SYSTEM_PROMPT).toContain("el mejor");
    expect(SYSTEM_PROMPT).toContain("garantizado");
    expect(SYSTEM_PROMPT).toContain("salud o belleza");
    expect(SYSTEM_PROMPT).toContain(String(POLISH_LIMITS.seoTitleMaxChars));
    expect(SYSTEM_PROMPT).toContain(String(POLISH_LIMITS.seoDescriptionMaxChars));
    expect(SYSTEM_PROMPT).toContain(String(POLISH_LIMITS.serviceDescMaxChars));
  });
});

describe("renderUserPrompt", () => {
  const input = buildPolishInput(business);
  const prompt = renderUserPrompt(input);

  it("innehåller varje fält som byggaren plockade fram", () => {
    expect(prompt).toContain(input.name);
    expect(prompt).toContain(input.category);
    expect(prompt).toContain(input.categoryLabel);
    expect(prompt).toContain(input.city);
    expect(prompt).toContain(input.zone);
    expect(prompt).toContain(input.hoursSummary);
    expect(prompt).toContain(input.rawDescription);
    for (const service of input.services) expect(prompt).toContain(service.name);
  });

  it("skickar med tjänsternas nuvarande texter och antalet", () => {
    expect(prompt).toContain("servicios (3)");
    expect(prompt).toContain("texto actual: cables nuevos");
  });

  it("skriver 'sin dato' i stället för tomma rader", () => {
    const bare = renderUserPrompt(buildPolishInput({ ...business, city: null, zone: null }));
    expect(bare).toContain("ciudad: sin dato");
    expect(bare).toContain("zona/barrio: sin dato");
  });
});

describe("clampText och wordCount", () => {
  it("räknar ord utan att snubbla på tomrum", () => {
    expect(wordCount("")).toBe(0);
    expect(wordCount("   ")).toBe(0);
    expect(wordCount("ett  två\ntre")).toBe(3);
  });

  it("lämnar text under taket orörd", () => {
    expect(clampText("kort", 20)).toBe("kort");
  });

  it("kapar vid ordgräns och tar bort släpande skiljetecken", () => {
    const cut = clampText("Instalaciones eléctricas para casas y comercios en todo Asunción", 30);
    expect(cut.length).toBeLessThanOrEqual(30);
    expect(cut.endsWith(" ")).toBe(false);
    expect(cut).toBe("Instalaciones eléctricas para");
  });

  it("kapar hårt när ett enda ord är längre än taket", () => {
    expect(clampText("a".repeat(50), 10)).toHaveLength(10);
  });
});

describe("validateProposal — tjänsteantalet", () => {
  const input = buildPolishInput(business);

  it("avvisar när modellen returnerar färre tjänster än indata", () => {
    const result = validateProposal(input, proposal({ services: proposal().services.slice(0, 2) }));
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toContain("2 tjänster men sajten har 3");
  });

  it("avvisar när modellen hittar på en extra tjänst", () => {
    const services = [...proposal().services, { name: "Paneles solares", desc: "Hittepå." }];
    const result = validateProposal(input, proposal({ services }));
    expect(result.ok).toBe(false);
  });

  it("behåller ALLTID indatas tjänstenamn, även om modellen döper om dem", () => {
    const services = proposal().services.map((s) => ({ ...s, name: `${s.name} PREMIUM` }));
    const result = validateProposal(input, proposal({ services }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.services.map((s) => s.name)).toEqual(input.services.map((s) => s.name));
  });
});

describe("validateProposal — längder", () => {
  const input = buildPolishInput(business);

  it("godkänner ett förslag inom gränserna utan varningar", () => {
    const result = validateProposal(input, proposal());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.warnings).toEqual([]);
      expect(result.value.seoTitle.length).toBeLessThanOrEqual(POLISH_LIMITS.seoTitleMaxChars);
    }
  });

  it("klampar en seo-titel som är lite för lång och varnar", () => {
    const long = `Electricista matriculado con urgencias en toda la zona de Asunción`;
    expect(long.length).toBeGreaterThan(POLISH_LIMITS.seoTitleMaxChars);
    const result = validateProposal(input, proposal({ seoTitle: long }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.seoTitle.length).toBeLessThanOrEqual(POLISH_LIMITS.seoTitleMaxChars);
      expect(result.warnings.join(" ")).toContain("Seo-titeln kortades");
    }
  });

  it("klampar seo-beskrivning och tjänstetexter vid sina tak", () => {
    const result = validateProposal(
      input,
      proposal({
        seoDescription: `${"Instalaciones eléctricas en Asunción. ".repeat(6)}`,
        services: proposal().services.map((s, i) => (i === 0 ? { ...s, desc: "Cableado nuevo. ".repeat(12) } : s)),
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.seoDescription.length).toBeLessThanOrEqual(POLISH_LIMITS.seoDescriptionMaxChars);
      expect(result.value.services[0].desc.length).toBeLessThanOrEqual(POLISH_LIMITS.serviceDescMaxChars);
      expect(result.warnings.join(" ")).toContain("Instalaciones");
    }
  });

  it("avvisar ett fält som är mer än dubbelt så långt som taket", () => {
    const result = validateProposal(input, proposal({ seoDescription: "x".repeat(POLISH_LIMITS.seoDescriptionMaxChars * 2 + 1) }));
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toContain("dubbelt så långa");
  });

  it("avvisar en beskrivning som är absurt kort eller absurt lång", () => {
    expect(validateProposal(input, proposal({ description: words(10) })).ok).toBe(false);
    expect(validateProposal(input, proposal({ description: words(400) })).ok).toBe(false);
  });

  it("varnar men släpper igenom en beskrivning strax utanför 80–160 ord", () => {
    const result = validateProposal(input, proposal({ description: words(60) }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.warnings.join(" ")).toContain("60 ord");
  });

  it("avvisar tomma fält", () => {
    expect(validateProposal(input, proposal({ description: "   " })).ok).toBe(false);
    expect(validateProposal(input, proposal({ seoTitle: "" })).ok).toBe(false);
    expect(validateProposal(input, proposal({ seoDescription: "  " })).ok).toBe(false);
  });

  it("avvisar ett svar som inte matchar schemat alls", () => {
    const result = validateProposal(input, { description: 5 });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toContain("fel format");
  });

  it("varnar när seo-titeln inte nämner staden", () => {
    const result = validateProposal(input, proposal({ seoTitle: "Electricista matriculado" }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.warnings.join(" ")).toContain("Asunción");
  });
});

describe("diffFields", () => {
  const current = {
    description: "Texto viejo",
    seoTitle: "Electricista",
    seoDescription: "Vieja meta",
    services: [{ name: "Instalaciones", desc: "cables nuevos" }],
  };

  it("täcker exakt de fyra fält putsen äger", () => {
    const diffs = diffFields(current, proposal());
    expect(diffs.map((d) => d.key)).toEqual([...POLISH_FIELDS]);
    expect(POLISH_FIELDS).toEqual(["description", "seoTitle", "seoDescription", "services"]);
  });

  it("markerar ändrade fält", () => {
    const diffs = diffFields(current, proposal());
    expect(diffs.every((d) => d.changed)).toBe(true);
  });

  it("markerar oförändrade fält som oförändrade", () => {
    const p = proposal();
    const identical = {
      description: p.description,
      seoTitle: p.seoTitle,
      seoDescription: p.seoDescription,
      services: p.services,
    };
    expect(diffFields(identical, p).some((d) => d.changed)).toBe(false);
  });

  it("behandlar null som tom sträng, inte som en ändring till 'null'", () => {
    const diffs = diffFields({ description: null, seoTitle: null, seoDescription: null, services: [] }, proposal());
    expect(diffs[0].current).toBe("");
    expect(diffs.every((d) => d.changed)).toBe(true);
  });

  it("visar tjänster som en rad per tjänst", () => {
    expect(servicesToText([{ name: "Tableros" }])).toBe("Tableros — (ingen text)");
    expect(servicesToText([{ name: "Tableros", desc: "Armado" }])).toBe("Tableros — Armado");
  });
});

describe("supportsEffort", () => {
  it("skickar effort till Opus och Sonnet 5", () => {
    expect(supportsEffort("claude-opus-5")).toBe(true);
    expect(supportsEffort("claude-sonnet-5")).toBe(true);
  });

  it("utelämnar effort för modellerna som svarar 400 på den", () => {
    expect(supportsEffort("claude-haiku-4-5")).toBe(false);
    expect(supportsEffort("claude-sonnet-4-5")).toBe(false);
  });
});

describe("felmeddelandet utan nyckel", () => {
  it("är den sträng panelen och röktestet letar efter", () => {
    expect(MISSING_KEY_MESSAGE).toBe("ANTHROPIC_API_KEY saknas i miljön");
  });

  /**
   * Panelen är en klientkomponent och får inte importera ett värde härifrån —
   * det hade lagt hela Anthropic-SDK:n i webbläsarbundeln. Strängen är därför
   * dubblerad, och den här kontrollen är det som hindrar den från att glida isär.
   */
  it("står ordagrant i polish-panel.tsx, som har en egen kopia", () => {
    const panel = readFileSync(new URL("../../src/components/admin/polish-panel.tsx", import.meta.url), "utf8");
    expect(panel).toContain(`"${MISSING_KEY_MESSAGE}"`);
    expect(panel).toContain('import type { FieldDiff, PolishUsage } from "@/lib/ai-polish"');
    // Bara `import type` får peka hit — ett värdeimport drar in SDK:n.
    expect(panel).not.toMatch(/^import (?!type )[^\n]*from "@\/lib\/ai-polish"/m);
  });
});

// Typvakt: PolishInput måste fortsätta beskriva exakt det prompten renderar.
const _shape: PolishInput = buildPolishInput(business);
void _shape;
