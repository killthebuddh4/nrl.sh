import { v4 as uuidv4 } from "uuid";
import { Client as DiscordClient, TextChannel } from "discord.js";
import { Xmtp } from "../apis/xmtp.js";
import { getHeartbeat } from "../apis/express.js";
import { craeteHeartbeatEvent, getLog, logger } from "../apis/logger.js";

/* ****************************************************************************
 *
 * CONFIG
 *
 * ************************************************************************** */

const MONITOR_DISCORD_TOKEN = (() => {
  if (process.env["MONITOR_DISCORD_TOKEN"] === undefined) {
    throw new Error(
      "No MONITOR_DISCORD_TOKEN found to initialize Discord client!"
    );
  } else {
    return process.env["MONITOR_DISCORD_TOKEN"];
  }
})();

const MONITOR_DISCORD_CHANNEL_ID = (() => {
  if (process.env["MONITOR_DISCORD_CHANNEL_ID"] === undefined) {
    throw new Error(
      "No MONITOR_DISCORD_CHANNEL_ID found to initialize Discord client!"
    );
  } else {
    return process.env["MONITOR_DISCORD_CHANNEL_ID"];
  }
})();

export const MONITOR_HEARTBEAT_DOMAIN = (() => {
  if (process.env.MONITOR_HEARTBEAT_DOMAIN === undefined) {
    throw new Error("MONITOR_HEARTBEAT_DOMAIN is not defined");
  } else {
    return process.env.MONITOR_HEARTBET_DOMAIN;
  }
})();

export const MONITOR_RESPONDER_ID = (() => {
  if (process.env.MONITOR_RESPONDER_ID === undefined) {
    throw new Error("MONITOR_RESPONDER_ID is not defined");
  } else {
    return process.env.MONITOR_RESPONDER_ID;
  }
})();

export const MONITOR_XMTP_PK = (() => {
  if (process.env.MONITOR_XMTP_PK === undefined) {
    throw new Error("MONITOR_XMTP_PK is not defined");
  } else {
    return process.env.MONITOR_XMTP_PK;
  }
})();

export const MONITOR_ROBOT_XMTP_ADDRESS = (() => {
  if (process.env.MONITOR_ROBOT_XMTP_ADDRESS === undefined) {
    throw new Error("MONITOR_ROBOT_XMTP_ADDRESS is not defined");
  } else {
    return process.env.MONITOR_ROBOT_XMTP_ADDRESS;
  }
})();

/* ****************************************************************************
 *
 * DISCORD CLIENT
 *
 * ************************************************************************** */

const client = new DiscordClient({
  intents: [],
});

client.once("ready", function (this: DiscordClient) {
  this.addListener("new-alert", async (content: string) => {
    try {
      const channel = (await this.channels.fetch(
        MONITOR_DISCORD_CHANNEL_ID
      )) as TextChannel;
      const webhooks = await channel.fetchWebhooks();
      const webhook =
        webhooks.first() || (await channel.createWebhook({ name: "alerts" }));
      webhook.send({ content });
    } catch (error) {
      // TODO: Error handling
    }
  });
});

const alertFailedHeartbeat = async ({ type }: { type: string }) => {
  client.emit(
    "new-alert",
    `<@${MONITOR_RESPONDER_ID}> Heartbeat failed! (${type})`
  );
};

client.login(MONITOR_DISCORD_TOKEN);

/* ****************************************************************************
 *
 * HTTP SERVER HEARTBEAT
 *
 * ************************************************************************** */

setInterval(() => {
  (async () => {
    const isAlive = await (async () => {
      try {
        const response = await getHeartbeat();
        return response.ok;
      } catch (error) {
        return false;
      }
    })();

    if (!isAlive) {
      alertFailedHeartbeat({ type: "Express API" });
    }
  })();
}, 4000);

/* ****************************************************************************
 *
 * XMTP HEARTBEAT
 *
 * ************************************************************************** */

const XMTP_TIMEOUTS: Record<string, NodeJS.Timeout | undefined> = {};

const xmtp = new Xmtp({ pk: MONITOR_XMTP_PK });

xmtp.addListener(async (message) => {
  const heartbeatResponse = xmtp.getHeartbeatResponse(message);
  if (heartbeatResponse === null) {
    return;
  } else {
    clearTimeout(XMTP_TIMEOUTS[heartbeatResponse.timeout_id]);
  }
});

setInterval(() => {
  (async () => {
    const timeout_id = uuidv4();
    XMTP_TIMEOUTS[timeout_id] = setTimeout(() => {
      alertFailedHeartbeat({ type: "XMTP" });
    }, 7000);

    xmtp.sendHeartbeatRequest({
      peerAddress: MONITOR_ROBOT_XMTP_ADDRESS,
      request: {
        timeout_id,
        requester_address: await xmtp.address(),
      },
    });
  })();
}, 30000);

/* ****************************************************************************
 *
 * SUPABASE HEARTBEAT
 *
 * ************************************************************************** */

setInterval(() => {
  (async () => {
    const heartbeat = craeteHeartbeatEvent();
    logger.event(heartbeat);
    setTimeout(async () => {
      const logWasWritten = await (async () => {
        try {
          const { data, error } = await getLog(heartbeat.id);
          if (error !== null) {
            return false;
          }
          if (data === null) {
            return false;
          }
          return true;
        } catch {
          return false;
        }
      })();
      if (logWasWritten) {
        return;
      } else {
        alertFailedHeartbeat({ type: "Supabase" });
      }
    }, 3000);
  })();
}, 3000);
