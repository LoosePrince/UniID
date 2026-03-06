import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function generateRandomPassword(length: number = 16): string {
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_=+";
  let password = "";
  for (let i = 0; i < length; i++) {
    const idx = Math.floor(Math.random() * chars.length);
    password += chars[idx];
  }
  return password;
}

async function main() {
  const now = Math.floor(Date.now() / 1000);

  const adminUsername = "admin";
  const adminPassword = generateRandomPassword();

  const passwordHash = await bcrypt.hash(adminPassword, 10);

  const admin = await prisma.user.upsert({
    where: { username: adminUsername },
    update: {},
    create: {
      username: adminUsername,
      passwordHash,
      email: "admin@example.com",
      role: "admin",
      createdAt: now,
      updatedAt: now,
      deleted: 0
    }
  });

  console.log("Seeded admin user:", {
    id: admin.id,
    username: admin.username,
    password: adminPassword
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

