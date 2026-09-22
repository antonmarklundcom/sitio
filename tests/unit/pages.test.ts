import { describe, expect, it } from "vitest";
import {
  PAGE_TYPES,
  PAGE_TYPE_DEFAULTS,
  newPageSchema,
  pageContent,
  pageContentSchema,
  pageDescription,
  pageSlugFor,
  paragraphs,
} from "@/lib/pages";

describe("extra sidor (R3-25)", () => {
  it("varje typ utom custom har en fast slug och titel", () => {
    for (const t of PAGE_TYPES) {
      if (t === "custom") continue;
      expect(PAGE_TYPE_DEFAULTS[t].slug).toMatch(/^[a-z]+$/);
      expect(pageSlugFor(t, "vad som helst")).toBe(PAGE_TYPE_DEFAULTS[t].slug);
    }
  });

  it("custom slugifieras från titeln, eller från en egen slug", () => {
    expect(pageSlugFor("custom", "Preguntas frecuentes")).toBe("preguntas-frecuentes");
    expect(pageSlugFor("custom", "Otra cosa", "Envíos y Pagos")).toBe("envios-y-pagos");
    expect(pageSlugFor("custom", "¡¡!!")).toBe("");
  });

  it("pageContent tål skräp i contentJson", () => {
    expect(pageContent({ body: "Hola" })).toEqual({ body: "Hola" });
    expect(pageContent(null)).toEqual({ body: "" });
    expect(pageContent({ body: 7 })).toEqual({ body: "" });
    expect(pageContent("text")).toEqual({ body: "" });
  });

  it("stycken delas på tomrad, radbrytningar inom stycket blir mellanslag", () => {
    expect(paragraphs("Uno\ndos\r\n\r\n\n  Tres  \n\n")).toEqual(["Uno dos", "Tres"]);
    expect(paragraphs("   ")).toEqual([]);
  });

  it("beskrivningen är första stycket, kapad vid ett ord", () => {
    expect(pageDescription("Corto.\n\nSegundo.")).toBe("Corto.");
    const long = "palabra ".repeat(40).trim();
    const d = pageDescription(long) ?? "";
    expect(d.length).toBeLessThanOrEqual(156);
    expect(d.endsWith("…")).toBe(true);
    expect(pageDescription("")).toBeUndefined();
  });

  it("scheman: titel krävs, typ måste finnas", () => {
    expect(pageContentSchema.safeParse({ title: "Nosotros", body: "" }).success).toBe(true);
    expect(pageContentSchema.safeParse({ title: "N", body: "" }).success).toBe(false);
    expect(newPageSchema.safeParse({ type: "nosotros", title: "" }).success).toBe(true);
    expect(newPageSchema.safeParse({ type: "blog" }).success).toBe(false);
  });
});
