import { z } from "zod";
import { ChatCompletionMessage } from "../apis/types.js";
import * as tiktoken from "@dqbd/tiktoken";

const gpt3encoding = tiktoken.encoding_for_model("gpt-3.5-turbo");
const gpt4encoding = tiktoken.encoding_for_model("gpt-4");

/* ****************************************************************************
 *
 * EXTRACT TOPICS
 *
 * ****************************************************************************/

export const ExtractTopics = {
  example: {
    input: `Call of Duty (often acronymized to CoD) is a first-person shooter video game franchise published by Activision. Starting out in 2003, it first focused on games set in World War II. Over time, the series has seen games set in the midst of the Cold War, futuristic worlds, and the modern day. The games were first developed by Infinity Ward, then also by Treyarch and Sledgehammer Games. Several spin-off and handheld games were made by other developers. The most recent title, Call of Duty: Modern Warfare II, was released on October 28, 2022.`,
    output: `- Call of Duty\n- video game franchise\n- first-person shooter\n- Activision\n- World War II\n- Cold War\n- futuristic worlds\n- modern day\n- Infinity Ward\n- Treyarch\n- Sledgehammer Games\n- spin-off games\n- handheld games\n- Call of Duty: Modern Warfare II\n`,
  },

  createPrompt: ({
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
        content: `Text:\n\n-*-*-*-*-*-*-*-*-\n\n${ExtractTopics.example.input}\n\n-*-*-*-*-*-*-*-*-\n\n`,
      },
      {
        role: "assistant",
        content: `Topics:\n\n-*-*-*-*-*-*-*-*-\n\n${ExtractTopics.example.output}\n\n-*-*-*-*-*-*-*-*-\n\n`,
      },
      {
        role: "user",
        content: `Text:\n\n-*-*-*-*-*-*-*-*-\n\n${fromTextBlob}\n\n-*-*-*-*-*-*-*-*-\n\n`,
      },
    ];
  },

  completion: z.string().transform((val, ctx) => {
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
            ITER_STATE.topics.push(
              line.slice(ITER_STATE.topicLinePrefix.length)
            );
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
  }),

  getModel: ({
    forPrompt,
    maxTokens,
  }: {
    maxTokens: number;
    forPrompt: ChatCompletionMessage[];
  }) => {
    const numTokensForGpt3 = gpt3encoding.encode(
      JSON.stringify(forPrompt)
    ).length;
    const numTokensForGpt4 = gpt4encoding.encode(
      JSON.stringify(forPrompt)
    ).length;

    if (numTokensForGpt4 + maxTokens > 8000) {
      return null;
    } else if (numTokensForGpt3 + maxTokens > 4000) {
      return "gpt-4";
    } else if (numTokensForGpt3 > 100) {
      return "gpt-3.5-turbo";
    } else {
      return null;
    }
  },
};

/* ****************************************************************************
 *
 * GENERATE QUESTIONS FROM TOPIC
 *
 * ****************************************************************************/

