import { Routes, Route } from "react-router-dom";

import Home from "./pages/Home";
import Login from "./pages/Login";
import PatientDashboard from "./pages/PatientDashboard";
import AmbulanceDashboard from "./pages/AmbulanceDashboard";
import HospitalDashboard from "./pages/HospitalDashboard";
import ControlRoomDashboard from "./pages/ControlRoomDashboard";

import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<Home />} />

      <Route path="/login" element={<Login />} />

      <Route
        path="/patient"
        element={<PatientDashboard />}
      />

      {/* Protected Staff Routes */}
      <Route element={<ProtectedRoute allowedRole="ambulance" />}>
        <Route
          path="/ambulance"
          element={<AmbulanceDashboard />}
        />
      </Route>

      <Route element={<ProtectedRoute allowedRole="hospital" />}>
        <Route
          path="/hospital"
          element={<HospitalDashboard />}
        />
      </Route>

      <Route element={<ProtectedRoute allowedRole="control-room" />}>
        <Route
          path="/control-room"
          element={<ControlRoomDashboard />}
        />
      </Route>

      {/* 404 Route */}
      <Route
        path="*"
        element={
          <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
            <div className="text-center">
              <h1 className="text-4xl font-bold">404</h1>

              <p className="mt-3 text-slate-400">
                Page not found
              </p>

              <a
                href="/"
                className="mt-5 inline-block rounded-lg bg-red-600 px-5 py-3"
              >
                Return Home
              </a>
            </div>
          </div>
        }
      />
    </Routes>
  );
}

export default App;