import type { Config } from "drizzle-kit";

export default {
  schema: "./src/db/schema.ts",
  out: "./supabase/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ||
      process.env.SUPABASE_URL?.replace("https://", "postgresql://") ||
      "",
  },
  verbose: true,
  strict: true,
} satisfies Config;
