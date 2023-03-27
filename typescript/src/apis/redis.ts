import { createClient } from "redis";

function float32Buffer(arr: number[]) {
  return Buffer.from(new Float32Array(arr).buffer);
}

// await client.quit();

export class Redis {
  public static async getRedisClient() {
    const client = createClient();
    await client.connect();
    return client;
  }

  public static executeKnnSearch = async (
    client: ReturnType<typeof Redis.getRedisClient>,
    query: number[]
  ) => {
    const finalClient = await client;
    const opts = {
      PARAMS: {
        BLOB: float32Buffer(query),
      },
      SORTBY: {
        BY: "vector_score",
        DIRECTION: "DESC",
      },
      DIALECT: 2,
      RETURN: ["metadata", "content", "vector_score"],
      LIMIT: {
        from: 0,
        size: 10,
      },
    } as any;

    const results = await finalClient.ft.search(
      "xmtp-data",
      "*=>[KNN 1000 @content_vector $BLOB AS vector_score]",
      opts
    );
    return results;
  };
}
