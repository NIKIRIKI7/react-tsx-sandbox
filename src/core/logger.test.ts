import { describe, it, expect, vi, afterEach } from 'vitest';
import { configureLogger, logger } from './logger';

describe('core/logger', () => {
  afterEach(() => {
    configureLogger({ enabled: false });
    vi.restoreAllMocks();
  });

  it('по умолчанию не выводит ничего в консоль', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    logger.info('hello');
    expect(spy).not.toHaveBeenCalled();
  });

  it('пишет в консоль после configureLogger({enabled:true})', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    configureLogger({ enabled: true });
    logger.info('frame captured', 42);
    expect(spy).toHaveBeenCalledWith('[browser-tsx-sandbox:info]', 'frame captured', 42);
  });

  it('уважает level-порог', () => {
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    configureLogger({ enabled: true, level: 'warn' });
    logger.debug('hidden');
    logger.warn('visible');
    expect(debugSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
  });
});