import { Link } from "react-router-dom";

function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6">
      <div className="text-center">
        <h1 className="text-5xl font-bold text-white">
          ASTRALIFE <span className="text-red-500">AI</span>
        </h1>

        <p className="mt-4 text-lg text-slate-300">
          Emergency Response Coordination System
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <div className="flex flex-col items-center">
            <Link
              to="/login"
              className="rounded-lg border border-white/20 px-6 py-3 font-semibold text-white transition hover:border-cyan-400 hover:bg-white/10"
            >
              Staff Login
            </Link>
              <p className="mt-2 text-xs text-amber-400">
                🔒 Only for Authorized Users
              </p>
          </div>

          <Link
            to="/patient"
            className="rounded-lg bg-red-600 px-6 py-3 font-semibold text-white transition hover:bg-red-700"
          >
            Request Emergency Assistance
          </Link>
        </div>

        <p className="mt-6 text-sm text-slate-500">
          Connecting patients, ambulances, hospitals, and control rooms.
        </p>
      </div>
    </div>
  );
}

export default Home;