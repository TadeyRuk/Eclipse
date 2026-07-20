import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ok, type WalletPort, type WalletState } from '@eclipse/sdk';
import App from '../App';
import { __resetSdkForTests } from '../sdk';
import { useSession } from '../state/session';
import { validateAmounts, validateRecipients } from '../lib/validate';

function mockWallet(): WalletPort {
  const state: WalletState = { connected: true, address: 'aa'.repeat(32) };
  return {
    connect: async () => ok(state),
    disconnect: async () => ok(undefined),
    state: () => state,
    sign: async (p) => ok(p),
  };
}

function renderApp(path = '/employer') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
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
  beforeEach(() => {
    useSession.getState().resetFlow();
    useSession.setState({
      wallet: { connected: true, address: 'aa'.repeat(32) },
      payroll: null,
      lastErrorKind: null,
      lastErrorMessage: null,
    });
    __resetSdkForTests(mockWallet());
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('ok', { status: 200 })),
    );
  });

  it('clears amount inputs after successful distribute', async () => {
    const user = userEvent.setup();
    renderApp('/employer');

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

describe('observer page', () => {
  beforeEach(() => {
    __resetSdkForTests(mockWallet());
  });

  it('has no private amount fields', async () => {
    renderApp('/observer');
    await waitFor(() => expect(screen.getByTestId('observer-page')).toBeInTheDocument());
    expect(screen.queryByTestId('amount-0')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Private amount/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Individual amounts are not available/i)).toBeInTheDocument();
  });
});
