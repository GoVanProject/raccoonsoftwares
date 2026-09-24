"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { ArrowLeft, ArrowsIn, ArrowsOut, CaretRight, Database, DownloadSimple, Folder, Kanban, List, MapPin, Microphone, MicrophoneSlash, Monitor, Moon, Plus, SignOut, Sun, User, Users, X } from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { taskboardFetch } from "../../lib/taskboard";
import { useTaskboardToken } from "../../lib/use-taskboard-token";

export type WorkspaceIconName =
  | "back"
  | "board"
  | "close"
  | "download"
  | "database"
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
  const icons = { back: ArrowLeft, board: Kanban, close: X, download: DownloadSimple, database: Database, folder: Folder, fullscreen: ArrowsOut, exitFullscreen: ArrowsIn, logout: SignOut, mapPin: MapPin, menu: List, mic: Microphone, micOff: MicrophoneSlash, moon: Moon, profile: User, plus: Plus, screen: Monitor, sun: Sun, users: Users, chevron: CaretRight };
  const Icon = icons[name];
  return <Icon className="workspace-icon" aria-hidden="true" weight="regular" />;
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
          aria-label={member.id === currentId ? "Você" : member.email}
        >
          {member.avatar_data ? <Image className="workspace-avatar-image" src={member.avatar_data} alt="" width={40} height={40} unoptimized /> : initials(member.email, member.alias)}
        </span>
      ))}
      {remaining > 0 ? <span className="workspace-avatar-more">+{remaining}</span> : null}
    </div>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const theme = resolvedTheme === "dark" ? "dark" : "light";

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
  }

  const isDark = theme === "dark";
  return (
    <button
      className="workspace-rail-action"
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Ativar tema claro" : "Ativar tema escuro"}
      data-tooltip={isDark ? "Tema claro" : "Tema escuro"}
    >
      <WorkspaceIcon name={isDark ? "sun" : "moon"} /><span className="workspace-rail-label">Tema</span>
    </button>
  );
}

function ProjectSwitcher({ projectId, onProjectInvalid }: { projectId?: string; onProjectInvalid?: () => void }) {
  const router = useRouter();
  const switcherRef = useRef<HTMLDivElement>(null);
  const { token, clearToken } = useTaskboardToken();
  const [projects, setProjects] = useState<WorkspaceProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");

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
          clearToken();
          router.replace("/login");
          return;
        }
        setError(message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [clearToken, onProjectInvalid, projectId, router, token]);

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
          <span className="workspace-rail-brand-mark" aria-hidden="true"><Image src="/raccoon-mascot.webp" width={32} height={32} alt="" /></span>
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
        <Link className={`workspace-rail-profile ${mode === "profile" ? "is-active" : ""}`} href="/workspace/profile" aria-label="Abrir perfil" aria-current={mode === "profile" ? "page" : undefined} data-tooltip="Perfil">
          <WorkspaceIcon name="profile" />
        </Link>
        <button className="workspace-rail-action workspace-rail-logout" type="button" onClick={onLogout} aria-label="Sair da conta" data-tooltip="Sair">
          <WorkspaceIcon name="logout" /><span className="workspace-rail-label">Sair</span>
        </button>
      </div>
    </nav>
  );
}
