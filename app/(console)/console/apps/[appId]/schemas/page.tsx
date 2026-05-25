import { notFound } from "next/navigation";
import { requireConsoleAuth } from "@/shared/iam";
import { prisma } from "@/shared/prisma";
import { AppService } from "@/modules/apps";
import { SchemaService } from "@/modules/schema";
import { SchemaManagementPanel } from "@/ui/console/schema-actions";

export default async function SchemasPage({ params }: { params: { appId: string } }) {
  const auth = await requireConsoleAuth();
  const app = await prisma.app.findUnique({
    where: { id: params.appId },
    include: { admins: true }
  });
  if (!app) notFound();
  if (auth.user.role !== "admin") {
    await AppService.requireOwnerOrAdmin(app.ownerId, app.admins, auth.user.id);
  }

  const schemas = await SchemaService.listForApp(app.id);

  return <SchemaManagementPanel appId={app.id} schemas={schemas} />;
}