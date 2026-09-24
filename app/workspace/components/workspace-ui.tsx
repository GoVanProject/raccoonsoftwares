"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { ArrowLeft, ArrowsIn, ArrowsOut, CaretRight, ChartBar, Database, DownloadSimple, Folder, Kanban, List, ListBullets, MapPin, Microphone, MicrophoneSlash, Monitor, Moon, Plus, SignOut, Sun, User, Users, X } from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { taskboardFetch } from "../../lib/taskboard";
import { useTaskboardToken } from "../../lib/use-taskboard-token";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type WorkspaceIconName =
  | "back"
  | "board"
  | "summary"
  | "backlog"
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
  const icons = { back: ArrowLeft, board: Kanban, summary: ChartBar, backlog: ListBullets, close: X, download: DownloadSimple, database: Database, folder: Folder, fullscreen: ArrowsOut, exitFullscreen: ArrowsIn, logout: SignOut, mapPin: MapPin, menu: List, mic: Microphone, micOff: MicrophoneSlash, moon: Moon, profile: User, plus: Plus, screen: Monitor, sun: Sun, users: Users, chevron: CaretRight };
  const Icon = icons[name];
  return <Icon className="size-[18px] shrink-0" aria-hidden="true" weight="regular" />;
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
    <div className="flex -space-x-2" aria-label={label}>
      {visibleMembers.map((member) => (
        <span
          className={cn("grid size-9 place-items-center overflow-hidden rounded-full border-2 border-card bg-primary text-xs font-bold text-primary-foreground", member.publishing && "ring-2 ring-emerald-500 ring-offset-1 ring-offset-card")}
          key={member.id}
          aria-label={member.id === currentId ? "Você" : member.email}
        >
          {member.avatar_data ? <Image className="size-full object-cover" src={member.avatar_data} alt="" width={40} height={40} unoptimized /> : initials(member.email, member.alias)}
        </span>
      ))}
      {remaining > 0 ? <span className="grid size-9 place-items-center rounded-full border-2 border-card bg-muted text-xs font-bold text-muted-foreground">+{remaining}</span> : null}
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
    <Button
      variant="ghost"
      size="sm"
      className="h-10 w-full justify-start rounded-lg px-3 text-muted-foreground"
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Ativar tema claro" : "Ativar tema escuro"}
    >
      <WorkspaceIcon name={isDark ? "sun" : "moon"} /><span>Tema</span>
    </Button>
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
    <div className="relative" ref={switcherRef}>
      <Button
        variant="outline"
        className="h-auto min-h-12 w-full justify-start gap-2 px-3 py-2 text-left"
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label={currentProject ? `Projeto atual: ${currentProject.name}` : "Selecionar projeto"}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <WorkspaceIcon name="folder" />
        <span className="grid min-w-0 flex-1 gap-0.5"><small className="text-[10px] font-medium text-muted-foreground">Projeto atual</small><strong className="overflow-hidden text-ellipsis whitespace-nowrap text-xs">{currentProject?.name || "Selecionar projeto"}</strong></span>
        <WorkspaceIcon name="chevron" />
      </Button>
      {open ? <div className="absolute left-0 top-[calc(100%+8px)] z-50 grid max-h-[min(420px,calc(100dvh-140px))] w-[min(320px,calc(100vw-32px))] gap-1 overflow-y-auto rounded-xl border border-border bg-card p-2 shadow-xl" role="listbox" aria-label="Projetos disponíveis">
        <div className="flex items-center justify-between px-2 py-1 text-xs font-semibold"><span>Projetos</span><small className="text-muted-foreground">{loading ? "Carregando" : projects.length}</small></div>
        {loading ? <>{[1, 2, 3].map((item) => <div className="h-12 animate-pulse rounded-lg bg-muted" key={item} />)}</> : null}
        {!loading && error ? <p className="m-0 px-2 py-3 text-sm text-destructive">{error}</p> : null}
        {!loading && !error && !projects.length ? <p className="m-0 px-2 py-3 text-sm text-muted-foreground">Nenhum projeto disponível ainda.</p> : null}
        {!loading && !error ? projects.map((project) => <Button variant="ghost" size="sm" className={cn("h-auto w-full justify-between px-2 py-2 text-left", project.id === projectId && "bg-primary/10 text-primary")} role="option" aria-selected={project.id === projectId} type="button" key={project.id} onClick={() => selectProject(project)}>
          <span className="grid min-w-0 gap-0.5"><strong className="overflow-hidden text-ellipsis whitespace-nowrap text-xs">{project.name}</strong><small className="text-[11px] font-normal text-muted-foreground">{project.task_count} {project.task_count === 1 ? "tarefa" : "tarefas"}</small></span>
          <WorkspaceIcon name="chevron" />
        </Button>) : null}
        <Link className="mt-1 flex min-h-10 items-center gap-2 rounded-lg px-2 text-xs font-semibold text-primary hover:bg-primary/10" href="/workspace" onClick={() => setOpen(false)}><WorkspaceIcon name="folder" />Gerenciar projetos</Link>
      </div> : null}
    </div>
  );
}

