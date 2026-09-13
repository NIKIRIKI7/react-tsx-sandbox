import { describe, it, expect, vi } from 'vitest';
import { createRemotionWatchdog } from './watchdog';

describe('sandbox/watchdog', () => {
  it('принудительно снимает зависший delayRender по таймауту', async () => {
    const onTimeout = vi.fn();
    const fakeRemotion = { delayRender: vi.fn(() => 101), continueRender: vi.fn() };

    const watchdog = createRemotionWatchdog(fakeRemotion, 30, onTimeout);
    const handle = watchdog.proxiedRemotion.delayRender('AssetLoadingStuck');

    expect(handle).toBe(101);
    expect(watchdog.getActiveHandles()).toHaveLength(1);

    await new Promise((resolve) => setTimeout(resolve, 80));

    expect(fakeRemotion.continueRender).toHaveBeenCalledWith(101);
    expect(onTimeout).toHaveBeenCalledWith('AssetLoadingStuck', 101);
    expect(watchdog.getActiveHandles()).toHaveLength(0);
  });

  it('не срабатывает, если continueRender вызван вовремя', async () => {
    const onTimeout = vi.fn();
    const fakeRemotion = { delayRender: () => 5, continueRender: vi.fn() };

    const watchdog = createRemotionWatchdog(fakeRemotion, 30, onTimeout);
    const handle = watchdog.proxiedRemotion.delayRender('fast');
    watchdog.proxiedRemotion.continueRender(handle);

    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(onTimeout).not.toHaveBeenCalled();
    expect(fakeRemotion.continueRender).toHaveBeenCalledWith(5);
    expect(watchdog.getActiveHandles()).toHaveLength(0);
  });

  it('возвращает модуль как есть, если delayRender отсутствует', () => {
    const module = { foo: 1 };
    const watchdog = createRemotionWatchdog(module as never);

    expect(watchdog.proxiedRemotion).toBe(module);
    expect(watchdog.getActiveHandles()).toEqual([]);
  });
});
