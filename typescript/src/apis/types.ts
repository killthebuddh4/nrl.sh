import { z } from "zod";
import {
  QUESTION_COMPLETION,
  SOURCE_DOC,
  TOPIC_COMPLETION,
  KNOWLEDGE_EMBEDDING,
} from "./supabase/semantic-mapping.js";
import {
  CHAT_COMPLETION_MESSAGE,
  CHAT_COMPLETION_RESPONSE,
} from "./openai/api.js";

export type QuestionCompletion = z.infer<typeof QUESTION_COMPLETION>;
export type SourceDoc = z.infer<typeof SOURCE_DOC>;
export type TopicCompletion = z.infer<typeof TOPIC_COMPLETION>;
export type KnowledgeEmbedding = z.infer<typeof KNOWLEDGE_EMBEDDING>;
export type ChatCompletionMessage = z.infer<typeof CHAT_COMPLETION_MESSAGE>;
export type ChatCompletionResponse = z.infer<typeof CHAT_COMPLETION_RESPONSE>;
