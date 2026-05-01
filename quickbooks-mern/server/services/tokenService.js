import fetch from "node-fetch";
import QuickbooksToken from "../models/QuickbooksToken.js";

const TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";

function basicAuthHeader() {
  const id = process.env.QUICKBOOKS_CLIENT_ID;
  const secret = process.env.QUICKBOOKS_CLIENT_SECRET;
  const b64 = Buffer.from(`${id}:${secret}`).toString("base64");
  return `Basic ${b64}`;
}


export async function exchangeCodeForTokens(code, redirectUri) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(),
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error_description || data?.error || res.statusText;
    throw new Error(`Token exchange failed: ${msg}`);
  }
  return data;
}


export async function refreshAccessToken(refreshToken) {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(),
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error_description || data?.error || res.statusText;
    throw new Error(`Token refresh failed: ${msg}`);
  }
  return data;
}


export async function saveTokens(companyId, tokenPayload) {
  const expiresInSec = Number(tokenPayload.expires_in) || 3600;
  const expiresAt = new Date(Date.now() + expiresInSec * 1000);

  const update = {
    companyId,
    accessToken: tokenPayload.access_token,
    expiresAt,
  };
  if (tokenPayload.refresh_token) {
    update.refreshToken = tokenPayload.refresh_token;
  }

  const doc = await QuickbooksToken.findOneAndUpdate(
    { companyId },
    { $set: update },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return doc;
}


export async function getValidAccessToken(companyId) {
  const row = await QuickbooksToken.findOne({ companyId });
  if (!row) {
    throw new Error("Not connected to QuickBooks. Complete OAuth first.");
  }

  const bufferMs = 60 * 1000;
  if (row.expiresAt.getTime() > Date.now() + bufferMs) {
    return { accessToken: row.accessToken, companyId: row.companyId };
  }

  const refreshed = await refreshAccessToken(row.refreshToken);
  const saved = await saveTokens(companyId, {
    ...refreshed,
    refresh_token: refreshed.refresh_token || row.refreshToken,
  });

  return { accessToken: saved.accessToken, companyId: saved.companyId };
}

export async function getAnyConnectedCompanyId() {
  const row = await QuickbooksToken.findOne().sort({ updatedAt: -1 });
  return row?.companyId || null;
}
