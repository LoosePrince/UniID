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
  sessionTokenPrefix?: string | null;
}): Promise<RevokeAuthorizationResult> {
  const { userId, appId, sessionTokenPrefix } = options;
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

  if (sessionTokenPrefix) {
    await prisma.session.updateMany({
      where: {
        userId,
        token: {
          startsWith: sessionTokenPrefix
        }
      },
      data: {
        expiresAt: now
      }
    });
  }

  return {
    ok: true,
    revokedAt: now
  };
}

