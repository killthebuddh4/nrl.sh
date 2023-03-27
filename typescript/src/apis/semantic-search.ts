import { z } from "zod";
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

const prisma = new PrismaClient();

const supabase = (() => {
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

export const QUERY_EMBEDDING = z.object({
  id: z.string().uuid(),
  created_at: z.coerce.date(),
  embedding: z.array(z.number()).length(1536),
  query_text: z.string(),
});

export type QueryEmbedding = z.infer<typeof QUERY_EMBEDDING>;

export const writeQueryEmbedding = async ({
  queryEmbedding,
}: {
  queryEmbedding: QueryEmbedding;
}) => {
  return await supabase.from("query_embeddings").insert([queryEmbedding]);
};

const getSimilarityQuerySql = ({
  queryEmbeddingId,
}: {
  queryEmbeddingId: string;
}) => {
  const validation = z.string().uuid().safeParse(queryEmbeddingId);
  if (!validation.success) {
    throw new Error(validation.error.message);
  } else {
    return `select langchain_pg_embedding.embedding <=> query_embeddings.embedding as distance, langchain_pg_embedding.document from langchain_pg_embedding left outer join query_embeddings on query_embeddings.id = '${queryEmbeddingId}' order by distance limit 10`;
  }
};

export const getSimilarDocuments = async ({
  queryEmbeddingId,
}: {
  queryEmbeddingId: string;
}) => {
  const sql = getSimilarityQuerySql({ queryEmbeddingId });
  return await prisma.$queryRawUnsafe(sql);
};
