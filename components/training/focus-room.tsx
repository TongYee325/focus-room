'use client';
import { useEffect, useRef } from 'react';
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  Clock3,
  Focus,
  History,
  Keyboard,
  Moon,
  Pause,
  Play,
  RotateCcw,
  Trophy,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Progress } from '@/components/ui/progress';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useTraining, type AppState } from '@/hooks/use-training';
import {
  GAME_DIFFICULTIES,
  DIFFICULTY_NAMES,
  GAMES,
  SETTINGS,
  configKey,
  gameInfo,
  settingDescription,
  type Difficulty,
  type MemoryVariant,
  type TrainingConfig,
} from '@/lib/training/config';
import {
  percent,
  primaryResult,
  resultStats,
  seconds,
  type SavedData,
  type TrainingResult,
} from '@/lib/training/storage';
import type { Run, RunAction } from '@/lib/training/engine';
import { Miniature } from './miniature';
import { GameBoard } from './games';

type Controller = ReturnType<typeof useTraining>;
export default function FocusRoom() {
  const controller = useTraining(),
    { app } = controller;
  const heading = useRef<HTMLDivElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [app.screen]);
  return (
    <div className="app-shell">
      <header className="site-header">
        <button className="brand" onClick={() => controller.navigate('menu')}>
          <span className="brand-mark">
            <Focus size={22} />
          </span>
          <span>
            专注训练室<small>FOCUS ROOM</small>
          </span>
        </button>
        <div className="header-actions">
          <span className="night-label">
            <Moon size={14} /> 夜间模式
          </span>
          <Button
            variant="ghost"
            size="icon"
            aria-label={app.data.sound ? '关闭音效' : '开启音效'}
            aria-pressed={app.data.sound}
            title={app.data.sound ? '关闭音效' : '开启音效'}
            onClick={controller.toggleSound}
            disabled={!app.ready}
          >
            {app.data.sound ? <Volume2 /> : <VolumeX />}
          </Button>
          <Button
            variant="ghost"
            className={app.screen === 'history' ? 'active-nav' : ''}
            onClick={() =>
              controller.navigate(app.screen === 'history' ? 'menu' : 'history')
            }
          >
            <History /> <span>训练记录</span>
          </Button>
        </div>
      </header>
      <main className={`main-content screen-${app.screen}`}>
        <div
          ref={heading}
          tabIndex={-1}
          className="page-focus"
          aria-label={
            app.screen === 'menu'
              ? '训练菜单'
              : app.screen === 'result'
                ? '训练成绩'
                : app.screen === 'history'
                  ? '训练记录'
                  : gameInfo(app.config.game).name
          }
        />
        {app.warning && (
          <output className="storage-warning">{app.warning}</output>
        )}
        {app.screen === 'menu' && (
          <Lobby
            data={app.data}
            onChoose={(config) => controller.configure(config)}
            config={app.config}
          />
        )}
        {app.screen === 'settings' && <SettingsPanel controller={controller} />}
        {app.screen === 'play' && app.run && (
          <PlayPanel
            run={app.run}
            dispatch={controller.dispatch}
            onExit={() => controller.navigate('menu')}
            onRestart={() => controller.navigate('restart')}
          />
        )}
        {app.screen === 'result' && app.result && (
          <Results
            app={app}
            onReplay={controller.start}
            onSettings={() => controller.configure(app.config)}
            onMenu={() => controller.navigate('menu')}
          />
        )}
        {app.screen === 'history' && (
          <HistoryPanel
            data={app.data}
            onMenu={() => controller.navigate('menu')}
          />
        )}
      </main>
      <footer className="site-footer">
        <span>
          <span className="status-dot" /> 成绩仅保存在当前浏览器
        </span>
        <span>
          {app.screen === 'play' ? 'Esc 暂停 / 继续' : 'FOCUS ROOM'}{' '}
          <span className="footer-symbol">↗</span>
        </span>
      </footer>
      <AlertDialog
        open={!!app.pending}
        onOpenChange={(open) => {
          if (!open) controller.cancelExit();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {app.pending?.destination === 'restart'
                ? '重新开始本次训练？'
                : '离开本次训练？'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              当前训练已暂停。尚未完成的这一局不会保存成绩。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>继续训练</AlertDialogCancel>
            <AlertDialogAction onClick={controller.confirmExit}>
              {app.pending?.destination === 'restart'
                ? '重新开始'
                : '放弃并离开'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Lobby({
  data,
  config,
  onChoose,
}: {
  data: SavedData;
  config: TrainingConfig;
  onChoose: (config: TrainingConfig) => void;
}) {
  return (
    <>
      <section className="lobby-heading">
        <div>
          <div className="eyebrow">
            <span /> YOUR SPACE TO FOCUS
          </div>
          <h1>
            选择训练<span className="mint-dot">.</span>
          </h1>
          <p>四种练习，多档难度，按自己的节奏开始。</p>
        </div>
        <div className="session-note">
          <span className="status-dot" /> 准备好，开始一次专注
          <ArrowDownRight size={22} />
        </div>
      </section>
      <div className="game-cards">
        {GAMES.map((game, index) => (
          <button
            key={game.id}
            className={`game-card card-${game.id}`}
            onClick={() => onChoose({ ...config, game: game.id })}
          >
            <div className="card-copy">
              <div className="card-topline">
                <span className="card-number">0{index + 1}</span>
                <span className="category-tag">{game.tag}</span>
              </div>
              <h2>{game.name}</h2>
              <p>{game.description}</p>
              <div className="card-bottom">
                <span>
                  {`${game.id === 'sequence' ? '空间 / 数字' : game.duration} · ${GAME_DIFFICULTIES[game.id].length} 档难度`}
                </span>
                <span className="card-arrow">
                  <ArrowUpRight size={20} />
                </span>
              </div>
            </div>
            <div className="card-visual">
              <Miniature game={game.id} />
              <span>{game.english}</span>
            </div>
          </button>
        ))}
      </div>
      <Summary data={data} />
    </>
  );
}
function Summary({ data }: { data: SavedData }) {
  const recent = data.history[0];
  return (
    <section className="local-summary">
      <div>
        <span className="summary-label">已完成训练</span>
        <strong>
          {data.totalCount} <small>次</small>
        </strong>
      </div>
      <div>
        <span className="summary-label">累计专注</span>
        <strong>
          {Math.floor(data.totalMs / 60000)} <small>分钟</small>
        </strong>
      </div>
      <div className="summary-message">
        <span className="tiny-orbit" />
        <p>
          {recent
            ? `最近练习 · ${gameInfo(recent.config.game).name}`
            : '从你的第一次训练开始。'}
          <small>
            {recent
              ? `${DIFFICULTY_NAMES[recent.config.difficulty]} · ${primaryResult(recent)}`
              : '完成训练后，在这里查看你的积累。'}
          </small>
        </p>
      </div>
    </section>
  );
}
function SettingsPanel({ controller }: { controller: Controller }) {
  const { app, configure, start, navigate } = controller;
  const { config } = app,
    game = gameInfo(config.game),
    s = SETTINGS[config.difficulty],
    best = app.data.best[configKey(config)];
  return (
    <>
      <Button
        variant="ghost"
        className="back-button"
        onClick={() => navigate('menu')}
      >
        <ArrowLeft /> 返回训练菜单
      </Button>
      <div className="training-title">
        <div className="eyebrow">TRAINING / {game.english}</div>
        <h1>
          {game.name}
          <span className="mint-dot">.</span>
        </h1>
        <p>{game.description}</p>
      </div>
      <div className="settings-layout">
        <section className="settings-main panel">
          <div className="section-label">
            <span>01</span>
            <h2>选择难度</h2>
          </div>
          <RadioGroup
            aria-label="训练难度"
            value={config.difficulty}
            onValueChange={(value) =>
              configure({ ...config, difficulty: value as Difficulty })
            }
            className={`difficulty-options ${GAME_DIFFICULTIES[config.game].length === 5 ? 'five-levels' : ''}`}
          >
            {GAME_DIFFICULTIES[config.game].map((difficulty, i) => (
              <label
                key={difficulty}
                htmlFor={`difficulty-${difficulty}`}
                className={`difficulty-card ${config.difficulty === difficulty ? 'chosen' : ''}`}
              >
                <RadioGroupItem
                  id={`difficulty-${difficulty}`}
                  value={difficulty}
                  className="difficulty-radio"
                />
                <span className="difficulty-bars" aria-hidden="true">
                  {GAME_DIFFICULTIES[config.game].map((_, n) => (
                    <i
                      key={n}
                      className={n <= i ? 'filled' : ''}
                      style={{ height: 7 + n * 5 }}
                    />
                  ))}
                </span>
                <strong>{DIFFICULTY_NAMES[difficulty]}</strong>
                <small>
                  {
                    [
                      '轻松入门',
                      '找到节奏',
                      '加深挑战',
                      '进阶挑战',
                      '高强度挑战',
                    ][i]
                  }
                </small>
              </label>
            ))}
          </RadioGroup>
          {config.game === 'sequence' && (
            <div className="mode-setting">
              <div className="section-label">
                <span>02</span>
                <h2>记忆内容</h2>
              </div>
              <RadioGroup
                value={config.variant}
                aria-label="记忆内容"
                className="mode-options"
                onValueChange={(value) =>
                  configure({ ...config, variant: value as MemoryVariant })
                }
              >
                {(
                  [
                    {
                      value: 'spatial',
                      label: '空间方块',
                      detail: '九宫格 · 点击复现',
                    },
                    {
                      value: 'digits',
                      label: '数字序列',
                      detail: '逐个显示 · 数字输入',
                    },
                  ] as const
                ).map((mode) => (
                  <label
                    key={mode.value}
                    htmlFor={`memory-${mode.value}`}
                    className={`mode-card ${config.variant === mode.value ? 'chosen' : ''}`}
                  >
                    <RadioGroupItem
                      id={`memory-${mode.value}`}
                      value={mode.value}
                    />
                    <div>
                      <strong>{mode.label}</strong>
                      <small>{mode.detail}</small>
                    </div>
                  </label>
                ))}
              </RadioGroup>
            </div>
          )}
          <div className="selected-parameters">
            <span>本次训练</span>
            <strong>{settingDescription(config)}</strong>
            <small>
              {config.game === 'tracking'
                ? `移动 ${s.motion / 1000} 秒 · 每轮先观察 2 秒 · 共 5 轮`
                : config.game === 'stroop'
                  ? `60 秒 · ${Math.round(s.conflict * 100)}% 颜色与文字冲突`
                  : config.game === 'sequence'
                    ? '正序复现 · 展示间隔 0.2 秒 · 共 5 轮'
                    : '从 1 依次点击 · 完成后结算'}
            </small>
          </div>
          <Button
            className="primary-action start-button"
            onClick={start}
            disabled={!app.ready}
          >
            <Play size={18} fill="currentColor" /> 开始训练 <ArrowRight />
          </Button>
          <p className="start-note">开始前有 3 秒准备时间 · 随时可以暂停</p>
        </section>
        <aside className="settings-aside">
          <section className="rules-panel panel">
            <div className="setup-illustration">
              <Miniature game={config.game} />
            </div>
            <span className="category-tag">{game.tag}</span>
            <h2>怎么玩</h2>
            <p>{game.rule}</p>
            <div className="rule-divider" />
            <div className="small-info">
              <Clock3 />
              {game.duration}
            </div>
            <div className="small-info">
              <Keyboard />
              {config.game === 'stroop'
                ? `鼠标或数字键 1–${s.colors}`
                : config.game === 'sequence'
                  ? '点击或数字键 · Enter 提交'
                  : config.game === 'tracking'
                    ? '点击选择 · Tab 与空格也可操作'
                    : '点击数字 · Tab 与回车也可操作'}
            </div>
          </section>
          <section className="best-panel panel">
            <div>
              <Trophy size={18} />
              <h2>个人最佳</h2>
              <span>{DIFFICULTY_NAMES[config.difficulty]}</span>
            </div>
            <strong>{best ? primaryResult(best) : '等待你的第一项纪录'}</strong>
            <p>
              {best
                ? best.metrics.kind === 'schulte'
                  ? `${best.metrics.mistakes} 次失误 · 同难度比较`
                  : '当前玩法与难度下的最佳成绩'
                : '完成训练后，最佳成绩会出现在这里。'}
            </p>
          </section>
        </aside>
      </div>
    </>
  );
}
function clockLabel(ms: number) {
  const value = Math.floor(ms / 1000);
  return `${Math.floor(value / 60)
    .toString()
    .padStart(2, '0')}:${(value % 60).toString().padStart(2, '0')}`;
}
function runMetrics(run: Run) {
  const s = SETTINGS[run.config.difficulty];
  switch (run.config.game) {
    case 'schulte':
      return [
        { label: '下一个数字', value: String(run.nextNumber), accent: true },
        { label: '用时', value: seconds(run.elapsedMs) },
        { label: '失误', value: String(run.mistakes) },
      ];
    case 'stroop':
      return [
        {
          label: '剩余时间',
          value: clockLabel(60000 - run.elapsedMs),
          accent: true,
        },
        { label: '正确', value: String(run.correct) },
        {
          label: '准确率',
          value: percent(
            run.correct + run.mistakes
              ? run.correct / (run.correct + run.mistakes)
              : 0,
          ),
        },
      ];
    case 'sequence':
      return [
        { label: '当前轮次', value: `${run.round} / 5`, accent: true },
        { label: '序列长度', value: String(s[run.config.variant]) },
        { label: '完整复现', value: `${run.perfectRounds} 轮` },
      ];
    case 'tracking':
      return [
        { label: '当前轮次', value: `${run.round} / 5`, accent: true },
        { label: '追踪目标', value: `${s.targets} 个` },
        { label: '已找回', value: `${run.foundTargets} 个` },
      ];
  }
}
function phaseLabel(run: Run) {
  if (run.paused) return '已暂停';
  if (run.countdownMs > 0) return '准备中';
  return {
    active: '专注进行中',
    show: '观察序列',
    recall: '复现序列',
    highlight: '记住目标',
    motion: '跟随目标',
    select: '选择目标',
    review: '本轮结果',
    done: '已完成',
  }[run.phase];
}
function PlayPanel({
  run,
  dispatch,
  onExit,
  onRestart,
}: {
  run: Run;
  dispatch: (action: RunAction) => void;
  onExit: () => void;
  onRestart: () => void;
}) {
  const game = gameInfo(run.config.game),
    metrics = runMetrics(run),
    covered = run.paused || run.countdownMs > 0;
  return (
    <div className="play-layout">
      <div className="play-heading">
        <div>
          <Button variant="ghost" className="back-button" onClick={onExit}>
            <ArrowLeft /> 训练菜单
          </Button>
          <h1>
            {game.name}
            <span className="difficulty-badge">
              {DIFFICULTY_NAMES[run.config.difficulty]}
              {run.config.game === 'sequence'
                ? ` · ${run.config.variant === 'spatial' ? '空间' : '数字'}`
                : ''}
            </span>
          </h1>
        </div>
        <div className="play-controls">
          <Button
            variant="outline"
            className="control-button"
            onClick={() => dispatch({ type: run.paused ? 'resume' : 'pause' })}
          >
            {run.paused ? <Play /> : <Pause />}
            {run.paused ? '继续' : '暂停'}
          </Button>
          <Button
            variant="ghost"
            className="control-button"
            aria-label="重新开始"
            title="重新开始"
            onClick={onRestart}
          >
            <RotateCcw />
          </Button>
        </div>
      </div>
      <div className="game-metrics">
        {metrics.map((metric) => (
          <div key={metric.label}>
            <span>{metric.label}</span>
            <strong className={metric.accent ? 'metric-accent' : ''}>
              {metric.value}
            </strong>
          </div>
        ))}
      </div>
      <section className="play-surface">
        <div className="surface-topline">
          <span>
            <span className="status-dot" /> {phaseLabel(run)}
          </span>
          <span>
            {run.config.game === 'schulte'
              ? `${run.nextNumber - 1} / ${run.grid.length}`
              : run.config.game === 'stroop'
                ? 'COLOR / NOT THE WORD'
                : `${String(run.round).padStart(2, '0')} / 05`}
          </span>
        </div>
        <div className="board-container">
          {covered ? (
            <div className="pause-cover">
              {run.paused ? (
                <>
                  <span className="pause-icon">
                    <Pause size={28} />
                  </span>
                  <h2>休息一下</h2>
                  <p>计时和训练已暂停，准备好后继续。</p>
                  <Button
                    className="primary-action control-button"
                    onClick={() => dispatch({ type: 'resume' })}
                  >
                    <Play /> 继续训练
                  </Button>
                </>
              ) : (
                <>
                  <span className="eyebrow">
                    {run.elapsedMs ? '继续专注' : '准备开始'}
                  </span>
                  <strong
                    className="countdown-number"
                    key={Math.ceil(run.countdownMs / 1000)}
                  >
                    {Math.ceil(run.countdownMs / 1000)}
                  </strong>
                  <p>
                    {run.config.game === 'schulte'
                      ? '从数字 1 开始，按顺序寻找'
                      : run.config.game === 'stroop'
                        ? '选择文字显示的颜色'
                        : run.config.game === 'sequence'
                          ? '先观察，再按顺序复现'
                          : '先记住高亮的目标小球'}
                  </p>
                </>
              )}
            </div>
          ) : (
            <GameBoard run={run} dispatch={dispatch} />
          )}
        </div>
        {run.config.game === 'schulte' && (
          <Progress
            className="schulte-progress"
            value={((run.nextNumber - 1) / run.grid.length) * 100}
            aria-label="方格完成进度"
          />
        )}
        <output
          className={`game-feedback ${run.feedback?.kind === 'error' && !covered && run.elapsedMs < run.feedback.until ? 'text-error' : ''}`}
          aria-live="polite"
        >
          {covered
            ? '准备好了，再继续。'
            : run.phase === 'review'
              ? '确认结果后，按自己的节奏继续。'
              : run.feedback && run.elapsedMs < run.feedback.until
                ? run.feedback.message
                : run.config.game === 'schulte'
                  ? '保持准确，找到下一个数字。'
                  : '专注于当前这一刻。'}
        </output>
      </section>
      <p className="play-bottom-note">
        <Pause size={13} /> 切换标签页会自动暂停 · 暂停时间不计入成绩
      </p>
    </div>
  );
}
function Results({
  app,
  onReplay,
  onSettings,
  onMenu,
}: {
  app: AppState;
  onReplay: () => void;
  onSettings: () => void;
  onMenu: () => void;
}) {
  const result = app.result!,
    game = gameInfo(result.config.game),
    first =
      app.data.history.filter(
        (r) => configKey(r.config) === configKey(result.config),
      ).length === 1;
  return (
    <div className="results-layout">
      <div className="result-emblem">
        <Check size={35} />
      </div>
      <div className="eyebrow">SESSION COMPLETE</div>
      <h1>一次专注，已完成。</h1>
      <p className="result-subtitle">
        {game.name} · {DIFFICULTY_NAMES[result.config.difficulty]}
        {result.config.game === 'sequence'
          ? ` · ${result.config.variant === 'spatial' ? '空间方块' : '数字序列'}`
          : ''}
      </p>
      {app.newBest && (
        <div className="new-best">
          <Trophy size={15} /> {first ? '第一项个人纪录' : '刷新个人最佳'}
        </div>
      )}
      <section className="results-panel panel">
        <div className="result-stats">
          {resultStats(result).map((stat) => (
            <div key={stat.label}>
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
            </div>
          ))}
        </div>
        <div className="result-save-note">
          <Check size={14} />
          {app.warning ? '成绩已保留在当前页面' : '本次成绩已保存在当前浏览器'}
        </div>
      </section>
      <div className="result-actions">
        <Button className="primary-action control-button" onClick={onReplay}>
          <RotateCcw /> 再来一次
        </Button>
        <Button
          variant="outline"
          className="control-button"
          onClick={onSettings}
        >
          调整难度
        </Button>
      </div>
      <Button variant="ghost" className="return-menu" onClick={onMenu}>
        <ArrowLeft /> 返回菜单
      </Button>
    </div>
  );
}
function HistoryPanel({
  data,
  onMenu,
}: {
  data: SavedData;
  onMenu: () => void;
}) {
  return (
    <>
      <Button variant="ghost" className="back-button" onClick={onMenu}>
        <ArrowLeft /> 返回训练菜单
      </Button>
      <section className="lobby-heading">
        <div>
          <div className="eyebrow">YOUR TRAINING JOURNAL</div>
          <h1>
            训练记录<span className="mint-dot">.</span>
          </h1>
          <p>保留最近 200 次训练，个人最佳会独立保存。</p>
        </div>
        <span className="history-count">{data.history.length} 条记录</span>
      </section>
      <Summary data={data} />
      {!data.history.length ? (
        <div className="empty-history panel">
          <History size={34} />
          <h2>这里还很安静</h2>
          <p>完成一次训练，你的第一条记录就会出现在这里。</p>
          <Button className="primary-action control-button" onClick={onMenu}>
            选择一项训练 <ArrowRight />
          </Button>
        </div>
      ) : (
        <section className="history-panel panel">
          <Table className="history-table">
            <TableHeader>
              <TableRow>
                <TableHead>训练 / 日期</TableHead>
                <TableHead>难度</TableHead>
                <TableHead>成绩</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.history.map((result) => (
                <HistoryRow
                  key={result.id}
                  result={result}
                  best={data.best[configKey(result.config)]?.id === result.id}
                />
              ))}
            </TableBody>
          </Table>
        </section>
      )}
    </>
  );
}
function HistoryRow({
  result,
  best,
}: {
  result: TrainingResult;
  best: boolean;
}) {
  return (
    <TableRow>
      <TableCell>
        <strong>
          {gameInfo(result.config.game).name}
          {result.config.game === 'sequence' && (
            <span className="history-variant">
              {result.config.variant === 'spatial' ? '空间' : '数字'}
            </span>
          )}
        </strong>
        <time dateTime={result.completedAt}>
          {new Date(result.completedAt).toLocaleString('zh-CN', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </time>
      </TableCell>
      <TableCell>
        <span className="history-difficulty">
          {DIFFICULTY_NAMES[result.config.difficulty]}
        </span>
      </TableCell>
      <TableCell>
        <div className="history-primary">
          {primaryResult(result)}
          {best && <Trophy size={14} aria-label="个人最佳" />}
        </div>
        <div className="history-detail">
          {resultStats(result)
            .filter((_, i) => i > 0)
            .map((stat) => `${stat.label} ${stat.value}`)
            .join(' · ')}
        </div>
      </TableCell>
    </TableRow>
  );
}
