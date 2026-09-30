import { defineConfig } from "prisma/config";

/**
 * Prisma CLI configuration (migrate, generate, seed). Prisma 7 does not read `.env` files by itself;
 * DATABASE_URL comes from the shell or falls back to the same default as `src/server/env.ts`.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx --conditions=react-server prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL?.trim() || "file:./data/linde-sphere.db",
  },
});
