import { Message, Events } from "discord.js";
import { local } from "../utils/chalk.js";
import { client } from "../apis/discord.js";
import { createRequestFromDiscord, postFromDiscord } from "../apis/express.js";

// handle reaction from discord
client.on(Events.MessageReactionAdd, (reaction, user) => {
  local.blue("reaction" + reaction);
  local.blue("user" + user);
});

// Handle message from discord.
client.on(Events.MessageCreate, async function (message: Message) {
  if (message.author.bot) return;

  const channel = message.channel;
  if (!channel.isThread()) {
    postFromDiscord(
      createRequestFromDiscord({ address: "admin", content: message.content })
    );
  } else {
    const address = channel.name;
    if (address === undefined) {
      return;
    } else {
      postFromDiscord(
        createRequestFromDiscord({ address, content: message.content })
      );
    }
  }
});
