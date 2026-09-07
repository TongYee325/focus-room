import { SETTINGS, isConfig, type TrainingConfig } from './config';

export type Phase =
  | 'active'
  | 'show'
  | 'recall'
  | 'highlight'
  | 'motion'
  | 'select'
  | 'review'
  | 'done';
export interface Ball {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
}
export interface Question {
  ink: number;
  word: number;
}
export interface Feedback {
  serial: number;
  kind: 'correct' | 'error' | 'complete';
  message: string;
  until: number;
}
export interface Run {
  id: string;
  config: TrainingConfig;
  seed: number;
  paused: boolean;
  countdownMs: number;
  elapsedMs: number;
  phaseMs: number;
  phase: Phase;
  round: number;
  grid: number[];
  nextNumber: number;
  mistakes: number;
  wrongCell: number | null;
  question: Question;
  questionMs: number;
  cooldownMs: number;
  correct: number;
  timeouts: number;
  reactionTimes: number[];
  sequence: number[];
  answer: number[];
  correctPositions: number;
  perfectRounds: number;
  balls: Ball[];
  targets: number[];
  selected: number[];
  foundTargets: number;
  feedback: Feedback | null;
}
export type RunAction =
  | { type: 'tick'; ms: number }
  | { type: 'answer'; value: number }
  | { type: 'pause' | 'resume' | 'undo' | 'submit' | 'next' };
export const BALL_RADIUS = 0.055;

