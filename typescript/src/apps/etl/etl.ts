import { v4 as uuidv4 } from "uuid";
import {
  createTextFromHtml,
  createPipeline,
  addToPipeline,
  writePipeline,
  readPipeline,
  transferPipeline,
  writeEmbeddings,
  writeCollection,
  EtlEmbedding,
  LangchainPgCollection,
} from "../../apis/etl.js";
import {
  writeQueryEmbedding,
  QueryEmbedding,
  getSimilarDocuments,
} from "../../apis/semantic-search.js";
import { Document, RecursiveCharacterTextSplitter } from "../../apis/text.js";
import { PlaywrightCrawler, Configuration } from "crawlee";
import { Embeddable, getEmbeddings } from "../../apis/openai.js";

Configuration.getGlobalConfig().set("persistStorage", false);

const crawl = async () => {
  const pipeline = await createPipeline();
  const crawler = new PlaywrightCrawler({
    async requestHandler({ request, page, enqueueLinks, log }) {
      log.info(request.url);
      // Add all links from page to RequestQueue
      const textContent = await page.textContent("html");
      addToPipeline({
        pipeline,
        textFromHtml: createTextFromHtml({
          textFromHtml: textContent,
          pageUrl: request.url,
          pipeline,
        }),
      });
      await enqueueLinks();
    },
    maxRequestsPerCrawl: Infinity, // Limitation for only 10 requests (do not use if you want to crawl all links)
  });
  await crawler.run(["https://xmtp.org/docs"]);
  /* eslint-disable no-console */
  console.log(JSON.stringify(pipeline, null, 2));

  const { error } = await writePipeline({ pipeline });
  if (error) {
    // TODO - handle this error, probably by logging it
    console.error(error);
  }
};

const embed = async () => {
  const p = await readPipeline({ id: "4215b1bb-0334-4b79-86ec-5a1cbb53aa8f" });
  const docs: Document[] = p.results.map((r) => ({
    pageContent: r.text_from_html || "TODO: What do we do here?",
    metadata: {
      source: r.page_url,
    },
  }));
  const splitDocs = await new RecursiveCharacterTextSplitter().splitDocuments(
    docs
  );
  // TODO - We aren't using the encoded right now.
  const toEmbed = splitDocs.map((d) => ({
    source: d.metadata.source,
    text: d.pageContent,
    encoded: [],
  }));
  const embeddings = [];
  for (let i = 0; i < toEmbed.length; i += 250) {
    const embeddingsChunk = await getEmbeddings({
      toEmbed: toEmbed.slice(i, i + 250),
    });
    embeddings.push(...embeddingsChunk);
  }
  const collection: LangchainPgCollection = {
    uuid: uuidv4(),
    name: "xmtp-data-2",
  };

  const { error: writeCollectionError } = await writeCollection({ collection });
  if (writeCollectionError !== null) {
    throw new Error("Error writing collection");
  }

  const toWrite: EtlEmbedding[] = embeddings.map((embedding) => {
    return {
      uuid: uuidv4(),
      collection_id: collection.uuid,
      embedding: embedding.embedding,
      document: embedding.source.text,
      cmetadata: {
        source: embedding.source.source,
      },
      custom_id: "TODO - what is this?",
    };
  });
  console.log("toWrite length", toWrite.length);
  const { error } = await writeEmbeddings({ embeddings: toWrite });
  if (error) {
    // TODO - handle this error, probably by logging it
    console.error(error);
  } else {
    console.log("Wrote embeddings");
  }
};

// Run the crawler with initial request
const run = async () => {
  // // const p = await readPipeline({ id: "ef9350ec-a7a9-4093-83e8-9b654fa6f550" });
  // // await transferPipeline({ pipeline: p });
  // // console.log("Starting crawl");
  // // await crawl();
  // // console.log("Done crawl");
  // console.log("Starting embed");
  // await embed();
  // console.log("Done embed");

  const toEmbed: Embeddable = {
    source: "https://xmtp.org/docs",
    text: "What is XMTP?",
    encoded: [],
  };

  const embeddings = await getEmbeddings({ toEmbed: [toEmbed] });

  const writeableEmbedding: QueryEmbedding = {
    id: uuidv4(),
    created_at: new Date(),
    embedding: embeddings[0].embedding,
    query_text: toEmbed.text,
  };

  const { data, error } = await writeQueryEmbedding({
    queryEmbedding: writeableEmbedding,
  });
  if (error !== null) {
    throw new Error("Error writing query embedding");
  }

  console.log("Getting similar documents");
  console.log("writeableEmbedding", writeableEmbedding.id);
  const s = await getSimilarDocuments({
    queryEmbeddingId: writeableEmbedding.id,
  });
  console.log("SImilar docs", s);

  console.log(s);

  // const queryEmbeddingId = data[0].id;

  // console.log(`${embeddings[0].embedding}`);
  // const v = embeddings[0].embedding;
  // const vSqlString = `'[${v}]'`;
  // const sql = `select document from langchain_pg_embedding WHERE embedding <=> ${vSqlString} < 0.15`;
  // const result = await prisma.$queryRawUnsafe(sql);
  // // console.log(result);
};

run();
