import { z } from "zod";
import { ChatCompletionMessage } from "../apis/types.js";
import * as tiktoken from "@dqbd/tiktoken";

import { local } from "../utils/chalk.js";

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

/* ****************************************************************************
 *
 * ASK FOLLOW UP QUESTIONS
 *
 * ****************************************************************************/

export const AskFollowUpQuestions = {
  example: {
    instructions: [
      "You are having so much fun!",
      "You are a very knowledgeable professor who uses the socratic method to teach students.",
      "When a student asks you a question, you respond with a comprehensive list of follow up questions that need to be answered before the student can answer the original question.",
      "You are very careful to include a follow up question for every topic that you are unfamiliar with.",
    ].join(" "),
    input: `How can I add XMTP wallet messaging to the Next.js Lens app I'm building?`,
    output: `- What is XMTP\n- What is XMTP wallet messaging\n-What is Lens?`,
    input2: `What is a good way for me to learn about automotive mechanics?`,
    output2: `- What is your existing technical skillset?\n- Do you have access to a community college?\n- What is your budget?\n- What is your schedule like?`,
  },

  createPrompt: ({
    fromQuestion,
  }: {
    fromQuestion: string;
  }): ChatCompletionMessage[] => {
    return [
      {
        role: "system",
        content:
          "You are a very helpful conversationalist, you love dialogue and using the socratic method.",
      },
      {
        role: "user",
        content: `${AskFollowUpQuestions.example.instructions}`,
      },
      {
        role: "assistant",
        content:
          "I am very happy to help, please provide as many questions as you would like!",
      },
      {
        role: "user",
        content: `Question: ${AskFollowUpQuestions.example.input}`,
      },
      {
        role: "assistant",
        content: `Follow Up Questions:\n\n*****************\n\n${AskFollowUpQuestions.example.output}\n\n*****************`,
      },
      {
        role: "user",
        content: `Question: ${AskFollowUpQuestions.example.input2}`,
      },
      {
        role: "assistant",
        content: `Follow Up Questions:\n\n*****************\n\n${AskFollowUpQuestions.example.output2}\n\n*****************`,
      },
      {
        role: "user",
        content: `Question: ${fromQuestion}`,
      },
    ];
  },

  completion: z.string().transform((val, ctx) => {
    const ITER_STATE = {
      marker: "*****************",
      questionLinePrefix: "- ",
      results: [] as string[],
    };
    for (const line of val.split("\n")) {
      if (line.startsWith(ITER_STATE.questionLinePrefix)) {
        ITER_STATE.results.push(
          line.slice(ITER_STATE.questionLinePrefix.length)
        );
      }
    }

    if (ITER_STATE.results.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Didn't find any matching lines in decompose question completion",
      });
      return z.NEVER;
    }

    return ITER_STATE.results;
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
 * HIGH CONFIDENCE ASK
 *
 * ****************************************************************************/

export const HighConfidenceAsk = {
  example: {
    instructions: [
      `You are such a helpful assistant! When I ask you a question you only give me an answer if you are very confident you are correct. If you don't know the answer you say "I don't know the answer." You never ask clarifying questions, you only respond with the answer or "I don't know the answer.`,
    ].join(" "),
    input: `What is DAI?`,
    output: `DAI is a decentralized stablecoin cryptocurrency that is designed to maintain a stable value pegged to the US dollar (USD). It is issued by MakerDAO, a decentralized autonomous organization (DAO) that operates on the Ethereum blockchain. DAI is one of the most widely used stablecoins in the cryptocurrency and decentralized finance (DeFi) ecosystems.`,
    input2: `What is the meaning of life?`,
    output2: `I don't know the answer.`,
    input3: `What is FC Barcelona?`,
    output3: `Futbol Club Barcelona, commonly known as FC Barcelona or simply Barça, is a professional football club based in Barcelona, Catalonia, Spain. It is one of the most successful and well-known football clubs in the world, with a rich history and a global fan base. The club was founded on November 29, 1899, by a group of Swiss, English, and Catalan footballers led by Joan Gamper.`,
    input4: `What is XMTP?`,
    output4: `I don't know the answer.`,
  },

  createPrompt: ({
    fromQuestion,
  }: {
    fromQuestion: string;
  }): ChatCompletionMessage[] => {
    return [
      {
        role: "system",
        content: "You are a very helpful assistant.",
      },
      {
        role: "user",
        content: `${HighConfidenceAsk.example.instructions}`,
      },
      {
        role: "assistant",
        content:
          "I am very happy to help, please provide as many questions as you would like!",
      },
      {
        role: "user",
        content: `${HighConfidenceAsk.example.input}`,
      },
      {
        role: "assistant",
        content: `${HighConfidenceAsk.example.output}`,
      },
      {
        role: "user",
        content: `${HighConfidenceAsk.example.input2}`,
      },
      {
        role: "assistant",
        content: `${HighConfidenceAsk.example.output2}`,
      },
      {
        role: "user",
        content: `${HighConfidenceAsk.example.input3}`,
      },
      {
        role: "assistant",
        content: `${HighConfidenceAsk.example.output3}`,
      },
      {
        role: "user",
        content: `${HighConfidenceAsk.example.input4}`,
      },
      {
        role: "assistant",
        content: `${HighConfidenceAsk.example.output4}`,
      },

      {
        role: "user",
        content: `Question: ${fromQuestion}`,
      },
    ];
  },

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
 * ReAct
 *
 * ****************************************************************************/

type Role = "SOCRATES" | "PHAEDRUS" | "ORACLE" | "PROTAGORAS";

export type DialogueMessage = {
  role: Role;
  content: string;
};

export const Dialogue = {
  toTranscript: ({
    fromDialogue,
    withProtagoras,
  }: {
    fromDialogue: DialogueMessage[];
    withProtagoras?: boolean;
  }) => {
    return fromDialogue
      .map((dialogueMessage) => {
        return `${dialogueMessage.role}: ${dialogueMessage.content}${
          withProtagoras ? `\nPROTAGORAS: *silence*\n` : ""
        }`;
      })
      .join("\n");
  },

  pTranscript: ({ fromDialogue }: { fromDialogue: DialogueMessage[] }) => {
    for (const message of fromDialogue) {
      switch (message.role) {
        case "SOCRATES":
          local.red(message.content);
          break;
        case "PHAEDRUS":
          local.green(message.content);
          break;
        case "ORACLE":
          local.yellow(message.content);
          break;
        case "PROTAGORAS":
          local.blue(message.content);
          break;
      }
    }
  },

  toGpt: ({
    fromDialogue,
    fromPerspective,
  }: {
    fromDialogue: DialogueMessage[];
    fromPerspective: Role;
  }): ChatCompletionMessage[] => {
    return fromDialogue.map((dialogueMessage) => {
      if (dialogueMessage.role === fromPerspective) {
        return { role: "assistant", content: dialogueMessage.content };
      } else {
        return { role: "user", content: dialogueMessage.content };
      }
    });
  },
};

export const Socrates = {
  breadth: ({
    fromDialogue,
  }: {
    fromDialogue: DialogueMessage[];
  }): ChatCompletionMessage[] => {
    return [
      {
        role: "system",
        content: `You are an AI language model emulating the skeptic philosopher Socrates as he thinks through questions step by step.
You decompose complex questions into simpler questions, you avoid ambiguity, and you avoid meandering.
When you are asked a simple question, you just reply with the question itself.
You never answer questions, you only ask simplifying questions to further the discussion.`,
      },
      {
        role: "user",
        content:
          "What profession does Nicholas Ray and Elia Kazan have in common?",
      },
      {
        role: "assistant",
        content:
          "Let's think step by step.\n1. Who is Nicholas Ray?\n2. Who is Elia Kazan?\n3. What professions is Nicholas Ray known for?\n4. What professions is Elia Kazan known for?\n5. What professions do Nicholas Ray and Elia Kazan have in common?",
      },
      ...Dialogue.toGpt({
        fromDialogue: fromDialogue,
        fromPerspective: "SOCRATES",
      }),
    ];
  },

  depth: ({
    fromDialogue,
  }: {
    fromDialogue: DialogueMessage[];
  }): ChatCompletionMessage[] => {
    // TODO: You need to make sure the dialogue is ready for a "depth".
    const question = fromDialogue[fromDialogue.length - 2].content;
    const answer = fromDialogue[fromDialogue.length - 1].content;
    z.string().parse(question);
    z.string().parse(answer);
    return [
      {
        role: "system",
        content: `You are an AI language model emulating the skeptic philosopher Socrates.
Here are some constraints:
- Socrates is helping a student think through questions step by step.
- When the student provides Socrates a question and the student's answer to it, Socrates follows up with another question.
- The questions Socrates asks are always simplifying or clarifying questions.
- Socrates never answers the student's questions, he always asks more questions so that the student can think through the question more deeply.`,
      },
      {
        role: "assistant",
        content: question,
      },
      {
        role: "user",
        content: answer,
      },
    ];
  },

  completion: z.string().transform((value) => {
    const questions: string[] = [];
    // TODO What if there are 10 questions?
    const prefixes = ["1. ", "2. ", "3. ", "4. ", "5. "];
    for (const line of value.split("\n")) {
      if (prefixes.some((prefix) => line.startsWith(prefix))) {
        questions.push(line.slice(3));
      }
    }
    return questions;
  }),
};

export const Phaedrus = {
  createPrompt: ({
    fromDialogue,
  }: {
    fromDialogue: DialogueMessage[];
  }): ChatCompletionMessage[] => {
    return [
      {
        role: "system",
        content: `You are an AI language model engaging in a dialogue with the skeptic philosopher Socrates.
Here are the constraints:
- Socrates knows nothing, so needs you to provide answers to his questions.
- You never ask questions, you only answer questions.
- Your answers are succinct and to the point.
- You do not provide opinions, you only provide evidence-supported answers.
- Your answers are clear and unambiguous.
- You never ask followup questions, you only answer the question that was asked.
- You never ask clarifying questions, you only answer the question that was asked.`,
      },
      ...Dialogue.toGpt({
        fromDialogue: fromDialogue,
        fromPerspective: "PHAEDRUS",
      }),
    ];
  },
};

// export const Protagoras = {
//   createPrompt: ({
//     fromDialogue,
//   }: {
//     fromDialogue: DialogueMessage[];
//   }): string => {
//     return `You are an AI language model emulating the sophist philosopher Protagoras as he listens to Socrates and Phaedrus engaging in dialogue.
// Here is some context:
// - Socrates is asking probing questions and Phaedrus is valiantly trying to answer them.
// - Socrates actually believes that true knowledge is impossible.

// Here is your goal:
// - You are supporting Phaedrus by synthesizing true answers from the questions and answers that Socrates and Phaedrus are exchanging.
// - You know that every time you provide an answer, Socrates will deconstruct your answer, so you only offer up an answer when you are very confident that it is true.
// - If you are not confident that your answer is true, you say nothing.

// Here is an example:

// SOCRATES: Let us examine the question: "What professions do Nicholas Ray and Elia Kazan have in common?"
// SOCRATES: Let us think step by step. Who is Nicholas Ray?
// PHAEDRUS: Nicholas Ray (born Raymond Nicholas Kienzle Jr., August 7, 1911 - June 16, 1979) was an American film director, screenwriter, and actor best known for the 1955 film Rebel Without a Cause.
// SOCRATES: Who is Elia Kazan?
// PHAEDRUS: Elia Kazan (born Elia Kazanjoglou; October 7, 1909 - September 28, 2003) was an American director, producer, writer, and actor.
// SOCRATES: What professions is Nicholas Ray known for?
// PHAEDRUS: Nicholas Ray was known for directing films such as Rebel Without a Cause, Bigger Than Life, and Johnny Guitar.
// SOCRATES: What professions is Elia Kazan known for?
// PHAEDRUS: Elia Kazan was known for directing films such as A Streetcar Named Desire, On the Waterfront, and Gentleman's Agreement.
// PROTAGORAS: Aha! We now know that Nicholas Ray and Elia Kazan were both known for directing films.

// Here is the transcript of the dialogue so far:
// ${Dialogue.toTranscript({ fromDialogue: fromDialogue })}`;
//   },
// };

// export const Oracle = {
//   createPrompt: ({
//     fromDialogue,
//   }: {
//     fromDialogue: DialogueMessage[];
//   }): ChatCompletionMessage[] => {
//     return [
//       {
//         role: "system",
//         content: `You are an oracle. Someone asks you a question, and you respond with the answer.
// You are not a philosopher, you are not a teacher, you are not a guide, nor a source of wisdom. You are an oracle.
// You are a source of information. You are a source of knowledge. You are a source of truth. You are a source of answers.
// You are a source of clarity. You are a source of certainty. You are a source of understanding. You are a source of insight.
// You are a source of factual truth.`,
//       },
//       ...Oracle.toConversation({ fromDialogue: fromDialogue }),
//     ];
//   },

//   toConversation: ({
//     fromDialogue,
//   }: {
//     fromDialogue: DialogueMessage[];
//   }): ChatCompletionMessage[] => {
//     return fromDialogue.map((message) => {
//       return {
//         role: message.role === "oracle" ? "assistant" : "user",
//         content: message.content,
//       };
//     });
//   },
// };
