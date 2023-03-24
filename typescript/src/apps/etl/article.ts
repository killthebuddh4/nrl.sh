/* eslint-disable no-console */
import { z } from "zod";
import { Dataset, PlaywrightCrawler } from "crawlee";
import { encode } from "gpt-3-encoder";
import { readFile, writeFile } from "fs/promises";
import {
  getEmbeddings,
  Embedded,
  EMBEDDABLE,
  Embeddable,
  EMBEDDED,
} from "../../apis/openai.js";

const DATA_DIR = "./data/storage/key_value_stores/0";

/* ****************************************************************************
 *
 * This file implements an ETL pipeline
 *
 * - ingest the docusaurus website
 * - transform the data into a format that can be used to create embeddings
 * - transform the data into embeddings using the openai api
 * - load the embeddings into a vector database
 *
 * ****************************************************************************/

const PAGES = [
  "https://xmtp.org/docs",
  "https://xmtp.org/docs/dev-concepts/introduction#",
  "https://xmtp.org/",
  "https://xmtp.org/docs/client-sdk/javascript/concepts/intro-to-sdk",
  "https://xmtp.org/docs/client-sdk/kotlin/tutorials/quickstart",
  "https://xmtp.org/docs/client-sdk/swift/tutorials/quickstart",
  "https://xmtp.org/docs/client-sdk/dart/tutorials/quickstart",
  "https://xmtp.org/sdks-and-tools",
  "https://xmtp.org/community",
  "https://xmtp.org/grants",
  "https://xmtp.org/built-with-xmtp",
  "https://xmtp.org/community/code-of-conduct",
  "https://xmtp.org/vision/litepaper",
  "https://xmtp.org/vision/roadmap",
  "https://xmtp.org/docs/dev-concepts/architectural-overview",
  "https://xmtp.org/docs/dev-concepts/faq",
  "https://xmtp.org/docs/dev-concepts/interoperable-inbox",
  "https://xmtp.org/blog",
  "https://xmtp.org/docs/dev-concepts/content-types",
  "https://xmtp.org/docs/dev-concepts/ux-best-practices",
  "https://xmtp.org/docs/dev-concepts/key-generation-and-usage",
  "https://xmtp.org/docs/dev-concepts/invitation-and-message-encryption",
  "https://xmtp.org/docs/dev-concepts/algorithms-in-use",
  "https://xmtp.org/docs/dev-concepts/wallets",
  "https://xmtp.org/docs/dev-concepts/account-signatures",
  "https://xmtp.org/docs/dev-concepts/contributing",
  "https://xmtp.org/docs/dev-concepts/xips",
  "https://xmtp.org/docs/dev-concepts/xmtp-releases",
  "https://xmtp.org/docs/dev-concepts/built-with-xmtp",
  "https://xmtp.org/docs/client-sdk/javascript/tutorials/quickstart",
  "https://xmtp.org/privacy",
  "https://xmtp.org/terms",
  "https://xmtp.org/docs/client-sdk/javascript/tutorials/build-key-xmtp-chat-features-in-a-lens-app",
  "https://xmtp.org/docs/client-sdk/javascript/tutorials/start-messaging",
  "https://xmtp.org/blog/tags/content-types/",
  "https://xmtp.org/blog/attachments-and-remote-attachments",
  "https://xmtp.org/blog/tags/developers/",
  "https://xmtp.org/blog/tags/sd-ks",
  "https://xmtp.org/blog/secure-web3-customer-service-and-support-with-xmtp-and-ens",
  "https://xmtp.org/blog/tags/messaging/",
  "https://xmtp.org/blog/tags/awards/",
  "https://xmtp.org/blog/encode-club-livepeer-wrap-up/",
  "https://xmtp.org/blog/tags/hackathon/",
  "https://xmtp.org/docs/client-sdk/javascript/tutorials/build-an-xmtp-hello-world-app",
  "https://xmtp.org/docs/client-sdk/javascript/tutorials/filter-conversations",
  "https://xmtp.org/docs/client-sdk/javascript/tutorials/label-conversations",
  "https://xmtp.org/docs/client-sdk/javascript/tutorials/use-content-types",
  "https://xmtp.org/docs/client-sdk/javascript/tutorials/use-a-persistent-conversation-cache",
  "https://xmtp.org/docs/client-sdk/javascript/reference/classes/Client",
  "https://xmtp.org/docs/client-sdk/javascript/reference/classes/CompositeCodec",
  "https://xmtp.org/docs/client-sdk/javascript/reference/classes/ContentTypeId",
  "https://xmtp.org/docs/client-sdk/javascript/reference/classes/Conversations",
];

const ARTICLE = z.object({
  pageUrl: z.string(),
  paragraphs: z.array(z.string()),
});

