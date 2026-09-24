"use client";

/**
 * Öppnar WhatsApp i en ny flik och markerar samtidigt meddelandet som skickat
 * — ett tryck per kund. Formuläret postar till markMessageSentAction.
 */
export function SendButton({ href }: { href: string }) {
  return (
    <button
      type="submit"
      onClick={() => window.open(href, "_blank", "noopener")}
      className="rounded-md bg-admin-ok px-2.5 py-1.5 text-xs font-medium text-admin-bg"
    >
      Enviar por WhatsApp
    </button>
  );
}
