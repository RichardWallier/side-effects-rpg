"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function SignupForm() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const { data, error } = await supabaseBrowser().auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName.trim() } },
    });

    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }

    // Sem sessão = o projeto exige confirmação de e-mail.
    if (!data.session) {
      setNotice("Conta criada. Confirme pelo link enviado no seu e-mail e depois faça login.");
      setBusy(false);
      return;
    }

    router.replace("/campanhas");
    router.refresh();
  }

  return (
    <form onSubmit={submit}>
      <div className="login-field">
        <label htmlFor="display_name">Nome</label>
        <input
          id="display_name"
          required
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
      </div>
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
          autoComplete="new-password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <button className="login-btn" type="submit" disabled={busy}>
        {busy ? "Criando…" : "Criar conta"}
      </button>
      {error && <div className="login-error">{error}</div>}
      {notice && <div className="login-hint">{notice}</div>}
      <div className="login-hint">
        Já tem conta? <Link href="/login">Entrar</Link>.
      </div>
    </form>
  );
}
