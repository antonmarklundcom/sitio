import Link from "next/link";
import { notFound } from "next/navigation";
import { getBusinessById } from "@/db/queries";
import { getBusinessAnalytics } from "@/db/analytics-queries";
import { getCurrentSubscription, getPaymentsWithReceipts, getYearStats } from "@/db/billing-queries";
import { requireRole } from "@/lib/auth";
import { previewToken } from "@/lib/preview";
import { absoluteUrl } from "@/lib/env";
import { displayPhone, waLink } from "@/lib/format";
import {
  STATUS_LABELS,
  STATUS_TRANSITIONS,
  publishBlockers,
  type BusinessStatus,
} from "@/lib/business";
import { BusinessForm } from "@/components/admin/business-form";
import { AnalyticsPanel } from "@/components/admin/analytics-panel";
import { BillingPanel } from "@/components/admin/billing-panel";
import { Badge, Card, Notice, SectionTitle, StatusBadge } from "@/components/admin/ui";
import { changeStatusAction, updateBusinessAction, verifyWhatsappManuallyAction } from "../actions";
import {
  confirmPaymentAction,
  registerPaymentAction,
  rejectPaymentAction,
  saveSubscriptionAction,
} from "../../pagos/actions";
import { addYear, renewalMessage, toDayString } from "@/lib/billing";
import {
  deleteMediaAction,
  listMediaForBusiness,
  moveMediaAction,
  setHeroAction,
  updateAltTextAction,
} from "../media-actions";
import { MediaGrid, MediaUploader, type MediaItem } from "@/components/admin/media-manager";
import { ModulesPanel } from "@/components/admin/modules-panel";
import { listModuleStates } from "@/db/module-queries";
import { toggleModuleAction } from "../module-actions";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const business = await getBusinessById(Number(id));
  return { title: business ? business.name : "Sajt" };
}

