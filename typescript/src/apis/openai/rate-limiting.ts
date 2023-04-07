import { z } from "zod";
import { local } from "../../utils/chalk.js";
import {
  CHAT_COMPLETION_MESSAGE,
  CHAT_COMPLETION_REQUEST,
  ChatCompletion,
} from "./api.js";
import chalk from "chalk";

/* ****************************************************************************
 *
 * DATA TYPES AND CONSTANTS
 *
 * ****************************************************************************/

const ALLOWED_TOKENS_PER_MINUTE = 90000;

const MAX_PENDING_TASKS = 20;

const MODEL = z.enum(["gpt-4", "gpt-3.5-turbo"]);

const PRICE_PER_TOKEN = {
  "gpt-4": 0.000045,
  "gpt-3.5-turbo": 0.000002,
};

export type Model = z.infer<typeof MODEL>;

const TASK_STATUS = z.enum(["idle", "pending", "complete", "error"]);

export const TASK = z.object({
  id: z.string(),
  status: TASK_STATUS,
  timestamp: z.number(),
  prompt: z.array(CHAT_COMPLETION_MESSAGE),
  model: MODEL,
  endpoint: z.literal("chat completion"),
  numTokens: z.number(),
});

export const PROCESSED_QUEUE = z.array(TASK).superRefine((val, ctx) => {
  const numIdleTasks = getCurrentTasks({ tasks: val, byStatus: "idle" }).length;
  const numPendingTasks = getCurrentTasks({
    tasks: val,
    byStatus: "pending",
  }).length;
  if (numIdleTasks + numPendingTasks > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `There are ${numIdleTasks} idle tasks and ${numPendingTasks} pending tasks.`,
    });
  }
});

export const IDLE_QUEUE = z.array(TASK).superRefine((val, ctx) => {
  const numIdleTasks = getCurrentTasks({ tasks: val, byStatus: "idle" }).length;
  if (numIdleTasks === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `There are no idle tasks.`,
    });
  }
});

export const AVAILABLE_QUEUE = z.array(TASK).superRefine((val, ctx) => {
  const tasks = getCurrentTasks({ tasks: val });
  const totalPendingUsage = getUsage({ tasks, since: 0, byStatus: "pending" });
  if (totalPendingUsage > ALLOWED_TOKENS_PER_MINUTE) {
    const message = `The queue is being spammed. Pending usage: ${totalPendingUsage}`;
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message,
    });
  }

  const recentPendingUsage = getUsage({
    tasks,
    since: Date.now() - 20 * 1000,
    byStatus: "pending",
  });
  if (recentPendingUsage > ALLOWED_TOKENS_PER_MINUTE / (60 / 20)) {
    const message = `The queue is being spammed. Pending usage: ${recentPendingUsage}`;
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message,
    });
  }

  const recentCompleteUsage = getUsage({
    tasks,
    since: Date.now() - 60 * 1000,
    byStatus: "complete",
  });
  if (recentCompleteUsage > ALLOWED_TOKENS_PER_MINUTE) {
    const message = `The queue is being spammed. Complete usage: ${recentCompleteUsage}`;
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message,
    });
  }

  const veryRecentCompletedUsage = getUsage({
    tasks,
    since: Date.now() - 20 * 1000,
    byStatus: "complete",
  });
  if (veryRecentCompletedUsage > ALLOWED_TOKENS_PER_MINUTE / (60 / 20)) {
    const message = `The queue is being spammed. Complete usage: ${veryRecentCompletedUsage}`;
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message,
    });
  }

  const pendingTasks = getCurrentTasks({ tasks, byStatus: "pending" });
  if (pendingTasks.length >= MAX_PENDING_TASKS) {
    const message = `The queue is full. Pending tasks: ${pendingTasks.length}`;
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message,
    });
  }
});