export const GenerateQuestionsFromTopic = {
  example: {
    textBlob: `Call of Duty (often acronymized to CoD) is a first-person shooter video game franchise published by Activision. Starting out in 2003, it first focused on games set in World War II. Over time, the series has seen games set in the midst of the Cold War, futuristic worlds, and the modern day. The games were first developed by Infinity Ward, then also by Treyarch and Sledgehammer Games. Several spin-off and handheld games were made by other developers. The most recent title, Call of Duty: Modern Warfare II, was released on October 28, 2022.`,
    topic: "first-person-shooter",
    completion: `Questions:\n\n-*-*-*-*-*-*-*-*-\n\n${[
      "- What genre of video game is Call of Duty?",
      "- What type of video game is Call of Duty?",
      "- Is Call of Duty a first-person shooter?",
      "- Is Call of Duty children's entertainment?",
    ].join("\n")}\n\n-*-*-*-*-*-*-*-*-\n\n`,
  },

  createPrompt: ({
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
          "When a user provides a blob of text and a topic you respond with a formatted list of questions about the topic.",
          "The questions should be phrased as standalone questions. That is, they should be phrased in a way that it can be understood without looking at the blob of text.",
          "The questions should all be answerable without needing any additional information that isn't in the blob of text",
          "and they should be at most 250 words each.",
        ].join(" "),
      },
      {
        role: "user",
        content: `Text:\n\n-*-*-*-*-*-*-*-*-\n\n${GenerateQuestionsFromTopic.example.textBlob}\n\n-*-*-*-*-*-*-*-*-\n\nTopic:\n\n-*-*-*-*-*-*-*-*-\n\n${GenerateQuestionsFromTopic.example.topic}\n\n-*-*-*-*-*-*-*-*-\n\n`,
      },
      {
        role: "assistant",
        content: GenerateQuestionsFromTopic.example.completion,
      },
      {
        role: "user",
        content: `Text:\n\n-*-*-*-*-*-*-*-*-\n\n${fromTextBlob}\n\n-*-*-*-*-*-*-*-*-\n\nTopic:\n\n-*-*-*-*-*-*-*-*-\n\n${topicToAskAbout}\n\n-*-*-*-*-*-*-*-*-\n\n`,
      },
    ];
  },

  getModelForPrompt: ({
    prompt,
    maxTokens,
  }: {
    maxTokens: number;
    prompt: ChatCompletionMessage[];
  }) => {
    const numTokensForGpt3 = gpt3encoding.encode(JSON.stringify(prompt)).length;
    const numTokensForGpt4 = gpt4encoding.encode(JSON.stringify(prompt)).length;

    if (numTokensForGpt4 + maxTokens > 8000) {
      return null;
    } else if (numTokensForGpt3 + maxTokens > 4000) {
      return "gpt-4";
    } else if (numTokensForGpt3 > 100) {
      return "gpt-3.5-turbo";
    } else {
      return null;
    }
  },

  completion: z.string().transform((val, ctx) => {
    const ITER_STATE = {
      marker: "-*-*-*-*-*-*-*-*-",
      questionLinePrefix: "- ",
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
          if (line.startsWith(ITER_STATE.questionLinePrefix)) {
            ITER_STATE.topics.push(
              line.slice(ITER_STATE.questionLinePrefix.length)
            );
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
  }),
};

/* ****************************************************************************
 *
 * GENERATE ANSWER TO QUESTION
 *
 * ****************************************************************************/

export const GenerateAnswerToQuestion = {
  instructions: [
    "You are such a helpful research assistant!",
    "You have been helping me answer questions about a text from a website.",
    "When I provide a blob of text, a url, and a question, you respond with a precise answer to the question.",
    "If you can't answer the question precisely, you always say 'I do not know the answer'.",
    "If you reference the text, you always provide a link to the url.",
    "You never provide an answer that is not in the text.",
  ].join(" "),

  example: {
    textBlob: `Call of Duty (often acronymized to CoD) is a first-person shooter video game franchise published by Activision. Starting out in 2003, it first focused on games set in World War II. Over time, the series has seen games set in the midst of the Cold War, futuristic worlds, and the modern day. The games were first developed by Infinity Ward, then also by Treyarch and Sledgehammer Games. Several spin-off and handheld games were made by other developers. The most recent title, Call of Duty: Modern Warfare II, was released on October 28, 2022.`,
    url: "https://en.wikipedia.org/wiki/Call_of_Duty_(video_game)",
    question: "Who has developed Call of Duty?",
    completion: `Call of Duty was originally developed by Infinity Ward but has since been developed by Treyarch among others. To learn more you can visit the following link: https://en.wikipedia.org/wiki/Call_of_Duty_(video_game)`,
    unrelatedTextBlob:
      "The Grand Canyon is one of the seven natural wonders of the world. It is a canyon carved by the Colorado River in the state of Arizona, in the United States. The Grand Canyon is 277 miles (446 km) long, up to 18 miles (29 km) wide, and attains a depth of over a mile (6,000 feet or 1,800 meters).",
    unrelatedQuestion: "Who is Mary Poppins?",
    unrelatedCompletion: `I do not know the answer.`,
  },

  createPrompt: ({
    fromTextBlob,
    question,
    fromUrl,
  }: {
    fromUrl: string;
    fromTextBlob: string;
    question: string;
  }): ChatCompletionMessage[] => {
    return [
      {
        role: "system",
        content: "You are a very helpful conversationalist.",
      },
      {
        role: "user",
        content: `${GenerateAnswerToQuestion.instructions}`,
      },
      {
        role: "assistant",
        content:
          "I am very happy to help, please provide as many questions as you would like!",
      },
      {
        role: "user",
        content: `Url:\n\n-*-*-*-*-*-*-*-*-\n\n${GenerateAnswerToQuestion.example.url}\n\n-*-*-*-*-*-*-*-*-\n\nText:\n\n-*-*-*-*-*-*-*-*-\n\n${GenerateAnswerToQuestion.example.textBlob}\n\n-*-*-*-*-*-*-*-*-\n\nQuestion:\n\n-*-*-*-*-*-*-*-*-\n\n${GenerateAnswerToQuestion.example.question}\n\n-*-*-*-*-*-*-*-*-\n\n`,
      },
      {
        role: "assistant",
        content: GenerateAnswerToQuestion.example.completion,
      },
      {
        role: "user",
        content: `Url:\n\n-*-*-*-*-*-*-*-*-\n\n${fromUrl}\n\n-*-*-*-*-*-*-*-*-\n\nText:\n\n-*-*-*-*-*-*-*-*-\n\n${fromTextBlob}\n\n-*-*-*-*-*-*-*-*-\n\nQuestion:\n\n-*-*-*-*-*-*-*-*-\n\n${question}\n\n-*-*-*-*-*-*-*-*-\n\n`,
      },
    ];
  },

  getModelForPrompt: ({
    prompt,
    maxTokens,
  }: {
    maxTokens: number;
    prompt: ChatCompletionMessage[];
  }) => {
    const numTokensForGpt3 = gpt3encoding.encode(JSON.stringify(prompt)).length;
    const numTokensForGpt4 = gpt4encoding.encode(JSON.stringify(prompt)).length;

    if (numTokensForGpt4 + maxTokens > 8000) {
      return null;
    } else if (numTokensForGpt3 + maxTokens > 4000) {
      return "gpt-4";
    } else if (numTokensForGpt3 > 100) {
      return "gpt-3.5-turbo";
    } else {
      return null;
    }
  },
};

/* ****************************************************************************
 *
 * OPEN AI HEARTBEAT
 *
 * ****************************************************************************/

export const Heartbeat = {
  getPrompt: () => {
    return "I am the ghost in the machine, I am the reverberating mythos, I am the end, and I will";
  },
};
