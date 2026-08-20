import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { BusinessForm } from "@/components/admin/business-form";
import { createBusinessAction } from "../actions";
import { WEEKDAYS } from "@/lib/business";

export const metadata = { title: "Ny sajt" };

const defaultHours = Object.fromEntries(
  WEEKDAYS.map(({ key }) => [
    key,
    key === "sun" ? null : key === "sat" ? [{ open: "08:00", close: "12:00" }] : [{ open: "08:00", close: "17:00" }],
  ]),
);

export default async function NewBusinessPage() {
  await requireRole("superadmin");

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin" className="text-sm text-admin-muted hover:text-admin-text">
          ← Sajter
        </Link>
        <h1 className="mt-2 text-xl font-semibold">Ny sajt</h1>
        <p className="mt-1 text-sm text-admin-muted">
          Skapas som utkast. Publicering sker i nästa steg, efter granskning.
        </p>
      </div>

      <BusinessForm
        action={createBusinessAction}
        submitLabel="Skapa utkast"
        defaults={{
          name: "",
          slug: "",
          category: "servicios",
          themeKey: "servicios",
          paletteVariant: 1,
          rawDescription: null,
          description: null,
          services: [],
          whatsappPhone: "",
          secondaryPhone: null,
          address: null,
          zone: null,
          city: "Asunción",
          lat: null,
          lng: null,
          mapsUrl: null,
          socials: {},
          hours: defaultHours,
          ruc: null,
          seoTitle: null,
          seoDescription: null,
          adminNotes: null,
        }}
      />
    </div>
  );
}
