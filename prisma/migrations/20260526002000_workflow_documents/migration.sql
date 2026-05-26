-- CreateTable
CREATE TABLE "WorkflowDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "appId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "target" TEXT,
    "workflowId" TEXT NOT NULL,
    "document" TEXT NOT NULL,
    "description" TEXT,
    "isActive" INTEGER NOT NULL DEFAULT 1,
    "createdAt" INTEGER NOT NULL,
    "updatedAt" INTEGER NOT NULL,
    "createdById" TEXT,
    CONSTRAINT "WorkflowDocument_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkflowDocument_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowDocument_appId_scope_target_workflowId_key" ON "WorkflowDocument"("appId", "scope", "target", "workflowId");

-- CreateIndex
CREATE INDEX "WorkflowDocument_appId_scope_isActive_idx" ON "WorkflowDocument"("appId", "scope", "isActive");