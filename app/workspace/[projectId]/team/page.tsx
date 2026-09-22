import TeamClient from "./team-client";

export default async function TeamPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <TeamClient projectId={projectId} />;
}
