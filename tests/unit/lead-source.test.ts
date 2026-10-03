import { describe, expect, it } from "vitest";
import { classifyLeadSource, leadSourceLabel } from "@/lib/lead-source";

describe("classifyLeadSource", () => {
  it("is directo without referrer or utm", () => {
    expect(classifyLeadSource(null)).toBe("directo");
    expect(classifyLeadSource("")).toBe("directo");
  });

  it("classifies common referrers", () => {
    expect(classifyLeadSource("https://www.google.com.py/")).toBe("google");
    expect(classifyLeadSource("https://l.instagram.com/?u=x")).toBe("instagram");
    expect(classifyLeadSource("https://m.facebook.com/")).toBe("facebook");
    expect(classifyLeadSource("lm.facebook.com")).toBe("facebook");
    expect(classifyLeadSource("https://www.tiktok.com/@x")).toBe("tiktok");
    expect(classifyLeadSource("https://example.org/blog")).toBe("otro");
  });

  it("lets utm_source win over the referrer", () => {
    expect(classifyLeadSource("https://www.google.com/", "instagram")).toBe("instagram");
    expect(classifyLeadSource(null, "IG")).toBe("instagram");
    expect(classifyLeadSource(null, "volante")).toBe("otro");
  });

  it("does not trust look-alike hosts", () => {
    expect(classifyLeadSource("https://google.evil.com/")).toBe("otro");
    expect(classifyLeadSource("https://notinstagram.com/")).toBe("otro");
  });

  it("survives garbage", () => {
    expect(classifyLeadSource("http://")).toBe("directo");
  });

  it("labels", () => {
    expect(leadSourceLabel("google")).toBe("Google");
    expect(leadSourceLabel(null)).toBe("—");
    expect(leadSourceLabel("nope")).toBe("—");
  });
});
