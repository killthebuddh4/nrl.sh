import { ghost } from "../ghosts/template.js";
import { Shell, Machine, Log } from "../protocol.js";
import { daemon } from "../daemons/template.js";
import { Tree } from "../../../apis/tree.js";

/* ****************************************************************************
 *
 * GHOST
 *
 * ***************************************************************************/

const GHOST = ghost;

/* ****************************************************************************
 *
 * DAEMONS
 *
 * ***************************************************************************/

const DAEMONS = [daemon];

/* ****************************************************************************
 *
 * BASTION
 *
 * ***************************************************************************/

const BASTION = ({ shell }: { shell?: Shell }) => {
  /* **************************************************************************
   * This machine must be the root, so the bastion blocks the connection if
   * shell is defined.
   * *************************************************************************/
  if (shell !== undefined) {
    return null;
  } else {
    // TODO Initialize the session with something interesting.
    return [];
  }
};

/* ****************************************************************************
 *
 * EXEC
 *
 * ***************************************************************************/

const EXEC = async ({ shell: root }: { shell: Shell }) => {
  /* **************************************************************************
   * DEFINE A STEP FUNCTION
   * *************************************************************************/

  /* next() needs to be implemented such that, if the task is not complete, it
   * returns the next shell to be executed. if the task is complete, it must
   * return undefined. */
  const next = () => {
    return Tree.dfs({
      tree: root,
      children: (s) => s.children,
      predicate: (s) =>
        s.session.length === 0 ||
        s.session[s.session.length - 1].outputs.length === 0,
    });
  };

  /* **************************************************************************
   * EXECUTE THE SHELL
   * *************************************************************************/

  let shell = next();
  while (shell !== undefined) {
    /* If the shell has a ghost, then the ghost takes over, otherwise, just use
     * the first daemon. */
    if (shell.ghost === undefined) {
      if (shell.daemons.length !== 1) {
        throw new Error("No ghost and 0 or multiple daemons");
      } else {
        await shell.daemons[0].exec({ shell });
      }
    } else {
      await shell.ghost.exec({ shell });
    }
    shell = next();
  }

  /* **************************************************************************
   * RETURN THE EXECUTED SHELL
   * *************************************************************************/

  return { shell: root };
};

/* ****************************************************************************
 *
 * CONNECT
 *
 * ***************************************************************************/

const CONNECT = async ({ fromShell }: { fromShell?: Shell }) => {
  const session = BASTION({ shell: fromShell });

  if (session === null) {
    return null;
  } else {
    return {
      shell: {
        parent: fromShell,
        children: [],
        ghost: GHOST,
        daemons: DAEMONS,
        session,
        exec: function () {
          return EXEC({ shell: this });
        },
      },
    };
  }
};

/* ****************************************************************************
 *
 * MACHINE
 *
 * ***************************************************************************/

export const machine: Machine = {
  connect: CONNECT,
  bastion: BASTION,
  ghost: GHOST,
  daemons: DAEMONS,
};
