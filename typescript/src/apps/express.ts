import express, { Request } from "express";
import { logger } from "../apis/supabase/logging.js";
import {
  REQUEST_FROM_XMTP,
  ASK_REQUEST,
  ASK_RESPONSE,
} from "../apis/express.js";
import { askQuestion } from "../features/semantic-mapping.js";

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
    // TODO
    return res.status(401).send("Unauthorized");
  } else {
    try {
      const { question } = ASK_REQUEST.parse(req.body);
      const answer = await askQuestion({ question });
      res.status(200).send(ASK_RESPONSE.parse({ answer }));
    } catch (error) {
      res.status(500).send("Internal server error");
    }
  }
});

server.post("/from/xmtp", async (req, res) => {
  const authResult = authenticateRequest({ req });
  if (!authResult.isAuthenticated) {
    // TODO
    return res.status(401).send("Unauthorized");
  }
  const request = REQUEST_FROM_XMTP.parse(req.body);
  res.send("ok");
});

const authenticateRequest = ({ req }: { req: Request }) => {
  if (req === undefined || req === null) {
    return { isAuthenticated: false };
  } else {
    return { isAuthenticated: true };
  }
};

server.listen(8080, () => logger.info("Listening on http://localhost:8080"));
