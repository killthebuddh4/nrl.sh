import winston from "winston";
import Transport, { TransportStreamOptions } from "winston-transport";
import {
  EventLog,
  WarningLog,
  ErrorLog,
  Log,
  writeLog,
} from "./supabase/logging.js";

/* ****************************************************************************
 *
 * CLIENT
 *
 * ************************************************************************** */

class SupabaseTransport extends Transport {
  constructor(opts: TransportStreamOptions | undefined) {
    super(opts);
  }

  log(info: { log: Log }, callback: () => void) {
    setImmediate(() => {
      this.emit("logged", info);
    });

    (async () => {
      const { error } = await writeLog(info.log);
      if (error !== null) {
        // TODO: What do we do in this scenario?
        /* eslint-disable-next-line no-console */
        console.error("Error inserting event into supabase", error);
      }
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
