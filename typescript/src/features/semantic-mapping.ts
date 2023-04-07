import { z } from "zod";
import { Embeddings, ChatCompletion } from "../apis/openai/api.js";
import {
  QueryEmbedding,
  KnowledgeEmbedding,
  SourceDoc,
} from "../apis/supabase/semantic-mapping.js";
import { GenerateAnswerToQuestion } from "./prompts-and-completions.js";

export const askQuestion = async ({ question }: { question: string }) => {
  try {
    /*
     * First we get the embedding for the question.
     */

    const embeddingResponse = await Embeddings.read.some.forTexts({
      textsToEmbed: [question],
      model: "text-embedding-ada-002",
      options: {
        timeout: 5000,
      },
    });

    /*
     * Then we write the embedding to the database because it's easier to include a
     * query embedding id in the similarity search than it is to include the
     * embedding itself.
     */

    const qe = QueryEmbedding.create.one.data({
      text: question,
      embedding: Embeddings.util.getEmbeddings({
        fromResponse: embeddingResponse,
      })[0],
    });

    await QueryEmbedding.write.some.data({ data: [qe] });

    /*
     * Then we do the similarity search, this returns similar embeddings.
     */

    const knowledge = await KnowledgeEmbedding.search.byQueryEmbeddingId({
      queryEmbeddingId: qe.id,
    });

    z.number().min(1).parse(knowledge.length);

    const mostRelated = knowledge[0];

    /*
     * Then we get the source doc that corresponds to the most related
     * knowledge, generate a prompt, and then pick the model to use for the prompt.
     */

    const sourceDoc = await SourceDoc.read.one.byQuestionCompletionId({
      id: mostRelated.question_completion_id,
    });

    const prompt = GenerateAnswerToQuestion.createPrompt({
      fromUrl: sourceDoc.page_url,
      question: question,
      fromTextBlob: sourceDoc.text_from_html,
    });

    const model = GenerateAnswerToQuestion.getModelForPrompt({
      prompt,
      maxTokens: 500,
    });

    /*
     * For safety, we only support gpt-3.5-turbo for now.
     */

    z.literal("gpt-3.5-turbo").parse(model);

    /*
     * Then we ask the question completion API for an answer.
     */
    const questionCompletion = await ChatCompletion.read.one.forPrompt({
      prompt,
      model: "gpt-3.5-turbo",
      maxTokens: 500,
    });

    return ChatCompletion.util.getFirstChoiceContent({
      from: questionCompletion,
    });
  } catch (error) {
    throw error;
  }
};
