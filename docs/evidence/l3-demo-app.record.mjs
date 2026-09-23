// Screen-records the real Eclipse web app (in-memory mode) through the full flow.
// The wallet and proof-server health endpoint are demo stand-ins, and the page says so on screen.
//
// Usage (produces a .webm in OUT_DIR; l3-demo-app.mp4 is that file transcoded with ffmpeg):
//   cd apps/web && VITE_USE_CHAIN=0 npx vite --port 5173      # terminal A
//   npm i playwright-core && CHROMIUM_PATH=/path/to/chromium node l3-demo-app.record.mjs OUT_DIR
//   (pass `shots` as a second argument for step screenshots instead of video)
import { chromium } from 'playwright-core';

const OUT = process.argv[2];
const SHOTS = process.argv[3] === 'shots';
const BASE = 'http://127.0.0.1:5173';
const W = 1280;
const H = 720;

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
});
const context = await browser.newContext({
  viewport: { width: W, height: H },
  deviceScaleFactor: 1,
  ...(SHOTS ? {} : { recordVideo: { dir: OUT, size: { width: W, height: H } } }),
});

// Demo wallet: implements the DApp connector calls the app uses to connect.
await context.addInitScript(() => {
  const address = 'e0c1'.padEnd(64, '7');
  window.midnight = {
    demoWallet: {
      name: 'Demo wallet',
      apiVersion: '4.0.0',
      connect: async () => ({
        getShieldedAddresses: async () => ({
          shieldedAddress: address,
          shieldedCoinPublicKey: address,
          shieldedEncryptionPublicKey: address,
        }),
        getUnshieldedAddress: async () => ({ unshieldedAddress: address }),
      }),
    },
  };
});
// Local proof-server health check (the in-memory path never sends it a proof).
await context.route('http://127.0.0.1:6300/**', (r) => r.fulfill({ status: 200, body: 'ok' }));

const page = await context.newPage();
const pause = (ms) => page.waitForTimeout(Math.round(ms * 1.45));
let shot = 0;
const snap = async (name) => {
  if (SHOTS) await page.screenshot({ path: `${OUT}/${String(++shot).padStart(2, '0')}-${name}.png` });
};

async function overlay(caption) {
  await page.evaluate((text) => {
    let banner = document.getElementById('__demo_banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = '__demo_banner';
      banner.textContent =
        'Real Eclipse app · in-memory mode · demo wallet · no Preprod transactions in this recording';
      Object.assign(banner.style, {
        position: 'fixed', top: '0', left: '0', right: '0', zIndex: '99999',
        background: 'rgba(12,16,14,0.88)', color: '#e8d9a8', font: '600 14px/1 system-ui, sans-serif',
        padding: '9px 16px', textAlign: 'center', letterSpacing: '0.02em',
      });
      document.body.appendChild(banner);
    }
    let cap = document.getElementById('__demo_caption');
    if (!cap) {
      cap = document.createElement('div');
      cap.id = '__demo_caption';
      Object.assign(cap.style, {
        position: 'fixed', bottom: '22px', left: '50%', transform: 'translateX(-50%)',
        zIndex: '99999', maxWidth: '1080px', background: 'rgba(12,16,14,0.92)', color: '#f4f1e8',
        font: '500 21px/1.35 system-ui, sans-serif', padding: '12px 22px', borderRadius: '12px',
        border: '1px solid rgba(232,217,168,0.35)', textAlign: 'center',
      });
      document.body.appendChild(cap);
    }
    cap.textContent = text;
  }, caption);
}

async function type(selector, text) {
  await page.locator(selector).click();
  await page.locator(selector).pressSequentially(text, { delay: 45 });
}

async function nav(to) {
  await page.locator(`a[href="${to}"]`).first().click();
  await pause(400);
  await page.evaluate(() => window.scrollTo({ top: 0 }));
}

async function scrollTo(selector) {
  await page.locator(selector).first().evaluate((el) =>
    el.scrollIntoView({ behavior: 'smooth', block: 'center' }),
  );
  await pause(700);
}

// Beat 1 · connect (0:00–0:07)
await page.goto(`${BASE}/employer`);
await page.waitForLoadState('networkidle');
await overlay('Eclipse: private payroll on Midnight. The employer connects a wallet.');
await pause(2200);
await page.getByRole('button', { name: 'Connect Lace' }).click();
await pause(1600);
await snap('connected');

// Beat 2 · recipients + deposit (0:07–0:22)
await overlay('Three recipients. The list is public; what each one is paid will not be.');
const recipients = ['b1'.repeat(32), 'c2'.repeat(32), 'd3'.repeat(32)];
for (let i = 0; i < recipients.length; i++) {
  if (i > 0) await page.getByRole('button', { name: 'Add recipient' }).click();
  await page.locator(`[data-testid="recipient-${i}"]`).fill(recipients[i]);
  await pause(500);
}
await snap('recipients');
await page.locator('[data-testid="create-payroll"]').click();
await page.locator('[data-testid="deposit-input"]').waitFor();
await overlay('Deposit 1000 tNIGHT. The total is public by design (on Preprod, Lace signs a real transfer).');
await page.locator('[data-testid="deposit-input"]').fill('');
await type('[data-testid="deposit-input"]', '1000');
await pause(1400);
await snap('deposit');
await page.locator('[data-testid="fund-payroll"]').click();

// Beat 3 · private amounts + distribute (0:22–0:35)
await page.locator('[data-testid="amount-0"]').waitFor();
await overlay('Private amounts. The ZK circuit proves they sum to 1000 without revealing any of them.');
for (const [i, v] of ['420', '310', '270'].entries()) await type(`[data-testid="amount-${i}"]`, v);
await pause(1200);
await snap('amounts');
await page.locator('[data-testid="distribute"]').click();
await page.locator('[data-testid="distribute-success"]').waitFor();
await scrollTo('[data-testid="distribute-success"]');
await overlay('Distributed. Only salted commitments go on the ledger, and the amount fields are wiped.');
await pause(3200);
await snap('distributed');

// Beat 4 · observer (0:35–0:45)
await nav('/observer');
await overlay('Observer view: status, deposit total, recipients, commitments. No per-recipient amount anywhere.');
await pause(2500);
await scrollTo('[data-testid="observer-claimed"]');
await pause(2500);
await snap('observer');

// Beat 5 · employee claim (0:45–0:55)
await nav('/employee');
await overlay('Employee: claim slot 0 by proving knowledge of the committed amount, which is never shown.');
await pause(2000);
await scrollTo('[data-testid="claim-0"]');
await page.locator('[data-testid="claim-0"]').click();
await page.locator('[data-testid="claimed-0"]').waitFor();
await pause(2200);
await snap('claimed');

// Beat 6 · proof lands (0:55–1:00)
await nav('/observer');
await scrollTo('[data-testid="observer-claimed"]');
await overlay('Public ledger: slot 0 claimed. The amount never became public.');
await pause(3500);
await snap('observer-claimed');

await context.close();
await browser.close();
console.log('done');
