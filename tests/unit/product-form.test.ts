import { describe, expect, it } from "vitest";
import { PRODUCTS_MAX, productFromForm, productSchema } from "@/lib/product-form";

function form(values: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

describe("product-form", () => {
  it("acepta un producto válido con precio", () => {
    const parsed = productFromForm(
      form({ name: "Silla de madera", description: "Roble macizo", priceGs: "450000", isVisible: "on" }),
    );
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).toEqual({
        name: "Silla de madera",
        description: "Roble macizo",
        priceGs: 450000,
        isVisible: true,
      });
    }
  });

  it("precio vacío se convierte en null (A consultar)", () => {
    const parsed = productFromForm(form({ name: "Mesa a medida", priceGs: "", isVisible: "on" }));
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.priceGs).toBeNull();
  });

  it("el precio ignora puntos y otros caracteres no numéricos", () => {
    const parsed = productFromForm(form({ name: "Ropero", priceGs: "1.250.000 Gs", isVisible: "on" }));
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.priceGs).toBe(1250000);
  });

  it("rechaza un precio demasiado grande", () => {
    const parsed = productFromForm(form({ name: "Terreno", priceGs: "9999999999999", isVisible: "on" }));
    expect(parsed.success).toBe(false);
  });

  it("isVisible ausente en el checkbox se lee como false", () => {
    const parsed = productFromForm(form({ name: "Producto oculto", priceGs: "1000" }));
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.isVisible).toBe(false);
  });

  it("rechaza un nombre demasiado corto", () => {
    const parsed = productFromForm(form({ name: "A", priceGs: "1000", isVisible: "on" }));
    expect(parsed.success).toBe(false);
  });

  it("rechaza un nombre demasiado largo", () => {
    const parsed = productFromForm(form({ name: "x".repeat(121), priceGs: "", isVisible: "on" }));
    expect(parsed.success).toBe(false);
  });

  it("descripción es opcional", () => {
    expect(productSchema.safeParse({ name: "Sin detalle", priceGs: "", isVisible: true }).success).toBe(true);
  });

  it("PRODUCTS_MAX está fijado en 60", () => {
    expect(PRODUCTS_MAX).toBe(60);
  });
});

describe("pris som människor skriver det (R3-32)", () => {
  it("'35 mil' och '15.000,50' nekas i stället för att bli fel belopp", () => {
    expect(productFromForm(form({ name: "Silla", priceGs: "35 mil", isVisible: "on" })).success).toBe(false);
    expect(productFromForm(form({ name: "Silla", priceGs: "15.000,50", isVisible: "on" })).success).toBe(false);
  });

  it("'15.000,00' är femtontusen, inte en och en halv miljon", () => {
    const parsed = productFromForm(form({ name: "Silla", priceGs: "15.000,00", isVisible: "on" }));
    expect(parsed.success && parsed.data.priceGs).toBe(15000);
  });
});
