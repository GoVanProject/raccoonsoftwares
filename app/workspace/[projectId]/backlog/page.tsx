import WorkspacePage from "../../workspace-page";

export default async function ProjectBacklogPage({ params }: { params: Promise<{ projectId: string }> }) {
  await params;
  return <WorkspacePage view="backlog" />;
}