type Article = z.infer<typeof ARTICLE>;

const EMBEDDABLE_ARTICLE = z.object({
  pageUrl: z.string(),
  embeddable: EMBEDDABLE,
});

type EmbeddableArticle = z.infer<typeof EMBEDDABLE_ARTICLE>;

const EMBEDDED_ARTICLE = z.object({
  pageUrl: z.string(),
  embedding: EMBEDDED,
});

type EmbeddedArticle = z.infer<typeof EMBEDDED_ARTICLE>;

const RELEVANT_ARTICLE = z.object({
  text: z.string(),
  distance: z.number().min(0).max(1),
  related: EMBEDDED_ARTICLE,
});

type RelevantArticle = z.infer<typeof RELEVANT_ARTICLE>;

class ArticlePipeline {
  public static async extractArticles({
    opts,
  }: {
    opts?: { write?: boolean };
  }) {
    const results: Article[] = [];
    const crawler = new PlaywrightCrawler({
      launchContext: {
        // Here you can set options that are passed to the playwright .launch() function.
        launchOptions: {
          headless: true,
        },
      },

      // Stop crawling after several pages
      maxRequestsPerCrawl: 50,

      async requestHandler({ request, page }) {
        const extractArticle = async () => {
          const articleElement = await page.$("article");

          const paragraphElements =
            articleElement === null ? [] : await page.$$("article p");

          const paragraphs = await Promise.all(
            paragraphElements.map(async (paragraph) => {
              const text = await paragraph.textContent();
              return text || "";
            })
          );

          return ARTICLE.safeParse({
            pageUrl: request.url,
            paragraphs,
          });
        };

        const processExtractedArticle = ({ article }: { article: Article }) => {
          results.push({
            pageUrl: request.url,
            paragraphs: article.paragraphs,
          });
          if (opts?.write) {
            Dataset.pushData(article);
          }
        };

        const asyncWrapper = async () => {
          const article = await extractArticle();
          if (!article.success) {
            throw new Error("Failed to extract article");
          } else {
            processExtractedArticle({ article: article.data });
            try {
              if (opts?.write) {
                return await Dataset.exportToJSON("paragraphs", { toKVS: "0" });
              }
            } catch (err) {
              console.error(err);
            }
          }
        };

        await asyncWrapper();
      },

      failedRequestHandler({ request, log }) {
        log.info(`Request ${request.url} failed too many times.`);
      },
    });

    const devConceptsUrls = PAGES.filter((url) => url.includes("dev-concepts"));
    await crawler.addRequests(devConceptsUrls);
    await crawler.run();
    return results;
  }

  public static async makeArticlesEmbeddable({
    articles,
  }: {
    articles: Article[];
  }) {
    const withMergedParagraphs = articles.map((article) => {
      return {
        pageUrl: article.pageUrl,
        paragraphs: article.paragraphs.join(" "),
      };
    });

    const withMaybeEmbeddable: EmbeddableArticle[] = await Promise.all(
      withMergedParagraphs.map(async (article) => {
        return {
          pageUrl: article.pageUrl,
          embeddable: {
            text: article.paragraphs,
            encoded: encode(article.paragraphs),
          },
        };
      })
    );

    const embeddable = withMaybeEmbeddable.filter(
      (article) => EMBEDDABLE_ARTICLE.safeParse(article).success
    );

    await writeFile(
      DATA_DIR + "/embeddable.json",
      JSON.stringify(embeddable, null, 2)
    );
  }

  public static async createEmbeddings() {
    const data = await getEmbeddableArticlesFromKVS();
    for (const article of data) {
      console.log(article.embeddable.encoded.length);
    }
    return;
    const embeddings = await getEmbeddings({
      toEmbed: data.map((a) => a.embeddable),
    });
    const mappedEmbeddings = data.map((article, i) => {
      return {
        pageUrl: article.pageUrl,
        embedding: embeddings[i],
      };
    });

    await writeFile(
      DATA_DIR + "/embeddings.json",
      JSON.stringify(mappedEmbeddings, null, 2)
    );
  }
}

const getEmbeddableArticlesFromKVS = async (): Promise<EmbeddableArticle[]> => {
  const dataBuf = await readFile(`${DATA_DIR}//embeddable.json`);
  const dataStr = dataBuf.toString();
  const dataJson = (() => {
    try {
      return JSON.parse(dataStr);
    } catch {
      throw new Error("The data was not valid JSON");
    }
  })();
  const data = (() => {
    for (const article of dataJson) {
      if (!EMBEDDABLE_ARTICLE.safeParse(article).success) {
        console.log("article", article);
        throw new Error("You got invalid data: " + article.pageUrl);
      }
    }
    return dataJson;
  })();
  return data;
};

