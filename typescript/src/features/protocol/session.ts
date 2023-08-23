import { TextCompletion } from "../../apis/openai/api.js";
import { local } from "../../utils/chalk.js";
import { Session, Stage1, Stage2, Stage3, Stage4 } from "./protocol.js";

/* ****************************************************************************
 *
 * STAGE 1
 *
 * ****************************************************************************/

const stage1ToString = ({ stage1 }: { stage1: Stage1 }): string =>
  `
${stage1.prompt}
`.trim();

const isStage1String = ({ fromString }: { fromString: string }): boolean =>
  fromString.split("\n").length === 1 && fromString.split(" ").length === 1;

const stage1FromString = ({ fromString }: { fromString: string }): Stage1 => {
  return {
    prompt: fromString,
  };
};

/* ****************************************************************************
 *
 * STAGE 2
 *
 * ****************************************************************************/

const stage2ToString = ({ stage2 }: { stage2: Stage2 }): string =>
  `
${stage2.prompt} ${stage2.command}
`.trim();

const isStage2String = ({ fromString }: { fromString: string }): boolean =>
  fromString.split("\n").length === 1 && fromString.split(" ").length === 2;

const stage2FromString = ({ fromString }: { fromString: string }): Stage2 => {
  const [prompt, command] = fromString.split(" ");
  return {
    prompt,
    command,
  };
};

/* ****************************************************************************
 *
 * STAGE 3
 *
 * ****************************************************************************/

const stage3ToString = ({ stage3 }: { stage3: Stage3 }): string =>
  `
${stage3.prompt} ${stage3.command} ${stage3.params}
`.trim();

const isStage3String = ({ fromString }: { fromString: string }): boolean => {
  return (
    fromString.split("\n").length === 1 && fromString.split(" ").length > 2
  );
};

const stage3FromString = ({ fromString }: { fromString: string }): Stage3 => {
  const lines = fromString.split("\n");
  return {
    prompt: lines[0].split(" ")[0],
    command: lines[0].split(" ")[1],
    params: lines[0].split(" ").slice(2),
  };
};

/* ****************************************************************************
 *
 * STAGE 4
 *
 * ****************************************************************************/

const stage4ToString = ({ stage4 }: { stage4: Stage4 }): string =>
  `
${stage4.prompt} ${stage4.command} ${stage4.params}

${stage4.output}
`.trim();

const stage4FromString = ({ fromString }: { fromString: string }): Stage4 => {
  const lines = fromString.split("\n");
  return {
    prompt: lines[0].split(" ")[0],
    command: lines[0].split(" ")[1],
    params: lines[0].split(" ").slice(2),
    output: lines.slice(2).join("\n"),
  };
};

/* ****************************************************************************
 *
 * INIT
 *
 * ****************************************************************************/

const initToString = ({ init }: { init: Session["init"] }): string => init;

const initFromString = ({ fromString }: { fromString: string }): string =>
  fromString;

/* ****************************************************************************
 *
 * TAIL
 *
 * ****************************************************************************/

const tailToString = ({ tail }: { tail: Session["tail"] }): string => {
  return tail
    .map((stage4) => stage4ToString({ stage4 }))
    .join("\n\n")
    .trim();
};

const tailFromString = ({ fromString }: { fromString: string }): Stage4[] => {
  const lines = fromString.split("\n");
  const predicate = (line: string) => line.startsWith(CMDLINE_PREFIX);
  const tailStart = lines.findIndex(predicate);
  const tailEnd = findLastIndex({ lines, predicate });

  const tail: Stage4[] = [];
  for (
    let i = tailStart;
    i < tailEnd;
    i = getNextIndex({ lines, start: i, predicate })
  ) {
    const j = getNextIndex({ lines, start: i + 1, predicate });
    if (j !== -1) {
      const str = lines.slice(i, j).join("\n");
      tail.push(stage4FromString({ fromString: str }));
    }
  }

  return tail;
};

/* ****************************************************************************
 *
 * HEAD
 *
 * ****************************************************************************/

const headToString = ({ head }: { head: Session["head"] }): string => {
  if (head.command === undefined) {
    return stage1ToString({ stage1: head });
  }
  if (head.params === undefined) {
    return stage2ToString({ stage2: head });
  }
  if (head.output === undefined) {
    return stage3ToString({ stage3: head });
  }

  throw new Error("headToString: invalid head");
};

const headFromString = ({
  fromString,
}: {
  fromString: string;
}): Stage1 | Stage2 | Stage3 => {
  const lines = fromString.split("\n");
  const headIndex = findLastIndex({
    lines,
    predicate: (line) => line.startsWith(CMDLINE_PREFIX),
  });
  const headString = lines.slice(headIndex).join("\n").trim();

  if (isStage1String({ fromString: headString })) {
    return stage1FromString({ fromString: headString });
  }
  if (isStage2String({ fromString: headString })) {
    return stage2FromString({ fromString: headString });
  }
  if (isStage3String({ fromString: headString })) {
    return stage3FromString({ fromString: headString });
  }

  throw new Error("headFromString: invalid head");
};

/* ****************************************************************************
 *
 * SHELL
 *
 * ****************************************************************************/

export const sessionToString = ({ session }: { session: Session }): string =>
  `
${initToString({ init: session.init })}

${tailToString({ tail: session.tail })}

${headToString({ head: session.head })}
`.trim();

