import { discord } from './bridges/discord.js';
import { Xmtp } from "../apis/xmtp.js";
import { createRobotRequest, postRobotQuestion } from "../apis/question-answering.js";
import { logger } from "../apis/logging.js";


let ROBOT_ACTIVATED = true

const XMTP_CLIENT_PK = process.env['XMTP_CLIENT_PK'];
if (XMTP_CLIENT_PK === undefined) {
  throw new Error('No XMTP_CLIENT_PK found to initialize XMTP client!');
}
const xmtp = new Xmtp({ pk: XMTP_CLIENT_PK });

// Log the XMTP address to the console
(async () => logger.info(`xmtp address: ${await xmtp.address()}`))();

xmtp.addListener(async (xmtpMessage) => {
  if (await xmtp.isSelfSentMessage(xmtpMessage)) return;

  const peerAddress = xmtpMessage.senderAddress;
  const question = xmtpMessage.content;

  // Log the users message to Discord
  logger.info(`Got XMTP message from ${peerAddress} -- message: ${xmtpMessage.content}`)
  discord.emit('newXmtpMessage', peerAddress, `User: ${xmtpMessage.content}`);

  if(!ROBOT_ACTIVATED) return;

  // Get response from Robot and log to Discord and send to xmtp
  const request = createRobotRequest({ question });
  const answer = await postRobotQuestion({ request });
  const message = answer.answer;

  // Sleep for one second for now while we have a stub answer from the bot
  await new Promise(resolve => setTimeout(resolve, 1000));
  discord.emit('newXmtpMessage', peerAddress, `Robot: ${message}`);
  xmtp.sendMessage({ peerAddress, message })
});

discord.addListener('newMessageForXmtp', (address: string, message: string) => {
  logger.info(`Got message from discord thread: ${address} -- message: ${message}`)
  ROBOT_ACTIVATED = false
  const peerAddress = address;
  xmtp.sendMessage({ peerAddress, message: `Live Agent: ${message}` })
});
