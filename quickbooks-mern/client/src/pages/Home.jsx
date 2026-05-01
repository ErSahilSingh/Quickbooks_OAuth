import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  fetchQuickbooksContacts,
  fullSyncInvoices,
  deltaSyncCustomers,
  deltaSyncInvoices,
  fetchDbCustomers,
  fetchDbInvoices,
  fetchStatus,
} from "../api.js";

export default function Home() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState({ connected: false, companyId: null });
  const [qbContacts, setQbContacts] = useState([]);
  const [dbCustomers, setDbCustomers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const loadStatus = useCallback(async () => {
    const s = await fetchStatus();
    setStatus(s);
  }, []);

  const loadDb = useCallback(async () => {
    const [c, inv] = await Promise.all([fetchDbCustomers(), fetchDbInvoices()]);
    setDbCustomers(c.customers || []);
    setInvoices(inv.invoices || []);
  }, []);

  useEffect(() => {
    if (searchParams.get("connected") === "1") {
      setMessage("Connected to QuickBooks.");
      const next = new URLSearchParams(searchParams);
      next.delete("connected");
      setSearchParams(next, { replace: true });
    }
    if (searchParams.get("error")) {
      setError(searchParams.get("error"));
      const next = new URLSearchParams(searchParams);
      next.delete("error");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    loadStatus().catch((e) => setError(e.message));
    loadDb().catch((e) => setError(e.message));
  }, [loadStatus, loadDb]);

  async function run(label, fn) {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const result = await fn();
      if (result?.message) setMessage(result.message);
      return result;
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <h1>Home</h1>
      <p className="muted">
        {status.connected
          ? `Connected (company / realm: ${status.companyId || "n/a"})`
          : "Not connected — go back to login."}
      </p>
      {error && <p className="error">{error}</p>}
      {message && <p className="success">{message}</p>}

      <div className="toolbar">
        <button
          type="button"
          disabled={loading || !status.connected}
          onClick={async () => {
            await run("contacts", async () => {
              const r = await fetchQuickbooksContacts();
              setQbContacts(r.contacts || []);
              return { message: `Loaded ${(r.contacts || []).length} contacts from QuickBooks.` };
            });
          }}
        >
          Fetch Quickbooks Contacts
        </button>
        <button
          type="button"
          className="secondary"
          disabled={loading || !status.connected}
          onClick={async () => {
            await run("inv-full", fullSyncInvoices);
            await loadDb();
          }}
        >
          Full Sync Invoices
        </button>
        <button
          type="button"
          disabled={loading || !status.connected}
          onClick={async () => {
            await run("cust-delta", deltaSyncCustomers);
            await loadDb();
          }}
        >
          Delta Sync Customers
        </button>
        <button
          type="button"
          disabled={loading || !status.connected}
          onClick={async () => {
            await run("inv-delta", deltaSyncInvoices);
            await loadDb();
          }}
        >
          Delta Sync Invoices
        </button>
      </div>

      <h2 className="muted" style={{ fontSize: "1.05rem", marginBottom: "0.5rem" }}>
        Contacts (QuickBooks)
      </h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Customer ID</th>
              <th>Name</th>
              <th>Email</th>
              <th>Last updated (QB)</th>
            </tr>
          </thead>
          <tbody>
            {qbContacts.length === 0 ? (
              <tr>
                <td colSpan={4} className="muted">
                  Use &quot;Fetch Quickbooks Contacts&quot; to load.
                </td>
              </tr>
            ) : (
              qbContacts.map((c) => (
                <tr key={c.customerId}>
                  <td>{c.customerId}</td>
                  <td>{c.name}</td>
                  <td>{c.email || "—"}</td>
                  <td>{c.lastUpdated ? new Date(c.lastUpdated).toLocaleString() : "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <h2
        className="muted"
        style={{ fontSize: "1.05rem", margin: "1.25rem 0 0.5rem" }}
      >
        Customers (MongoDB after sync)
      </h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Customer ID</th>
              <th>Name</th>
              <th>Email</th>
              <th>Last updated</th>
            </tr>
          </thead>
          <tbody>
            {dbCustomers.length === 0 ? (
              <tr>
                <td colSpan={4} className="muted">
                  Run delta sync for customers to populate the database.
                </td>
              </tr>
            ) : (
              dbCustomers.map((c) => (
                <tr key={c._id}>
                  <td>{c.customerId}</td>
                  <td>{c.name}</td>
                  <td>{c.email || "—"}</td>
                  <td>{c.lastUpdated ? new Date(c.lastUpdated).toLocaleString() : "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <h2
        className="muted"
        style={{ fontSize: "1.05rem", margin: "1.25rem 0 0.5rem" }}
      >
        Invoices (MongoDB)
      </h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Invoice ID</th>
              <th>Customer ID</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Invoice date</th>
              <th>Last updated</th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 ? (
              <tr>
                <td colSpan={6} className="muted">
                  Run invoice sync to populate.
                </td>
              </tr>
            ) : (
              invoices.map((inv) => (
                <tr key={inv._id}>
                  <td>{inv.invoiceId}</td>
                  <td>{inv.customerId || "—"}</td>
                  <td>{inv.amount != null ? inv.amount.toFixed(2) : "—"}</td>
                  <td>{inv.status || "—"}</td>
                  <td>
                    {inv.invoiceDate
                      ? new Date(inv.invoiceDate).toLocaleDateString()
                      : "—"}
                  </td>
                  <td>
                    {inv.lastUpdated ? new Date(inv.lastUpdated).toLocaleString() : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
