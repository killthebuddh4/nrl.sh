import { local } from "../../utils/chalk.js";
import { Shell, Log } from "./protocol.js";
import { TextCompletion } from "../../apis/openai/api.js";

/* ****************************************************************************
 *
 * CONFIG
 *
 * ****************************************************************************/

const CMDLINE_PREFIX = "user@nrlshell>";
const OUTPUT_DELIM = "***";
const OUTPUT_HEADER_PREFIX = OUTPUT_DELIM + "BEGIN";
const OUTPUT_FOOTER_PREFIX = OUTPUT_DELIM + "END";
const MODEL = "text-davinci-003";

/* ****************************************************************************
 *
 * (DE)SERIALIZIZE
 *
 * ****************************************************************************/

export const outputToString = ({
  key,
  value,
}: {
  key: string;
  value: string;
}) =>
  `
${OUTPUT_HEADER_PREFIX}${key}${OUTPUT_DELIM}

${value}

${OUTPUT_FOOTER_PREFIX}${key}${OUTPUT_DELIM}
`.trim();

export const outputFromString = ({
  fromString,
}: {
  fromString: string;
}): { key: string; value: string } => {
  const lines = fromString.split("\n");
  const key = getOutputKey({ fromHeader: lines[0] });
  const value = lines.slice(2, lines.length - 2).join("\n");
  return { key, value };
};

const outputsToString = ({ fromLog }: { fromLog: Log }): string => {
  if (fromLog.outputs === undefined) {
    return "";
  } else {
    return fromLog.outputs
      .map((output) => {
        return outputToString(output);
      })
      .join("\n\n");
  }
};

const outputsFromString = ({
  fromString,
}: {
  fromString: string;
}): { key: string; value: string }[] => {
  const lines = fromString.split("\n");

  const getNextOutputIndex = (start: number) => {
    for (let i = start + 1; i < lines.length; i++) {
      if (lines[i].startsWith(OUTPUT_DELIM)) {
        return i;
      }
    }
    return -1;
  };

  const outputs: { key: string; value: string }[] = [];

  for (let i = getNextOutputIndex(-1); i !== -1; i = getNextOutputIndex(i)) {
    const j = getNextOutputIndex(i);
    const key = getOutputKey({ fromHeader: lines[i] });
    const value = lines.slice(i + 1, j).join("\n");
    outputs.push({ key, value });
  }

  return outputs;
};

export const logToString = ({ log }: { log: Log }): string => {
  const outputs = outputsToString({ fromLog: log });
  return `
${CMDLINE_PREFIX} ${log.daemon}

${outputs}
`.trim();
};

export const logFromString = ({ fromString }: { fromString: string }): Log => {
  const lines = fromString.split("\n");

  const daemon = lines[0].slice(CMDLINE_PREFIX.length + 1);
  const outputs = outputsFromString({ fromString: lines.slice(1).join("\n") });

  return { daemon, outputs };
};

export const sessionToString = ({ shell }: { shell: Shell }) => {
  return shell.session
    .map((log) => {
      logToString({ log });
    })
    .join("\n\n");
};

export const sessionFromString = ({
  fromString,
}: {
  fromString: string;
}): Log[] => {
  const lines = fromString.split("\n");

  const getNextCommandIndex = (start: number) => {
    for (let i = start + 1; i < lines.length; i++) {
      if (lines[i].startsWith(CMDLINE_PREFIX)) {
        return i;
      }
    }
    return -1;
  };

  const logs: Log[] = [];

  for (let i = getNextCommandIndex(-1); i !== -1; i = getNextCommandIndex(i)) {
    const j = getNextCommandIndex(i);
    logs.push(logFromString({ fromString: lines.slice(i, j).join("\n") }));
  }

  return logs;
};

export const printSession = ({ session }: { session: string }) => {
  const lines = session.split("\n");
  for (const line of lines) {
    if (line.startsWith(CMDLINE_PREFIX)) {
      local.green(line);
    } else {
      local.yellow(line);
    }
  }
};

/* ****************************************************************************
 *
 * COMMAND PROMPT
 *
 * ****************************************************************************/

export const pushLeadCommand = ({ toBase }: { toBase: string }) =>
  `
${toBase.trim()}

${CMDLINE_PREFIX}
`.trim();

export const popLeadCommand = ({ fromBase }: { fromBase: string }) => {
  const lines = fromBase.split("\n");
  const lastSessionIndex = findLastIndex({
    lines,
    predicate: (line) => line.startsWith(CMDLINE_PREFIX),
  });

  if (lastSessionIndex === -1) {
    throw new Error("No command to pop");
  }

  return lines.slice(0, lastSessionIndex).join("\n");
};

export const peekCommand = ({ fromBase }: { fromBase: string }) => {
  const lines = fromBase.split("\n");
  const lastSessionIndex = findLastIndex({
    lines,
    predicate: (line) => line.startsWith(CMDLINE_PREFIX),
  });

  if (lastSessionIndex === -1) {
    throw new Error("No command to peek");
  }

  const line = lines[lastSessionIndex];

  // the 3 here will fail if we have any very short (1-2 char) commands.
  // we use 3 because I think the LM will sometimes add extra spaces before
  // the command.
  if (line.length <= CMDLINE_PREFIX.length + 3) {
    return null;
  }

  return lines[lastSessionIndex].slice(CMDLINE_PREFIX.length).trim();
};

