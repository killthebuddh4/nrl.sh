import { Machine, Shell } from "../protocol";
import * as Ghost from "../ghosts/template.js";
import * as Daemon from "../daemons/template.js";

export const GHOST = Ghost;

export const DAEMONS = [Daemon];

export const CONNECT = function ({
  machine,
  fromShell,
}: {
  machine: Machine;
  fromShell: Shell;
}) {
  return {
    shell: {
      parent: fromShell,
      children: [],
      machine,
      session: [],
    },
  };
};
