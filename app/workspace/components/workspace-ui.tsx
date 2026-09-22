"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { taskboardFetch } from "../../lib/taskboard";

export type WorkspaceIconName =
  | "back"
  | "board"
  | "close"
  | "folder"
  | "fullscreen"
  | "exitFullscreen"
  | "logout"
  | "mapPin"
  | "menu"
  | "mic"
  | "micOff"
  | "moon"
  | "profile"
  | "plus"
  | "screen"
  | "sun"
  | "users"
  | "chevron";

export type WorkspaceProject = {
  id: string;
  name: string;
  task_count: number;
  image_data?: string;
};

type AvatarMember = {
  id: string;
  alias?: string;
  email: string;
  avatar_data?: string;
  publishing?: boolean;
};

type WorkspaceMode = "select" | "board" | "team" | "prospects" | "room" | "profile";

type WorkspaceRailProps = {
  mode: WorkspaceMode;
  projectId?: string;
  expanded?: boolean;
  onToggleExpanded?: () => void;
  onLogout: () => void;
};

function displayName(email: string, alias?: string) {
  return alias?.trim() || email.split("@")[0] || email;
}

export function initials(email: string, alias?: string) {
  return displayName(email, alias).slice(0, 2).toUpperCase();
}

export function WorkspaceIcon({ name }: { name: WorkspaceIconName }) {
  const paths: Record<WorkspaceIconName, ReactNode> = {
    back: <><path d="M19 12H5" /><path d="m11 18-6-6 6-6" /></>,
    board: <><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M8 8h3v3H8zM13 8h3v8h-3zM8 13h3v3H8z" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    folder: <><path d="M3.5 7.5h17v10a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" /><path d="M3.5 7.5V6a2 2 0 0 1 2-2h4l2 2h6.5a2 2 0 0 1 2 2v1.5" /></>,
    fullscreen: <><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M21 16v5h-5" /></>,
    exitFullscreen: <><path d="M9 3v6H3M15 3v6h6M9 21v-6H3M15 21v-6h6" /></>,
    logout: <><path d="M10 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5" /><path d="M14 8l4 4-4 4M18 12H8" /></>,
    mapPin: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
    mic: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" /></>,
    micOff: <><path d="m4 4 16 16" /><path d="M9 9v5a3 3 0 0 0 5.2 2.05M15 9V6a3 3 0 0 0-5.2-2.05" /><path d="M5.5 11a6.5 6.5 0 0 0 9.2 5.9M12 17.5V21M8.5 21h7" /></>,
    moon: <path d="M20.5 14.6A8.6 8.6 0 0 1 9.4 3.5 8.7 8.7 0 1 0 20.5 14.6Z" />,
    profile: <><circle cx="12" cy="8" r="3.2" /><path d="M5 20a7 7 0 0 1 14 0" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    screen: <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></>,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></>,
    users: <><path d="M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20" /><circle cx="10" cy="8" r="3" /><path d="M16 11a3 3 0 0 0 0-6M19.5 20v-1.5a3.5 3.5 0 0 0-2.5-3.35" /></>,
    chevron: <path d="m9 18 6-6-6-6" />,
  };

  return <svg className="workspace-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export function WorkspaceAvatarStack({
  members,
  max = 4,
  currentId,
  label,
}: {
  members: AvatarMember[];
  max?: number;
  currentId?: string;
  label?: string;
}) {
  const visibleMembers = members.slice(0, max);
  const remaining = members.length - visibleMembers.length;

  return (
    <div className="workspace-avatar-stack" aria-label={label}>
      {visibleMembers.map((member) => (
        <span
          className={`workspace-avatar ${member.publishing ? "is-sharing" : ""}`}
          key={member.id}
          title={member.id === currentId ? "Você" : member.email}
          aria-label={member.id === currentId ? "Você" : member.email}
        >
          {member.avatar_data ? <img className="workspace-avatar-image" src={member.avatar_data} alt="" /> : initials(member.email, member.alias)}
        </span>
      ))}
      {remaining > 0 ? <span className="workspace-avatar-more">+{remaining}</span> : null}
    </div>
  );
}

