import { describe, expect, it } from "vitest";
import { routeArea } from "@/lib/route-area";
import { isReservedSlug } from "@/lib/slug";

describe("routeArea (R3-31)", () => {
  it("adminet och ägarpanelen är hela segment", () => {
    expect(routeArea("/admin")).toBe("admin");
    expect(routeArea("/admin/sitios/1")).toBe("admin");
    expect(routeArea("/mi-sitio")).toBe("owner");
    expect(routeArea("/mi-sitio/login")).toBe("owner");
  });

  it("kundsluggar som börjar likadant är publika", () => {
    expect(routeArea("/administradora-lopez")).toBe("public");
    expect(routeArea("/admin-consultores/nosotros")).toBe("public");
    expect(routeArea("/mi-sitio-web")).toBe("public");
    expect(routeArea("/")).toBe("public");
  });
});

describe("reserverade sluggar för appens egna routes", () => {
  it.each(["registro", "reporte", "opengraph-image", "admin", "mi-sitio"])("%s är reserverad", (slug) => {
    expect(isReservedSlug(slug)).toBe(true);
  });
});
