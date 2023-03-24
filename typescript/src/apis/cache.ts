import { z } from "zod";

/* ****************************************************************************
 *
 * TYPES
 *
 * ************************************************************************** */

export const CACHED_USER_REQUEST = z.object({
  id: z.string(),
  created_at: z.coerce.date(),
  type: z.literal("cached_user_request"),
  payload: z.object({
    client_id: z.string(),
    protocol_id: z.string(),
    user_id: z.string(),
    robot_id: z.string(),
    request: z.string(),
  }),
});

export type CachedUserRequest = z.infer<typeof CACHED_USER_REQUEST>;

/* ****************************************************************************
 *
 * API
 *
 * ************************************************************************** */

const USER_REQUEST_CACHE: CachedUserRequest[] = [];

export const writeUserRequest = (request: CachedUserRequest) => {
  USER_REQUEST_CACHE.push(request);
  if (USER_REQUEST_CACHE.length > 100) {
    // TODO WARNING HANDLER
  }
};

export const readUserRequest = ({ id }: { id: string }) => {
  const requestIndex = USER_REQUEST_CACHE.findIndex((e) => e.id === id);
  if (requestIndex === -1) {
    return null;
  } else {
    return USER_REQUEST_CACHE.splice(requestIndex, 1).shift();
  }
};
