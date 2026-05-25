-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "emailVerifiedAt" INTEGER,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT,
    "avatar" TEXT,
    "role" TEXT NOT NULL DEFAULT 'user',
    "locale" TEXT NOT NULL DEFAULT 'zh-CN',
    "twoFactorSecret" TEXT,
    "deletedAt" INTEGER,
    "createdAt" INTEGER NOT NULL,
    "updatedAt" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "UserSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "csrfToken" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "expiresAt" INTEGER NOT NULL,
    "lastSeenAt" INTEGER NOT NULL,
    "createdAt" INTEGER NOT NULL,
    "revokedAt" INTEGER,
    CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AppSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "authType" TEXT NOT NULL,
    "scope" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "lastSeenAt" INTEGER NOT NULL,
    "createdAt" INTEGER NOT NULL,
    "revokedAt" INTEGER,
    CONSTRAINT "AppSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AppSession_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "parentId" TEXT,
    "rotationCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" INTEGER NOT NULL,
    "createdAt" INTEGER NOT NULL,
    "usedAt" INTEGER,
    "revokedAt" INTEGER,
    CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RefreshToken_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AppSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "App" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "primaryDomain" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "settings" TEXT,
    "createdAt" INTEGER NOT NULL,
    "updatedAt" INTEGER NOT NULL,
    "ownerId" TEXT NOT NULL,
    CONSTRAINT "App_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AppDomain" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "appId" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "verified" INTEGER NOT NULL DEFAULT 0,
    "verifyToken" TEXT,
    "createdAt" INTEGER NOT NULL,
    CONSTRAINT "AppDomain_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AppAdmin" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "appId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" INTEGER NOT NULL,
    CONSTRAINT "AppAdmin_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AppAdmin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AppApiKey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "appId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "scopes" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" INTEGER NOT NULL,
    "lastUsedAt" INTEGER,
    "revokedAt" INTEGER,
    CONSTRAINT "AppApiKey_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AppApiKey_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Authorization" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "authType" TEXT NOT NULL,
    "scope" TEXT,
    "grantedAt" INTEGER NOT NULL,
    "expiresAt" INTEGER,
    "revokedAt" INTEGER,
    CONSTRAINT "Authorization_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Authorization_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PolicyDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "appId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "target" TEXT,
    "document" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" INTEGER NOT NULL,
    "updatedAt" INTEGER NOT NULL,
    "createdById" TEXT,
    CONSTRAINT "PolicyDocument_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PolicyDocument_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DataSchema" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "appId" TEXT NOT NULL,
    "dataType" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" INTEGER NOT NULL,
    "updatedAt" INTEGER NOT NULL,
    "createdById" TEXT,
    CONSTRAINT "DataSchema_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DataSchema_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SchemaVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schemaId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "jsonSchema" TEXT NOT NULL,
    "autoFill" TEXT,
    "validationRules" TEXT,
    "isActive" INTEGER NOT NULL DEFAULT 0,
    "createdAt" INTEGER NOT NULL,
    "createdById" TEXT,
    CONSTRAINT "SchemaVersion_schemaId_fkey" FOREIGN KEY ("schemaId") REFERENCES "DataSchema" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SchemaVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Record" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "appId" TEXT NOT NULL,
    "dataType" TEXT NOT NULL,
    "ownerId" TEXT,
    "data" TEXT NOT NULL,
    "schemaVersionId" TEXT,
    "createdAt" INTEGER NOT NULL,
    "updatedAt" INTEGER NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    "deletedAt" INTEGER,
    CONSTRAINT "Record_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Record_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Record_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Record_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FileObject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "appId" TEXT,
    "ownerId" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "checksum" TEXT,
    "checksumAlgo" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "durationMs" INTEGER,
    "uploadId" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'private',
    "storageClass" TEXT NOT NULL DEFAULT 'standard',
    "createdAt" INTEGER NOT NULL,
    "updatedAt" INTEGER NOT NULL,
    "deletedAt" INTEGER,
    CONSTRAINT "FileObject_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FileObject_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FileChunk" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fileId" TEXT NOT NULL,
    "uploadId" TEXT NOT NULL,
    "partNumber" INTEGER NOT NULL,
    "etag" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" INTEGER NOT NULL,
    CONSTRAINT "FileChunk_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "FileObject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FileShareToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fileId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" INTEGER NOT NULL,
    "createdById" TEXT NOT NULL,
    "revokedAt" INTEGER,
    "createdAt" INTEGER NOT NULL,
    CONSTRAINT "FileShareToken_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "FileObject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FileShareToken_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FunctionDefinition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "appId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "runtime" TEXT NOT NULL DEFAULT 'quickjs',
    "env" TEXT,
    "memoryMb" INTEGER NOT NULL DEFAULT 64,
    "timeoutMs" INTEGER NOT NULL DEFAULT 5000,
    "isActive" INTEGER NOT NULL DEFAULT 1,
    "description" TEXT,
    "createdAt" INTEGER NOT NULL,
    "updatedAt" INTEGER NOT NULL,
    "createdById" TEXT,
    "activeDeploymentId" TEXT,
    CONSTRAINT "FunctionDefinition_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FunctionDefinition_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FunctionDeployment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fnId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "sourceCode" TEXT NOT NULL,
    "createdAt" INTEGER NOT NULL,
    "deployedById" TEXT,
    CONSTRAINT "FunctionDeployment_fnId_fkey" FOREIGN KEY ("fnId") REFERENCES "FunctionDefinition" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FunctionDeployment_deployedById_fkey" FOREIGN KEY ("deployedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FunctionInvocation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fnId" TEXT NOT NULL,
    "deploymentId" TEXT,
    "trigger" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "memoryPeakKb" INTEGER,
    "inputPreview" TEXT,
    "output" TEXT,
    "logs" TEXT,
    "error" TEXT,
    "createdAt" INTEGER NOT NULL,
    CONSTRAINT "FunctionInvocation_fnId_fkey" FOREIGN KEY ("fnId") REFERENCES "FunctionDefinition" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FunctionInvocation_deploymentId_fkey" FOREIGN KEY ("deploymentId") REFERENCES "FunctionDeployment" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CronJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "appId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cronExpr" TEXT NOT NULL,
    "fnId" TEXT NOT NULL,
    "payload" TEXT,
    "isActive" INTEGER NOT NULL DEFAULT 1,
    "lastRunAt" INTEGER,
    "lastStatus" TEXT,
    "nextRunAt" INTEGER,
    "createdAt" INTEGER NOT NULL,
    "updatedAt" INTEGER NOT NULL,
    "createdById" TEXT,
    CONSTRAINT "CronJob_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CronJob_fnId_fkey" FOREIGN KEY ("fnId") REFERENCES "FunctionDefinition" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CronJob_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Webhook" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "appId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "events" TEXT NOT NULL,
    "filter" TEXT,
    "isActive" INTEGER NOT NULL DEFAULT 1,
    "createdAt" INTEGER NOT NULL,
    "updatedAt" INTEGER NOT NULL,
    "createdById" TEXT,
    CONSTRAINT "Webhook_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Webhook_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WebhookDelivery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "webhookId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "statusCode" INTEGER,
    "durationMs" INTEGER,
    "errorMessage" TEXT,
    "nextRetryAt" INTEGER,
    "createdAt" INTEGER NOT NULL,
    "updatedAt" INTEGER NOT NULL,
    CONSTRAINT "WebhookDelivery_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "Webhook" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "appId" TEXT,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "before" TEXT,
    "after" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "requestId" TEXT,
    "createdAt" INTEGER NOT NULL,
    CONSTRAINT "AuditLog_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Quota" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "appId" TEXT NOT NULL,
    "rpsLimit" INTEGER NOT NULL,
    "dailyApiCalls" INTEGER NOT NULL,
    "monthlyStorageBytes" INTEGER NOT NULL,
    "monthlyEgressBytes" INTEGER NOT NULL,
    "fnInvocationsDaily" INTEGER NOT NULL,
    "updatedAt" INTEGER NOT NULL,
    CONSTRAINT "Quota_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuotaUsage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "appId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "apiCalls" INTEGER NOT NULL DEFAULT 0,
    "fnInvocations" INTEGER NOT NULL DEFAULT 0,
    "storageBytes" INTEGER NOT NULL DEFAULT 0,
    "egressBytes" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "QuotaUsage_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RateLimitBucket" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "tokens" INTEGER NOT NULL,
    "refilledAt" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "GlobalConfig" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "updatedAt" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_deletedAt_idx" ON "User"("role", "deletedAt");

