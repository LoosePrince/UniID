-- CreateTable
CREATE TABLE "FunctionEventTrigger" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "appId" TEXT NOT NULL,
    "fnId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "events" TEXT NOT NULL,
    "filter" TEXT,
    "isActive" INTEGER NOT NULL DEFAULT 1,
    "createdAt" INTEGER NOT NULL,
    "updatedAt" INTEGER NOT NULL,
    "createdById" TEXT,
    CONSTRAINT "FunctionEventTrigger_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FunctionEventTrigger_fnId_fkey" FOREIGN KEY ("fnId") REFERENCES "FunctionDefinition" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FunctionEventTrigger_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "FunctionEventTrigger_appId_isActive_idx" ON "FunctionEventTrigger"("appId", "isActive");

-- CreateIndex
CREATE INDEX "FunctionEventTrigger_fnId_isActive_idx" ON "FunctionEventTrigger"("fnId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "FunctionEventTrigger_appId_name_key" ON "FunctionEventTrigger"("appId", "name");
