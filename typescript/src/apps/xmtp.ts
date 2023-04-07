import { v4 as uuidv4 } from "uuid";
import { logger } from "../apis/supabase/logging.js";
import { Xmtp } from "../apis/xmtp.js";
import {
  RESPONSE_TO_XMTP,
  postFromXmtp,
  createRequestFromXmtp,
} from "../apis/express.js";

const XMTP_CLIENT_PK = (() => {
  if (process.env.XMTP_CLIENT_PK === undefined) {
    throw new Error("XMTP_CLIENT_PK is not defined");
  } else {
    return process.env.XMTP_CLIENT_PK;
  }
})();

const xmtp = new Xmtp({ pk: XMTP_CLIENT_PK });

xmtp.addListener(async (message) => {
  logger.event({
    id: uuidv4(),
    created_at: new Date(),
    type: "inbound_xmtp_message_event",
    payload: {
      id: message.id,
      senderAddress: message.senderAddress,
    },
  });
  const heartbeatRequest = xmtp.getHeartbeatRequest(message);
  if (heartbeatRequest !== null) {
    xmtp.sendHeartbeatResponse({ request: heartbeatRequest });
  } else if (await xmtp.isSelfSentMessage(message)) {
    return;
  } else {
    const response = await postFromXmtp({
      request: createRequestFromXmtp({
        clientId: "xmtp.chat",
        protocolId: "xmtp",
        userId: message.senderAddress,
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
          xmtp.sendMessage({
            peerAddress: message.conversation.peerAddress,
            message: responseValidation.data.payload.response.message,
          });
        } catch {
          // TODO ERROR HANDLING
        }
      }
    }
  }
});