export const sessionFromString = ({
  fromString,
}: {
  fromString: string;
}): Session => {
  const lines = fromString.split("\n");
  const tailIndex = lines.findIndex((line) => line.startsWith(CMDLINE_PREFIX));
  const headIndex = findLastIndex({
    lines,
    predicate: (line) => line.startsWith(CMDLINE_PREFIX),
  });
  const initString = lines.slice(0, tailIndex).join("\n").trim();
  const tailString = lines.slice(tailIndex, headIndex).join("\n").trim();
  const headString = lines.slice(headIndex).join("\n").trim();

  const init = initFromString({ fromString: initString });
  const tail = tailFromString({ fromString: tailString });
  const head = headFromString({ fromString: headString });

  return {
    init,
    tail,
    head,
  };
};

/* ****************************************************************************
 *
 * ACTIONS
 *
 * ****************************************************************************/

export const printSession = ({ session }: { session: Session }): void => {
  const str = sessionToString({ session });
  const lines = str.split("\n");
  for (const line of lines) {
    if (line.startsWith(CMDLINE_PREFIX)) {
      local.green(line);
    } else {
      local.yellow(line);
    }
  }
};

export const Actions = {
  output: {
    gen: async ({ session }: { session: Session }) => {
      if (session.head.params === undefined) {
        throw new Error("Session.output.gen: head is not stage3");
      }

      const prompt = sessionToString({ session });

      const response = await TextCompletion.read.one.forPrompt({
        prompt,
        maxTokens: 2000,
        model: MODEL,
        temperature: 0.8,
        stop: [CMDLINE_PREFIX],
      });

      return TextCompletion.util.getCompletedText({
        fromPrompt: "",
        withResponse: response,
      });
    },

    push: ({ session, output }: { session: Session; output: string }) => {
      if (session.head.params === undefined) {
        throw new Error("Session.output.push: head is not stage3");
      }

      session.tail.push({
        ...session.head,
        output,
      });

      session.head = {
        prompt: session.head.prompt,
        command: undefined,
        params: undefined,
        output: undefined,
      };
    },

    pop: ({ session }: { session: Session }) => {
      if (session.head.command !== undefined) {
        throw new Error("Session.output.pop: head is not stage1");
      }

      const prev = session.tail[session.tail.length - 1];

      const tail = session.tail.slice(0, session.tail.length - 1);

      session.head = {
        prompt: prev.prompt,
        command: prev.command,
        params: prev.params,
        output: undefined,
      };

      session.tail = tail;
    },
  },

  params: {
    gen: async ({ session }: { session: Session }) => {
      if (
        session.head.command === undefined ||
        session.head.params !== undefined
      ) {
        throw new Error("Session.params.gen: head is not stage2");
      }

      const prompt = sessionToString({ session });

      const response = await TextCompletion.read.one.forPrompt({
        prompt,
        maxTokens: 2000,
        model: MODEL,
        temperature: 0.8,
        stop: ["\n"],
      });

      return TextCompletion.util
        .getCompletedText({
          fromPrompt: "",
          withResponse: response,
        })
        .split(" ");
    },

    push: ({ session, params }: { session: Session; params: string[] }) => {
      if (session.head.command === undefined) {
        throw new Error("Session.params.push: head is not stage2");
      }

      session.head = {
        prompt: session.head.prompt,
        command: session.head.command,
        params,
        output: undefined,
      };
    },

    pop: ({ session }: { session: Session }) => {
      if (
        session.head.command === undefined ||
        session.head.params === undefined
      ) {
        throw new Error("Session.params.pop: head is not stage3");
      }

      session.head = {
        prompt: session.head.prompt,
        command: session.head.command,
        params: undefined,
        output: undefined,
      };
    },
  },

  command: {
    gen: async ({ session }: { session: Session }) => {
      if (session.head.command !== undefined) {
        throw new Error("Session.command.gen: head is not stage1");
      }

      const prompt = sessionToString({ session });

      const response = await TextCompletion.read.one.forPrompt({
        prompt,
        maxTokens: 2000,
        model: MODEL,
        temperature: 0.8,
        stop: [" "],
      });

      return TextCompletion.util.getCompletedText({
        fromPrompt: "",
        withResponse: response,
      });
    },

    push: ({ session, command }: { session: Session; command: string }) => {
      if (session.head.command !== undefined) {
        throw new Error("Session.command.push: head is not stage1");
      }

      session.head = {
        prompt: session.head.prompt,
        command,
        params: undefined,
        output: undefined,
      };
    },

    pop: ({ session }: { session: Session }) => {
      if (session.head.command === undefined) {
        throw new Error("Session.command.pop: head is not stage2");
      }

      session.head = {
        prompt: session.head.prompt,
        command: undefined,
        params: undefined,
        output: undefined,
      };
    },
  },
};

/* ****************************************************************************
 *
 * UTIL
 *
 * ****************************************************************************/

const CMDLINE_PREFIX = "user@nrlsession>";
const MODEL = "text-davinci-003";

export const findLastIndex = ({
  lines,
  predicate,
}: {
  lines: string[];
  predicate: (line: string) => boolean;
}) => {
  for (let i = lines.length - 1; i >= 0; i--) {
    if (predicate(lines[i])) {
      return i;
    }
  }

  return -1;
};

const getNextIndex = ({
  lines,
  start,
  predicate,
}: {
  lines: string[];
  start: number;
  predicate: (s: string) => boolean;
}) => {
  for (let i = start + 1; i < lines.length; i++) {
    if (predicate(lines[i])) {
      return i;
    }
  }
  return -1;
};

/* ****************************************************************************
 *
 * EXEC
 *
 * ***************************************************************************/

export const exec = async ({ session }: { session: Session }) => {
  printSession({ session });

  const command = await Actions.command.gen({ session });

  Actions.command.push({ session, command });

  printSession({ session });

  const params = await Actions.params.gen({ session });

  Actions.params.push({ session, params });

  printSession({ session });

  const output = await Actions.output.gen({ session });

  Actions.output.push({ session, output });

  printSession({ session });
};
