'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import {
  DEFAULT_CONFIG,
  GAME_DIFFICULTIES,
  configKey,
  type TrainingConfig,
} from '@/lib/training/config';
import {
  createRun,
  publicRunState,
  reduceRun,
  type Run,
  type RunAction,
} from '@/lib/training/engine';
import {
  appendResult,
  emptyData,
  isBetter,
  readData,
  resultFromRun,
  writeData,
  type SavedData,
  type TrainingResult,
} from '@/lib/training/storage';
import { playSound, prepareAudio } from '@/lib/training/audio';
import {
  registerTrainingTools,
  type ModelContext,
} from '@/lib/training/webmcp';

type Screen = 'menu' | 'settings' | 'play' | 'result' | 'history';
type Destination = 'menu' | 'history' | 'restart';
export interface AppState {
  screen: Screen;
  config: TrainingConfig;
  run: Run | null;
  result: TrainingResult | null;
  data: SavedData;
  warning: string | null;
  ready: boolean;
  newBest: boolean;
  pending: { destination: Destination; wasPaused: boolean } | null;
}
export function useTraining() {
  const [app, setApp] = useState<AppState>(() => ({
    screen: 'menu',
    config: DEFAULT_CONFIG,
    run: null,
    result: null,
    data: emptyData(),
    warning: null,
    ready: false,
    newBest: false,
    pending: null,
  }));
  const ref = useRef(app);
  const completed = useRef(new Set<string>());
  const commit = useCallback((state: AppState) => {
    ref.current = state;
    setApp(state);
  }, []);
  const save = useCallback((data: SavedData) => {
    try {
      return writeData(window.localStorage, data);
    } catch {
      return '本次记录暂时无法保存，当前页面内仍可查看成绩。';
    }
  }, []);
  useEffect(() => {
    try {
      const loaded = readData(window.localStorage);
      commit({
        ...ref.current,
        data: loaded.data,
        warning: loaded.warning,
        ready: true,
      });
    } catch {
      commit({
        ...ref.current,
        ready: true,
        warning: '本地存储不可用，成绩将保留到本次页面关闭。',
      });
    }
  }, [commit]);
  const dispatch = useCallback(
    (action: RunAction) => {
      const current = ref.current;
      if (
        current.screen !== 'play' ||
        !current.run ||
        (current.pending && action.type !== 'pause')
      )
        return;
      const run = reduceRun(current.run, action);
      if (run === current.run) return;
      if (current.data.sound) {
        if (run.phase === 'done') playSound('complete');
        else if (run.feedback !== current.run.feedback && run.feedback)
          playSound(run.feedback.kind);
        else if (action.type === 'answer' || action.type === 'undo')
          playSound('click');
      }
      if (run.phase === 'done' && !completed.current.has(run.id)) {
        completed.current.add(run.id);
        const result = resultFromRun(run),
          newBest = isBetter(result, current.data.best[configKey(run.config)]);
        const data = appendResult(current.data, result);
        commit({
          ...current,
          run,
          result,
          newBest,
          data,
          warning: save(data),
          screen: 'result',
        });
      } else commit({ ...current, run });
    },
    [commit, save],
  );
  const freshRun = useCallback((config: TrainingConfig) => {
    const seed = crypto.getRandomValues(new Uint32Array(1))[0];
    return createRun(config, crypto.randomUUID(), seed);
  }, []);
  const start = useCallback(() => {
    const current = ref.current;
    if (!current.ready || current.screen === 'play') return false;
    if (current.data.sound) prepareAudio();
    commit({
      ...current,
      screen: 'play',
      result: null,
      newBest: false,
      pending: null,
      run: freshRun(current.config),
    });
    return true;
  }, [commit, freshRun]);
  const configure = useCallback(
    (config: TrainingConfig) => {
      const current = ref.current;
      if (current.screen === 'play') return false;
      const difficulties = GAME_DIFFICULTIES[config.game];
      const difficulty = difficulties.includes(config.difficulty)
        ? config.difficulty
        : difficulties[difficulties.length - 1];
      commit({
        ...current,
        config: { ...config, difficulty },
        screen: 'settings',
        run: null,
      });
      return true;
    },
    [commit],
  );
  const navigate = useCallback(
    (destination: Destination) => {
      const current = ref.current;
      if (current.screen === 'play' && current.run) {
        commit({
          ...current,
          pending: { destination, wasPaused: current.run.paused },
          run: reduceRun(current.run, { type: 'pause' }),
        });
      } else if (destination === 'restart') start();
      else
        commit({ ...current, screen: destination, run: null, pending: null });
    },
    [commit, start],
  );
  const cancelExit = useCallback(() => {
    const current = ref.current;
    if (!current.pending || !current.run) return;
    commit({
      ...current,
      pending: null,
      run: current.pending.wasPaused
        ? current.run
        : reduceRun(current.run, { type: 'resume' }),
    });
  }, [commit]);
  const confirmExit = useCallback(() => {
    const current = ref.current;
    if (!current.pending) return;
    const destination = current.pending.destination;
    commit({
      ...current,
      pending: null,
      screen: destination === 'restart' ? 'play' : destination,
      run: destination === 'restart' ? freshRun(current.config) : null,
    });
  }, [commit, freshRun]);
  const toggleSound = useCallback(() => {
    const current = ref.current,
      data = { ...current.data, sound: !current.data.sound };
    if (data.sound) {
      prepareAudio();
      playSound('click');
    }
    commit({ ...current, data, warning: save(data) });
  }, [commit, save]);
  useEffect(() => {
    if (app.screen !== 'play') return;
    let handle = 0,
      previous = performance.now();
    const frame = (now: number) => {
      const ms = now - previous;
      previous = now;
      dispatch({ type: 'tick', ms });
      handle = requestAnimationFrame(frame);
    };
    handle = requestAnimationFrame(frame);
    const pause = () => dispatch({ type: 'pause' });
    const visibility = () => {
      if (document.hidden) pause();
    };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    const keyboard = (event: KeyboardEvent) => {
      const current = ref.current,
        run = current.run;
      if (
        !run ||
        current.pending ||
        event.repeat ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      )
        return;
      const element = event.target as HTMLElement;
      if (
        element instanceof HTMLElement &&
        element.matches('input,textarea,select,[contenteditable=true]')
      )
        return;
      if (event.key === 'Escape') {
        event.preventDefault();
        dispatch({ type: run.paused ? 'resume' : 'pause' });
        return;
      }
      if (run.paused || run.countdownMs > 0) return;
      if (run.config.game === 'stroop' && /^[1-6]$/.test(event.key)) {
        event.preventDefault();
        dispatch({ type: 'answer', value: Number(event.key) - 1 });
      }
      if (run.config.game === 'sequence' && run.phase === 'recall') {
        if (
          /^[0-9]$/.test(event.key) &&
          (run.config.variant === 'digits' || event.key !== '0')
        ) {
          event.preventDefault();
          dispatch({
            type: 'answer',
            value:
              Number(event.key) - (run.config.variant === 'spatial' ? 1 : 0),
          });
        }
        if (event.key === 'Backspace') {
          event.preventDefault();
          dispatch({ type: 'undo' });
        }
        if (event.key === 'Enter') {
          event.preventDefault();
          dispatch({ type: 'submit' });
        }
      }
    };
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('blur', pause);
    window.addEventListener('beforeunload', beforeUnload);
    window.addEventListener('keydown', keyboard);
    return () => {
      cancelAnimationFrame(handle);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('blur', pause);
      window.removeEventListener('beforeunload', beforeUnload);
      window.removeEventListener('keydown', keyboard);
    };
  }, [app.screen, app.run?.id, dispatch]);
  useEffect(() => {
    const read = () => ({
      screen: ref.current.screen,
      config: ref.current.config,
      run: publicRunState(ref.current.run),
      result: ref.current.screen === 'result' ? ref.current.result : null,
    });
    return registerTrainingTools(
      (document as Document & { modelContext?: ModelContext }).modelContext,
      {
        read,
        configure(config) {
          if (ref.current.screen === 'play')
            throw new Error('请先结束当前训练');
          flushSync(() => configure(config));
          return read();
        },
        start() {
          if (ref.current.screen !== 'settings' || !ref.current.ready)
            throw new Error('请先配置训练');
          flushSync(() => start());
          return read();
        },
      },
    );
  }, [configure, start]);
  return {
    app,
    dispatch,
    configure,
    start,
    navigate,
    cancelExit,
    confirmExit,
    toggleSound,
  };
}
