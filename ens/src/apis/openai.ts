import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

/* ****************************************************************************
 *
 * CONFIG
 *
 * ************************************************************************** */

export const ENS_ROBOT_ID = "ens-response";

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
