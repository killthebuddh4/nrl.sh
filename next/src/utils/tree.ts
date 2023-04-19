import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

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
    console.log("Tree.branch called");
    node.children = [
      ...node.children,
      ...branches.map((value) => Tree.create({ value, parent: node })),
    ];
    console.log("Tree.branch done");
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

  nodes: ({
    node,
    onPath,
  }: {
    node: TreeNode;
    onPath: string[];
  }): TreeNode[] => {
    const nodes: TreeNode[] = [];
    for (const id of onPath) {
      const found = Tree.find({ node, id });
      if (found === undefined) {
        throw new Error("Node in path not found");
      }
      nodes.push(found);
    }
    return nodes;
  },

  path: ({ toNode }: { toNode: TreeNode }): string[] => {
    const path = [];
    let node = toNode;
    while (node.parent) {
      path.unshift(node.id);
      node = node.parent;
    }
    path.unshift(node.id);
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
};