export function WorkspaceRail({ mode, projectId, expanded = false, onToggleExpanded, onLogout }: WorkspaceRailProps) {
  const router = useRouter();
  const projectInvalid = useCallback(() => router.replace("/workspace?error=project-not-found"), [router]);
  const hasProjectContext = Boolean(projectId);

  return (
    <nav className={cn("flex h-full w-[76px] flex-col gap-4 p-3 transition-[width] duration-200", expanded && "w-64")} aria-label="Navegação do workspace">
      <div className="flex items-center justify-between gap-2">
        <Link className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-muted" href="/" aria-label="Voltar para a RaccoonSoftwares">
          <Image src="/raccoon-mascot.webp" width={32} height={32} alt="" />
        </Link>
        {onToggleExpanded ? <Button variant="ghost" size="icon" className="size-10 shrink-0" type="button" onClick={onToggleExpanded} aria-label={expanded ? "Recolher navegação" : "Expandir navegação"} aria-expanded={expanded}><WorkspaceIcon name={expanded ? "close" : "menu"} /></Button> : null}
      </div>

      <ProjectSwitcher projectId={projectId} onProjectInvalid={projectInvalid} />

      <div className="grid gap-1">
        {hasProjectContext ? <>
          <Link className={cn("flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground", mode === "board" && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground")} href={`/workspace/${projectId}`} aria-label="Abrir quadro" aria-current={mode === "board" ? "page" : undefined}>
            <WorkspaceIcon name="board" /><span className={cn(!expanded && "sr-only")}>Quadro</span>
          </Link>
          <Link className={cn("flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground", mode === "prospects" && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground")} href={`/workspace/${projectId}/prospects`} aria-label="Abrir prospecção" aria-current={mode === "prospects" ? "page" : undefined}>
            <WorkspaceIcon name="mapPin" /><span className={cn(!expanded && "sr-only")}>Prospecção</span>
          </Link>
          <Link className={cn("flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground", mode === "room" && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground")} href={`/workspace/${projectId}/room`} aria-label="Abrir sala ao vivo" aria-current={mode === "room" ? "page" : undefined}>
            <WorkspaceIcon name="screen" /><span className={cn(!expanded && "sr-only")}>Sala ao vivo</span>
          </Link>
          <Link className={cn("flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground", mode === "team" && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground")} href={`/workspace/${projectId}/team`} aria-label="Abrir equipe" aria-current={mode === "team" ? "page" : undefined}>
            <WorkspaceIcon name="users" /><span className={cn(!expanded && "sr-only")}>Equipe</span>
          </Link>
        </> : null}
      </div>

      <div className="mt-auto grid gap-2">
        <ThemeToggle />
        <div className="h-px bg-border" />
        <Link className={cn("flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground", mode === "profile" && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground")} href="/workspace/profile" aria-label="Abrir perfil" aria-current={mode === "profile" ? "page" : undefined}>
          <WorkspaceIcon name="profile" /><span className={cn(!expanded && "sr-only")}>Perfil</span>
        </Link>
        <Button variant="ghost" size="sm" className="h-10 w-full justify-start px-3 text-destructive hover:text-destructive" type="button" onClick={onLogout} aria-label="Sair da conta">
          <WorkspaceIcon name="logout" /><span className={cn(!expanded && "sr-only")}>Sair</span>
        </Button>
      </div>
    </nav>
  );
}
