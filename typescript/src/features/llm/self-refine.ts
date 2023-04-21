import { TextCompletion } from "../../apis/openai/api.js";
import init from "./init.json";
/* ****************************************************************************
 *
 * Prompt
 *
 * ****************************************************************************/

type PromptOptions = {
  questionPrefix: string;
  answerPrefix: string;
  intraExampleSeparator: string;
  interExampleSeparator: string;
  engine: "text-davinci-003";
  temperature: 0.7;
};

const createPrompt = ({
  prompt,
  opts,
  question,
}: {
  prompt: string;
  opts: PromptOptions;
  question: string;
}) => {
  return `${prompt}${opts.questionPrefix}${question}${opts.intraExampleSeparator}${opts.answerPrefix}`;
};

/* ****************************************************************************
 *
 * ResponseGen
 *
 * ****************************************************************************/

const responseGenTaskInit = () => {
  const QUESTION_PREFIX = "Conversation history: ";
  const ANSWER_PREFIX = "Response: ";
  const INTRA_EXAMPLE_SEPARATOR = "\n\n";
  const INTER_EXAMPLE_SEPARATOR = "\n\n###\n\n";
  const model = "text-davinci-003";
  const temperature = 0.7;
  const maxTokens = 800;
  const EXAMPLES = init;
  const stop = ["###"];
  // TODO, the traits seem to have some typos like "not interesting". Fix them
  // maybe,  but not yet beceause we want to keep the hermeticity of the code.
  const INSTRUCTION =
    "Provided a dialogue between two speakers, generate a response that is coherent with the dialogue history. Desired traits for responses are: 1) Relevant - The response addresses the context, 2) Informative - The response provides some information, 3) Interesting - The response is not interesting, 4) Consistent - The response is consistent with the rest of the conversation in terms of tone and topic, 5) Helpful - The response is helpful in providing any information or suggesting any actions, 6) Engaging - The response is not very engaging and does not encourage further conversation, 7) Specific - The response contains pecific content, 9) User understanding - The response demonstrates an understanding of the user's input and state of mind, and 10) Fluent. Response should begin with - Response:\n\n";

  const getExampleString = (example: { history: string; response: string }) => {
    return `${QUESTION_PREFIX}${example.history}${INTRA_EXAMPLE_SEPARATOR}${ANSWER_PREFIX}${example.response}`;
  };

  const promptPrefix = `${INSTRUCTION}${INTRA_EXAMPLE_SEPARATOR}${EXAMPLES.map(
    getExampleString
  ).join(INTER_EXAMPLE_SEPARATOR)}${INTER_EXAMPLE_SEPARATOR}`;

  return async ({ context }: { context: string }) => {
    const ctx = context.replaceAll("System: ", "").replaceAll("User: ", "");
    // TODO I think this should have a "ANSWER_PREFIX" at the end, but for
    // hermeticity don't chagne it yet..
    const prompt = `${promptPrefix}${QUESTION_PREFIX}${INTRA_EXAMPLE_SEPARATOR}${ctx}${INTRA_EXAMPLE_SEPARATOR}`;
    const response = await TextCompletion.read.one.forPrompt({
      prompt,
      maxTokens,
      model,
      temperature,
      stop,
    });
    return TextCompletion.util.getCompletedText({
      fromPrompt: prompt,
      withResponse: response,
    });
  };
};

export const iterativeResponse = ({
  context,
  opts: { maxAttempts },
}: {
  context: string;
  opts: { maxAttempts: number };
}) => {
  const taskInit = responseGenTaskInit();
};
