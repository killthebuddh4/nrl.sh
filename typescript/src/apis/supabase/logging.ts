import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { clients } from "./clients.js";
import winston from "winston";
import Transport, { TransportStreamOptions } from "winston-transport";

/* ****************************************************************************
 *
 * TYPES
 *
 * ****************************************************************************/

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

/* ****************************************************************************
 *
 * Supabase API
 *
 * ****************************************************************************/

export const Log = {
  write: {
    one: async ({ data }: { data: z.infer<typeof LOG> }) => {
      try {
        return await clients.app
          .from("robot_events")
          .insert([data])
          .throwOnError();
      } catch (error) {
        throw error;
      }
    },
  },

  read: {
    one: {
      byId: async ({ id }: { id: string }) => {
        try {
          const { data } = await clients.app
            .from("robot_events")
            .select("*")
            .eq("id", id)
            .single()
            .throwOnError();

          return LOG.parse(data);
        } catch (error) {
          throw error;
        }
      },
    },
  },
};

/* ****************************************************************************
 *
 * Winston Transport
 *
 * ****************************************************************************/

class SupabaseTransport extends Transport {
  constructor(opts: TransportStreamOptions | undefined) {
    super(opts);
  }

  log(info: { log: z.infer<typeof LOG> }, callback: () => void) {
    setImmediate(() => {
      this.emit("logged", info);
    });

    (async () => {
      Log.write.one({ data: info.log });
    })();

    callback();
  }
}

const transports = [
  new SupabaseTransport({ level: "event" }),
  new winston.transports.Console(),
];
if (process.env.NODE_ENV !== "production") {
  transports.push(
    new winston.transports.Console({
      format: winston.format.simple(),
    })
  );
}

const internal = winston.createLogger({
  levels: {
    error: 0,
    warn: 1,
    event: 2,
    info: 3,
  },
  format: winston.format.json(),
  transports,
});

/* ****************************************************************************
 *
 * API
 *
 * ************************************************************************** */

const info = (info: unknown) => {
  internal.log("info", info);
};

const warn = (log: WarningLog) => {
  internal.log("warn", { log });
};

const error = (log: ErrorLog) => {
  internal.log("error", { log });
};

const event = (log: EventLog) => {
  internal.log("event", { log });
};

export const logger = {
  info,
  warn,
  error,
  event,
};

export const debug = (err: unknown) => {
  if (process.env.NODE_ENV !== "production") {
    /* eslint-disable-next-line no-console */
    console.error(JSON.stringify(err, null, 2));
  }
};
