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

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

function ThemeToggle({ expanded = false }: { expanded?: boolean }) {
  const { resolvedTheme, setTheme } = useTheme();
  const theme = resolvedTheme === "dark" ? "dark" : "light";

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
  }

  const isDark = theme === "dark";
  const label = isDark ? "Ativar tema claro" : "Ativar tema escuro";

  const button = (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        "h-11 rounded-xl text-muted-foreground transition-all duration-200 hover:bg-muted/80 hover:text-foreground border border-transparent",
        expanded ? "w-full justify-start gap-3 px-3" : "size-11 justify-center p-0 mx-auto"
      )}
      type="button"
      onClick={toggleTheme}
      aria-label={label}
    >
      <WorkspaceIcon name={isDark ? "sun" : "moon"} />
      {expanded ? (
        <span className="text-sm font-medium">
          Tema ({isDark ? "Escuro" : "Claro"})
        </span>
      ) : (
        <span className="sr-only">{label}</span>
      )}
    </Button>
  );

  if (!expanded) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="right" className="font-semibold">{label}</TooltipContent>
      </Tooltip>
    );
  }

  return button;
}

function ProjectSwitcher({
  projectId,
  expanded = false,
  onProjectInvalid,
}: {
  projectId?: string;
  expanded?: boolean;
  onProjectInvalid?: () => void;
}) {
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

  const triggerAria = currentProject ? `Projeto atual: ${currentProject.name}` : "Selecionar projeto";

  const trigger = (
    <button
      type="button"
      className={cn(
        "group relative flex items-center rounded-xl border border-border/80 bg-secondary/50 text-foreground transition-all duration-200 hover:border-primary/40 hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20",
        expanded ? "h-12 w-full gap-2.5 px-3 py-2 text-left" : "size-11 mx-auto justify-center",
        open && "border-primary bg-secondary/80 ring-2 ring-primary/20"
      )}
      onClick={() => setOpen((current) => !current)}
      aria-label={triggerAria}
      aria-expanded={open}
      aria-haspopup="listbox"
    >
      <div
        className={cn(
          "flex shrink-0 items-center justify-center text-primary",
          expanded ? "size-7 rounded-lg bg-primary/10" : ""
        )}
      >
        <WorkspaceIcon name="folder" />
      </div>
      {expanded ? (
        <>
          <span className="grid min-w-0 flex-1 gap-0.5">
            <small className="text-[10px] font-medium text-muted-foreground leading-none">Projeto atual</small>
            <strong className="overflow-hidden text-ellipsis whitespace-nowrap text-xs leading-tight">
              {currentProject?.name || "Selecionar projeto"}
            </strong>
          </span>
          <WorkspaceIcon name="chevron" />
        </>
      ) : (
        <span className="sr-only">{triggerAria}</span>
      )}
      {!expanded && currentProject ? (
        <span className="absolute bottom-1.5 right-1.5 size-2 rounded-full bg-primary ring-2 ring-card" />
      ) : null}
    </button>
  );

  return (
    <div className="relative w-full" ref={switcherRef}>
      {!expanded ? (
        <Tooltip>
          <TooltipTrigger asChild>{trigger}</TooltipTrigger>
          <TooltipContent side="right" className="font-semibold">{triggerAria}</TooltipContent>
        </Tooltip>
      ) : (
        trigger
      )}

      {open ? (
        <div
          className={cn(
            "absolute z-50 grid max-h-[min(420px,calc(100dvh-140px))] gap-1 overflow-y-auto rounded-xl border border-border/80 bg-card/95 p-2 shadow-2xl backdrop-blur-xl",
            expanded
              ? "left-0 top-[calc(100%+8px)] w-full min-w-[240px]"
              : "left-[calc(100%+10px)] top-0 w-72"
          )}
          role="listbox"
          aria-label="Projetos disponíveis"
        >
          <div className="flex items-center justify-between px-2.5 py-1.5 text-xs font-semibold border-b border-border/50 pb-2 mb-1">
            <span className="text-foreground">Projetos</span>
            <small className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
              {loading ? "..." : projects.length}
            </small>
          </div>
          {loading ? (
            <div className="grid gap-1.5 p-1">
              {[1, 2, 3].map((item) => (
                <div className="h-10 animate-pulse rounded-lg bg-muted/70" key={item} />
              ))}
            </div>
          ) : null}
          {!loading && error ? (
            <p className="m-0 px-2 py-3 text-xs text-destructive">{error}</p>
          ) : null}
          {!loading && !error && !projects.length ? (
            <p className="m-0 px-2 py-3 text-xs text-muted-foreground">Nenhum projeto disponível ainda.</p>
          ) : null}
          {!loading && !error
            ? projects.map((project) => (
                <button
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left transition-colors",
                    project.id === projectId
                      ? "bg-primary/12 text-primary font-semibold"
                      : "text-foreground hover:bg-muted/80"
                  )}
                  role="option"
                  aria-selected={project.id === projectId}
                  type="button"
                  key={project.id}
                  onClick={() => selectProject(project)}
                >
                  <span className="grid min-w-0 gap-0.5">
                    <strong className="overflow-hidden text-ellipsis whitespace-nowrap text-xs">
                      {project.name}
                    </strong>
                    <small className="text-[10px] font-normal text-muted-foreground">
                      {project.task_count} {project.task_count === 1 ? "tarefa" : "tarefas"}
                    </small>
                  </span>
                  <WorkspaceIcon name="chevron" />
                </button>
              ))
            : null}
          <div className="mt-1 border-t border-border/50 pt-1">
            <Link
              className="flex min-h-9 items-center gap-2 rounded-lg px-2.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
              href="/workspace"
              onClick={() => setOpen(false)}
            >
              <WorkspaceIcon name="folder" />
              Gerenciar projetos
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function WorkspaceNavLink({
  href,
  active,
  icon,
  label,
  expanded,
}: {
  href: string;
  active: boolean;
  icon: WorkspaceIconName;
  label: string;
  expanded: boolean;
}) {
  const content = (
    <Link
      href={href}
      className={cn(
        "group relative flex items-center rounded-xl text-sm font-medium transition-all duration-200",
        expanded ? "h-11 w-full gap-3 px-3" : "size-11 mx-auto justify-center",
        active
          ? "bg-primary/12 text-primary font-semibold shadow-xs border border-primary/20 dark:bg-primary/20 dark:text-primary-foreground dark:border-primary/30"
          : "text-muted-foreground hover:bg-muted/80 hover:text-foreground border border-transparent"
      )}
      aria-label={`Abrir ${label.toLowerCase()}`}
      aria-current={active ? "page" : undefined}
    >
      <WorkspaceIcon name={icon} />
      {expanded ? (
        <>
          <span className="truncate">{label}</span>
          {active && (
            <span className="ml-auto size-1.5 rounded-full bg-primary" />
          )}
        </>
      ) : (
        <span className="sr-only">{label}</span>
      )}
    </Link>
  );

  if (!expanded) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right" className="font-semibold">{label}</TooltipContent>
      </Tooltip>
    );
  }

  return content;
}

