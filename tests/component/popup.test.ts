import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import App from '../../src/popup/App.svelte';

describe('popup App', () => {
  it('shows empty state when no draft', async () => {
    render(App, { props: { draft: null } });
    expect(await screen.findByText(/no draft/i)).toBeInTheDocument();
  });
  it('lists fields and a Restore button when draft present', async () => {
    const draft = { origin: 'https://a.com', path: '/p', ts: Date.now(),
      fields: { s1: { sig: 's1', value: 'hello world', type: 'textarea' } } };
    render(App, { props: { draft } });
    expect(screen.getByRole('button', { name: /restore/i })).toBeInTheDocument();
    expect(screen.getByText(/hello world/)).toBeInTheDocument();
  });
});
