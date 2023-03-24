import { encode } from "gpt-3-encoder";

export const tokenLength = (text: string): number => {
  try {
    return encode(text).length;
  } catch {
    return 0;
  }
};

export const reduce_chunk_size = (
  tokenizer: (text: string) => number,
  separator: string,
  chunkSize: number,
  startIdx: number,
  curIdx: number,
  splits: string[]
): number => {
  let current_doc_total = tokenizer(
    splits.slice(startIdx, curIdx).join(separator)
  );
  while (current_doc_total > chunkSize) {
    const percent_to_reduce =
      (current_doc_total - chunkSize) / current_doc_total;
    const num_to_reduce =
      Math.floor(percent_to_reduce * (curIdx - startIdx)) + 1;
    curIdx -= num_to_reduce;
    current_doc_total = tokenizer(
      splits.slice(startIdx, curIdx).join(separator)
    );
  }
  return curIdx;
};

const processSplits = (
  splits: string[],
  tokenizer: (text: string) => number,
  chunkSize: number,
  backupSeparators: string[] | undefined
): string[] => {
  const newSplits: string[] = [];
  for (const split of splits) {
    const numCurTokens = tokenizer(split);
    if (numCurTokens <= chunkSize) {
      newSplits.push(split);
    } else {
      let curSplits: string[] = [];
      if (backupSeparators) {
        for (let sep of backupSeparators) {
          if (split.includes(sep)) {
            curSplits = split.split(sep);
            break;
          }
        }
      } else {
        curSplits = [split];
      }

      const curSplits2: string[] = [];
      for (const curSplit of curSplits) {
        const numCurTokens = tokenizer(curSplit);
        if (numCurTokens <= chunkSize) {
          curSplits2.push(curSplit);
        } else {
          const curSplitChunks = [];
          for (let i = 0; i < curSplit.length; i += chunkSize) {
            curSplitChunks.push(curSplit.substring(i, i + chunkSize));
          }
          curSplits2.push(...curSplitChunks);
        }
      }
      newSplits.push(...curSplits2);
    }
  }
  return newSplits;
};

export const splitText = (
  text: string,
  separator = " ",
  chunk_size = 750,
  chunk_overlap = 200,
  tokenizer: (text: string) => number = tokenLength,
  backupSeparators: string[] = ["\n"]
): string[] => {
  if (text === "") {
    return [];
  }

  let splits = text.split(separator);
  splits = processSplits(splits, tokenizer, chunk_size, backupSeparators);

  const docs = [];

  let start_idx = 0;
  let cur_idx = 0;
  let cur_total = 0;
  while (cur_idx < splits.length) {
    let cur_token = splits[cur_idx];
    let num_cur_tokens = Math.max(tokenizer(cur_token), 1);
    if (num_cur_tokens > chunk_size) {
      throw new Error(
        "A single term is larger than the allowed chunk size.\n" +
          `Term size: ${num_cur_tokens}\n` +
          `Chunk size: ${chunk_size}`
      );
    }

    if (cur_total + num_cur_tokens > chunk_size) {
      cur_idx = reduce_chunk_size(
        tokenizer,
        separator,
        chunk_size,
        start_idx,
        cur_idx,
        splits
      );
      docs.push(splits.slice(start_idx, cur_idx).join(separator));

      while (cur_total > chunk_overlap) {
        const cur_num_tokens = Math.max(tokenizer(splits[start_idx]), 1);
        cur_total -= cur_num_tokens;
        start_idx++;
      }
    }

    cur_token = splits[cur_idx];
    num_cur_tokens = Math.max(tokenizer(cur_token), 1);

    cur_total += num_cur_tokens;
    cur_idx++;
  }
  docs.push(splits.slice(start_idx, cur_idx).join(separator));
  return docs;
};
