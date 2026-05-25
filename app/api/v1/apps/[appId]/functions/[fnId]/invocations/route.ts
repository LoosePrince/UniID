import { defineRoute } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { requireAppAccess } from "@/shared/iam";
import { FunctionsService } from "@/modules/functions";

export const GET = withCors(
  "admin-only",
  defineRoute({
    handler: async (_input, { params }) => {
      await requireAppAccess(String(params.appId));
      const items = await FunctionsService.listInvocations(String(params.fnId), 50);
      return { items };
    }
  })
);

export const OPTIONS = withCors("admin-only", async () => new Response(null, { status: 204 }));
