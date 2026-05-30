import { z } from "zod";
import { defineRoute, idSchema } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { requireAppAccess } from "@/shared/iam";
import { resolveRequestLocale } from "@/shared/i18n/server";
import { PolicyAdminService, policyPreviewMigrationInputSchema } from "@/modules/policies";

const params = z.object({ appId: idSchema });

export const POST = withCors(
  "admin-only",
  defineRoute({
    schema: { params, body: policyPreviewMigrationInputSchema },
    handler: async ({ params: p, body }, { req }) => {
      const auth = await requireAppAccess(p.appId);
      const locale = await resolveRequestLocale(req, { userId: auth.user.id });
      return PolicyAdminService.previewMigration(auth.app.id, body, locale);
    }
  })
);

export const OPTIONS = withCors("admin-only", async () => new Response(null, { status: 204 }));