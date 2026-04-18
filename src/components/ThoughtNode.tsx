import React, { useCallback } from 'react';
import { MoreVertical, Plus, Zap, Check, Trash2 } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { motion, useMotionValue } from 'motion/react';
import type { ThoughtNode } from '@/src/types';
import { socket } from '../lib/socket';

interface NodeProps {
  node: ThoughtNode;
  onExpand?: (id: string) => void;
  onDelete?: (id: string) => void;
  onToggleComplete?: (id: string) => void;
  isPanMode?: boolean;
  containerRef?: React.RefObject<HTMLDivElement | null>;
  // Link feature props
  linkingSourceId?: string | null;
  onStartLink?: (id: string) => void;
  onCompleteLink?: (id: string) => void;
  onCancelLink?: () => void;
  // Drag optimistic update
  onNodeMove?: (id: string, x: number, y: number) => void;
  onUpdateNode?: (id: string, updates: Partial<ThoughtNode>) => void;
}

function pctToPixels(pct: number, total: number) {
  return (pct / 100) * total;
}

function useNodeDrag(
  node: ThoughtNode,
  containerRef: React.RefObject<HTMLDivElement | null> | undefined,
  isPanMode: boolean,
  onNodeMove?: (id: string, x: number, y: number) => void
) {
  const [isDragging, setIsDragging] = React.useState(false);
  const dragStartOffset = React.useRef({ x: 0, y: 0 });
  const isDraggingRef = React.useRef(false); // parallel ref for rapid access in event handlers
  const lastEmitTime = React.useRef(0);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (isPanMode || !containerRef?.current || e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).isContentEditable) return; // ignore button clicks and text edits

    isDraggingRef.current = true;
    setIsDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    const rect = containerRef.current.getBoundingClientRect();
    const nodeEl = e.currentTarget as HTMLElement;
    const nodeRect = nodeEl.getBoundingClientRect();

    dragStartOffset.current = {
      x: e.clientX - nodeRect.left,
      y: e.clientY - nodeRect.top
    };
  }, [isPanMode, containerRef]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDraggingRef.current || !containerRef?.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    
    // Convert to percentage coordinates (0-100) exactly as in layout
    const xPx = e.clientX - rect.left - dragStartOffset.current.x;
    const yPx = e.clientY - rect.top - dragStartOffset.current.y;
    
    const newX = (xPx / rect.width) * 100;
    const newY = (yPx / rect.height) * 100;
    
    const clampedX = Math.max(0, Math.min(95, newX));
    const clampedY = Math.max(0, Math.min(90, newY));
    
    // Live update visuals!
    onNodeMove?.(node.id, clampedX, clampedY);

    // Throttle socket emit to roughly 20fps for performance
    const now = Date.now();
    if (now - lastEmitTime.current > 50) {
      socket.emit('node_drag', { id: node.id, x: clampedX, y: clampedY });
      lastEmitTime.current = now;
    }
  }, [node.id, containerRef, onNodeMove]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsDragging(false);
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    
    // Final sync
    socket.emit('node_drag', { id: node.id, x: node.x, y: node.y });
  }, [node]);

  return { isDragging, bind: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp } };
}

// ── Shared Port Component ──────────────────────────────────────────────────
function ConnectionPort({ 
  node, 
  linkingSourceId, 
  onStartLink, 
  onCompleteLink, 
  onCancelLink,
  className 
}: Partial<NodeProps> & { className?: string }) {
  const isSource = linkingSourceId === node?.id;
  const isLinking = !!linkingSourceId;

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        if (isSource) onCancelLink?.();
        else if (isLinking) onCompleteLink?.(node!.id);
        else onStartLink?.(node!.id);
      }}
      className={cn(
        "absolute rounded-full transition-all border border-black",
        isSource ? "w-4 h-4 bg-white scale-110 animate-pulse ring-2 ring-primary z-20" : 
        "w-3 h-3 bg-primary hover:scale-125 z-20",
        className
      )}
      title={isSource ? "Cancel link" : (isLinking ? "Connect here" : "Start Connection")}
    />
  );
}

