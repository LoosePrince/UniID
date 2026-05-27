import { notFound } from "next/navigation";
import { requireConsoleAuth } from "@/shared/iam";
import { prisma } from "@/shared/prisma";
import { AppService } from "@/modules/apps";
import { MutationRuleService } from "@/modules/mutation-rules";
import { WorkflowService } from "@/modules/workflows";
import { SchemaService } from "@/modules/schema";
import { BusinessRulesPanel } from "@/ui/console/business-actions";

export default async function BusinessPage({ params }: { params: { appId: string } }) {
  const auth = await requireConsoleAuth();
  const app = await prisma.app.findUnique({
    where: { id: params.appId },
    include: { admins: true }
  });
  if (!app) notFound();
  if (auth.user.role !== "admin") {
    await AppService.requireOwnerOrAdmin(app.ownerId, app.admins, auth.user.id);
  }

  const [mutationRules, workflows, schemas] = await Promise.all([
    MutationRuleService.list(app.id),
    WorkflowService.list(app.id),
    SchemaService.listForApp(app.id)
  ]);

  return (
    <BusinessRulesPanel
      appId={app.id}
      mutationRules={mutationRules}
      workflows={workflows}
      schemas={schemas.map((schema) => ({
        id: schema.id,
        dataType: schema.dataType,
        description: schema.description,
        updatedAt: schema.updatedAt
      }))}
    />
  );
}