-- CreateIndex
CREATE INDEX "UserSession_userId_revokedAt_idx" ON "UserSession"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "UserSession_expiresAt_idx" ON "UserSession"("expiresAt");

-- CreateIndex
CREATE INDEX "AppSession_appId_revokedAt_idx" ON "AppSession"("appId", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AppSession_userId_appId_key" ON "AppSession"("userId", "appId");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_sessionId_revokedAt_idx" ON "RefreshToken"("sessionId", "revokedAt");

-- CreateIndex
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "App_primaryDomain_key" ON "App"("primaryDomain");

-- CreateIndex
CREATE INDEX "App_ownerId_status_idx" ON "App"("ownerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AppDomain_host_key" ON "AppDomain"("host");

-- CreateIndex
CREATE UNIQUE INDEX "AppAdmin_appId_userId_key" ON "AppAdmin"("appId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "AppApiKey_keyHash_key" ON "AppApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "Authorization_appId_revokedAt_idx" ON "Authorization"("appId", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Authorization_userId_appId_key" ON "Authorization"("userId", "appId");

-- CreateIndex
CREATE INDEX "PolicyDocument_appId_scope_idx" ON "PolicyDocument"("appId", "scope");

-- CreateIndex
CREATE UNIQUE INDEX "PolicyDocument_appId_scope_target_key" ON "PolicyDocument"("appId", "scope", "target");

-- CreateIndex
CREATE UNIQUE INDEX "DataSchema_appId_dataType_key" ON "DataSchema"("appId", "dataType");

-- CreateIndex
CREATE INDEX "SchemaVersion_schemaId_isActive_idx" ON "SchemaVersion"("schemaId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "SchemaVersion_schemaId_version_key" ON "SchemaVersion"("schemaId", "version");

-- CreateIndex
CREATE INDEX "Record_appId_dataType_deletedAt_idx" ON "Record"("appId", "dataType", "deletedAt");

-- CreateIndex
CREATE INDEX "Record_appId_dataType_ownerId_idx" ON "Record"("appId", "dataType", "ownerId");

-- CreateIndex
CREATE INDEX "Record_appId_dataType_updatedAt_idx" ON "Record"("appId", "dataType", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "FileObject_objectKey_key" ON "FileObject"("objectKey");

-- CreateIndex
CREATE INDEX "FileObject_appId_deletedAt_idx" ON "FileObject"("appId", "deletedAt");

-- CreateIndex
CREATE INDEX "FileObject_ownerId_deletedAt_idx" ON "FileObject"("ownerId", "deletedAt");

-- CreateIndex
CREATE INDEX "FileObject_createdAt_idx" ON "FileObject"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FileChunk_uploadId_partNumber_key" ON "FileChunk"("uploadId", "partNumber");

-- CreateIndex
CREATE UNIQUE INDEX "FileShareToken_token_key" ON "FileShareToken"("token");

-- CreateIndex
CREATE INDEX "FileShareToken_fileId_revokedAt_idx" ON "FileShareToken"("fileId", "revokedAt");

-- CreateIndex
CREATE INDEX "FileShareToken_token_revokedAt_expiresAt_idx" ON "FileShareToken"("token", "revokedAt", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "FunctionDefinition_appId_name_key" ON "FunctionDefinition"("appId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "FunctionDeployment_fnId_version_key" ON "FunctionDeployment"("fnId", "version");

-- CreateIndex
CREATE INDEX "FunctionInvocation_fnId_createdAt_idx" ON "FunctionInvocation"("fnId", "createdAt");

-- CreateIndex
CREATE INDEX "CronJob_isActive_nextRunAt_idx" ON "CronJob"("isActive", "nextRunAt");

-- CreateIndex
CREATE UNIQUE INDEX "CronJob_appId_name_key" ON "CronJob"("appId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Webhook_appId_name_key" ON "Webhook"("appId", "name");

-- CreateIndex
CREATE INDEX "WebhookDelivery_status_nextRetryAt_idx" ON "WebhookDelivery"("status", "nextRetryAt");

-- CreateIndex
CREATE INDEX "WebhookDelivery_webhookId_createdAt_idx" ON "WebhookDelivery"("webhookId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_appId_createdAt_idx" ON "AuditLog"("appId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Quota_appId_key" ON "Quota"("appId");

-- CreateIndex
CREATE UNIQUE INDEX "QuotaUsage_appId_period_key" ON "QuotaUsage"("appId", "period");
