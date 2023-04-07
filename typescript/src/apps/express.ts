import { z } from "zod";
import express, { Request } from "express";
import { logger } from "../apis/supabase/logging.js";
import {
  ASK_REQUEST,
  ASK_RESPONSE,
  REQUEST_FROM_DISCORD,
  REQUEST_FROM_XMTP,
} from "../apis/express.js";
import { askQuestion } from "../features/semantic-mapping.js";
import { XMTP_ADDRESS, Xmtp } from "../apis/xmtp.js";
import { sendToDiscord } from "../apis/discord.js";

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

const authenticateRequest = ({ req }: { req: Request }) => {
  if (req === undefined || req === null) {
    return { isAuthenticated: false };
  } else {
    return { isAuthenticated: true };
  }
};

server.listen(8080, () => logger.info("Listening on http://localhost:8080"));
