"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { loginAction, type LoginState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-admin-accent px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
    >
      {pending ? "Loggar in…" : "Logga in"}
    </button>
  );
}

export function LoginForm() {
  const [state, formAction] = useActionState<LoginState, FormData>(loginAction, {});

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm text-admin-muted">
          E-post
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          className="w-full rounded-lg border border-admin-line bg-admin-surface px-3 py-2.5 text-sm outline-none focus:border-admin-accent"
        />
      </div>

      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm text-admin-muted">
          Lösenord
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="w-full rounded-lg border border-admin-line bg-admin-surface px-3 py-2.5 text-sm outline-none focus:border-admin-accent"
        />
      </div>

      {state.error ? (
        <p role="alert" className="rounded-lg border border-admin-danger/40 bg-admin-danger/10 px-3 py-2 text-sm text-admin-danger">
          {state.error}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}