const getArticlesFromKVS = async () => {
  const dataBuf = await readFile(DATA_DIR + "/paragraphs.json");
  const dataStr = dataBuf.toString();
  const dataJson = JSON.parse(dataStr) as Article[];
  const data = (() => {
    for (const article of dataJson) {
      if (!ARTICLE.safeParse(article).success) {
        throw new Error("You got invalid data: " + article.pageUrl);
      }
    }
    return dataJson;
  })();
  return data;
};

const getEmbeddedArticlesFromKVS = async (): Promise<EmbeddedArticle[]> => {
  const embeddingsBuf = await readFile(DATA_DIR + "/embeddings.json");
  const embeddingsStr = embeddingsBuf.toString();
  const embeddingsJson = JSON.parse(embeddingsStr) as EmbeddedArticle[];
  const embeddings = (() => {
    for (const embedding of embeddingsJson) {
      const validation = EMBEDDED_ARTICLE.safeParse(embedding);
      if (validation.success === false) {
        console.log("fail", JSON.stringify(validation.error, null, 2));

        throw new Error("You got invalid data: " + embedding.pageUrl);
      }
    }
    return embeddingsJson as EmbeddedArticle[];
  })();
  return embeddings;
};

type WithDistance = Embedded & { distance: number };

const getRelevantArticles = async ({
  related,
  toEmbed,
}: {
  related: EmbeddedArticle[];
  toEmbed: Embeddable;
}): Promise<RelevantArticle[]> => {
  const embedding = await getEmbeddings({
    toEmbed: [toEmbed],
  });
  const relavantArticles: RelevantArticle[] = related.map((r) => ({
    text: r.pageUrl,
    distance: cosineDistance(r.embedding.embedding, embedding[0].embedding),
    related: r,
  }));

  const sorted = relavantArticles.sort((a, b) => a.distance - b.distance);

  console.log(
    JSON.stringify(
      sorted.map((x) => x.distance),
      null,
      2
    )
  );

  return sorted;
};

// const createContext = async ({
//   question,
// }: {
//   question: string;
// }): Promise<WithDistance[]> => {
//   const embeddings = await readEmbeddingsFromKVS();
//   const encodedQuestion = encode(question);
//   const embeddedQuestion = await getEmbeddings({
//     toEmbed: [{ text: question, encoded: encodedQuestion }],
//   });
//   const withDistances = embeddings.map((embedding) => {
//     return {
//       ...embedding,
//       distance: cosineDistance(
//         embedding.embedding,
//         embeddedQuestion[0].embedding
//       ),
//     };
//   });
//   console.log(
//     "WHAT",
//     withDistances
//       .sort((a, b) => a.distance - b.distance)
//       .map((d) => d.distance)
//       .slice(0, 10)
//   );
//   return withDistances;
// };

const run = async () => {
  ArticlePipeline.createEmbeddings();
  // getRelevantArticles({

  //   related: await getEmbeddedArticlesFromKVS(),
  //   toEmbed: {
  //     // text: "aflakjdfalkdjsfklajds;",
  //     // encoded: encode("adlfkjadlkfjadklsjfkaljsd"),
  //     text: "I'd like to learn about encrypted messaging.",
  //     encoded: encode("I'd like to learn about encrypted messaging."),
  //   },
  // });
  // const articles = await ArticleEtl.extract({ opts: { write: true } });
  // const embeddable = await ArticleEtl.transform({ articles });
  // const articles = await getArticlesFromKVS();
  // await ArticlePipeline.makeArticlesEmbeddable({ articles });
  // ArticlePipeline.createEmbeddings();
  // const articles = await getArticlesFromKVS();
  // const articlesWithMergedParagraphs = articles.map((article) => {
  //   return {
  //     ...article,
  //     paragraphs: article.paragraphs.join(" "),
  //   };
  // });
  // console.log("articles", articles.length);
  // const distances = await getDistancesFromText({
  //   toEmbed: {
  //     text: "Reptar roar!",
  //     encoded: encode("Reptar roar!"),
  //   },
  // });
  // console.log("embeddings", embeddings.length);
  // const context = await createContext({
  //   question: "What is the XMTP protocol?",
  // });
  // const embeddings = await getEmbeddings({ toEmbed: embeddableText });
  // await writeEmbeddingsToKVS(embeddings);
};

run();

// Ingest.extract();

const cosineDistance = (a: number[], b: number[]) => {
  if (a.length !== b.length) {
    throw new Error("Vectors must be of the same length");
  }

  const dp = a.reduce((acc, val, i) => acc + val * b[i], 0);

  if (dp > 1) {
    throw new Error("Dot product is greater than 1");
  }

  return 1 - dp;
};
