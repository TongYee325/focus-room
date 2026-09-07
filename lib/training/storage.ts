import { configKey, isConfig, SETTINGS, type TrainingConfig } from './config';
import type { Run } from './engine';

export type Metrics =
  | { kind: 'schulte'; mistakes: number }
  | {
      kind: 'stroop';
      correct: number;
      mistakes: number;
      timeouts: number;
      accuracy: number;
      reactionMs: number | null;
    }
  | {
      kind: 'sequence';
      perfectRounds: number;
      correctPositions: number;
      totalPositions: number;
    }
  | {
      kind: 'tracking';
      foundTargets: number;
      totalTargets: number;
      perfectRounds: number;
    };
export interface TrainingResult {
  id: string;
  config: TrainingConfig;
  completedAt: string;
  durationMs: number;
  metrics: Metrics;
}
export interface SavedData {
  version: 1;
  history: TrainingResult[];
  best: Record<string, TrainingResult>;
  sound: boolean;
  totalCount: number;
  totalMs: number;
}
export const STORAGE_KEY = 'focus-room:v1';
export const emptyData = (): SavedData => ({
  version: 1,
  history: [],
  best: {},
  sound: true,
  totalCount: 0,
  totalMs: 0,
});
export function resultFromRun(
  run: Run,
  completedAt = new Date().toISOString(),
): TrainingResult {
  if (run.phase !== 'done') throw new Error('训练尚未完成');
  let metrics: Metrics;
  const s = SETTINGS[run.config.difficulty];
  switch (run.config.game) {
    case 'schulte':
      metrics = { kind: 'schulte', mistakes: run.mistakes };
      break;
    case 'stroop':
      metrics = {
        kind: 'stroop',
        correct: run.correct,
        mistakes: run.mistakes,
        timeouts: run.timeouts,
        accuracy:
          run.correct + run.mistakes
            ? run.correct / (run.correct + run.mistakes)
            : 0,
        reactionMs: run.reactionTimes.length
          ? run.reactionTimes.reduce((a, b) => a + b, 0) /
            run.reactionTimes.length
          : null,
      };
      break;
    case 'sequence':
      metrics = {
        kind: 'sequence',
        perfectRounds: run.perfectRounds,
        correctPositions: run.correctPositions,
        totalPositions: s[run.config.variant] * 5,
      };
      break;
    case 'tracking':
      metrics = {
        kind: 'tracking',
        foundTargets: run.foundTargets,
        totalTargets: s.targets * 5,
        perfectRounds: run.perfectRounds,
      };
      break;
  }
  return {
    id: run.id,
    config: { ...run.config },
    durationMs: run.elapsedMs,
    completedAt,
    metrics,
  };
}
export function isBetter(
  candidate: TrainingResult,
  current?: TrainingResult,
): boolean {
  if (!current) return true;
  if (configKey(candidate.config) !== configKey(current.config)) return false;
  const a = candidate.metrics,
    b = current.metrics;
  if (a.kind === 'schulte' && b.kind === 'schulte')
    return (
      a.mistakes < b.mistakes ||
      (a.mistakes === b.mistakes && candidate.durationMs < current.durationMs)
    );
  if (a.kind === 'stroop' && b.kind === 'stroop')
    return (
      a.correct > b.correct ||
      (a.correct === b.correct && a.accuracy > b.accuracy)
    );
  if (a.kind === 'sequence' && b.kind === 'sequence')
    return (
      a.perfectRounds > b.perfectRounds ||
      (a.perfectRounds === b.perfectRounds &&
        a.correctPositions / a.totalPositions >
          b.correctPositions / b.totalPositions)
    );
  if (a.kind === 'tracking' && b.kind === 'tracking')
    return (
      a.foundTargets > b.foundTargets ||
      (a.foundTargets === b.foundTargets && a.perfectRounds > b.perfectRounds)
    );
  return false;
}
export function appendResult(
  data: SavedData,
  result: TrainingResult,
): SavedData {
  if (
    data.history.some((r) => r.id === result.id) ||
    Object.values(data.best).some((r) => r.id === result.id)
  )
    return data;
  const key = configKey(result.config);
  return {
    ...data,
    history: [result, ...data.history].slice(0, 200),
    best: isBetter(result, data.best[key])
      ? { ...data.best, [key]: result }
      : data.best,
    totalCount: data.totalCount + 1,
    totalMs: data.totalMs + result.durationMs,
  };
}
function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}
export function isResult(value: unknown): value is TrainingResult {
  if (!value || typeof value !== 'object') return false;
  const r = value as TrainingResult;
  if (
    typeof r.id !== 'string' ||
    typeof r.completedAt !== 'string' ||
    !Number.isFinite(Date.parse(r.completedAt)) ||
    !isConfig(r.config) ||
    !finite(r.durationMs) ||
    !r.metrics ||
    r.metrics.kind !== r.config.game
  )
    return false;
  const m = r.metrics;
  if (m.kind === 'schulte') return finite(m.mistakes);
  if (m.kind === 'stroop')
    return (
      [m.correct, m.mistakes, m.timeouts, m.accuracy].every(finite) &&
      m.accuracy <= 1 &&
      (m.reactionMs === null || finite(m.reactionMs))
    );
  if (m.kind === 'sequence')
    return (
      [m.perfectRounds, m.correctPositions, m.totalPositions].every(finite) &&
      m.totalPositions > 0 &&
      m.perfectRounds <= 5 &&
      m.correctPositions <= m.totalPositions
    );
  return (
    [m.foundTargets, m.totalTargets, m.perfectRounds].every(finite) &&
    m.totalTargets > 0 &&
    m.perfectRounds <= 5 &&
    m.foundTargets <= m.totalTargets
  );
}
export function readData(storage: Pick<Storage, 'getItem'>): {
  data: SavedData;
  warning: string | null;
} {
  try {
    const text = storage.getItem(STORAGE_KEY);
    if (!text) return { data: emptyData(), warning: null };
    const raw = JSON.parse(text);
    if (
      raw.version !== 1 ||
      !Array.isArray(raw.history) ||
      !raw.best ||
      typeof raw.best !== 'object'
    )
      throw new Error('invalid');
    const history = raw.history.filter(isResult).slice(0, 200);
    const best = Object.fromEntries(
      Object.values(raw.best)
        .filter(isResult)
        .map((r) => [configKey(r.config), r]),
    );
    return {
      data: {
        version: 1,
        history,
        best,
        sound: typeof raw.sound === 'boolean' ? raw.sound : true,
        totalCount: finite(raw.totalCount) ? raw.totalCount : history.length,
        totalMs: finite(raw.totalMs)
          ? raw.totalMs
          : history.reduce(
              (n: number, r: TrainingResult) => n + r.durationMs,
              0,
            ),
      },
      warning: null,
    };
  } catch {
    return {
      data: emptyData(),
      warning: '暂时无法读取本地记录，你仍可正常训练。',
    };
  }
}
export function writeData(
  storage: Pick<Storage, 'setItem'>,
  data: SavedData,
): string | null {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(data));
    return null;
  } catch {
    return '本次记录暂时无法保存，当前页面内仍可查看成绩。';
  }
}
export function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}
export function seconds(ms: number) {
  return `${(ms / 1000).toFixed(1)} 秒`;
}
export function primaryResult(result: TrainingResult) {
  const m = result.metrics;
  switch (m.kind) {
    case 'schulte':
      return seconds(result.durationMs);
    case 'stroop':
      return `${m.correct} 题正确`;
    case 'sequence':
      return `${m.perfectRounds} / 5 轮完整复现`;
    case 'tracking':
      return `${m.foundTargets} / ${m.totalTargets} 个目标`;
  }
}
export function resultStats(
  result: TrainingResult,
): { label: string; value: string }[] {
  const m = result.metrics;
  switch (m.kind) {
    case 'schulte':
      return [
        { label: '完成用时', value: seconds(result.durationMs) },
        { label: '失误次数', value: `${m.mistakes} 次` },
        {
          label: '完成数字',
          value: `${SETTINGS[result.config.difficulty].size ** 2} 个`,
        },
      ];
    case 'stroop':
      return [
        { label: '正确题数', value: `${m.correct} 题` },
        { label: '准确率', value: percent(m.accuracy) },
        {
          label: '平均反应',
          value:
            m.reactionMs === null ? '—' : `${Math.round(m.reactionMs)} 毫秒`,
        },
        { label: '超时 / 失误', value: `${m.timeouts} / ${m.mistakes} 次` },
      ];
    case 'sequence':
      return [
        { label: '完整复现', value: `${m.perfectRounds} / 5 轮` },
        {
          label: '位置准确率',
          value: percent(m.correctPositions / m.totalPositions),
        },
        { label: '有效训练', value: seconds(result.durationMs) },
      ];
    case 'tracking':
      return [
        { label: '找回目标', value: `${m.foundTargets} / ${m.totalTargets}` },
        { label: '全对轮数', value: `${m.perfectRounds} / 5 轮` },
        {
          label: '目标准确率',
          value: percent(m.foundTargets / m.totalTargets),
        },
      ];
  }
}
