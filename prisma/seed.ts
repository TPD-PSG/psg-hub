import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.user.findUnique({ where: { email: "toby@production-solutions.group" } });
  if (!existing) {
    await prisma.user.create({
      data: {
        name: "Toby Darvill",
        email: "toby@production-solutions.group",
        passwordHash: "$2b$12$2wTG7yW/0YVy1w2kxxGtPui2DoDVWBYoV435kdxsEZjS1vwtPkTqO",
        role: "admin",
      },
    });
    console.log("Seeded admin user");
  } else {
    console.log("Admin user already exists");
  }
}

main().finally(() => prisma.$disconnect());
