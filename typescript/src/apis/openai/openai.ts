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

export const EMBEDDABLE = z.object({
  id: z.string().uuid(),
  text: z.string().min(20),
});

export type Embeddable = z.infer<typeof EMBEDDABLE>;

export const EMBEDDED = z.object({
  embedding: z.array(z.number()).length(1536),
  fromEmbeddable: EMBEDDABLE,
});

export type Embedded = z.infer<typeof EMBEDDED>;

export const CHAT_COMPLETION_MESSAGE = z.object({
  role: z.union([
    z.literal("user"),
    z.literal("assistant"),
    z.literal("system"),
  ]),
  content: z.string(),
});

export type ChatCompletionMessage = z.infer<typeof CHAT_COMPLETION_MESSAGE>;

export const GPT_TOPIC_SUMMARY_COMPLETION = z.string().transform((val, ctx) => {
  const ITER_STATE = {
    marker: "-*-*-*-*-*-*-*-*-",
    firstMarkerFound: false as boolean,
    secondMarkerFound: false as boolean,
    errors: [] as string[],
    summaryLines: [] as string[],
  };

  for (const line of val.split("\n")) {
    if (line === ITER_STATE.marker) {
      if (ITER_STATE.firstMarkerFound) {
        ITER_STATE.secondMarkerFound = true;
      } else {
        ITER_STATE.firstMarkerFound = true;
      }
    } else {
      if (ITER_STATE.firstMarkerFound && !ITER_STATE.secondMarkerFound) {
        ITER_STATE.summaryLines.push(line);
      }
    }
  }

  if (!ITER_STATE.firstMarkerFound) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Missing markers in summary",
    });
    return z.NEVER;
  } else {
    return ITER_STATE.summaryLines.join(" ");
  }
});

export const GPT_TOPICS_COMPLETION = z.string().transform((val, ctx) => {
  const ITER_STATE = {
    marker: "-*-*-*-*-*-*-*-*-",
    topicLinePrefix: "- ",
    firstMarkerFound: false as boolean,
    secondMarkerFound: false as boolean,
    errors: [] as string[],
    blanks: [] as string[],
    topics: [] as string[],
  };
  for (const line of val.split("\n")) {
    if (line === ITER_STATE.marker) {
      if (ITER_STATE.firstMarkerFound) {
        ITER_STATE.secondMarkerFound = true;
      } else {
        ITER_STATE.firstMarkerFound = true;
      }
    } else {
      if (ITER_STATE.firstMarkerFound && !ITER_STATE.secondMarkerFound) {
        if (line.startsWith(ITER_STATE.topicLinePrefix)) {
          ITER_STATE.topics.push(line.slice(ITER_STATE.topicLinePrefix.length));
        } else if (line.trim().length === 0) {
          ITER_STATE.blanks.push(line);
        } else {
          ITER_STATE.errors.push(line);
        }
      }
    }
  }
  if (ITER_STATE.errors.length > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Unexpected lines in completion",
    });
    return z.NEVER;
  } else {
    return ITER_STATE.topics;
  }
});

const USAGE = z.object({
  prompt_tokens: z.number(),
  completion_tokens: z.number(),
  model: z.string(),
});

type Usage = z.infer<typeof USAGE>;

export const CHAT_COMPLETION_RESPONSE = z.object({
  data: z.object({
    choices: z.array(
      z.object({
        message: z.object({
          content: z.string(),
        }),
      })
    ),
    usage: USAGE.omit({ model: true }),
  }),
});

export type ChatCompletionResponse = z.infer<typeof CHAT_COMPLETION_RESPONSE>;

export const TEXT_COMPLETION_RESPONSE = z.object({
  data: z.object({
    choices: z.array(
      z.object({
        text: z.string(),
      })
    ),
    usage: USAGE.omit({ model: true }),
  }),
});

export type TextCompletionResponse = z.infer<typeof TEXT_COMPLETION_RESPONSE>;

