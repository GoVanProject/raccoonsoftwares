import ProspectsClient from "./prospects-client";

export default async function ProspectsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <ProspectsClient projectId={projectId} />;
}
