import { z } from "zod";
import { defineRoute, domainSchema } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { requireConsoleAuth, requireSystemAdmin } from "@/shared/iam";
import { AppService } from "@/modules/apps";

const createSchema = z.object({
  name: z.string().trim().min(1).max(64),
  primaryDomain: domainSchema.transform((v) => v.toLowerCase()),
  description: z.string().trim().max(500).optional(),
  ownerId: z.string().min(1),
  adminIds: z.array(z.string().min(1)).default([])
});

export const GET = withCors(
  "admin-only",
  defineRoute({
    handler: async () => {
      const auth = await requireConsoleAuth();
      const apps = await AppService.listOwnedOrAdmin(auth.user.id);
      return { apps };
    }
  })
);

export const POST = withCors(
  "admin-only",
  defineRoute({
    schema: { body: createSchema },
    handler: async ({ body }) => {
      await requireSystemAdmin();
      const app = await AppService.create({
        ownerId: body.ownerId,
        adminIds: body.adminIds,
        name: body.name,
        primaryDomain: body.primaryDomain,
        description: body.description
      });
      return {
        app: {
          id: app.id,
          name: app.name,
          primaryDomain: app.primaryDomain,
          description: app.description,
          status: app.status,
          createdAt: app.createdAt
        }
      };
    }
  })
);

export const OPTIONS = withCors("admin-only", async () => new Response(null, { status: 204 }));