import { v4 as uuidv4 } from "uuid";
import { clients } from "./clients.js";
import { z } from "zod";
import { UnknownError } from "./errors.js";

/* ****************************************************************************
 *
 * SOURCE_DOC
 *
 * ****************************************************************************/

export const SOURCE_DOC = z.object({
  id: z.string().uuid(),
  created_at: z.coerce.date(),
  pipeline_id: z.string().uuid(),
  text_from_html: z.string(),
  page_url: z.string(),
});

export type SourceDoc = z.infer<typeof SOURCE_DOC>;

export const createSourceDoc = ({
  pipelineId,
  textFromHtml,
  pageUrl,
}: {
  pipelineId: string;
  textFromHtml: string;
  pageUrl: string;
}) => {
  try {
    return SOURCE_DOC.parse({
      id: uuidv4(),
      created_at: new Date(),
      pipeline_id: pipelineId,
      text_from_html: textFromHtml,
      page_url: pageUrl,
    });
  } catch {
    throw new UnknownError();
  }
};

export const writeSourceDoc = async ({ toWrite }: { toWrite: SourceDoc }) => {
  try {
    const { error } = await clients.etl.from("source_docs").insert(toWrite);
    if (error !== null) {
      throw new UnknownError();
    }
  } catch {
    throw new UnknownError();
  }
};

export const readSourceDoc = async ({
  sourceDocId,
}: {
  sourceDocId: string;
}) => {
  try {
    const { error, data } = await clients.etl
      .from("source_docs")
      .select("*")
      .eq("id", sourceDocId)
      .single();
    if (error !== null) {
      throw new UnknownError();
    }
    return SOURCE_DOC.parse(data);
  } catch {
    throw new UnknownError();
  }
};

/* ****************************************************************************
 *
 * TOPIC COMPLETION
 *
 * ****************************************************************************/

// TODO We should probably have a prompt version here as well. 100% actually we
// need this.
export const TOPIC_COMPLETION = z.object({
  id: z.string().uuid(),
  created_at: z.coerce.date(),
  source_doc_id: z.string().uuid(),
  completion: z.string(),
});

export type TopicCompletion = z.infer<typeof TOPIC_COMPLETION>;

export const createTopicCompletion = ({
  sourceDocId,
  completion,
}: {
  sourceDocId: string;
  completion: string;
}) => {
  try {
    return TOPIC_COMPLETION.parse({
      id: uuidv4(),
      created_at: new Date(),
      source_doc_id: sourceDocId,
      completion,
    });
  } catch {
    throw new UnknownError();
  }
};

export const writeTopicCompletions = async ({
  toWrite,
}: {
  toWrite: TopicCompletion[];
}) => {
  try {
    const { error } = await clients.etl
      .from("topic_completions")
      .insert(toWrite);
    if (error !== null) {
      throw new UnknownError();
    }
  } catch {
    throw new UnknownError();
  }
};

export const readAllTopicCompletions = async () => {
  try {
    const { error, data } = await clients.etl
      .from("topic_completions")
      .select("*");
    if (error !== null) {
      throw new UnknownError();
    }
    return z.array(TOPIC_COMPLETION).parse(data);
  } catch {
    throw new UnknownError();
  }
};

export const readTopicCompletion = async ({ id }: { id: string }) => {
  try {
    const { error, data } = await clients.etl
      .from("topic_completions")
      .select("*")
      .eq("id", id)
      .single();
    if (error !== null) {
      throw new UnknownError();
    }
    return TOPIC_COMPLETION.parse(data);
  } catch {
    throw new UnknownError();
  }
};

export const readTopicCompletions = async ({
  forSourceDocId,
}: {
  forSourceDocId: string;
}) => {
  try {
    const { error, data } = await clients.etl
      .from("topic_completions")
      .select("*")
      .eq("source_doc_id", forSourceDocId);
    if (error !== null) {
      throw new UnknownError();
    }
    return z.array(TOPIC_COMPLETION).parse(data);
  } catch {
    throw new UnknownError();
  }
};

