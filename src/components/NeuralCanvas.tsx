import React, { useEffect, useRef } from 'react';
import type { ThoughtNode, AnchorConnection } from '../types';

interface NeuralCanvasProps {
  nodes?: ThoughtNode[];
  anchorConnections?: AnchorConnection[];
  linkingSourceAnchor?: string | null;
  mousePos?: { x: number; y: number };
  onDeleteConnection?: (id: string) => void;
}

export function NeuralCanvas({
  nodes = [],
  anchorConnections = [],
  linkingSourceAnchor = null,
  mousePos = { x: 0, y: 0 },
  onDeleteConnection = () => {},
}: NeuralCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  // Keep a ref so the rAF loop always reads fresh values
  const stateRef = useRef({ nodes, anchorConnections, linkingSourceAnchor, mousePos });
  useEffect(() => {
    stateRef.current = { nodes, anchorConnections, linkingSourceAnchor, mousePos };
  }, [nodes, anchorConnections, linkingSourceAnchor, mousePos]);

  useEffect(() => {
    let rafId: number;

    const bezier = (x1: number, y1: number, x2: number, y2: number) => {
      const dx = Math.abs(x1 - x2);
      const dy = Math.abs(y1 - y2);
      const tension = Math.max(dx, dy) * 0.5;
      
      // Horizontal bias for smoother curves between nodes
      const cx1 = x1 < x2 ? x1 + tension : x1 - tension;
      const cx2 = x1 < x2 ? x2 - tension : x2 + tension;
      
      return `M ${x1} ${y1} C ${cx1} ${y1}, ${cx2} ${y2}, ${x2} ${y2}`;
    };

    const getAnchorCenter = (anchorId: string, svgRect: DOMRect) => {
      const el = document.querySelector(`[data-anchor-id="${anchorId}"]`);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        x: r.left + r.width / 2 - svgRect.left,
        y: r.top + r.height / 2 - svgRect.top,
      };
    };

    const ns = 'http://www.w3.org/2000/svg';
    const mkEl = (tag: string) => document.createElementNS(ns, tag);

    const renderFrame = () => {
      const svg = svgRef.current;
      if (!svg) {
        rafId = requestAnimationFrame(renderFrame);
        return;
      }

      const { anchorConnections, linkingSourceAnchor, mousePos } = stateRef.current;
      const svgRect = svg.getBoundingClientRect();

      // CLEANUP
      while (svg.firstChild) svg.removeChild(svg.firstChild);

      // 1. RENDER ESTABLISHED CONNECTIONS
      anchorConnections.forEach(conn => {
        const src = getAnchorCenter(conn.fromAnchorId, svgRect);
        const tgt = getAnchorCenter(conn.toAnchorId, svgRect);

        if (!src || !tgt) return;

        const pathData = bezier(src.x, src.y, tgt.x, tgt.y);

        // --- HIT AREA (Invisible Thick Path) ---
        const hit = mkEl('path') as SVGPathElement;
        hit.setAttribute('d', pathData);
        hit.setAttribute('fill', 'none');
        hit.setAttribute('stroke', 'transparent');
        hit.setAttribute('stroke-width', '20');
        hit.style.cursor = 'pointer';
        hit.setAttribute('data-connection-id', conn.id);
        hit.setAttribute('class', 'connection-hit-area');
        
        hit.onclick = (e) => {
          e.stopPropagation();
          onDeleteConnection(conn.id);
        };
        svg.appendChild(hit);

        // --- VISUAL LINE ---
        const line = mkEl('path') as SVGPathElement;
        line.setAttribute('d', pathData);
        line.setAttribute('fill', 'none');
        line.setAttribute('stroke', 'var(--color-outline)');
        line.setAttribute('stroke-width', '2');
        line.setAttribute('opacity', '0.4');
        line.setAttribute('class', 'connection-line');
        line.style.pointerEvents = 'none'; // Visual only
        svg.appendChild(line);

        // --- ENDPOINT DOTS ---
        const drawDot = (x: number, y: number, color: string) => {
          const dot = mkEl('circle') as SVGCircleElement;
          dot.setAttribute('cx', String(x));
          dot.setAttribute('cy', String(y));
          dot.setAttribute('r', '3');
          dot.setAttribute('fill', color);
          dot.setAttribute('opacity', '0.6');
          svg.appendChild(dot);
        };
        drawDot(src.x, src.y, 'var(--color-primary)');
        drawDot(tgt.x, tgt.y, 'var(--color-outline)');
      });

      // 2. RENDER PREVIEW LINE (DRAGGING)
      if (linkingSourceAnchor) {
        const src = getAnchorCenter(linkingSourceAnchor, svgRect);
        if (src) {
          const mx = mousePos.x - svgRect.left;
          const my = mousePos.y - svgRect.top;

          // Check for snapping target visual
          const elUnderMouse = document.elementFromPoint(mousePos.x, mousePos.y);
          const targetAnchor = elUnderMouse?.closest('[data-anchor-id]');
          const isTargetValid = targetAnchor && targetAnchor.getAttribute('data-anchor-id') !== linkingSourceAnchor;

          const preview = mkEl('path') as SVGPathElement;
          preview.setAttribute('d', bezier(src.x, src.y, mx, my));
          preview.setAttribute('fill', 'none');
          preview.setAttribute('stroke', isTargetValid ? 'var(--color-primary)' : 'var(--color-primary)');
          preview.setAttribute('stroke-width', '2.5');
          preview.setAttribute('stroke-dasharray', '8 6');
          preview.setAttribute('opacity', '0.8');
          svg.appendChild(preview);

          if (isTargetValid) {
            const rect = targetAnchor.getBoundingClientRect();
            const tx = rect.left + rect.width / 2 - svgRect.left;
            const ty = rect.top + rect.height / 2 - svgRect.top;
            
            const glow = mkEl('circle') as SVGCircleElement;
            glow.setAttribute('cx', String(tx));
            glow.setAttribute('cy', String(ty));
            glow.setAttribute('r', '15');
            glow.setAttribute('fill', 'var(--color-primary)');
            glow.setAttribute('opacity', '0.3');
            svg.appendChild(glow);
          }

          // Start dot
          const startDot = mkEl('circle') as SVGCircleElement;
          startDot.setAttribute('cx', String(src.x));
          startDot.setAttribute('cy', String(src.y));
          startDot.setAttribute('r', '5');
          startDot.setAttribute('fill', 'var(--color-primary)');
          svg.appendChild(startDot);
        }
      }

      rafId = requestAnimationFrame(renderFrame);
    };

    rafId = requestAnimationFrame(renderFrame);
    return () => cancelAnimationFrame(rafId);
  }, [onDeleteConnection]);

  return (
    <div className="absolute inset-0 z-[5] overflow-hidden pointer-events-none">
      <svg
        id="connection-layer"
        ref={svgRef}
        className="absolute inset-0 w-full h-full pointer-events-auto"
        style={{ overflow: 'visible' }}
      />
    </div>
  );
}
