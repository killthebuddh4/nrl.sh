export const Tree = {
  dfs: <T = unknown>({
    tree,
    children,
    predicate,
  }: {
    tree: T;
    children: (node: T) => T[];
    predicate: (node: T) => boolean;
  }) => {
    const stack = [tree];
    while (stack.length > 0) {
      const current = stack.pop() as T;
      if (predicate(current)) {
        return current;
      } else {
        for (const child of children(current)
          .map((c) => c)
          .reverse()) {
          stack.push(child);
        }
      }
    }
  },

  path: <T>({
    toNode,
    parent,
    map,
  }: {
    toNode: T;
    parent: (node: T) => T | undefined;
    map: (node: T) => T;
  }): T[] => {
    const path: T[] = [map(toNode)];
    let p = parent(toNode);
    while (p) {
      path.unshift(map(p));
      p = parent(p);
    }
    return path;
  },

  traverse: <T>({
    node,
    children,
    fn,
  }: {
    node: T;
    children: (node: T) => T[];
    fn: (node: T) => void;
  }): void => {
    fn(node);
    for (const child of children(node)) {
      Tree.traverse({ node: child, children, fn });
    }
  },
};

// export const exec = async ({ session }: { session: NeuralShellSession }) => {
//   const getNext = () => {
//     const predicate = (s: NeuralShellSession) => s.exit === undefined;
//     return Tree.dfs<NeuralShellSession>({
//       tree: session,
//       predicate,
//     });
//   };

//   let next = getNext();
//   while (next !== undefined) {
//     local.blue("red");
//     await iterate({ session: next });
//     next = getNext();
//   }
// };
