import { Shell, Ghost } from "../protocol";
import * as utils from "../session";

/* ****************************************************************************
 *
 * NAME
 *
 * ***************************************************************************/

const NAME = "template";

/* ****************************************************************************
 *
 * FUNCTION
 *
 * ***************************************************************************/

const FUNCTION = `
This is the ghost's function.
`.trim();

/* ****************************************************************************
 *
 * EXEC
 *
 * ***************************************************************************/

const EXEC = async ({ shell }: { shell: Shell }) => {
  let session = utils.sessionToString({ shell });

  utils.printSession({ session });

  /* ************************************************************************
   * PICK DAEMON
   * ************************************************************************/

  session = utils.pushLeadCommand({
    toBase: session,
  });

  session = await utils.pushCompleteCommand({ fromBase: session });

  utils.printSession({ session });

  /* ************************************************************************
   * GET DAEMON FROM MACHINE
   * ************************************************************************/

  const command = utils.peekCommand({ fromBase: session });

  const daemon = shell.daemons.find((d) => d.name === command);

  if (daemon === undefined) {
    throw new Error(`Daemon ${command} not found`);
  }

  /* ************************************************************************
   * GENERATE INPUTS FOR DAEMON
   * ************************************************************************/

  for (const input of daemon.inputs) {
    session = utils.pushLeadOutput({ toBase: session, fromKey: input.key });

    utils.printSession({ session });

    session = await utils.pushCompleteOutput({
      fromBase: session,
    });

    utils.printSession({ session });
  }

  shell.session = utils.sessionFromString({ fromString: session });

  /* ************************************************************************
   * EXECUTE DAEMON
   * ************************************************************************/

  await daemon.exec({ shell });

  /* ************************************************************************
   * POST PROCESS OUTPUTS
   * ************************************************************************/

  // TODO:
};

/* ****************************************************************************
 *
 * GHOST
 *
 * ***************************************************************************/

export const ghost: Ghost = { name: NAME, function: FUNCTION, exec: EXEC };
