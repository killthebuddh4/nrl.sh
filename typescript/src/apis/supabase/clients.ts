import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

const prisma = new PrismaClient();

const etl = (() => {
  const SU = process.env.SUPABASE_URL_ETL;
  if (SU === undefined) {
    throw new Error("SUPABASE_URL_ETL is not defined");
  }
  const SK = process.env.SUPABASE_KEY_ETL;
  if (SK === undefined) {
    throw new Error("SUPABASE_KEY_ETL is not defined");
  }
  return createClient(SU, SK);
})();

const app = (() => {
  const SU = process.env.SUPABASE_URL;
  if (SU === undefined) {
    throw new Error("SUPABASE_URL is not defined");
  }
  const SK = process.env.SUPABASE_KEY;
  if (SK === undefined) {
    throw new Error("SUPABASE_KEY is not defined");
  }
  return createClient(SU, SK);
})();

export const clients = { prisma, etl, app };
