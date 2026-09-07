import { describe, expect, it } from 'vitest';
import {
  appendResult,
  emptyData,
  isBetter,
  readData,
  writeData,
  STORAGE_KEY,
  type TrainingResult,
} from '../lib/training/storage';
import { configKey } from '../lib/training/config';
const sample = (id: string, ms = 1000): TrainingResult => ({
  id,
  config: { game: 'schulte', difficulty: 'easy', variant: 'spatial' },
  completedAt: '2026-09-07T06:00:00.000Z',
  durationMs: ms,
  metrics: { kind: 'schulte', mistakes: 0 },
});
describe('local scores', () => {
  it('restores extreme records alongside existing records and separates their best scores', () => {
    const previous = sample('original');
    const extreme: TrainingResult = {
      ...sample('extreme'),
      config: { game: 'sequence', difficulty: 'extreme', variant: 'digits' },
      metrics: {
        kind: 'sequence',
        perfectRounds: 4,
        correctPositions: 58,
        totalPositions: 60,
      },
    };
    const expert: TrainingResult = {
      ...extreme,
      id: 'expert',
      config: { ...extreme.config, difficulty: 'expert' },
      metrics: {
        kind: 'sequence',
        perfectRounds: 5,
        correctPositions: 50,
        totalPositions: 50,
      },
    };
    const data = [previous, expert, extreme].reduce(appendResult, emptyData());
    expect(writeData(localStorage, data)).toBeNull();
    const restored = readData(localStorage).data;
    expect(restored.history).toHaveLength(3);
    expect(restored.best[configKey(previous.config)]).toEqual(previous);
    expect(restored.best[configKey(expert.config)]).toEqual(expert);
    expect(restored.best[configKey(extreme.config)]).toEqual(extreme);
  });
  it('keeps 200 recent records and preserves an older best and lifetime totals', () => {
    let data = emptyData();
    const best = sample('first', 500);
    data = appendResult(data, best);
    for (let i = 0; i < 205; i++)
      data = appendResult(data, sample(`later-${i}`));
    expect(data.history).toHaveLength(200);
    expect(data.history.at(-1)?.id).toBe('later-5');
    expect(data.best[configKey(best.config)]).toEqual(best);
    expect(data.totalCount).toBe(206);
    expect(data.totalMs).toBe(205500);
  });
  it('saves each result once and partitions difficulty and memory variant', () => {
    const result = sample('same');
    const data = appendResult(emptyData(), result);
    expect(appendResult(data, result)).toBe(data);
    expect(
      isBetter(
        { ...result, config: { ...result.config, difficulty: 'expert' } },
        result,
      ),
    ).toBe(false);
    expect(
      configKey({ game: 'sequence', difficulty: 'easy', variant: 'spatial' }),
    ).not.toBe(
      configKey({ game: 'sequence', difficulty: 'easy', variant: 'digits' }),
    );
    expect(
      isBetter(
        { ...sample('b', 100), metrics: { kind: 'schulte', mistakes: 1 } },
        result,
      ),
    ).toBe(false);
  });
  it('compares each metric with its intended tie breaker', () => {
    const stroop: TrainingResult = {
      ...sample('s'),
      config: { game: 'stroop', difficulty: 'easy', variant: 'spatial' },
      metrics: {
        kind: 'stroop',
        correct: 10,
        mistakes: 2,
        timeouts: 0,
        accuracy: 0.8,
        reactionMs: 500,
      },
    };
    expect(
      isBetter(
        {
          ...stroop,
          metrics: {
            ...(stroop.metrics as Extract<
              typeof stroop.metrics,
              { kind: 'stroop' }
            >),
            accuracy: 0.9,
          },
        },
        stroop,
      ),
    ).toBe(true);
    const memory: TrainingResult = {
      ...sample('m'),
      config: { game: 'sequence', difficulty: 'easy', variant: 'spatial' },
      metrics: {
        kind: 'sequence',
        perfectRounds: 2,
        correctPositions: 10,
        totalPositions: 15,
      },
    };
    expect(
      isBetter(
        {
          ...memory,
          metrics: {
            kind: 'sequence',
            perfectRounds: 2,
            correctPositions: 11,
            totalPositions: 15,
          },
        },
        memory,
      ),
    ).toBe(true);
    const tracking: TrainingResult = {
      ...sample('t'),
      config: { game: 'tracking', difficulty: 'easy', variant: 'spatial' },
      metrics: {
        kind: 'tracking',
        foundTargets: 6,
        totalTargets: 10,
        perfectRounds: 1,
      },
    };
    expect(
      isBetter(
        {
          ...tracking,
          metrics: {
            kind: 'tracking',
            foundTargets: 6,
            totalTargets: 10,
            perfectRounds: 2,
          },
        },
        tracking,
      ),
    ).toBe(true);
  });
  it('loads settings and scores and recovers from malformed or unavailable storage', () => {
    const data = { ...appendResult(emptyData(), sample('a')), sound: false };
    expect(writeData(localStorage, data)).toBeNull();
    expect(readData(localStorage).data).toEqual(data);
    localStorage.setItem(STORAGE_KEY, '{bad json');
    expect(readData(localStorage).warning).not.toBeNull();
    expect(
      readData({
        getItem() {
          throw new Error('blocked');
        },
      }).data.history,
    ).toEqual([]);
    expect(
      writeData(
        {
          setItem() {
            throw new Error('quota');
          },
        },
        data,
      ),
    ).toMatch('无法保存');
  });
});
