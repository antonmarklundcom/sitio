"use client";

import { useEffect, useState } from "react";

/**
 * Raderingsknapp med ett andra tryck (R3-40). Första trycket skickar inte
 * formuläret utan byter texten till `confirmLabel`; andra trycket raderar.
 * Efter fem sekunder utan andra tryck går knappen tillbaka. Ingen modal — ett
 * tryck till på samma ställe fungerar på telefonen och kräver inget bibliotek.
 * Utan JS skickas formuläret direkt (panelen kräver JS ändå).
 */
export function ConfirmSubmit({ label, confirmLabel }: { label: string; confirmLabel: string }) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 5000);
    return () => clearTimeout(t);
  }, [armed]);

  return (
    <button
      type="submit"
      className="danger"
      aria-live="polite"
      onClick={(e) => {
        if (armed) return;
        e.preventDefault();
        setArmed(true);
      }}
    >
      {armed ? confirmLabel : label}
    </button>
  );
}
