import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import FocusRoom from '../components/training/focus-room';
import { STORAGE_KEY } from '../lib/training/storage';
const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });
beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers({
    toFake: [
      'setTimeout',
      'clearTimeout',
      'setInterval',
      'clearInterval',
      'Date',
      'performance',
    ],
  });
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
    setTimeout(() => callback(performance.now()), 16),
  );
  vi.stubGlobal('cancelAnimationFrame', (id: ReturnType<typeof setTimeout>) =>
    clearTimeout(id),
  );
});
describe('visible training flow', () => {
  it.each([
    { label: /03\s*工作记忆/, parameters: '10 项序列 · 每项 0.25 秒' },
    { label: /04\s*持续注意/, parameters: '16 个小球 · 追踪 7 个目标' },
  ])(
    'offers extreme difficulty for $label and keeps game changes valid',
    ({ label, parameters }) => {
      render(<FocusRoom />);
      fireEvent.click(screen.getByRole('button', { name: label }));
      fireEvent.click(screen.getByRole('radio', { name: /极限/ }));
      expect(screen.getByText(parameters)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: '返回训练菜单' }));
      fireEvent.click(screen.getByRole('button', { name: /01\s*视觉搜索/ }));
      expect(
        screen.queryByRole('radio', { name: /极限/ }),
      ).not.toBeInTheDocument();
      expect(screen.getByRole('radio', { name: /专家/ })).toBeChecked();
      fireEvent.click(screen.getByRole('button', { name: '开始训练' }));
      advance(3200);
      expect(screen.getByRole('button', { name: '数字 36' })).toBeEnabled();
    },
  );
  it('selects difficulty, finishes a Schulte session once, persists it and replays', () => {
    const { unmount } = render(<FocusRoom />);
    fireEvent.click(screen.getByRole('button', { name: /01\s*视觉搜索/ }));
    fireEvent.click(screen.getByRole('radio', { name: /简单/ }));
    fireEvent.click(screen.getByRole('button', { name: '开始训练' }));
    expect(
      screen.queryByRole('button', { name: '数字 1' }),
    ).not.toBeInTheDocument();
    advance(3200);
    for (let value = 1; value <= 9; value++)
      fireEvent.click(screen.getByRole('button', { name: `数字 ${value}` }));
    expect(
      screen.getByRole('heading', { name: '一次专注，已完成。' }),
    ).toBeInTheDocument();
    advance(5000);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).history).toHaveLength(
      1,
    );
    fireEvent.click(screen.getByRole('button', { name: '再来一次' }));
    advance(3200);
    expect(screen.getByRole('button', { name: '数字 1' })).toBeEnabled();
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('hides content during pause and confirms leaving without recording an incomplete game', () => {
    render(<FocusRoom />);
    fireEvent.click(screen.getByRole('button', { name: /01\s*视觉搜索/ }));
    fireEvent.click(screen.getByRole('button', { name: '开始训练' }));
    advance(3200);
    fireEvent.click(screen.getByRole('button', { name: '暂停' }));
    expect(
      screen.queryByRole('button', { name: '数字 1' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: '休息一下' }),
    ).toBeInTheDocument();
    advance(30000);
    fireEvent.click(screen.getByRole('button', { name: '继续训练' }));
    advance(3200);
    expect(screen.getByRole('button', { name: '数字 1' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '训练菜单' }));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '放弃并离开' }));
    expect(
      screen.getByRole('heading', { name: /选择训练/ }),
    ).toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
  it('keeps sound preference, and auto pauses when focus is lost', () => {
    const first = render(<FocusRoom />);
    fireEvent.click(screen.getByRole('button', { name: '关闭音效' }));
    first.unmount();
    render(<FocusRoom />);
    expect(
      screen.getByRole('button', { name: '开启音效' }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /02\s*干扰抑制/ }));
    fireEvent.click(screen.getByRole('button', { name: '开始训练' }));
    advance(3200);
    fireEvent(window, new Event('blur'));
    expect(
      screen.getByRole('heading', { name: '休息一下' }),
    ).toBeInTheDocument();
  });
  it('accepts digital memory input only after exposure and supports undo', () => {
    render(<FocusRoom />);
    fireEvent.click(screen.getByRole('button', { name: /03\s*工作记忆/ }));
    fireEvent.click(screen.getByRole('radio', { name: /简单/ }));
    fireEvent.click(screen.getByRole('radio', { name: /数字序列/ }));
    fireEvent.click(screen.getByRole('button', { name: '开始训练' }));
    advance(3200);
    fireEvent.keyDown(window, { key: '1' });
    expect(
      screen.queryByRole('button', { name: '提交答案' }),
    ).not.toBeInTheDocument();
    advance(4000);
    for (const key of ['1', '2', '3', '4'])
      fireEvent.keyDown(document.body, { key });
    expect(screen.getByRole('button', { name: '提交答案' })).toBeEnabled();
    fireEvent.keyDown(document.body, { key: 'Backspace' });
    expect(screen.getByRole('button', { name: '提交答案' })).toBeDisabled();
    fireEvent.keyDown(document.body, { key: '5' });
    fireEvent.click(screen.getByRole('button', { name: '提交答案' }));
    expect(screen.getByText('正确序列')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '下一轮' })).toBeInTheDocument();
  });
});