export const readSourceDocForTopicCompletion = async ({
  forTopicCompletionId,
}: {
  forTopicCompletionId: string;
}) => {
  try {
    const topicCompletion = await readTopicCompletion({
      id: forTopicCompletionId,
    });
    return await readSourceDoc({
      sourceDocId: topicCompletion.source_doc_id,
    });
  } catch {
    throw new UnknownError();
  }
};

/* ****************************************************************************
 *
 * TOPIC COMPLETION PARSE ERROR
 *
 * ****************************************************************************/

const TOPIC_COMPLETION_PARSE_ERROR = z.object({
  id: z.string().uuid(),
  created_at: z.coerce.date(),
  topic_completion_id: z.string().uuid(),
});

export type TopicCompletionParseError = z.infer<
  typeof TOPIC_COMPLETION_PARSE_ERROR
>;

export const createTopicCompletionParseError = ({
  topicCompletionId,
}: {
  topicCompletionId: string;
}) => {
  try {
    return TOPIC_COMPLETION_PARSE_ERROR.parse({
      id: uuidv4(),
      created_at: new Date(),
      topic_completion_id: topicCompletionId,
    });
  } catch {
    throw new UnknownError();
  }
};

export const writeTopicCompletionParseError = async ({
  toWrite,
}: {
  toWrite: TopicCompletionParseError;
}) => {
  try {
    const { error } = await clients.etl
      .from("topic_completion_parse_errors")
      .insert(toWrite);
    if (error !== null) {
      throw new UnknownError();
    }
  } catch {
    throw new UnknownError();
  }
};

/* ****************************************************************************
 *
 * QUESTION COMPLETION
 *
 * ****************************************************************************/

export const QUESTION_COMPLETION = z.object({
  id: z.string().uuid(),
  created_at: z.coerce.date(),
  topic_completion_id: z.string().uuid(),
  model: z.string(),
  prompt: z.string(),
  completion: z.string(),
  embedding: z.array(z.number()).or(z.null()),
});

export type QuestionCompletion = z.infer<typeof QUESTION_COMPLETION>;

export const createQuestionCompletion = ({
  topicCompletionId,
  model,
  prompt,
  completion,
}: {
  topicCompletionId: string;
  model: string;
  prompt: string;
  completion: string;
}) => {
  try {
    return QUESTION_COMPLETION.parse({
      id: uuidv4(),
      created_at: new Date(),
      topic_completion_id: topicCompletionId,
      model,
      prompt,
      completion,
      embedding: null,
    });
  } catch {
    throw new UnknownError();
  }
};

export const writeQuestionCompletions = async ({
  toWrite,
}: {
  toWrite: QuestionCompletion[];
}) => {
  try {
    const { error } = await clients.etl
      .from("question_completions")
      .insert(toWrite);
    if (error !== null) {
      throw new UnknownError();
    }
  } catch {
    throw new UnknownError();
  }
};

export const readQuestionCompletions = async () => {
  try {
    const { data, error } = await clients.etl
      .from("question_completions")
      .select("*");

    if (error !== null) {
      throw new UnknownError();
    }

    return z.array(QUESTION_COMPLETION).parse(data);
  } catch {
    throw new UnknownError();
  }
};

/* ****************************************************************************
 *
 * TOPIC_TASK
 *
 * ****************************************************************************/

export const TOPIC_TASK = z.object({
  id: z.string().uuid(),
  batch_id: z.string().uuid(),
  created_at: z.coerce.date(),
  source_doc_id: z.string().uuid(),
  status: z.enum(["idle", "in_progress", "done", "error"]),
});

export type TopicTask = z.infer<typeof TOPIC_TASK>;

export const createTopicTask = ({
  batchId,
  sourceDocId,
}: {
  batchId: string;
  sourceDocId: string;
}) => {
  try {
    return TOPIC_TASK.parse({
      id: uuidv4(),
      batch_id: batchId,
      created_at: new Date(),
      source_doc_id: sourceDocId,
      status: "idle",
    });
  } catch {
    throw new UnknownError();
  }
};

export const readTopicTask = async ({ id }: { id: string }) => {
  try {
    const { data, error } = await clients.etl
      .from("topic_tasks")
      .select("*")
      .eq("id", id)
      .single();

    if (error !== null) {
      throw new UnknownError();
    }

    return TOPIC_TASK.parse(data);
  } catch {
    throw new UnknownError();
  }
};

