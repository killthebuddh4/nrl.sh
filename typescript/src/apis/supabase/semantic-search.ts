import { v4 as uuidv4 } from "uuid";
import { clients } from "./clients.js";
import { typeToFlattenedError, z } from "zod";

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
}): SourceDoc => {
  return {
    id: uuidv4(),
    created_at: new Date(),
    pipeline_id: pipelineId,
    text_from_html: textFromHtml,
    page_url: pageUrl,
  };
};

export const writeSourceDoc = async ({ toWrite }: { toWrite: SourceDoc }) => {
  return await clients.etl.from("source_docs").insert(toWrite);
};

export const readSourceDoc = async ({
  sourceDocId,
}: {
  sourceDocId: string;
}) => {
  const { error, data } = await clients.etl
    .from("source_docs")
    .select("*")
    .eq("id", sourceDocId)
    .single();
  const validatedSourceDoc = SOURCE_DOC.safeParse(data);
  if (!validatedSourceDoc.success) {
    throw new Error("Invalid source doc");
  } else {
    return { data: validatedSourceDoc.data, error };
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
}): TopicCompletion => {
  return {
    id: uuidv4(),
    created_at: new Date(),
    source_doc_id: sourceDocId,
    completion,
  };
};

export const writeTopicCompletions = async ({
  toWrite,
}: {
  toWrite: TopicCompletion[];
}) => {
  return await clients.etl.from("topic_completions").insert(toWrite);
};

export const readAllTopicCompletions = async () => {
  const { error, data } = await clients.etl
    .from("topic_completions")
    .select("*");
  const validatedTopicCompletions = z.array(TOPIC_COMPLETION).safeParse(data);
  if (!validatedTopicCompletions.success) {
    throw new Error("Invalid topic completions");
  } else {
    return { data: validatedTopicCompletions.data, error };
  }
};

export const readTopicCompletion = async ({ id }: { id: string }) => {
  const { error, data } = await clients.etl
    .from("topic_completions")
    .select("*")
    .eq("id", id)
    .single();
  const validatedTopicCompletion = TOPIC_COMPLETION.safeParse(data);
  if (!validatedTopicCompletion.success) {
    /* eslint-disable-next-line no-console */
    console.error(validatedTopicCompletion.error);
    throw new Error("Invalid topic completion");
  } else {
    return { data: validatedTopicCompletion.data, error };
  }
};

export const readTopicCompletions = async ({
  forSourceDocId,
}: {
  forSourceDocId: string;
}) => {
  const { error, data } = await clients.etl
    .from("topic_completions")
    .select("*")
    .eq("source_doc_id", forSourceDocId);
  const validatedTopicCompletions = z.array(TOPIC_COMPLETION).safeParse(data);
  if (!validatedTopicCompletions.success) {
    /* eslint-disable-next-line no-console */
    console.log(data);
    throw new Error("Invalid topic completion");
  } else {
    return { data: validatedTopicCompletions.data, error };
  }
};

export const readSourceDocForTopicCompletion = async ({
  forTopicCompletionId,
}: {
  forTopicCompletionId: string;
}) => {
  const { data: readTopicCompletionData, error } = await readTopicCompletion({
    id: forTopicCompletionId,
  });
  if (error) {
    throw new Error("Invalid topic completion");
  } else {
    const { data: readSourceDocData, error } = await readSourceDoc({
      sourceDocId: readTopicCompletionData.source_doc_id,
    });
    if (error) {
      throw new Error("Invalid source doc");
    } else {
      return { data: readSourceDocData, error };
    }
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
}): TopicCompletionParseError => {
  return {
    id: uuidv4(),
    created_at: new Date(),
    topic_completion_id: topicCompletionId,
  };
};