export const GPT_QUESTION_COMPLETION = z.string().transform((val, ctx) => {
  const PARSER_PARAMS = {
    questionLinePrefix: "Question: ",
    answerLinePrefix: "Answer: ",
  };
  const lines = val.split("\n");

  const questionLine = lines.find((line) =>
    line.startsWith(PARSER_PARAMS.questionLinePrefix)
  );
  if (questionLine === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Could not find question line",
    });
    return z.NEVER;
  }

  const answerLine = lines.find((line) =>
    line.startsWith(PARSER_PARAMS.answerLinePrefix)
  );
  if (answerLine === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Could not find answer line",
    });
    return z.NEVER;
  }

  return {
    question: questionLine.slice(PARSER_PARAMS.questionLinePrefix.length),
    answer: answerLine.slice(PARSER_PARAMS.answerLinePrefix.length),
  };
});

export type GptQuestionCompletion = z.infer<typeof GPT_QUESTION_COMPLETION>;

export const getFirstChoiceContent = ({
  fromChatCompletionResponse,
}: {
  fromChatCompletionResponse: ChatCompletionResponse;
}): string => {
  const choice = fromChatCompletionResponse.data.choices[0].message.content;
  if (typeof choice !== "string") {
    throw new Error("Choice is not a string");
  } else {
    return choice;
  }
};

export const getFirstTextCompletion = ({
  fromTextCompletionResponse,
}: {
  fromTextCompletionResponse: TextCompletionResponse;
}): string => {
  const choice = fromTextCompletionResponse.data.choices[0].text;
  if (typeof choice !== "string") {
    throw new Error("Choice is not a string");
  } else {
    return choice;
  }
};

export const readEmbeddings = async ({
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
    const fromEmbeddable = fromEmbeddableTexts[embedding.index];
    if (fromEmbeddable === undefined) {
      throw new Error(
        JSON.stringify({ reason: "fromEmbeddable is undefined", embedding })
      );
    }
    return {
      embedding: embedding.embedding,
      fromEmbeddable: fromEmbeddableTexts[embedding.index],
    };
  });
};

export const readCompletion = async ({
  maxTokens,
  prompt,
  model,
  logUsage,
}: {
  maxTokens: number;
  prompt: string;
  model: string;
  logUsage: (usage: Usage) => Promise<void>;
}) => {
  const response = await openai.createCompletion({
    model,
    max_tokens: maxTokens,
    prompt,
  });

  const responseValidation = TEXT_COMPLETION_RESPONSE.safeParse(response);
  if (!responseValidation.success) {
    /* eslint-disable no-console */
    console.error(responseValidation.error);
    throw new Error(
      "You got a TextCompletionResponse from OpenAI that didn't match the schema"
    );
  } else {
    logUsage({ ...responseValidation.data.data.usage, model });
    return responseValidation.data;
  }
};

export const readChatCompletion = async ({
  maxTokens,
  prompt,
  model,
  logUsage,
}: {
  maxTokens: number;
  prompt: ChatCompletionMessage[];
  model: string;
  logUsage: (usage: Usage) => Promise<void>;
}) => {
  /* eslint-disable-next-line no-console */
  console.log(`You are calling the OpenAI API (model ${model})`);
  const response = await openai.createChatCompletion({
    model,
    max_tokens: maxTokens,
    messages: prompt,
  });
  const responseValidation = CHAT_COMPLETION_RESPONSE.safeParse(response);
  if (!responseValidation.success) {
    /* eslint-disable no-console */
    console.error(responseValidation.error);
    throw new Error(
      "You got a response from OpenAI that didn't match the schema"
    );
  } else {
    logUsage({ ...responseValidation.data.data.usage, model });
  }
  return {
    ...response,
    data: responseValidation.data,
  };
};

