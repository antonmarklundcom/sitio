import { describe, expect, it } from "vitest";
import {
  BUSINESS_STATUSES,
  CATEGORIES,
  CATEGORY_LABELS,
  STATUS_TRANSITIONS,
  THEME_KEYS,
  businessFieldErrors,
  canTransition,
  hoursFromFormData,
  hoursSchema,
  publishBlockers,
  servicesFromFormData,
  servicesSchema,
} from "@/lib/business";

describe("canTransition", () => {
  it("tillåter de dokumenterade stegen framåt", () => {
    expect(canTransition("draft", "pending_review")).toBe(true);
    expect(canTransition("pending_review", "published")).toBe(true);
    expect(canTransition("published", "paused")).toBe(true);
    expect(canTransition("paused", "published")).toBe(true);
    expect(canTransition("archived", "draft")).toBe(true);
  });

  it("tillåter aldrig en publicerad sajt att gå tillbaka till utkast", () => {
    expect(canTransition("published", "draft")).toBe(false);
    expect(canTransition("published", "pending_review")).toBe(false);
  });

  it("tillåter aldrig en övergång till sig själv", () => {
    for (const status of BUSINESS_STATUSES) expect(canTransition(status, status)).toBe(false);
  });

  it("låter arkivering vara möjlig från allt utom arkiverad", () => {
    for (const status of BUSINESS_STATUSES) {
      expect(canTransition(status, "archived")).toBe(status !== "archived");
    }
  });

  it("täcker alla statusar i övergångstabellen", () => {
    for (const status of BUSINESS_STATUSES) expect(STATUS_TRANSITIONS[status]).toBeDefined();
  });
});

describe("register", () => {
  it("har en etikett för varje kategori", () => {
    for (const c of CATEGORIES) expect(CATEGORY_LABELS[c]).toBeTruthy();
  });

  it("har 'otro' som kategori men inte som tema", () => {
    expect(CATEGORIES).toContain("otro");
    expect(THEME_KEYS as readonly string[]).not.toContain("otro");
  });
});

describe("publishBlockers", () => {
  const complete = {
    description: "x".repeat(120),
    servicesJson: [{ name: "a" }, { name: "b" }],
    whatsappPhone: "+595981123456",
    whatsappVerifiedAt: new Date("2026-09-01"),
    city: "Asunción",
    seoDescription: "En beskrivning.",
  };

  it("släpper igenom en komplett sajt", () => {
    expect(publishBlockers(complete, 1)).toEqual([]);
  });

  it("stoppar tunn beskrivning", () => {
    expect(publishBlockers({ ...complete, description: "kort" }).join(" ")).toMatch(/80 tecken/);
  });

  it("kräver minst två tjänster", () => {
    expect(publishBlockers({ ...complete, servicesJson: [{ name: "a" }] })).toHaveLength(1);
    expect(publishBlockers({ ...complete, servicesJson: null })).toHaveLength(1);
  });

  it("kräver verifierat WhatsApp-nummer", () => {
    expect(publishBlockers({ ...complete, whatsappVerifiedAt: null })).toHaveLength(1);
    expect(publishBlockers({ ...complete, whatsappPhone: null, whatsappVerifiedAt: null })).toHaveLength(2);
  });

  it("kräver minst ett foto", () => {
    expect(publishBlockers(complete, 0).join(" ")).toMatch(/foto/);
  });

  it("listar varje sak som saknas, inte bara den första", () => {
    const blockers = publishBlockers(
      { description: null, servicesJson: [], whatsappPhone: null, whatsappVerifiedAt: null, city: null, seoDescription: null },
      0,
    );
    expect(blockers).toHaveLength(7);
  });
});

