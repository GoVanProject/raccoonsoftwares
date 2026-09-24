import WorkspacePage from "../../workspace-page";

export default async function ProjectSummaryPage({ params }: { params: Promise<{ projectId: string }> }) {
  await params;
  return <WorkspacePage view="summary" />;
}
