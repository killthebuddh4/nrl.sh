import { z } from "zod";

/* ****************************************************************************
 *
 * CONFIG
 *
 * ************************************************************************** */

export const API_KEY = (() => {
  if (process.env.FRONT_API_KEY === undefined) {
    throw new Error("FRONT_API_KEY environment variable is not set");
  } else {
    return process.env.FRONT_API_KEY;
  }
})();

/* ****************************************************************************
 *
 * TYPES
 *
 * ************************************************************************** */

const MESSAGE_ACCEPTED_RESPONSE = z.object({
  status: z.literal("accepted"),
  message_uid: z.string(),
});

export type MessageAcceptedResponse = z.infer<typeof MESSAGE_ACCEPTED_RESPONSE>;

export const FRONT_MESSAGE = z.object({
  text: z.string(),
  recipients: z.array(
    z.object({
      role: z.enum(["to", "from"]),
      handle: z.string(),
    })
  ),
});

export type FrontMessage = z.infer<typeof FRONT_MESSAGE>;

/* ****************************************************************************
 *
 * API
 *
 * ************************************************************************** */

export const postMessageToFront = async ({
  handle,
  question,
  answer,
  user_request_event_id,
}: {
  handle: string;
  question: string;
  answer: string;
  user_request_event_id: string;
}) => {
  const body = JSON.stringify({
    sender: {
      handle,
    },
    subject: "Relay Robot <> ENS",
    body: getMarkdownQuestionResponse({ question, answer }),
    body_format: "markdown",
    metadata: { headers: { user_request_event_id } },
  });
  const responseFromFront = await fetch(
    "https://relayf199.api.frontapp.com/channels/cha_ct9p0/incoming_messages",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body,
    }
  );
  if (!responseFromFront.ok) {
    // TODO ERROR HANDLING
  }
};

/* ****************************************************************************
 *
 * HELPERS
 *
 * ************************************************************************** */

export const getRecipientHandle = ({ message }: { message: FrontMessage }) => {
  const recipient = message.recipients.find(
    (recipient) => recipient.role === "to"
  );
  if (recipient === undefined || typeof recipient.handle !== "string") {
    throw new Error(
      "We expect a message from Front to have a recipient with a string handle"
    );
  }
  return recipient.handle;
};

const getMarkdownQuestionResponse = ({
  question,
  answer,
}: {
  question: string;
  answer: string;
}): string => {
  return `### Question\n\n${question}\n\n### Answer\n\n${answer}`;
};
