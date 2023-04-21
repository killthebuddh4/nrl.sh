import { z } from "zod";
import {
  Configuration,
  CreateCompletionResponse,
  CreateEmbeddingResponse,
  OpenAIApi,
} from "openai";
import { encoding_for_model } from "@dqbd/tiktoken";

const gpt4encoding = encoding_for_model("gpt-4");
const gpt3encoding = encoding_for_model("gpt-3.5-turbo");

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

const USAGE = z.object({
  prompt_tokens: z.number(),
  completion_tokens: z.number(),
});

// TODO: Refine this type.
const EMBEDDING_REQUEST = z.object({
  model: z.string(),
  textsToEmbed: z.array(z.string()),
  options: z
    .object({
      timeout: z.number(),
    })
    .optional(),
});

type EmbeddingResponse = { data: CreateEmbeddingResponse };

export class Embeddings {
  public static read = {
    some: {
      forTexts: async ({
        textsToEmbed,
        model,
        options,
      }: z.infer<typeof EMBEDDING_REQUEST>): Promise<EmbeddingResponse> => {
        try {
          // TODO create a zod object for this
          return await openai.createEmbedding(
            {
              model,
              input: textsToEmbed,
            },
            {
              timeout: options?.timeout,
            }
          );
        } catch (err) {
          throw err;
        }
      },
    },
  };

  public static util = {
    getEmbeddings: ({ fromResponse }: { fromResponse: EmbeddingResponse }) => {
      return fromResponse.data.data.map((datum) => datum.embedding);
    },
  };
}

// TODO: Refine this type.
const TEXT_COMPLETION_REQUEST = z.object({
  prompt: z.string(),
  maxTokens: z.number(),
  model: z.string(),
  temperature: z.number().min(0).max(1).optional(),
  stop: z.array(z.string()).max(4).optional(),
});

// TODO: Refine this type.
const TEXT_COMPLETION_RESPONSE = z.object({
  data: z.object({
    choices: z.array(z.object({ text: z.string() })),
  }),
});

export class TextCompletion {
  public static read = {
    one: {
      forPrompt: async ({
        prompt,
        maxTokens,
        model,
        temperature,
        stop,
      }: z.infer<typeof TEXT_COMPLETION_REQUEST>) => {
        try {
          const response = await openai.createCompletion({
            prompt,
            max_tokens: maxTokens,
            model,
            temperature,
            stop,
          });
          return TEXT_COMPLETION_RESPONSE.parse(response);
        } catch (err) {
          throw err;
        }
      },
    },
  };

  public static util = {
    getCompletedText: ({
      fromPrompt,
      withResponse,
    }: {
      fromPrompt: string;
      withResponse: z.infer<typeof TEXT_COMPLETION_RESPONSE>;
    }) => {
      return fromPrompt + " " + withResponse.data.choices[0].text;
    },
  };
}

export const CHAT_COMPLETION_MESSAGE = z.object({
  role: z.union([
    z.literal("user"),
    z.literal("assistant"),
    z.literal("system"),
  ]),
  content: z.string(),
});

export const CHAT_COMPLETION_REQUEST = z.object({
  prompt: z.array(CHAT_COMPLETION_MESSAGE),
  maxTokens: z.number(),
  model: z.enum(["gpt-3.5-turbo", "gpt-4"]),
  stop: z.array(z.string()).max(4).optional(),
  n: z.number().optional(),
  temperature: z.number().min(0).max(2).optional(),
  options: z
    .object({
      timeout: z.number().optional(),
    })
    .optional(),
});

export const CHAT_COMPLETION_RESPONSE = z.object({
  data: z.object({
    choices: z.array(
      z.object({
        message: z.object({
          content: z.string(),
        }),
      })
    ),
    usage: USAGE,
  }),
});

export class ChatCompletion {
  public static read = {
    one: {
      forPrompt: async ({
        prompt,
        maxTokens,
        model,
        stop,
        n,
        temperature,
        options,
      }: z.infer<typeof CHAT_COMPLETION_REQUEST>) => {
        try {
          const response = await openai.createChatCompletion(
            {
              messages: prompt,
              max_tokens: maxTokens,
              model,
              stop,
              n,
              temperature,
            },
            options
          );
          return CHAT_COMPLETION_RESPONSE.parse(response);
        } catch (err) {
          throw err;
        }
      },
    },
  };

  public static util = {
    approxTokens: ({
      forRequest,
    }: {
      forRequest: z.infer<typeof CHAT_COMPLETION_REQUEST>;
    }) => {
      const promptTokens = forRequest.prompt
        .map((p) => {
          if (forRequest.model === "gpt-4") {
            return gpt4encoding.encode(p.content).length;
          } else {
            return gpt3encoding.encode(p.content).length;
          }
        })
        .reduce((acc, val) => acc + val, 0);

      return promptTokens + forRequest.maxTokens;
    },

    getFirstChoiceContent: ({
      from,
    }: {
      from: z.infer<typeof CHAT_COMPLETION_RESPONSE>;
    }) => {
      try {
        return z.string().parse(from.data.choices[0].message.content);
      } catch (err) {
        throw err;
      }
    },

    getAllChoicesContent: ({
      from,
    }: {
      from: z.infer<typeof CHAT_COMPLETION_RESPONSE>;
    }) => {
      try {
        return from.data.choices.map((choice) =>
          z.string().parse(choice.message.content)
        );
      } catch (err) {
        throw err;
      }
    },

    getTimeSlotUsed: ({
      byResponse,
    }: {
      byResponse: z.infer<typeof CHAT_COMPLETION_RESPONSE>;
    }) => {
      try {
        const usage = USAGE.parse(byResponse.data.usage);
        const tokens = usage.prompt_tokens + usage.completion_tokens;
        const TOKENS_PER_SECOND = 90000 / 60;
        return tokens / TOKENS_PER_SECOND;
      } catch (err) {
        throw err;
      }
    },
  };
}
