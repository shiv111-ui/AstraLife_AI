import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  Ambulance,
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  HeartPulse,
  Hospital,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from "lucide-react";

const staffRoles = [
  {
    id: "ambulance",
    title: "Ambulance Personnel",
    description: "Manage ambulance missions",
    icon: Ambulance,
  },
  {
    id: "hospital",
    title: "Hospital Staff",
    description: "Manage incoming patients",
    icon: Hospital,
  },
  {
    id: "control-room",
    title: "Control Room Operator",
    description: "Coordinate emergency responses",
    icon: ShieldCheck,
  },
];

function Login() {
  const [selectedRole, setSelectedRole] = useState("ambulance");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  function handleLogin(event) {
    event.preventDefault();

    setError("");
    setMessage("");

    if (!email.trim()) {
      setError("Please enter your authorized staff email.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }

    if (!password) {
      setError("Please enter your password.");
      return;
    }

    // Authentication has not been implemented yet.
    // Do not grant dashboard access based on this form.
    setMessage(
      "Login interface validated. Staff authentication is not configured yet."
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      {/* Background effects */}
      <div className="pointer-events-none absolute -left-32 top-20 h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 bottom-0 h-96 w-96 rounded-full bg-red-500/10 blur-3xl" />

      {/* Header */}
      <header className="relative z-10 border-b border-white/10 bg-slate-950/70">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-500/15 text-red-400">
              <HeartPulse size={25} />
            </div>

            <div>
              <h1 className="text-xl font-bold tracking-wide">
                Astralife <span className="text-cyan-400">AI</span>
              </h1>
              <p className="text-xs text-slate-400">
                Emergency Response Coordination
              </p>
            </div>
          </Link>

          <Link
            to="/"
            className="flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2.5 text-sm text-slate-300 transition hover:border-cyan-400/40 hover:text-white"
          >
            <ArrowLeft size={16} />
            <span>Back to Home</span>
          </Link>
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 mx-auto grid min-h-[calc(100vh-81px)] max-w-7xl items-center gap-12 px-5 py-12 sm:px-8 lg:grid-cols-2 lg:gap-20">
        {/* Information section */}
        <section className="hidden lg:block">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/5 px-4 py-2 text-sm text-cyan-300">
            <Activity size={16} />
            Authorized staff portal
          </div>

          <h2 className="max-w-xl text-5xl font-bold leading-tight xl:text-6xl">
            Coordinate
            <br />
            <span className="text-cyan-400">every response.</span>
          </h2>

          <p className="mt-6 max-w-lg text-lg leading-8 text-slate-400">
            A dedicated portal for ambulance personnel, hospital staff, and
            emergency control room operators.
          </p>

          <div className="mt-10 space-y-5">
            <Feature
              icon={Ambulance}
              title="Ambulance personnel"
              description="Review and manage assigned emergency missions."
            />

            <Feature
              icon={Hospital}
              title="Hospital staff"
              description="Prepare for incoming patients and update readiness."
            />

            <Feature
              icon={ShieldCheck}
              title="Control room operators"
              description="Coordinate emergency requests and response teams."
            />
          </div>
        </section>

        {/* Login form */}
        <section className="mx-auto w-full max-w-xl">
          <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-9">
            <div className="mb-8">
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-400">
                <LockKeyhole size={28} />
              </div>

              <h2 className="text-3xl font-bold">Staff Sign In</h2>

              <p className="mt-2 text-sm leading-6 text-slate-400">
                Select your department and enter your staff account
                credentials.
              </p>
            </div>

            <form onSubmit={handleLogin} noValidate>
              {/* Staff role selection */}
              <div className="mb-7">
                <label className="mb-3 block text-sm font-semibold text-slate-200">
                  Select your department
                </label>

                <div className="space-y-3">
                  {staffRoles.map((role) => {
                    const Icon = role.icon;
                    const isSelected = selectedRole === role.id;

                    return (
                      <button
                        key={role.id}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => {
                          setSelectedRole(role.id);
                          setError("");
                          setMessage("");
                        }}
                        className={`flex w-full items-center gap-4 rounded-xl border p-4 text-left transition ${
                          isSelected
                            ? "border-cyan-400 bg-cyan-400/10"
                            : "border-white/10 bg-slate-950/50 hover:border-white/25"
                        }`}
                      >
                        <div
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                            isSelected
                              ? "bg-cyan-400/10 text-cyan-400"
                              : "bg-white/5 text-slate-400"
                          }`}
                        >
                          <Icon size={22} />
                        </div>

                        <div className="flex-1">
                          <h3 className="text-sm font-semibold">
                            {role.title}
                          </h3>
                          <p className="mt-1 text-xs text-slate-400">
                            {role.description}
                          </p>
                        </div>

                        <span
                          className={`h-3 w-3 shrink-0 rounded-full ${
                            isSelected
                              ? "bg-cyan-400"
                              : "border border-slate-600"
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Email */}
              <div className="mb-5">
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-medium text-slate-300"
                >
                  Staff email address
                </label>

                <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/70 px-4 focus-within:border-cyan-400/60">
                  <Mail size={19} className="shrink-0 text-slate-500" />

                  <input
                    id="email"
                    type="email"
                    autoComplete="username"
                    placeholder="staff@example.com"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      setError("");
                      setMessage("");
                    }}
                    className="w-full bg-transparent py-3.5 text-sm text-white outline-none placeholder:text-slate-600"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="mb-5">
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-medium text-slate-300"
                >
                  Password
                </label>

                <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/70 px-4 focus-within:border-cyan-400/60">
                  <LockKeyhole
                    size={19}
                    className="shrink-0 text-slate-500"
                  />

                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      setError("");
                      setMessage("");
                    }}
                    className="w-full bg-transparent py-3.5 text-sm text-white outline-none placeholder:text-slate-600"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="shrink-0 text-slate-500 hover:text-white"
                  >
                    {showPassword ? (
                      <EyeOff size={19} />
                    ) : (
                      <Eye size={19} />
                    )}
                  </button>
                </div>
              </div>

              {/* Feedback */}
              {error && (
                <div
                  role="alert"
                  className="mb-5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300"
                >
                  {error}
                </div>
              )}

              {message && (
                <div
                  role="status"
                  className="mb-5 rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm leading-6 text-amber-200"
                >
                  {message}
                </div>
              )}

              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 px-5 py-3.5 font-semibold text-slate-950 transition hover:bg-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:ring-offset-2 focus:ring-offset-slate-900"
              >
                Continue to Portal
                <ArrowRight size={18} />
              </button>
            </form>

            <div className="mt-6 border-t border-white/10 pt-5 text-center">
              <p className="text-xs leading-5 text-slate-500">
                Access is intended for authorized emergency response personnel.
              </p>
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-slate-600">
            For real emergencies in India, call 112.
          </p>
        </section>
      </main>
    </div>
  );
}

function Feature({ icon: Icon, title, description }) {
  return (
    <div className="flex items-start gap-4">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-cyan-400">
        <Icon size={21} />
      </div>

      <div>
        <h3 className="font-semibold text-slate-200">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-slate-400">{description}</p>
      </div>
    </div>
  );
}

export default Login;