import { Shell } from "../protocol.js";

export const NAME = `
template
`.trim();

export const FUNCTION = `
The daemon's function.
`.trim();

export const INPUTS = [
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

export const OUTPUTS = [
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

export const EXEC = async ({ root }: { root: Shell }) => {
  /* ************************************************************************
   * PARSE INPUTS
   * ************************************************************************/

  const inputs = root.session[root.session.length - 1].outputs;

  const one = inputs.find(({ key }) => key === "one");

  if (one === undefined) {
    throw new Error("First input not found");
  }

  const two = inputs.find(({ key }) => key === "two");

  if (two === undefined) {
    throw new Error("Second input not found");
  }

  /* ************************************************************************
   * GENERATE OUTPUTS
   * ************************************************************************/

  const a = await getOutputA({ one: one.value, two: two.value });
  const b = await getOutputB({ one: one.value, two: two.value });

  /* ************************************************************************
   * UPDATE SHELL
   * ************************************************************************/

  root.session.push({
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

/* ************************************************************************
 * SYSCALLS
 * ************************************************************************/

export const getOutputA = async ({
  one,
  two,
}: {
  one: string;
  two: string;
}) => {
  return "a is " + one + two;
};

export const getOutputB = async ({
  one,
  two,
}: {
  one: string;
  two: string;
}) => {
  return "b is " + one + two;
};
