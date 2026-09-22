import { describe, expect, it } from "vitest";
import { jsonLdHtml } from "@/lib/jsonld";

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
