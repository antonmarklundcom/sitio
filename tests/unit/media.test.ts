import path from "node:path";
import { describe, expect, it } from "vitest";
import { contentTypeFor, itemImage, mediaSrcSet, mediaUrl, resolveMediaPath } from "@/lib/media";

const ROOT = path.resolve(process.env.UPLOADS_DIR as string);

describe("resolveMediaPath", () => {
  it("löser ut en giltig fil under uploads-roten", () => {
    expect(resolveMediaPath("12", "abc123-w800.webp")).toBe(path.join(ROOT, "12", "abc123-w800.webp"));
  });

  it("avvisar punkt-punkt i filnamnet", () => {
    expect(resolveMediaPath("12", "..")).toBeNull();
    expect(resolveMediaPath("12", "..%2Fetc")).toBeNull();
    expect(resolveMediaPath("12", "a..b")).toBeNull();
  });

  it("avvisar snedstreck i filnamnet", () => {
    expect(resolveMediaPath("12", "sub/fil.webp")).toBeNull();
    expect(resolveMediaPath("12", "/etc/passwd")).toBeNull();
    expect(resolveMediaPath("12", "..\\fil.webp")).toBeNull();
  });

  it("avvisar icke-numeriskt business-id", () => {
    expect(resolveMediaPath("12a", "fil.webp")).toBeNull();
    expect(resolveMediaPath("..", "fil.webp")).toBeNull();
    expect(resolveMediaPath("", "fil.webp")).toBeNull();
  });

  it("avvisar nollbyte och andra otillåtna tecken", () => {
    expect(resolveMediaPath("12", "fil\0.webp")).toBeNull();
    expect(resolveMediaPath("12", "fil name.webp")).toBeNull();
  });
});

describe("contentTypeFor", () => {
  it("mappar de varianter vi faktiskt skriver", () => {
    expect(contentTypeFor("a-w800.webp")).toBe("image/webp");
    expect(contentTypeFor("a-logo.png")).toBe("image/png");
    expect(contentTypeFor("a.jpg")).toBe("image/jpeg");
    expect(contentTypeFor("a.jpeg")).toBe("image/jpeg");
  });

  it("faller tillbaka på octet-stream för okänt", () => {
    expect(contentTypeFor("a.svg")).toBe("application/octet-stream");
  });
});

describe("mediaUrl och mediaSrcSet", () => {
  it("ger en relativ URL utan domän", () => {
    expect(mediaUrl(7, "abc-w400.webp")).toBe("/media/7/abc-w400.webp");
  });

  it("ger null när varianten saknas", () => {
    expect(mediaUrl(7, undefined)).toBeNull();
  });

  it("bygger srcset i bredd-ordning och hoppar över saknade varianter", () => {
    expect(mediaSrcSet(7, { w400: "a.webp", w1600: "c.webp" })).toBe(
      "/media/7/a.webp 400w, /media/7/c.webp 1600w",
    );
  });
});

describe("itemImage (R3-16)", () => {
  it("är null utan media-rad eller utan varianter", () => {
    expect(itemImage(7, null)).toBeNull();
    expect(itemImage(7, { variantsJson: null, width: 800, height: 600 })).toBeNull();
    expect(itemImage(7, { variantsJson: {}, width: 800, height: 600 })).toBeNull();
  });

  it("tar mellanvarianten som src och alla varianter i srcset", () => {
    expect(
      itemImage(7, { variantsJson: { w400: "a.webp", w800: "b.webp", w1600: "c.webp" }, width: 1600, height: 1200 }),
    ).toEqual({
      src: "/media/7/b.webp",
      srcSet: "/media/7/a.webp 400w, /media/7/b.webp 800w, /media/7/c.webp 1600w",
      width: 1600,
      height: 1200,
    });
  });

  it("faller tillbaka på minsta varianten när en liten bild saknar w800", () => {
    expect(itemImage(7, { variantsJson: { w400: "a.webp" }, width: 300, height: 300 })?.src).toBe("/media/7/a.webp");
  });
});
