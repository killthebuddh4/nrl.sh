import { local } from "./chalk.js";

export const SUPABASE = Symbol("SUPABASE");
export const OPENAI = Symbol("OPENAI");
export type ApiError = typeof SUPABASE | typeof OPENAI;

export const isBrandedWith = ({
  brand,
  valToCheck,
}: {
  brand: symbol;
  valToCheck: unknown;
}) => {
  if (typeof valToCheck !== "object" || valToCheck === null) {
    return false;
  } else {
    return (valToCheck as { brand: symbol }).brand === brand;
  }
};

export const isBranded = (val: unknown): val is BrandedError => {
  return (
    isBrandedWith({ brand: OPENAI, valToCheck: val }) ||
    isBrandedWith({ brand: OPENAI, valToCheck: val })
  );
};

export type BrandedError = { brand: symbol; error: unknown };

export const debug = ({
  brand,
  tag,
  stackTraceMatcher,
}: {
  brand: symbol;
  tag: string;
  stackTraceMatcher: RegExp;
}): ((err: unknown) => BrandedError) => {
  return (err: unknown) => {
    if (isBranded(err)) {
      return err;
    }

    if (!(err instanceof Error)) {
      local.red(Array(80).fill("-").join(""));
      local.red(tag);
      local.red(JSON.stringify(err, null, 2));
      local.red(Array(80).fill("-").join(""));
      return { brand, error: err };
    }

    if (err.stack === undefined) {
      local.red(Array(80).fill("-").join(""));
      local.red(tag);
      local.red(JSON.stringify(err, null, 2));
      local.red(Array(80).fill("-").join(""));
      return { brand, error: err };
    }

    const relevantFile = err.stack.split("\n").find((line) => {
      return line.match(stackTraceMatcher) !== null;
    });

    local.red(Array(80).fill("-").join(""));
    local.red(tag);
    if (relevantFile !== undefined) {
      local.green(relevantFile);
    }
    local.red(JSON.stringify(err, null, 2));
    local.red(Array(80).fill("-").join(""));
    return { brand, error: err };
  };
};
