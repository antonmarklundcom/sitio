import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { BusinessForm } from "@/components/admin/business-form";
import { createBusinessAction } from "../actions";
import { WEEKDAYS } from "@/lib/business";

export const metadata = { title: "Nuevo sitio" };

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
          ← Sitios
        </Link>
        <h1 className="mt-2 text-xl font-semibold">Nuevo sitio</h1>
        <p className="mt-1 text-sm text-admin-muted">
          Se crea como borrador. La publicación se realiza en el siguiente paso, después de la revisión.
        </p>
      </div>

      <BusinessForm
        action={createBusinessAction}
        submitLabel="Crear borrador"
        defaults={{
          name: "",
          slug: "",
          category: "servicios",
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
