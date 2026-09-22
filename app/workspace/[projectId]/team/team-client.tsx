"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { taskboardFetch } from "../../../lib/taskboard";
import { WorkspaceIcon, WorkspaceRail } from "../../components/workspace-ui";

type Project = { id: string; name: string; owner_id: string };
type MemberRole = "owner" | "editor" | "viewer";
type Member = { id: string; alias?: string; email: string; avatar_data?: string; role: MemberRole };

const memberRoleLabels: Record<MemberRole, string> = {
  owner: "Proprietário",
  editor: "Editor",
  viewer: "Visualizador",
};

export default function TeamClient({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [currentUserID, setCurrentUserID] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [memberEmail, setMemberEmail] = useState("");
  const [railExpanded, setRailExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
    setLoading(true);
    taskboardFetch<{ projects: Project[] }>("/api/projects", token)
      .then((projectListResponse) => {
        if (!projectListResponse.projects.some((item) => item.id === projectId)) {
          router.replace("/workspace?error=project-not-found");
          return null;
        }
        return Promise.all([
          taskboardFetch<{ project: Project }>(`/api/projects/${projectId}`, token),
          taskboardFetch<{ members: Member[] }>(`/api/projects/${projectId}/members`, token),
          taskboardFetch<{ user: { id: string } }>("/api/auth/me", token),
        ]);
      })
      .then((responses) => {
        if (!responses) return;
        const [projectResponse, memberResponse, userResponse] = responses;
        setProject(projectResponse.project);
        setMembers(memberResponse.members);
        setCurrentUserID(userResponse.user.id);
      })
      .catch((reason) => {
        const message = reason instanceof Error ? reason.message : "Não foi possível carregar a equipe.";
        if (message.includes("token")) {
          window.localStorage.removeItem("taskboard_token");
          router.replace("/login");
        } else if (message.includes("acesso") || message.includes("encontrado")) {
          router.replace("/workspace?error=project-not-found");
        } else {
          setError(message);
        }
      })
      .finally(() => setLoading(false));
  }, [projectId, router, token]);

  async function addMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !memberEmail.trim()) return;
    try {
      await taskboardFetch(`/api/projects/${projectId}/members`, token, { method: "POST", body: JSON.stringify({ email: memberEmail }) });
      const response = await taskboardFetch<{ members: Member[] }>(`/api/projects/${projectId}/members`, token);
      setMembers(response.members);
      setMemberEmail("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível adicionar o integrante.");
    }
  }

  async function updateMemberRole(member: Member, role: MemberRole) {
    if (!token || member.role === role) return;
    try {
      const response = await taskboardFetch<{ members: Member[] }>(`/api/projects/${projectId}/members/${member.id}`, token, { method: "PATCH", body: JSON.stringify({ role }) });
      setMembers(response.members);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível atualizar a permissão.");
    }
  }

  async function removeMember(member: Member) {
    if (!token || member.role === "owner") return;
    try {
      await taskboardFetch(`/api/projects/${projectId}/members/${member.id}`, token, { method: "DELETE" });
      setMembers((current) => current.filter((item) => item.id !== member.id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível remover o integrante.");
    }
  }

  function logout() {
    window.localStorage.removeItem("taskboard_token");
    router.push("/login");
  }

  const canManage = project ? currentUserID === project.owner_id : false;

  return (
    <main className="workspace-page">
      <div className="workspace-layout">
        <div className={`workspace-navigation-shell ${railExpanded ? "is-rail-expanded" : ""}`}>
          <WorkspaceRail mode="team" projectId={projectId} expanded={railExpanded} onToggleExpanded={() => setRailExpanded((current) => !current)} onLogout={logout} />
        </div>
        <section className="workspace-main">
          {error ? <div className="workspace-error" role="alert">{error}<button type="button" onClick={() => setError("")}>×</button></div> : null}
          {loading ? <div className="workspace-loading" aria-busy="true" aria-label="Carregando equipe"><div className="workspace-loading-heading"><div className="workspace-skeleton workspace-skeleton-icon" /><div><div className="workspace-skeleton workspace-skeleton-kicker" /><div className="workspace-skeleton workspace-skeleton-title" /><div className="workspace-skeleton workspace-skeleton-copy" /></div></div><div className="workspace-skeleton workspace-skeleton-column" /></div> : project ? <div className="workspace-team-view">
            <header className="workspace-view-header">
              <div className="workspace-view-heading"><span className="workspace-kicker">Projeto ativo</span><h1>Equipe</h1><p>Gerencie as pessoas que colaboram em <strong>{project.name}</strong>.</p></div>
              <div className="workspace-view-actions"><Link className="workspace-secondary-action" href={`/workspace/${projectId}`}><WorkspaceIcon name="board" />Voltar ao quadro</Link></div>
            </header>
            <div className="workspace-team-summary"><WorkspaceIcon name="users" /><div><strong>{members.length} {members.length === 1 ? "pessoa" : "pessoas"}</strong><span>Convide integrantes e defina o nível de acesso de cada um.</span></div></div>
            <section className="workspace-team-card" aria-labelledby="workspace-team-members-title">
              <div className="workspace-team-card-header"><div><span className="workspace-kicker">Acesso do projeto</span><h2 id="workspace-team-members-title">Membros</h2></div><span className="workspace-team-count">{members.length}</span></div>
              <div className="workspace-member-list">
                {members.map((member) => <article className="workspace-member-row" key={member.id}>
                  <span className="workspace-member-avatar">{member.avatar_data ? <img src={member.avatar_data} alt="" /> : (member.alias || member.email).slice(0, 2).toUpperCase()}</span>
                  <div className="workspace-member-identity"><strong>{member.alias || member.email}</strong><small>{member.alias ? member.email : member.id === project.owner_id ? "Proprietário do projeto" : "Membro do projeto"}</small></div>
                  <select value={member.role || (member.id === project.owner_id ? "owner" : "editor")} disabled={member.id === project.owner_id || !canManage} onChange={(event) => void updateMemberRole(member, event.target.value as MemberRole)} aria-label={`Permissão de ${member.email}`}>
                    <option value="owner">{memberRoleLabels.owner}</option><option value="editor">{memberRoleLabels.editor}</option><option value="viewer">{memberRoleLabels.viewer}</option>
                  </select>
                  {member.id !== project.owner_id ? <button className="workspace-member-remove" type="button" onClick={() => void removeMember(member)} disabled={!canManage} aria-label={`Remover ${member.email}`} title="Remover membro">×</button> : null}
                </article>)}
              </div>
            </section>
            <form className="workspace-member-form workspace-member-form-card" onSubmit={addMember}>
              <div><span className="workspace-kicker">Adicionar integrante</span><h2>Convide alguém para o projeto</h2><p>A pessoa precisa ter uma conta cadastrada para receber acesso.</p></div>
              <div className="member-form"><input id="workspace-member-email" type="email" value={memberEmail} onChange={(event) => setMemberEmail(event.target.value)} placeholder="email@equipe.com" aria-label="Email do integrante" disabled={!canManage} required /><button type="submit" disabled={!canManage}><WorkspaceIcon name="plus" /><span>Adicionar</span></button></div>
            </form>
          </div> : <div className="workspace-empty"><span>✦</span><h1>Projeto indisponível.</h1><p>Escolha outro projeto para continuar.</p><Link className="workspace-secondary-action" href="/workspace">Voltar para projetos</Link></div>}
        </section>
      </div>
    </main>
  );
}