const CHAT_COMPLETION_EXAMPLES = [
  {
    input: `Call of Duty (often acronymized to CoD) is a first-person shooter video game franchise published by Activision. Starting out in 2003, it first focused on games set in World War II. Over time, the series has seen games set in the midst of the Cold War, futuristic worlds, and the modern day. The games were first developed by Infinity Ward, then also by Treyarch and Sledgehammer Games. Several spin-off and handheld games were made by other developers. The most recent title, Call of Duty: Modern Warfare II, was released on October 28, 2022.`,
    output: `- Call of Duty\n- video game franchise\n- first-person shooter\n- Activision\n- World War II\n- Cold War\n- futuristic worlds\n- modern day\n- Infinity Ward\n- Treyarch\n- Sledgehammer Games\n- spin-off games\n- handheld games\n- Call of Duty: Modern Warfare II\n`,
  },
  {
    textBlob: `Call of Duty (often acronymized to CoD) is a first-person shooter video game franchise published by Activision. Starting out in 2003, it first focused on games set in World War II. Over time, the series has seen games set in the midst of the Cold War, futuristic worlds, and the modern day. The games were first developed by Infinity Ward, then also by Treyarch and Sledgehammer Games. Several spin-off and handheld games were made by other developers. The most recent title, Call of Duty: Modern Warfare II, was released on October 28, 2022.`,
    topic: "first-person shooter",
    output:
      "Call of Duty is a first-person shooter video game focusing on various different semi-fictional, fictional, and non-fictional historical conflicts.",
  },
  {
    textBlob: `Call of Duty (often acronymized to CoD) is a first-person shooter video game franchise published by Activision. Starting out in 2003, it first focused on games set in World War II. Over time, the series has seen games set in the midst of the Cold War, futuristic worlds, and the modern day. The games were first developed by Infinity Ward, then also by Treyarch and Sledgehammer Games. Several spin-off and handheld games were made by other developers. The most recent title, Call of Duty: Modern Warfare II, was released on October 28, 2022.`,
    topic: "first-person-shooter",
    output: [
      "Question: What genre of video game is Call of Duty?",
      "Answer: Call of Duty is a first-person shooter video game franchise published by Activision.",
    ].join("\n"),
  },
];

export const getGetTopicsPrompt = ({
  fromTextBlob,
}: {
  fromTextBlob: string;
}): ChatCompletionMessage[] => {
  return [
    {
      role: "system",
      content: `You are a very helpful research assistant. You have been helping a professor extract topics from texts. When a user provides a text, you respond with a formatted list of topics in the text.`,
    },
    {
      role: "user",
      content: `Text:\n\n-*-*-*-*-*-*-*-*-\n\n${CHAT_COMPLETION_EXAMPLES[0].input}\n\n-*-*-*-*-*-*-*-*-\n\n`,
    },
    {
      role: "assistant",
      content: `Topics:\n\n-*-*-*-*-*-*-*-*-\n\n${CHAT_COMPLETION_EXAMPLES[0].output}\n\n-*-*-*-*-*-*-*-*-\n\n`,
    },
    {
      role: "user",
      content: `Text:\n\n-*-*-*-*-*-*-*-*-\n\n${fromTextBlob}\n\n-*-*-*-*-*-*-*-*-\n\n`,
    },
  ];
};

export const getTopicSummaryPrompt = ({
  fromTextBlob,
  topicToSummarize,
}: {
  fromTextBlob: string;
  topicToSummarize: string;
}): ChatCompletionMessage[] => {
  return [
    {
      role: "system",
      content: `You are a very helpful research assistant. You have been helping a professor write topic-specific summaries from given blobs of text. When a user provides a blob of text and a topic you respond with a concise (100 words or less) summary of the topic in the text. You only include information that is directly available in the text.`,
    },
    {
      role: "user",
      content: `Text:\n\n-*-*-*-*-*-*-*-*-\n\n${CHAT_COMPLETION_EXAMPLES[1].textBlob}\n\n-*-*-*-*-*-*-*-*-\n\nTopic:\n\n-*-*-*-*-*-*-*-*-\n\n${CHAT_COMPLETION_EXAMPLES[1].topic}\n\n-*-*-*-*-*-*-*-*-\n\n`,
    },
    {
      role: "assistant",
      content: `Summary:\n\n-*-*-*-*-*-*-*-*-\n\n${CHAT_COMPLETION_EXAMPLES[1].output}\n\n-*-*-*-*-*-*-*-*-\n\n`,
    },
    {
      role: "user",
      content: `Text:\n\n-*-*-*-*-*-*-*-*-\n\n${fromTextBlob}\n\n-*-*-*-*-*-*-*-*-\n\nTopic:\n\n-*-*-*-*-*-*-*-*-\n\n${topicToSummarize}\n\n-*-*-*-*-*-*-*-*-\n\n`,
    },
  ];
};

