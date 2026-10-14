import { Routes, Route } from "react-router-dom";
import { db } from "./assets/firebase";
import Home from "./pages/Home";
import Login from "./pages/Login";
import PatientDashboard from "./pages/PatientDashboard";
import AmbulanceDashboard from "./pages/AmbulanceDashboard";
import HospitalDashboard from "./pages/HospitalDashboard";
import ControlRoomDashboard from "./pages/ControlRoomDashboard";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />

      <Route path="/login" element={<Login />} />

      <Route
        path="/patient"
        element={<PatientDashboard />}
      />

      <Route
        path="/ambulance"
        element={<AmbulanceDashboard />}
      />

      <Route path="/hospital" element={<HospitalDashboard />} />

      <Route path="/control-room" element={<ControlRoomDashboard />} />

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