import { prisma } from "./prisma";

export type RevokeAuthorizationResult =
  | {
      ok: true;
      revokedAt: number;
    }
  | {
      ok: false;
      reason: "AUTHORIZATION_NOT_FOUND";
    };

export async function revokeAuthorizationForUserAndApp(options: {
  userId: string;
  appId: string;
}): Promise<RevokeAuthorizationResult> {
  const { userId, appId } = options;
  const now = Math.floor(Date.now() / 1000);

  const authorization = await prisma.authorization.findUnique({
    where: {
      userId_appId: {
        userId,
        appId
      }
    }
  });

  if (!authorization) {
    return {
      ok: false,
      reason: "AUTHORIZATION_NOT_FOUND"
    };
  }

  await prisma.authorization.update({
    where: {
      userId_appId: {
        userId,
        appId
      }
    },
    data: {
      revoked: 1
    }
  });

  return {
    ok: true,
    revokedAt: now
  };
}

