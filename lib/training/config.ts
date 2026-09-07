export const GAME_IDS = ['schulte', 'stroop', 'sequence', 'tracking'] as const;
export const DIFFICULTIES = [
  'easy',
  'normal',
  'hard',
  'expert',
  'extreme',
] as const;
export type GameId = (typeof GAME_IDS)[number];
export type Difficulty = (typeof DIFFICULTIES)[number];
const STANDARD_DIFFICULTIES: readonly Difficulty[] = [
  'easy',
  'normal',
  'hard',
  'expert',
];
export const GAME_DIFFICULTIES: Record<GameId, readonly Difficulty[]> = {
  schulte: STANDARD_DIFFICULTIES,
  stroop: STANDARD_DIFFICULTIES,
  sequence: DIFFICULTIES,
  tracking: DIFFICULTIES,
};
export type MemoryVariant = 'spatial' | 'digits';
export interface TrainingConfig {
  game: GameId;
  difficulty: Difficulty;
  variant: MemoryVariant;
}
export const DEFAULT_CONFIG: TrainingConfig = {
  game: 'schulte',
  difficulty: 'normal',
  variant: 'spatial',
};
export const DIFFICULTY_NAMES: Record<Difficulty, string> = {
  easy: '简单',
  normal: '普通',
  hard: '困难',
  expert: '专家',
  extreme: '极限',
};
export const GAMES = [
  {
    id: 'schulte',
    name: '舒尔特方格',
    tag: '视觉搜索',
    description: '在打乱的数字中，按顺序找到下一个。',
    english: 'SCHULTE GRID',
    rule: '从 1 开始，按升序点击全部数字。尽量保持准确，再尝试缩短用时。',
    duration: '完成一张方格',
  },
  {
    id: 'stroop',
    name: '色卡冲突',
    tag: '干扰抑制',
    description: '忽略文字的含义，只回应眼前的颜色。',
    english: 'COLOR CONFLICT',
    rule: '选择文字实际显示的颜色，忽略文字含义。点击选项或按对应数字键；答错和超时后自动进入下一题。',
    duration: '60 秒限时',
  },
  {
    id: 'sequence',
    name: '序列记忆',
    tag: '工作记忆',
    description: '记住短暂出现的序列，再按顺序复现。',
    english: 'SEQUENCE MEMORY',
    rule: '观察依次出现的方块或数字，展示结束后按原顺序复现。输入完成后提交，可撤销最后一项。',
    duration: '每局 5 轮',
  },
  {
    id: 'tracking',
    name: '动态追踪',
    tag: '持续注意',
    description: '目光跟随移动的小球，找回最初的目标。',
    english: 'MULTIPLE OBJECT TRACKING',
    rule: '记住最初高亮的小球。它们变为相同颜色并移动后，选出原来的目标；选满规定数量即可提交。',
    duration: '每局 5 轮',
  },
] as const;
export const SETTINGS = {
  easy: {
    size: 3,
    colors: 4,
    conflict: 0.5,
    deadline: 4000,
    spatial: 3,
    digits: 4,
    exposure: 800,
    balls: 6,
    targets: 2,
    motion: 8000,
    speed: 0.12,
  },
  normal: {
    size: 4,
    colors: 4,
    conflict: 0.7,
    deadline: 3000,
    spatial: 4,
    digits: 6,
    exposure: 650,
    balls: 8,
    targets: 3,
    motion: 10000,
    speed: 0.18,
  },
  hard: {
    size: 5,
    colors: 4,
    conflict: 0.85,
    deadline: 2000,
    spatial: 6,
    digits: 8,
    exposure: 500,
    balls: 10,
    targets: 4,
    motion: 12000,
    speed: 0.24,
  },
  expert: {
    size: 6,
    colors: 6,
    conflict: 1,
    deadline: 1200,
    spatial: 8,
    digits: 10,
    exposure: 350,
    balls: 12,
    targets: 5,
    motion: 15000,
    speed: 0.3,
  },
  extreme: {
    size: 6,
    colors: 6,
    conflict: 1,
    deadline: 1200,
    spatial: 10,
    digits: 12,
    exposure: 250,
    balls: 16,
    targets: 7,
    motion: 20000,
    speed: 0.38,
  },
} as const;
export const COLORS = [
  { name: '红色', hex: '#f1747d' },
  { name: '黄色', hex: '#f1d56f' },
  { name: '蓝色', hex: '#78aaff' },
  { name: '绿色', hex: '#86d5a8' },
  { name: '紫色', hex: '#c498ef' },
  { name: '橙色', hex: '#f4a263' },
] as const;
export function gameInfo(game: GameId) {
  return GAMES.find((item) => item.id === game)!;
}
export function configKey(config: TrainingConfig) {
  return `${config.game}:${config.difficulty}:${config.game === 'sequence' ? config.variant : '-'}`;
}
export function isConfig(value: unknown): value is TrainingConfig {
  if (!value || typeof value !== 'object') return false;
  const c = value as TrainingConfig;
  return (
    GAME_IDS.includes(c.game) &&
    GAME_DIFFICULTIES[c.game].includes(c.difficulty) &&
    ['spatial', 'digits'].includes(c.variant)
  );
}
export function settingDescription(config: TrainingConfig) {
  const s = SETTINGS[config.difficulty];
  switch (config.game) {
    case 'schulte':
      return `${s.size} × ${s.size} 方格 · ${s.size ** 2} 个数字`;
    case 'stroop':
      return `${s.colors} 种颜色 · 每题 ${s.deadline / 1000} 秒`;
    case 'sequence':
      return `${s[config.variant]} 项序列 · 每项 ${s.exposure / 1000} 秒`;
    case 'tracking':
      return `${s.balls} 个小球 · 追踪 ${s.targets} 个目标`;
  }
}
