import express, { Request } from "express";
import { v4 as uuidv4 } from "uuid";
import {
  postMessageToFront,
  getRecipientHandle,
  FRONT_MESSAGE,
} from "../apis/icebox/front.js";
import {
  escalate,
  isEscalated,
  deescalate,
} from "../apis/icebox/escalation.js";
import {
  createRobotRequest,
  postRobotQuestion,
  RobotRequest,
} from "../apis/question-answering.js";
import {
  RobotRequestEvent,
  UserRequestEvent,
  UserResponseEvent,
} from "../apis/supabase/logging.js";
import { logger } from "../apis/logging.js";
import {
  createResponseToXmtp,
  RequestFromXmtp,
  REQUEST_FROM_XMTP,
  ResponseToXmtp,
} from "../apis/express.js";
import { readUserRequest } from "../apis/cache.js";
import { semanticSearch } from "../features/semantic-search.js";

const server = express();

server.use(express.json());

server.get("/heartbeat", (req, res) => {
  res.send("Not dead yet!");
});

server.get("/version", (req, res) => {
  res.send(process.env.GITHUB_SHA);
});

server.post("/from/xmtp", async (req, res) => {
  const authResult = authenticateRequest({ req });
  if (!authResult.isAuthenticated) {
    // TODO
    return res.status(401).send("Unauthorized");
  }
  const body = REQUEST_FROM_XMTP.safeParse(req.body);
  if (!body.success) {
    return res.status(400).send("Invalid event received from XMTP");
  } else {
    const request = body.data;
    logger.event(convertRequest(request));
    if (isEscalated({ id: request.payload.user_id })) {
      postMessageToFront({
        handle: request.payload.user_id,
        question: request.payload.request,
        answer: "Thread is escalated, not replying to user.",
        user_request_event_id: request.id,
      });
    } else {
      const robotRequest = createRobotRequest({
        question: request.payload.request,
      });
      logger.event(convertRobotRequest(robotRequest));
      const answer = await postRobotQuestion({ request: robotRequest });
      if (!answer.ok) {
        logger.error({
          id: uuidv4(),
          created_at: new Date(),
          type: "robot_response_error_event",
          payload: {
            message: "Unknown error from robopy",
          },
        });
        return res.status(500).send("Error posting robot question");
      } else {
        const response = createResponseToXmtp({
          message: answer.answer,
          request,
        });
        logger.event(convertResponse(response));
        return res.status(200).send(response);
      }
    }
  }
});

// TODO THIS DOES NOT WORK YET
server.post("/from/front", async (req, res) => {
  const authResult = authenticateRequest({ req });
  if (!authResult.isAuthenticated) {
    // TODO
    return res.status(401).send("Unauthorized");
  }

  const messageValidation = FRONT_MESSAGE.safeParse({
    message: req.body,
  });
  if (!messageValidation.success) {
    return res.status(400).send("Invalid message received from Front");
  }
  const message = messageValidation.data;
  try {
    if (message.text === "ROBOT COMMAND -> ESCALATE") {
      escalate({ id: getRecipientHandle({ message }) });
      // TODO Front expexts a certain message format.
      return res.status(200).send("OK");
    } else if (message.text === "ROBOT COMMAND -> DEESCALATE") {
      deescalate({ id: getRecipientHandle({ message }) });
      // TODO Front expexts a certain message format.
      return res.status(200).send("OK");
    } else {
      const userRequestEvent = readUserRequest({
        id: getRecipientHandle({ message }),
      });
      if (userRequestEvent === null) {
        // TODO ERROR HANDLING
      } else {
        // return sendMessage({
        //   peerAddress: INTERNAL_XMTP_ADDRESS,
        //   message: message.text,
        // });
      }
    }
  } catch (error) {
    if (!(error instanceof Error)) {
      return { error: `Unknown error: ${error}` };
    } else {
      return { error: error.message };
    }
  }
});

server.get("/get-similar", async (req, res) => {
  const query = req.query.query;
  if (typeof query !== "string") {
    return res.status(400).send("Missing question parameter");
  }
  await semanticSearch({ query });
  res.send("Not dead yet!");
});

const authenticateRequest = ({ req }: { req: Request }) => {
  if (req === undefined || req === null) {
    return { isAuthenticated: false };
  } else {
    return { isAuthenticated: true };
  }
};

server.listen(8080, () => logger.info("Listening on http://localhost:8080"));

// TODO Naming isn't good but I think I want to create a giant generic function
// that converts from one type to another.
const convertRequest = (request: RequestFromXmtp): UserRequestEvent => {
  return {
    id: request.id,
    created_at: request.created_at,
    type: "user_request_event",
    payload: request.payload,
  };
};
const convertResponse = (response: ResponseToXmtp): UserResponseEvent => {
  return {
    id: response.id,
    created_at: response.created_at,
    type: "user_response_event",
    payload: {
      user_request_event_id: response.payload.request_from_xmtp_id,
      response: response.payload.response,
    },
  };
};

const convertRobotRequest = (request: RobotRequest): RobotRequestEvent => {
  return {
    id: request.id,
    created_at: request.created_at,
    type: "robot_request_event",
    payload: request.payload,
  };
};
