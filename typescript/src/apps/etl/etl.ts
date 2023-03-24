import { PlaywrightCrawler } from "crawlee";

const crawler = new PlaywrightCrawler({
  async requestHandler({ request, page, enqueueLinks, log }) {
    log.info(request.url);
    // Add all links from page to RequestQueue
    const textContent = await page.textContent("html");
    if (textContent === null) {
      throw new Error("textContent is null");
    }
    log.info(textContent);
    await enqueueLinks();
  },
  maxRequestsPerCrawl: 100, // Limitation for only 10 requests (do not use if you want to crawl all links)
});

// Run the crawler with initial request
const run = async () => {
  await crawler.run(["https://xmtp.org/docs"]);
};

run();
