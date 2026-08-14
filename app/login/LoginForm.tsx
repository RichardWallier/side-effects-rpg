"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { emailFromName, slugFromName } from "@/lib/auth/identity";

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const slug = slugFromName(name);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!slug) {
      setError("Digite seu nome.");
      return;
    }

    setBusy(true);
    setError(null);

    const { error } = await supabaseBrowser().auth.signInWithPassword({
      email: emailFromName(name),
      password,
    });

    if (error) {
      setError(
        error.message === "Invalid login credentials"
          ? "Nome ou senha não conferem."
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
        <label htmlFor="name">Nome</label>
        <input
          id="name"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          placeholder="rafael"
          value={name}
          onChange={(e) => setName(e.target.value)}
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
        {/* Mostrar o identificador tira o mistério quando o login falha —
            dá pra ver na hora se o nome saiu diferente do combinado. */}
        {slug ? (
          <>
            Você vai entrar como <strong>{emailFromName(name)}</strong>.
          </>
        ) : (
          "Só o primeiro nome, sem sobrenome. Quem cria os acessos é o mestre."
        )}
      </div>
    </form>
  );
}
