import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import App from '../../src/options/App.svelte';
import { DEFAULTS } from '../../src/lib/settings';

describe('options App', () => {
  it('renders defaults', () => {
    render(App, { props: { initial: DEFAULTS } });
    expect((screen.getByLabelText(/debounce/i) as HTMLInputElement).value).toBe('1500');
    expect((screen.getByLabelText(/retention/i) as HTMLInputElement).value).toBe('7');
  });
  it('emits save with edited values', async () => {
    render(App, { props: { initial: DEFAULTS } });
    const d = screen.getByLabelText(/debounce/i) as HTMLInputElement;
    await fireEvent.input(d, { target: { value: '2500' } });
    let saved: any = null;
    window.addEventListener('fda-save', (e: any) => { saved = e.detail; });
    await fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(saved.debounceMs).toBe(2500);
  });
});
