/* eslint-disable no-console */
import { v4 as uuidv4 } from "uuid";
import * as tiktoken from "@dqbd/tiktoken";
import {
  readChatCompletion,
  getGetTopicsPrompt,
  getFirstChoiceContent,
} from "../../apis/openai/openai.js";
import {
  createTopicCompletion,
  writeTopicCompletions,
  Pipeline,
  NonNullSourceDoc,
  createTopicTask,
  writeTopicTasks,
  readTopicTask,
  TopicTask,
  readIdleTasks,
  writeCompletedTasks,
  readSourceDoc,
  writeCompletedTask,
} from "../../apis/supabase/semantic-search.js";
import { logUsage } from "./log-usage.js";

const encoding = tiktoken.encoding_for_model("gpt-3.5-turbo");

type SourceDocWithLength = {
  sourceDoc: NonNullSourceDoc;
  length: number;
};

export const generateTopicTasks = async ({
  fromPipeline,
}: {
  fromPipeline: Pipeline;
}) => {
  const BATCH_SIZE = 10;
  const tasks: TopicTask[] = [];
  let numTasksInBatch = 0;
  let batchId = uuidv4();
  fromPipeline.source_docs.forEach((sourceDoc) => {
    if (numTasksInBatch === BATCH_SIZE) {
      batchId = uuidv4();
      numTasksInBatch = 0;
    }
    tasks.push(
      createTopicTask({
        sourceDocId: sourceDoc.id,
        batchId,
      })
    );
    numTasksInBatch += 1;
  });

  const { error: writeTopicTasksError } = await writeTopicTasks({
    toWrite: tasks,
  });
  if (writeTopicTasksError !== null) {
    console.error(writeTopicTasksError);
    throw writeTopicTasksError;
  } else {
    console.log("Wrote topic tasks from pipeline", fromPipeline.id);
  }
};

export const runGenerateTopicCompletionTask = async ({
  forTaskId,
}: {
  forTaskId: string;
}) => {
  const { data: readTopicTaskData, error: readTopicTaskError } =
    await readTopicTask({ id: forTaskId });

  if (readTopicTaskError !== null) {
    console.error(readTopicTaskError);
    throw readTopicTaskError;
  }

  const { data: sourceDoc, error: readSourceDocError } = await readSourceDoc({
    sourceDocId: readTopicTaskData.source_doc_id,
  });

  if (readSourceDocError !== null) {
    console.error(readSourceDocError);
    throw readSourceDocError;
  }

  const numTokens = encoding.encode(sourceDoc.text_from_html).length;
  if (numTokens > 1900) {
    throw new Error("Source doc too long");
  }

  const completionResponse = await readChatCompletion({
    maxTokens: 250,
    prompt: getGetTopicsPrompt({
      fromTextBlob: sourceDoc.text_from_html,
    }),
    model: "gpt-3.5-turbo",
    logUsage,
  });

  const completionToWrite = createTopicCompletion({
    sourceDocId: sourceDoc.id,
    completion: getFirstChoiceContent({
      fromChatCompletionResponse: completionResponse.data,
    }),
  });

  const { error: writeTopicsError } = await writeTopicCompletions({
    toWrite: [completionToWrite],
  });
  if (writeTopicsError !== null) {
    console.error("Failed to write topics");
    throw writeTopicsError;
  } else {
    const { error: writeCompletedBatchError } = await writeCompletedTask({
      forTaskId,
    });
    if (writeCompletedBatchError !== null) {
      console.error(writeCompletedBatchError);
      throw writeCompletedBatchError;
    }
  }
};

export const generateTopicCompletions = async ({
  fromBatchId,
}: {
  fromBatchId: string;
}) => {
  const { data: topicTasks, error: readTopicTasksError } = await readIdleTasks({
    forBatchId: fromBatchId,
  });

  if (readTopicTasksError !== null) {
    console.error(readTopicTasksError);
    throw readTopicTasksError;
  }

  const sourceDocs = await Promise.all(
    topicTasks.map((task) => {
      return (async () => {
        const { data: sourceDoc, error: readSourceDocError } =
          await readSourceDoc({ sourceDocId: task.source_doc_id });
        if (readSourceDocError !== null) {
          throw readSourceDocError;
        } else {
          return sourceDoc;
        }
      })();
    })
  );

  // TODO XMTP docs has one page that's too long.
  const withLengths: SourceDocWithLength[] = sourceDocs.map((d) => ({
    sourceDoc: d,
    length: encoding.encode(d.text_from_html).length,
  }));
  const shortEnough = withLengths.filter((d) => d.length < 3000);

  // NOTE That this is writing TOPIC COMPLETEIONS not the parsed topics
  // themselves. This is a vestige of the original design.
  const topics = await Promise.all(
    shortEnough.map((d) => {
      return (async () => {
        try {
          const completion = await readChatCompletion({
            maxTokens: 250,
            prompt: getGetTopicsPrompt({
              fromTextBlob: d.sourceDoc.text_from_html,
            }),
            model: "gpt-3.5-turbo",
            logUsage,
          });
          return createTopicCompletion({
            sourceDocId: d.sourceDoc.id,
            completion: getFirstChoiceContent({
              fromChatCompletionResponse: completion.data,
            }),
          });
        } catch (e) {
          try {
            /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
            const err = e as any;
            console.error(
              "Failed to generate topic for source doc",
              d.sourceDoc.id
            );
            console.error(err.response.status);
            console.error(err.response.headers);
            console.error(err.response.data);
          } catch (e) {
            console.error(e);
          }
          throw new Error(
            "Failed to generate topic for source doc " + d.sourceDoc.id
          );
        }
      })();
    })
  );

  const { error: writeTopicsError } = await writeTopicCompletions({
    toWrite: topics,
  });
  if (writeTopicsError !== null) {
    console.error(writeTopicsError);
    console.error("Failed to write topics");
    // TODO Should we throw here?
  } else {
    const { error: writeCompletedBatchError } = await writeCompletedTasks({
      forBatchId: fromBatchId,
    });
    if (writeCompletedBatchError !== null) {
      console.error(writeCompletedBatchError);
      console.error("Failed to write completed batch");
      // TODO Should we throw here?
    }
  }
};
