import { readEmbeddings } from "../apis/openai/openai.js";
import {
  createQueryEmbedding,
  QueryEmbedding,
  readSimilarityResults,
  writeQueryEmbedding,
  readPipeline,
  SourceDoc,
} from "../apis/supabase/semantic-search.js";
import { v4 as uuidv4 } from "uuid";
import { encoding_for_model } from "@dqbd/tiktoken";

const encoding = encoding_for_model("gpt-3.5-turbo");

export type SourceDocWithLength = { sourceDoc: SourceDoc; length: number };

export const getSourceDocLengths = async ({
  pipelineId,
}: {
  pipelineId: string;
}): Promise<SourceDocWithLength[]> => {
  const pipeline = await readPipeline({ pipelineId });
  return pipeline.source_docs.map((sd) => {
    return {
      sourceDoc: sd,
      length:
        sd.text_from_html === null
          ? 0
          : encoding.encode(sd.text_from_html).length,
    };
  });
};

export const semanticSearch = async ({
  query,
  limit = 10,
}: {
  query: string;
  limit?: number;
}) => {
  const embeddings = await readEmbeddings({
    fromEmbeddableTexts: [{ text: query, id: uuidv4() }],
  });
  const writeableQueryEmbeddings: QueryEmbedding[] = embeddings.map(
    (embedding) => {
      return createQueryEmbedding({
        queryText: query,
        embedding: embedding.embedding,
      });
    }
  );
  if (writeableQueryEmbeddings.length !== 1) {
    /* eslint-disable no-console */
    console.log(writeableQueryEmbeddings);
    throw new Error("Expected queryEmbeddings to have length 1");
  }
  await writeQueryEmbedding({ queryEmbedding: writeableQueryEmbeddings[0] });

  const similar = readSimilarityResults({
    queryEmbeddingId: writeableQueryEmbeddings[0].id,
    limit,
  });
  /* eslint-disable no-console */
  console.log(similar);
};
