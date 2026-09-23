import { describe, expect, it } from "vitest";
import { breadcrumbJsonLd, jsonLdHtml } from "@/lib/jsonld";

describe("jsonLdHtml (R3-24)", () => {
  it("kan inte stänga skripttaggen, oavsett kundtext", () => {
    const html = jsonLdHtml({ description: "Pizza </script><script>alert(1)</script> & más" });
    expect(html).not.toContain("</script");
    expect(html).not.toContain("<");
    expect(html).not.toContain(">");
    expect(html).not.toContain("&");
  });

  it("är fortfarande samma JSON-värde", () => {
    const data = { name: "A <b> & c", text: "rad\u2028två\u2029tre" };
    expect(JSON.parse(jsonLdHtml(data))).toEqual(data);
    expect(jsonLdHtml(data)).not.toMatch(/[\u2028\u2029]/);
  });
});

describe("breadcrumbJsonLd", () => {
  it("startsidan först, sidan sist, absoluta URL:er", () => {
    const data = breadcrumbJsonLd({ business: { name: "Taller Sosa", slug: "taller-sosa" }, page: { title: "Nosotros", pageSlug: "nosotros" } });
    const items = data.itemListElement as { position: number; name: string; item: string }[];
    expect(data["@type"]).toBe("BreadcrumbList");
    expect(items.map((i) => i.position)).toEqual([1, 2]);
    expect(items[0]).toMatchObject({ name: "Taller Sosa", item: expect.stringMatching(/^https?:\/\/.+\/taller-sosa$/) });
    expect(items[1]).toMatchObject({ name: "Nosotros", item: expect.stringMatching(/\/taller-sosa\/nosotros$/) });
  });

  it("en titel med </script> blir ofarlig genom jsonLdHtml", () => {
    const html = jsonLdHtml(breadcrumbJsonLd({ business: { name: "X", slug: "x" }, page: { title: "</script><script>alert(1)</script>", pageSlug: "p" } }));
    expect(html).not.toContain("</script>");
  });
});
