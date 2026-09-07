'use client';
import { useEffect, useRef } from 'react';
import { ArrowRight, Check, CornerDownLeft, Delete } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { COLORS, SETTINGS } from '@/lib/training/config';
import {
  BALL_RADIUS,
  visibleSequenceIndex,
  type Run,
  type RunAction,
} from '@/lib/training/engine';

type GameProps = { run: Run; dispatch: (action: RunAction) => void };
export function GameBoard({ run, dispatch }: GameProps) {
  switch (run.config.game) {
    case 'schulte':
      return <Schulte run={run} dispatch={dispatch} />;
    case 'stroop':
      return <Stroop run={run} dispatch={dispatch} />;
    case 'sequence':
      return <Sequence run={run} dispatch={dispatch} />;
    case 'tracking':
      return <Tracking run={run} dispatch={dispatch} />;
  }
}
function Schulte({ run, dispatch }: GameProps) {
  const size = SETTINGS[run.config.difficulty].size;
  return (
    <div
      className="schulte-board"
      style={{
        gridTemplateColumns: `repeat(${size}, 1fr)`,
        minHeight: size * 44 + (size - 1) * 6,
      }}
      aria-label="舒尔特数字方格"
    >
      {run.grid.map((number) => (
        <button
          key={number}
          className={`number-cell ${run.wrongCell === number && run.feedback && run.elapsedMs < run.feedback.until ? 'wrong-cell' : ''}`}
          onClick={() => dispatch({ type: 'answer', value: number })}
          aria-label={`数字 ${number}`}
        >
          {number}
        </button>
      ))}
    </div>
  );
}
function Stroop({ run, dispatch }: GameProps) {
  const s = SETTINGS[run.config.difficulty];
  return (
    <div className="stroop-board">
      <p className="board-instruction">
        这个词显示的是什么<span>颜色</span>？
      </p>
      <div
        className={`color-word ${run.cooldownMs ? 'word-feedback' : ''}`}
        style={{ color: COLORS[run.question.ink].hex }}
        aria-label={`${COLORS[run.question.word].name}，请观察文字颜色`}
      >
        {COLORS[run.question.word].name}
      </div>
      <div className="question-progress">
        <Progress
          value={Math.max(0, (1 - run.questionMs / s.deadline) * 100)}
          aria-label="本题剩余时间"
        />
      </div>
      <div className={`color-options ${s.colors === 6 ? 'six-colors' : ''}`}>
        {COLORS.slice(0, s.colors).map((color, i) => (
          <Button
            key={color.name}
            variant="outline"
            className="color-choice"
            disabled={run.cooldownMs > 0}
            onClick={() => dispatch({ type: 'answer', value: i })}
          >
            <kbd>{i + 1}</kbd>
            {color.name}
          </Button>
        ))}
      </div>
      <p className="keyboard-hint">点击选项，或按数字键 1–{s.colors} 回答</p>
    </div>
  );
}
function Sequence({ run, dispatch }: GameProps) {
  const index = visibleSequenceIndex(run),
    spatial = run.config.variant === 'spatial';
  const recalling = run.phase === 'recall',
    review = run.phase === 'review';
  const format = (value: number) => (spatial ? value + 1 : value);
  return (
    <div className="sequence-board">
      <p className="board-instruction">
        {review
          ? '看看这一轮的结果'
          : recalling
            ? '现在，按原顺序复现'
            : '记住依次出现的' + (spatial ? '方块' : '数字')}
      </p>
      {spatial ? (
        <div className="spatial-grid" aria-label="空间记忆九宫格">
          {Array.from({ length: 9 }, (_, i) => (
            <button
              key={i}
              aria-label={`方块 ${i + 1}`}
              disabled={!recalling || run.answer.length === run.sequence.length}
              className={`spatial-cell ${index >= 0 && run.sequence[index] === i ? 'flashing-cell' : ''}`}
              onClick={() => dispatch({ type: 'answer', value: i })}
            >
              <span>{i + 1}</span>
              {recalling && run.answer.at(-1) === i && <i />}
            </button>
          ))}
        </div>
      ) : (
        <div
          className={`digit-display ${recalling || review ? 'ready-display' : ''}`}
          aria-label={recalling ? '请输入记住的数字' : '数字展示区域'}
        >
          {index >= 0 ? (
            run.sequence[index]
          ) : recalling ? (
            <span>轮到你了</span>
          ) : review ? (
            <Check size={44} />
          ) : (
            <span className="digit-gap">·</span>
          )}
        </div>
      )}
      {!review && !recalling && (
        <div className="sequence-exposure-progress">
          <span>观察阶段</span>
          <span>{run.sequence.length} 项序列</span>
        </div>
      )}
      {(recalling || review) && (
        <div className="sequence-answer">
          <span className="answer-label">
            {review
              ? '你的答案'
              : `已输入 ${run.answer.length} / ${run.sequence.length}`}
          </span>
          <div className="answer-slots">
            {run.sequence.map((_, i) => (
              <span
                key={i}
                className={
                  review
                    ? run.answer[i] === run.sequence[i]
                      ? 'answer-good'
                      : 'answer-bad'
                    : ''
                }
              >
                {run.answer[i] !== undefined ? format(run.answer[i]) : '·'}
              </span>
            ))}
          </div>
        </div>
      )}
      {recalling && !spatial && (
        <div className="digit-keypad">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((n) => (
            <Button
              key={n}
              variant="outline"
              disabled={run.answer.length >= run.sequence.length}
              onClick={() => dispatch({ type: 'answer', value: n })}
              aria-label={`输入 ${n}`}
            >
              {n}
            </Button>
          ))}
        </div>
      )}
      {recalling && (
        <div className="round-actions">
          <Button
            variant="outline"
            className="control-button"
            disabled={!run.answer.length}
            onClick={() => dispatch({ type: 'undo' })}
          >
            <Delete /> 撤销
          </Button>
          <Button
            className="control-button"
            disabled={run.answer.length !== run.sequence.length}
            onClick={() => dispatch({ type: 'submit' })}
          >
            提交答案 <CornerDownLeft />
          </Button>
        </div>
      )}
      {review && (
        <div className="round-review">
          <p
            className={
              run.feedback?.kind === 'correct' ? 'text-success' : 'text-error'
            }
          >
            {run.feedback?.message}
          </p>
          <div className="correct-sequence">
            <span>正确序列</span>
            <strong>{run.sequence.map(format).join('  →  ')}</strong>
          </div>
          <NextRound run={run} dispatch={dispatch} />
        </div>
      )}
      {recalling && (
        <p className="keyboard-hint">
          {spatial ? '点击方块或按 1–9' : '支持键盘数字输入'} · Backspace 撤销 ·
          Enter 提交
        </p>
      )}
    </div>
  );
}
function NextRound({ run, dispatch }: GameProps) {
  return (
    <Button
      className="control-button primary-action"
      onClick={() => dispatch({ type: 'next' })}
    >
      {run.round === 5 ? '查看成绩' : '下一轮'} <ArrowRight />
    </Button>
  );
}
function Tracking({ run, dispatch }: GameProps) {
  const review = run.phase === 'review',
    selecting = run.phase === 'select';
  const s = SETTINGS[run.config.difficulty];
  return (
    <div className="tracking-board">
      <p className="board-instruction">
        {review
          ? '目标已揭晓'
          : selecting
            ? `选出最初的 ${s.targets} 个目标`
            : run.phase === 'highlight'
              ? `记住这 ${s.targets} 个高亮小球`
              : '保持目光，跟随目标'}
      </p>
      <TrackingCanvas run={run} dispatch={dispatch} />
      {selecting && (
        <div className="tracking-submit">
          <span>
            已选择 <strong>{run.selected.length}</strong> / {s.targets}
          </span>
          <Button
            className="control-button"
            disabled={run.selected.length !== s.targets}
            onClick={() => dispatch({ type: 'submit' })}
          >
            确认目标 <Check />
          </Button>
        </div>
      )}
      {run.phase === 'motion' && (
        <div className="tracking-progress">
          <Progress
            value={(1 - run.phaseMs / s.motion) * 100}
            aria-label="追踪剩余时间"
          />
          <span>{Math.ceil((s.motion - run.phaseMs) / 1000)} 秒</span>
        </div>
      )}
      {run.phase === 'highlight' && (
        <p className="keyboard-hint">记住目标后，小球将以相同颜色移动</p>
      )}
      {review && (
        <div className="round-review">
          <p
            className={
              run.feedback?.kind === 'correct' ? 'text-success' : 'text-error'
            }
          >
            {run.feedback?.message}
          </p>
          <p className="tracking-legend">
            <span>● 正确目标</span>
            <span>已选错误目标以红色标出</span>
          </p>
          <NextRound run={run} dispatch={dispatch} />
        </div>
      )}
    </div>
  );
}
function TrackingCanvas({ run, dispatch }: GameProps) {
  const canvas = useRef<HTMLCanvasElement>(null),
    wrapper = useRef<HTMLDivElement>(null);
  const latest = useRef(run);
  const drawRef = useRef<() => void>(() => {});
  useEffect(() => {
    const draw = () => {
      const el = canvas.current,
        parent = wrapper.current;
      if (!el || !parent) return;
      const r = latest.current,
        size = parent.clientWidth,
        dpr = Math.min(devicePixelRatio || 1, 2);
      if (el.width !== Math.round(size * dpr)) {
        el.width = Math.round(size * dpr);
        el.height = Math.round(size * dpr);
      }
      const ctx = el.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
      ctx.fillStyle = '#303c33';
      for (let x = 18; x < size; x += 24)
        for (let y = 18; y < size; y += 24) {
          ctx.beginPath();
          ctx.arc(x, y, 0.65, 0, Math.PI * 2);
          ctx.fill();
        }
      for (const b of r.balls) {
        const target = r.targets.includes(b.id),
          selected = r.selected.includes(b.id),
          reveal = r.phase === 'review';
        const highlighted = target && (r.phase === 'highlight' || reveal),
          radius = size * BALL_RADIUS;
        ctx.beginPath();
        ctx.arc(b.x * size, b.y * size, radius, 0, Math.PI * 2);
        ctx.fillStyle = highlighted
          ? '#b5ecd0'
          : reveal && selected
            ? '#cb8383'
            : selected
              ? '#7db092'
              : '#93a89b';
        ctx.fill();
        if (highlighted || selected) {
          ctx.beginPath();
          ctx.arc(b.x * size, b.y * size, radius + 4, 0, Math.PI * 2);
          ctx.strokeStyle = highlighted ? '#80b797' : '#bddac9';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
        if (r.phase === 'select' || reveal) {
          ctx.fillStyle = '#13271b';
          ctx.font =
            '500 ' + Math.max(13, size * 0.036) + 'px Consolas,monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(b.id + 1), b.x * size, b.y * size + 1);
        }
      }
    };
    drawRef.current = draw;
    draw();
    const observer = new ResizeObserver(draw);
    if (wrapper.current) observer.observe(wrapper.current);
    return () => {
      observer.disconnect();
      drawRef.current = () => {};
    };
  }, []);
  useEffect(() => {
    latest.current = run;
    drawRef.current();
  }, [run]);
  return (
    <div className="tracking-field" ref={wrapper}>
      <canvas ref={canvas} aria-label="小球追踪场地" />
      {run.phase === 'select' &&
        run.balls.map((ball) => (
          <button
            key={ball.id}
            aria-label={`小球 ${ball.id + 1}`}
            aria-pressed={run.selected.includes(ball.id)}
            className="ball-hit-target"
            style={{ left: `${ball.x * 100}%`, top: `${ball.y * 100}%` }}
            onClick={() => dispatch({ type: 'answer', value: ball.id })}
          />
        ))}
    </div>
  );
}
