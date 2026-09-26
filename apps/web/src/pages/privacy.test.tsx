import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../app/App';
import { createFakeRuntime, distributedPayrollFixture } from '../test/createFakeRuntime';
import type { EclipseRuntime } from '../shared/runtime/EclipseRuntime';
import { validateAmounts, validateRecipients } from '../lib/validate';

function renderApp(runtime: EclipseRuntime, path = '/employer') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App runtime={runtime} />
    </MemoryRouter>,
  );
}

describe('validate', () => {
  it('rejects too many recipients', () => {
    expect(validateRecipients(Array.from({ length: 9 }, () => 'x'))).toMatch(/At most/);
  });

  it('requires sum == deposit', () => {
    const r = validateAmounts(['60', '40'], '100');
    expect(r.error).toBeNull();
    const bad = validateAmounts(['60', '41'], '100');
    expect(bad.error).toMatch(/must equal deposit/);
  });
});

describe('employer privacy wipe', () => {
  it('clears amount inputs after successful distribute', async () => {
    const runtime = createFakeRuntime();
    const user = userEvent.setup();
    renderApp(runtime, '/employer');

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
    expect(screen.queryByTestId('amount-0')).not.toBeInTheDocument();
    expect(screen.getByTestId('public-payroll')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Private amount/i)).not.toBeInTheDocument();
  });
});

describe('employee claim', () => {
  /** Drive the employer flow so a distributed payroll and local receipt exist. */
  async function distributeAs(user: ReturnType<typeof userEvent.setup>) {
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

  it('claims a slot without ever rendering the amount', async () => {
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

  it('shows the intended failure mode when no local receipt exists', async () => {
    // A payroll already distributed by another device — this wallet holds no local
    // receipt opening for it, so nothing is claimable. The safe failure mode, not a bug.
    renderApp(createFakeRuntime({ initialPayroll: distributedPayrollFixture }), '/employee');
    await waitFor(() => expect(screen.getByTestId('employee-no-receipts')).toBeInTheDocument());
    expect(screen.getByText(/No local receipt found/i)).toBeInTheDocument();
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

describe('observer page', () => {
  it('has no private amount fields', async () => {
    renderApp(createFakeRuntime(), '/observer');
    await waitFor(() => expect(screen.getByTestId('observer-page')).toBeInTheDocument());
    expect(screen.queryByTestId('amount-0')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Private amount/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Individual amounts are not available/i)).toBeInTheDocument();
  });
});
