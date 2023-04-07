export const retryWithBackoff = async <T>({
  toRetry,
}: {
  toRetry: () => Promise<T>;
}) => {
  try {
    return await toRetry();
  } catch {
    try {
      const delay = 1000 + Math.random() * 250;
      await new Promise((resolve) => setTimeout(resolve, delay));
      return await toRetry();
    } catch {
      try {
        const delay = 4000 + Math.random() * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
        return await toRetry();
      } catch {
        try {
          const delay = 10000 + Math.random() * 3000;
          await new Promise((resolve) => setTimeout(resolve, delay));
          return await toRetry();
        } catch {
          const delay = 35000 + Math.random() * 10000;
          await new Promise((resolve) => setTimeout(resolve, delay));
          return await toRetry();
        }
      }
    }
  }
};