export const writeTopicTasks = async ({
  toWrite,
}: {
  toWrite: TopicTask[];
}) => {
  try {
    const { error } = await clients.etl.from("topic_tasks").insert(toWrite);
    if (error !== null) {
      throw new UnknownError();
    }
  } catch {
    throw new UnknownError();
  }
};

export const readIdleTasks = async ({
  forBatchId: batchId,
}: {
  forBatchId: string;
}) => {
  try {
    const { data, error } = await clients.etl
      .from("topic_tasks")
      .select("*")
      .eq("batch_id", batchId)
      .eq("status", "idle");

    if (error !== null) {
      throw new UnknownError();
    }

    return z.array(TOPIC_TASK).parse(data);
  } catch {
    throw new UnknownError();
  }
};

export const writeCompletedTask = async ({
  forTaskId,
}: {
  forTaskId: string;
}) => {
  try {
    const { error } = await clients.etl
      .from("topic_tasks")
      .update({ status: "done" })
      .eq("id", forTaskId);

    if (error !== null) {
      throw new UnknownError();
    }
  } catch {
    throw new UnknownError();
  }
};

export const writeCompletedTasks = async ({
  forBatchId: batchId,
}: {
  forBatchId: string;
}) => {
  try {
    const { error } = await clients.etl
      .from("topic_tasks")
      .update({ status: "done" })
      .eq("batch_id", batchId);

    if (error !== null) {
      throw new UnknownError();
    }
  } catch {
    throw new UnknownError();
  }
};

/* ****************************************************************************
 *
 * QUESTION TASK
 *
 * ****************************************************************************/

export const QUESTION_TASK = z.object({
  id: z.string().uuid(),
  created_at: z.coerce.date(),
  topic_completion_id: z.string().uuid(),
  topic: z.string(),
  status: z.enum(["idle", "in_progress", "done", "error"]),
});

export type QuestionTask = z.infer<typeof QUESTION_TASK>;

export const createQuestionTask = ({
  topicCompletionId,
  topic,
}: {
  topicCompletionId: string;
  topic: string;
}) => {
  try {
    return QUESTION_TASK.parse({
      id: uuidv4(),
      created_at: new Date(),
      topic_completion_id: topicCompletionId,
      topic,
      status: "idle",
    });
  } catch {
    throw new UnknownError();
  }
};

export const readQuestionTask = async ({ forId }: { forId: string }) => {
  try {
    const { data, error } = await clients.etl
      .from("question_tasks")
      .select("*")
      .eq("id", forId)
      .single();

    if (error !== null) {
      throw new UnknownError();
    }

    return QUESTION_TASK.parse(data);
  } catch {
    throw new UnknownError();
  }
};

export const writeQuestionTasks = async ({
  toWrite,
}: {
  toWrite: QuestionTask[];
}) => {
  try {
    const { error } = await clients.etl.from("question_tasks").insert(toWrite);
    if (error !== null) {
      throw new UnknownError();
    }
  } catch {
    throw new UnknownError();
  }
};

export const readIdleQuestionTasks = async ({
  forTopicCompletionId,
}: {
  forTopicCompletionId: string;
}) => {
  try {
    const { data, error } = await clients.etl
      .from("question_tasks")
      .select("*")
      .eq("topic_completion_id", forTopicCompletionId)
      .eq("status", "idle");

    if (error !== null) {
      throw new UnknownError();
    }

    return z.array(QUESTION_TASK).parse(data);
  } catch {
    throw new UnknownError();
  }
};

export const writeCompletedQuestionTasks = async ({
  forTopicCompletionId,
}: {
  forTopicCompletionId: string;
}) => {
  try {
    const { error } = await clients.etl
      .from("question_tasks")
      .update({ status: "done" })
      .eq("topic_completion_id", forTopicCompletionId);

    if (error !== null) {
      throw new UnknownError();
    }
  } catch {
    throw new UnknownError();
  }
};

/* ****************************************************************************
 *
 * PIPELINE
 *
 * ****************************************************************************/

export const PIPELINE = z.object({
  id: z.string().uuid(),
  created_at: z.coerce.date(),
  source_docs: z.array(SOURCE_DOC),
});

