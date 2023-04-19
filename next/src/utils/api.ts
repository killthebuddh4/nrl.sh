import { TREE_NODE } from "@/utils/tree";
import { z } from "zod";

const EXPRESS_HOST = "localhost";
const EXPRESS_PORT = "8080";

const NODE_TARGET = z.object({
  rootId: z.string(),
  nodeId: z.string(),
});

export const Plato = {
  get: {
    response: z.object({ data: TREE_NODE.or(z.null()) }),

    call: async () => {
      try {
        const response = await fetch(
          `http://${EXPRESS_HOST}:${EXPRESS_PORT}/plato`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          }
        );
        const json = await response.json();
        return Plato.get.response.parse(json);
      } catch (error) {
        console.log(JSON.stringify(error, null, 2));
        throw error;
      }
    },
  },

  init: {
    response: z.object({ data: z.object({ rootId: z.string() }).or(z.null()) }),

    call: async ({
      interlocutor,
      message,
    }: {
      interlocutor: "SOCRATES" | "PHAEDRUS";
      message: string;
    }) => {
      const response = await fetch(
        `http://${EXPRESS_HOST}:${EXPRESS_PORT}/plato`,
        {
          method: "POST",
          body: JSON.stringify({ interlocutor, message }),
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      const json = await response.json();
      return Plato.init.response.parse(json);
    },
  },
};

export const Socrates = {
  breadth: {
    call: async ({ rootId, nodeId }: z.infer<typeof NODE_TARGET>) => {
      const response = await fetch(
        `http://${EXPRESS_HOST}:${EXPRESS_PORT}/socrates/breadth`,
        {
          method: "POST",
          body: JSON.stringify({ rootId, nodeId }),
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      return await response.json();
    },
  },

  depth: {
    call: async ({ rootId, nodeId }: z.infer<typeof NODE_TARGET>) => {
      const response = await fetch(
        `http://${EXPRESS_HOST}:${EXPRESS_PORT}/socrates/breadth`,
        {
          method: "POST",
          body: JSON.stringify({ rootId, nodeId }),
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      return await response.json();
    },
  },
};

export const Phaedrus = {
  answer: {
    response: z.object({ data: z.string() }),

    call: async ({ rootId, nodeId }: z.infer<typeof NODE_TARGET>) => {
      const response = await fetch(
        `http://${EXPRESS_HOST}:${EXPRESS_PORT}/phaedrus`,
        {
          method: "POST",
          body: JSON.stringify({ rootId, nodeId }),
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      const json = await response.json();
      return Phaedrus.answer.response.parse(json);
    },
  },
};