export default async function EditBusinessPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    created?: string;
    status?: string;
    verified?: string;
    error?: string;
    ownerWarning?: string;
  }>;
}) {
  await requireRole("superadmin");
  const { id } = await params;
  const sp = await searchParams;
  const businessId = Number(id);
  if (!Number.isInteger(businessId)) notFound();

  const business = await getBusinessById(businessId);
  if (!business) notFound();

  const [mediaRows, analytics, subscription, paymentRows, yearStats, moduleStates] = await Promise.all([
    listMediaForBusiness(businessId),
    getBusinessAnalytics(businessId),
    getCurrentSubscription(businessId),
    getPaymentsWithReceipts(businessId),
    getYearStats(businessId),
    listModuleStates(businessId),
  ]);
  const logo = mediaRows.filter((m) => m.kind === "logo");
  const photos = mediaRows.filter((m) => m.kind === "photo");
  const toItem = (m: (typeof mediaRows)[number]): MediaItem => ({
    id: m.id,
    kind: m.kind,
    variants: m.variantsJson ?? {},
    altText: m.altText,
    bytes: m.bytes,
    width: m.width,
    height: m.height,
  });

  const status = business.status as BusinessStatus;
  const blockers = publishBlockers(business, photos.length);
  const preview = absoluteUrl(`/${business.slug}?preview=${previewToken(business.id)}`);
  const liveUrl = absoluteUrl(`/${business.slug}`);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/admin" className="text-sm text-admin-muted hover:text-admin-text">
            ← Sajter
          </Link>
          <h1 className="mt-2 flex flex-wrap items-center gap-3 text-xl font-semibold">
            {business.name}
            <StatusBadge status={status} />
            {business.whatsappVerifiedAt ? <Badge tone="ok">WhatsApp verifierad</Badge> : <Badge tone="warn">Overifierad</Badge>}
          </h1>
          <p className="mt-1 font-mono text-sm text-admin-muted">/{business.slug}</p>
        </div>
      </div>

      {sp.error ? <Notice tone="danger">{sp.error}</Notice> : null}
      {sp.created ? <Notice tone="ok">Utkastet är skapat. Fyll på och publicera när det är klart.</Notice> : null}
      {sp.status ? <Notice tone="ok">Statusen är uppdaterad.</Notice> : null}
      {sp.ownerWarning ? <Notice tone="warn">{sp.ownerWarning}</Notice> : null}
      {sp.verified ? <Notice tone="ok">WhatsApp-numret är markerat som verifierat.</Notice> : null}

      <Card>
        <SectionTitle hint="Förhandsvisningen fungerar oavsett status. Den publika länken svarar 404 tills sajten är publicerad.">
          Status och länkar
        </SectionTitle>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {STATUS_TRANSITIONS[status].map((to) => (
              <form key={to} action={changeStatusAction}>
                <input type="hidden" name="businessId" value={business.id} />
                <input type="hidden" name="to" value={to} />
                <button
                  type="submit"
                  disabled={to === "published" && blockers.length > 0}
                  title={to === "published" && blockers.length > 0 ? blockers.join(" ") : undefined}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
                    to === "published"
                      ? "bg-admin-ok text-admin-bg hover:opacity-90"
                      : "border border-admin-line bg-admin-surface-2 text-admin-text hover:border-admin-muted"
                  }`}
                >
                  {to === "published" ? "Publicera" : `Sätt till ${STATUS_LABELS[to].toLowerCase()}`}
                </button>
              </form>
            ))}

            {business.whatsappVerifiedAt ? null : (
              <form action={verifyWhatsappManuallyAction}>
                <input type="hidden" name="businessId" value={business.id} />
                <button
                  type="submit"
                  className="rounded-lg border border-admin-line bg-admin-surface-2 px-3 py-2 text-sm hover:border-admin-muted"
                >
                  Markera WhatsApp som verifierad
                </button>
              </form>
            )}
          </div>

          {blockers.length > 0 ? (
            <Notice tone="warn">
              <p className="font-medium">Kan inte publiceras ännu:</p>
              <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
                {blockers.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </Notice>
          ) : null}

          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-admin-muted">Förhandsvisning</dt>
              <dd className="mt-0.5 break-all">
                <a href={preview} target="_blank" rel="noreferrer" className="text-admin-accent hover:underline">
                  {preview}
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-admin-muted">Publik länk</dt>
              <dd className="mt-0.5 break-all">
                {status === "published" ? (
                  <a href={liveUrl} target="_blank" rel="noreferrer" className="text-admin-accent hover:underline">
                    {liveUrl}
                  </a>
                ) : (
                  <span className="text-admin-muted">{liveUrl} (404 tills publicerad)</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-admin-muted">WhatsApp</dt>
              <dd className="mt-0.5">
                <a
                  href={waLink(business.whatsappPhone, `Hola ${business.name}, te escribo desde sitio.com.py.`)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-admin-accent hover:underline"
                >
                  {displayPhone(business.whatsappPhone)}
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-admin-muted">Publicerad</dt>
              <dd className="mt-0.5">
                {business.publishedAt ? new Date(business.publishedAt).toLocaleDateString("sv-SE") : "—"}
              </dd>
            </div>
          </dl>
        </div>
      </Card>

      <AnalyticsPanel analytics={analytics} />

      <BillingPanel
        businessId={business.id}
        businessName={business.name}
        today={toDayString(new Date())}
        defaultExpiry={toDayString(addYear(new Date()))}
        yearStats={yearStats}
        renewalHref={waLink(
          business.whatsappPhone,
          renewalMessage({
            businessName: business.name,
            priceGs: subscription?.priceGs ?? 0,
            views365: yearStats.views365,
            waClicks365: yearStats.waClicks365,
            siteUrl: liveUrl,
          }),
        )}
        subscription={
          subscription
            ? {
                id: subscription.id,
                plan: subscription.plan,
                priceGs: Number(subscription.priceGs),
                startsAt: toDayString(subscription.startsAt),
                expiresAt: toDayString(subscription.expiresAt),
                status: subscription.status,
              }
            : null
        }
        payments={paymentRows.map((p) => ({
          id: p.id,
          amountGs: Number(p.amountGs),
          method: p.method,
          reference: p.reference,
          periodStart: toDayString(p.periodStart),
          periodEnd: toDayString(p.periodEnd),
          status: p.status,
          confirmedAt: p.confirmedAt ? toDayString(p.confirmedAt) : null,
          notes: p.notes,
          receiptUrl: p.receiptFile ? `/media/${business.id}/${p.receiptFile}` : null,
        }))}
        saveSubscription={saveSubscriptionAction.bind(null, business.id)}
        registerPayment={registerPaymentAction.bind(null, business.id)}
        confirmPayment={confirmPaymentAction}
        rejectPayment={rejectPaymentAction}
      />

      <ModulesPanel
        businessId={business.id}
        modules={moduleStates}
        photoCount={photos.length}
        toggleModule={toggleModuleAction}
      />

      <Card>
        <SectionTitle hint="Bilderna processas vid uppladdning: EXIF strippas, orienteringen bakas in och varianterna 400/800/1600 px sparas som webp. Originalet sparas aldrig.">
          Bilder
        </SectionTitle>

        <div className="space-y-6">
          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-medium">Logga</h3>
              <MediaUploader businessId={business.id} kind="logo" label="Ladda upp logga" />
            </div>
            <MediaGrid
              businessId={business.id}
              items={logo.map(toItem)}
              heroMediaId={business.heroMediaId}
              onDelete={deleteMediaAction}
              onMove={moveMediaAction}
              onSetHero={setHeroAction}
              onAltText={updateAltTextAction}
            />
          </div>

          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-medium">
                Foton <span className="text-admin-muted">({photos.length})</span>
              </h3>
              <MediaUploader businessId={business.id} kind="photo" label="Ladda upp foton" />
            </div>
            <MediaGrid
              businessId={business.id}
              items={photos.map(toItem)}
              heroMediaId={business.heroMediaId}
              onDelete={deleteMediaAction}
              onMove={moveMediaAction}
              onSetHero={setHeroAction}
              onAltText={updateAltTextAction}
            />
          </div>
        </div>
      </Card>

        <BusinessForm
          action={updateBusinessAction.bind(null, business.id)}
          submitLabel="Spara ändringar"
          slugLocked={status === "published"}
          defaults={{
            name: business.name,
            slug: business.slug,
            category: business.category,
            themeKey: business.themeKey,
            paletteVariant: business.paletteVariant,
            rawDescription: business.rawDescription,
            description: business.description,
            services: Array.isArray(business.servicesJson) ? business.servicesJson : [],
            whatsappPhone: business.whatsappPhone,
            secondaryPhone: business.secondaryPhone,
            address: business.address,
            zone: business.zone,
            city: business.city,
            lat: business.lat,
            lng: business.lng,
            mapsUrl: business.mapsUrl,
            socials: business.socialsJson ?? {},
            hours: business.hoursJson ?? {},
            ruc: business.ruc,
            seoTitle: business.seoTitle,
            seoDescription: business.seoDescription,
            adminNotes: business.adminNotes,
          }}
        />
    </div>
  );
}
