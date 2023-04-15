import { z } from "zod";
import express, { Request } from "express";
import { logger } from "../apis/supabase/logging.js";
import {
  ASK_REQUEST,
  REQUEST_FROM_DISCORD,
  REQUEST_FROM_XMTP,
} from "../apis/express.js";
import { XMTP_ADDRESS, Xmtp } from "../apis/xmtp.js";
import { sendToDiscord } from "../apis/discord.js";
import { askReAct } from "../features/react.js";
import { local } from "../utils/chalk.js";
import { TreeNode, Tree, VALUE } from "../apis/tree.js";
import {
  Socrates,
  Phaedrus,
  DialogueMessage,
} from "../features/prompts-and-completions.js";
import { ChatCompletion } from "../apis/openai/api.js";

const XMTP_CLIENT_PK = z.string().parse(process.env.XMTP_CLIENT_PK);

const xmtp = new Xmtp({ pk: XMTP_CLIENT_PK });

const server = express();

server.use(express.json());

server.get("/heartbeat", (req, res) => {
  res.send("Not dead yet!");
});

server.get("/version", (req, res) => {
  res.send(process.env.GITHUB_SHA);
});

server.post("/ask", async (req, res) => {
  const authResult = authenticateRequest({ req });
  if (!authResult.isAuthenticated) {
    return res.status(401).send("Unauthorized");
  } else {
    try {
      const { question } = ASK_REQUEST.parse(req.body);
      await askReAct({ question });
      res.status(200).send("ok");
    } catch (error) {
      local.red(JSON.stringify(error, null, 2));
      res.status(500).send("Internal server error");
    }
  }
});

server.post("/from/xmtp", async (req, res) => {
  const authResult = authenticateRequest({ req });
  if (!authResult.isAuthenticated) {
    // TODO
    return res.status(401).send("Unauthorized");
  } else {
    const request = REQUEST_FROM_XMTP.parse(req.body);

    await sendToDiscord({
      address: request.payload.user_id,
      message: request.payload.request,
    });
  }
  res.status(200).send("ok");
});

server.post("/from/discord", async (req, res) => {
  try {
    const authResult = authenticateRequest({ req });
    if (!authResult.isAuthenticated) {
      // TODO
      return res.status(401).send("Unauthorized");
    } else {
      const { address, content } = REQUEST_FROM_DISCORD.parse(req.body);
      await xmtp.sendMessage({
        peerAddress: (() => {
          try {
            return XMTP_ADDRESS.parse(address);
          } catch {
            return "0xf89773CF7cf0B560BC5003a6963b98152D84A15a";
          }
        })(),
        message: content,
      });
      res.status(200).send("ok");
    }
  } catch (err) {
    res.status(500).send("Internal server error");
  }
});

const DIALOGUES: Record<string, TreeNode> = {};

server.get("/plato", async (req, res) => {
  res.status(200).send(DIALOGUES);
});

server.post("/plato", async (req, res) => {
  const { interlocutor, message } = VALUE.parse(req.body);
  const tree = Tree.create({
    value: { interlocutor, message },
  });
  DIALOGUES[tree.id] = tree;
  local.blue(JSON.stringify(DIALOGUES, null, 2));
  res.status(200).send({ id: tree.id });
});

const SB_REQ = z.object({
  rootId: z.string(),
  nodeId: z.string(),
});

const dialogueFromTree = ({
  rootId,
  nodeId,
}: {
  rootId: string;
  nodeId: string;
}): DialogueMessage[] => {
  const tree = DIALOGUES[rootId];
  if (tree === undefined) {
    throw new Error("No tree found");
  }
  const node = Tree.find({ node: tree, id: nodeId });
  if (node === undefined) {
    throw new Error("No node found");
  }
  const path = Tree.path({ toNode: tree });
  if (path.length === 0) {
    throw new Error("No path found");
  }
  const nodes = Tree.nodes({ node: tree, onPath: path });
  if (nodes.length === 0) {
    throw new Error("No nodes found");
  }
  return nodes.map((node) => {
    return {
      role: node.value.interlocutor,
      content: node.value.message,
    };
  });
};

server.post("/socrates/breadth", async (req, res) => {
  const { rootId, nodeId } = SB_REQ.parse(req.body);
  const dialogue = dialogueFromTree({ rootId, nodeId });
  local.green("Socrates thinking...");
  const socratesResponse = await ChatCompletion.read.one.forPrompt({
    prompt: Socrates.breadth({ fromDialogue: dialogue }),
    model: "gpt-4",
    maxTokens: 250,
  });
  const questions = Socrates.completion.parse(
    ChatCompletion.util.getFirstChoiceContent({ from: socratesResponse })
  );
  const tree = DIALOGUES[rootId];
  const node = Tree.find({ node: tree, id: nodeId });
  if (node === undefined) {
    throw new Error("No node found");
  }
  const branches: z.infer<typeof VALUE>[] = questions.map((question) => ({
    interlocutor: "SOCRATES",
    message: question,
  }));
  Tree.branch({ node, branches });
  local.blue(JSON.stringify(tree, null, 2));
  res.status(200).send("ok");
});

const SD_REQ = z.object({
  rootId: z.string(),
  nodeId: z.string(),
});

server.post("/socrates/depth", async (req, res) => {
  const { rootId, nodeId } = SD_REQ.parse(req.body);
  const dialogue = dialogueFromTree({ rootId, nodeId });
  local.green("Socrates thinking...");
  const socratesResponse = await ChatCompletion.read.one.forPrompt({
    prompt: Socrates.depth({ fromDialogue: dialogue }),
    model: "gpt-4",
    maxTokens: 250,
  });
  const tree = DIALOGUES[rootId];
  const node = Tree.find({ node: tree, id: nodeId });
  if (node === undefined) {
    throw new Error("No node found");
  }
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
  local.blue(JSON.stringify(tree, null, 2));
  res.status(200).send("ok");
});

const P_REQ = z.object({
  rootId: z.string(),
  nodeId: z.string(),
});

server.post("/phaedrus", async (req, res) => {
  const { rootId, nodeId } = P_REQ.parse(req.body);
  const dialogue = dialogueFromTree({ rootId, nodeId });
  local.red("Phaedrus thinking...");
  const phaedrusResponse = await ChatCompletion.read.one.forPrompt({
    prompt: Phaedrus.createPrompt({ fromDialogue: dialogue }),
    model: "gpt-4",
    // TODO We need a "continue" action that furthers the response.
    maxTokens: 500,
  });
  const tree = DIALOGUES[rootId];
  const node = Tree.find({ node: tree, id: nodeId });
  if (node === undefined) {
    throw new Error("No node found");
  }
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
  local.blue(JSON.stringify(tree, null, 2));
  res.status(200).send("ok");
  res.status(200).send("ok");
});

server.post("/protagoras", async (req, res) => {
  res.status(200).send("ok");
});

server.post("/daimon", async (req, res) => {
  res.status(200).send("ok");
});

server.post("/oracle", async (req, res) => {
  res.status(200).send("ok");
});

const authenticateRequest = ({ req }: { req: Request }) => {
  if (req === undefined || req === null) {
    return { isAuthenticated: false };
  } else {
    return { isAuthenticated: true };
  }
};

server.listen(8080, () => logger.info("Listening on http://localhost:8080"));
