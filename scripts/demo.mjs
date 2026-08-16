/**
 * End-to-end walkthrough of the REST API for reviewers who skip the UI.
 * Start the server first: `npm run dev` (or `npm run build && npm start`),
 * then run `npm run demo`.
 */
const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';

async function call(method, path, body) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await response.json().catch(() => undefined);
  return { status: response.status, json };
}

function show(title, result) {
  console.log(`\n▸ ${title}`);
  console.log(`  ${result.status} ${JSON.stringify(result.json)}`);
}

try {
  show('List lockers (seeded at startup)', await call('GET', '/api/lockers'));

  show('Operations: add a MEDIUM locker', await call('POST', '/api/lockers', { size: 'MEDIUM' }));

  show(
    'Platform outbox: orders awaiting dispatch to this station',
    await call('GET', '/api/orders?status=awaiting-dispatch'),
  );

  show(
    'Operations: dispatch ORD-1004 to this station',
    await call('POST', '/api/orders/ORD-1004/dispatch'),
  );

  show('Agent: the pending-order queue (3 seeded + the one just dispatched)', await call('GET', '/api/orders'));

  show(
    "Agent: store order ORD-1001 — locker assigned by the order's size, PIN emailed to its contact",
    await call('POST', '/api/orders/ORD-1001/store'),
  );

  const stored = await call('POST', '/api/packages', {
    size: 'SMALL',
    customerEmail: 'customer@example.com',
  });
  show(
    'Agent: store a SMALL package with a customer email — the PIN is emailed (see the server console; notification field reports it)',
    stored,
  );

  show('Board now shows that locker occupied', await call('GET', '/api/lockers'));

  show(
    'Operations overview: PIN + accrued storage charge per occupied locker (Level 3 live)',
    await call('GET', '/api/admin/lockers'),
  );

  show(
    'Customer: a PIN that matches no package is rejected',
    await call('POST', '/api/pickups', { pickupCode: '000000' }),
  );

  const pickup = { pickupCode: stored.json.pickupCode };
  show(
    'Customer: the PIN alone opens the right locker (no locker id needed); RM0 within the grace period',
    await call('POST', '/api/pickups', pickup),
  );

  show('Replaying the used PIN fails — no package matches it anymore', await call('POST', '/api/pickups', pickup));

  console.log('\n▸ Fill every LARGE-capable locker, then one more store must be refused');
  let last;
  do {
    last = await call('POST', '/api/packages', { size: 'LARGE' });
    console.log(`  ${last.status} ${JSON.stringify(last.json)}`);
  } while (last.status === 201);

  console.log(
    '\nDone — locker state is in-memory; restart the server to reset.',
    '\nTip: run the server with RETURN_AFTER_DAYS=0 to demo warehouse returns instantly',
    '(GET /api/returns, then POST /api/lockers/<id>/return).',
  );
} catch (error) {
  console.error(
    `\nCould not reach the server at ${BASE_URL}.`,
    'Start it first with `npm run dev` (UI + API) or `npm run build && npm start`.',
  );
  console.error(String(error));
  process.exit(1);
}
