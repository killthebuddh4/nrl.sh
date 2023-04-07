/* eslint-disable no-console */
import { PlaywrightCrawler, Configuration } from "crawlee";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import {
  GenerateQuestionsFromTopic,
  ExtractTopics,
  GenerateAnswerToQuestion,
} from "../features/prompts-and-completions.js";
import { TASK, processTasks } from "../apis/openai/rate-limiting.js";
import * as RLE from "../apis/openai/rate-limiting-embeddings.js";
import { local } from "../utils/chalk.js";
import { ChatCompletion, Embeddings } from "../apis/openai/api.js";
import {
  Pipeline,
  QuestionCompletion,
  QuestionCompletionError,
  SourceDoc,
  TopicCompletion,
  TopicCompletionError,
  TOPIC_COMPLETION,
  SOURCE_DOC,
  QUESTION_COMPLETION,
  QueryEmbedding,
  KnowledgeEmbedding,
} from "../apis/supabase/semantic-mapping.js";
import * as ApiTypes from "../apis/types.js";
import * as tiktoken from "@dqbd/tiktoken";
const embeddingEncoding = tiktoken.encoding_for_model("text-embedding-ada-002");

Configuration.getGlobalConfig().set("persistStorage", false);

const MAX_TOKENS = 750;
const MODEL = z.enum(["gpt-3.5-turbo", "gpt-4"]);

const QUESTION_COMPLETION_TASK = TASK.extend({
  metadata: z.object({
    topicCompletionId: z.string(),
  }),
});

const TOPIC_COMPLETION_TASK = TASK.extend({
  metadata: z.object({
    sourceDocId: z.string(),
  }),
});

/* ****************************************************************************
 *
 * GENERATE SOURCE DOCS
 *
 * ***************************************************************************/