export const writeTopicCompletionParseError = async ({
  toWrite,
}: {
  toWrite: TopicCompletionParseError;
}) => {
  return await clients.etl
    .from("topic_completion_parse_errors")
    .insert(toWrite);
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
}): QuestionCompletion => {
  return {
    id: uuidv4(),
    created_at: new Date(),
    topic_completion_id: topicCompletionId,
    model,
    prompt,
    completion,
    embedding: null,
  };
};

export const writeQuestionCompletions = async ({
  toWrite,
}: {
  toWrite: QuestionCompletion[];
}) => {
  return await clients.etl.from("question_completions").insert(toWrite);
};

export const readQuestionCompletions = async () => {
  const { data, error } = await clients.etl
    .from("question_completions")
    .select("*");

  const validatedQuestionCompletions = z
    .array(QUESTION_COMPLETION)
    .safeParse(data);
  if (!validatedQuestionCompletions.success) {
    throw new Error("Invalid question completions");
  }
  return { data: validatedQuestionCompletions.data, error };
};

/* ****************************************************************************
 *
 * TOPIC_SUMMARY
 *
 * ****************************************************************************/

const TOPIC_SUMMARY = z.object({
  id: z.string().uuid(),
  created_at: z.coerce.date(),
  topic_id: z.string().uuid(),
  summary: z.string(),
});

export type TopicSummary = z.infer<typeof TOPIC_SUMMARY>;

export const createTopicSummary = ({
  topicId,
  summary,
}: {
  topicId: string;
  summary: string;
}): TopicSummary => {
  return {
    id: uuidv4(),
    created_at: new Date(),
    topic_id: topicId,
    summary,
  };
};

export const writeTopicSummaries = async ({
  toWrite,
}: {
  toWrite: TopicSummary[];
}) => {
  return await clients.etl.from("topic_summaries").insert(toWrite);
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
}): TopicTask => {
  return {
    id: uuidv4(),
    batch_id: batchId,
    created_at: new Date(),
    source_doc_id: sourceDocId,
    status: "idle",
  };
};

export const readTopicTask = async ({ id }: { id: string }) => {
  const { data, error } = await clients.etl
    .from("topic_tasks")
    .select("*")
    .eq("id", id)
    .single();

  const validatedTopicTask = TOPIC_TASK.safeParse(data);
  if (!validatedTopicTask.success) {
    throw new Error("Invalid topic task");
  } else {
    return { data: validatedTopicTask.data, error };
  }
};

export const writeTopicTasks = async ({
  toWrite,
}: {
  toWrite: TopicTask[];
}) => {
  return await clients.etl.from("topic_tasks").insert(toWrite);
};

export const readIdleTasks = async ({
  forBatchId: batchId,
}: {
  forBatchId: string;
}) => {
  const { data, error } = await clients.etl
    .from("topic_tasks")
    .select("*")
    .eq("batch_id", batchId)
    .eq("status", "idle");

  const validatedTopicTasks = z.array(TOPIC_TASK).safeParse(data);
  if (!validatedTopicTasks.success) {
    throw new Error("Invalid topic task");
  } else {
    return { data: validatedTopicTasks.data, error };
  }
};

export const writeCompletedTask = async ({
  forTaskId,
}: {
  forTaskId: string;
}) => {
  return await clients.etl
    .from("topic_tasks")
    .update({ status: "done" })
    .eq("id", forTaskId);
};

export const writeCompletedTasks = async ({
  forBatchId: batchId,
}: {
  forBatchId: string;
}) => {
  return await clients.etl
    .from("topic_tasks")
    .update({ status: "done" })
    .eq("batch_id", batchId);
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
}): QuestionTask => {
  return {
    id: uuidv4(),
    created_at: new Date(),
    topic_completion_id: topicCompletionId,
    topic,
    status: "idle",
  };
};

export const readQuestionTask = async ({ forId }: { forId: string }) => {
  const { data, error } = await clients.etl
    .from("question_tasks")
    .select("*")
    .eq("id", forId)
    .single();

  const validatedQuestionTask = QUESTION_TASK.safeParse(data);
  if (!validatedQuestionTask.success) {
    throw new Error("Invalid question task");
  } else {
    return { data: validatedQuestionTask.data, error };
  }
};

