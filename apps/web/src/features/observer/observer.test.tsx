import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../../app/App';
import { createFakeRuntime } from '../../test/createFakeRuntime';

describe('observer page', () => {
  it('renders public fields and never renders private amount inputs', async () => {
    render(
      <MemoryRouter initialEntries={['/observer']}>
        <App runtime={createFakeRuntime()} />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId('observer-status')).toBeInTheDocument());
    expect(screen.getByTestId('observer-claimed')).toBeInTheDocument();
    expect(screen.getByText(/Individual amounts are not available/i)).toBeInTheDocument();
    expect(screen.queryByTestId('amount-0')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Private amount/i)).not.toBeInTheDocument();
  });
});
