import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { TREE_NODE } from "./tree.js";
import { local } from "../utils/chalk.js";
import { EXPRESS_HOST, EXPRESS_PORT, ROBOT_DOMAIN } from "../utils/env.js";
import { Request, Response } from "express";
import { Tree, TreeNode, VALUE } from "./tree.js";
import { ChatCompletion } from "./openai/api.js";
import * as Prompts from "../features/prompts-and-completions.js";

/* ****************************************************************************
 *
 * TYPES
 *
 * ************************************************************************** */

export const REQUEST_FROM_XMTP = z.object({
  id: z.string(),
  created_at: z.coerce.date(),
  type: z.literal("request_from_xmtp"),
  payload: z.object({
    client_id: z.string(),
    protocol_id: z.string(),
    user_id: z.string(),
    request: z.string(),
  }),
});

export type RequestFromXmtp = z.infer<typeof REQUEST_FROM_XMTP>;

export const createRequestFromXmtp = ({
  clientId,
  protocolId,
  userId,
  request,
}: {
  clientId: string;
  protocolId: string;
  userId: string;
  request: string;
}): RequestFromXmtp => {
  return {
    id: uuidv4(),
    created_at: new Date(),
    type: "request_from_xmtp",
    payload: {
      client_id: clientId,
      protocol_id: protocolId,
      user_id: userId,
      request,
    },
  };
};

export const RESPONSE_TO_XMTP = z.object({
  id: z.string(),
  created_at: z.coerce.date(),
  type: z.literal("response_to_xmtp"),
  payload: z.object({
    request_from_xmtp_id: z.string(),
    response: z.object({
      message: z.string(),
    }),
  }),
});

export type ResponseToXmtp = z.infer<typeof RESPONSE_TO_XMTP>;

export const createResponseToXmtp = ({
  request,
  message,
}: {
  request: RequestFromXmtp;
  message: string;
}): ResponseToXmtp => {
  return {
    id: uuidv4(),
    created_at: new Date(),
    type: "response_to_xmtp",
    payload: {
      request_from_xmtp_id: request.id,
      response: {
        message,
      },
    },
  };
};

export const ASK_REQUEST = z.object({
  question: z.string(),
});

export const ASK_RESPONSE = z.object({
  answer: z.string(),
});

export const REQUEST_FROM_DISCORD = z.object({
  id: z.string(),
  created_at: z.coerce.date(),
  address: z.string(),
  content: z.string(),
});

export const createRequestFromDiscord = ({
  address,
  content,
}: {
  address: string;
  content: string;
}) => {
  return REQUEST_FROM_DISCORD.parse({
    id: uuidv4(),
    created_at: new Date(),
    address,
    content,
  });
};

/* ****************************************************************************
 *
 * API
 *
 * ************************************************************************** */

export const postFromXmtp = async ({
  request,
}: {
  request: RequestFromXmtp;
}) => {
  return fetch(`http://${EXPRESS_HOST}:${EXPRESS_PORT}/from/xmtp`, {
    method: "POST",
    body: JSON.stringify(request),
    headers: {
      "Content-Type": "application/json",
    },
  });
};

export const postFromDiscord = async (
  request: z.infer<typeof REQUEST_FROM_DISCORD>
) => {
  return fetch(`http://${EXPRESS_HOST}:${EXPRESS_PORT}/from/discord`, {
    method: "POST",
    body: JSON.stringify(request),
    headers: {
      "Content-Type": "application/json",
    },
  });
};

export const getHeartbeat = async () => {
  return fetch(`${ROBOT_DOMAIN}/heartbeat`);
};

let DIALOGUES: TreeNode | null = null;

const NODE_TARGET = z.object({
  rootId: z.string(),
  nodeId: z.string(),
});

export const Plato = {
  get: {
    response: z.object({ data: TREE_NODE.or(z.null()) }),

    handle: async (req: Request, res: Response) => {
      try {
        if (DIALOGUES === null) {
          res.status(200).send(Plato.get.response.parse({ data: null }));
          return;
        }
        const serializable = (() => {
          try {
            return Tree.stripParents({ node: DIALOGUES });
          } catch (error) {
            local.red("ERROR STRINGIFY DIALOGUES\n" + JSON.stringify(error));
            return null;
          }
        })();
        res.status(200).send(Plato.get.response.parse({ data: serializable }));
      } catch (error) {
        local.red(JSON.stringify(error, null, 2));
        res.status(200).send(Plato.get.response.parse({ data: null }));
      }
    },
  },

  init: {
    response: z.object({ data: z.object({ rootId: z.string() }).or(z.null()) }),
    handle: async (req: Request, res: Response) => {
      try {
        const { interlocutor, message } = VALUE.parse(req.body);
        const tree = Tree.create({
          value: { interlocutor, message },
        });
        DIALOGUES = tree;
        res
          .status(200)
          .send(Plato.init.response.parse({ data: { rootId: tree.id } }));
      } catch {
        res.status(500).send(Plato.init.response.parse({ data: null }));
      }
    },
  },
};

