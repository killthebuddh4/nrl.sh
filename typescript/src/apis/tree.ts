import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { DialogueMessage } from "../features/prompts-and-completions.js";

export const VALUE = z.object({
  interlocutor: z.enum([
    "SOCRATES",
    "PHAEDRUS",
    // "PROTAGORAS",
    // "DAIMON",
    // "ORACLE",
  ]),
  message: z.string(),
});

export type Value = z.infer<typeof VALUE>;

const TREE_NODE_BASE = z.object({
  id: z.string(),
  value: VALUE,
});

export const TREE_NODE: z.ZodType<TreeNode> = TREE_NODE_BASE.extend({
  parent: z.lazy(() => TREE_NODE).optional(),
  children: z.lazy(() => TREE_NODE.array()),
});

export type TreeNode = z.infer<typeof TREE_NODE_BASE> & {
  parent?: TreeNode;
  children: Array<TreeNode>;
};

export type SerializableTreeNode = TreeNode & {
  parent: undefined;
  children: Array<SerializableTreeNode>;
};

export const Tree = {
  /* **************************************************************************
   *
   * CORE TREE FUNCTIONS
   *
   * *************************************************************************/

  create: ({
    value,
    parent,
    children,
  }: {
    value: Value;
    parent?: TreeNode;
    children?: Array<TreeNode>;
  }): TreeNode => {
    return { id: uuidv4(), parent, children: children || [], value };
  },

  branch: ({ node, branches }: { node: TreeNode; branches: Array<Value> }) => {
    node.children = [
      ...node.children,
      ...branches.map((value) => Tree.create({ value, parent: node })),
    ];
  },

  grow: ({ node, value }: { node: TreeNode; value: Value }) => {
    Tree.branch({ node, branches: [value] });
  },

  replace: ({ node, value }: { node: TreeNode; value: Value }) => {
    node.value = value;
    return node;
  },

  find: ({
    node,
    id,
  }: {
    node: TreeNode;
    id: string;
  }): TreeNode | undefined => {
    if (node.id === id) {
      return node;
    } else {
      for (const child of node.children) {
        const found = Tree.find({ node: child, id: id });
        if (found) {
          return found;
        }
      }
      return undefined;
    }
  },

  path: <T>({
    toNode,
    map,
  }: {
    toNode: TreeNode;
    map: (node: TreeNode) => T;
  }): T[] => {
    const path: T[] = [];
    let node = toNode;
    while (node.parent) {
      path.unshift(map(node));
      node = node.parent;
    }
    path.unshift(map(node));
    return path;
  },

  traverse: ({
    node,
    fn,
  }: {
    node: TreeNode;
    fn: (node: TreeNode) => void;
  }): void => {
    fn(node);
    for (const child of node.children) {
      Tree.traverse({ node: child, fn });
    }
  },

  /* **************************************************************************
   *
   * UTILITIES
   *
   * *************************************************************************/

  toDialogue: ({
    fromLastNode,
  }: {
    fromLastNode: TreeNode;
  }): DialogueMessage[] => {
    return Tree.path({
      toNode: fromLastNode,
      map: (node): DialogueMessage => ({
        role: node.value.interlocutor,
        content: node.value.message,
      }),
    });
  },

  stripParents: ({ node }: { node: TreeNode }): SerializableTreeNode => {
    return {
      id: node.id,
      value: node.value,
      parent: undefined,
      children: node.children.map((child) =>
        Tree.stripParents({ node: child })
      ),
    };
  },

  addParents: ({
    parent,
    node,
  }: {
    parent?: TreeNode;
    node: TreeNode;
  }): TreeNode => {
    return {
      id: node.id,
      value: node.value,
      parent,
      children: node.children.map((child) =>
        Tree.addParents({ parent: node, node: child })
      ),
    };
  },

  layout: ({ root }: { root: TreeNode }) => {
    const coordinates: Array<{ node: TreeNode; x: number; y: number }> = [];

    const generateCoordinates = (
      node: TreeNode,
      depth: number,
      offset: number
    ) => {
      if (node.children.length === 0) {
        const x = coordinates.filter((c) => c.y === depth).length;
        coordinates.push({ node, x, y: depth });
      } else {
        for (const child of node.children) {
          generateCoordinates(child, depth + 1, offset);
        }

        const childrenX = node.children.map((child) => {
          const childCoord = coordinates.find((coord) => coord.node === child);
          if (childCoord === undefined) {
            throw new Error("Child coordinate not found");
          }
          return childCoord.x;
        });

        const avgX =
          childrenX.reduce((sum, x) => sum + x, 0) / childrenX.length;
        coordinates.push({ node, x: avgX, y: depth });
      }
    };

    generateCoordinates(root, 0, 1);
    return coordinates;
  },
};