export const writeQuestionTasks = async ({
  toWrite,
}: {
  toWrite: QuestionTask[];
}) => {
  return await clients.etl.from("question_tasks").insert(toWrite);
};

export const readIdleQuestionTasks = async ({
  forTopicCompletionId,
}: {
  forTopicCompletionId: string;
}) => {
  const { data, error } = await clients.etl
    .from("question_tasks")
    .select("*")
    .eq("topic_completion_id", forTopicCompletionId)
    .eq("status", "idle");

  const validatedQuestionTasks = z.array(QUESTION_TASK).safeParse(data);
  if (!validatedQuestionTasks.success) {
    throw new Error("Invalid question task");
  } else {
    return { data: validatedQuestionTasks.data, error };
  }
};

export const writeCompletedQuestionTasks = async ({
  forTopicCompletionId,
}: {
  forTopicCompletionId: string;
}) => {
  return await clients.etl
    .from("question_tasks")
    .update({ status: "done" })
    .eq("topic_completion_id", forTopicCompletionId);
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

export const createPipeline = (): Pipeline => {
  return {
    id: uuidv4(),
    created_at: new Date(),
    source_docs: [],
  };
};

export const writePipeline = async ({ toWrite }: { toWrite: Pipeline }) => {
  const { error } = await clients.etl
    .from("pipelines")
    .insert([{ id: toWrite.id, created_at: toWrite.created_at }]);
  if (error !== null) {
    throw error;
  }
  return await clients.etl.from("source_docs").insert(toWrite.source_docs);
};

export const readPipeline = async ({
  pipelineId,
}: {
  pipelineId: string;
}): Promise<Pipeline> => {
  const { data: pipelineData, error: readPipelinError } = await clients.etl
    .from("pipelines")
    .select("*")
    .eq("id", pipelineId)
    .limit(1)
    .single();

  const validatedPipeline =
    PIPELINE_WITHOUT_SOURCE_DOCS.safeParse(pipelineData);
  if (!validatedPipeline.success) {
    /* eslint-disable no-console */
    throw new Error(validatedPipeline.error.message);
  }

  if (readPipelinError !== null) {
    throw readPipelinError;
  }

  const { data: sourceDocsData, error: readSourceDocsError } = await clients.etl
    .from("source_docs")
    .select("*")
    .eq("pipeline_id", pipelineId);
  if (readSourceDocsError !== null) {
    throw readSourceDocsError;
  }
  if (sourceDocsData === null) {
    throw new Error("sourceDocsData === null");
  }
  if (sourceDocsData.length === 0) {
    throw new Error("sourceDocsData.length is 0");
  }

  const sourceDocs = sourceDocsData.map((d) => {
    const validation = SOURCE_DOC.safeParse(d);
    if (!validation.success) {
      throw new Error(validation.error.message);
    } else {
      return validation.data;
    }
  });

  return {
    ...validatedPipeline.data,
    source_docs: sourceDocs,
  };
};

export const readMostRecentPipeline = async (): Promise<Pipeline> => {
  const { data, error } = await clients.etl
    .from("pipelines")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error !== null) {
    throw error;
  }
  if (data === null) {
    throw new Error("data === null");
  }
  if (data.length === 0) {
    throw new Error("data.length is 0");
  }

  const validatedPipeline = PIPELINE_WITHOUT_SOURCE_DOCS.safeParse(data);
  if (!validatedPipeline.success) {
    throw new Error(validatedPipeline.error.message);
  } else {
    return await readPipeline({
      pipelineId: validatedPipeline.data.id,
    });
  }
};

export type NonNullSourceDoc = Omit<SourceDoc, "text_from_html"> & {
  text_from_html: string;
};

