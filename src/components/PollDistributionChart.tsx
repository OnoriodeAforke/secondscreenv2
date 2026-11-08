import React, { useState, useMemo } from 'react';
import type { Poll } from '../types/database';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  PieChart,
  Pie,
  Legend,
} from 'recharts';
import {
  BarChart3,
  PieChart as PieIcon,
  Vote,
  Sparkles,
  Flame,
  Radio,
  CheckCircle2,
} from 'lucide-react';

interface PollDistributionChartProps {
  polls: Poll[];
  voteCountsByOption: Record<string, number>;
  totalVotesByPoll: Record<string, number>;
}

const PALETTE = [
  '#06b6d4', // cyan-400
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#f59e0b', // amber-500
  '#10b981', // emerald-500
  '#3b82f6', // blue-500
  '#a855f7', // purple-500
  '#14b8a6', // teal-500
];

export default function PollDistributionChart({
  polls,
  voteCountsByOption,
  totalVotesByPoll,
}: PollDistributionChartProps) {
  const [selectedPollId, setSelectedPollId] = useState<string>(
    polls[0]?.id || ''
  );
  const [chartType, setChartType] = useState<'bar' | 'pie'>('bar');

  // Keep selectedPoll in sync if polls update
  const activePoll = useMemo(() => {
    return polls.find((p) => p.id === selectedPollId) || polls[0] || null;
  }, [polls, selectedPollId]);

  // Compute live distribution data for the active poll
  const chartData = useMemo(() => {
    if (!activePoll || !activePoll.options) return [];

    const realTotal =
      totalVotesByPoll[activePoll.id] ??
      activePoll.total_votes ??
      activePoll.options.reduce((acc, opt) => acc + (opt.votes || 0), 0);

    return activePoll.options.map((opt, index) => {
      const votes =
        voteCountsByOption[opt.id] !== undefined
          ? voteCountsByOption[opt.id]
          : opt.votes || 0;

      const percentage =
        realTotal > 0 ? Math.round((votes / realTotal) * 100) : 0;

      return {
        id: opt.id,
        name: opt.text,
        shortName:
          opt.text.length > 20 ? `${opt.text.substring(0, 18)}...` : opt.text,
        votes,
        percentage,
        color: PALETTE[index % PALETTE.length],
      };
    });
  }, [activePoll, voteCountsByOption, totalVotesByPoll]);

  const totalVotes = useMemo(() => {
    if (!activePoll) return 0;
    return (
      totalVotesByPoll[activePoll.id] ??
      activePoll.total_votes ??
      chartData.reduce((acc, d) => acc + d.votes, 0)
    );
  }, [activePoll, totalVotesByPoll, chartData]);

  // Identify highest voted leading option
  const leadingOption = useMemo(() => {
    if (chartData.length === 0 || totalVotes === 0) return null;
    return [...chartData].sort((a, b) => b.votes - a.votes)[0];
  }, [chartData, totalVotes]);

  if (!activePoll || polls.length === 0) {
    return null;
  }

  // Custom dark-mode tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-[#0b0c16]/95 border border-cyan-500/40 rounded-xl p-3 shadow-2xl backdrop-blur-md font-display text-xs">
          <div className="flex items-center gap-1.5 mb-1 text-slate-300 font-semibold">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: data.color }}
            />
            <span className="text-white font-bold">{data.name}</span>
          </div>
          <div className="flex items-center justify-between gap-4 font-mono pt-1 border-t border-slate-800 text-[11px]">
            <span className="text-slate-400">{data.votes} votes</span>
            <span className="text-cyan-300 font-bold">{data.percentage}%</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <section className="bg-gradient-to-b from-[#0f111d] to-[#0a0b14] border border-violet-900/40 rounded-3xl p-6 sm:p-7 mb-8 shadow-2xl relative overflow-hidden font-display">
      {/* Background glow orbs */}
      <div className="absolute top-0 right-1/4 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-72 h-72 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header */}
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-[11px] font-bold tracking-wider uppercase">
              <Radio className="w-3 h-3 text-cyan-400 animate-pulse" />
              <span>LIVE VOTE ANALYTICS</span>
            </span>
            <span className="text-xs text-slate-400">
              Real-Time Community Distribution
            </span>
          </div>
          <h3 className="text-lg sm:text-xl font-black text-white tracking-tight">
            Option Vote Distribution
          </h3>
        </div>

        {/* Controls: Poll Selector + Bar/Pie Switcher */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Poll dropdown if multiple polls exist */}
          {polls.length > 1 && (
            <select
              value={activePoll.id}
              onChange={(e) => setSelectedPollId(e.target.value)}
              className="bg-[#141628] border border-slate-700/80 hover:border-cyan-400/60 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-400 font-display transition cursor-pointer max-w-[240px] truncate"
            >
              {polls.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.question}
                </option>
              ))}
            </select>
          )}

          {/* Chart Type Toggle */}
          <div className="flex items-center bg-[#141628] p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setChartType('bar')}
              title="Bar Chart View"
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                chartType === 'bar'
                  ? 'bg-gradient-to-r from-violet-600 to-cyan-500 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Bar</span>
            </button>
            <button
              type="button"
              onClick={() => setChartType('pie')}
              title="Pie / Donut Chart View"
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                chartType === 'pie'
                  ? 'bg-gradient-to-r from-violet-600 to-cyan-500 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <PieIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Pie</span>
            </button>
          </div>
        </div>
      </div>

      {/* Active Poll Question & Leader Pill */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 p-3.5 rounded-2xl bg-[#121422]/90 border border-slate-800/90">
        <div className="min-w-0 pr-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 block mb-0.5">
            Active Question
          </span>
          <p className="text-sm sm:text-base font-bold text-white truncate">
            {activePoll.question}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {leadingOption && (
            <div className="px-3 py-1 rounded-xl bg-violet-950/70 border border-violet-500/40 text-violet-300 text-xs font-semibold flex items-center gap-1.5 shadow-sm">
              <Flame className="w-3.5 h-3.5 text-cyan-400" />
              <span>Leading:</span>
              <strong className="text-white truncate max-w-[130px]">
                {leadingOption.shortName}
              </strong>
              <span className="font-mono text-cyan-300 font-bold">
                ({leadingOption.percentage}%)
              </span>
            </div>
          )}

          <div className="text-xs text-slate-400 font-mono font-medium">
            <strong className="text-white font-bold">{totalVotes}</strong> total
            votes
          </div>
        </div>
      </div>

      {/* Chart Canvas Area */}
      <div className="relative z-10 w-full h-[280px]">
        {chartType === 'bar' ? (
          /* Real-Time Horizontal / Vertical Bar Chart */
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 10, right: 30, left: 10, bottom: 5 }}
            >
              <XAxis
                type="number"
                tick={{ fill: '#64748b', fontSize: 11 }}
                axisLine={{ stroke: '#1e293b' }}
                tickLine={{ stroke: '#1e293b' }}
                unit={totalVotes > 0 ? '%' : ''}
                domain={[0, totalVotes > 0 ? 100 : 10]}
              />
              <YAxis
                dataKey="shortName"
                type="category"
                tick={{ fill: '#cbd5e1', fontSize: 12, fontWeight: 600 }}
                width={120}
                axisLine={{ stroke: '#1e293b' }}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.03)' }} />
              <Bar
                dataKey={totalVotes > 0 ? 'percentage' : 'votes'}
                radius={[0, 8, 8, 0]}
                animationDuration={800}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          /* Real-Time Pie / Donut Chart */
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="bottom"
                height={36}
                formatter={(value) => (
                  <span className="text-xs text-slate-300 font-display font-medium">
                    {value}
                  </span>
                )}
              />
              <Pie
                data={chartData}
                dataKey={totalVotes > 0 ? 'votes' : 'percentage'}
                nameKey="name"
                cx="50%"
                cy="46%"
                innerRadius={60}
                outerRadius={95}
                paddingAngle={4}
                animationDuration={800}
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`pie-cell-${index}`}
                    fill={entry.color}
                    stroke="#0b0c16"
                    strokeWidth={2}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Options Legend Cards Below */}
      <div className="relative z-10 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 mt-4 pt-4 border-t border-slate-800/80">
        {chartData.map((item, idx) => (
          <div
            key={item.id || idx}
            className="p-2.5 rounded-xl bg-[#121422]/70 border border-slate-800 flex items-center justify-between gap-2"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-xs text-slate-300 font-semibold truncate">
                {item.name}
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0 font-mono text-xs">
              <span className="text-slate-500">({item.votes})</span>
              <span className="font-bold text-cyan-300">{item.percentage}%</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
