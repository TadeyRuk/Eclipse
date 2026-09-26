import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../../app/App';
import { createFakeRuntime, distributedPayrollFixture } from '../../test/createFakeRuntime';
import type { EclipseRuntime } from '../../shared/runtime/EclipseRuntime';

function renderApp(runtime: EclipseRuntime, path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App runtime={runtime} />
    </MemoryRouter>,
  );
}

/** Drive the employer flow so a distributed payroll and local receipt exist. */
async function distributeAs(user: UserEvent) {
  await user.type(screen.getByTestId('recipient-0'), 'bb'.repeat(32));
  await user.click(screen.getByTestId('create-payroll'));
  await waitFor(() => expect(screen.getByTestId('deposit-input')).toBeInTheDocument());
  await user.clear(screen.getByTestId('deposit-input'));
  await user.type(screen.getByTestId('deposit-input'), '100');
  await user.click(screen.getByTestId('fund-payroll'));
  await waitFor(() => expect(screen.getByTestId('amount-0')).toBeInTheDocument());
  await user.type(screen.getByTestId('amount-0'), '100');
  await user.click(screen.getByTestId('distribute'));
  await waitFor(() => expect(screen.getByTestId('distribute-success')).toBeInTheDocument());
}

describe('employee claim', () => {
  it('renders a claimable slot without its amount, and claim refreshes claimed state', async () => {
    const runtime = createFakeRuntime();
    const user = userEvent.setup();
    const { unmount } = renderApp(runtime, '/employer');
    await distributeAs(user);
    unmount();

    renderApp(runtime, '/employee');
    await waitFor(() => expect(screen.getByTestId('employee-receipts')).toBeInTheDocument());

    // The receipt exists and is claimable, but 100 must not appear anywhere —
    // this page proves entitlement without disclosing the figure.
    const before = screen.getByTestId('employee-page').textContent ?? '';
    expect(before).not.toContain('100');

    await user.click(screen.getByTestId('claim-0'));
    await waitFor(() => expect(screen.getByTestId('claimed-0')).toBeInTheDocument());

    const after = screen.getByTestId('employee-page').textContent ?? '';
    expect(after).not.toContain('100');
  });

  it('shows the intended, actionable failure mode when no local receipt exists', async () => {
    // A payroll already distributed by another device — this wallet holds no local
    // receipt opening for it, so nothing is claimable. The safe failure mode, not a bug.
    renderApp(createFakeRuntime({ initialPayroll: distributedPayrollFixture }), '/employee');
    await waitFor(() => expect(screen.getByTestId('employee-no-receipts')).toBeInTheDocument());
    expect(screen.getByText(/No local receipt found/i)).toBeInTheDocument();
  });
});
