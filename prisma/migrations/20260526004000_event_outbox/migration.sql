CREATE TABLE "EventOutbox" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "appId" TEXT,
    "eventType" TEXT NOT NULL,
    "resourceType" TEXT,
    "resourceId" TEXT,
    "payload" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" INTEGER,
    "dispatchedAt" INTEGER,
    "errorMessage" TEXT,
    "causedByEventId" TEXT,
    "createdAt" INTEGER NOT NULL,
    "updatedAt" INTEGER NOT NULL,
    CONSTRAINT "EventOutbox_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "EventOutbox_appId_createdAt_idx" ON "EventOutbox"("appId", "createdAt");
CREATE INDEX "EventOutbox_eventType_createdAt_idx" ON "EventOutbox"("eventType", "createdAt");
CREATE INDEX "EventOutbox_status_nextAttemptAt_idx" ON "EventOutbox"("status", "nextAttemptAt");
CREATE INDEX "EventOutbox_resourceType_resourceId_idx" ON "EventOutbox"("resourceType", "resourceId");