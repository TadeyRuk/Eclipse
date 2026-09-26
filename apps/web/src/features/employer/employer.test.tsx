import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { err } from '@eclipse/sdk';
import { App } from '../../app/App';
import { createFakeRuntime } from '../../test/createFakeRuntime';
import type { EclipseRuntime } from '../../shared/runtime/EclipseRuntime';

function renderApp(runtime: EclipseRuntime, path = '/employer') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App runtime={runtime} />
    </MemoryRouter>,
  );
}

/** Drive recipient → deposit so the amounts step is on screen. */
async function createAndFund(user: UserEvent) {
  await user.type(screen.getByTestId('recipient-0'), 'bb'.repeat(32));
  await user.click(screen.getByTestId('create-payroll'));
  await waitFor(() => expect(screen.getByTestId('deposit-input')).toBeInTheDocument());
  await user.clear(screen.getByTestId('deposit-input'));
  await user.type(screen.getByTestId('deposit-input'), '100');
  await user.click(screen.getByTestId('fund-payroll'));
  await waitFor(() => expect(screen.getByTestId('amount-0')).toBeInTheDocument());
}

describe('employer lifecycle', () => {
  it('clears amount inputs after successful distribute', async () => {
    const runtime = createFakeRuntime();
    const user = userEvent.setup();
    renderApp(runtime, '/employer');

    await createAndFund(user);
    await user.type(screen.getByTestId('amount-0'), '100');
    await user.click(screen.getByTestId('distribute'));

    await waitFor(() => expect(screen.getByTestId('distribute-success')).toBeInTheDocument());
    expect(screen.queryByTestId('amount-0')).not.toBeInTheDocument();
    expect(screen.getByTestId('public-payroll')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Private amount/i)).not.toBeInTheDocument();
  });

  it('retains amount input and shows a corrective error when distribute is rejected', async () => {
    const runtime = createFakeRuntime();
    const user = userEvent.setup();
    renderApp(runtime, '/employer');

    await createAndFund(user);

    runtime.sdk.eclipse.distribute = async () =>
      err('CircuitRejected', 'sum(amounts) must equal depositTotal');

    await user.type(screen.getByTestId('amount-0'), '100');
    await user.click(screen.getByTestId('distribute'));
    await screen.findByRole('alert');
    expect(screen.getByTestId('amount-0')).toHaveValue('100');
  });
});

describe('mode indicator', () => {
  it('labels demo mode even when debug is off', async () => {
    const runtime = createFakeRuntime();
    expect(runtime.debug).toBe(false);
    renderApp(runtime, '/employer');
    await waitFor(() => expect(screen.getByTestId('mode-indicator')).toBeInTheDocument());
    expect(screen.getByTestId('mode-indicator')).toHaveTextContent(/demo/i);
  });
});
