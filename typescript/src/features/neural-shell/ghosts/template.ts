import { Shell } from "../protocol";
import * as utils from "../session";

export const exec = async ({ root }: { root: Shell }) => {
  let shell = root;
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

  const daemon = shell.machine.daemons.find((d) => d.name === command);

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

  shell = {
    parent: shell.parent,
    children: shell.children,
    machine: shell.machine,
    session: utils.sessionFromString({ fromString: session }),
  };

  /* ************************************************************************
   * EXECUTE DAEMON
   * ************************************************************************/

  await daemon.exec({ shell });

  /* ************************************************************************
   * POST PROCESS OUTPUTS
   * ************************************************************************/

  // TODO:
};
