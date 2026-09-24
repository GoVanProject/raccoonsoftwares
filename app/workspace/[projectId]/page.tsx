import WorkspacePage from "../workspace-page";

export default async function ProjectBoardPage({ params }: { params: Promise<{ projectId: string }> }) {
  await params;
  return <WorkspacePage view="board" />;
}
