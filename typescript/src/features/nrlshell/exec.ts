import { Machine, Shell } from "./protocol.js";
import { Tree } from "../../apis/tree.js";

export const exec = async ({ machine }: { machine: Machine }) => {
  const { shell: root } = await machine.connect({});

  const next = () => {
    const predicate = (s: Shell) =>
      s.session.length === 0 ||
      s.session[s.session.length - 1].outputs.length === 0;

    return Tree.dfs<Shell>({
      tree: root,
      children: (s) => s.children,
      predicate,
    });
  };

  let shell = next();
  while (shell !== undefined) {
    if (shell.machine.ghost === undefined) {
      if (shell.machine.daemons.length !== 1) {
        throw new Error("No ghost and 0 or multiple daemons");
      } else {
        await shell.machine.daemons[0].exec({ shell });
      }
    } else {
      await shell.machine.ghost.exec({ shell });
    }
    shell = next();
  }

  return { shell: root };
};
