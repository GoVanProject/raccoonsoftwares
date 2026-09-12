"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { taskboardFetch } from "../lib/taskboard";

type AuthResponse = { token: string };

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await taskboardFetch<AuthResponse>("/api/auth/register", undefined, {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      window.localStorage.setItem("taskboard_token", response.token);
      router.push("/workspace");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Não foi possível criar o usuário.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <Link className="auth-brand" href="/">🦝 <span>RaccoonTech</span></Link>
        <div className="auth-kicker">Comece agora</div>
        <h1>Crie seu workspace.</h1>
        <p className="auth-intro">Cadastre-se usando seu email e uma senha. Sem confirmação duplicada.</p>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>Email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="voce@empresa.com" required /></label>
          <label>Senha<input type="password" autoComplete="new-password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Pelo menos 8 caracteres" required /></label>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <button className="auth-submit" type="submit" disabled={loading}>{loading ? "Criando..." : "Criar usuário"}</button>
        </form>
        <p className="auth-switch">Já tem uma conta? <Link href="/login">Entrar</Link></p>
        <Link className="auth-back" href="/">← Voltar para o site</Link>
      </section>
    </main>
  );
}
