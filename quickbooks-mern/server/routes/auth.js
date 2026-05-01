import express from "express";
import { exchangeCodeForTokens, saveTokens } from "../services/tokenService.js";
import { issueState, verifyAndConsumeState } from "../lib/oauthState.js";

const router = express.Router();

/** Intuit authorization endpoint (see OAuth 2.0 docs). */
const INTUIT_AUTHORIZE_URL = "https://appcenter.intuit.com/connect/oauth2";

const DEFAULT_SCOPE = "com.intuit.quickbooks.accounting";

function trimEnv(value) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Space-separated scopes; optional `QUICKBOOKS_OAUTH_SCOPES` overrides default.
 * If you add `openid profile email`, enable those scopes for the app in the Intuit Developer portal.
 */
function oauthScopes() {
  const custom = trimEnv(process.env.QUICKBOOKS_OAUTH_SCOPES);
  return custom || DEFAULT_SCOPE;
}

/**
 * Starts OAuth: browser hits this URL and gets redirected to Intuit.
 */
router.get("/connect", (req, res) => {
  const clientId = trimEnv(process.env.QUICKBOOKS_CLIENT_ID);
  const redirectUri = trimEnv(process.env.QUICKBOOKS_REDIRECT_URI);
  if (!clientId || !redirectUri) {
    return res.status(500).json({
      error: "Missing QUICKBOOKS_CLIENT_ID or QUICKBOOKS_REDIRECT_URI",
    });
  }

  const state = issueState();
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    scope: oauthScopes(),
    redirect_uri: redirectUri,
    state,
  });

  const authUrl = `${INTUIT_AUTHORIZE_URL}?${params.toString()}`;
  return res.redirect(authUrl);
});

/**
 * Safe checks that `.env` loaded (no secrets returned). Use when debugging Intuit connection errors.
 */
router.get("/diagnostics", (req, res) => {
  const clientId = trimEnv(process.env.QUICKBOOKS_CLIENT_ID);
  const redirectUri = trimEnv(process.env.QUICKBOOKS_REDIRECT_URI);
  res.json({
    envOk: Boolean(clientId && redirectUri),
    hasClientId: Boolean(clientId),
    hasRedirectUri: Boolean(redirectUri),
    clientIdCharLength: clientId.length,
    redirectUriCharLength: redirectUri.length,
    redirectEndsWithCallbackPath: redirectUri.endsWith("/api/auth/callback"),
    scopes: oauthScopes(),
    authorizeUrl: INTUIT_AUTHORIZE_URL,
    hint:
      "If Intuit shows an error before redirecting to localhost, fix Sandbox company + Keys in developer.intuit.com (see README Troubleshooting).",
  });
});

/**
 * Intuit redirects here with ?code=...&state=...&realmId=...
 */
router.get("/callback", async (req, res) => {
  const frontend = trimEnv(process.env.FRONTEND_URL) || "http://localhost:5173";
  const redirectUri = trimEnv(process.env.QUICKBOOKS_REDIRECT_URI);

  try {
    const rawCode = req.query.code;
    const code = Array.isArray(rawCode) ? rawCode[0] : rawCode;
    const { state } = req.query;
    const rawRealm =
      req.query.realmId ?? req.query.realmid ?? req.query.realm_id;
    const realmId = Array.isArray(rawRealm) ? rawRealm[0] : rawRealm;

    if (!verifyAndConsumeState(String(state || ""))) {
      return res.redirect(`${frontend}/?error=${encodeURIComponent("invalid_state")}`);
    }
    if (!code || !realmId) {
      return res.redirect(`${frontend}/?error=${encodeURIComponent("missing_code_or_realm")}`);
    }

    const tokenPayload = await exchangeCodeForTokens(String(code), redirectUri);
    await saveTokens(String(realmId), tokenPayload);

    return res.redirect(`${frontend}/home?connected=1`);
  } catch (err) {
    console.error("OAuth callback error:", err.message);
    return res.redirect(
      `${frontend}/?error=${encodeURIComponent(err.message || "oauth_failed")}`
    );
  }
});

export default router;
