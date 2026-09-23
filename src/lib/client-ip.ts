/**
 * Klientens IP för rate limits och besökshashen (R3-27). EN helper — förr
 * fanns fem kopior (registro, owner-login, admin-login, lösenordsåterställning,
 * analytics) som alla tog FÖRSTA posten i x-forwarded-for. Den posten skriver
 * klienten själv om Hostingers proxy lägger till i stället för att ersätta
 * headern, och då kan en bot byta värde per anrop och gå runt 5/h-gränsen.
 *
 * Vilken källa som är pålitlig går bara att se på Hostinger:
 * /admin/diagnostico visar headers och vad varje källa ger. Tills dess är
 * standarden oförändrad (`xff-first`); byt med CLIENT_IP_SOURCE:
 *   xff-first  första posten i x-forwarded-for (proxyn ersätter headern)
 *   xff-last   sista posten (proxyn lägger till klientens IP sist)
 *   x-real-ip  x-real-ip (proxyn sätter den själv)
 * Saknas vald header faller den tillbaka på de andra, sist "unknown".
 * Ingen Node-import: används även där Edge kan köra.
 */
export const CLIENT_IP_SOURCES = ["xff-first", "xff-last", "x-real-ip"] as const;
export type ClientIpSource = (typeof CLIENT_IP_SOURCES)[number];

export function clientIpSource(raw: string | undefined = process.env.CLIENT_IP_SOURCE): ClientIpSource {
  const v = raw?.trim().toLowerCase();
  return (CLIENT_IP_SOURCES as readonly string[]).includes(v ?? "") ? (v as ClientIpSource) : "xff-first";
}

export function clientIpFrom(headers: Headers, source: ClientIpSource = clientIpSource()): string {
  const xff = (headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const realIp = headers.get("x-real-ip")?.trim() || "";
  const bySource: Record<ClientIpSource, string | undefined> = {
    "xff-first": xff[0],
    "xff-last": xff[xff.length - 1],
    "x-real-ip": realIp || undefined,
  };
  return bySource[source] || xff[0] || realIp || "unknown";
}
