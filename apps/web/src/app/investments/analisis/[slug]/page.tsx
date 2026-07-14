import { notFound } from "next/navigation";
import { documents } from "@hub/core";
import { DocumentView } from "@/modules/investments";
import { PageHeader } from "@/components/ui";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AnalisisDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const session = await requireSession();
  const { slug } = await params;
  const doc = await documents.getBySlug(session.user.id, slug);
  if (!doc) notFound();

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <PageHeader title={doc.title} back />
      <DocumentView doc={doc} />
    </main>
  );
}
