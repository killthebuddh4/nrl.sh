/* eslint-disable no-console */
import {
  GPT_TOPICS_COMPLETION,
  getTopicQuestionPrompt,
  readChatCompletion,
  getFirstChoiceContent,
  ChatCompletionResponse,
  getQuestionCompletionPrompt,
  readCompletion,
  getFirstTextCompletion,
} from "../../apis/openai/openai.js";
import {
  createQuestionCompletion,
  createQuestionTask,
  QuestionCompletion,
  readIdleQuestionTasks,
  readSourceDocForTopicCompletion,
  readTopicCompletion,
  writeQuestionTasks,
  writeQuestionCompletions,
  writeCompletedQuestionTasks,
  writeTopicCompletionParseError,
  createTopicCompletionParseError,
  readQuestionTask,
} from "../../apis/supabase/semantic-search.js";
import { logUsage } from "./log-usage.js";

export const generateTopicQuestionTasks = async ({
  forTopicCompletionId,
}: {
  forTopicCompletionId: string;
}) => {
  const { data: readTopicCompletionData, error: readTopicCompletionError } =
    await readTopicCompletion({ id: forTopicCompletionId });
  if (readTopicCompletionError !== null) {
    throw new Error("Failed to read topic completion");
  }

  const topicCompletionValidation = GPT_TOPICS_COMPLETION.safeParse(
    readTopicCompletionData.completion
  );
  if (!topicCompletionValidation.success) {
    writeTopicCompletionParseError({
      toWrite: createTopicCompletionParseError({
        topicCompletionId: forTopicCompletionId,
      }),
    });
  } else {
    const { error: writeQuestionTasksError } = await writeQuestionTasks({
      toWrite: topicCompletionValidation.data.map((topic) =>
        createQuestionTask({ topicCompletionId: forTopicCompletionId, topic })
      ),
    });
    if (writeQuestionTasksError !== null) {
      console.error(writeQuestionTasksError);
      throw writeQuestionTasksError;
    } else {
      console.log("Wrote question tasks for compleition", forTopicCompletionId);
    }
  }
};

type WithWriteableQuestionCompletion = {
  completion: ChatCompletionResponse;
  writeableCompletion: QuestionCompletion;
};

export const runGenerateQuestionTask = async ({
  forQuestionTaskId,
  completionType,
}: {
  completionType: "chat" | "text";
  forQuestionTaskId: string;
}) => {
  const { data: questionTask, error: readQuestionTaskError } =
    await readQuestionTask({ forId: forQuestionTaskId });

  if (readQuestionTaskError !== null) {
    console.error(readQuestionTaskError);
    throw readQuestionTaskError;
  }

  const { data: sourceDoc, error: readSourceDocError } =
    await readSourceDocForTopicCompletion({
      forTopicCompletionId: questionTask.topic_completion_id,
    });

  if (readSourceDocError !== null) {
    console.error(readSourceDocError);
    throw readSourceDocError;
  }

  console.log(
    "Starting topic question completion for sourceDoc: ",
    sourceDoc.page_url
  );

  if (completionType === "text") {
    const prompt = getQuestionCompletionPrompt({
      fromTextBlob: sourceDoc.text_from_html,
      topicToAskAbout: questionTask.topic,
    });
    const model = "text-davinci-003";

    const completion = await readCompletion({
      maxTokens: 250,
      prompt,
      model,
      logUsage,
    });
    return createQuestionCompletion({
      topicCompletionId: questionTask.topic_completion_id,
      model,
      prompt,
      completion: getFirstTextCompletion({
        fromTextCompletionResponse: completion,
      }),
    });
  } else {
    const prompt = getTopicQuestionPrompt({
      fromTextBlob: sourceDoc.text_from_html,
      topicToAskAbout: questionTask.topic,
    });
    const model = "gpt-3.5-turbo";
    const completion = await readChatCompletion({
      maxTokens: 250,
      prompt,
      model,
      logUsage,
    });

    return createQuestionCompletion({
      topicCompletionId: questionTask.topic_completion_id,
      model,
      prompt: JSON.stringify(prompt),
      completion: getFirstChoiceContent({
        fromChatCompletionResponse: completion.data,
      }),
    });
  }
};

export const generateTopicQuestions = async ({
  forTopicCompletionId,
}: {
  forTopicCompletionId: string;
}) => {
  const { data: questionTasks, error: readQuestionTasksError } =
    await readIdleQuestionTasks({
      forTopicCompletionId,
    });

  if (readQuestionTasksError !== null) {
    console.error(readQuestionTasksError);
    throw readQuestionTasksError;
  }

  const { data: sourceDoc, error: readSourceDocError } =
    await readSourceDocForTopicCompletion({ forTopicCompletionId });

  if (readSourceDocError !== null) {
    console.error(readSourceDocError);
    throw readSourceDocError;
  }

  console.log("Starting topic questions for sourceDoc: ", sourceDoc.page_url);

  const completions: WithWriteableQuestionCompletion[] = await Promise.all(
    questionTasks.map(async (qt) => {
      const prompt = getTopicQuestionPrompt({
        fromTextBlob: sourceDoc.text_from_html,
        topicToAskAbout: qt.topic,
      });
      const model = "gpt-3.5-turbo";
      const completion = await readChatCompletion({
        maxTokens: 250,
        prompt,
        model,
        logUsage,
      });

      const writeableCompletion = createQuestionCompletion({
        topicCompletionId: forTopicCompletionId,
        model,
        prompt: JSON.stringify(prompt),
        completion: getFirstChoiceContent({
          fromChatCompletionResponse: completion.data,
        }),
      });

      return { completion: completion.data, writeableCompletion };
    })
  );

  const { error: writeQuestionCompletionsError } =
    await writeQuestionCompletions({
      toWrite: completions.map((c) => c.writeableCompletion),
    });

  if (writeQuestionCompletionsError !== null) {
    console.error(writeQuestionCompletionsError);
    throw writeQuestionCompletionsError;
  } else {
    const { error: writeCompletedQuestionTasksError } =
      await writeCompletedQuestionTasks({ forTopicCompletionId });
    if (writeCompletedQuestionTasksError !== null) {
      console.error(writeCompletedQuestionTasksError);
      throw writeCompletedQuestionTasksError;
    }
  }
};
