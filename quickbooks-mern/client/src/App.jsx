import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { fetchStatus } from "./api.js";
import Login from "./pages/Login.jsx";
import Home from "./pages/Home.jsx";

function RequireAuth({ children }) {
  const [ok, setOk] = useState(null);
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;
    fetchStatus()
      .then((s) => {
        if (!cancelled) setOk(Boolean(s.connected));
      })
      .catch(() => {
        if (!cancelled) setOk(false);
      });
    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  if (ok === null) {
    return (
      <div className="login-wrap">
        <p className="muted">Checking session…</p>
      </div>
    );
  }
  if (!ok) {
    return <Navigate to="/" replace />;
  }
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route
        path="/home"
        element={
          <RequireAuth>
            <Home />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
