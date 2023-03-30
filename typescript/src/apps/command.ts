export {};

const command = async () => {
  const response = await fetch(
    "http://localhost:8080/get-similar?" +
      new URLSearchParams({
        query: "What is XMTP?",
      })
  );
  if (!response.ok) {
    throw new Error("Failed to fetch");
  } else {
    // const data = await response.json();
    /* eslint-disable-next-line no-console */
  }
};

command();
