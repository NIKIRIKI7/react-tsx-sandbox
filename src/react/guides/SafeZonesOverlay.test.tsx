// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SafeZonesOverlay } from './SafeZonesOverlay';

describe('guides/SafeZonesOverlay', () => {
  it('рендерит TikTok-зону и правило третей', () => {
    render(<SafeZonesOverlay preset={['tiktok-9x16', 'rule-of-thirds']} />);

    const overlay = screen.getByTestId('safe-zones-overlay');

    expect(overlay).toBeTruthy();
    expect(overlay.querySelectorAll('rect').length).toBeGreaterThan(0);
    expect(overlay.querySelectorAll('line').length).toBeGreaterThan(0);
  });

  it('рендерит TV-safe зону', () => {
    render(<SafeZonesOverlay preset="tv-safe-16x9" />);
    expect(screen.getByTestId('safe-zones-overlay').querySelectorAll('rect').length).toBe(2);
  });
});
