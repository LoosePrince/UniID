-- CreateTable
CREATE TABLE "MutationRuleDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "appId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "target" TEXT,
    "ruleId" TEXT NOT NULL,
    "document" TEXT NOT NULL,
    "description" TEXT,
    "isActive" INTEGER NOT NULL DEFAULT 1,
    "createdAt" INTEGER NOT NULL,
    "updatedAt" INTEGER NOT NULL,
    "createdById" TEXT,
    CONSTRAINT "MutationRuleDocument_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MutationRuleDocument_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "MutationRuleDocument_appId_scope_target_ruleId_key" ON "MutationRuleDocument"("appId", "scope", "target", "ruleId");

-- CreateIndex
CREATE INDEX "MutationRuleDocument_appId_scope_isActive_idx" ON "MutationRuleDocument"("appId", "scope", "isActive");