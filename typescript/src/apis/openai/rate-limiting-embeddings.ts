import { z } from "zod";
import { local } from "../../utils/chalk.js";
import chalk from "chalk";

/* ****************************************************************************
 *
 * DATA TYPES AND CONSTANTS
 *
 * ****************************************************************************/

const ALLOWED_TOKENS_PER_MINUTE = 350000;

const MAX_PENDING_TASKS = 20;

const PRICE_PER_TOKEN = {
  "gpt-4": 0.000045,
  "gpt-3.5-turbo": 0.000002,
  "text-embedding-ada-002": 0.0000004,
};

const TASK_STATUS = z.enum(["idle", "pending", "complete", "error"]);

export const TRACKED_SOURCE_TEXT = z.object({
  id: z.string(),
  text: z.string(),
});

export const EMBEDDINGS_BATCH = z.object({
  numTokens: z.number().max(8192),
  prompts: z.array(TRACKED_SOURCE_TEXT),
});

export const TASK = z.object({
  id: z.string(),
  status: TASK_STATUS,
  timestamp: z.number(),
  prompt: EMBEDDINGS_BATCH,
  model: z.literal("text-embedding-ada-002"),
  endpoint: z.literal("embeddings"),
  numTokens: z.number(),
});

export const isProcessed = ({ tasks }: { tasks: z.infer<typeof TASK>[] }) => {
  const numIdleTasks = getCurrentTasks({ tasks, byStatus: "idle" }).length;
  const numPendingTasks = getCurrentTasks({
    tasks,
    byStatus: "pending",
  }).length;
  return numIdleTasks + numPendingTasks === 0;
};

export const isAvailable = ({ tasks }: { tasks: z.infer<typeof TASK>[] }) => {
  const currentTasks = getCurrentTasks({ tasks });
  const totalPendingUsage = getUsage({
    tasks: currentTasks,
    since: 0,
    byStatus: "pending",
  });
  if (totalPendingUsage > ALLOWED_TOKENS_PER_MINUTE) {
    return false;
  }

  const recentPendingUsage = getUsage({
    tasks: currentTasks,
    since: Date.now() - 20 * 1000,
    byStatus: "pending",
  });
  if (recentPendingUsage > ALLOWED_TOKENS_PER_MINUTE / (60 / 20)) {
    return false;
  }

  const recentCompleteUsage = getUsage({
    tasks: currentTasks,
    since: Date.now() - 60 * 1000,
    byStatus: "complete",
  });
  if (recentCompleteUsage > ALLOWED_TOKENS_PER_MINUTE) {
    return false;
  }

  const veryRecentCompletedUsage = getUsage({
    tasks: currentTasks,
    since: Date.now() - 20 * 1000,
    byStatus: "complete",
  });
  if (veryRecentCompletedUsage > ALLOWED_TOKENS_PER_MINUTE / (60 / 20)) {
    return false;
  }

  const numPendingTasks = getCurrentTasks({
    tasks,
    byStatus: "pending",
  }).length;
  if (numPendingTasks >= MAX_PENDING_TASKS) {
    return false;
  }

  return true;
};

export const printStatusLine = ({ forQueue }: { forQueue: typeof QUEUE }) => {
  const tasks = getCurrentTasks({ tasks: forQueue });
  const task = getMostRecentTask({ tasks });

  const isHeartbeat = Date.now() - task.timestamp > 1000;

  const usage = getUsage({
    tasks,
    since: 0,
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
    ["usage", usage],
    ["usage $$$", usage * PRICE_PER_TOKEN["text-embedding-ada-002"]],
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
  byStatus,
}: {
  tasks: typeof QUEUE;
  since: number;
  byStatus: z.infer<typeof TASK_STATUS>;
}) => {
  return tasks
    .filter((u) => u.timestamp > since)
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

export const processEmbeddingsTasks = async ({
  tasks,
  processor,
}: {
  processor: ({
    task,
  }: {
    task: z.infer<typeof TASK>;
  }) => Promise<z.infer<typeof TASK>>;
  tasks: z.infer<typeof TASK>[];
}) => {
  while (!isProcessed({ tasks })) {
    await sleep({ forMs: 1000 });

    printStatusLine({ forQueue: tasks });

    if (!isAvailable({ tasks })) {
      continue;
    } else {
      const idleTasks = getCurrentTasks({ tasks, byStatus: "idle" });
      const oldestTask = getFirstTask({ tasks: idleTasks });
      if (oldestTask === undefined) {
        continue;
      }
      (async () => {
        setTask({
          tasks,
          task: {
            endpoint: "embeddings",
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
              endpoint: "embeddings",
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
