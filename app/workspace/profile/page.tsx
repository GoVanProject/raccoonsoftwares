"use client";

import Link from "next/link";
import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { taskboardFetch } from "../../lib/taskboard";
import { WorkspaceIcon, WorkspaceRail } from "../components/workspace-ui";

type User = { id: string; alias: string; email: string; avatar_data?: string };

const MAX_AVATAR_IMAGE_BYTES = 512 * 1024;
const avatarImageTypes = ["image/gif", "image/png", "image/jpeg"];

export default function ProfilePage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [alias, setAlias] = useState("");
  const [email, setEmail] = useState("");
  const [avatarData, setAvatarData] = useState("");
  const [avatarName, setAvatarName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedMessage, setSavedMessage] = useState("");
  const [railExpanded, setRailExpanded] = useState(false);
  const avatarInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const storedToken = window.localStorage.getItem("taskboard_token");
    if (!storedToken) {
      router.replace("/login");
      return;
    }
    setToken(storedToken);
  }, [router]);

  useEffect(() => {
    if (!token) return;
    taskboardFetch<{ user: User }>("/api/auth/me", token)
      .then((response) => {
        setAlias(response.user.alias);
        setEmail(response.user.email);
        setAvatarData(response.user.avatar_data || "");
      })
      .catch((reason) => {
        if (reason instanceof Error && reason.message.includes("token")) {
          window.localStorage.removeItem("taskboard_token");
          router.replace("/login");
          return;
        }
        setError(reason instanceof Error ? reason.message : "Não foi possível carregar seu perfil.");
      })
      .finally(() => setLoading(false));
  }, [router, token]);

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
        setSavedMessage("");
      }
    };
    reader.onerror = () => setError("Não foi possível ler a foto.");
    reader.readAsDataURL(file);
  }

  function removeAvatar() {
    setAvatarData("");
    setAvatarName("");
    setSavedMessage("");
    if (avatarInput.current) avatarInput.current.value = "";
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    setError("");
    setSavedMessage("");
    if (newPassword && newPassword !== passwordConfirmation) {
      setError("As senhas não conferem.");
      return;
    }
    setSaving(true);
    try {
      const response = await taskboardFetch<{ user: User }>("/api/auth/me", token, {
        method: "PATCH",
        body: JSON.stringify({
          alias: alias.trim(),
          email: email.trim(),
          password: newPassword || undefined,
          password_confirmation: newPassword ? passwordConfirmation : undefined,
          avatar_data: avatarData,
        }),
      });
      setAlias(response.user.alias);
      setEmail(response.user.email);
      setAvatarData(response.user.avatar_data || "");
      setAvatarName("");
      setNewPassword("");
      setPasswordConfirmation("");
      setSavedMessage("Perfil atualizado.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível salvar seu perfil.");
    } finally {
      setSaving(false);
    }
  }

  function logout() {
    window.localStorage.removeItem("taskboard_token");
    router.push("/login");
  }

  return (
    <main className="workspace-page">
      <WorkspaceRail mode="profile" expanded={railExpanded} onToggleExpanded={() => setRailExpanded((current) => !current)} onLogout={logout} />
      <section className="profile-shell">
        <header className="profile-heading">
          <div>
            <Link className="profile-back-link" href="/workspace"><WorkspaceIcon name="back" />Voltar aos projetos</Link>
            <span className="workspace-kicker">Sua conta</span>
            <h1>Edite seu perfil.</h1>
            <p>Atualize como você aparece para sua equipe no workspace.</p>
          </div>
        </header>

        {error ? <div className="workspace-error" role="alert">{error}</div> : null}
        {savedMessage ? <div className="profile-success" role="status">{savedMessage}</div> : null}
        {loading ? <div className="profile-card profile-loading" aria-busy="true" aria-label="Carregando perfil"><div className="profile-skeleton profile-skeleton-avatar" /><div className="profile-skeleton profile-skeleton-line" /><div className="profile-skeleton profile-skeleton-line profile-skeleton-short" /></div> : <form className="profile-card profile-form" onSubmit={saveProfile}>
          <section className="profile-section">
            <div className="profile-section-heading"><span className="workspace-kicker">Identidade</span><h2>Como sua equipe encontra você</h2><p>Esses dados aparecem na equipe, nas tarefas e na sala ao vivo.</p></div>
            <div className="profile-avatar-row">
              <div className="profile-avatar-large">{avatarData ? <img src={avatarData} alt="Prévia da foto do perfil" /> : (alias || email || "U").slice(0, 2).toUpperCase()}</div>
              <div className="profile-avatar-actions"><strong>Foto do perfil</strong><span>GIF, PNG ou JPG · até 512 KB</span>{avatarData ? <div className="profile-avatar-controls"><span>{avatarName || "Foto atual"}</span><button type="button" onClick={removeAvatar}>Remover</button></div> : <label className="profile-upload"><span>Adicionar foto</span><small>Escolher arquivo</small><input ref={avatarInput} type="file" accept="image/gif,image/png,image/jpeg" onChange={handleAvatarChange} aria-label="Foto do perfil" /></label>}</div>
            </div>
            <div className="profile-fields"><label>Nome ou alias<input type="text" autoComplete="nickname" maxLength={60} value={alias} onChange={(event) => { setAlias(event.target.value); setSavedMessage(""); }} required /></label><label>Email<input type="email" autoComplete="email" value={email} onChange={(event) => { setEmail(event.target.value); setSavedMessage(""); }} required /></label></div>
          </section>
          <section className="profile-section profile-password-section">
            <div className="profile-section-heading"><span className="workspace-kicker">Segurança</span><h2>Troque sua senha quando quiser</h2><p>Deixe os campos vazios para manter a senha atual.</p></div>
            <div className="profile-fields"><label>Nova senha<input type="password" autoComplete="new-password" minLength={8} value={newPassword} onChange={(event) => { setNewPassword(event.target.value); setSavedMessage(""); }} placeholder="Pelo menos 8 caracteres" /></label><label>Confirmar nova senha<input type="password" autoComplete="new-password" minLength={8} value={passwordConfirmation} onChange={(event) => { setPasswordConfirmation(event.target.value); setSavedMessage(""); }} placeholder="Digite a senha novamente" /></label></div>
          </section>
          <div className="profile-form-actions"><Link className="profile-cancel" href="/workspace">Voltar aos projetos</Link><button className="profile-save" type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar alterações"}</button></div>
        </form>}
      </section>
    </main>
  );
}
