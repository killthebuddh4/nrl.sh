import { useCallback } from "react";
import { Node, Edge } from "reactflow";
import { stratify, tree } from "d3-hierarchy";
import { Tree, TreeNode } from "@/utils/tree";

const layout = tree<Node>()
  // the node size configures the spacing between the nodes ([width, height])
  .nodeSize([768, 768])
  // this is needed for creating equal space between all nodes
  .separation(() => 1);

export const useLayout = () => {
  return useCallback(({ dialogue }: { dialogue: TreeNode }) => {
    const flowNodes: Node<TreeNode>[] = [];
    const flowEdges: Edge[] = [];

    Tree.traverse({
      node: dialogue,
      fn: (node) => {
        flowNodes.push({
          id: node.id,
          type: "dialogue",
          data: node,
          position: { x: 0, y: 0 },
        });
        if (node.parent) {
          flowEdges.push({
            id: `${node.parent.id}-${node.id}`,
            source: node.parent.id,
            target: node.id,
          });
        }
      },
    });

    const hierarchy = stratify<Node<TreeNode>>()
      .id((d) => d.id)
      // get the id of each node by searching through the edges
      // this only works if every node has one connection
      .parentId((d: Node) => d.data.parent?.id)(flowNodes);

    // run the layout algorithm with the hierarchy data structure
    const root = layout(hierarchy);

    // set the React Flow nodes with the positions from the layout
    return flowNodes.map((node) => {
      // find the node in the hierarchy with the same id and get its
      // coordinates
      const layoutNode = root.find((d) => d.id === node.id);
      if (layoutNode === undefined) {
        throw new Error("layout node not found");
      }

      return {
        ...node,
        position: { x: layoutNode.x, y: layoutNode.y },
      };
    });
  }, []);
};
