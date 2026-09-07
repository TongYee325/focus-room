import { describe, expect, it, vi } from 'vitest';
import {
  registerTrainingTools,
  trainingTools,
  type Tool,
} from '../lib/training/webmcp';
describe('WebMCP contract', () => {
  it('registers scoped tools, validates inputs, and cleans them up', () => {
    const tools: Tool[] = [],
      signals: AbortSignal[] = [];
    const controller = {
      configure: vi.fn(() => ({ screen: 'settings' })),
      start: vi.fn(() => ({ screen: 'play' })),
      read: vi.fn(() => ({ screen: 'menu' })),
    };
    const cleanup = registerTrainingTools(
      {
        registerTool(tool, options) {
          tools.push(tool);
          signals.push(options.signal);
        },
      },
      controller,
    );
    expect(tools.map((t) => t.name)).toEqual([
      'configure_training',
      'start_training',
      'read_training_state',
    ]);
    expect(tools[2].annotations.readOnlyHint).toBe(true);
    expect(
      tools[0].execute({
        game: 'sequence',
        difficulty: 'expert',
        variant: 'digits',
      }),
    ).toEqual({ screen: 'settings' });
    expect(() => tools[0].execute({ game: 'bogus' })).toThrow();
    for (const game of ['sequence', 'tracking']) {
      expect(
        tools[0].execute({ game, difficulty: 'extreme', variant: 'digits' }),
      ).toEqual({ screen: 'settings' });
    }
    for (const game of ['schulte', 'stroop']) {
      expect(() =>
        tools[0].execute({ game, difficulty: 'extreme', variant: 'spatial' }),
      ).toThrow();
    }
    expect(() => tools[1].execute({ secret: 1 })).toThrow();
    expect(tools[1].execute({})).toEqual({ screen: 'play' });
    expect(tools[2].execute({})).toEqual({ screen: 'menu' });
    cleanup();
    expect(signals.every((s) => s.aborted)).toBe(true);
    expect(() => registerTrainingTools(undefined, controller)()).not.toThrow();
    expect(trainingTools(controller)).toHaveLength(3);
  });
});
