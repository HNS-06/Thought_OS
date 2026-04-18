import useMeasure from 'react-use-measure';
import type { ThoughtNode } from './types';

export function NeuralCanvas({ 
  nodes = [],
  linkingSourceId = null,
  mousePos = { x: 0, y: 0 }
}: { 
  nodes?: ThoughtNode[],
  linkingSourceId?: string | null,
  mousePos?: { x: number, y: number }
}) {
  const [ref, { width, height }] = useMeasure();

  // Extract all connections
  const connections = nodes.flatMap(node => node.connections || []);
  
  const linkingSource = linkingSourceId ? nodes.find(n => n.id === linkingSourceId) : null;

  return (
    <div ref={ref} className="absolute inset-0 z-0 overflow-hidden pointer-events-none min-w-[1000px] min-h-[600px]">
      <div className="absolute inset-0 bg-background transition-colors duration-300" />
      
      {/* Blueprint Grid */}
      <div className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(to_right,var(--color-outline)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-outline)_1px,transparent_1px)] bg-[size:40px_40px]" />
      <div className="absolute inset-0 opacity-[0.01] bg-[linear-gradient(to_right,var(--color-outline)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-outline)_1px,transparent_1px)] bg-[size:200px_200px]" />

      <svg className="absolute inset-0 w-full h-full opacity-30">
        {width > 0 && connections.map((conn, idx) => {
          const source = nodes.find(n => n.id === conn.sourceId);
          const target = nodes.find(n => n.id === conn.targetId);
          if (!source || !target) return null;
          return (
            <line 
              key={idx}
              x1={width * (source.x / 100)} 
              y1={height * (source.y / 100)} 
              x2={width * (target.x / 100)} 
              y2={height * (target.y / 100)} 
              stroke="var(--color-outline)" 
              strokeWidth="2" 
              opacity="0.3" 
            />
          );
        })}
        {/* Active connection line */}
        {width > 0 && linkingSource && (
          <line
            x1={width * (linkingSource.x / 100)}
            y1={height * (linkingSource.y / 100)}
            x2={mousePos.x}
            y2={mousePos.y}
            stroke="var(--color-primary)"
            strokeWidth="2"
            strokeDasharray="4 4"
            className="animate-pulse"
          />
        )}
      </svg>
    </div>
  );
}
