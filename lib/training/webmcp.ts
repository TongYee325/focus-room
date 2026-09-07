import {
  DIFFICULTIES,
  GAME_DIFFICULTIES,
  GAME_IDS,
  isConfig,
  type TrainingConfig,
} from './config';
export interface Tool {
  name: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (input: unknown) => unknown;
}
export interface ModelContext {
  registerTool: (
    tool: Tool,
    options: { signal: AbortSignal },
  ) => void | Promise<void>;
}
export interface TrainingController {
  configure: (config: TrainingConfig) => unknown;
  start: () => unknown;
  read: () => unknown;
}
function requireEmpty(input: unknown) {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).length
  )
    throw new Error('参数必须是空对象');
}
export function trainingTools(controller: TrainingController): Tool[] {
  const annotations = { readOnlyHint: false, untrustedContentHint: false };
  return [
    {
      name: 'configure_training',
      description:
        '选择训练类型、难度和记忆模式，打开设置页；序列记忆和动态追踪支持极限档（extreme）。不会开始训练，进行中的训练须先由用户结束。',
      inputSchema: {
        type: 'object',
        properties: {
          game: { type: 'string', enum: GAME_IDS },
          difficulty: { type: 'string', enum: DIFFICULTIES },
          variant: { type: 'string', enum: ['spatial', 'digits'] },
        },
        required: ['game', 'difficulty', 'variant'],
        additionalProperties: false,
        oneOf: GAME_IDS.map((game) => ({
          properties: {
            game: { const: game },
            difficulty: { enum: GAME_DIFFICULTIES[game] },
          },
        })),
      },
      annotations,
      execute(input) {
        if (
          !isConfig(input) ||
          Object.keys(input).some(
            (k) => !['game', 'difficulty', 'variant'].includes(k),
          )
        )
          throw new Error('无效的训练设置');
        return controller.configure(input);
      },
    },
    {
      name: 'start_training',
      description:
        '按照设置页中已选择的参数开始新训练，进入三秒倒计时。不会覆盖进行中的训练。',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations,
      execute(input) {
        requireEmpty(input);
        return controller.start();
      },
    },
    {
      name: 'read_training_state',
      description:
        '读取页面、训练配置、进度及已完成的成绩；不提供进行中的记忆答案或目标身份。',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute(input) {
        requireEmpty(input);
        return controller.read();
      },
    },
  ];
}
export function registerTrainingTools(
  context: ModelContext | undefined,
  controller: TrainingController,
  report = (error: unknown) => console.warn('训练工具注册失败', error),
) {
  if (!context?.registerTool) return () => {};
  const lifecycle = new AbortController();
  for (const tool of trainingTools(controller)) {
    try {
      void Promise.resolve(
        context.registerTool(tool, { signal: lifecycle.signal }),
      ).catch(report);
    } catch (error) {
      report(error);
    }
  }
  return () => lifecycle.abort();
}
