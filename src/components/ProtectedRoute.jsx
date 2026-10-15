import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../assets/firebase";

function ProtectedRoute({ allowedRole }) {
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let active = true;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        if (active) setStatus("unauthenticated");
        return;
      }

      try {
        const staffRef = doc(db, "Staff", user.uid);
        const staffSnapshot = await getDoc(staffRef);

        if (!active) return;

        if (!staffSnapshot.exists()) {
          setStatus("unauthorized");
          return;
        }

        const staff = staffSnapshot.data();

        if (staff.active !== true || staff.role !== allowedRole) {
          setStatus("unauthorized");
          return;
        }

        setStatus("authorized");
      } catch (error) {
        console.error("Staff authorization check failed:", error);

        if (active) setStatus("error");
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [allowedRole]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <p className="text-slate-300">Verifying access...</p>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return <Navigate to="/login" replace />;
  }

  if (status === "unauthorized") {
    return <Navigate to="/" replace />;
  }

  if (status === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Unable to verify access</h1>
          <p className="mt-2 text-slate-400">
            Please check your connection and try again.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-5 rounded-lg bg-red-600 px-5 py-3 font-semibold"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return <Outlet />;
}

export default ProtectedRoute;