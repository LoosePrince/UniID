/**
 * UniID seed data — minimal demo dataset.
 * Run with: `npm run prisma:seed`
 *
 * Creates:
 *   - admin user (username: admin, password: admin12345)
 *   - alice/bob demo users (password: password)
 *   - "demo blog" app registered to localhost:5500
 *   - DataSchema/SchemaVersion for dataType "post"
 *   - A few demo posts
 *   - Default quota
 */
import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";

const prisma = new PrismaClient();

const now = () => Math.floor(Date.now() / 1000);

async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, { type: argon2.argon2id });
}

async function main() {
  console.log("[seed] starting…");

  const t = now();

  const adminPw = await hashPassword("admin12345");
  const alicePw = await hashPassword("password");
  const bobPw = await hashPassword("password");

  const admin = await prisma.user.upsert({
    where: { username: "admin" },
    create: {
      username: "admin",
      email: "admin@uniid.local",
      passwordHash: adminPw,
      displayName: "Administrator",
      role: "admin",
      createdAt: t,
      updatedAt: t
    },
    update: { role: "admin" }
  });

  const alice = await prisma.user.upsert({
    where: { username: "alice" },
    create: {
      username: "alice",
      email: "alice@uniid.local",
      passwordHash: alicePw,
      displayName: "Alice",
      createdAt: t,
      updatedAt: t
    },
    update: {}
  });

  const bob = await prisma.user.upsert({
    where: { username: "bob" },
    create: {
      username: "bob",
      email: "bob@uniid.local",
      passwordHash: bobPw,
      displayName: "Bob",
      createdAt: t,
      updatedAt: t
    },
    update: {}
  });

  const app = await prisma.app.upsert({
    where: { primaryDomain: "localhost:5500" },
    create: {
      id: "app_demo_blog",
      name: "Demo Blog",
      description: "示例博客应用，演示 UniID 的认证、数据与文件能力。",
      primaryDomain: "localhost:5500",
      status: "active",
      ownerId: admin.id,
      createdAt: t,
      updatedAt: t
    },
    update: { status: "active" }
  });

  await prisma.appDomain.upsert({
    where: { host: "127.0.0.1:5500" },
    create: { appId: app.id, host: "127.0.0.1:5500", verified: 1, createdAt: t },
    update: { verified: 1 }
  });

  await prisma.quota.upsert({
    where: { appId: app.id },
    create: {
      appId: app.id,
      rpsLimit: 60,
      dailyApiCalls: 1_000_000,
      monthlyStorageBytes: BigInt(10) * BigInt(1024) * BigInt(1024) * BigInt(1024),
      monthlyEgressBytes: BigInt(50) * BigInt(1024) * BigInt(1024) * BigInt(1024),
      fnInvocationsDaily: 100_000,
      updatedAt: t
    },
    update: {}
  });

  // Schema for "post"
  const schema = await prisma.dataSchema.upsert({
    where: { appId_dataType: { appId: app.id, dataType: "post" } },
    create: {
      appId: app.id,
      dataType: "post",
      description: "博客文章 schema（含点赞、评论嵌套对象）",
      createdAt: t,
      updatedAt: t,
      createdById: admin.id
    },
    update: {}
  });

  const postJsonSchema = JSON.stringify({
    type: "object",
    required: ["title", "content"],
    additionalProperties: false,
    properties: {
      title: { type: "string", minLength: 1, maxLength: 200 },
      content: { type: "string", minLength: 1 },
      createdAt: { type: "integer", minimum: 0 },
      authorId: { type: "string", minLength: 1 },
      status: { type: "string", enum: ["draft", "published"], default: "draft" },
      tags: { type: "array", items: { type: "string" }, default: [] },
      likes: {
        type: "object",
        additionalProperties: {
          type: "object",
          required: ["time"],
          properties: { time: { type: "integer", minimum: 0 } }
        },
        default: {}
      },
      comments: {
        type: "array",
        items: {
          type: "object",
          required: ["userId", "text", "time"],
          properties: {
            userId: { type: "string" },
            text: { type: "string", maxLength: 2000 },
            time: { type: "integer", minimum: 0 }
          }
        },
        default: []
      }
    }
  });

  const autoFill = JSON.stringify({
    "data.createdAt": "$serverTime",
    "data.authorId": "$userId"
  });

  await prisma.schemaVersion.upsert({
    where: { schemaId_version: { schemaId: schema.id, version: 1 } },
    create: {
      schemaId: schema.id,
      version: 1,
      jsonSchema: postJsonSchema,
      autoFill,
      isActive: 1,
      createdAt: t,
      createdById: admin.id
    },
    update: { isActive: 1 }
  });

  // Default app policy: posts readable by public, writable by owner.
  await prisma.policyDocument.upsert({
    where: {
      appId_scope_target: { appId: app.id, scope: "dataType", target: "post" }
    },
    create: {
      appId: app.id,
      scope: "dataType",
      target: "post",
      document: JSON.stringify({
        default: {
          read: ["$public"],
          create: ["$owner"],
          update: ["$owner"],
          delete: ["$owner"]
        },
        fields: {
          "data.likes": {
            read: ["$public"],
            create: ["$dynamic:likes.$user"],
            update: ["$dynamic:likes.$user"],
            delete: ["$dynamic:likes.$user"]
          },
          "data.comments": {
            read: ["$public"],
            create: ["$dynamic:comments.$user.userId"],
            update: ["$dynamic:comments.$user.userId"],
            delete: ["$owner"]
          }
        }
      }),
      createdAt: t,
      updatedAt: t,
      createdById: admin.id
    },
    update: {}
  });

  // Sample posts
  const post1Data = {
    title: "Hello UniID!",
    content: "这是第一篇示例文章，由 alice 发布。",
    status: "published",
    tags: ["welcome", "demo"],
    likes: {},
    comments: [],
    createdAt: t,
    authorId: alice.id
  };

  await prisma.record.create({
    data: {
      appId: app.id,
      dataType: "post",
      ownerId: alice.id,
      data: JSON.stringify(post1Data),
      createdAt: t,
      updatedAt: t,
      createdById: alice.id,
      updatedById: alice.id
    }
  });

  console.log("[seed] done. accounts:");
  console.log("  admin / admin12345");
  console.log("  alice / password");
  console.log("  bob   / password");
  console.log(`  demo app: ${app.id} (${app.primaryDomain})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
