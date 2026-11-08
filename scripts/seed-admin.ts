import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.user.count();
  if (existing > 0) {
    console.log("Users already exist — skipping seed.");
    return;
  }

  const passwordHash = await hash("changeme123", 12);
  const user = await prisma.user.create({
    data: {
      name: "Admin",
      email: "admin@production-solutions.group",
      passwordHash,
      role: "admin",
    },
  });
  console.log(`Created admin user: ${user.email}`);
  console.log("Default password: changeme123 — change this after first login.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
