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

export type TreeNode = {
  parent: TreeNode | undefined;
  children: Array<TreeNode>;
  id: string;
  value: Value;
};

// const TREE_NODE_BASE = z.object({
//   id: z.string(),
//   value: VALUE,
// });

// const TREE_NODE: z.ZodType<TreeNode> = TREE_NODE_BASE.extend({
//   parent: z.lazy(() => TREE_NODE.optional()),
//   children: z.lazy(() => TREE_NODE.array()),
// });

// export type TreeNode = z.infer<typeof TREE_NODE_BASE> & {
//   parent: TreeNode | undefined;
//   children: Array<TreeNode>;
// };

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

  branch: ({
    node,
    branches,
  }: {
    node: TreeNode;
    branches: Array<Value>;
  }): TreeNode => {
    node.children = [
      ...node.children,
      ...branches.map((value) => Tree.create({ value, parent: node })),
    ];
    return node;
  },

  grow: ({ node, value }: { node: TreeNode; value: Value }): TreeNode => {
    return Tree.branch({ node, branches: [value] });
  },

  replace: ({ node, value }: { node: TreeNode; value: Value }): TreeNode => {
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
};

// async function generateTree(node: QATree): Promise<QATree> {
//   const apiResponse = await queryAPI(node);

//   switch (apiResponse.action) {
//     case 'grow':
//       const newNode = createNode<QA>({ question: apiResponse.question!, answer: apiResponse.answer! });
//       return generateTree(grow(node, newNode));
//     case 'branch':
//       const branches = [{ question: apiResponse.question!, answer: apiResponse.answer! }];
//       return generateTree(branch(node, branches));
//     case 'replace':
//       const replacedNode = createNode<QA>({ question: apiResponse.question!, answer: apiResponse.answer! });
//       return generateTree({ ...node, value: replacedNode.value });
//     case 'terminate':
//     default:
//       return node;
//   }
// }
