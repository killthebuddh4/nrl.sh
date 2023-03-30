import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { clients } from "./clients.js";

export const WARNING_LOG = z.object({
  id: z.string(),
  created_at: z.coerce.date(),
  type: z.string().regex(/^.*_warning_event$/),
  payload: z.object({
    reason: z.string(),
  }),
});

export type WarningLog = z.infer<typeof WARNING_LOG>;

export const ERROR_LOG = z.object({
  id: z.string(),
  created_at: z.coerce.date(),
  type: z.string().regex(/^.*_error_event$/),
  payload: z.object({
    message: z.string(),
  }),
});

export type ErrorLog = z.infer<typeof ERROR_LOG>;

export const INBOUND_XMTP_MESSAGE_EVENT = z.object({
  id: z.string(),
  created_at: z.coerce.date(),
  type: z.literal("inbound_xmtp_message_event"),
  payload: z.object({
    id: z.string(),
    senderAddress: z.string(),
  }),
});

export type InboundXmtpMessageEvent = z.infer<
  typeof INBOUND_XMTP_MESSAGE_EVENT
>;

export const OUTBOUND_XMTP_MESSAGE_EVENT = z.object({
  id: z.string(),
  created_at: z.coerce.date(),
  type: z.literal("outbound_xmtp_message_event"),
  payload: z.object({
    id: z.string(),
    peerAddress: z.string(),
  }),
});

export type OutboundXmtpMessageEvent = z.infer<
  typeof OUTBOUND_XMTP_MESSAGE_EVENT
>;

export const USER_REQUEST_EVENT = z.object({
  id: z.string(),
  created_at: z.coerce.date(),
  type: z.literal("user_request_event"),
  payload: z.object({
    client_id: z.string(),
    protocol_id: z.string(),
    user_id: z.string(),
    robot_id: z.string(),
    request: z.string(),
  }),
});

export type UserRequestEvent = z.infer<typeof USER_REQUEST_EVENT>;

export const USER_RESPONSE_EVENT = z.object({
  id: z.string(),
  created_at: z.coerce.date(),
  type: z.literal("user_response_event"),
  payload: z.object({
    user_request_event_id: z.string(),
    response: z.object({
      message: z.string(),
    }),
  }),
});

export type UserResponseEvent = z.infer<typeof USER_RESPONSE_EVENT>;

export const FRONT_MESSAGE_EVENT = z.object({
  id: z.string(),
  created_at: z.coerce.date(),
  type: z.literal("front_message_event"),
  payload: z.unknown(),
});

export type FrontMessageEvent = z.infer<typeof FRONT_MESSAGE_EVENT>;

export const ROBOT_REQUEST_EVENT = z.object({
  id: z.string(),
  created_at: z.coerce.date(),
  type: z.literal("robot_request_event"),
  payload: z.object({
    question: z.string(),
  }),
});

export type RobotRequestEvent = z.infer<typeof ROBOT_REQUEST_EVENT>;

export const ROBOT_RESPONSE_EVENT = z.object({
  id: z.string(),
  created_at: z.coerce.date(),
  type: z.literal("robot_response_event"),
  payload: z.object({
    answer: z.string(),
  }),
});

export type RobotResponseEvent = z.infer<typeof ROBOT_RESPONSE_EVENT>;

export const HEARTBEAT_EVENT = z.object({
  id: z.string(),
  created_at: z.coerce.date(),
  type: z.literal("heartbeat_event"),
  payload: z.object({}),
});

export const craeteHeartbeatEvent = () => {
  return {
    id: uuidv4(),
    created_at: new Date(),
    type: "heartbeat_event",
    payload: {},
  } as const;
};

export type HeartbeatEvent = z.infer<typeof HEARTBEAT_EVENT>;

export const EVENT_LOG = z.union([
  INBOUND_XMTP_MESSAGE_EVENT,
  OUTBOUND_XMTP_MESSAGE_EVENT,
  USER_REQUEST_EVENT,
  USER_RESPONSE_EVENT,
  FRONT_MESSAGE_EVENT,
  ROBOT_REQUEST_EVENT,
  ROBOT_RESPONSE_EVENT,
  HEARTBEAT_EVENT,
]);

export type EventLog = z.infer<typeof EVENT_LOG>;

export const LOG = z.union([WARNING_LOG, ERROR_LOG, EVENT_LOG]);

export type Log = z.infer<typeof LOG>;

export const writeLog = async (log: Log) => {
  return await clients.app.from("robot_events").insert([log]);
};

export const readLog = async (id: string) => {
  return await clients.app.from("robot_events").select("*").eq("id", id);
};
