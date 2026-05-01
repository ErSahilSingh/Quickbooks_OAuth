const base = "";

async function handle(res) {
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const msg = data.error || data.message || res.statusText;
    throw new Error(msg);
  }
  return data;
}

export function getAuthConnectUrl() {
  return `${base}/api/auth/connect`;
}

export async function fetchStatus() {
  const res = await fetch(`${base}/api/status`);
  return handle(res);
}

export async function fetchQuickbooksContacts() {
  const res = await fetch(`${base}/api/quickbooks/contacts`);
  return handle(res);
}

export async function fullSyncInvoices() {
  const res = await fetch(`${base}/api/sync/invoices/full`, { method: "POST" });
  return handle(res);
}

export async function deltaSyncCustomers() {
  const res = await fetch(`${base}/api/sync/customers/delta`, {
    method: "POST",
  });
  return handle(res);
}

export async function deltaSyncInvoices() {
  const res = await fetch(`${base}/api/sync/invoices/delta`, {
    method: "POST",
  });
  return handle(res);
}

export async function fetchDbCustomers() {
  const res = await fetch(`${base}/api/data/customers`);
  return handle(res);
}

export async function fetchDbInvoices() {
  const res = await fetch(`${base}/api/data/invoices`);
  return handle(res);
}
