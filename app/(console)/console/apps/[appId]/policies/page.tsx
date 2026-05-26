import { notFound } from "next/navigation";
import { requireConsoleAuth } from "@/shared/iam";
import { prisma } from "@/shared/prisma";
import { AppService } from "@/modules/apps";
import { PolicyAdminService } from "@/modules/policies";
import { SchemaService } from "@/modules/schema";
import { PolicyManagementPanel } from "@/ui/console/policy-actions";

export default async function PoliciesPage({ params }: { params: { appId: string } }) {
  const auth = await requireConsoleAuth();
  const app = await prisma.app.findUnique({
    where: { id: params.appId },
    include: { admins: true }
  });
  if (!app) notFound();
  if (auth.user.role !== "admin") {
    await AppService.requireOwnerOrAdmin(app.ownerId, app.admins, auth.user.id);
  }

  const [policies, schemas] = await Promise.all([
    PolicyAdminService.list(app.id),
    SchemaService.listForApp(app.id)
  ]);

  return <PolicyManagementPanel appId={app.id} policies={policies} schemas={schemas} />;
}