export const getOnlyNonNullSourceDocs = ({
  fromPipeline,
}: {
  fromPipeline: Pipeline;
}): NonNullSourceDoc[] => {
  return fromPipeline.source_docs.filter(
    (d): d is NonNullSourceDoc => d.text_from_html !== null
  );
};

/* ****************************************************************************
 *
 * QUERY_EMBEDDING
 *
 * ****************************************************************************/

export const QUERY_EMBEDDING = z.object({
  id: z.string().uuid(),
  created_at: z.coerce.date(),
  embedding: z.array(z.number()).length(1536),
  query_text: z.string(),
});

export type QueryEmbedding = z.infer<typeof QUERY_EMBEDDING>;

export const createQueryEmbedding = ({
  queryText,
  embedding,
}: {
  queryText: string;
  embedding: number[];
}): QueryEmbedding => {
  return {
    id: uuidv4(),
    created_at: new Date(),
    query_text: queryText,
    embedding,
  };
};

export const writeQueryEmbedding = async ({
  queryEmbedding,
}: {
  queryEmbedding: QueryEmbedding;
}) => {
  return await clients.etl.from("query_embeddings").insert([queryEmbedding]);
};

/* ****************************************************************************
 *
 * KNOWLEDGE_EMBEDDING
 *
 * ****************************************************************************/

export const KNOWLEDGE_EMBEDDING = z.object({
  id: z.string().uuid(),
  created_at: z.coerce.date(),
  pipeline_id: z.string().uuid(),
  embedding: z.array(z.number()).length(1536),
  document: z.string(),
  source: z.string(),
});

export type KnowledgeEmbedding = z.infer<typeof KNOWLEDGE_EMBEDDING>;

export const createKnowledgeEmbedding = ({
  pipelineId,
  document,
  source,
  embedding,
}: {
  pipelineId: string;
  document: string;
  source: string;
  embedding: number[];
}): KnowledgeEmbedding => {
  return {
    id: uuidv4(),
    created_at: new Date(),
    pipeline_id: pipelineId,
    document,
    source,
    embedding,
  };
};

// TODO We need a standard way to return data and errors.
export const readKnowledgeEmbeddings = async ({
  pipelineId,
}: {
  pipelineId: string;
}): Promise<KnowledgeEmbedding[]> => {
  const { data, error } = await clients.etl
    .from("knowledge_embeddings")
    .select("*")
    .eq("pipeline_id", pipelineId);
  if (error !== null) {
    throw error;
  }
  if (data === null) {
    throw new Error("data === null");
  }
  if (data.length === 0) {
    throw new Error("data.length is 0");
  }

  const results = data.map((d) => {
    const validation = KNOWLEDGE_EMBEDDING.safeParse(d);
    if (!validation.success) {
      throw new Error(validation.error.message);
    } else {
      return validation.data;
    }
  });

  return results;
};

export const writeKnowledgeEmbeddings = async ({
  toWrite,
}: {
  toWrite: KnowledgeEmbedding[];
}) => {
  return await clients.etl.from("knowledge_embeddings").insert(toWrite);
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

// TODO Validate this
export const readSimilarityResults = async ({
  queryEmbeddingId,
  limit = 10,
}: {
  queryEmbeddingId: string;
  limit: number;
}) => {
  const sql = (() => {
    const validation = z.string().uuid().safeParse(queryEmbeddingId);
    if (!validation.success) {
      throw new Error(validation.error.message);
    } else {
      return `select knowledge_embeddings.embedding <=> query_embeddings.embedding as distance, knowledge_embeddings.document from knowledge_embeddings left outer join query_embeddings on query_embeddings.id = '${queryEmbeddingId}' order by distance limit ${limit}`;
    }
  })();
  const results = await clients.prisma.$queryRawUnsafe(sql);
  /* eslint-disable-next-line no-console */
  console.log("SIM RESAULTS", results);
  return results;
};
