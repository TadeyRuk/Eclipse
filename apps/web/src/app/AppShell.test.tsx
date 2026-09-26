import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { App } from './App';
import { createFakeRuntime } from '../test/createFakeRuntime';

describe('AppShell', () => {
  it('renders mode tag and announces wallet connection state changes', async () => {
    const runtime = createFakeRuntime({ connected: false });
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/employer']}>
        <App runtime={runtime} />
      </MemoryRouter>,
    );

    expect(screen.getByText('Demo mode')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Connect Lace' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Lace connected');
  });
});
