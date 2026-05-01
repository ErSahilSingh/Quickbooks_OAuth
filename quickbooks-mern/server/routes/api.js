import express from "express";
import Customer from "../models/Customer.js";
import Invoice from "../models/Invoice.js";
import { getAnyConnectedCompanyId } from "../services/tokenService.js";
import {
  fullSyncCustomers,
  deltaSyncCustomers,
  fullSyncInvoices,
  deltaSyncInvoices,
  fetchContactsFromQuickBooks,
} from "../services/quickbooksService.js";

const router = express.Router();

async function resolveCompanyId(req) {
  const q = req.query.companyId;
  if (q && typeof q === "string") return q;
  return getAnyConnectedCompanyId();
}

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}


router.get(
  "/quickbooks/contacts",
  asyncHandler(async (req, res) => {
    const companyId = await resolveCompanyId(req);
    if (!companyId) {
      return res.status(401).json({ error: "Connect QuickBooks first." });
    }
    const contacts = await fetchContactsFromQuickBooks(companyId);
    res.json({ companyId, contacts });
  })
);

router.post(
  "/sync/customers/full",
  asyncHandler(async (req, res) => {
    const companyId = await resolveCompanyId(req);
    if (!companyId) {
      return res.status(401).json({ error: "Connect QuickBooks first." });
    }
    const result = await fullSyncCustomers(companyId);
    res.json({ companyId, ...result });
  })
);

router.post(
  "/sync/customers/full",
  asyncHandler(async (req, res) => {
    const companyId = await resolveCompanyId(req);
    if (!companyId) {
      return res.status(401).json({ error: "Connect QuickBooks first." });
    }
    const result = await fullSyncCustomers(companyId);
    res.json({ companyId, ...result });
  })
);

router.post(
  "/sync/customers/delta",
  asyncHandler(async (req, res) => {
    const companyId = await resolveCompanyId(req);
    if (!companyId) {
      return res.status(401).json({ error: "Connect QuickBooks first." });
    }
    const result = await deltaSyncCustomers(companyId);
    res.json({ companyId, ...result });
  })
);

router.post(
  "/sync/invoices/full",
  asyncHandler(async (req, res) => {
    const companyId = await resolveCompanyId(req);
    if (!companyId) {
      return res.status(401).json({ error: "Connect QuickBooks first." });
    }
    const result = await fullSyncInvoices(companyId);
    res.json({ companyId, ...result });
  })
);

router.post(
  "/sync/invoices/delta",
  asyncHandler(async (req, res) => {
    const companyId = await resolveCompanyId(req);
    if (!companyId) {
      return res.status(401).json({ error: "Connect QuickBooks first." });
    }
    const result = await deltaSyncInvoices(companyId);
    res.json({ companyId, ...result });
  })
);

/** MongoDB snapshots */
router.get(
  "/data/customers",
  asyncHandler(async (req, res) => {
    const rows = await Customer.find().sort({ lastUpdated: -1 }).lean();
    res.json({ customers: rows });
  })
);

router.get(
  "/data/invoices",
  asyncHandler(async (req, res) => {
    const rows = await Invoice.find().sort({ lastUpdated: -1 }).lean();
    res.json({ invoices: rows });
  })
);

router.get(
  "/status",
  asyncHandler(async (req, res) => {
    const companyId = await getAnyConnectedCompanyId();
    res.json({ connected: Boolean(companyId), companyId });
  })
);

export default router;
