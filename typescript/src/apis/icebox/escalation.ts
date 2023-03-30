import { z } from "zod";

/* ****************************************************************************
 *
 * TYPES
 *
 * ************************************************************************** */

export const ESCALATION = z.object({
  id: z.string(),
  type: z.literal("cached_escalation"),
  payload: z.object({
    is_escalated: z.boolean(),
  }),
});

export type Escalation = z.infer<typeof ESCALATION>;

/* ****************************************************************************
 *
 * CLIENT
 *
 * ************************************************************************** */

const ESCALATION_CACHE: Escalation[] = [];

const writeEscalation = (escalation: Escalation) => {
  ESCALATION_CACHE.push(escalation);
  if (ESCALATION_CACHE.length > 100) {
    // TODO WARNING HANDLER
  }
};

const readEscalation = ({ id }: { id: string }) => {
  const escalationIndex = ESCALATION_CACHE.findIndex((e) => e.id === id);
  if (escalationIndex === -1) {
    return null;
  } else {
    return ESCALATION_CACHE[escalationIndex];
  }
};

/* ****************************************************************************
 *
 * API
 *
 * ************************************************************************** */

export const isEscalated = ({ id }: { id: string }) => {
  const escalation = readEscalation({ id });
  if (escalation === null) {
    return false;
  } else {
    return escalation.payload.is_escalated;
  }
};

export const escalate = ({ id }: { id: string }) => {
  writeEscalation({
    id,
    type: "cached_escalation",
    payload: {
      is_escalated: true,
    },
  });
};

export const deescalate = ({ id }: { id: string }) => {
  writeEscalation({
    id,
    type: "cached_escalation",
    payload: {
      is_escalated: false,
    },
  });
};
