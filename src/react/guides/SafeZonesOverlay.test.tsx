// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SafeZonesOverlay } from './SafeZonesOverlay';

describe('guides/SafeZonesOverlay', () => {
  it('помечает оверлей data-sandbox-overlay и рисует TikTok-зоны', () => {
    const { container } = render(<SafeZonesOverlay preset="tiktok-9x16" />);

    const overlay = screen.getByTestId('safe-zones-overlay');
    expect(overlay).toBeTruthy();
    expect(overlay.getAttribute('data-sandbox-overlay')).toBe('true');
    expect(screen.getByText('TIKTOK: HEADER & SEARCH')).toBeTruthy();
    expect(screen.getByText('TIKTOK: RIGHT ACTIONS')).toBeTruthy();
    expect(screen.getByText('TIKTOK: CAPTIONS & NAVIGATION')).toBeTruthy();
    expect(container.querySelectorAll('rect').length).toBe(3);
    expect(container.querySelectorAll('line').length).toBe(3);
  });

  it('поддерживает массив пресетов (reels + правило третей)', () => {
    const { container } = render(
      <SafeZonesOverlay preset={['reels-9x16', 'rule-of-thirds']} />,
    );
    expect(screen.getByText('REELS: TOP UI')).toBeTruthy();
    expect(container.querySelectorAll('line').length).toBeGreaterThanOrEqual(4);
  });

  it('рендерит TV-safe зону', () => {
    render(<SafeZonesOverlay preset="tv-safe-16x9" />);
    expect(screen.getByTestId('safe-zones-overlay').querySelectorAll('rect').length).toBe(2);
  });
});