export const getTopicQuestionPrompt = ({
  fromTextBlob,
  topicToAskAbout,
}: {
  fromTextBlob: string;
  topicToAskAbout: string;
}): ChatCompletionMessage[] => {
  return [
    {
      role: "system",
      content: [
        "You are a very helpful research assistant.",
        "You have been helping a professor generate questions for a pop quiz.",
        "When a user provides a blob of text and a topic you respond with a question that asks about that topic in the blob of text.",
        "The question should be phrased in a way that it can be understood without looking at the blob of text,",
        "the question should be answerable without needing any additional information that isn't in the blob of text,",
        "and the question should be at most 250 words.",
      ].join(" "),
    },
    {
      role: "user",
      content: `Text:\n\n-*-*-*-*-*-*-*-*-\n\n${CHAT_COMPLETION_EXAMPLES[2].textBlob}\n\n-*-*-*-*-*-*-*-*-\n\nTopic:\n\n-*-*-*-*-*-*-*-*-\n\n${CHAT_COMPLETION_EXAMPLES[2].topic}\n\n-*-*-*-*-*-*-*-*-\n\n`,
    },
    {
      role: "assistant",
      content: `${CHAT_COMPLETION_EXAMPLES[2].output}`,
    },
    {
      role: "user",
      content: `Text:\n\n-*-*-*-*-*-*-*-*-\n\n${fromTextBlob}\n\n-*-*-*-*-*-*-*-*-\n\nTopic:\n\n-*-*-*-*-*-*-*-*-\n\n${topicToAskAbout}\n\n-*-*-*-*-*-*-*-*-\n\n`,
    },
  ];
};

// {
//   textBlob: `Call of Duty (often acronymized to CoD) is a first-person shooter video game franchise published by Activision. Starting out in 2003, it first focused on games set in World War II. Over time, the series has seen games set in the midst of the Cold War, futuristic worlds, and the modern day. The games were first developed by Infinity Ward, then also by Treyarch and Sledgehammer Games. Several spin-off and handheld games were made by other developers. The most recent title, Call of Duty: Modern Warfare II, was released on October 28, 2022.`,
//   topic: "first-person-shooter",
//   output: [
//     "Question: What genre of video game is Call of Duty?",
//     "Answer: Call of Duty is a first-person shooter video game franchise published by Activision.",
//   ].join("\n"),
// },
export const getQuestionCompletionPrompt = ({
  fromTextBlob,
  topicToAskAbout,
}: {
  fromTextBlob: string;
  topicToAskAbout: string;
}): string => {
  const prefix = [
    `BLOB OF TEXT:\n\n${CHAT_COMPLETION_EXAMPLES[2].textBlob}\n\n-*-*-*-*-*-*-*-*-\n`,
    `TOPIC:\n\n${CHAT_COMPLETION_EXAMPLES[2].topic}\n\n-*-*-*-*-*-*-*-*-\n`,
    `QUESTION AND ANSWER:\n\n${CHAT_COMPLETION_EXAMPLES[2].output}\n\n-*-*-*-*-*-*-*-*-\n\n`,
  ].join("\n");
  const blob = `BLOB OF TEXT:\n\n${fromTextBlob}\n\n-*-*-*-*-*-*-*-*-\n\n`;
  const topic = `TOPIC:\n\n${topicToAskAbout}\n\n-*-*-*-*-*-*-*-*-\n\n`;
  const question = `QUESTION AND ANSWER:\n\n`;
  return prefix + blob + topic + question;
};