const PIPELINE_WITHOUT_SOURCE_DOCS = PIPELINE.omit({ source_docs: true });

export type Pipeline = z.infer<typeof PIPELINE>;

export const createPipeline = () => {
  try {
    return PIPELINE.parse({
      id: uuidv4(),
      created_at: new Date(),
      source_docs: [],
    });
  } catch {
    throw new UnknownError();
  }
};

export const writePipeline = async ({ toWrite }: { toWrite: Pipeline }) => {
  try {
    const { error: writePipelineError } = await clients.etl
      .from("pipelines")
      .insert([{ id: toWrite.id, created_at: toWrite.created_at }]);

    if (writePipelineError !== null) {
      throw new UnknownError();
    }

    const { error: writeSourceDocsError } = await clients.etl
      .from("source_docs")
      .insert(toWrite.source_docs);

    if (writeSourceDocsError !== null) {
      throw new UnknownError();
    }
  } catch {
    throw new UnknownError();
  }
};

export const readPipeline = async ({
  pipelineId,
}: {
  pipelineId: string;
}): Promise<Pipeline> => {
  try {
    const { data: pipelineData, error: readPipelinError } = await clients.etl
      .from("pipelines")
      .select("*")
      .eq("id", pipelineId)
      .limit(1)
      .single();

    if (readPipelinError !== null) {
      throw readPipelinError;
    }

    const pipeline = PIPELINE.parse(pipelineData);

    const { data: readSourceDocsData, error: readSourceDocsError } =
      await clients.etl
        .from("source_docs")
        .select("*")
        .eq("pipeline_id", pipelineId);

    if (readSourceDocsError !== null || readSourceDocsData.length === 0) {
      throw new UnknownError();
    }

    const sourceDocs = readSourceDocsData.map((d) => {
      return SOURCE_DOC.parse(d);
    });

    return PIPELINE.parse({
      ...pipeline,
      source_docs: sourceDocs,
    });
  } catch {
    throw new UnknownError();
  }
};

export const readMostRecentPipeline = async (): Promise<Pipeline> => {
  try {
    const { data, error } = await clients.etl
      .from("pipelines")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error !== null || data === null || data.length === 0) {
      throw new UnknownError();
    }

    const pipeline = await readPipeline({
      pipelineId: PIPELINE.parse(data).id,
    });

    return PIPELINE.parse(pipeline);
  } catch {
    throw new UnknownError();
  }
};

export const NON_NULL_SOURCE_DOC = SOURCE_DOC.omit({
  text_from_html: true,
}).merge(z.object({ text_from_html: z.string() }));

export type NonNullSourceDoc = z.infer<typeof NON_NULL_SOURCE_DOC>;

export const getOnlyNonNullSourceDocs = ({
  fromPipeline,
}: {
  fromPipeline: Pipeline;
}): NonNullSourceDoc[] => {
  try {
    const results = fromPipeline.source_docs.filter(
      (d): d is NonNullSourceDoc => d.text_from_html !== null
    );
    return z.array(NON_NULL_SOURCE_DOC).parse(results);
  } catch {
    throw new UnknownError();
  }
};

/* ****************************************************************************
 *
 * SIMILARITY_RESULT
 *
 * ****************************************************************************/

export const SIMILARITY_RESULT = z.object({
  distance: z.number(),
  document: z.string(),
});

export type SimilarityResult = z.infer<typeof SIMILARITY_RESULT>;

export const readSimilarityResults = async ({
  queryEmbeddingId,
  limit = 10,
}: {
  queryEmbeddingId: string;
  limit: number;
}) => {
  try {
    const sql = (() => {
      const validation = z.string().uuid().safeParse(queryEmbeddingId);
      if (!validation.success) {
        throw new Error(validation.error.message);
      } else {
        return `select knowledge_embeddings.embedding <=> query_embeddings.embedding as distance, knowledge_embeddings.document from knowledge_embeddings left outer join query_embeddings on query_embeddings.id = '${queryEmbeddingId}' order by distance limit ${limit}`;
      }
    })();
    return await clients.prisma.$queryRawUnsafe(sql);
  } catch {
    throw new UnknownError();
  }
};