// ── ConceptNode ───────────────────────────────────────────────────────────────
export function ConceptNode(props: NodeProps) {
  const { node, onExpand, onDelete, onToggleComplete, isPanMode = false, containerRef, onNodeMove, onUpdateNode } = props;
  const { isDragging, bind } = useNodeDrag(node, containerRef, isPanMode, onNodeMove);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: isDragging ? 1.02 : 1 }}
      className="absolute group"
      style={{ left: `${node.x}%`, top: `${node.y}%`, zIndex: isDragging ? 60 : 10 }}
      {...bind}
    >
      <div className="relative flex flex-col items-center">
        {node.status === 'active' && (
          <div className="absolute -top-1 -right-1 w-2.5 h-2.5 md:w-3 md:h-3 bg-primary rounded-full z-10 border border-black" />
        )}
        
        <ConnectionPort {...props} className="-right-1.5 top-1/2 -translate-y-1/2" />

        <div className={cn(
          "w-[280px] md:w-80 p-4 md:p-6 bg-surface border border-outline rounded-xl shadow-[4px_4px_0px_0px_var(--color-outline)] transition-all duration-200",
          isPanMode ? "cursor-default" : (isDragging ? "cursor-grabbing opacity-90 shadow-2xl scale-100" : "cursor-grab"),
          node.isComplete && "opacity-70"
        )}>
          <div className="flex justify-between items-start mb-3 md:mb-4">
            <span className="text-[9px] md:text-[10px] text-on-surface-variant uppercase tracking-widest font-black font-headline">
              Concept // {node.id.slice(-1)}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={(e) => { e.stopPropagation(); onToggleComplete?.(node.id); }}
                className={cn(
                  "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                  node.isComplete ? "bg-primary border-primary text-white" : "border-on-surface-variant hover:border-primary"
                )}
              >
                {node.isComplete && <Check className="w-3 h-3" />}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete?.(node.id); }}
                className="text-on-surface-variant hover:text-error transition-colors p-0.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <h3 className={cn(
            "font-headline text-base md:text-lg text-on-surface mb-1.5 md:mb-2 font-black uppercase tracking-tight",
            node.isComplete && "line-through opacity-60"
          )}>{node.title}</h3>
          
          <p 
            contentEditable={!isPanMode}
            suppressContentEditableWarning
            onPointerDown={e => e.stopPropagation()}
            onBlur={e => {
              const text = e.currentTarget.textContent || '';
              if (text !== node.description && onUpdateNode) {
                onUpdateNode(node.id, { description: text });
              }
            }}
            className="text-[10px] md:text-xs text-on-surface-variant font-medium leading-relaxed line-clamp-3 md:line-clamp-none outline-none focus:bg-surface-container-low focus:ring-1 focus:ring-outline rounded px-1 -mx-1"
          >
            {node.description}
          </p>

          {node.tags && (
            <div className="mt-4 flex flex-wrap gap-1.5 md:gap-2">
              {node.tags.map(tag => (
                <span key={tag} className="px-1.5 py-0.5 md:px-2 md:py-1 bg-surface-container-high text-[8px] md:text-[9px] rounded font-bold text-on-surface-variant uppercase tracking-wider border border-outline">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {node.featured && (
            <div className="mt-4 md:mt-6 pt-4 md:pt-6 border-t border-outline flex gap-4">
              <button
                onClick={(e) => { e.stopPropagation(); onExpand?.(node.id); }}
                className="w-full py-2 bg-on-surface text-surface font-black text-[9px] md:text-[10px] flex items-center justify-center gap-2 hover:bg-primary hover:text-white transition-all uppercase tracking-widest shadow-[4px_4px_0px_rgba(37,99,235,0.3)]"
              >
                <Plus className="w-2.5 md:w-3 h-2.5 md:h-3" />
                Expand Matrix
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── SphereNode ────────────────────────────────────────────────────────────────
export function SphereNode(props: NodeProps) {
  const { node, onDelete, onToggleComplete, isPanMode = false, containerRef, onNodeMove } = props;
  const { isDragging, bind } = useNodeDrag(node, containerRef, isPanMode, onNodeMove);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: isDragging ? 1.05 : 1 }}
      className="absolute group"
      style={{ left: `${node.x}%`, top: `${node.y}%`, zIndex: isDragging ? 60 : 10 }}
      {...bind}
    >
      <div className="relative flex flex-col items-center">
        {/* Complete + Delete controls */}
        <div className="absolute -top-3 -right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
          <button onClick={(e) => { e.stopPropagation(); onToggleComplete?.(node.id); }} className="w-6 h-6 bg-surface text-on-surface border border-outline rounded-full flex items-center justify-center hover:bg-primary hover:text-white shadow-sm">
            <Check className="w-3 h-3" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDelete?.(node.id); }} className="w-6 h-6 bg-surface text-error border border-outline rounded-full flex items-center justify-center hover:bg-error hover:text-white shadow-sm">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>

        <ConnectionPort {...props} className="bottom-0 left-1/2 -translate-x-1/2 translate-y-1.5" />

        <div className={cn(
          "w-32 h-32 md:w-40 md:h-40 rounded-full bg-surface border-2 border-outline flex flex-col items-center justify-center p-4 text-center transition-all",
          isDragging ? "shadow-[12px_12px_0px_0px_var(--color-on-surface)]" : "shadow-[6px_6px_0px_0px_var(--color-on-surface)]",
          isPanMode ? "cursor-default" : (isDragging ? "cursor-grabbing opacity-90" : "cursor-grab"),
          node.isComplete && "opacity-70 border-dashed"
        )}>
          <Zap className={cn("w-5 h-5 md:w-6 md:h-6 mb-2", node.isComplete ? "text-on-surface-variant" : "text-primary")} />
          <h3 className="font-headline text-[9px] md:text-[10px] text-on-surface font-black uppercase tracking-widest">{node.title}</h3>
        </div>
        <div className={cn(
          "absolute -bottom-2 md:-bottom-3 px-2 py-0.5 md:px-3 md:py-1 border-2 border-outline rounded text-[8px] md:text-[9px] font-black uppercase tracking-widest shadow-[2px_2px_0px_0px_var(--color-outline)]",
          node.status === 'active' ? "bg-primary text-white" : "bg-surface text-on-surface"
        )}>
          {node.status}
        </div>
      </div>
    </motion.div>
  );
}

// ── VisualNode ────────────────────────────────────────────────────────────────
export function VisualNode(props: NodeProps) {
  const { node, onDelete, onToggleComplete, isPanMode = false, containerRef, onNodeMove } = props;
  const { isDragging, bind } = useNodeDrag(node, containerRef, isPanMode, onNodeMove);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: isDragging ? 1.02 : 1 }}
      className="absolute group"
      style={{ left: `${node.x}%`, top: `${node.y}%`, zIndex: isDragging ? 60 : 10 }}
      {...bind}
    >
      <div className={cn(
        "relative bg-surface border-2 border-outline rounded-xl p-1 shadow-[4px_4px_0px_0px_var(--color-outline)] group transition-all",
        isPanMode ? "cursor-default" : (isDragging ? "cursor-grabbing opacity-90 shadow-2xl" : "cursor-grab"),
        node.isComplete && "opacity-70"
      )}>
        <div className="absolute top-2 right-2 flex gap-1 z-20">
          <button onClick={(e) => { e.stopPropagation(); onToggleComplete?.(node.id); }} className="w-5 h-5 bg-surface text-on-surface border border-outline rounded hover:bg-primary hover:text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Check className="w-2.5 h-2.5" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDelete?.(node.id); }} className="w-5 h-5 bg-surface text-error border border-outline rounded hover:bg-error hover:text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Trash2 className="w-2.5 h-2.5" />
          </button>
        </div>

        <ConnectionPort {...props} className="bottom-2 -right-1.5" />

        <div className="w-[200px] h-[150px] md:w-[280px] md:h-[200px] rounded-lg overflow-hidden relative border border-outline pointer-events-none">
          {node.imageUrl ? (
            <img src={node.imageUrl} alt={node.title} className="w-full h-full object-cover" draggable={false} />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/20 to-surface-container-high flex items-center justify-center border border-outline">
              <span className="text-on-surface-variant text-[10px] uppercase font-bold tracking-widest px-4 text-center">Visual Placeholder</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-3 left-3 right-3 flex justify-between items-end">
            <div className="text-white">
              <span className="text-[8px] bg-white/20 px-1.5 py-0.5 rounded backdrop-blur uppercase font-black tracking-widest">Visualized</span>
              <h3 className="text-sm font-black uppercase mt-1 leading-tight">{node.title}</h3>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
