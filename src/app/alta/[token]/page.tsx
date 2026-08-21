import { notFound } from "next/navigation";
import { getIntakeSession, listIntakeMedia } from "@/db/intake-queries";
import { displayPhone } from "@/lib/format";
import { MAX_PHOTOS_BASE, smallestVariant } from "@/lib/media-shared";
import { INTAKE_STEPS, isIntakeStep, type IntakeStep } from "@/lib/intake";
import {
  IntakeDataForm,
  IntakePhotos,
  IntakeSubmit,
  IntakeVerification,
} from "@/components/intake/intake-forms";
import { requestCodeAction, saveIntakeDataAction, submitIntakeAction, verifyCodeAction } from "./actions";

export const dynamic = "force-dynamic";

const STEP_LABELS: Record<IntakeStep, string> = {
  datos: "Datos",
  fotos: "Fotos",
  verificacion: "Verificación",
};

function Steps({ current }: { current: IntakeStep }) {
  const index = INTAKE_STEPS.indexOf(current);
  return (
    <ol className="alta-steps">
      {INTAKE_STEPS.map((step, i) => (
        <li key={step} aria-current={step === current ? "step" : undefined} data-done={i < index ? "1" : undefined}>
          {i + 1}. {STEP_LABELS[step]}
        </li>
      ))}
    </ol>
  );
}

export default async function IntakePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ paso?: string; listo?: string }>;
}) {
  const { token } = await params;
  const sp = await searchParams;

  // Inlämningen stänger länken, så tacksidan måste renderas innan tokenen
  // slås upp — annars ser kunden en 404 direkt efter att ha skickat in.
  if (sp.listo === "1") {
    return (
      <div className="alta-wrap alta-done">
        <p className="tick">✓</p>
        <h1>¡Listo, gracias!</h1>
        <p>
          Ya tenemos todo. Revisamos tus datos, armamos tu página y te escribimos por WhatsApp cuando esté
          lista. Si necesitás cambiar algo, respondenos por ahí.
        </p>
      </div>
    );
  }

  const session = await getIntakeSession(token);
  // Okänd, utgången eller redan inlämnad token ser likadana ut: sidan får inte
  // gå att använda för att gissa fram giltiga länkar.
  if (!session) notFound();

  const business = session.business;
  const step: IntakeStep = isIntakeStep(sp.paso) ? sp.paso : "datos";

  const mediaRows = await listIntakeMedia(business.id);
  const photos = mediaRows
    .filter((m) => m.kind === "photo")
    .map((m) => ({
      id: m.id,
      url: `/media/${business.id}/${smallestVariant(m.variantsJson ?? {}) ?? ""}`,
    }))
    .filter((p) => p.url.endsWith("/") === false);

  const services = Array.isArray(business.servicesJson) ? business.servicesJson : [];
  const socials = business.socialsJson ?? {};
  const canSubmit =
    Boolean(business.whatsappVerifiedAt) &&
    services.length >= 2 &&
    (business.rawDescription?.trim().length ?? 0) >= 40 &&
    photos.length >= 1;

  return (
    <div className="alta-wrap">
      <span className="alta-brand">sitio.com.py</span>
      <h1>{step === "datos" ? `Armemos la página de ${business.name}` : business.name}</h1>
      <p>Tres pasos. Podés volver a este enlace cuando quieras — se guarda todo.</p>

      <Steps current={step} />

      {step === "datos" ? (
        <IntakeDataForm
          action={saveIntakeDataAction.bind(null, token)}
          defaults={{
            name: business.name,
            category: business.category,
            rawDescription: business.rawDescription ?? "",
            whatsappPhone: business.whatsappPhone.startsWith("+595000") ? "" : business.whatsappPhone,
            secondaryPhone: business.secondaryPhone ?? "",
            address: business.address ?? "",
            zone: business.zone ?? "",
            city: business.city,
            instagram: socials.instagram ?? "",
            facebook: socials.facebook ?? "",
            services,
            hours: business.hoursJson ?? {},
          }}
        />
      ) : null}

      {step === "fotos" ? (
        <>
          <IntakePhotos token={token} photos={photos} hasLogo={session.hasLogo} maxPhotos={MAX_PHOTOS_BASE} />
          <div className="alta-actions">
            <a className="alta-btn alta-btn--ghost" href={`/alta/${token}?paso=datos`}>
              Volver
            </a>
            <a className="alta-btn" href={`/alta/${token}?paso=verificacion`}>
              Seguir
            </a>
          </div>
        </>
      ) : null}

      {step === "verificacion" ? (
        <>
          <IntakeVerification
            requestCode={requestCodeAction.bind(null, token)}
            verifyCode={verifyCodeAction.bind(null, token)}
            phone={displayPhone(business.whatsappPhone)}
            verified={Boolean(business.whatsappVerifiedAt)}
          />
          <IntakeSubmit action={submitIntakeAction.bind(null, token)} disabled={!canSubmit} />
          <div className="alta-actions">
            <a className="alta-btn alta-btn--ghost" href={`/alta/${token}?paso=fotos`}>
              Volver
            </a>
          </div>
        </>
      ) : null}
    </div>
  );
}