const DISJOINT_ARRAYS = z
  .object({
    a: z.array(z.string()),
    b: z.array(z.string()),
  })
  .superRefine((val, ctx) => {
    const intersection = val.a.filter((x) => val.b.includes(x));
    if (intersection.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Arrays are not disjoint: ${intersection.join(", ")}`,
      });
    }
  })
  .brand("DISJOINT_ARRAYS");

const GENERATE_SOURCE_DOCS_OPTIONS = z.object({
  fromUrl: z.string(),
  blacklist: z.array(z.string()),
  whitelist: z.array(z.string()),
  limit: z.number().optional(),
});

export const generateSourceDocs = async ({
  fromUrl,
  blacklist,
  whitelist,
  limit,
}: z.infer<typeof GENERATE_SOURCE_DOCS_OPTIONS>) => {
  DISJOINT_ARRAYS.parse({ a: blacklist, b: whitelist });

  const pipeline = Pipeline.create.one.data();
  await Pipeline.write.one.data({ pipeline });

  const sourceDocs: ApiTypes.SourceDoc[] = [];

  const crawler = new PlaywrightCrawler({
    async requestHandler({ request, page, enqueueLinks }) {
      if (blacklist.some((url) => request.url.includes(url))) {
        throw new Error(`URL is blacklisted: ${request.url}`);
      } else {
        local.blue("Processing page: " + request.url);
        const textContent = await page.textContent("main");
        if (textContent === null) {
          throw new Error("textContent is null");
        } else {
          sourceDocs.push(
            SourceDoc.create.one({
              pipelineId: pipeline.id,
              pageUrl: request.url,
              textFromHtml: textContent,
            })
          );
        }
        if (whitelist.length === 0) {
          await enqueueLinks({
            exclude: blacklist,
          });
        }
      }
    },
    maxRequestsPerCrawl: limit || Infinity,
    requestHandlerTimeoutSecs: 300,
  });

  const urls = (() => {
    if (whitelist.length > 0) {
      return whitelist;
    } else {
      return [fromUrl];
    }
  })();

  await crawler.run(urls);

  await SourceDoc.write.some.data({ data: sourceDocs });

  return pipeline.id;
};

/* ****************************************************************************
 *
 * GENERATE TOPIC COMPLETIONS
 *
 * ***************************************************************************/

const GENERATE_TOPIC_COMPLETIONS_OPTIONS = z.object({
  forPipelineId: z.string(),
  whitelist: z.array(z.string()),
  blacklist: z.array(z.string()),
});

export const selectSourceDocs = async ({
  forPipelineId,
  whitelist,
  blacklist,
}: z.infer<typeof GENERATE_TOPIC_COMPLETIONS_OPTIONS>) => {
  const unfiltered = await SourceDoc.read.some.byPipelineId({
    pipelineId: forPipelineId,
  });
  return unfiltered.filter((sourceDoc) => {
    const whitelistOk =
      whitelist.length === 0 || whitelist.includes(sourceDoc.page_url);
    const blacklistOk =
      blacklist.length === 0 || !blacklist.includes(sourceDoc.page_url);
    return whitelistOk && blacklistOk;
  });
};

export const generateTopicCompletions = async ({
  forSourceDocs,
}: {
  forSourceDocs: ApiTypes.SourceDoc[];
}) => {
  const tasks: z.infer<typeof TASK>[] = [];

  for (const sourceDoc of forSourceDocs) {
    const prompt = ExtractTopics.createPrompt({
      fromTextBlob: sourceDoc.text_from_html,
    });

    try {
      const model = MODEL.parse(
        ExtractTopics.getModel({ forPrompt: prompt, maxTokens: MAX_TOKENS })
      );

      const task = TOPIC_COMPLETION_TASK.parse({
        id: uuidv4(),
        endpoint: "chat completion",
        status: "idle",
        prompt,
        timestamp: Date.now(),
        model,
        numTokens: ChatCompletion.util.approxTokens({
          forRequest: { prompt, model, maxTokens: 500 },
        }),
        metadata: {
          sourceDocId: sourceDoc.id,
        },
      });

      tasks.push(task);
    } catch (error) {
      await TopicCompletionError.write.one.data({
        data: TopicCompletionError.create.one({
          sourceDocId: sourceDoc.id,
          message: JSON.stringify(error),
        }),
      });
    }
  }

  const processor = async ({
    task,
  }: {
    task: z.infer<typeof TOPIC_COMPLETION_TASK>;
  }) => {
    try {
      const response = await ChatCompletion.read.one.forPrompt({
        prompt: task.prompt,
        model: task.model,
        maxTokens: 500,
        options: {
          timeout: 15000,
        },
      });

      const sourceDoc = SOURCE_DOC.parse(
        forSourceDocs.find((tc) => tc.id === task.metadata.sourceDocId)
      );

      await TopicCompletion.write.one.data({
        data: TopicCompletion.create.one({
          sourceDocId: sourceDoc.id,
          completion: ChatCompletion.util.getFirstChoiceContent({
            from: response,
          }),
        }),
      });

      return TOPIC_COMPLETION_TASK.parse({
        endpoint: "chat completion",
        status: "complete",
        id: task.id,
        model: task.model,
        prompt: task.prompt,
        timestamp: Date.now(),
        numTokens:
          response.data.usage.prompt_tokens +
          response.data.usage.completion_tokens,
        response,
        metadata: task.metadata,
      });
    } catch (error) {
      try {
        const sourceDoc = SOURCE_DOC.parse(
          forSourceDocs.find((tc) => tc.id === task.metadata.sourceDocId)
        );
        await TopicCompletionError.write.one.data({
          data: TopicCompletionError.create.one({
            sourceDocId: sourceDoc.id,
            message: JSON.stringify(error),
          }),
        });
      } catch (error) {
        local.red(JSON.stringify(error, null, 2));
      }
      throw error;
    }
  };

  const wrapper = async ({ task }: { task: z.infer<typeof TASK> }) => {
    try {
      const tt = TOPIC_COMPLETION_TASK.parse(task);
      return await processor({ task: tt });
    } catch (err) {
      throw err;
    }
  };

  await processTasks({ tasks, processor: wrapper, maxTokens: 500 });
};

const NO_GPT_4 = MODEL.superRefine((val, ctx) => {
  if (val === "gpt-4") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "skipping gpt-4 for question completions",
    });
  }
});

/* ****************************************************************************
 *
 * GENERATE QUESTION COMPLETIONS
 *
 * ***************************************************************************/

const GENERATE_QUESTION_COMPLETIONS_OPTIONS = z.object({
  forPipelineId: z.string(),
  whitelist: z.array(z.string()),
  blacklist: z.array(z.string()),
});

export const selectTopicCompletions = async ({
  forPipelineId,
  whitelist,
  blacklist,
}: z.infer<typeof GENERATE_QUESTION_COMPLETIONS_OPTIONS>) => {
  const unfiltered = await TopicCompletion.read.some.byPipelineId({
    pipelineId: forPipelineId,
  });
  return unfiltered.filter((topicCompletion) => {
    const whitelistOk =
      whitelist.length === 0 || whitelist.includes(topicCompletion.id);
    const blacklistOk =
      blacklist.length === 0 || !blacklist.includes(topicCompletion.id);
    return whitelistOk && blacklistOk;
  });
};

export const generateQuestionCompletions = async ({
  forTopicCompletions,
}: {
  forTopicCompletions: ApiTypes.TopicCompletion[];
}) => {
  const tasks: z.infer<typeof QUESTION_COMPLETION_TASK>[] = [];
  for (const topicCompletion of forTopicCompletions) {
    try {
      const sourceDoc = await SourceDoc.read.one.byId({
        id: topicCompletion.source_doc_id,
      });

      const topics = ExtractTopics.completion.parse(topicCompletion.completion);

      for (const topic of topics) {
        try {
          const prompt = GenerateQuestionsFromTopic.createPrompt({
            fromTextBlob: sourceDoc.text_from_html,
            topicToAskAbout: topic,
          });

          const model = NO_GPT_4.parse(
            GenerateQuestionsFromTopic.getModelForPrompt({
              prompt,
              maxTokens: 500,
            })
          );

          const task = QUESTION_COMPLETION_TASK.parse({
            id: uuidv4(),
            endpoint: "chat completion",
            status: "idle",
            prompt,
            timestamp: Date.now(),
            model,
            numTokens: ChatCompletion.util.approxTokens({
              forRequest: { prompt, model, maxTokens: 500 },
            }),
            metadata: {
              topicCompletionId: topicCompletion.id,
            },
          });

          tasks.push(task);
        } catch (error) {
          await QuestionCompletionError.write.one.data({
            data: QuestionCompletionError.create.one({
              topicCompletionId: topicCompletion.id,
              message: JSON.stringify(error),
            }),
          });
        }
      }
    } catch (err) {
      local.red(JSON.stringify(err, null, 2));
      throw err;
    }
  }

  const processor = async ({
    task,
  }: {
    task: z.infer<typeof QUESTION_COMPLETION_TASK>;
  }) => {
    try {
      const response = await ChatCompletion.read.one.forPrompt({
        prompt: task.prompt,
        model: task.model,
        maxTokens: 500,
        options: {
          timeout: 15000,
        },
      });

      const topicCompletion = TOPIC_COMPLETION.parse(
        forTopicCompletions.find(
          (tc) => tc.id === task.metadata.topicCompletionId
        )
      );

      await QuestionCompletion.write.one.data({
        data: QuestionCompletion.create.one({
          topicCompletionId: topicCompletion.id,
          model: task.model,
          prompt: JSON.stringify(task.prompt),
          completion: ChatCompletion.util.getFirstChoiceContent({
            from: response,
          }),
        }),
      });

      return QUESTION_COMPLETION_TASK.parse({
        endpoint: "chat completion",
        status: "complete",
        id: task.id,
        model: task.model,
        prompt: task.prompt,
        timestamp: Date.now(),
        numTokens:
          response.data.usage.prompt_tokens +
          response.data.usage.completion_tokens,
        response,
        metadata: task.metadata,
      });
    } catch (error) {
      try {
        const topicCompletion = TOPIC_COMPLETION.parse(
          forTopicCompletions.find(
            (tc) => tc.id === task.metadata.topicCompletionId
          )
        );
        await QuestionCompletionError.write.one.data({
          data: QuestionCompletionError.create.one({
            topicCompletionId: topicCompletion.id,
            message: JSON.stringify(error),
          }),
        });
      } catch (error) {
        local.red(JSON.stringify(error, null, 2));
      }
      throw error;
    }
  };

  const wrapper = async ({ task }: { task: z.infer<typeof TASK> }) => {
    try {
      const qt = QUESTION_COMPLETION_TASK.parse(task);
      return await processor({ task: qt });
    } catch (err) {
      throw err;
    }
  };

  await processTasks({ tasks, processor: wrapper, maxTokens: 500 });
};

const selectQuestionCompletions = async ({
  forPipelineId,
}: {
  forPipelineId: string;
}) => {
  return await QuestionCompletion.read.some.byPipelineId({
    pipelineId: forPipelineId,
  });
};

const PROCESSABLE_QUESTION = z.object({
  id: z.string(),
  text: z.string(),
  numTokens: z.number(),
});

export const generateEmbeddings = async ({
  forQuestionCompletions,
}: {
  forQuestionCompletions: ApiTypes.QuestionCompletion[];
}) => {
  const processableQuestions: z.infer<typeof PROCESSABLE_QUESTION>[] = [];
  for (const questionCompletion of forQuestionCompletions) {
    try {
      const questions = GenerateQuestionsFromTopic.completion.parse(
        questionCompletion.completion
      );
      for (const question of questions) {
        processableQuestions.push({
          id: questionCompletion.id,
          text: question,
          numTokens: embeddingEncoding.encode(question).length,
        });
      }
    } catch (error) {
      // todo
    }
  }

  const batches: z.infer<typeof RLE.EMBEDDINGS_BATCH>[] = [];
  for (const pq of processableQuestions) {
    if (batches.length === 0) {
      batches.push({
        numTokens: pq.numTokens,
        prompts: [pq],
      });
    } else {
      if (batches[batches.length - 1].numTokens + pq.numTokens > 8192) {
        batches.push({
          numTokens: pq.numTokens,
          prompts: [pq],
        });
      } else {
        batches[batches.length - 1].numTokens += pq.numTokens;
        batches[batches.length - 1].prompts.push(pq);
      }
    }
  }

  const tasks: z.infer<typeof RLE.TASK>[] = [];
  for (const batch of batches) {
    local.yellow(`Creating task with ${batch.numTokens} tokens`);
    tasks.push(
      RLE.TASK.parse({
        id: uuidv4(),
        endpoint: "embeddings",
        status: "idle",
        prompt: batch,
        timestamp: Date.now(),
        model: "text-embedding-ada-002",
        numTokens: 8192,
      })
    );
  }

  const processor = async ({ task }: { task: z.infer<typeof RLE.TASK> }) => {
    try {
      const response = await Embeddings.read.some.forTexts({
        textsToEmbed: task.prompt.prompts.map((p) => p.text),
        model: task.model,
        options: {
          timeout: 15000,
        },
      });

      const writeableEmbeddings = response.data.data.map((embeddingResult) => {
        const indexOfPrompt = embeddingResult.index;
        const embedding = embeddingResult.embedding;
        const questionCompletionId = task.prompt.prompts[indexOfPrompt].id;
        const questionCompletion = QUESTION_COMPLETION.parse(
          forQuestionCompletions.find((tc) => tc.id === questionCompletionId)
        );

        return KnowledgeEmbedding.create.one.data({
          questionCompletionId: questionCompletion.id,
          embedding: embedding,
        });
      });

      await KnowledgeEmbedding.write.some.data({ data: writeableEmbeddings });

      return RLE.TASK.parse({
        endpoint: "embeddings",
        status: "complete",
        id: task.id,
        model: task.model,
        prompt: task.prompt,
        timestamp: Date.now(),
        numTokens: response.data.usage.prompt_tokens,
      });
    } catch (error) {
      try {
        // TODO
        // const questionCompletion = QUESTION_COMPLETION.parse(
        //   forQuestionCompletions.find((tc) => tc.id === task.metadata.questionCompletionId)
        // );
        local.red(JSON.stringify(error, null, 2));
      } catch (error) {
        local.red(JSON.stringify(error, null, 2));
      }
      throw error;
    }
  };

  const wrapper = async ({ task }: { task: z.infer<typeof RLE.TASK> }) => {
    try {
      const rlet = RLE.TASK.parse(task);
      return await processor({ task: rlet });
    } catch (err) {
      throw err;
    }
  };

  await RLE.processEmbeddingsTasks({
    tasks,
    processor: wrapper,
  });
};

const retryErrors = async ({ inPipelineId }: { inPipelineId: string }) => {
  const sourceDocs = await SourceDoc.read.some.thatErrored({
    inPipelineId,
  });
  local.yellow(JSON.stringify(sourceDocs));

  for (const sourceDoc of sourceDocs) {
    await SourceDoc.delete.one.byId({ id: sourceDoc.id });
  }

  etl({
    fromUrl: "https://xmtp.org/",
    limit: 100,
    blacklist: [],
    whitelist: ["https://xmtp.org/built-with-xmtp"],
  });
};

// const pipelines = await Pipeline.read.all();
// for (const pipeline of pipelines) {
//   await Pipeline.delete.cascade.byId({
//     id: pipeline.id,
//   });
// }
// return;

const etl = async ({
  fromUrl,
  limit,
  blacklist,
  whitelist,
}: {
  fromUrl: string;
  limit: number;
  blacklist: string[];
  whitelist: string[];
}) => {
  // const questionCompletions = await selectQuestionCompletions({
  //   forPipelineId: "2c6d9623-1242-4108-b5de-e05f739112ff",
  // });

  // await generateEmbeddings({
  //   forQuestionCompletions: questionCompletions,
  // });

  try {
    console.time("BM");
    // const question = "I don't know what I want about a banana?";
    // const question = "I'd like to use XMTP, what should I do?";
    const question = "Has anyone built an XMTP application that uses OpenSea?";
    const embeddingResponse = await Embeddings.read.some.forTexts({
      textsToEmbed: [question],
      model: "text-embedding-ada-002",
      options: {
        timeout: 5000,
      },
    });
    const qe = QueryEmbedding.create.one.data({
      text: question,
      embedding: Embeddings.util.getEmbeddings({
        fromResponse: embeddingResponse,
      })[0],
    });

    await QueryEmbedding.write.some.data({ data: [qe] });

    const knowledge = await KnowledgeEmbedding.search.byQueryEmbeddingId({
      queryEmbeddingId: qe.id,
    });

    for (const k of knowledge) {
      local.yellow("distance: " + k.distance);
    }

    const sourceDocs = await Promise.all(
      knowledge.map(async (k) => {
        return await SourceDoc.read.one.byQuestionCompletionId({
          id: k.question_completion_id,
        });
      })
    );

    const doc = sourceDocs[0];

    const prompt = GenerateAnswerToQuestion.createPrompt({
      fromUrl: doc.page_url,
      question: question,
      fromTextBlob: doc.text_from_html,
    });

    const model = GenerateAnswerToQuestion.getModelForPrompt({
      prompt,
      maxTokens: 500,
    });

    if (model === null) {
      local.red(
        "No model found for prompt: " + JSON.stringify(prompt, null, 2)
      );
    } else {
      const questionCompletion = await ChatCompletion.read.one.forPrompt({
        prompt,
        model: "gpt-3.5-turbo",
        maxTokens: 500,
      });
      const answer = ChatCompletion.util.getFirstChoiceContent({
        from: questionCompletion,
      });
      local.blue("URL: " + doc.page_url);
      local.green("Question: " + question);
      local.green("Answer: " + answer);
    }
    console.timeEnd("BM");
  } catch (error) {
    local.red(JSON.stringify(error, null, 2));
  }

  // const pipelineId = await generateSourceDocs({
  //   fromUrl,
  //   blacklist,
  //   whitelist,
  //   limit,
  // });

  // local.green("Generated source docs for pipeline: " + pipelineId);

  // const sourceDocs = await selectSourceDocs({
  //   forPipelineId: pipelineId,
  //   whitelist: [],
  //   blacklist: [],
  // });

  // local.blue("Will generate topic completions for: " + sourceDocs.length);

  // await generateTopicCompletions({ forSourceDocs: sourceDocs });

  // local.green("Generated topic completions for pipeline" + pipelineId);

  // const topicCompletions = await selectTopicCompletions({
  //   forPipelineId: pipelineId,
  //   whitelist: [],
  //   blacklist: [],
  // });

  // local.blue(
  //   "Will generate question completions for " +
  //     topicCompletions.length +
  //     " topic completions in 10 seconds"
  // );

  // await new Promise((resolve) => setTimeout(resolve, 10000));

  // await generateQuestionCompletions({ forTopicCompletions: topicCompletions });

  // local.green("Generated question completions for pipeline" + pipelineId);
};

etl({
  fromUrl: "https://xmtp.org/docs",
  limit: Infinity,
  blacklist: [],
  whitelist: [],
});