export function seededRandom(seed: number) {
  let state = seed >>> 0;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  return { random, state: () => state };
}
export function shuffle<T>(items: readonly T[], random = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export function makeQuestion(
  colors: number,
  conflict: number,
  random = Math.random,
): Question {
  const ink = Math.floor(random() * colors);
  const word =
    random() < conflict
      ? (ink + 1 + Math.floor(random() * (colors - 1))) % colors
      : ink;
  return { ink, word };
}
export function makeSequence(
  length: number,
  spatial: boolean,
  random = Math.random,
): number[] {
  const result: number[] = [];
  for (let i = 0; i < length; i++) {
    let n = Math.floor(random() * (spatial ? 9 : 10));
    if (spatial && n === result[i - 1])
      n = (n + 1 + Math.floor(random() * 8)) % 9;
    result.push(n);
  }
  return result;
}
export function makeBalls(
  count: number,
  speed: number,
  random = Math.random,
): Ball[] {
  const rows = Math.max(3, Math.ceil(count / 4));
  const slots = shuffle(
    Array.from({ length: rows * 4 }, (_, i) => i),
    random,
  );
  return slots.slice(0, count).map((slot, id) => {
    const angle = random() * Math.PI * 2;
    return {
      id,
      x: 0.17 + (slot % 4) * 0.22 + (random() - 0.5) * 0.025,
      y:
        0.2 +
        Math.floor(slot / 4) * (0.6 / (rows - 1)) +
        (random() - 0.5) * 0.025,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
    };
  });
}
export function moveBalls(input: readonly Ball[], seconds: number): Ball[] {
  const balls = input.map((ball) => ({ ...ball }));
  const steps = Math.max(1, Math.ceil(seconds * 120));
  const dt = seconds / steps;
  const wall = (b: Ball) => {
    if (b.x < BALL_RADIUS) {
      b.x = BALL_RADIUS;
      b.vx = Math.abs(b.vx);
    }
    if (b.x > 1 - BALL_RADIUS) {
      b.x = 1 - BALL_RADIUS;
      b.vx = -Math.abs(b.vx);
    }
    if (b.y < BALL_RADIUS) {
      b.y = BALL_RADIUS;
      b.vy = Math.abs(b.vy);
    }
    if (b.y > 1 - BALL_RADIUS) {
      b.y = 1 - BALL_RADIUS;
      b.vy = -Math.abs(b.vy);
    }
  };
  for (let step = 0; step < steps; step++) {
    for (const b of balls) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      wall(b);
    }
    // Iterative separation resolves crowded corners without changing identities.
    for (let pass = 0; pass < 4; pass++) {
      for (let i = 0; i < balls.length; i++)
        for (let j = i + 1; j < balls.length; j++) {
          const a = balls[i],
            b = balls[j];
          const dx = b.x - a.x,
            dy = b.y - a.y,
            distance = Math.hypot(dx, dy);
          if (distance >= BALL_RADIUS * 2) continue;
          const nx = distance ? dx / distance : 1,
            ny = distance ? dy / distance : 0;
          const overlap = (BALL_RADIUS * 2 - distance + 0.00001) / 2;
          a.x -= nx * overlap;
          a.y -= ny * overlap;
          b.x += nx * overlap;
          b.y += ny * overlap;
          const approach = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
          if (approach > 0) {
            a.vx -= approach * nx;
            a.vy -= approach * ny;
            b.vx += approach * nx;
            b.vy += approach * ny;
          }
          wall(a);
          wall(b);
        }
    }
  }
  return balls;
}
function freshRound(run: Run): Run {
  const s = SETTINGS[run.config.difficulty],
    rng = seededRandom(run.seed);
  if (run.config.game === 'sequence')
    return {
      ...run,
      phase: 'show',
      phaseMs: 0,
      answer: [],
      sequence: makeSequence(
        s[run.config.variant],
        run.config.variant === 'spatial',
        rng.random,
      ),
      seed: rng.state(),
      feedback: null,
    };
  const balls = makeBalls(s.balls, s.speed, rng.random);
  const targets = shuffle(
    balls.map((b) => b.id),
    rng.random,
  ).slice(0, s.targets);
  return {
    ...run,
    phase: 'highlight',
    phaseMs: 0,
    balls,
    targets,
    selected: [],
    seed: rng.state(),
    feedback: null,
  };
}
export function createRun(
  config: TrainingConfig,
  id: string,
  seed: number,
): Run {
  if (!isConfig(config)) throw new Error('此训练不支持所选难度');
  const s = SETTINGS[config.difficulty],
    rng = seededRandom(seed);
  let run: Run = {
    id,
    config: { ...config },
    seed,
    paused: false,
    countdownMs: 3000,
    elapsedMs: 0,
    phaseMs: 0,
    phase: 'active',
    round: 1,
    grid: shuffle(
      Array.from({ length: s.size ** 2 }, (_, i) => i + 1),
      rng.random,
    ),
    nextNumber: 1,
    mistakes: 0,
    wrongCell: null,
    question: makeQuestion(s.colors, s.conflict, rng.random),
    questionMs: 0,
    cooldownMs: 0,
    correct: 0,
    timeouts: 0,
    reactionTimes: [],
    sequence: [],
    answer: [],
    correctPositions: 0,
    perfectRounds: 0,
    balls: [],
    targets: [],
    selected: [],
    foundTargets: 0,
    feedback: null,
  };
  run.seed = rng.state();
  if (config.game === 'sequence' || config.game === 'tracking')
    run = freshRound(run);
  return run;
}
function withFeedback(run: Run, kind: Feedback['kind'], message: string): Run {
  return {
    ...run,
    feedback: {
      serial: (run.feedback?.serial ?? 0) + 1,
      kind,
      message,
      until: run.elapsedMs + 750,
    },
  };
}
function answerStroop(run: Run, value: number | null): Run {
  const good = value === run.question.ink;
  return withFeedback(
    {
      ...run,
      correct: run.correct + Number(good),
      mistakes: run.mistakes + Number(!good),
      timeouts: run.timeouts + Number(value === null),
      reactionTimes: good
        ? [...run.reactionTimes, run.questionMs]
        : run.reactionTimes,
      cooldownMs: 150,
    },
    good ? 'correct' : 'error',
    good ? '正确' : value === null ? '本题超时' : '留意文字的颜色',
  );
}
function tickSlice(run: Run, ms: number): Run {
  if (run.paused || run.phase === 'done') return run;
  if (run.countdownMs > 0)
    return { ...run, countdownMs: Math.max(0, run.countdownMs - ms) };
  if (run.phase === 'review') return run;
  const s = SETTINGS[run.config.difficulty];
  let next = {
    ...run,
    elapsedMs: run.elapsedMs + ms,
    phaseMs: run.phaseMs + ms,
  };
  if (run.config.game === 'stroop') {
    if (next.elapsedMs >= 60000)
      return { ...next, elapsedMs: 60000, phase: 'done' };
    if (run.cooldownMs > 0) {
      next.cooldownMs = Math.max(0, run.cooldownMs - ms);
      if (!next.cooldownMs) {
        const rng = seededRandom(run.seed);
        next.question = makeQuestion(s.colors, s.conflict, rng.random);
        next.seed = rng.state();
        next.questionMs = 0;
      }
    } else {
      next.questionMs = run.questionMs + ms;
      if (next.questionMs >= s.deadline)
        next = answerStroop({ ...next, questionMs: s.deadline }, null);
    }
  }
  if (run.config.game === 'sequence' && run.phase === 'show') {
    if (next.phaseMs >= run.sequence.length * (s.exposure + 200) - 200) {
      next.phase = 'recall';
      next.phaseMs = 0;
    }
  }
  if (run.config.game === 'tracking') {
    if (run.phase === 'highlight' && next.phaseMs >= 2000) {
      next.phase = 'motion';
      next.phaseMs = 0;
    }
    if (run.phase === 'motion') {
      next.balls = moveBalls(
        run.balls,
        Math.min(ms, s.motion - run.phaseMs) / 1000,
      );
      if (next.phaseMs >= s.motion) {
        next.phase = 'select';
        next.phaseMs = 0;
      }
    }
  }
  return next;
}
export function reduceRun(run: Run, action: RunAction): Run {
  if (action.type === 'pause')
    return run.phase === 'done' ? run : { ...run, paused: true };
  if (action.type === 'resume')
    return run.paused ? { ...run, paused: false, countdownMs: 3000 } : run;
  if (action.type === 'tick') {
    if (!Number.isFinite(action.ms) || action.ms <= 0) return run;
    let next = run,
      remaining = action.ms;
    while (remaining > 0) {
      const step = Math.min(remaining, 20);
      const previous = next;
      next = tickSlice(next, step);
      remaining -= step;
      if (next === previous) break;
    }
    return next;
  }
  if (run.paused || run.countdownMs > 0 || run.phase === 'done') return run;
  const s = SETTINGS[run.config.difficulty];
  if (action.type === 'next' && run.phase === 'review')
    return run.round >= 5
      ? { ...run, phase: 'done' }
      : freshRound({ ...run, round: run.round + 1 });
  if (action.type === 'undo' && run.phase === 'recall')
    return { ...run, answer: run.answer.slice(0, -1) };
  if (action.type === 'submit') {
    if (run.phase === 'recall' && run.answer.length === run.sequence.length) {
      const count = run.answer.filter((v, i) => v === run.sequence[i]).length;
      const perfect = count === run.sequence.length;
      return withFeedback(
        {
          ...run,
          phase: 'review',
          correctPositions: run.correctPositions + count,
          perfectRounds: run.perfectRounds + Number(perfect),
        },
        perfect ? 'correct' : 'error',
        perfect
          ? '完整复现，做得不错'
          : `本轮 ${count} / ${run.sequence.length} 项位置正确`,
      );
    }
    if (run.phase === 'select' && run.selected.length === s.targets) {
      const found = run.selected.filter((id) =>
        run.targets.includes(id),
      ).length;
      return withFeedback(
        {
          ...run,
          phase: 'review',
          foundTargets: run.foundTargets + found,
          perfectRounds: run.perfectRounds + Number(found === s.targets),
        },
        found === s.targets ? 'correct' : 'error',
        `找回 ${found} / ${s.targets} 个目标`,
      );
    }
    return run;
  }
  if (action.type !== 'answer' || !Number.isInteger(action.value)) return run;
  const value = action.value;
  switch (run.config.game) {
    case 'schulte': {
      if (value < run.nextNumber || value > s.size ** 2) return run;
      if (value !== run.nextNumber)
        return withFeedback(
          { ...run, mistakes: run.mistakes + 1, wrongCell: value },
          'error',
          `下一个是 ${run.nextNumber}`,
        );
      const done = value === s.size ** 2;
      return withFeedback(
        {
          ...run,
          nextNumber: run.nextNumber + 1,
          wrongCell: null,
          phase: done ? 'done' : 'active',
        },
        done ? 'complete' : 'correct',
        done ? '方格已完成' : '正确',
      );
    }
    case 'stroop':
      return run.cooldownMs || value < 0 || value >= s.colors
        ? run
        : answerStroop(run, value);
    case 'sequence':
      return run.phase === 'recall' &&
        run.answer.length < run.sequence.length &&
        value >= 0 &&
        value < (run.config.variant === 'spatial' ? 9 : 10)
        ? { ...run, answer: [...run.answer, value] }
        : run;
    case 'tracking': {
      if (run.phase !== 'select' || !run.balls.some((b) => b.id === value))
        return run;
      if (run.selected.includes(value))
        return { ...run, selected: run.selected.filter((id) => id !== value) };
      return run.selected.length < s.targets
        ? { ...run, selected: [...run.selected, value] }
        : run;
    }
  }
}
export function visibleSequenceIndex(run: Run): number {
  if (run.phase !== 'show' || run.paused || run.countdownMs > 0) return -1;
  const duration = SETTINGS[run.config.difficulty].exposure;
  return run.phaseMs % (duration + 200) < duration
    ? Math.floor(run.phaseMs / (duration + 200))
    : -1;
}
export function publicRunState(run: Run | null) {
  if (!run) return null;
  return {
    id: run.id,
    config: run.config,
    phase: run.phase,
    paused: run.paused,
    countdownMs: run.countdownMs,
    elapsedMs: run.elapsedMs,
    round: run.round,
  };
}
