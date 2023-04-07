import { z } from "zod";
import xmtp from "@xmtp/xmtp-js";
const { Client } = xmtp;
import type { DecodedMessage, Client as TClient } from "@xmtp/xmtp-js";
import { Wallet } from "@ethersproject/wallet";

/* ****************************************************************************
 *
 * TYPES
 *
 * ************************************************************************** */

export const XMTP_ADDRESS = z.string().superRefine((val, ctx) => {
  if (val.length !== 42) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "XMTP address must be 42 characters long",
    });
  }

  if (!val.startsWith("0x")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "XMTP address must start with 0x",
    });
  }
});

export const XMTP_HEARTBEAT_RESPONSE = z.object({
  timeout_id: z.string(),
  ok: z.boolean(),
});

export type XmtpHeartbeatResponse = z.infer<typeof XMTP_HEARTBEAT_RESPONSE>;

export const XMTP_HEARTBEAT_REQUEST = z.object({
  requester_address: z.string(),
  timeout_id: z.string(),
});

export type XmtpHeartbeatRequest = z.infer<typeof XMTP_HEARTBEAT_REQUEST>;

/* ****************************************************************************
 *
 * CLIENT
 *
 * ************************************************************************** */

export class Xmtp {
  private listeners: Array<(msg: DecodedMessage) => void> = [];
  private wallet: Promise<Wallet>;
  private client: Promise<TClient>;
  private stream: Promise<AsyncIterableIterator<DecodedMessage>>;

  public constructor({ pk }: { pk: string }) {
    const wallet = (async () => {
      return new Wallet(pk);
    })();

    const client = (async () => {
      const internal = await Client.create(await wallet, {
        env: "production",
      });
      return internal;
    })();

    const stream = (async () => {
      const internal = await (await client).conversations.streamAllMessages();
      (async () => {
        for await (const message of internal) {
          for (const listener of this.listeners) {
            listener(message);
          }
        }
      })();
      return internal;
    })();

    this.wallet = wallet;
    this.client = client;
    this.stream = stream;

    (async () => {
      await wallet;
      await client;
      await stream;
    })();
  }

  /* ****************************************************************************
   *
   * API
   *
   * ************************************************************************** */

  public address = async () => {
    return (await this.wallet).address;
  };

  public addListener = (listener: (msg: DecodedMessage) => void) => {
    this.listeners.push(listener);
  };

  public sendMessage = async ({
    peerAddress,
    message,
  }: {
    peerAddress: string;
    message: string;
  }) => {
    const conversation = await (
      await this.client
    ).conversations.newConversation(peerAddress);
    return await conversation.send(message);
  };

  public sendHeartbeatRequest = async ({
    peerAddress,
    request,
  }: {
    peerAddress: string;
    request: XmtpHeartbeatRequest;
  }) => {
    await this.stream;
    return await this.sendMessage({
      peerAddress,
      message: JSON.stringify(request),
    });
  };

  public sendHeartbeatResponse = async ({
    request,
  }: {
    request: XmtpHeartbeatRequest;
  }) => {
    this.sendMessage({
      peerAddress: request.requester_address,
      message: JSON.stringify({
        timeout_id: request.timeout_id,
        ok: true,
      }),
    });
  };

  public isSelfSentMessage = async (msg: DecodedMessage) => {
    return msg.senderAddress === (await this.wallet).address;
  };

  public getHeartbeatRequest = (message: DecodedMessage) => {
    try {
      const json = JSON.parse(message.content);
      if (XMTP_HEARTBEAT_REQUEST.safeParse(json).success) {
        return json as XmtpHeartbeatRequest;
      } else {
        return null;
      }
    } catch (e) {
      return null;
    }
  };

  public getHeartbeatResponse = (message: DecodedMessage) => {
    try {
      const json = JSON.parse(message.content);
      if (XMTP_HEARTBEAT_RESPONSE.safeParse(json).success) {
        return json as XmtpHeartbeatResponse;
      } else {
        return null;
      }
    } catch {
      return null;
    }
  };
}
