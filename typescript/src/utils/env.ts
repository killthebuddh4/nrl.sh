import { z } from "zod";

export const EXPRESS_HOST = (() => {
  try {
    return z.string().parse(process.env.EXPRESS_HOST);
  } catch (error) {
    return z.string().parse(process.env.NEXT_PUBLIC_EXPRESS_HOST);
  }
})();
export const EXPRESS_PORT = (() => {
  try {
    return z.string().parse(process.env.EXPRESS_PORT);
  } catch (error) {
    return z.string().parse(process.env.NEXT_PUBLIC_EXPRESS_PORT);
  }
})();

export const ROBOT_DOMAIN = (() => {
  try {
    return z.string().parse(process.env.ROBOT_DOMAIN);
  } catch (error) {
    return z.string().parse(process.env.NEXT_PUBLIC_ROBOT_DOMAIN);
  }
})();
