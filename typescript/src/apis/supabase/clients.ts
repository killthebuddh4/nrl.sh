import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const prisma = new PrismaClient();

const etl = (() => {
  const SU = z.string().parse(process.env.SUPABASE_URL_ETL);
  const SK = z.string().parse(process.env.SUPABASE_KEY_ETL);
  return createClient(SU, SK);
})();

const app = (() => {
  const SU = z.string().parse(process.env.SUPABASE_URL);
  const SK = z.string().parse(process.env.SUPABASE_KEY);
  return createClient(SU, SK);
})();

export const clients = { prisma, etl, app };
