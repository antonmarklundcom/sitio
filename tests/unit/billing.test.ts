import { describe, expect, it } from "vitest";
import {
  GRACE_DAYS,
  ownerPaymentReportSchema,
  ownerReportPeriod,
  PLANS,
  PLAN_LABELS,
  PLAN_SUGGESTED_PRICE_GS,
  SUBSCRIPTION_STATUSES,
  addDays,
  addYear,
  daysUntil,
  lifecycleStatus,
  todayAsuncion,
  paymentFormSchema,
  renewalMessage,
  subscriptionFormSchema,
  toDayString,
} from "@/lib/billing";

describe("datummatematik", () => {
  it("toDayString kapar både Date och sträng till YYYY-MM-DD", () => {
    expect(toDayString("2026-09-13T22:00:00Z")).toBe("2026-09-13");
    expect(toDayString(new Date("2026-09-13T22:00:00Z"))).toBe("2026-09-13");
  });

  it("addDays flyttar över månadsskiftet", () => {
    expect(toDayString(addDays("2026-01-30", 3))).toBe("2026-02-02");
  });

  it("addDays går bakåt med negativa värden", () => {
    expect(toDayString(addDays("2026-03-01", -1))).toBe("2026-02-28");
  });

  it("addYear ger samma datum ett år senare", () => {
    expect(toDayString(addYear("2026-09-13"))).toBe("2027-09-13");
  });

  it("addYear skjuter skottdagen till 1 mars i stället för att korta perioden", () => {
    expect(toDayString(addYear("2028-02-29"))).toBe("2029-03-01");
  });

  it("daysUntil räknar hela dygn i båda riktningarna", () => {
    expect(daysUntil("2026-09-20", "2026-09-13")).toBe(7);
    expect(daysUntil("2026-09-13", "2026-09-13")).toBe(0);
    expect(daysUntil("2026-09-01", "2026-09-13")).toBe(-12);
  });
});

describe("lifecycleStatus", () => {
  const today = "2026-09-13";

  it("håller en betald prenumeration aktiv fram till och med förfallodagen", () => {
    expect(lifecycleStatus("active", "2026-09-14", today)).toBe("active");
    expect(lifecycleStatus("active", today, today)).toBe("active");
  });

  it("går till grace dagen efter förfall", () => {
    expect(lifecycleStatus("active", "2026-09-12", today)).toBe("grace");
  });

  it("stannar i grace på sista respitdagen", () => {
    const lastGraceDay = toDayString(addDays(today, -GRACE_DAYS));
    expect(lifecycleStatus("active", lastGraceDay, today)).toBe("grace");
  });

  it("förfaller dagen efter respiten", () => {
    const justPast = toDayString(addDays(today, -GRACE_DAYS - 1));
    expect(lifecycleStatus("active", justPast, today)).toBe("expired");
  });

  it("behåller trial som trial så länge datumet håller", () => {
    expect(lifecycleStatus("trial", "2026-10-01", today)).toBe("trial");
    expect(lifecycleStatus("trial", "2026-09-12", today)).toBe("grace");
  });

  it("återuppväcker aldrig en avslutad prenumeration", () => {
    expect(lifecycleStatus("canceled", "2020-01-01", today)).toBe("canceled");
  });

  it("lyfter en grace-rad tillbaka till active när kunden betalat framåt", () => {
    expect(lifecycleStatus("grace", "2027-09-13", today)).toBe("active");
  });
});

describe("renewalMessage", () => {
  const base = {
    businessName: "Taller López",
    priceGs: 300_000,
    siteUrl: "https://sitio.com.py/taller-lopez",
  };

  it("bakar in statistiken när det finns siffror", () => {
    const msg = renewalMessage({ ...base, views365: 1240, waClicks365: 87 });
    expect(msg).toContain("Taller López");
    expect(msg).toMatch(/1[.\s ]240 visitas/);
    expect(msg).toContain("87 contactos");
    expect(msg).toContain(base.siteUrl);
  });

  it("tar med länken till årsrapporten när den finns (R3-23)", () => {
    const url = "https://sitio.com.py/reporte/taller-lopez?t=abc";
    expect(renewalMessage({ ...base, views365: 10, waClicks365: 2, reportUrl: url })).toContain(url);
    expect(renewalMessage({ ...base, views365: 10, waClicks365: 2 })).not.toContain("/reporte/");
  });

  it("utelämnar statistikmeningen helt vid nollor", () => {
    const msg = renewalMessage({ ...base, views365: 0, waClicks365: 0 });
    expect(msg).not.toContain("visitas");
    expect(msg).toContain("vence pronto");
  });

  it("tar med statistiken även om bara ett av måtten är över noll", () => {
    expect(renewalMessage({ ...base, views365: 0, waClicks365: 3 })).toContain("contactos");
  });
});