export const printStatusLine = ({ forQueue }: { forQueue: typeof QUEUE }) => {
  const tasks = getCurrentTasks({ tasks: forQueue });
  const task = getMostRecentTask({ tasks });

  const isHeartbeat = Date.now() - task.timestamp > 1000;

  const gpt3Usage = getUsage({
    tasks,
    since: 0,
    forModel: "gpt-3.5-turbo",
    byStatus: "complete",
  });
  const gpt4Usage = getUsage({
    tasks,
    since: 0,
    forModel: "gpt-4",
    byStatus: "complete",
  });

  const fields: Array<[string, number | null]> = [
    ["idle tasks", getCurrentTasks({ tasks, byStatus: "idle" }).length],
    ["pending tasks", getCurrentTasks({ tasks, byStatus: "pending" }).length],
    [
      "completed tasks",
      getCurrentTasks({ tasks, byStatus: "complete" }).length,
    ],
    ["errored tasks", getCurrentTasks({ tasks, byStatus: "error" }).length],
    ["idle usage", getUsage({ tasks, since: 0, byStatus: "idle" })],
    ["pending usage", getUsage({ tasks, since: 0, byStatus: "pending" })],
    [
      "recent usage",
      getUsage({ tasks, since: Date.now() - 60 * 1000, byStatus: "complete" }),
    ],
    ["gpt 4 usage", gpt4Usage],
    ["gpt 4 $$$", gpt4Usage * PRICE_PER_TOKEN["gpt-4"]],
    ["gpt 3 usage", gpt3Usage],
    ["gpt 3 $$$", gpt3Usage * PRICE_PER_TOKEN["gpt-3.5-turbo"]],
    ["elapsed time", getElapsedTime({ tasks })],
    ["rate", getTokensPerSecond({ tasks })],
  ];
  const shouldHighlight = (field: [string, number | null]) => {
    return isHeartbeat
      ? field[0] === "pending usage" || field[0] === "recent usage"
      : (field[0].includes("idle") && task.status === "idle") ||
          (field[0].includes("pending") && task.status === "pending") ||
          (field[0].includes("complete") && task.status === "complete") ||
          (field[0].includes("error") && task.status === "error");
  };

  local.blue(
    fields
      .map((field) => {
        if (shouldHighlight(field)) {
          return chalk.yellow(field[0].toString().padEnd(20));
        } else {
          return field[0].toString().padEnd(20);
        }
      })
      .join(" | ")
  );

  local.blue(
    fields
      .map((field) => {
        if (shouldHighlight(field)) {
          return chalk.yellow(
            `${field[1]}`.slice(0, 15).toString().padStart(20)
          );
        } else {
          return `${field[1]}`.slice(0, 15).toString().padStart(20);
        }
      })
      .join(" | ")
  );
};

export const QUEUE: z.infer<typeof TASK>[] = [];

/* ****************************************************************************
 *
 * ACTIONS
 *
 * ****************************************************************************/

export const setTask = ({
  task,
  tasks,
}: {
  tasks: typeof QUEUE;
  task: z.infer<typeof TASK>;
}) => {
  tasks.push(task);
};

export const getTask = ({
  tasks,
  taskId,
}: {
  tasks: typeof QUEUE;
  taskId: string;
}) => {
  for (let i = tasks.length - 1; i >= 0; i--) {
    if (tasks[i].id === taskId) {
      return tasks[i];
    }
  }
  return null;
};

export const getElapsedTime = ({ tasks }: { tasks: typeof QUEUE }) => {
  if (tasks.length === 0) {
    return null;
  } else {
    return Date.now() - getFirstTask({ tasks }).timestamp;
  }
};

export const getFirstTask = ({ tasks }: { tasks: typeof QUEUE }) => {
  return tasks[0];
};

export const getMostRecentTask = ({ tasks }: { tasks: typeof QUEUE }) => {
  return tasks[tasks.length - 1];
};

export const getCurrentTasks = ({
  tasks,
  byStatus,
}: {
  tasks: typeof QUEUE;
  byStatus?: z.infer<typeof TASK_STATUS>;
}) => {
  const results: typeof QUEUE = [];
  for (let i = 0; i < tasks.length; i++) {
    let hasMoreRecentState = false;
    for (let j = i + 1; j < tasks.length; j++) {
      if (tasks[i].id === tasks[j].id) {
        hasMoreRecentState = true;
      }
    }
    if (!hasMoreRecentState) {
      results.push(tasks[i]);
    }
  }
  return results.filter((u) => (byStatus ? u.status === byStatus : true));
};

export const getUsage = ({
  tasks,
  since,
  forModel,
  byStatus,
}: {
  tasks: typeof QUEUE;
  since: number;
  forModel?: Model;
  byStatus: z.infer<typeof TASK_STATUS>;
}) => {
  return tasks
    .filter((u) => u.timestamp > since)
    .filter((u) => (forModel ? u.model === forModel : true))
    .filter((u) => u.status === byStatus)
    .reduce((acc, u) => acc + u.numTokens, 0);
};

