export interface WatchdogHandleInfo {
  id: number;
  label?: string;
  createdAt: number;
  timeoutId: ReturnType<typeof setTimeout>;
}

export interface WatchdogResult {
  proxiedRemotion: any;
  getActiveHandles: () => WatchdogHandleInfo[];
  clearAllTimeouts: () => void;
}

interface RemotionLike {
  delayRender?: (label?: string) => number;
  continueRender?: (handle: number) => void;
}

/**
 * Оборачивает Remotion-модуль, отслеживая `delayRender`/`continueRender`.
 * Если ресурс не вызвал `continueRender` за `timeoutMs`, блокировка кадра
 * снимается принудительно (плюс warning), что исключает вечное зависание.
 */
export function createRemotionWatchdog(
  remotionModule: RemotionLike | undefined | null,
  timeoutMs = 4000,
  onTimeout?: (label?: string, handleId?: number) => void,
): WatchdogResult {
  if (!remotionModule || typeof remotionModule.delayRender !== 'function') {
    return {
      proxiedRemotion: remotionModule,
      getActiveHandles: () => [],
      clearAllTimeouts: () => {},
    };
  }

  const activeHandles = new Map<number, WatchdogHandleInfo>();
  const originalDelayRender = remotionModule.delayRender.bind(remotionModule);
  const originalContinueRender = remotionModule.continueRender?.bind(remotionModule);

  const continueRender = (handleId: number): void => {
    const info = activeHandles.get(handleId);
    if (info) {
      clearTimeout(info.timeoutId);
      activeHandles.delete(handleId);
    }
    originalContinueRender?.(handleId);
  };

  const delayRender = (label?: string): number => {
    const handleId = originalDelayRender(label);

    const timeoutId = setTimeout(() => {
      if (!activeHandles.has(handleId)) return;
      // eslint-disable-next-line no-console
      console.warn(
        `[Remotion Watchdog]: delayRender("${label ?? 'anonymous'}") [id: ${handleId}] ` +
          `превысил лимит ${timeoutMs}ms. Блокировка кадра снята принудительно.`,
      );
      onTimeout?.(label, handleId);
      continueRender(handleId);
    }, timeoutMs);

    activeHandles.set(handleId, { id: handleId, label, createdAt: Date.now(), timeoutId });
    return handleId;
  };

  const clearAllTimeouts = () => {
    for (const info of activeHandles.values()) clearTimeout(info.timeoutId);
    activeHandles.clear();
  };

  const proxiedRemotion = new Proxy(remotionModule as Record<string, unknown>, {
    get(target, prop) {
      if (prop === 'delayRender') return delayRender;
      if (prop === 'continueRender') return continueRender;
      return Reflect.get(target, prop, target);
    },
  });

  return {
    proxiedRemotion,
    getActiveHandles: () => [...activeHandles.values()],
    clearAllTimeouts,
  };
}