describe("formulärscheman", () => {
  it("accepterar en giltig prenumeration", () => {
    const parsed = subscriptionFormSchema.safeParse({
      plan: "basico",
      priceGs: "300000",
      startsAt: "2026-09-13",
      expiresAt: "2027-09-13",
      status: "active",
    });
    expect(parsed.success).toBe(true);
  });

  it("avvisar decimaler i guaraníes", () => {
    expect(
      subscriptionFormSchema.safeParse({
        plan: "basico",
        priceGs: "300000.5",
        startsAt: "2026-09-13",
        expiresAt: "2027-09-13",
        status: "active",
      }).success,
    ).toBe(false);
  });

  it("avvisar datum som inte är YYYY-MM-DD", () => {
    expect(
      paymentFormSchema.safeParse({
        amountGs: "300000",
        method: "transferencia",
        periodStart: "13/09/2026",
        periodEnd: "2027-09-13",
      }).success,
    ).toBe(false);
  });

  it("avvisar okänd betalningsmetod", () => {
    expect(
      paymentFormSchema.safeParse({
        amountGs: "300000",
        method: "swish",
        periodStart: "2026-09-13",
        periodEnd: "2027-09-13",
      }).success,
    ).toBe(false);
  });
});

describe("planregister", () => {
  it("har etikett och riktpris för varje plan", () => {
    for (const plan of PLANS) {
      expect(PLAN_LABELS[plan]).toBeTruthy();
      expect(Number.isInteger(PLAN_SUGGESTED_PRICE_GS[plan])).toBe(true);
    }
  });

  it("täcker alla statusvärden i livscykeln", () => {
    expect(SUBSCRIPTION_STATUSES).toContain("grace");
    expect(SUBSCRIPTION_STATUSES).toHaveLength(5);
  });
});

describe("ownerReportPeriod (R3-21)", () => {
  it("förnyelse i förväg börjar där nuvarande period slutar", () => {
    expect(ownerReportPeriod({ status: "active", expiresAt: "2026-11-01" }, "2026-09-22")).toEqual({
      periodStart: "2026-11-01",
      periodEnd: "2027-11-01",
    });
  });

  it("i graceperioden räknas fortfarande från förfallodagen", () => {
    expect(ownerReportPeriod({ status: "grace", expiresAt: "2026-09-22" }, "2026-09-22").periodStart).toBe(
      "2026-09-22",
    );
  });

  it("prov och utgången period börjar idag", () => {
    expect(ownerReportPeriod({ status: "trial", expiresAt: "2026-10-15" }, "2026-09-22")).toEqual({
      periodStart: "2026-09-22",
      periodEnd: "2027-09-22",
    });
    expect(ownerReportPeriod({ status: "expired", expiresAt: "2026-01-01" }, "2026-09-22").periodStart).toBe(
      "2026-09-22",
    );
  });
});

describe("ownerPaymentReportSchema (R3-21)", () => {
  it("tar metod, referens och belopp", () => {
    const r = ownerPaymentReportSchema.safeParse({ amountGs: "300000", method: "transferencia", reference: " 123 " });
    expect(r.success && r.data).toEqual({ amountGs: 300000, method: "transferencia", reference: "123" });
  });

  it("avvisar noll, okänd metod och decimaler", () => {
    expect(ownerPaymentReportSchema.safeParse({ amountGs: "0", method: "efectivo" }).success).toBe(false);
    expect(ownerPaymentReportSchema.safeParse({ amountGs: "1000", method: "bitcoin" }).success).toBe(false);
    expect(ownerPaymentReportSchema.safeParse({ amountGs: "1000.5", method: "efectivo" }).success).toBe(false);
    // R3-32: tusentalspunkter är tusental, tomt är ett fel.
    const dotted = ownerPaymentReportSchema.safeParse({ amountGs: "300.000", method: "efectivo" });
    expect(dotted.success && dotted.data.amountGs).toBe(300000);
    expect(ownerPaymentReportSchema.safeParse({ amountGs: "", method: "efectivo" }).success).toBe(false);
    expect(paymentFormSchema.safeParse({ amountGs: "", method: "efectivo", periodStart: "2026-01-01", periodEnd: "2027-01-01" }).success).toBe(false);
  });
});

describe("todayAsuncion (R3-36)", () => {
  it("är gårdagen i UTC efter 21:00 lokal tid", () => {
    expect(todayAsuncion(new Date("2026-09-24T01:30:00Z"))).toBe("2026-09-23");
    expect(todayAsuncion(new Date("2026-09-24T03:30:00Z"))).toBe("2026-09-24");
  });

  it("livscykeln räknar på Asunción-dygnet: förfaller i dag lokalt ⇒ fortfarande aktiv", () => {
    const lateEvening = todayAsuncion(new Date("2026-09-24T01:30:00Z"));
    expect(lifecycleStatus("active", "2026-09-23", lateEvening)).toBe("active");
  });
});
