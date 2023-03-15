import xmtp from "@xmtp/xmtp-js";
const { Client } = xmtp;
import { DecodedMessage } from "@xmtp/xmtp-js";
import { Wallet } from "@ethersproject/wallet";
import { v4 as uuidv4 } from "uuid";
import { ENS_ROBOT_ID } from "../apis/openai.js";
import { logger } from "../apis/logger.js";
import {
  createRequestFromXmtp,
  postFromXmtp,
  RESPONSE_TO_XMTP,
} from "../apis/express.js";

/* ****************************************************************************
 *
 * listeners
 *
 * ************************************************************************** */

const LISTENERS: Array<(msg: DecodedMessage) => void> = [];

/* ****************************************************************************
 *
 * client
 *
 * ************************************************************************** */

const wallet = (async () => {
  const pk = process.env.XMTP_CLIENT_PK;
  if (pk === undefined) {
    throw new Error("XMTP_CLIENT_PK is not defined");
  }
  return new Wallet(pk);
})();

const client = (async () => {
  logger.info("XMTP :: initializing Client");
  const internal = await Client.create(await wallet, { env: "production" });
  logger.info("XMTP :: Client initialized");
  return internal;
})();

/* ****************************************************************************
 *
 * stream
 *
 * ************************************************************************** */

export const stream = (async () => {
  logger.info("XMTP :: initializing stream");
  const internal = await (await client).conversations.streamAllMessages();
  logger.info("XMTP :: stream is ready");
  (async () => {
    for await (const message of internal) {
      for (const listener of LISTENERS) {
        listener(message);
      }
    }
  })();
  return internal;
})();

/* ****************************************************************************
 *
 * sendMessage
 *
 * ************************************************************************** */

export const sendMessage = async ({
  peerAddress,
  message,
}: {
  peerAddress: string;
  message: string;
}) => {
  const conversation = await (
    await client
  ).conversations.newConversation(peerAddress);
  return conversation.send(message);
};

/* ****************************************************************************
 *
 * handleMessage
 *
 * ************************************************************************** */

const handleMessage = async (message: DecodedMessage) => {
  logger.event({
    id: uuidv4(),
    created_at: new Date(),
    type: "inbound_xmtp_message_event",
    payload: {
      id: message.id,
      senderAddress: message.senderAddress,
    },
  });
  if (message.senderAddress === (await wallet).address) {
    return;
  } else {
    const response = await postFromXmtp({
      request: createRequestFromXmtp({
        clientId: "xmtp.chat",
        protocolId: "xmtp",
        userId: message.senderAddress,
        robotId: ENS_ROBOT_ID,
        request: message.content,
      }),
    });
    if (!response.ok) {
      logger.error({
        id: uuidv4(),
        created_at: new Date(),
        type: "error_event",
        payload: {
          message: await response.text(),
        },
      });

      // TODO ERROR HANDLING
    } else {
      const responseValidation = RESPONSE_TO_XMTP.safeParse(
        await response.json()
      );
      if (!responseValidation.success) {
        // TODO ERROR HANDLING
      } else {
        try {
          logger.event({
            id: uuidv4(),
            created_at: new Date(),
            type: "outbound_xmtp_message_event",
            payload: {
              id: message.id,
              peerAddress: message.conversation.peerAddress,
            },
          });
          sendMessage({
            peerAddress: message.conversation.peerAddress,
            message: responseValidation.data.payload.response.message,
          });
        } catch {
          // TODO ERROR HANDLING
        }
      }
    }
  }
};

/* ****************************************************************************
 *
 * RUN APP
 *
 * ************************************************************************** */

(async () => {
  LISTENERS.push(handleMessage);
})();
