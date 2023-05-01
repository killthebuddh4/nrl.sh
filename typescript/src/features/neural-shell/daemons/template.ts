import { Shell, Daemon } from "../protocol.js";

/* ****************************************************************************
 *
 * NAME
 *
 * ***************************************************************************/

const NAME = `
template
`.trim();

/* ****************************************************************************
 *
 * FUNCTION
 *
 * ***************************************************************************/

const FUNCTION = `
The daemon's function.
`.trim();

/* ****************************************************************************
 *
 * INPUTS
 *
 * ***************************************************************************/

const INPUTS = [
  {
    key: "one",
    description: `
This is the first input.
`.trim(),
  },
  {
    key: "two",
    description: `
This is the second input.
`.trim(),
  },
];

/* ****************************************************************************
 *
 * OUTPUTS
 *
 * ***************************************************************************/

const OUTPUTS = [
  {
    key: "a",
    description: `
This is output a.
`.trim(),
  },
  {
    key: "b",
    description: `
This is output b.
`.trim(),
  },
];

/* ****************************************************************************
 *
 * EXEC
 *
 * ***************************************************************************/

const EXEC = async ({ shell }: { shell: Shell }) => {
  /* **************************************************************************
   * PARSE INPUTS
   * **************************************************************************/

  const inputs = shell.session[shell.session.length - 1].outputs;

  const one = inputs.find(({ key }) => key === "one");

  if (one === undefined) {
    throw new Error("First input not found");
  }

  const two = inputs.find(({ key }) => key === "two");

  if (two === undefined) {
    throw new Error("Second input not found");
  }

  /* **************************************************************************
   * GENERATE OUTPUTS
   * **************************************************************************/

  const a = await getOutputA({ one: one.value, two: two.value });
  const b = await getOutputB({ one: one.value, two: two.value });

  /* **************************************************************************
   * UPDATE SHELL
   * **************************************************************************/

  shell.session.push({
    daemon: NAME,
    outputs: [
      {
        key: "a",
        value: a,
      },
      {
        key: "b",
        value: b,
      },
    ],
  });
};

/* **************************************************************************
 * "SYSCALL"s
 * **************************************************************************/

const getOutputA = async ({ one, two }: { one: string; two: string }) => {
  return "a is " + one + two;
};

const getOutputB = async ({ one, two }: { one: string; two: string }) => {
  return "b is " + one + two;
};

/* ************************************************************************
 *
 * DAEMON
 *
 * ************************************************************************/

export const daemon: Daemon = {
  name: NAME,
  function: FUNCTION,
  inputs: INPUTS,
  outputs: OUTPUTS,
  exec: EXEC,
};