function LogoutButton({
  expanded,
  onLogout,
}: {
  expanded: boolean;
  onLogout: () => void;
}) {
  const content = (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        "h-11 rounded-xl text-muted-foreground transition-all duration-200 hover:bg-destructive/10 hover:text-destructive border border-transparent",
        expanded ? "w-full justify-start gap-3 px-3" : "size-11 justify-center p-0 mx-auto"
      )}
      type="button"
      onClick={onLogout}
      aria-label="Sair da conta"
    >
      <WorkspaceIcon name="logout" />
      {expanded ? <span className="text-sm font-medium">Sair</span> : <span className="sr-only">Sair</span>}
    </Button>
  );

  if (!expanded) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right" className="font-semibold">Sair da conta</TooltipContent>
      </Tooltip>
    );
  }

  return content;
}

export function WorkspaceRail({ mode, projectId, expanded = false, onToggleExpanded, onLogout }: WorkspaceRailProps) {
  const router = useRouter();
  const projectInvalid = useCallback(() => router.replace("/workspace?error=project-not-found"), [router]);
  const hasProjectContext = Boolean(projectId);

  return (
    <nav
      className={cn(
        "flex h-full flex-col gap-3 p-3 transition-[width] duration-300 ease-in-out border-r border-border/80 bg-card/85 backdrop-blur-xl shadow-xs",
        expanded ? "w-64" : "w-[72px]"
      )}
      aria-label="Navegação do workspace"
    >
      {/* Brand Header */}
      <div className="flex items-center justify-between gap-2 px-0.5">
        <Link
          className={cn(
            "group flex items-center gap-2.5 rounded-xl transition-all duration-200",
            !expanded && "mx-auto justify-center"
          )}
          href="/"
          aria-label="Voltar para a RaccoonSoftwares"
        >
          <div className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl border border-border/80 bg-muted/60 p-1 shadow-2xs transition-all duration-300 group-hover:scale-105 group-hover:border-primary/40 group-hover:shadow-xs">
            <Image src="/raccoon-mascot.webp" width={32} height={32} alt="Raccoon Mascot" className="size-full object-contain" />
          </div>
          {expanded ? (
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold tracking-tight text-foreground leading-tight">Raccoon</span>
              <span className="text-[10px] font-medium text-muted-foreground leading-tight">Softwares</span>
            </div>
          ) : null}
        </Link>

        {onToggleExpanded && expanded ? (
          <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            type="button"
            onClick={onToggleExpanded}
            aria-label="Recolher navegação"
            aria-expanded={expanded}
          >
            <WorkspaceIcon name="close" />
          </Button>
        ) : null}
      </div>

      {onToggleExpanded && !expanded ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="mx-auto size-8 shrink-0 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
              type="button"
              onClick={onToggleExpanded}
              aria-label="Expandir navegação"
              aria-expanded={expanded}
            >
              <WorkspaceIcon name="menu" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" className="font-semibold">Expandir navegação</TooltipContent>
        </Tooltip>
      ) : null}

      <div className="my-0.5 w-full">
        <ProjectSwitcher projectId={projectId} expanded={expanded} onProjectInvalid={projectInvalid} />
      </div>

      <div className="grid gap-1.5 w-full">
        {hasProjectContext ? (
          <>
            {expanded ? (
              <span className="px-2 pt-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                Menu
              </span>
            ) : null}
            <WorkspaceNavLink
              href={`/workspace/${projectId}`}
              active={mode === "board"}
              icon="board"
              label="Quadro"
              expanded={expanded}
            />
            <WorkspaceNavLink
              href={`/workspace/${projectId}/prospects`}
              active={mode === "prospects"}
              icon="mapPin"
              label="Prospecção"
              expanded={expanded}
            />
            <WorkspaceNavLink
              href={`/workspace/${projectId}/room`}
              active={mode === "room"}
              icon="screen"
              label="Sala ao vivo"
              expanded={expanded}
            />
            <WorkspaceNavLink
              href={`/workspace/${projectId}/team`}
              active={mode === "team"}
              icon="users"
              label="Equipe"
              expanded={expanded}
            />
          </>
        ) : null}
      </div>

      {/* Footer Actions */}
      <div className="mt-auto grid gap-1.5 w-full pt-2 border-t border-border/60">
        <ThemeToggle expanded={expanded} />
        <WorkspaceNavLink
          href="/workspace/profile"
          active={mode === "profile"}
          icon="profile"
          label="Perfil"
          expanded={expanded}
        />
        <LogoutButton expanded={expanded} onLogout={onLogout} />
      </div>
    </nav>
  );
}
