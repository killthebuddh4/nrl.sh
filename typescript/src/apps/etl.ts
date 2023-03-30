/* eslint-disable no-console */
import { z } from "zod";
import {
  getQuestionCompletionPrompt,
  GPT_QUESTION_COMPLETION,
} from "../apis/openai/openai.js";
import {
  readAllTopicCompletions,
  readMostRecentPipeline,
  readPipeline,
  readQuestionCompletions,
} from "../apis/supabase/semantic-search.js";
import { generateSourceDocs } from "../features/semantic-mapping/generate-source-docs.js";
import {
  runGenerateTopicCompletionTask,
  generateTopicCompletions,
  generateTopicTasks,
} from "../features/semantic-mapping/generate-topic-completions.js";
import {
  generateTopicQuestions,
  generateTopicQuestionTasks,
  runGenerateQuestionTask,
} from "../features/semantic-mapping/generate-questions.js";

/* ****************************************************************************
 * - create a pipeline (scrape a site)
 * - generate tasks to generate topic completions
 * - generate topic completions
 * - generate tasks to generate topic questions
 * - generate topic questions
 * ***************************************************************************/

const etl = async () => {
  // const { id: pipelineId } = await generateSourceDocs({
  //   fromUrl: "https://xmtp.org/docs",
  //   limit: Infinity,
  // });
  // const pipeline = await readPipeline({
  //   pipelineId: "dac835db-8a3c-45cf-85ba-da10e6975204",
  // });
  // await generateTopicTasks({ fromPipeline: pipeline });
  // await generateTopicCompletions({
  //   fromBatchId: "d681feba-c29b-4306-98e8-ef28312de59c",
  // });
  // const {
  //   data: readAllTopicCompletionsData,
  //   error: readAllTopicCompletionsError,
  // } = await readAllTopicCompletions();
  // if (readAllTopicCompletionsError !== null) {
  //   throw new Error("Failed to read topic completions");
  // }
  // await Promise.all(
  //   readAllTopicCompletionsData.map((tc) => {
  //     return generateTopicQuestionTasks({
  //       forTopicCompletionId: tc.id,
  //     });
  //   })
  // );
  // await Promise.all(
  //   readAllTopicCompletionsData.slice(0, 1).map(async (tc) => {
  //     return generateTopicQuestions({
  //       forTopicCompletionId: tc.id,
  //     });
  //   })
  // );
  // const { data: readQuestionCompletionsData } = await

  // readQuestionCompletions();

  /* **************************************************************************
   *
   * SINGLE TASK RUN
   *
   * **************************************************************************/

  // await runGenerateTopicCompletionTask({
  //   forTaskId: "9d237e30-b072-476f-b37e-41ba9525e138",
  // });

  const {
    data: readAllTopicCompletionsData,
    error: readAllTopicCompletionsError,
  } = await readAllTopicCompletions();
  if (readAllTopicCompletionsError !== null) {
    throw new Error("Failed to read topic completions");
  }
  await Promise.all(
    readAllTopicCompletionsData.map((tc) => {
      return generateTopicQuestionTasks({
        forTopicCompletionId: tc.id,
      });
    })
  );

  await runGenerateQuestionTask({
    forQuestionTaskId: "91e79c9a-1477-47a6-9bb1-3e23a4fc579d",
  });
};

etl();
