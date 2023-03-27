import { v4 as uuidv4 } from "uuid";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { writeFile } from "fs/promises";

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

export const TEXT_FROM_HTML = z.object({
  id: z.string().uuid(),
  created_at: z.coerce.date(),
  pipeline_id: z.string().uuid(),
  text_from_html: z.string().or(z.null()),
  page_url: z.string(),
});

export type TextFromHtml = z.infer<typeof TEXT_FROM_HTML>;

export const PIPELINE = z.object({
  id: z.string().uuid(),
  created_at: z.coerce.date(),
  results: z.array(TEXT_FROM_HTML),
});

export type Pipeline = z.infer<typeof PIPELINE>;

export const ETL_EMBEDDING = z.object({
  uuid: z.string().uuid(),
  collection_id: z.string().uuid(),
  embedding: z.array(z.number()).length(1536),
  document: z.string(),
  cmetadata: z.object({
    source: z.string(),
  }),
  custom_id: z.string(),
});

export type EtlEmbedding = z.infer<typeof ETL_EMBEDDING>;

export const LANGCHAIN_PG_COLLECTION = z.object({
  uuid: z.string().uuid(),
  name: z.string(),
});

export type LangchainPgCollection = z.infer<typeof LANGCHAIN_PG_COLLECTION>;

export const writeCollection = async ({
  collection,
}: {
  collection: LangchainPgCollection;
}) => {
  return await supabase.from("langchain_pg_collection").insert([collection]);
};

export const writeEmbeddings = async ({
  embeddings,
}: {
  embeddings: EtlEmbedding[];
}) => {
  return await supabase.from("langchain_pg_embedding").insert(embeddings);
};

export const createPipeline = () => {
  return {
    id: uuidv4(),
    created_at: new Date(),
    results: [],
  };
};

export const addToPipeline = async ({
  pipeline,
  textFromHtml,
}: {
  pipeline: Pipeline;
  textFromHtml: TextFromHtml;
}) => {
  if (textFromHtml.pipeline_id !== pipeline.id) {
    throw new Error("textFromHtml.pipeline_id !== pipeline.id");
  } else {
    pipeline.results.push(textFromHtml);
  }
};

export const createTextFromHtml = ({
  textFromHtml,
  pipeline,
  pageUrl,
}: {
  textFromHtml: string | null;
  pageUrl: string;
  pipeline: Pipeline;
}): TextFromHtml => {
  return {
    id: uuidv4(),
    created_at: new Date(),
    pipeline_id: pipeline.id,
    text_from_html: textFromHtml,
    page_url: pageUrl,
  };
};

export const writePipeline = async ({ pipeline }: { pipeline: Pipeline }) => {
  return await supabase.from("text_from_html").insert(pipeline.results);
};

export const readPipeline = async ({
  id,
}: {
  id: string;
}): Promise<Pipeline> => {
  const { data, error } = await supabase
    .from("text_from_html")
    .select("*")
    .eq("pipeline_id", id);
  if (error !== null) {
    throw error;
  }
  if (data === null) {
    throw new Error("data === null");
  }
  if (data.length === 0) {
    throw new Error("data.length is 0");
  }

  const results = data.map((d) => {
    const validation = TEXT_FROM_HTML.safeParse(d);
    if (!validation.success) {
      throw new Error(validation.error.message);
    } else {
      return validation.data;
    }
  });

  return {
    id,
    // TODO - We don't actually save pipelines in db, so we don't have a created_at.
    created_at: new Date(),
    results,
  };
};

export const transferPipeline = async ({
  pipeline,
}: {
  pipeline: Pipeline;
}) => {
  const TRANSFER_DIR = "../data/scraped-websites/xmtp-etl";
  for (const tfh of pipeline.results) {
    await writeFile(
      TRANSFER_DIR +
        "/" +
        tfh.page_url.replaceAll("https://", "").replaceAll("/", "_") +
        ".txt",
      tfh.text_from_html ?? ""
    );
  }
};