function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("raccoon-theme");
    const nextTheme = savedTheme === "dark" ? "dark" : "light";
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
  }, []);

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem("raccoon-theme", nextTheme);
  }

  const isDark = theme === "dark";
  return (
    <button
      className="workspace-rail-action"
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Ativar tema claro" : "Ativar tema escuro"}
      title={isDark ? "Ativar tema claro" : "Ativar tema escuro"}
      data-tooltip={isDark ? "Tema claro" : "Tema escuro"}
    >
      <WorkspaceIcon name={isDark ? "sun" : "moon"} /><span className="workspace-rail-label">Tema</span>
    </button>
  );
}

function ProjectSwitcher({ projectId, onProjectInvalid }: { projectId?: string; onProjectInvalid?: () => void }) {
  const router = useRouter();
  const switcherRef = useRef<HTMLDivElement>(null);
  const [token, setToken] = useState<string | null>(null);
  const [projects, setProjects] = useState<WorkspaceProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const storedToken = window.localStorage.getItem("taskboard_token");
    if (!storedToken) return;
    setToken(storedToken);
  }, []);

  useEffect(() => {
    if (!token) return;
    let active = true;
    setLoading(true);
    taskboardFetch<{ projects: WorkspaceProject[] }>("/api/projects", token)
      .then((response) => {
        if (!active) return;
        setProjects(response.projects);
        setError("");
        if (projectId && !response.projects.some((project) => project.id === projectId)) onProjectInvalid?.();
      })
      .catch((reason) => {
        if (!active) return;
        const message = reason instanceof Error ? reason.message : "Não foi possível carregar os projetos.";
        if (message.includes("token")) {
          window.localStorage.removeItem("taskboard_token");
          router.replace("/login");
          return;
        }
        setError(message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [onProjectInvalid, projectId, router, token]);

  useEffect(() => {
    if (!open) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function closeOnOutsideClick(event: MouseEvent) {
      if (switcherRef.current && !switcherRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("mousedown", closeOnOutsideClick);
    };
  }, [open]);

  const currentProject = projects.find((project) => project.id === projectId);

  function selectProject(project: WorkspaceProject) {
    setOpen(false);
    if (project.id !== projectId) router.push(`/workspace/${project.id}`);
  }

  return (
    <div className="workspace-rail-project" ref={switcherRef}>
      <button
        className={`workspace-project-switcher ${open ? "is-open" : ""}`}
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label={currentProject ? `Projeto atual: ${currentProject.name}` : "Selecionar projeto"}
        aria-expanded={open}
        aria-haspopup="listbox"
        data-tooltip={currentProject?.name || "Selecionar projeto"}
      >
        <WorkspaceIcon name="folder" />
        <span className="workspace-project-switcher-copy"><small>Projeto atual</small><strong>{currentProject?.name || "Selecionar projeto"}</strong></span>
        <WorkspaceIcon name="chevron" />
      </button>
      {open ? <div className="workspace-project-switcher-menu" role="listbox" aria-label="Projetos disponíveis">
        <div className="workspace-project-switcher-heading"><span>Projetos</span><small>{loading ? "Carregando" : projects.length}</small></div>
        {loading ? <>{[1, 2, 3].map((item) => <div className="workspace-skeleton workspace-project-option-skeleton" key={item} />)}</> : null}
        {!loading && error ? <p className="workspace-project-switcher-message workspace-project-switcher-error">{error}</p> : null}
        {!loading && !error && !projects.length ? <p className="workspace-project-switcher-message">Nenhum projeto disponível ainda.</p> : null}
        {!loading && !error ? projects.map((project) => <button className={`workspace-project-option ${project.id === projectId ? "is-active" : ""}`} role="option" aria-selected={project.id === projectId} type="button" key={project.id} onClick={() => selectProject(project)}>
          <span><strong>{project.name}</strong><small>{project.task_count} {project.task_count === 1 ? "tarefa" : "tarefas"}</small></span>
          <WorkspaceIcon name="chevron" />
        </button>) : null}
        <Link className="workspace-project-switcher-manage" href="/workspace" onClick={() => setOpen(false)}><WorkspaceIcon name="folder" />Gerenciar projetos</Link>
      </div> : null}
    </div>
  );
}

export function WorkspaceRail({ mode, projectId, expanded = false, onToggleExpanded, onLogout }: WorkspaceRailProps) {
  const router = useRouter();
  const projectInvalid = useCallback(() => router.replace("/workspace?error=project-not-found"), [router]);
  const hasProjectContext = Boolean(projectId);

  return (
    <nav className={`workspace-rail ${expanded ? "is-expanded" : ""}`} aria-label="Navegação do workspace">
      <div className="workspace-rail-top">
        <Link className="workspace-rail-brand" href="/" aria-label="Voltar para a RaccoonSoftwares" data-tooltip="RaccoonSoftwares">
          <span className="workspace-rail-brand-mark" aria-hidden="true">🦝</span><span className="workspace-rail-brand-name">RaccoonSoftwares</span>
        </Link>
        {onToggleExpanded ? <button className="workspace-rail-action workspace-rail-toggle" type="button" onClick={onToggleExpanded} aria-label={expanded ? "Recolher navegação" : "Expandir navegação"} aria-expanded={expanded} data-tooltip={expanded ? "Recolher" : "Abrir navegação"}>
          <WorkspaceIcon name={expanded ? "close" : "menu"} /><span className="workspace-rail-label">{expanded ? "Recolher navegação" : "Abrir navegação"}</span>
        </button> : null}
      </div>

      <ProjectSwitcher projectId={projectId} onProjectInvalid={projectInvalid} />

      <div className="workspace-rail-nav">
        {hasProjectContext ? <>
          <Link className={`workspace-rail-action ${mode === "board" ? "is-active" : ""}`} href={`/workspace/${projectId}`} aria-label="Abrir quadro" aria-current={mode === "board" ? "page" : undefined} data-tooltip="Quadro">
            <WorkspaceIcon name="board" /><span className="workspace-rail-label">Quadro</span>
          </Link>
          <Link className={`workspace-rail-action ${mode === "prospects" ? "is-active" : ""}`} href={`/workspace/${projectId}/prospects`} aria-label="Abrir prospecção" aria-current={mode === "prospects" ? "page" : undefined} data-tooltip="Prospecção">
            <WorkspaceIcon name="mapPin" /><span className="workspace-rail-label">Prospecção</span>
          </Link>
          <Link className={`workspace-rail-action ${mode === "room" ? "is-active" : ""}`} href={`/workspace/${projectId}/room`} aria-label="Abrir sala ao vivo" aria-current={mode === "room" ? "page" : undefined} data-tooltip="Sala ao vivo">
            <WorkspaceIcon name="screen" /><span className="workspace-rail-label">Sala ao vivo</span>
          </Link>
          <Link className={`workspace-rail-action ${mode === "team" ? "is-active" : ""}`} href={`/workspace/${projectId}/team`} aria-label="Abrir equipe" aria-current={mode === "team" ? "page" : undefined} data-tooltip="Equipe">
            <WorkspaceIcon name="users" /><span className="workspace-rail-label">Equipe</span>
          </Link>
        </> : null}
      </div>

      <div className="workspace-rail-bottom">
        <ThemeToggle />
        <div className="workspace-rail-divider" />
        <Link className={`workspace-rail-profile ${mode === "profile" ? "is-active" : ""}`} href="/workspace/profile" aria-label="Abrir perfil" aria-current={mode === "profile" ? "page" : undefined} title="Abrir perfil" data-tooltip="Perfil">
          <WorkspaceIcon name="profile" />
        </Link>
        <button className="workspace-rail-action workspace-rail-logout" type="button" onClick={onLogout} aria-label="Sair da conta" title="Sair da conta" data-tooltip="Sair">
          <WorkspaceIcon name="logout" /><span className="workspace-rail-label">Sair</span>
        </button>
      </div>
    </nav>
  );
}
