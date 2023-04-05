import {
  Client as DiscordClient,
  GatewayIntentBits,
  TextChannel,
  Message,
  Events,
} from 'discord.js';
import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';

const RELAY_BRIDGE_TOKEN = process.env['RELAY_BRIDGE_TOKEN'];
if (RELAY_BRIDGE_TOKEN === undefined) {
  throw new Error('No RELAY_BRIDGE_TOKEN found to initialize Discord client!');
}

const DISCORD_CHANNEL_ID = process.env['DISCORD_CHANNEL_ID'];
if (DISCORD_CHANNEL_ID === undefined) {
  throw new Error('No DISCORD_CHANNEL_ID found to initialize Discord client!');
}

let handler: ((address: string, message: string) => unknown) | null = null;

const send = {
  data: new SlashCommandBuilder()
    .setName('send')
    .setDescription('Send an XMTP message via Relay Bridge!')
    .addStringOption((option) =>
      option
        .setName('address')
        .setDescription('Enter address')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('message')
        .setDescription('Enter a message')
        .setRequired(true)
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName === 'send') {
      if (handler === null) {
        interaction.reply('Got the message, but no handler registered!');
      } else {
        handler(
          interaction.options.getString('address') as string,
          interaction.options.getString('message') as string
        );
        interaction.reply('Your message was sent!');
      }
    }
  },
};

const discordClient = new DiscordClient({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
});

discordClient.once('ready', function (this: DiscordClient) {
  const self = this;
  self.addListener(
    'newXmtpMessage',
    async (address: string, message: string) => {
      const channel = (await self.channels.fetch(DISCORD_CHANNEL_ID)) as TextChannel;
      let thread;
      thread = channel.threads.cache.find((thread) => thread.name === address);
      if (thread === undefined) {
        thread = await channel.threads.create({
          name: address,
          autoArchiveDuration: 60,
          reason: 'One thread per address',
        });
      }
      thread.send(message);
    }
  );
});

discordClient.on('messageReactionAdd', (reaction, user) => {
  console.log('reaction', reaction)
  console.log('user', user)

});

// discordClient.on(Events.MessageReactionAdd, async (reaction, user) => {
//   console.log('reaction', reaction)
//   console.log('user', user)

// });


discordClient.on('interactionCreate', async (interaction) => {
  console.log('interaction', interaction)
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  if (commandName === 'send') {
    await send.execute(interaction);
  }
});

discordClient.on('messageCreate', async function (message: Message) {
  if (message.author.bot) return;

  const channel = message.channel;
  if (!channel.isThread()) {
    return;
  } else {
    const address = channel.name;
    if (address === undefined) {
      return;
    } else {
      discordClient.emit('newMessageForXmtp', address, message.content);
    }
  }
});

discordClient.login(RELAY_BRIDGE_TOKEN);

export const registerFromDiscordHandler = (
  newHandler: (adddress: string, message: string) => unknown
) => {
  handler = newHandler;
};

export const discord = discordClient;