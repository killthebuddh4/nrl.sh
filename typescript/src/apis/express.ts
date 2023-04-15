import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

/* ****************************************************************************
 *
 * CONFIG
 *
 * ************************************************************************** */

export const EXPRESS_HOST = (() => {
  if (process.env.EXPRESS_HOST === undefined) {
    throw new Error("EXPRESS_HOST is not defined");
  } else {
    return process.env.EXPRESS_HOST;
  }
})();

export const EXPRESS_PORT = (() => {
  if (process.env.EXPRESS_PORT === undefined) {
    throw new Error("EXPRESS_PORT is not defined");
  } else {
    return process.env.EXPRESS_PORT;
  }
})();

export const ROBOT_DOMAIN = (() => {
  if (process.env.ROBOT_DOMAIN === undefined) {
    throw new Error("ROBOT_DOMAIN is not defined");
  } else {
    return process.env.ROBOT_DOMAIN;
  }
})();

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

export const Plato = {
  get: async () => {
    const response = await fetch(`${ROBOT_DOMAIN}/plato`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });
    const json = await response.json();
    // TODO zod here
    return json;
  },
};
