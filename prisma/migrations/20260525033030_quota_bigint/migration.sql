/*
  Warnings:

  - You are about to alter the column `monthlyEgressBytes` on the `Quota` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `monthlyStorageBytes` on the `Quota` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `egressBytes` on the `QuotaUsage` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `storageBytes` on the `QuotaUsage` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Quota" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "appId" TEXT NOT NULL,
    "rpsLimit" INTEGER NOT NULL,
    "dailyApiCalls" INTEGER NOT NULL,
    "monthlyStorageBytes" BIGINT NOT NULL,
    "monthlyEgressBytes" BIGINT NOT NULL,
    "fnInvocationsDaily" INTEGER NOT NULL,
    "updatedAt" INTEGER NOT NULL,
    CONSTRAINT "Quota_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Quota" ("appId", "dailyApiCalls", "fnInvocationsDaily", "id", "monthlyEgressBytes", "monthlyStorageBytes", "rpsLimit", "updatedAt") SELECT "appId", "dailyApiCalls", "fnInvocationsDaily", "id", "monthlyEgressBytes", "monthlyStorageBytes", "rpsLimit", "updatedAt" FROM "Quota";
DROP TABLE "Quota";
ALTER TABLE "new_Quota" RENAME TO "Quota";
CREATE UNIQUE INDEX "Quota_appId_key" ON "Quota"("appId");
CREATE TABLE "new_QuotaUsage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "appId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "apiCalls" INTEGER NOT NULL DEFAULT 0,
    "fnInvocations" INTEGER NOT NULL DEFAULT 0,
    "storageBytes" BIGINT NOT NULL DEFAULT 0,
    "egressBytes" BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT "QuotaUsage_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_QuotaUsage" ("apiCalls", "appId", "egressBytes", "fnInvocations", "id", "period", "storageBytes") SELECT "apiCalls", "appId", "egressBytes", "fnInvocations", "id", "period", "storageBytes" FROM "QuotaUsage";
DROP TABLE "QuotaUsage";
ALTER TABLE "new_QuotaUsage" RENAME TO "QuotaUsage";
CREATE UNIQUE INDEX "QuotaUsage_appId_period_key" ON "QuotaUsage"("appId", "period");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
