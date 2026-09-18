"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { taskboardFetch } from "../lib/taskboard";

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
      const response = await taskboardFetch<AuthResponse>("/api/auth/register", undefined, {
        method: "POST",
        body: JSON.stringify({ alias: alias.trim(), email, password, password_confirmation: passwordConfirmation, avatar_data: avatarData || undefined }),
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
      <section className="auth-card register-card">
        <Link className="auth-brand" href="/">🦝 <span>RaccoonSoftwares</span></Link>
        <div className="auth-kicker">Comece agora</div>
        <h1>Crie seu workspace.</h1>
        <p className="auth-intro">Monte seu perfil e entre no workspace com a sua equipe.</p>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>Nome ou alias<input type="text" autoComplete="nickname" maxLength={60} value={alias} onChange={(event) => setAlias(event.target.value)} placeholder="Como a equipe deve chamar você" required /></label>
          <label>Email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="voce@empresa.com" required /></label>
          <label>Senha<input type="password" autoComplete="new-password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Pelo menos 8 caracteres" required /></label>
          <label>Confirmar senha<input type="password" autoComplete="new-password" minLength={8} value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} placeholder="Digite a senha novamente" required /></label>
          <div className="avatar-picker">
            <div className="avatar-picker-copy"><span>Foto do perfil <small>Opcional</small></span><small>GIF, PNG ou JPG · até 512 KB</small></div>
            {avatarData ? <div className="avatar-preview"><img src={avatarData} alt="Prévia da foto do perfil" /><span>{avatarName}</span><button type="button" onClick={removeAvatar}>Remover</button></div> : <label className="avatar-upload"><span>Adicionar foto</span><small>Escolher arquivo</small><input ref={avatarInput} type="file" accept="image/gif,image/png,image/jpeg" onChange={handleAvatarChange} aria-label="Foto do perfil" /></label>}
          </div>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <button className="auth-submit" type="submit" disabled={loading}>{loading ? "Criando..." : "Criar conta"}</button>
        </form>
        <p className="auth-switch">Já tem uma conta? <Link href="/login">Entrar</Link></p>
        <Link className="auth-back" href="/">← Voltar para o site</Link>
      </section>
    </main>
  );
}
