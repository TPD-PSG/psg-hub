// @ts-ignore
import { definePrismaConfig } from "prisma/config";

export default definePrismaConfig({
  orm: {
    schema: "prisma/schema.prisma",
  },
  skills: {
    agents: ["claude", "cursor", "agents", "devin"],
  },
});
