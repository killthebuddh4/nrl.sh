import { v4 as uuidv4 } from "uuid";
import { clients } from "./clients.js";
import { z } from "zod";

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

export const SourceDoc = {
  create: {
    one: ({
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
      } catch (err) {
        throw err;
      }
    },
  },

  read: {
    one: {
      byId: async ({ id }: { id: string }) => {
        try {
          const { data } = await clients.etl
            .from("source_docs")
            .select("*")
            .eq("id", id)
            .single()
            .throwOnError();

          return SOURCE_DOC.parse(data);
        } catch (err) {
          throw err;
        }
      },

      byTopicCompletionId: async ({ id }: { id: string }) => {
        try {
          const topicCompletion = await TopicCompletion.read.one.byId({ id });
          const sourceDoc = await SourceDoc.read.one.byId({
            id: topicCompletion.source_doc_id,
          });
          return SOURCE_DOC.parse(sourceDoc);
        } catch (err) {
          throw err;
        }
      },

      byQuestionCompletionId: async ({ id }: { id: string }) => {
        try {
          const questionCompletion = await QuestionCompletion.read.one.byId({
            id,
          });
          const sourceDoc = await SourceDoc.read.one.byTopicCompletionId({
            id: questionCompletion.topic_completion_id,
          });
          return SOURCE_DOC.parse(sourceDoc);
        } catch (err) {
          throw err;
        }
      },
    },

    some: {
      byPipelineId: async ({ pipelineId }: { pipelineId: string }) => {
        try {
          const { data } = await clients.etl
            .from("source_docs")
            .select("*")
            .eq("pipeline_id", pipelineId)
            .throwOnError();

          return z.array(SOURCE_DOC).parse(data);
        } catch (err) {
          throw err;
        }
      },

      thatErrored: async ({ inPipelineId }: { inPipelineId: string }) => {
        try {
          const sql = `select * from question_completion_errors inner join topic_completions on question_completion_errors.topic_completion_id = topic_completions.id inner join source_docs on topic_completions.source_doc_id = source_docs.id where source_docs.pipeline_id = '${inPipelineId}';`;
          const results = await clients.prisma.$queryRawUnsafe(sql);
          return z.array(SOURCE_DOC).parse(results);
        } catch (err) {
          throw err;
        }
      },
    },
  },

  write: {
    one: {
      data: async ({ data }: { data: z.infer<typeof SOURCE_DOC> }) => {
        try {
          return await clients.etl
            .from("source_docs")
            .insert(data)
            .throwOnError();
        } catch (err) {
          throw err;
        }
      },
    },

    some: {
      data: async ({ data }: { data: z.infer<typeof SOURCE_DOC>[] }) => {
        try {
          return await clients.etl
            .from("source_docs")
            .insert(data)
            .throwOnError();
        } catch (err) {
          throw err;
        }
      },
    },
  },

  delete: {
    one: {
      byId: async ({ id }: { id: string }) => {
        try {
          return await clients.etl
            .from("source_docs")
            .delete()
            .eq("id", id)
            .throwOnError();
        } catch (err) {
          throw err;
        }
      },
    },
  },
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

export const TopicCompletion = {
  create: {
    one: ({
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
      } catch (err) {
        throw err;
      }
    },
  },

  read: {
    one: {
      byId: async ({ id }: { id: string }) => {
        try {
          const { data } = await clients.etl
            .from("topic_completions")
            .select("*")
            .eq("id", id)
            .single()
            .throwOnError();
          return TOPIC_COMPLETION.parse(data);
        } catch (err) {
          throw err;
        }
      },
    },

    all: async () => {
      try {
        const { data } = await clients.etl
          .from("topic_completions")
          .select("*")
          .throwOnError();
        return z.array(TOPIC_COMPLETION).parse(data);
      } catch (err) {
        throw err;
      }
    },

    some: {
      bySourceDocId: async ({ sourceDocId }: { sourceDocId: string }) => {
        try {
          const { data } = await clients.etl
            .from("topic_completions")
            .select("*")
            .eq("source_doc_id", sourceDocId)
            .throwOnError();
          return z.array(TOPIC_COMPLETION).parse(data);
        } catch (err) {
          throw err;
        }
      },

      byPipelineId: async ({ pipelineId }: { pipelineId: string }) => {
        try {
          const sourceDocs = await SourceDoc.read.some.byPipelineId({
            pipelineId,
          });

          const sourceDocIds = sourceDocs.map((sourceDoc) => sourceDoc.id);

          const { data } = await clients.etl
            .from("topic_completions")
            .select("*")
            .in("source_doc_id", sourceDocIds)
            .throwOnError();
          return z.array(TOPIC_COMPLETION).parse(data);
        } catch (err) {
          throw err;
        }
      },
    },
  },

  write: {
    one: {
      data: async ({ data }: { data: z.infer<typeof TOPIC_COMPLETION> }) => {
        try {
          return await clients.etl
            .from("topic_completions")
            .insert(data)
            .throwOnError();
        } catch (err) {
          throw err;
        }
      },
    },

    some: {
      data: async ({ data }: { data: z.infer<typeof TOPIC_COMPLETION>[] }) => {
        try {
          return await clients.etl
            .from("topic_completions")
            .insert(data)
            .throwOnError();
        } catch (err) {
          throw err;
        }
      },
    },
  },
};

/* ****************************************************************************
 *
 * TOPIC COMPLETION ERROR
 *
 * ****************************************************************************/

export const TOPIC_COMPLETION_ERROR = z.object({
  id: z.string().uuid(),
  created_at: z.coerce.date(),
  source_doc_id: z.string().uuid(),
  message: z.string(),
});

export const TopicCompletionError = {
  create: {
    one: ({
      sourceDocId,
      message,
    }: {
      sourceDocId: string;
      message: string;
    }) => {
      try {
        return TOPIC_COMPLETION_ERROR.parse({
          id: uuidv4(),
          created_at: new Date(),
          source_doc_id: sourceDocId,
          message,
        });
      } catch (err) {
        throw err;
      }
    },
  },

  read: {
    some: {
      byPipelineId: async ({ pipelineId }: { pipelineId: string }) => {
        try {
          const sourceDocs = await SourceDoc.read.some.byPipelineId({
            pipelineId,
          });
          const sourceDocIds = sourceDocs.map((sourceDoc) => sourceDoc.id);

          const { data } = await clients.etl
            .from("topic_completion_errors")
            .select("*")
            .in("source_doc_id", sourceDocIds)
            .throwOnError();
          return z.array(TOPIC_COMPLETION_ERROR).parse(data);
        } catch (err) {
          throw err;
        }
      },
    },
  },

  write: {
    one: {
      data: async ({
        data,
      }: {
        data: z.infer<typeof TOPIC_COMPLETION_ERROR>;
      }) => {
        try {
          return await clients.etl
            .from("topic_completion_errors")
            .insert(data)
            .throwOnError();
        } catch (err) {
          throw err;
        }
      },
    },
  },
};

/* ****************************************************************************
 *
 * QUESTION COMPLETION
 *
 * ****************************************************************************/

export const QUESTION_COMPLETION = z.object({
  id: z.string().uuid(),
  created_at: z.coerce.date(),
  completion: z.string(),
  model: z.string(),
  prompt: z.string(),
  topic_completion_id: z.string().uuid(),
});

export const QuestionCompletion = {
  create: {
    one: ({
      completion,
      model,
      prompt,
      topicCompletionId,
    }: {
      completion: string;
      model: string;
      prompt: string;
      topicCompletionId: string;
    }) => {
      try {
        return QUESTION_COMPLETION.parse({
          id: uuidv4(),
          created_at: new Date(),
          model,
          prompt,
          completion,
          topic_completion_id: topicCompletionId,
        });
      } catch (err) {
        throw err;
      }
    },
  },

  read: {
    one: {
      byId: async ({ id }: { id: string }) => {
        try {
          const { data } = await clients.etl
            .from("question_completions")
            .select("*")
            .eq("id", id)
            .single()
            .throwOnError();
          return QUESTION_COMPLETION.parse(data);
        } catch (err) {
          throw err;
        }
      },
    },

    all: async () => {
      try {
        const { data } = await clients.etl
          .from("question_completions")
          .select("*")
          .throwOnError();
        return z.array(QUESTION_COMPLETION).parse(data);
      } catch (err) {
        throw err;
      }
    },

    some: {
      byPipelineId: async ({ pipelineId }: { pipelineId: string }) => {
        try {
          const sql = `select question_completions.* from question_completions inner join topic_completions on question_completions.topic_completion_id = topic_completions.id inner join source_docs on topic_completions.source_doc_id = source_docs.id inner join pipelines on source_docs.pipeline_id = pipelines.id where pipelines.id = '${pipelineId}';`;
          const response = await clients.prisma.$queryRawUnsafe(sql);
          return z.array(QUESTION_COMPLETION).parse(response);
        } catch (err) {
          throw err;
        }
      },
    },
  },

  write: {
    one: {
      data: async ({ data }: { data: z.infer<typeof QUESTION_COMPLETION> }) => {
        try {
          return await clients.etl
            .from("question_completions")
            .insert(data)
            .throwOnError();
        } catch (err) {
          throw err;
        }
      },
    },

    some: {
      data: async ({
        data,
      }: {
        data: z.infer<typeof QUESTION_COMPLETION>[];
      }) => {
        try {
          return await clients.etl
            .from("question_completions")
            .insert(data)
            .throwOnError();
        } catch (err) {
          throw err;
        }
      },
    },
  },
};

/* ****************************************************************************
 *
 * QUESTION COMPLETION ERROR
 *
 * ****************************************************************************/

export const QUESTION_COMPLETION_ERROR = z.object({
  id: z.string().uuid(),
  created_at: z.coerce.date(),
  topic_completion_id: z.string().uuid(),
  message: z.string(),
});

export const QuestionCompletionError = {
  create: {
    one: ({
      topicCompletionId,
      message,
    }: {
      topicCompletionId: string;
      message: string;
    }) => {
      try {
        return QUESTION_COMPLETION_ERROR.parse({
          id: uuidv4(),
          created_at: new Date(),
          topic_completion_id: topicCompletionId,
          message,
        });
      } catch (err) {
        throw err;
      }
    },
  },

  read: {
    some: {
      byPipelineId: async ({ pipelineId }: { pipelineId: string }) => {
        try {
          const sql = `select question_completion_errors.* from question_completion_errors inner join topic_completions on question_completion_errors.topic_completion_id = topic_completions.id inner join source_docs on topic_completions.source_doc_id = source_docs.id inner join pipelines on source_docs.pipeline_id = pipelines.id where pipelines.id = '${pipelineId}';`;
          const response = await clients.prisma.$queryRawUnsafe(sql);
          return z.array(QUESTION_COMPLETION_ERROR).parse(response);
        } catch (err) {
          throw err;
        }
      },
    },
  },

  write: {
    one: {
      data: async ({
        data,
      }: {
        data: z.infer<typeof QUESTION_COMPLETION_ERROR>;
      }) => {
        try {
          return await clients.etl
            .from("question_completion_errors")
            .insert(data)
            .throwOnError();
        } catch (err) {
          throw err;
        }
      },
    },

    some: {
      data: async ({
        data,
      }: {
        data: z.infer<typeof QUESTION_COMPLETION_ERROR>[];
      }) => {
        try {
          return await clients.etl
            .from("question_completion_errors")
            .insert(data)
            .throwOnError();
        } catch (err) {
          throw err;
        }
      },
    },
  },

  delete: {
    some: {
      byPipelineId: async ({ pipelineId }: { pipelineId: string }) => {
        try {
          const sql = `delete from question_completion_errors inner join topic_completions on question_completion_errors.topic_completion_id = topic_completions.id inner join source_docs on topic_completions.source_doc_id = source_docs.id inner join pipelines on source_docs.pipeline_id = pipelines.id where pipelines.id = '${pipelineId}';`;
          await clients.prisma.$queryRawUnsafe(sql);
        } catch (err) {
          throw err;
        }
      },
    },
  },
};

/* ****************************************************************************
 *
 * KNOWLEDGE EMBEDDINGS
 *
 * ****************************************************************************/

export const KNOWLEDGE_EMBEDDING = z.object({
  id: z.string().uuid(),
  created_at: z.coerce.date(),
  question_completion_id: z.string().uuid(),
  question_embedding: z.array(z.number()).length(1536),
  question_text: z.string(),
  answer_text: z.string(),
});

export class KnowledgeEmbedding {
  public static create = {
    one: {
      data: ({
        questionCompletionId,
        embedding,
      }: {
        questionCompletionId: string;
        embedding: number[];
      }) => {
        try {
          return KNOWLEDGE_EMBEDDING.parse({
            id: uuidv4(),
            created_at: new Date(),
            question_completion_id: questionCompletionId,
            embedding,
          });
        } catch (err) {
          throw err;
        }
      },
    },
  };

  public static write = {
    some: {
      data: async ({
        data,
      }: {
        data: z.infer<typeof KNOWLEDGE_EMBEDDING>[];
      }) => {
        try {
          return await clients.etl
            .from("knowledge_embeddings")
            .insert(data)
            .throwOnError();
        } catch (err) {
          throw err;
        }
      },
    },
  };

  public static search = {
    byQueryEmbeddingId: async ({
      queryEmbeddingId,
    }: {
      queryEmbeddingId: string;
    }) => {
      try {
        const sql = (() => {
          const validation = z.string().uuid().safeParse(queryEmbeddingId);
          if (!validation.success) {
            throw new Error(validation.error.message);
          } else {
            return `select knowledge_embeddings.question_embedding <=> query_embeddings.embedding as distance, knowledge_embeddings.question_completion_id, knowledge_embeddings.answer_text from knowledge_embeddings left outer join query_embeddings on query_embeddings.id = '${queryEmbeddingId}' order by distance limit 10`;
          }
        })();
        const results = await clients.prisma.$queryRawUnsafe(sql);
        return z
          .array(
            z.object({
              distance: z.number(),
              question_completion_id: z.string(),
              answer_text: z.string(),
            })
          )
          .parse(results);
      } catch (err) {
        throw err;
      }
    },
  };
}

/* ****************************************************************************
 *
 * QUERY EMBEDDINGS
 *
 * ****************************************************************************/

export const QUERY_EMBEDDING = z.object({
  id: z.string().uuid(),
  created_at: z.coerce.date(),
  embedding: z.array(z.number()).length(1536),
  text: z.string(),
});

export class QueryEmbedding {
  public static create = {
    one: {
      data: ({ text, embedding }: { text: string; embedding: number[] }) => {
        try {
          return QUERY_EMBEDDING.parse({
            id: uuidv4(),
            created_at: new Date(),
            embedding,
            text,
          });
        } catch (err) {
          throw err;
        }
      },
    },
  };

  public static write = {
    some: {
      data: async ({ data }: { data: z.infer<typeof QUERY_EMBEDDING>[] }) => {
        try {
          return await clients.etl
            .from("query_embeddings")
            .insert(data)
            .throwOnError();
        } catch (err) {
          throw err;
        }
      },
    },
  };
}

/* ****************************************************************************
 *
 * PIPELINE
 *
 * ****************************************************************************/

export const PIPELINE = z.object({
  id: z.string().uuid(),
  created_at: z.coerce.date(),
});

export class Pipeline {
  public static create = {
    one: {
      data: () => {
        try {
          return PIPELINE.parse({
            id: uuidv4(),
            created_at: new Date(),
            source_docs: [],
          });
        } catch (err) {
          throw err;
        }
      },
    },
  };

  public static read = {
    one: {
      byId: async ({ pipelineId }: { pipelineId: string }) => {
        try {
          const { data } = await clients.etl
            .from("pipelines")
            .select("*")
            .eq("id", pipelineId)
            .single()
            .throwOnError();

          return PIPELINE.parse(data);
        } catch (err) {
          throw err;
        }
      },

      mostRecent: async () => {
        try {
          const { data } = await clients.etl
            .from("pipelines")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(1)
            .single()
            .throwOnError();

          return PIPELINE.parse(data);
        } catch (err) {
          throw err;
        }
      },
    },

    all: async () => {
      try {
        const { data } = await clients.etl
          .from("pipelines")
          .select("*")
          .throwOnError();
        return z.array(PIPELINE).parse(data);
      } catch (err) {
        throw err;
      }
    },
  };

  public static write = {
    one: {
      data: async ({ pipeline }: { pipeline: z.infer<typeof PIPELINE> }) => {
        try {
          return await clients.etl
            .from("pipelines")
            .insert(pipeline)
            .throwOnError();
        } catch (err) {
          throw err;
        }
      },
    },
  };

  public static delete = {
    cascade: {
      byId: async ({ id }: { id: string }) => {
        try {
          return await clients.etl
            .from("pipelines")
            .delete()
            .eq("id", id)
            .throwOnError();
        } catch (err) {
          throw err;
        }
      },
    },
  };
}
