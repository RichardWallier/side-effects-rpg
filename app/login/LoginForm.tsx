"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const { error } = await supabaseBrowser().auth.signInWithPassword({ email, password });

    if (error) {
      setError(
        error.message === "Invalid login credentials"
          ? "Credenciais inválidas. Tente novamente."
          : error.message,
      );
      setBusy(false);
      return;
    }

    router.replace(params.get("next") || "/campanhas");
    router.refresh();
  }

  return (
    <form onSubmit={submit}>
      <div className="login-field">
        <label htmlFor="email">E-mail</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="login-field">
        <label htmlFor="password">Senha</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <button className="login-btn" type="submit" disabled={busy}>
        {busy ? "Verificando…" : "Acessar caso"}
      </button>
      {error && <div className="login-error">{error}</div>}
      <div className="login-hint">
        Primeira vez? <Link href="/cadastro">Criar identidade</Link>. Você entra numa mesa com o
        código de convite que o mestre te passar.
      </div>
    </form>
  );
}
