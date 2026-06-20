-- App-level independent SQLite databases.

CREATE TABLE "AppDatabase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "appId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" INTEGER NOT NULL,
    "updatedAt" INTEGER NOT NULL,
    "lastAccessAt" INTEGER,
    "deletedAt" INTEGER,
    CONSTRAINT "AppDatabase_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AppDatabase_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "AppDatabaseKey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "databaseId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" INTEGER NOT NULL,
    "lastUsedAt" INTEGER,
    "revokedAt" INTEGER,
    CONSTRAINT "AppDatabaseKey_databaseId_fkey" FOREIGN KEY ("databaseId") REFERENCES "AppDatabase" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AppDatabaseKey_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "DataStorageBinding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "appId" TEXT NOT NULL,
    "dataType" TEXT NOT NULL,
    "storageKind" TEXT NOT NULL DEFAULT 'main',
    "databaseId" TEXT,
    "tableName" TEXT,
    "migratedAt" INTEGER,
    "createdAt" INTEGER NOT NULL,
    "updatedAt" INTEGER NOT NULL,
    CONSTRAINT "DataStorageBinding_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DataStorageBinding_databaseId_fkey" FOREIGN KEY ("databaseId") REFERENCES "AppDatabase" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "AppDatabase_filename_key" ON "AppDatabase"("filename");
CREATE UNIQUE INDEX "AppDatabase_appId_name_key" ON "AppDatabase"("appId", "name");
CREATE INDEX "AppDatabase_appId_status_idx" ON "AppDatabase"("appId", "status");

CREATE UNIQUE INDEX "AppDatabaseKey_keyHash_key" ON "AppDatabaseKey"("keyHash");
CREATE INDEX "AppDatabaseKey_databaseId_revokedAt_idx" ON "AppDatabaseKey"("databaseId", "revokedAt");

CREATE UNIQUE INDEX "DataStorageBinding_appId_dataType_key" ON "DataStorageBinding"("appId", "dataType");
CREATE INDEX "DataStorageBinding_appId_storageKind_idx" ON "DataStorageBinding"("appId", "storageKind");
CREATE INDEX "DataStorageBinding_databaseId_idx" ON "DataStorageBinding"("databaseId");