export const getTokensPerSecond = ({ tasks }: { tasks: typeof QUEUE }) => {
  const elapsedTime = getElapsedTime({ tasks });
  if (elapsedTime === null) {
    return null;
  } else {
    return (
      getUsage({ tasks, since: 0, byStatus: "complete" }) / (elapsedTime / 1000)
    );
  }
};

/* ****************************************************************************
 *
 * EXECUTION
 *
 * ****************************************************************************/

const sleep = async ({ forMs }: { forMs: number }) => {
  await new Promise((resolve) => setTimeout(resolve, forMs));
};

export const processTasks = async ({
  tasks,
  processor,
}: {
  processor: ({
    task,
  }: {
    task: z.infer<typeof TASK>;
  }) => Promise<z.infer<typeof TASK>>;
  tasks: z.infer<typeof TASK>[];
  maxTokens: number;
}) => {
  while (!PROCESSED_QUEUE.safeParse(tasks).success) {
    await sleep({ forMs: 100 });

    printStatusLine({ forQueue: tasks });

    if (!AVAILABLE_QUEUE.safeParse(tasks).success) {
      continue;
    } else if (!IDLE_QUEUE.safeParse(tasks).success) {
      continue;
    } else {
      const idleTasks = getCurrentTasks({ tasks, byStatus: "idle" });
      const oldestTask = getFirstTask({ tasks: idleTasks });
      (async () => {
        setTask({
          tasks,
          task: {
            endpoint: "chat completion",
            status: "pending",
            id: oldestTask.id,
            model: oldestTask.model,
            prompt: oldestTask.prompt,
            timestamp: Date.now(),
            numTokens: oldestTask.numTokens,
          },
        });
        try {
          const task = await processor({ task: oldestTask });
          setTask({ tasks, task });
        } catch {
          setTask({
            tasks,
            task: {
              endpoint: "chat completion",
              status: "error",
              id: oldestTask.id,
              model: oldestTask.model,
              prompt: oldestTask.prompt,
              timestamp: Date.now(),
              numTokens: 0,
            },
          });
        }
      })();
    }
  }
};

export const chatCompletion = async ({
  req: { prompt, maxTokens, model },
  tracking: { id, onTaskComplete, onTaskError, onTaskPending },
}: {
  req: z.infer<typeof CHAT_COMPLETION_REQUEST>;
  tracking: {
    id: string;
    onTaskPending?: () => void;
    onTaskComplete?: () => void;
    onTaskError?: () => void;
  };
}) => {
  setTask({
    tasks: QUEUE,
    task: {
      endpoint: "chat completion",
      status: "idle",
      id,
      model,
      prompt,
      timestamp: Date.now(),
      numTokens: ChatCompletion.util.approxTokens({
        forRequest: { prompt, maxTokens, model },
      }),
    },
  });

  while (!AVAILABLE_QUEUE.safeParse(QUEUE).success) {
    await sleep({ forMs: 3000 + Math.random() * 1000 });
  }

  setTask({
    tasks: QUEUE,
    task: {
      endpoint: "chat completion",
      status: "pending",
      id,
      model,
      prompt,
      timestamp: Date.now(),
      numTokens: ChatCompletion.util.approxTokens({
        forRequest: { prompt, maxTokens, model },
      }),
    },
  });

  try {
    onTaskPending && onTaskPending();

    const response = await ChatCompletion.read.one.forPrompt({
      prompt,
      maxTokens,
      model,
      options: {
        timeout: 15000,
      },
    });

    setTask({
      tasks: QUEUE,
      task: {
        endpoint: "chat completion",
        status: "complete",
        id,
        model,
        prompt,
        timestamp: Date.now(),
        numTokens:
          response.data.usage.prompt_tokens +
          response.data.usage.completion_tokens,
      },
    });

    onTaskComplete && onTaskComplete();

    return response;
  } catch (e) {
    onTaskError && onTaskError();

    setTask({
      tasks: QUEUE,
      task: {
        endpoint: "chat completion",
        status: "error",
        id,
        prompt,
        model,
        timestamp: Date.now(),
        numTokens: 0,
      },
    });

    throw e;
  }
};
