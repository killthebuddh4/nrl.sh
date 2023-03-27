/* eslint-disable no-console */
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { Configuration, OpenAIApi } from "openai";
import { encode } from "gpt-3-encoder";
import { Redis } from "./redis.js";

/* ****************************************************************************
 *
 * CONFIG
 *
 * ************************************************************************** */

export const ENS_ROBOT_ID = "ens-response";

export const OPEN_AI_API_KEY = (() => {
  if (process.env.OPEN_AI_API_KEY === undefined) {
    throw new Error("OPEN_AI_API_KEY is not defined");
  } else {
    return process.env.OPEN_AI_API_KEY;
  }
})();

const configuration = new Configuration({
  apiKey: OPEN_AI_API_KEY,
});
// const configuration = new Configuration({ apiKey: "" });
const openai = new OpenAIApi(configuration);

/* ****************************************************************************
 *
 * TYPES
 *
 * ************************************************************************** */

export const ROBOT_REQUEST = z.object({
  id: z.string(),
  created_at: z.coerce.date(),
  type: z.literal("robot_request"),
  payload: z.object({
    question: z.string(),
  }),
});

export type RobotRequest = z.infer<typeof ROBOT_REQUEST>;

export const createRobotRequest = ({
  question,
}: {
  question: string;
}): RobotRequest => {
  return {
    id: uuidv4(),
    created_at: new Date(),
    type: "robot_request",
    payload: {
      question,
    },
  };
};

export const ROBOT_ANSWER = z.object({
  answer: z.string(),
});

export type RobotAnswer = z.infer<typeof ROBOT_ANSWER>;

/* ****************************************************************************
 *
 * API
 *
 * ************************************************************************** */

export const EMBEDDABLE = z.object({
  source: z.string(),
  text: z.string().min(20),
  encoded: z.array(z.number()).min(10),
});

export type Embeddable = z.infer<typeof EMBEDDABLE>;

export const EMBEDDED = z.object({
  embedding: z.array(z.number()),
  source: EMBEDDABLE,
});

export type Embedded = z.infer<typeof EMBEDDED>;

export const getEmbeddings = async ({
  toEmbed,
}: {
  toEmbed: Embeddable[];
}): Promise<Embedded[]> => {
  if (toEmbed.length > 500) {
    throw new Error("You can only embed 500 at a time");
  }

  const results = await openai.createEmbedding({
    model: "text-embedding-ada-002",
    /* TODO - If this works fine, then we need to rethink the encoding process. */
    input: toEmbed.map((e) => e.text),
  });

  return results.data.data.map((embedding) => {
    return {
      embedding: embedding.embedding,
      source: toEmbed[embedding.index],
    };
  });
};

// export const askQuestion = async ({ question }: { question: string }) => {
//   const qEmbeddings = await getEmbeddings({ forTexts: [question] });
//   const qEmbedding = qEmbeddings[0].embedding;
//   const cEmbeddings = d.sort((a, b) => {
//     const aDistance = cosineDistance(a.embedding, qEmbedding);
//     const bDistance = cosineDistance(b.embedding, qEmbedding);
//     return bDistance - aDistance;
//   });
//   const contexts = cEmbeddings.map((c) => c.text).slice(0, 10);

//   const prompt = `
//   Answer the question based on the context below, and if the question can't be answered based on the context, say "I don't know"

//   Context:

//   XMTP is a kind of dog.

//   ---

//   Question:

//   ${question}

//   ---

//   Answer:
//   `;

//   /* eslint-disable no-console */
//   console.log("Contexts: ", contexts);

//   return await openai.createChatCompletion({
//     model: "gpt-3.5-turbo",
//     max_tokens: 500,
//     messages: [
//       {
//         role: "system",
//         content:
//           "You are a helpful research assistant. You are helping a researcher answer questions about the XMTP protocol.",
//       },
//       {
//         role: "user",
//         content: `Here is a bunch of information about XMTP. The info was scraped from a website and so is a bit rough.: ${contexts}`,
//       },
//       { role: "user", content: question },
//     ],
//   });
// };

const createQuestionPrompt = ({
  context,
  question,
}: {
  context: string;
  question: string;
}) => {
  return `
  Use the following pieces of context to answer the question at the end. If you don't know the answer, just say that you don't know, don't try to make up an answer.

  Context:
    ${context}

  Question:
    ${question}

  Answer:
  `;
};

export const postRobotQuestion = async ({
  request,
}: {
  request: RobotRequest;
}) => {
  const question = request.payload.question;
  const embeddings = await getEmbeddings({
    toEmbed: [
      {
        source: "TODO",
        text: question.replaceAll("\n", " "),
        encoded: encode(question),
      },
    ],
  });
  console.log("embeddings", embeddings[0].embedding);
  const res = await Redis.executeKnnSearch(
    Redis.getRedisClient(),
    embeddings[0].embedding
  );
  console.log("KNN RES", JSON.stringify(res, null, 2));

  console.log("embeddings", embeddings);
  return { ok: true, answer: "STUB ANSWER" };
};

// export const postRobotQuestion = async ({
//   request,
// }: {
//   request: RobotRequest;
// }) => {
//   const questionForm = new URLSearchParams();
//   questionForm.append("question", request.payload.question);
//   const robotAnswerResponse = await (async () => {
//     try {
//       return await fetch("https://robopy.fly.dev/ask", {
//         method: "POST",
//         body: questionForm,
//       });
//     } catch (e) {
//       // TODO ERROR HANDLING
//       return null;
//     }
//   })();

//   const answer = await (async () => {
//     if (robotAnswerResponse === null) {
//       return { ok: false, answer: "The OpenAI server seems to be down." };
//     } else if (!robotAnswerResponse.ok) {
//       return { ok: false, answer: "The OpenAI server seems to be down." };
//     } else {
//       const answerJson = await robotAnswerResponse.json();
//       const validateAnswer = ROBOT_ANSWER.safeParse(answerJson);
//       if (!validateAnswer.success) {
//         return {
//           ok: false,
//           answer: "The Robot returned an unsupported answer.",
//         };
//       } else {
//         return { ok: true, answer: validateAnswer.data.answer };
//       }
//     }
//   })();

//   return answer;
// };

export const HEARTBEAT_PROMPT =
  "I am the ghost in the machine, I am the reverberating mythos, I am the end, and I will";

export const getHeartbeat = async ({
  opts,
}: {
  opts?: { timeout: number };
}) => {
  return openai.createCompletion(
    {
      model: "text-davinci-003",
      prompt: HEARTBEAT_PROMPT,
      max_tokens: 100,
    },
    opts
  );
};
