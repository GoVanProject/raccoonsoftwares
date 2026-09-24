"use client";

import Link from "next/link";
import Image from "next/image";
import { ChangeEvent, FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { taskboardFetch } from "../lib/taskboard";
import { saveTaskboardToken } from "../lib/use-taskboard-token";

type AuthResponse = { token: string };

const MAX_AVATAR_IMAGE_BYTES = 512 * 1024;
const avatarImageTypes = ["image/gif", "image/png", "image/jpeg"];

export default function RegisterPage() {
  const router = useRouter();
  const [alias, setAlias] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [avatarData, setAvatarData] = useState("");
  const [avatarName, setAvatarName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const avatarInput = useRef<HTMLInputElement>(null);

  function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!avatarImageTypes.includes(file.type)) {
      setError("Escolha uma foto GIF, PNG ou JPG.");
      event.target.value = "";
      return;
    }
    if (file.size > MAX_AVATAR_IMAGE_BYTES) {
      setError("A foto deve ter até 512 KB.");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setAvatarData(reader.result);
        setAvatarName(file.name);
        setError("");
      }
    };
    reader.onerror = () => setError("Não foi possível ler a foto.");
    reader.readAsDataURL(file);
  }

  function removeAvatar() {
    setAvatarData("");
    setAvatarName("");
    if (avatarInput.current) avatarInput.current.value = "";
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password !== passwordConfirmation) {
      setError("As senhas não conferem.");
      return;
    }
    setLoading(true);
    try {
      const response = await taskboardFetch<AuthResponse>(
        "/api/auth/register",
        undefined,
        {
          method: "POST",
          body: JSON.stringify({
            alias: alias.trim(),
            email,
            password,
            password_confirmation: passwordConfirmation,
            avatar_data: avatarData || undefined,
          }),
        },
      );
      saveTaskboardToken(response.token);
      router.push("/workspace");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Não foi possível criar o usuário.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      kicker="Comece agora"
      title="Crie seu workspace."
      description="Monte seu perfil e entre no workspace com a sua equipe."
      footer={
        <p>
          Já tem uma conta? <Link href="/login">Entrar</Link>
        </p>
      }
    >
      <form className="grid gap-4" onSubmit={handleSubmit}>
        <div className="grid gap-2">
          <Label className="text-xs font-bold text-foreground" htmlFor="register-alias">Nome ou alias</Label>
          <Input
            id="register-alias"
            type="text"
            autoComplete="nickname"
            maxLength={60}
            value={alias}
            onChange={(event) => setAlias(event.target.value)}
            placeholder="Como a equipe deve chamar você"
            required
          />
        </div>
        <div className="grid gap-2">
          <Label className="text-xs font-bold text-foreground" htmlFor="register-email">Email</Label>
          <Input
            id="register-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="voce@empresa.com"
            required
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="grid min-w-0 gap-2">
            <Label className="text-xs font-bold text-foreground" htmlFor="register-password">Senha</Label>
            <Input
              id="register-password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Pelo menos 8 caracteres"
              required
            />
          </div>
          <div className="grid min-w-0 gap-2">
            <Label className="text-xs font-bold text-foreground" htmlFor="register-confirmation">Confirmar senha</Label>
            <Input
              id="register-confirmation"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={passwordConfirmation}
              onChange={(event) => setPasswordConfirmation(event.target.value)}
              placeholder="Digite novamente"
              required
            />
          </div>
        </div>
        <div className="grid gap-2.5">
          <div className="flex items-baseline justify-between gap-3">
            <Label className="text-xs font-bold text-foreground" htmlFor="register-avatar">
              Foto do perfil <small>Opcional</small>
            </Label>
            <span className="text-[11px] text-muted-foreground">GIF, PNG ou JPG · até 512 KB</span>
          </div>
          {avatarData ? (
            <div className="grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-xl border border-border p-2">
              <Image className="size-10 rounded-lg object-cover" src={avatarData} alt="Prévia da foto do perfil" width={48} height={48} unoptimized />
              <span className="overflow-hidden text-xs text-ellipsis whitespace-nowrap">{avatarName}</span>
              <button className="border-0 bg-transparent text-xs font-semibold text-destructive" type="button" onClick={removeAvatar}>
                Remover
              </button>
            </div>
          ) : (
            <label className="relative flex min-h-[52px] cursor-pointer items-center justify-between gap-3 rounded-xl border border-dashed border-input px-3.5 py-3" htmlFor="register-avatar">
              <span>Adicionar foto</span>
              <small>Escolher arquivo</small>
              <input className="absolute size-px overflow-hidden opacity-0"
                id="register-avatar"
                ref={avatarInput}
                type="file"
                accept="image/gif,image/png,image/jpeg"
                onChange={handleAvatarChange}
              />
            </label>
          )}
        </div>
        {error ? (
          <p className="m-0 rounded-lg border border-destructive/25 bg-destructive/10 p-3 text-[13px] text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <ShimmerButton
          className="mt-1 w-full min-h-11 text-sm font-bold"
          type="submit"
          disabled={loading}
          aria-busy={loading}
          background="#3278FF"
          borderRadius="10px"
        >
          {loading ? "Criando…" : "Criar conta"}
        </ShimmerButton>
      </form>
    </AuthShell>
  );
}
