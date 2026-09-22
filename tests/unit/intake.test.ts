import { describe, expect, it } from "vitest";
import {
  INTAKE_STEPS,
  OTP_MAX_ATTEMPTS,
  TOKEN_TTL_DAYS,
  hashOtp,
  hoursFromIntake,
  intakeDataSchema,
  isIntakeStep,
  newIntakeToken,
  newOtpCode,
  otpMatches,
  servicesFromIntake,
  tokenFingerprint,
  tokenMatches,
} from "@/lib/intake";

describe("token och OTP", () => {
  it("token är 32 hex-tecken (char(32) i schemat)", () => {
    expect(newIntakeToken()).toMatch(/^[0-9a-f]{32}$/);
  });

  it("två tokens är aldrig lika", () => {
    expect(newIntakeToken()).not.toBe(newIntakeToken());
  });

  it("OTP är exakt sex siffror, även vid låga tal", () => {
    for (let i = 0; i < 50; i += 1) expect(newOtpCode()).toMatch(/^\d{6}$/);
  });

  it("tokenFingerprint är kort och stabil, aldrig hela token", () => {
    const token = newIntakeToken();
    expect(tokenFingerprint(token)).toHaveLength(8);
    expect(tokenFingerprint(token)).toBe(tokenFingerprint(token));
    expect(token).not.toContain(tokenFingerprint(token));
  });

  it("konstanterna är de dokumenterade", () => {
    expect(TOKEN_TTL_DAYS).toBe(14);
    expect(OTP_MAX_ATTEMPTS).toBe(5);
  });
});

describe("otpMatches", () => {
  it("matchar rätt kod mot sin hash", () => {
    expect(otpMatches("123456", hashOtp("123456"))).toBe(true);
  });

  it("avvisar fel kod", () => {
    expect(otpMatches("123457", hashOtp("123456"))).toBe(false);
  });

  it("avvisar en hash av fel längd utan att kasta", () => {
    expect(otpMatches("123456", "kort")).toBe(false);
    expect(otpMatches("123456", "")).toBe(false);
  });
});

describe("tokenMatches", () => {
  it("matchar identiska tokens och avvisar olika", () => {
    const token = newIntakeToken();
    expect(tokenMatches(token, token)).toBe(true);
    expect(tokenMatches(token, newIntakeToken())).toBe(false);
  });

  it("avvisar olika längd utan att kasta", () => {
    expect(tokenMatches("abc", "abcd")).toBe(false);
  });
});

describe("isIntakeStep", () => {
  it("känner igen stegen och avvisar resten", () => {
    for (const step of INTAKE_STEPS) expect(isIntakeStep(step)).toBe(true);
    expect(isIntakeStep("pagos")).toBe(false);
    expect(isIntakeStep(undefined)).toBe(false);
  });
});

describe("intakeDataSchema", () => {
  const valid = {
    name: "Taller López",
    category: "taller",
    rawDescription: "x".repeat(60),
    whatsappPhone: "0981 123 456",
    city: "Asunción",
  };

  it("normaliserar telefonnumret till E.164", () => {
    const parsed = intakeDataSchema.safeParse(valid);
    expect(parsed.success && parsed.data.whatsappPhone).toBe("+595981123456");
  });

  it("avvisar ett icke-paraguayanskt nummer med kundvänligt fel", () => {
    const parsed = intakeDataSchema.safeParse({ ...valid, whatsappPhone: "123" });
    expect(parsed.success).toBe(false);
    expect(parsed.success === false && parsed.error.issues[0].message).toMatch(/paraguayo/);
  });

  it("kräver minst 40 tecken beskrivning", () => {
    expect(intakeDataSchema.safeParse({ ...valid, rawDescription: "Muy corto" }).success).toBe(false);
  });

  it("avvisar okänd kategori", () => {
    expect(intakeDataSchema.safeParse({ ...valid, category: "restaurante" }).success).toBe(false);
  });

  it("kräver stad", () => {
    expect(intakeDataSchema.safeParse({ ...valid, city: "" }).success).toBe(false);
  });
});

describe("servicesFromIntake", () => {
  it("läser upp till fem tjänster och hoppar över tomma rader", () => {
    const fd = new FormData();
    fd.set("service.0.name", " Instalación ");
    fd.set("service.0.desc", " Eléctrica ");
    fd.set("service.2.name", "Reparación");
    fd.set("service.5.name", "Sjätte — ska ignoreras");
    expect(servicesFromIntake(fd)).toEqual([
      { name: "Instalación", desc: "Eléctrica" },
      { name: "Reparación" },
    ]);
  });
});

describe("hoursFromIntake", () => {
  it("ger ett pass per dag", () => {
    const fd = new FormData();
    fd.set("hours.mon.open", "08:00");
    fd.set("hours.mon.close", "17:00");
    const hours = hoursFromIntake(fd);
    expect(hours.mon).toEqual([{ open: "08:00", close: "17:00" }]);
    expect(Object.keys(hours)).toHaveLength(7);
  });

  it("stänger dagen när kryssrutan är i, oavsett tider", () => {
    const fd = new FormData();
    fd.set("hours.sun.closed", "on");
    fd.set("hours.sun.open", "10:00");
    fd.set("hours.sun.close", "14:00");
    expect(hoursFromIntake(fd).sun).toBeNull();
  });

  it("läser ett andra pass när dagen delas (siesta, R3-19)", () => {
    const fd = new FormData();
    fd.set("hours.mon.open", "08:00");
    fd.set("hours.mon.close", "12:00");
    fd.set("hours.mon.1.open", "15:00");
    fd.set("hours.mon.1.close", "19:00");
    expect(hoursFromIntake(fd).mon).toEqual([
      { open: "08:00", close: "12:00" },
      { open: "15:00", close: "19:00" },
    ]);
  });

  it("stänger dagen vid halvifyllda eller felformade tider", () => {
    const fd = new FormData();
    fd.set("hours.tue.open", "08:00");
    fd.set("hours.wed.open", "8");
    fd.set("hours.wed.close", "17:00");
    const hours = hoursFromIntake(fd);
    expect(hours.tue).toBeNull();
    expect(hours.wed).toBeNull();
  });
});