export const Socrates = {
  breadth: {
    response: z.object({ data: z.string() }),
    handle: async (req: Request, res: Response) => {
      try {
        const { nodeId } = NODE_TARGET.parse(req.body);
        if (DIALOGUES === null) {
          throw new Error("No dialogues");
        }
        const node = Tree.find({ node: DIALOGUES, id: nodeId });
        if (node === undefined) {
          throw new Error("Node not found");
        }
        const dialogue = Tree.toDialogue({ fromLastNode: node });
        local.green("Socrates thinking about branches...");
        const socratesResponse = await ChatCompletion.read.one.forPrompt({
          prompt: Prompts.Socrates.breadth({ fromDialogue: dialogue }),
          model: "gpt-4",
          maxTokens: 250,
        });
        local.green("Socrates thought of some branches!");
        const questions = Prompts.Socrates.completion.parse(
          ChatCompletion.util.getFirstChoiceContent({ from: socratesResponse })
        );
        const branches: z.infer<typeof VALUE>[] = questions.map((question) => ({
          interlocutor: "SOCRATES",
          message: question,
        }));
        Tree.branch({ node, branches });
        res.status(200).send(Socrates.breadth.response.parse({ data: "OK" }));
      } catch (error) {
        res
          .status(500)
          .send(Socrates.breadth.response.parse({ data: "ERROR" }));
      }
    },
  },

  depth: {
    response: z.object({ data: z.string() }),

    handle: async (req: Request, res: Response) => {
      try {
        const { nodeId } = NODE_TARGET.parse(req.body);
        if (DIALOGUES === null) {
          throw new Error("No dialogues");
        }
        const node = Tree.find({ node: DIALOGUES, id: nodeId });
        if (node === undefined) {
          throw new Error("Node not found");
        }
        const dialogue = Tree.toDialogue({ fromLastNode: node });
        local.green("Socrates thinking...");
        const socratesResponse = await ChatCompletion.read.one.forPrompt({
          prompt: Prompts.Socrates.depth({ fromDialogue: dialogue }),
          model: "gpt-4",
          maxTokens: 250,
        });
        // TODO "Grow" and "Branch" actually need to be distinguishable. A "Grow" is
        // not just a "Branch" with a single branch.
        Tree.grow({
          node,
          value: {
            interlocutor: "SOCRATES",
            message: ChatCompletion.util.getFirstChoiceContent({
              from: socratesResponse,
            }),
          },
        });
        DIALOGUES = node;
        res.status(200).send("ok");
      } catch (error) {
        res.status(500).send(Socrates.depth.response.parse({ data: "ERROR" }));
      }
    },
  },
};

export const Phaedrus = {
  answer: {
    response: z.object({ data: z.string() }),

    handle: async (req: Request, res: Response) => {
      const { nodeId } = NODE_TARGET.parse(req.body);
      if (DIALOGUES === null) {
        throw new Error("No dialogues");
      }
      const node = Tree.find({ node: DIALOGUES, id: nodeId });
      if (node === undefined) {
        throw new Error("Node not found");
      }
      const dialogue = Tree.toDialogue({ fromLastNode: node });
      local.red("Phaedrus thinking...");
      const phaedrusResponse = await ChatCompletion.read.one.forPrompt({
        prompt: Prompts.Phaedrus.createPrompt({ fromDialogue: dialogue }),
        model: "gpt-4",
        maxTokens: 500,
      });
      local.red("Phaedrus thought of an answer!");
      // TODO "Grow" and "Branch" actually need to be distinguishable. A "Grow" is
      // not just a "Branch" with a single branch.
      Tree.grow({
        node,
        value: {
          interlocutor: "PHAEDRUS",
          message: ChatCompletion.util.getFirstChoiceContent({
            from: phaedrusResponse,
          }),
        },
      });
      res.status(200).send({ data: "OK" });
    },
  },
};
