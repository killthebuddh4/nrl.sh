import { useCallback, useEffect, useState } from "react";
import ReactFlow, {
  Node,
  Edge,
  Handle,
  Position,
  MiniMap,
  Controls,
  Background,
  ReactFlowProvider,
  useReactFlow,
} from "reactflow";
import "reactflow/dist/style.css";
import { Plato, Socrates, Phaedrus } from "@/utils/api";
import { Tree, TreeNode } from "@/utils/tree";
import { create } from "zustand";
import { useLayout } from "@/utils/tree-layout";

interface DialogueStore {
  dialogue: TreeNode | null;
  setDialogue: (dialogue: TreeNode | null) => void;
  isUpdating: boolean;
  setIsUpdating: (isUpdating: boolean) => void;
}

const useDialogueStore = create<DialogueStore>((set) => ({
  dialogue: null,
  setDialogue: (dialogue) => set({ dialogue }),
  isUpdating: false,
  setIsUpdating: (isUpdating) => set({ isUpdating }),
}));

const useRefresh = () => {
  const setDialogue = useDialogueStore((state) => state.setDialogue);
  return useCallback(async () => {
    const { data: tree } = await Plato.get.call();
    if (tree === null) {
      setDialogue(null);
    } else {
      setDialogue(Tree.addParents({ node: tree }));
    }
  }, [setDialogue]);
};

const SocratesRoot = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="bg-green-800 p-4 rounded-md w-[512px]">{children}</div>
  );
};

const PhaedrusRoot = ({ children }: { children: React.ReactNode }) => {
  return <div className="bg-red-800 p-4 rounded-md w-[512px]">{children}</div>;
};

const DialogueNode = ({ data }: { data: TreeNode }) => {
  const refresh = useRefresh();
  const Root =
    data.value.interlocutor === "SOCRATES" ? SocratesRoot : PhaedrusRoot;
  return (
    <>
      <Handle type="target" position={Position.Top} />
      <Root>
        <h4>{data.id}</h4>
        <div className="m-2 mb-0">
          <button
            className="bg-slate-500 hover:bg-slate-600 p-4 m-2 rounded-md"
            onClick={async () => {
              await Socrates.breadth.call({
                rootId: "UNUSED",
                nodeId: data.id,
              });
              refresh();
            }}
          >
            Socrates.breadth
          </button>
          <button
            className="bg-slate-500 p-4 m-2 rounded-md"
            onClick={() => console.log("clicked")}
          >
            Socrates.depth
          </button>
          <button
            className="bg-slate-500 p-4 m-2 rounded-md"
            onClick={async () => {
              await Phaedrus.answer.call({
                rootId: "UNUSED",
                nodeId: data.id,
              });
              refresh();
            }}
          >
            Phaedrus
          </button>
        </div>
        <div className="m-4">
          <h3 className="text-black">Message</h3>
          <p>{data.value.message}</p>
        </div>
      </Root>
      <Handle type="source" position={Position.Bottom} id={data.id} />
    </>
  );
};

const nodeTypes = {
  dialogue: DialogueNode,
};

const Flow = () => {
  const dialogue = useDialogueStore((state) => state.dialogue);
  const [nodes, setNodes] = useState<Node<TreeNode>[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const layout = useLayout();
  const refresh = useRefresh();
  const { fitView } = useReactFlow();

  useEffect(() => {
    (async () => {
      await Plato.init.call({
        interlocutor: "PHAEDRUS",
        message: "Can you please describe the stability mechanism behind DAI?",
      });
      refresh();
    })();
  }, [refresh]);

  useEffect(() => {
    if (dialogue === null) {
      return;
    } else {
      const flowNodes = layout({ dialogue });
      const flowEdges: Edge[] = [];
      Tree.traverse({
        node: dialogue,
        fn: (node) => {
          if (node.parent) {
            flowEdges.push({
              id: `${node.parent.id}-${node.id}`,
              source: node.parent.id,
              target: node.id,
            });
          }
        },
      });

      setNodes(flowNodes);
      setEdges(flowEdges);
      fitView({ duration: 400 });
    }
  }, [dialogue, fitView, layout]);

  return (
    <ReactFlow
      nodeTypes={nodeTypes}
      nodes={nodes}
      edges={edges}
      onNodesChange={() => null}
      onEdgesChange={() => null}
      onConnect={() => null}
      minZoom={0.1}
    >
      <MiniMap />
      <Controls />
      <Background />
    </ReactFlow>
  );
};

const Page = () => {
  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    setIsClient(true);
  }, []);
  return (
    <ReactFlowProvider>
      <div className="h-screen w-screen bg-slate-300">
        {isClient && <Flow />}
      </div>
    </ReactFlowProvider>
  );
};

export default Page;
