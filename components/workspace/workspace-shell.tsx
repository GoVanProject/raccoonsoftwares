"use client";

import { useEffect, useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { List } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WorkspaceRail } from "@/app/workspace/components/workspace-ui";
import { useTaskboardToken } from "@/app/lib/use-taskboard-token";
import type { WorkspaceSection } from "./workspace-primitives";

function activeSection(pathname: string): WorkspaceSection {
  if (pathname.endsWith("/team")) return "team";
  if (pathname.endsWith("/prospects")) return "prospects";
  if (pathname.endsWith("/room")) return "room";
  if (pathname.endsWith("/profile")) return "profile";
  if (pathname.endsWith("/summary") || pathname.endsWith("/backlog")) return "board";
  if (/^\/workspace\/[^/]+$/.test(pathname)) return "board";
  return "projects";
}

export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const params = useParams<{ projectId?: string }>();
  const router = useRouter();
  const { clearToken } = useTaskboardToken();
  const [expanded, setExpanded] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const section = activeSection(pathname);
  const projectId =
    typeof params.projectId === "string" ? params.projectId : undefined;

  useEffect(() => setMobileOpen(false), [pathname]);
  function logout() {
    clearToken();
    router.push("/login");
  }

  return (
    <TooltipProvider delayDuration={250}>
      <div className="min-h-dvh bg-muted/35 md:grid md:grid-cols-[auto_minmax(0,1fr)]">
        <aside className="sticky top-0 hidden h-dvh md:block">
          <WorkspaceRail
            mode={section === "projects" ? "select" : section}
            projectId={projectId}
            expanded={expanded}
            onToggleExpanded={() => setExpanded((value) => !value)}
            onLogout={logout}
          />
        </aside>
        <header className="flex min-h-16 items-center justify-between border-b border-border bg-card px-4 md:hidden">
          <span className="text-sm font-bold tracking-tight">RaccoonSoftwares</span>
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                aria-label="Abrir navegação"
              >
                <List size={20} />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[min(300px,calc(100vw-24px))] p-0">
              <SheetTitle className="sr-only">
                Navegação do workspace
              </SheetTitle>
              <WorkspaceRail
                mode={section === "projects" ? "select" : section}
                projectId={projectId}
                expanded
                onLogout={logout}
              />
            </SheetContent>
          </Sheet>
        </header>
        <div className="min-w-0">{children}</div>
      </div>
    </TooltipProvider>
  );
}
