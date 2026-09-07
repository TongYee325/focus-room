import { describe, expect, it } from 'vitest';
import {
  DIFFICULTIES,
  GAME_DIFFICULTIES,
  SETTINGS,
  type TrainingConfig,
} from '../lib/training/config';
import {
  BALL_RADIUS,
  createRun,
  makeBalls,
  makeQuestion,
  makeSequence,
  moveBalls,
  publicRunState,
  reduceRun,
  seededRandom,
  shuffle,
  visibleSequenceIndex,
  type Run,
} from '../lib/training/engine';
import { resultFromRun } from '../lib/training/storage';
const start = (config: TrainingConfig) =>
  reduceRun(createRun(config, 'test-run', 314159), { type: 'tick', ms: 3000 });
const tick = (run: Run, ms: number) => reduceRun(run, { type: 'tick', ms });
describe('all presets complete valid sessions', () => {
  for (const difficulty of DIFFICULTIES) {
    if (GAME_DIFFICULTIES.schulte.includes(difficulty))
      it(`Schulte / ${difficulty}`, () => {
        let run = start({ game: 'schulte', difficulty, variant: 'spatial' });
        const count = SETTINGS[difficulty].size ** 2;
        expect([...run.grid].sort((a, b) => a - b)).toEqual(
          Array.from({ length: count }, (_, i) => i + 1),
        );
        run = reduceRun(run, { type: 'answer', value: 2 });
        expect(run.mistakes).toBe(1);
        expect(run.nextNumber).toBe(1);
        for (let value = 1; value <= count; value++) {
          run = tick(run, 120);
          run = reduceRun(run, { type: 'answer', value });
        }
        expect(run.phase).toBe('done');
        expect(resultFromRun(run).durationMs).toBe(count * 120);
        expect(reduceRun(run, { type: 'answer', value: count })).toBe(run);
      });
    if (GAME_DIFFICULTIES.stroop.includes(difficulty))
      it(`Stroop / ${difficulty}`, () => {
        let run = start({ game: 'stroop', difficulty, variant: 'spatial' });
        run = tick(run, 400);
        run = reduceRun(run, { type: 'answer', value: run.question.ink });
        expect(run.correct).toBe(1);
        expect(run.reactionTimes).toEqual([400]);
        expect(
          reduceRun(run, { type: 'answer', value: run.question.ink }),
        ).toBe(run);
        run = tick(run, 160);
        run = reduceRun(run, {
          type: 'answer',
          value: (run.question.ink + 1) % SETTINGS[difficulty].colors,
        });
        expect(run.mistakes).toBe(1);
        run = tick(run, 160);
        run = tick(run, SETTINGS[difficulty].deadline);
        expect(run.timeouts).toBe(1);
        run = tick(run, 60000);
        expect(run.elapsedMs).toBe(60000);
        expect(run.phase).toBe('done');
        const result = resultFromRun(run);
        expect(result.metrics.kind).toBe('stroop');
      });
    for (const variant of ['spatial', 'digits'] as const)
      it(`Sequence / ${variant} / ${difficulty}`, () => {
        let run = start({ game: 'sequence', difficulty, variant });
        const length = SETTINGS[difficulty][variant];
        for (let round = 1; round <= 5; round++) {
          expect(run.round).toBe(round);
          expect(run.sequence).toHaveLength(length);
          expect(reduceRun(run, { type: 'answer', value: 0 })).toBe(run);
          run = tick(run, length * (SETTINGS[difficulty].exposure + 200));
          expect(run.phase).toBe('recall');
          expect(reduceRun(run, { type: 'submit' })).toBe(run);
          for (const value of run.sequence)
            run = reduceRun(run, { type: 'answer', value });
          expect(reduceRun(run, { type: 'answer', value: 0 })).toBe(run);
          run = reduceRun(run, { type: 'undo' });
          expect(run.answer).toHaveLength(length - 1);
          run = reduceRun(run, {
            type: 'answer',
            value: run.sequence[length - 1],
          });
          run = reduceRun(run, { type: 'submit' });
          expect(run.phase).toBe('review');
          expect(reduceRun(run, { type: 'submit' })).toBe(run);
          expect(tick(run, 5000)).toBe(run);
          run = reduceRun(run, { type: 'next' });
        }
        expect(run.phase).toBe('done');
        expect(run.perfectRounds).toBe(5);
        expect(run.correctPositions).toBe(length * 5);
      });
    it(`Tracking / ${difficulty}`, () => {
      let run = start({ game: 'tracking', difficulty, variant: 'spatial' });
      const s = SETTINGS[difficulty];
      for (let round = 1; round <= 5; round++) {
        const targets = [...run.targets];
        expect(run.balls).toHaveLength(s.balls);
        expect(targets).toHaveLength(s.targets);
        expect(reduceRun(run, { type: 'answer', value: targets[0] })).toBe(run);
        run = tick(run, 2000);
        expect(run.phase).toBe('motion');
        run = tick(run, s.motion);
        expect(run.phase).toBe('select');
        expect(run.targets).toEqual(targets);
        for (const value of targets)
          run = reduceRun(run, { type: 'answer', value });
        expect(run.selected).toHaveLength(s.targets);
        const extra = run.balls.find((b) => !targets.includes(b.id))!.id;
        expect(reduceRun(run, { type: 'answer', value: extra })).toBe(run);
        run = reduceRun(run, { type: 'submit' });
        expect(run.phase).toBe('review');
        expect(reduceRun(run, { type: 'submit' })).toBe(run);
        run = reduceRun(run, { type: 'next' });
      }
      expect(run.phase).toBe('done');
      expect(run.foundTargets).toBe(s.targets * 5);
      expect(run.perfectRounds).toBe(5);
    });
  }
});
describe('pause, generation, precision and privacy', () => {
  it('enforces each game difficulty range when creating a run', () => {
    for (const game of ['schulte', 'stroop'] as const) {
      expect(() =>
        createRun(
          { game, difficulty: 'extreme', variant: 'spatial' },
          'invalid',
          1,
        ),
      ).toThrow();
    }
    const s = SETTINGS.extreme,
      previous = SETTINGS.expert;
    expect(s.spatial).toBeGreaterThan(previous.spatial);
    expect(s.digits).toBeGreaterThan(previous.digits);
    expect(s.exposure).toBeLessThan(previous.exposure);
    expect(s.balls).toBeGreaterThan(previous.balls);
    expect(s.targets).toBeGreaterThan(previous.targets);
    expect(s.motion).toBeGreaterThan(previous.motion);
    expect(s.speed).toBeGreaterThan(previous.speed);
  });
  it('freezes initial countdown, elapsed time and answers, then resumes after three seconds', () => {
    let run = createRun(
      { game: 'sequence', difficulty: 'normal', variant: 'spatial' },
      'a',
      123,
    );
    run = tick(run, 1000);
    run = reduceRun(run, { type: 'pause' });
    expect(tick(run, 10000)).toBe(run);
    expect(visibleSequenceIndex(run)).toBe(-1);
    run = reduceRun(run, { type: 'resume' });
    expect(run.countdownMs).toBe(3000);
    run = tick(run, 3000);
    run = tick(run, 400);
    const before = run;
    run = reduceRun(run, { type: 'pause' });
    run = tick(run, 10000);
    run = reduceRun(run, { type: 'resume' });
    run = tick(run, 3000);
    expect(run.elapsedMs).toBe(before.elapsedMs);
    expect(run.phaseMs).toBe(before.phaseMs);
    expect(run.sequence).toEqual(before.sequence);
  });
  it('can pause and resume a review without getting stuck on a countdown', () => {
    let run = start({
      game: 'tracking',
      difficulty: 'easy',
      variant: 'spatial',
    });
    run = tick(run, 10000);
    for (const value of run.targets)
      run = reduceRun(run, { type: 'answer', value });
    run = reduceRun(run, { type: 'submit' });
    run = reduceRun(run, { type: 'pause' });
    run = reduceRun(run, { type: 'resume' });
    run = tick(run, 3000);
    expect(run.countdownMs).toBe(0);
    expect(reduceRun(run, { type: 'next' }).round).toBe(2);
  });
  it('ignores duplicate Schulte clicks and invalid inputs', () => {
    let run = start({
      game: 'schulte',
      difficulty: 'easy',
      variant: 'spatial',
    });
    run = reduceRun(run, { type: 'answer', value: 1 });
    expect(reduceRun(run, { type: 'answer', value: 1 })).toBe(run);
    for (const value of [-1, 0, 100, NaN, 1.2])
      expect(reduceRun(run, { type: 'answer', value })).toBe(run);
    expect(() => resultFromRun(run)).toThrow();
  });
  it('maintains spatial sequence rules and requested conflicts', () => {
    const rng = seededRandom(14);
    const sequence = makeSequence(1000, true, rng.random);
    expect(
      sequence.every(
        (n, i) => n >= 0 && n < 9 && (i === 0 || n !== sequence[i - 1]),
      ),
    ).toBe(true);
    for (const colors of [4, 6])
      for (let i = 0; i < 100; i++) {
        const yes = makeQuestion(colors, 1, rng.random),
          no = makeQuestion(colors, 0, rng.random);
        expect(yes.ink).not.toBe(yes.word);
        expect(no.ink).toBe(no.word);
        expect(yes.word).toBeLessThan(colors);
      }
    expect(shuffle([1, 2, 3], seededRandom(1).random)).toEqual(
      shuffle([1, 2, 3], seededRandom(1).random),
    );
  });
  it('shows complete items and hides the 200ms gap', () => {
    let run = start({
      game: 'sequence',
      difficulty: 'easy',
      variant: 'digits',
    });
    expect(visibleSequenceIndex(run)).toBe(0);
    run = tick(run, 800);
    expect(visibleSequenceIndex(run)).toBe(-1);
    run = tick(run, 200);
    expect(visibleSequenceIndex(run)).toBe(1);
  });
  it.each(['expert', 'extreme'] as const)(
    'retains ball identities and bounds across crowded %s simulations',
    (difficulty) => {
      const setting = SETTINGS[difficulty];
      let balls = makeBalls(
        setting.balls,
        setting.speed,
        seededRandom(789).random,
      );
      for (let frame = 0; frame < 900; frame++) {
        balls = moveBalls(balls, 1 / 60);
        for (const b of balls) {
          expect(b.x).toBeGreaterThanOrEqual(BALL_RADIUS - 0.001);
          expect(b.x).toBeLessThanOrEqual(1 - BALL_RADIUS + 0.001);
          expect(b.y).toBeGreaterThanOrEqual(BALL_RADIUS - 0.001);
          expect(b.y).toBeLessThanOrEqual(1 - BALL_RADIUS + 0.001);
        }
        for (let i = 0; i < balls.length; i++)
          for (let j = i + 1; j < balls.length; j++)
            expect(
              Math.hypot(balls[i].x - balls[j].x, balls[i].y - balls[j].y),
            ).toBeGreaterThan(BALL_RADIUS * 2 - 0.003);
      }
      expect(balls.map((b) => b.id)).toEqual(
        Array.from({ length: setting.balls }, (_, i) => i),
      );
    },
  );
  it('moves by time rather than display frame count', () => {
    const initial = [{ id: 0, x: 0.3, y: 0.3, vx: 0.12, vy: 0.1 }];
    let a = initial,
      b = initial;
    for (let i = 0; i < 30; i++) a = moveBalls(a, 1 / 30);
    for (let i = 0; i < 144; i++) b = moveBalls(b, 1 / 144);
    expect(a[0].x).toBeCloseTo(b[0].x, 9);
    expect(a[0].y).toBeCloseTo(b[0].y, 9);
  });
  it('does not expose private sequence or tracking answers through public state', () => {
    for (const game of ['sequence', 'tracking'] as const) {
      const state = publicRunState(
        start({ game, difficulty: 'expert', variant: 'digits' }),
      )!;
      for (const key of ['sequence', 'targets', 'balls', 'seed', 'answer'])
        expect(state).not.toHaveProperty(key);
    }
  });
});
