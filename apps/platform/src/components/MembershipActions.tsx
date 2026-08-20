"use client";

import { useState } from "react";
import type { MembershipPlanKey } from "@/lib/membership";

async function openServerSession(endpoint: string, body?: unknown) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  if (response.status === 401) {
    window.location.assign("/login/");
    return;
  }
  if (response.status === 403 && data.apply) {
    window.location.assign(data.apply);
    return;
  }
  if (!response.ok || !data.url)
    throw new Error(data.error || "session_failed");
  window.location.assign(data.url);
}

export function CheckoutButton({
  plan,
  enabled,
}: {
  plan: MembershipPlanKey;
  enabled: boolean;
}) {
  const [status, setStatus] = useState("");
  return (
    <div>
      <button
        className="primaryButton"
        type="button"
        disabled={!enabled || Boolean(status)}
        onClick={async () => {
          setStatus("Opening secure checkout…");
          try {
            await openServerSession("/api/stripe/checkout", { plan });
          } catch {
            setStatus("Checkout is not open yet.");
          }
        }}
      >
        Choose {plan === "player" ? "player" : "creator"}
      </button>
      <p className="formStatus" aria-live="polite">
        {status}
      </p>
    </div>
  );
}

export function BillingPortalButton() {
  const [status, setStatus] = useState("");
  return (
    <div>
      <button
        className="secondaryButton"
        type="button"
        onClick={async () => {
          setStatus("Opening billing…");
          try {
            await openServerSession("/api/stripe/portal");
          } catch {
            setStatus("No billing account is connected to this profile yet.");
          }
        }}
      >
        Manage billing
      </button>
      <p className="formStatus" aria-live="polite">
        {status}
      </p>
    </div>
  );
}
