import { z } from "zod";
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import { getEmbeddings, Embeddable } from "./openai.js";
import { v4 as uuidv4 } from "uuid";

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

export const KNOWLEDGE_EMBEDDING = z.object({
  uuid: z.string().uuid(),
  created_at: z.coerce.date(),
  embedding: z.array(z.number()).length(1536),
  document: z.string(),
  source: z.string(),
});

export type KnowledgeEmbedding = z.infer<typeof KNOWLEDGE_EMBEDDING>;

export const writeKnowledgeEmbeddings = async ({
  toWrite,
}: {
  toWrite: KnowledgeEmbedding[];
}) => {
  return await supabase.from("knowledge_embeddings").insert(toWrite);
};

export const writeQueryEmbedding = async ({
  queryEmbedding,
}: {
  queryEmbedding: QueryEmbedding;
}) => {
  return await supabase.from("query_embeddings").insert([queryEmbedding]);
};

export const getSimilarDocuments = async ({
  queryEmbeddingId,
}: {
  queryEmbeddingId: string;
}) => {
  const sql = (() => {
    const validation = z.string().uuid().safeParse(queryEmbeddingId);
    if (!validation.success) {
      throw new Error(validation.error.message);
    } else {
      return `select langchain_pg_embedding.embedding <=> query_embeddings.embedding as distance, langchain_pg_embedding.document from langchain_pg_embedding left outer join query_embeddings on query_embeddings.id = '${queryEmbeddingId}' order by distance limit 10`;
    }
  })();
  return await prisma.$queryRawUnsafe(sql);
};

const DOC = z.object({
  document: z.string(),
  source: z.string(),
});

export type Doc = z.infer<typeof DOC>;

export const createSearchableEmbeddings = async ({
  fromDocs,
}: {
  fromDocs: Doc[];
}) => {
  const docsWithIds: Record<string, Doc> = fromDocs.reduce((acc, doc) => {
    return {
      ...acc,
      [uuidv4()]: doc,
    };
  }, {});

  const embeddable: Embeddable[] = Object.values(docsWithIds).map((doc) => ({
    text: doc.document,
    id: uuidv4(),
  }));

  const embeddings = [];
  for (let i = 0; i < fromDocs.length; i += 250) {
    const embeddingsChunk = await getEmbeddings({
      fromEmbeddableTexts: embeddable.slice(i, i + 250),
    });
    embeddings.push(...embeddingsChunk);
  }
  const knowledgeEmbeddings: KnowledgeEmbedding[] = embeddings.map(
    (embedding) => {
      const doc = docsWithIds[embedding.fromEmbeddable.id];
      return {
        uuid: uuidv4(),
        created_at: new Date(),
        embedding: embedding.embedding,
        document: doc.document,
        source: doc.source,
      };
    }
  );

  const { error } = await writeKnowledgeEmbeddings({
    toWrite: knowledgeEmbeddings,
  });
  if (error) {
    // TODO - handle this error, probably by logging it
  }
};