export const popCommand = ({ fromBase }: { fromBase: string }) => {
  const lines = fromBase.split("\n");
  const lastSessionIndex = findLastIndex({
    lines,
    predicate: (line) => line.startsWith(CMDLINE_PREFIX),
  });

  if (lastSessionIndex === -1) {
    throw new Error("No command to pop");
  }

  lines[lastSessionIndex] = CMDLINE_PREFIX;

  return lines.slice(0, lastSessionIndex + 1).join("\n");
};

export const pushCompleteCommand = async ({
  fromBase,
}: {
  fromBase: string;
}) => {
  const completion = await TextCompletion.read.one.forPrompt({
    prompt: fromBase,
    maxTokens: 2000,
    model: MODEL,
    temperature: 0.8,
    stop: [OUTPUT_HEADER_PREFIX],
  });

  const session = TextCompletion.util.getCompletedText({
    fromPrompt: fromBase,
    withResponse: completion,
  });

  const lines = session.split("\n");
  const lastSessionIndex = findLastIndex({
    lines,
    predicate: (line) => line.startsWith(CMDLINE_PREFIX),
  });

  return lines.slice(lastSessionIndex + 1).join("\n");
};

/* ****************************************************************************
 *
 * OUTPUTS
 *
 * ****************************************************************************/

export const getOutputKey = ({ fromHeader }: { fromHeader: string }) => {
  const startKeyIndex = OUTPUT_HEADER_PREFIX.length;
  const endKeyIndex = fromHeader.length - OUTPUT_DELIM.length;
  return fromHeader.slice(startKeyIndex, endKeyIndex);
};

export const getOutputHeader = ({ fromKey }: { fromKey: string }) =>
  `
${OUTPUT_HEADER_PREFIX}${fromKey}${OUTPUT_DELIM}
`.trim();

export const getOutputFooter = ({ fromKey }: { fromKey: string }) =>
  `
${OUTPUT_FOOTER_PREFIX}${fromKey}${OUTPUT_DELIM}
`.trim();

export const pushLeadOutput = ({
  toBase,
  fromKey,
}: {
  toBase: string;
  fromKey: string;
}) =>
  `
${toBase.trim()}

${getOutputHeader({ fromKey }).trim()}
`.trim();

export const peekLeadOutput = ({ fromBase }: { fromBase: string }) => {
  const lines = fromBase.split("\n");
  const lastOutputIndex = findLastIndex({
    lines,
    predicate: (line) => line.startsWith(OUTPUT_HEADER_PREFIX),
  });

  if (lastOutputIndex === -1) {
    return null;
  }

  const line = lines[lastOutputIndex];
  return getOutputKey({ fromHeader: line });
};

export const popLeadOutput = ({ fromBase }: { fromBase: string }) => {
  const lines = fromBase.split("\n");
  const lastOutputIndex = findLastIndex({
    lines,
    predicate: (line) => line.startsWith(OUTPUT_HEADER_PREFIX),
  });
  return lines.slice(0, lastOutputIndex).join("\n");
};

export const pushCompleteOutput = async ({
  fromBase,
}: {
  fromBase: string;
}) => {
  const outputKey = peekLeadOutput({ fromBase });
  if (outputKey === null) {
    throw new Error("No output to complete");
  }
  const outputFooter = getOutputFooter({ fromKey: outputKey });

  const completion = await TextCompletion.read.one.forPrompt({
    prompt: fromBase,
    maxTokens: 2000,
    model: MODEL,
    temperature: 0.8,
    stop: [outputFooter],
  });

  const resultSession = TextCompletion.util.getCompletedText({
    fromPrompt: fromBase,
    withResponse: completion,
  });

  return `
${resultSession.trim()}

${outputFooter.trim()}
`.trim();
};

export const popCompletedOutput = ({ fromBase }: { fromBase: string }) => {
  const lines = fromBase.split("\n");
  const lastOutputIndex = findLastIndex({
    lines,
    predicate: (line) => line.startsWith(OUTPUT_HEADER_PREFIX),
  });
  return lines.slice(0, lastOutputIndex).join("\n");
};

export const peekCompletedOutput = ({ fromBase }: { fromBase: string }) => {
  const lines = fromBase.split("\n");
  const lastOutputIndex = findLastIndex({
    lines,
    predicate: (line) => line.startsWith(OUTPUT_HEADER_PREFIX),
  });
  const lastOutputFooterIndex = findLastIndex({
    lines,
    predicate: (line) => line.startsWith(OUTPUT_FOOTER_PREFIX),
  });

  if (lastOutputIndex === -1 || lastOutputFooterIndex === -1) {
    return null;
  }

  return lines.slice(lastOutputIndex, lastOutputFooterIndex + 1).join("\n");
};

/* ****************************************************************************
 *
 * LOGS
 *
 * ****************************************************************************/

export const popLog = ({ fromBase }: { fromBase: string }) => {
  const lines = fromBase.split("\n");
  const lastSessionIndex = findLastIndex({
    lines,
    predicate: (line) => line.startsWith(CMDLINE_PREFIX),
  });
  return lines.slice(0, lastSessionIndex).join("\n");
};

/* ****************************************************************************
 *
 * UTIL
 *
 * ****************************************************************************/

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
