import { useCallback, useEffect } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
} from 'reactflow';
import 'reactflow/dist/style.css';

const initialNodes = [
  { id: '1', position: { x: 0, y: 0 }, data: { label: '1' } },
  { id: '2', position: { x: 0, y: 100 }, data: { label: '2' } },
];

const initialEdges = [{ id: 'e1-2', source: '1', target: '2' }];

const Flow = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    (async () => {
      const dialogues = Plato.get();
      console.log(dialogues);
    })();
  }, []);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={(params) => {
        return setEdges((eds) => addEdge(params, eds));
      }}
    >
      <MiniMap />
      <Controls />
      <Background />
    </ReactFlow>
  );
}

const Page = () => {
  return (
    <div className="h-screen w-screen bg-slate-300">
      <Flow />
    </div>
  );
};

export default Page;