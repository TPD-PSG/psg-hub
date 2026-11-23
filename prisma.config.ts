// Prisma 7 configuration: the CLI no longer reads .env or the schema's datasource url itself.
import "dotenv/config";
import { defineConfig } from "prisma/config";
// Same rule as the app: a relative "file:./dev.db" means prisma/dev.db, as it did in Prisma 5
// (without this the CLI would create and migrate a different, empty dev.db at the project root)
import { databaseUrl } from "./lib/prisma-client";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: databaseUrl() },
});
