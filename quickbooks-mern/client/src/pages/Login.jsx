import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { fetchStatus, getAuthConnectUrl } from "../api.js";

export default function Login() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [error, setError] = useState(null);

  useEffect(() => {
    const err = searchParams.get("error");
    if (err) {
      setError(err);
      const next = new URLSearchParams(searchParams);
      next.delete("error");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    let cancelled = false;
    fetchStatus()
      .then((s) => {
        if (!cancelled && s.connected) navigate("/home", { replace: true });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="login-wrap">
      <div className="card">
        <h1>QuickBooks</h1>
        <p className="muted">Sign in with your Intuit account to connect this app.</p>
        {error && <p className="error">{error}</p>}
        <button
          type="button"
          onClick={() => {
            window.location.href = getAuthConnectUrl();
          }}
        >
          Login with Quickbooks
        </button>
      </div>
    </div>
  );
}
