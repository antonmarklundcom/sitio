import { describe, expect, it } from "vitest";
import { optionalHttpUrlEs, optionalPyPhoneEs } from "@/lib/form-fields";
import { ownerFormSchema } from "@/lib/owner-form";

describe("optionalPyPhoneEs (R3-42)", () => {
  it("tomt är tomt, ett nummer normaliseras", () => {
    expect(optionalPyPhoneEs.parse("")).toBe("");
    expect(optionalPyPhoneEs.parse("  ")).toBe("");
    expect(optionalPyPhoneEs.parse("021 234 567")).toBe("+59521234567");
    expect(optionalPyPhoneEs.parse("0981 123 456")).toBe("+595981123456");
  });
  it("skräp och för långt ger ett spanskt meddelande", () => {
    const bad = optionalPyPhoneEs.safeParse("llamar a Juan");
    expect(bad.success).toBe(false);
    expect(bad.error?.issues[0]?.message).toMatch(/no parece paraguayo/);
    const long = optionalPyPhoneEs.safeParse("0".repeat(40));
    expect(long.error?.issues[0]?.message).toMatch(/demasiado largo/);
  });
});

describe("optionalHttpUrlEs (R3-42)", () => {
  const url = optionalHttpUrlEs("https://instagram.com/tu-negocio");
  it("tomt eller en fullständig länk", () => {
    expect(url.parse("")).toBe("");
    expect(url.parse(" https://instagram.com/pan ")).toBe("https://instagram.com/pan");
    expect(url.parse("http://x.com")).toBe("http://x.com");
  });
  it("@konto, ett domännamn utan schema eller javascript: nekas", () => {
    for (const bad of ["@panaderia", "instagram.com/pan", "javascript:alert(1)", "https://a b"]) {
      expect(url.safeParse(bad).success).toBe(false);
    }
    expect(url.safeParse("@pan").error?.issues[0]?.message).toMatch(/enlace completo/);
  });
});

describe("ownerFormSchema använder dem", () => {
  const base = {
    name: "Pan",
    description: "x".repeat(80),
    address: "",
    zone: "",
    city: "Asunción",
    secondaryPhone: "",
    mapsUrl: "",
    instagram: "",
    facebook: "",
    tiktok: "",
  };
  it("mapsUrl och andra nummer valideras", () => {
    expect(ownerFormSchema.safeParse({ ...base, mapsUrl: "Calle Palma 123" }).success).toBe(false);
    expect(ownerFormSchema.safeParse({ ...base, secondaryPhone: "abc" }).success).toBe(false);
    const ok = ownerFormSchema.parse({ ...base, secondaryPhone: "021 234 567", mapsUrl: "https://maps.app.goo.gl/x" });
    expect(ok.secondaryPhone).toBe("+59521234567");
  });
});
