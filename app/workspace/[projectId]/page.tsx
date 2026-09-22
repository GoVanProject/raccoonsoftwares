import WorkspacePage from "../page";

export default async function ProjectBoardPage({ params }: { params: Promise<{ projectId: string }> }) {
  await params;
  return <WorkspacePage />;
}
