import { PlaywrightCrawler, Configuration } from "crawlee";
import { v4 as uuidv4 } from "uuid";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

// TODO The embedding stuff in this file should be in the semantic search API.

const supabase = (() => {
  const SU = process.env.SUPABASE_URL_ETL;
  if (SU === undefined) {
    throw new Error("SUPABASE_URL_ETL is not defined");
  }
  const SK = process.env.SUPABASE_KEY_ETL;
  if (SK === undefined) {
    throw new Error("SUPABASE_KEY_ETL is not defined");
  }
  return createClient(SU, SK);
})();

export const TEXT_FROM_HTML = z.object({
  id: z.string().uuid(),
  created_at: z.coerce.date(),
  pipeline_id: z.string().uuid(),
  text_from_html: z.string().or(z.null()),
  page_url: z.string(),
});

export type TextFromHtml = z.infer<typeof TEXT_FROM_HTML>;

export const PIPELINE = z.object({
  id: z.string().uuid(),
  created_at: z.coerce.date(),
  results: z.array(TEXT_FROM_HTML),
});

export type Pipeline = z.infer<typeof PIPELINE>;

export const createPipeline = () => {
  return {
    id: uuidv4(),
    created_at: new Date(),
    results: [],
  };
};

export const addResult = async ({
  toPipeline,
  result,
}: {
  toPipeline: Pipeline;
  result: TextFromHtml;
}) => {
  if (result.pipeline_id !== toPipeline.id) {
    throw new Error("result.pipeline_id !== toPipeline.id");
  } else {
    toPipeline.results.push(result);
  }
};

export const createTextFromHtml = ({
  textFromHtml,
  pipeline,
  pageUrl,
}: {
  textFromHtml: string | null;
  pageUrl: string;
  pipeline: Pipeline;
}): TextFromHtml => {
  return {
    id: uuidv4(),
    created_at: new Date(),
    pipeline_id: pipeline.id,
    text_from_html: textFromHtml,
    page_url: pageUrl,
  };
};

export const writeResults = async ({
  fromPipeline,
}: {
  fromPipeline: Pipeline;
}) => {
  return await supabase.from("text_from_html").insert(fromPipeline.results);
};

export const readResults = async ({
  pipelineId,
}: {
  pipelineId: string;
}): Promise<Pipeline> => {
  const { data, error } = await supabase
    .from("text_from_html")
    .select("*")
    .eq("pipeline_id", pipelineId);
  if (error !== null) {
    throw error;
  }
  if (data === null) {
    throw new Error("data === null");
  }
  if (data.length === 0) {
    throw new Error("data.length is 0");
  }

  const results = data.map((d) => {
    const validation = TEXT_FROM_HTML.safeParse(d);
    if (!validation.success) {
      throw new Error(validation.error.message);
    } else {
      return validation.data;
    }
  });

  return {
    id: pipelineId,
    // TODO - We don't actually save pipelines in db, so we don't have a created_at.
    created_at: new Date(),
    results,
  };
};

const SCRAPE_URL_REQUEST = z.object({
  urlToScrape: z.string().url(),
});

export type ScrapeUrlRequest = z.infer<typeof SCRAPE_URL_REQUEST>;

export const scrapeUrl = async ({ urlToScrape }: ScrapeUrlRequest) => {
  const pipeline = createPipeline();
  const crawler = new PlaywrightCrawler({
    async requestHandler({ request, page, enqueueLinks, log }) {
      log.info(request.url);
      const textContent = await page.textContent("html");
      addResult({
        toPipeline: pipeline,
        result: createTextFromHtml({
          textFromHtml: textContent,
          pageUrl: request.url,
          pipeline,
        }),
      });
      await enqueueLinks();
    },
    maxRequestsPerCrawl: Infinity, // Limitation for only 10 requests (do not use if you want to crawl all links)
  });
  await crawler.run([urlToScrape]);

  const { error } = await writeResults({ fromPipeline: pipeline });
  if (error) {
    // TODO - handle this error, probably by logging it
  }
};
