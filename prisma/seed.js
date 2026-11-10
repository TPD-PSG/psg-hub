const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  await prisma.user.upsert({
    where: { email: "toby@production-solutions.group" },
    update: {
      passwordHash: "$2b$12$FY94BdHZr6SJrC9xuMV7c.6xz8cl6L.MsDazlTrhy7hWlQQ1PdvS6",
    },
    create: {
      name: "Toby Darvill",
      email: "toby@production-solutions.group",
      passwordHash: "$2b$12$FY94BdHZr6SJrC9xuMV7c.6xz8cl6L.MsDazlTrhy7hWlQQ1PdvS6",
      role: "admin",
    },
  });
  console.log("Admin user ready");
}

main().finally(() => prisma.$disconnect());
