"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { taskboardFetch } from "../lib/taskboard";
import { saveTaskboardToken } from "../lib/use-taskboard-token";

type AuthResponse = { token: string };

export default function LoginPage() {
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
      const response = await taskboardFetch<AuthResponse>(
        "/api/auth/login",
        undefined,
        {
          method: "POST",
          body: JSON.stringify({ email, password }),
        },
      );
      saveTaskboardToken(response.token);
      router.push("/workspace");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Não foi possível entrar.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      kicker="Workspace"
      title="Boas-vindas de volta."
      description="Entre para organizar projetos, tarefas e sua equipe."
      footer={
        <p>
          Ainda não tem conta? <Link href="/cadastro">Criar usuário</Link>
        </p>
      }
    >
      <form className="auth-v2-form" onSubmit={handleSubmit}>
        <div>
          <Label htmlFor="login-email">Email</Label>
          <Input
            id="login-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="voce@empresa.com"
            required
          />
        </div>
        <div>
          <Label htmlFor="login-password">Senha</Label>
          <Input
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Sua senha"
            required
          />
        </div>
        {error ? (
          <p className="auth-v2-error" role="alert">
            {error}
          </p>
        ) : null}
        <ShimmerButton
          className="auth-v2-submit"
          type="submit"
          disabled={loading}
          aria-busy={loading}
          background="#3278FF"
          borderRadius="10px"
        >
          {loading ? "Entrando…" : "Entrar"}
        </ShimmerButton>
      </form>
    </AuthShell>
  );
}
