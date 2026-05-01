import fetch from "node-fetch";
import Customer from "../models/Customer.js";
import Invoice from "../models/Invoice.js";
import { getValidAccessToken } from "./tokenService.js";

const PRODUCTION_BASE = "https://quickbooks.api.intuit.com/v3/company";
const SANDBOX_BASE = "https://sandbox-quickbooks.api.intuit.com/v3/company";

function apiBase() {
  return process.env.QUICKBOOKS_ENVIRONMENT === "production"
    ? PRODUCTION_BASE
    : SANDBOX_BASE;
}


function toQboTimestamp(d) {
  return d.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function toHttpDate(d) {
  return d.toUTCString();
}

function pickPrimaryEmail(customer) {
  const primary = customer?.PrimaryEmailAddr?.Address;
  if (primary && typeof primary === "string") return primary.trim();
  return "";
}

function mapCustomer(entity) {
  const meta = entity?.MetaData;
  const last =
    meta?.LastUpdatedTime != null
      ? new Date(meta.LastUpdatedTime)
      : new Date();
  return {
    customerId: String(entity.Id),
    name: entity.DisplayName || entity.CompanyName || "",
    email: pickPrimaryEmail(entity),
    lastUpdated: last,
  };
}

function mapInvoice(entity) {
  const meta = entity?.MetaData;
  const last =
    meta?.LastUpdatedTime != null
      ? new Date(meta.LastUpdatedTime)
      : new Date();
  const totalAmt =
    typeof entity.TotalAmt === "number"
      ? entity.TotalAmt
      : Number(entity.TotalAmt) || 0;
  const bal = Number(entity.Balance);
  const paidLike = bal === 0 || entity.Balance === "0";
  return {
    invoiceId: String(entity.Id),
    customerId: entity.CustomerRef?.value != null
      ? String(entity.CustomerRef.value)
      : "",
    amount: totalAmt,
    status: paidLike ? "Paid" : String(entity.EmailStatus || "Open"),
    invoiceDate: entity.TxnDate ? new Date(entity.TxnDate) : undefined,
    lastUpdated: last,
  };
}


async function runQuery(companyId, sql, modifiedSince = null) {
  const { accessToken } = await getValidAccessToken(companyId);
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
  };
  if (modifiedSince instanceof Date && !Number.isNaN(modifiedSince.getTime())) {
    headers["If-Modified-Since"] = toHttpDate(modifiedSince);
  }

  const all = [];
  let start = 1;
  const maxResults = 1000;

  for (;;) {
    const pageSql = `${sql} STARTPOSITION ${start} MAXRESULTS ${maxResults}`;
    const url = `${apiBase()}/${encodeURIComponent(
      companyId
    )}/query?query=${encodeURIComponent(pageSql)}`;

    const res = await fetch(url, { method: "GET", headers });
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(
        `QuickBooks query parse error: ${res.status} ${text.slice(0, 200)}`
      );
    }

    if (!res.ok) {
      const fault = json?.Fault?.Error?.[0]?.Message || json?.message;
      throw new Error(
        fault || `QuickBooks query failed: ${res.status} ${text.slice(0, 200)}`
      );
    }

    const queryResponse = json?.QueryResponse;
    if (!queryResponse) {
      break;
    }

    const keys = Object.keys(queryResponse).filter((k) => k !== "maxResults" && k !== "startPosition");
    let batchCount = 0;
    for (const key of keys) {
      const val = queryResponse[key];
      if (Array.isArray(val)) {
        all.push(...val);
        batchCount += val.length;
      } else if (val && typeof val === "object") {
        all.push(val);
        batchCount += 1;
      }
    }

    if (batchCount < maxResults) break;
    start += maxResults;
  }

  return all;
}

async function upsertCustomers(rows) {
  let inserted = 0;
  let updated = 0;
  for (const entity of rows) {
    const doc = mapCustomer(entity);
    const existing = await Customer.findOne({ customerId: doc.customerId });
    await Customer.findOneAndUpdate(
      { customerId: doc.customerId },
      { $set: doc },
      { upsert: true, new: true }
    );
    if (existing) updated += 1;
    else inserted += 1;
  }
  return { inserted, updated, total: rows.length };
}

async function upsertInvoices(rows) {
  let inserted = 0;
  let updated = 0;
  for (const entity of rows) {
    const doc = mapInvoice(entity);
    const existing = await Invoice.findOne({ invoiceId: doc.invoiceId });
    await Invoice.findOneAndUpdate(
      { invoiceId: doc.invoiceId },
      { $set: doc },
      { upsert: true, new: true }
    );
    if (existing) updated += 1;
    else inserted += 1;
  }
  return { inserted, updated, total: rows.length };
}


export async function fullSyncCustomers(companyId) {
  const sql = "SELECT * FROM Customer";
  const rows = await runQuery(companyId, sql, null);
  const stats = await upsertCustomers(rows);
  return { ...stats, message: "Full customer sync completed" };
}

export async function deltaSyncCustomers(companyId) {
  const count = await Customer.countDocuments();
  if (count === 0) {
    const stats = await fullSyncCustomers(companyId);
    return {
      ...stats,
      message: "No local customers yet; ran full customer sync instead.",
      since: null,
    };
  }

  const latest = await Customer.findOne().sort({ lastUpdated: -1 });
  const since = latest?.lastUpdated
    ? new Date(latest.lastUpdated.getTime() - 1000)
    : new Date(0);

  const sql = `SELECT * FROM Customer WHERE Metadata.LastUpdatedTime > '${toQboTimestamp(
    since
  )}'`;
  const rows = await runQuery(companyId, sql, since);
  const stats = await upsertCustomers(rows);
  return {
    ...stats,
    message: "Delta customer sync completed",
    since: since.toISOString(),
  };
}


export async function fullSyncInvoices(companyId) {
  const sql = "SELECT * FROM Invoice";
  const rows = await runQuery(companyId, sql, null);
  const stats = await upsertInvoices(rows);
  return { ...stats, message: "Full invoice sync completed" };
}


export async function deltaSyncInvoices(companyId) {
  const count = await Invoice.countDocuments();
  if (count === 0) {
    const stats = await fullSyncInvoices(companyId);
    return {
      ...stats,
      message: "No local invoices yet; ran full invoice sync instead.",
      since: null,
    };
  }

  const latest = await Invoice.findOne().sort({ lastUpdated: -1 });
  const since = latest?.lastUpdated
    ? new Date(latest.lastUpdated.getTime() - 1000)
    : new Date(0);

  const sql = `SELECT * FROM Invoice WHERE Metadata.LastUpdatedTime > '${toQboTimestamp(
    since
  )}'`;
  const rows = await runQuery(companyId, sql, since);
  const stats = await upsertInvoices(rows);
  return {
    ...stats,
    message: "Delta invoice sync completed",
    since: since.toISOString(),
  };
}

export async function fetchContactsFromQuickBooks(companyId) {
  const sql = "SELECT * FROM Customer";
  const rows = await runQuery(companyId, sql, null);
  return rows.map((e) => mapCustomer(e));
}
