import { z } from "zod";
import { Configuration, OpenAIApi } from "openai";

const OPEN_AI_API_KEY = (() => {
  if (process.env.OPEN_AI_API_KEY === undefined) {
    throw new Error("OPEN_AI_API_KEY is not defined");
  } else {
    return process.env.OPEN_AI_API_KEY;
  }
})();

const configuration = new Configuration({
  apiKey: OPEN_AI_API_KEY,
});

export const openai = new OpenAIApi(configuration);

const EMBEDDABLE = z.object({
  id: z.string().uuid(),
  text: z.string().min(20),
});

export type Embeddable = z.infer<typeof EMBEDDABLE>;

const EMBEDDED = z.object({
  embedding: z.array(z.number()).length(1536),
  fromEmbeddable: EMBEDDABLE,
});

export type Embedded = z.infer<typeof EMBEDDED>;

export const getEmbeddings = async ({
  fromEmbeddableTexts,
}: {
  fromEmbeddableTexts: Embeddable[];
}): Promise<Embedded[]> => {
  if (fromEmbeddableTexts.length > 500) {
    throw new Error("You can only embed 500 at a time");
  }

  const results = await openai.createEmbedding({
    model: "text-embedding-ada-002",
    // TODO Be more intelligent about this.
    input: fromEmbeddableTexts.map((et) => et.text),
  });

  return results.data.data.map((embedding) => {
    return {
      embedding: embedding.embedding,
      fromEmbeddable: fromEmbeddableTexts[embedding.index],
    };
  });
};
