/**
 * View panels for Dashboard, Projects (full page), Analytics,
 * Connections graph, Archives list, and History feed.
 */

import React from 'react';
import { motion } from 'motion/react';
import { Check, Trash2, Network, GitBranch, Archive, Clock, TrendingUp, Zap, BarChart2, FolderKanban, Plus } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import type { ThoughtNode, Project } from '@/src/types';

// ── Shared helpers ────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color = 'primary' }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="p-5 bg-surface border border-outline rounded-xl shadow-[4px_4px_0px_0px_var(--color-outline)] flex flex-col gap-2">
      <p className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant">{label}</p>
      <p className={cn("text-3xl font-black text-on-surface leading-none")}>{value}</p>
      {sub && <p className="text-[9px] text-on-surface-variant font-bold uppercase">{sub}</p>}
    </div>
  );
}

// ── Analytics Panel ───────────────────────────────────────────────────────────
export function AnalyticsPanel({ nodes, projects }: { nodes: ThoughtNode[]; projects: Project[] }) {
  const total       = nodes.length;
  const completed   = nodes.filter(n => n.isComplete).length;
  const active      = nodes.filter(n => n.status === 'active').length;
  const withConns   = nodes.filter(n => (n.connections?.length ?? 0) > 0).length;
  const concepts    = nodes.filter(n => n.type === 'concept').length;
  const spheres     = nodes.filter(n => n.type === 'sphere').length;
  const images      = nodes.filter(n => n.type === 'image' || n.imageUrl).length;
  const completePct = total ? Math.round((completed / total) * 100) : 0;

  // Tag frequency
  const tagMap: Record<string, number> = {};
  nodes.forEach(n => n.tags?.forEach(t => { tagMap[t] = (tagMap[t] ?? 0) + 1; }));
  const topTags = Object.entries(tagMap).sort((a, b) => b[1] - a[1]).slice(0, 8);

  return (
    <div className="w-full h-full overflow-y-auto p-6 md:p-10 space-y-8">
      <div>
        <div className="flex items-center gap-3 mb-6">
          <BarChart2 className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-black uppercase tracking-tight text-on-surface">Analytics</h2>
          <div className="px-2 py-0.5 bg-primary/10 border border-primary/30 rounded text-[9px] font-black text-primary uppercase tracking-widest">Live</div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard label="Total Nodes"  value={total}        sub="All types" />
          <StatCard label="Completed"    value={completed}    sub={`${completePct}% done`} />
          <StatCard label="Active"       value={active}       sub="Status: active" />
          <StatCard label="Connected"    value={withConns}    sub="Have connections" />
        </div>

        {/* Completion bar */}
        <div className="p-5 bg-surface border border-outline rounded-xl shadow-[4px_4px_0px_0px_var(--color-outline)] mb-6">
          <div className="flex justify-between items-center mb-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-on-surface">Completion Rate</span>
            <span className="text-[10px] font-black text-primary">{completePct}%</span>
          </div>
          <div className="w-full h-3 bg-surface-container-high border border-outline rounded-full overflow-hidden">
            <motion.div
              animate={{ width: `${completePct}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
              className="h-full bg-primary rounded-full"
            />
          </div>
        </div>

        {/* Node types breakdown */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Concept', val: concepts, icon: Network },
            { label: 'Sphere',  val: spheres,  icon: Zap },
            { label: 'Visual',  val: images,   icon: GitBranch },
          ].map(({ label, val, icon: Icon }) => (
            <div key={label} className="p-4 bg-surface border border-outline rounded-xl shadow-[4px_4px_0px_0px_var(--color-outline)] flex items-center gap-3">
              <Icon className="w-5 h-5 text-primary shrink-0" />
              <div>
                <p className="text-xl font-black text-on-surface">{val}</p>
                <p className="text-[9px] font-black text-on-surface-variant uppercase">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Top Tags */}
        {topTags.length > 0 && (
          <div className="p-5 bg-surface border border-outline rounded-xl shadow-[4px_4px_0px_0px_var(--color-outline)]">
            <p className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant mb-3">Top Tags</p>
            <div className="flex flex-wrap gap-2">
              {topTags.map(([tag, count]) => (
                <span key={tag} className="flex items-center gap-1.5 px-3 py-1 bg-primary/10 border border-primary/30 rounded-full text-[10px] font-black text-primary uppercase">
                  #{tag} <span className="text-primary/60">{count}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Projects row */}
        <div className="mt-6 p-5 bg-surface border border-outline rounded-xl shadow-[4px_4px_0px_0px_var(--color-outline)]">
          <p className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant mb-3">Projects ({projects.length})</p>
          <div className="flex flex-wrap gap-2">
            {projects.map(p => (
              <span key={p.id} className="px-3 py-1 bg-surface-container-low border border-outline rounded-full text-[10px] font-black text-on-surface uppercase">
                {p.emoji} {p.name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Projects Panel (full page) ────────────────────────────────────────────────
export function ProjectsPanel({
  projects,
  nodes,
  activeProjectId,
  onSwitchProject,
  onCreateProject,
  onDeleteProject,
  onDeleteHistory,
}: {
  projects: Project[];
  nodes: ThoughtNode[];
  activeProjectId: string;
  onSwitchProject: (id: string) => void;
  onCreateProject: (name: string, emoji?: string) => void;
  onDeleteProject: (id: string) => void;
  onDeleteHistory: () => void;
}) {
  const [name, setName]   = React.useState('');
  const [emoji, setEmoji] = React.useState('📁');

  const submit = () => {
    if (!name.trim()) return;
    onCreateProject(name.trim(), emoji);
    setName(''); setEmoji('📁');
  };

  return (
    <div className="w-full h-full overflow-y-auto p-6 md:p-10 space-y-8">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <FolderKanban className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-black uppercase tracking-tight text-on-surface">Projects</h2>
        </div>
        <button
          onClick={onDeleteHistory}
          className="px-3 py-1 bg-error/10 text-error border border-error/30 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-error hover:text-white transition-all shadow-[2px_2px_0px_0px_var(--color-outline)]"
        >
          Clear All Projects
        </button>
      </div>

      {/* Create form */}
      <div className="p-5 bg-surface border border-outline rounded-xl shadow-[4px_4px_0px_0px_var(--color-outline)]">
        <p className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant mb-3">New Project</p>
        <div className="flex gap-3 items-center">
          <input type="text" value={emoji} onChange={e => setEmoji(e.target.value)} maxLength={2}
            className="w-12 text-center bg-background border border-outline rounded-lg py-2 text-xl focus:ring-0 focus:border-primary"
          />
          <input type="text" value={name} onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
            placeholder="Project name…"
            className="flex-1 bg-background border border-outline rounded-lg py-2 px-4 text-sm font-bold uppercase focus:ring-0 focus:border-primary text-on-surface"
          />
          <button onClick={submit}
            className="px-5 py-2 bg-primary text-white font-black text-xs uppercase tracking-widest rounded-lg hover:bg-blue-700 transition-all flex items-center gap-2 shadow-[4px_4px_0px_rgba(37,99,235,0.3)]"
          >
            <Plus className="w-4 h-4" /> Create
          </button>
        </div>
      </div>

      {/* Project grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map(project => {
          const projectNodes = nodes.filter(n => n.projectId === project.id);
          const done = projectNodes.filter(n => n.isComplete).length;
          const pct  = projectNodes.length ? Math.round((done / projectNodes.length) * 100) : 0;
          const isActive = project.id === activeProjectId;

          return (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "p-5 bg-surface border-2 rounded-xl shadow-[4px_4px_0px_0px_var(--color-outline)] cursor-pointer transition-all group",
                isActive ? "border-primary" : "border-outline hover:border-primary/50"
              )}
              onClick={() => onSwitchProject(project.id)}
            >
              <div className="flex items-start justify-between mb-3">
                <span className="text-3xl">{project.emoji || '📁'}</span>
                <div className="flex items-center gap-2">
                  {isActive && (
                    <span className="px-2 py-0.5 bg-primary text-white text-[8px] font-black uppercase rounded tracking-widest">Active</span>
                  )}
                  {project.id !== 'default' && (
                    <button
                      onClick={e => { e.stopPropagation(); onDeleteProject(project.id); }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-error transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <h3 className="font-headline text-base font-black uppercase tracking-tight text-on-surface mb-1">{project.name}</h3>
              {project.description && (
                <p className="text-[10px] text-on-surface-variant mb-3 line-clamp-2">{project.description}</p>
              )}

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-black text-on-surface-variant uppercase">{projectNodes.length} nodes · {done} complete</span>
                  <span className="text-[9px] font-black text-primary">{pct}%</span>
                </div>
                <div className="w-full h-1.5 bg-surface-container-high border border-outline rounded-full overflow-hidden">
                  <motion.div animate={{ width: `${pct}%` }} className="h-full bg-primary rounded-full" />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ── Connections Panel ─────────────────────────────────────────────────────────
export function ConnectionsPanel({ nodes, anchorConnections }: { nodes: ThoughtNode[], anchorConnections: any[] }) {
  const connectedPairs: { from: ThoughtNode; to: ThoughtNode }[] = [];
  
  anchorConnections.forEach(conn => {
    const sourceNode = nodes.find(n => n.id === conn.fromNodeId);
    const targetNode = nodes.find(n => n.id === conn.toNodeId);
    if (sourceNode && targetNode) {
      connectedPairs.push({ from: sourceNode, to: targetNode });
    }
  });

  return (
    <div className="w-full h-full overflow-y-auto p-6 md:p-10">
      <div className="flex items-center gap-3 mb-6">
        <GitBranch className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-black uppercase tracking-tight text-on-surface">Connections</h2>
        <span className="px-2 py-0.5 bg-primary/10 border border-primary/30 rounded text-[9px] font-black text-primary uppercase">{connectedPairs.length} links</span>
      </div>

      {connectedPairs.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 gap-4 text-on-surface-variant">
          <GitBranch className="w-12 h-12 opacity-20" />
          <p className="text-sm font-black uppercase">No connections yet</p>
          <p className="text-xs text-center max-w-xs opacity-60">Establish links between nodes to map your thought process manually.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {connectedPairs.map(({ from, to }, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              className="flex items-center gap-4 p-4 bg-surface border border-outline rounded-xl shadow-[2px_2px_0px_0px_var(--color-outline)]"
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-black uppercase text-on-surface truncate">{from.title}</p>
                <p className="text-[9px] text-on-surface-variant uppercase">{from.type}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <div className="w-6 h-[1px] bg-primary" />
                <div className="w-2 h-2 bg-primary rounded-full" />
                <div className="w-6 h-[1px] bg-primary" />
              </div>
              <div className="flex-1 min-w-0 text-right">
                <p className="text-xs font-black uppercase text-on-surface truncate">{to.title}</p>
                <p className="text-[9px] text-on-surface-variant uppercase">{to.type}</p>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Archives Panel ────────────────────────────────────────────────────────────
export function ArchivesPanel({
  nodes,
  onDelete,
  onToggleComplete,
}: {
  nodes: ThoughtNode[];
  onDelete: (id: string) => void;
  onToggleComplete: (id: string) => void;
}) {
  const archived = nodes.filter(n => n.isComplete || n.status === 'archived');

  return (
    <div className="w-full h-full overflow-y-auto p-6 md:p-10">
      <div className="flex items-center gap-3 mb-6">
        <Archive className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-black uppercase tracking-tight text-on-surface">Archives</h2>
        <span className="px-2 py-0.5 bg-primary/10 border border-primary/30 rounded text-[9px] font-black text-primary uppercase">{archived.length} items</span>
      </div>

      {archived.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 gap-4 text-on-surface-variant">
          <Archive className="w-12 h-12 opacity-20" />
          <p className="text-sm font-black uppercase">No archived nodes</p>
          <p className="text-xs opacity-60">Mark nodes as complete to archive them here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {archived.map((node, i) => (
            <motion.div
              key={node.id}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="flex items-center gap-4 p-4 bg-surface border border-outline rounded-xl opacity-80 hover:opacity-100 transition-opacity"
            >
              <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
                <Check className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-black uppercase text-on-surface line-through truncate">{node.title}</p>
                {node.tags && (
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {node.tags.slice(0, 3).map(t => (
                      <span key={t} className="px-1.5 py-0.5 bg-surface-container-high text-[8px] font-bold uppercase text-on-surface-variant border border-outline rounded">{t}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => onToggleComplete(node.id)}
                  className="px-3 py-1 text-[9px] font-black uppercase border border-outline rounded-lg hover:border-primary hover:text-primary transition-all text-on-surface"
                >
                  Restore
                </button>
                <button
                  onClick={() => onDelete(node.id)}
                  className="p-1.5 text-error hover:bg-error hover:text-white rounded-lg transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── History Panel ─────────────────────────────────────────────────────────────
export function HistoryPanel({ nodes, onDeleteHistory }: { nodes: ThoughtNode[]; onDeleteHistory: () => void }) {
  // Sort by most recent first (use id timestamp as proxy since nodes have `node-{Date.now()}` ids)
  const sorted = [...nodes].sort((a, b) => {
    const tsA = parseInt(a.id.replace('node-', '')) || 0;
    const tsB = parseInt(b.id.replace('node-', '')) || 0;
    return tsB - tsA;
  });

  return (
    <div className="w-full h-full overflow-y-auto p-6 md:p-10">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Clock className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-black uppercase tracking-tight text-on-surface">History</h2>
        </div>
        <button
          onClick={onDeleteHistory}
          className="px-3 py-1 bg-error/10 text-error border border-error/30 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-error hover:text-white transition-all shadow-[2px_2px_0px_0px_var(--color-outline)]"
        >
          Clear History
        </button>
      </div>

      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 gap-4 text-on-surface-variant">
          <Clock className="w-12 h-12 opacity-20" />
          <p className="text-sm font-black uppercase">No history yet</p>
        </div>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-4 top-0 bottom-0 w-[1px] bg-outline" />

          <div className="space-y-3 pl-10">
            {sorted.map((node, i) => {
              const ts = parseInt(node.id.replace('node-', ''));
              const date = ts ? new Date(ts).toLocaleDateString('en-US', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Seeded';

              return (
                <motion.div
                  key={node.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="relative"
                >
                  {/* Timeline dot */}
                  <div className={cn(
                    "absolute -left-[26px] top-4 w-3 h-3 rounded-full border-2",
                    node.isComplete ? "bg-primary border-primary" : "bg-surface border-outline"
                  )} />

                  <div className="p-4 bg-surface border border-outline rounded-xl shadow-[2px_2px_0px_0px_var(--color-outline)]">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className={cn("text-xs font-black uppercase text-on-surface truncate", node.isComplete && "line-through opacity-60")}>{node.title}</p>
                        <p className="text-[9px] text-on-surface-variant uppercase mt-0.5">{node.type} · {date}</p>
                      </div>
                      <span className={cn(
                        "shrink-0 px-2 py-0.5 text-[8px] font-black uppercase rounded border",
                        node.status === 'active' ? "bg-primary/10 border-primary/30 text-primary" : "bg-surface-container-high border-outline text-on-surface-variant"
                      )}>{node.status || 'active'}</span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
