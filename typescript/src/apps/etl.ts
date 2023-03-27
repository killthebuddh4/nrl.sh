export {};

const crawl = () => {
  // scrapeUrl from web-scraping.ts
};

const embed = async () => {
  // writeKnowledgeEmbeddings from semantic-search.ts
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
  // const toEmbed: Embeddable = {
  //   source: "https://xmtp.org/docs",
  //   text: "What is XMTP?",
  //   encoded: [],
  // };
  // const embeddings = await getEmbeddings({ toEmbed: [toEmbed] });
  // const writeableEmbedding: QueryEmbedding = {
  //   id: uuidv4(),
  //   created_at: new Date(),
  //   embedding: embeddings[0].embedding,
  //   query_text: toEmbed.text,
  // };
  // const { data, error } = await writeQueryEmbedding({
  //   queryEmbedding: writeableEmbedding,
  // });
  // if (error !== null) {
  //   throw new Error("Error writing query embedding");
  // }
  // console.log("Getting similar documents");
  // console.log("writeableEmbedding", writeableEmbedding.id);
  // const s = await getSimilarDocuments({
  //   queryEmbeddingId: writeableEmbedding.id,
  // });
  // console.log("SImilar docs", s);
  // console.log(s);
  // const queryEmbeddingId = data[0].id;
  // console.log(`${embeddings[0].embedding}`);
  // const v = embeddings[0].embedding;
  // const vSqlString = `'[${v}]'`;
  // const sql = `select document from langchain_pg_embedding WHERE embedding <=> ${vSqlString} < 0.15`;
  // const result = await prisma.$queryRawUnsafe(sql);
  // // console.log(result);
};

run();
