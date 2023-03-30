import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { clients } from "./clients.js";

const OPEN_AI_USAGE_LOG = z.object({
  id: z.string().uuid(),
  created_at: z.coerce.date(),
  prompt_tokens: z.number(),
  completion_tokens: z.number(),
  model: z.string(),
});

export type OpenAiUsageLog = z.infer<typeof OPEN_AI_USAGE_LOG>;

export const createOpenAiUsageLog = ({
  promptTokens,
  completionTokens,
  model,
}: {
  promptTokens: number;
  completionTokens: number;
  model: string;
}): OpenAiUsageLog => {
  return {
    id: uuidv4(),
    created_at: new Date(),
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    model,
  };
};

export const writeOpenAiUsageLogs = async ({
  logs,
}: {
  logs: OpenAiUsageLog[];
}) => {
  return await clients.etl.from("openai_usage_logs").insert(logs);
};
