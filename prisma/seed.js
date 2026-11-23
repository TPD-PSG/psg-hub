const { createPrismaClient } = require("../lib/prisma-client");

const prisma = createPrismaClient();

async function main() {
  await prisma.user.upsert({
    where: { email: "toby@production-solutions.group" },
    update: {},
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
