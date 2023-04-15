import { z } from "zod";
import {
  QueryEmbedding,
  KnowledgeEmbedding,
} from "../apis/supabase/semantic-mapping.js";
import {
  AskFollowUpQuestions,
  HighConfidenceAsk,
} from "./prompts-and-completions.js";
import { ChatCompletion, Embeddings } from "../apis/openai/api.js";
import { local } from "../utils/chalk.js";

const MAX_DISTANCE_THRESHOLD = 0.01;

export const lookupAnswer = async ({ question }: { question: string }) => {
  const embeddingResponse = await Embeddings.read.some.forTexts({
    textsToEmbed: [question],
    model: "text-embedding-ada-002",
    options: {
      timeout: 5000,
    },
  });

  const qe = QueryEmbedding.create.one.data({
    text: question,
    embedding: Embeddings.util.getEmbeddings({
      fromResponse: embeddingResponse,
    })[0],
  });

  await QueryEmbedding.write.some.data({ data: [qe] });

  const knowledge = await KnowledgeEmbedding.search.byQueryEmbeddingId({
    queryEmbeddingId: qe.id,
  });

  try {
    z.number().min(1).parse(knowledge.length);
    z.number().max(MAX_DISTANCE_THRESHOLD).parse(knowledge[0].distance);
    return knowledge[0].answer_text;
  } catch (error) {
    return null;
  }
};

export const decomposeQuestion = async ({ question }: { question: string }) => {
  const prompt = AskFollowUpQuestions.createPrompt({
    fromQuestion: question,
  });
  local.yellow(JSON.stringify(prompt, null, 2));

  const response = await ChatCompletion.read.one.forPrompt({
    prompt,
    model: "gpt-3.5-turbo",
    // model: "gpt-4",
    maxTokens: 1000,
  });

  local.blue("response: " + JSON.stringify(response.data.choices[0], null, 2));

  const questions = AskFollowUpQuestions.completion.parse(
    ChatCompletion.util.getFirstChoiceContent({
      from: response,
    })
  );

  return questions;
};

export const answerOrNull = async ({ question }: { question: string }) => {
  const prompt = HighConfidenceAsk.createPrompt({
    fromQuestion: question,
  });

  const response = await ChatCompletion.read.one.forPrompt({
    prompt,
    // model: "gpt-3.5-turbo",
    model: "gpt-4",
    maxTokens: 250,
  });

  return ChatCompletion.util.getFirstChoiceContent({
    from: response,
  });
};

/* answer question is a recursive function.
 * The base case is that the question has a clear and available answer. The
 * answer comes from the database using a vector similarity search. "Clear and
 * available is defined in terms of a max distance threshold. If the most similar
 * vector is within the threshold, then we have a clear and available answer.
 * The recursive case is that the question does not have a clear and available
 * answer. In this case, we break the question down into smaller questions and
 * then recursively call answerQuestion on each of the smaller questions.
 * Once all the recursive calls have returned, we combine the answers into a
 * single answer and return the result. */