describe("hoursFromFormData", () => {
  it("läser två pass per dag och lämnar resten stängda", () => {
    const fd = new FormData();
    fd.set("hours.mon.0.open", "08:00");
    fd.set("hours.mon.0.close", "12:00");
    fd.set("hours.mon.1.open", "14:00");
    fd.set("hours.mon.1.close", "18:00");
    const hours = hoursFromFormData(fd);
    expect(hours.mon).toEqual([{ open: "08:00", close: "12:00" }, { open: "14:00", close: "18:00" }]);
    expect(hours.sun).toBeNull();
  });

  it("respekterar stängd-kryssrutan även när tider är ifyllda", () => {
    const fd = new FormData();
    fd.set("hours.tue.closed", "on");
    fd.set("hours.tue.0.open", "08:00");
    fd.set("hours.tue.0.close", "12:00");
    expect(hoursFromFormData(fd).tue).toBeNull();
  });

  it("ignorerar halvifyllda pass", () => {
    const fd = new FormData();
    fd.set("hours.wed.0.open", "08:00");
    expect(hoursFromFormData(fd).wed).toBeNull();
  });

  it("sparar 19:00–00:00 som ett pass till midnatt och schemat godtar det (R3-28)", () => {
    const fd = new FormData();
    fd.set("hours.fri.0.open", "19:00");
    fd.set("hours.fri.0.close", "00:00");
    const hours = hoursFromFormData(fd);
    expect(hours.fri).toEqual([{ open: "19:00", close: "00:00" }]);
    expect(hoursSchema.safeParse(hours).success).toBe(true);
  });

  it("slår ihop överlappande pass och sorterar dem", () => {
    const fd = new FormData();
    fd.set("hours.mon.0.open", "14:00");
    fd.set("hours.mon.0.close", "19:00");
    fd.set("hours.mon.1.open", "08:00");
    fd.set("hours.mon.1.close", "15:00");
    expect(hoursFromFormData(fd).mon).toEqual([{ open: "08:00", close: "19:00" }]);
  });

  it("kastar felformade tider och pass som slutar före start", () => {
    const fd = new FormData();
    fd.set("hours.thu.0.open", "8");
    fd.set("hours.thu.0.close", "12:00");
    fd.set("hours.thu.1.open", "18:00");
    fd.set("hours.thu.1.close", "09:00");
    expect(hoursFromFormData(fd).thu).toBeNull();
  });
});

describe("servicesFromFormData", () => {
  it("parar ihop namn och beskrivningar och trimmar", () => {
    const fd = new FormData();
    fd.append("service.name", " Instalación ");
    fd.append("service.desc", " Eléctrica ");
    fd.append("service.name", "Reparación");
    fd.append("service.desc", "");
    expect(servicesFromFormData(fd)).toEqual([
      { name: "Instalación", desc: "Eléctrica" },
      { name: "Reparación", desc: undefined },
    ]);
  });

  it("kastar rader utan namn", () => {
    const fd = new FormData();
    fd.append("service.name", "   ");
    fd.append("service.desc", "föräldralös");
    expect(servicesFromFormData(fd)).toEqual([]);
  });
});

describe("servicesSchema + businessFieldErrors (R3-39)", () => {
  it("tar emot det intaken och ägarpanelen tar emot: 120/300 tecken", () => {
    const ok = servicesSchema.safeParse([{ name: "a".repeat(120), desc: "b".repeat(300) }]);
    expect(ok.success).toBe(true);
    const tooLong = servicesSchema.safeParse([{ name: "a".repeat(121) }]);
    expect(tooLong.success).toBe(false);
  });

  it("samlar nästlade fel under servicesJson och hoursJson med raden", () => {
    const services = [{ name: "Corte" }, { name: "x".repeat(121) }];
    const errors = businessFieldErrors(
      [
        { path: ["servicesJson", 1, "name"], message: "Max 120 tecken." },
        { path: ["hoursJson", "fri", 0], message: "Stängningstiden måste vara efter öppningstiden." },
        { path: ["name"], message: "Namn krävs." },
      ],
      services,
    );
    expect(errors.servicesJson).toBe(`Servicio 2 («${"x".repeat(30)}…»): Max 120 tecken.`);
    expect(errors.hoursJson).toBe("Viernes: Stängningstiden måste vara efter öppningstiden.");
    expect(errors.name).toBe("Namn krävs.");
    expect(errors["servicesJson.1.name"]).toBeUndefined();
  });

  it("första felet per fält vinner", () => {
    const errors = businessFieldErrors(
      [
        { path: ["servicesJson", 0, "name"], message: "A" },
        { path: ["servicesJson", 1, "desc"], message: "B" },
      ],
      [{ name: "" }, { name: "Y" }],
    );
    expect(errors.servicesJson).toBe("Servicio 1: A");
  });
});
