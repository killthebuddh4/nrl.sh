import { z } from "zod";
import {
  Client as DiscordClient,
  GatewayIntentBits,
  TextChannel,
} from "discord.js";

/* ****************************************************************************
 *
 * CONFIG
 *
 * ****************************************************************************/

const RELAY_BRIDGE_TOKEN = z.string().parse(process.env["RELAY_BRIDGE_TOKEN"]);
const DISCORD_CHANNEL_ID = z.string().parse(process.env["DISCORD_CHANNEL_ID"]);

export const client = new DiscordClient({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
});

const isLoggedIn = client.login(RELAY_BRIDGE_TOKEN);

export const discord = client;

/* ****************************************************************************
 *
 * ACTIONS
 *
 * ****************************************************************************/

export const sendToDiscord = async ({
  address,
  message,
}: {
  address: string;
  message: string;
}) => {
  await isLoggedIn;
  const channel = (await client.channels.fetch(
    DISCORD_CHANNEL_ID
  )) as TextChannel;
  let thread;
  thread = channel.threads.cache.find((thread) => thread.name === address);
  if (thread === undefined) {
    thread = await channel.threads.create({
      name: address,
      autoArchiveDuration: 60,
      reason: "One thread per address",
    });
  }
  thread.send(message);
};
