import { PlaywrightCrawler, Configuration } from "crawlee";
import {
  createSourceDoc,
  createPipeline,
  writePipeline,
} from "../../apis/supabase/semantic-search.js";

Configuration.getGlobalConfig().set("persistStorage", false);

export const generateSourceDocs = async ({
  fromUrl,
  limit = 10,
}: {
  fromUrl: string;
  limit?: number;
}) => {
  const pipeline = createPipeline();
  const crawler = new PlaywrightCrawler({
    async requestHandler({ request, page, enqueueLinks, log }) {
      log.info(request.url);
      const textContent = await page.textContent("html");
      if (textContent === null) {
        throw new Error("textContent is null");
      } else {
        pipeline.source_docs.push(
          createSourceDoc({
            textFromHtml: textContent,
            pageUrl: request.url,
            pipelineId: pipeline.id,
          })
        );
      }
      await enqueueLinks();
    },
    maxRequestsPerCrawl: limit || Infinity,
  });
  await crawler.run([fromUrl]);
  const { error: writePipelineError } = await writePipeline({
    toWrite: pipeline,
  });
  if (writePipelineError !== null) {
    throw new Error("Something went wrong writing pipeline");
  } else {
    return pipeline;
  }
};
