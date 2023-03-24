import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { Configuration, OpenAIApi } from "openai";
import { encode } from "gpt-3-encoder";

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

export const EMBEDDED = z.object({
  text: z.string(),
  embedding: z.array(z.number()),
  encoded: z.array(z.number()),
});

export type Embedded = z.infer<typeof EMBEDDED>;

export const EMBEDDABLE = z.object({
  text: z.string().min(20),
  encoded: z.array(z.number()).min(10),
});

export type Embeddable = z.infer<typeof EMBEDDABLE>;

export const getEmbeddings = async ({
  toEmbed,
}: {
  toEmbed: Embeddable[];
}): Promise<Embedded[]> => {
  if (toEmbed.length > 500) {
    throw new Error("You can only embed 500 at a time");
  }

  // /* eslint-disable no-console */
  // console.log("Getting embeddings for ", toEmbed.length, " texts");
  // return [];

  // console.log(
  //   toEmbed.slice(0, 24).reduce((acc, e) => acc + e.encoded.length, 0)
  // );
  /* eslint-disable no-console */
  // console.log(toEmbed.slice(23, 26));

  // return [];
  const results = await openai.createEmbedding({
    model: "text-embedding-ada-002",
    input: toEmbed.map((e) => e.encoded),
  });

  return results.data.data.map((embedding) => {
    return {
      text: toEmbed[embedding.index].text,
      encoded: toEmbed[embedding.index].encoded,
      embedding: embedding.embedding,
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

export const postRobotQuestion = async ({
  request,
}: {
  request: RobotRequest;
}) => {
  const questionForm = new URLSearchParams();
  questionForm.append("question", request.payload.question);
  const robotAnswerResponse = await (async () => {
    try {
      return await fetch("https://robopy.fly.dev/ask", {
        method: "POST",
        body: questionForm,
      });
    } catch (e) {
      // TODO ERROR HANDLING
      return null;
    }
  })();

  const answer = await (async () => {
    if (robotAnswerResponse === null) {
      return { ok: false, answer: "The OpenAI server seems to be down." };
    } else if (!robotAnswerResponse.ok) {
      return { ok: false, answer: "The OpenAI server seems to be down." };
    } else {
      const answerJson = await robotAnswerResponse.json();
      const validateAnswer = ROBOT_ANSWER.safeParse(answerJson);
      if (!validateAnswer.success) {
        return {
          ok: false,
          answer: "The Robot returned an unsupported answer.",
        };
      } else {
        return { ok: true, answer: validateAnswer.data.answer };
      }
    }
  })();

  return answer;
};

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
