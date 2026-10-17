import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
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
  LoaderCircle,
} from "lucide-react";

import { auth, db } from "../assets/firebase";

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

const roleRoutes = {
  ambulance: "/ambulance",
  hospital: "/hospital",
  "control-room": "/control-room",
};

function Login() {
  const navigate = useNavigate();

  const [selectedRole, setSelectedRole] = useState("ambulance");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(event) {
    event.preventDefault();

    setError("");
    setMessage("");

    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setError("Please enter your authorized staff email.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setLoading(true);

    let signedInUser = null;

    try {
      // Step 1: Authenticate using Firebase Authentication.
      const credential = await signInWithEmailAndPassword(
        auth,
        trimmedEmail,
        password
      );

      signedInUser = credential.user;

      // Step 2: Fetch the staff record using the authenticated UID.
      const staffRef = doc(db, "Staff", signedInUser.uid);
      const staffSnapshot = await getDoc(staffRef);

      // Step 3: Reject accounts without an authorized staff record.
      if (!staffSnapshot.exists()) {
        await signOut(auth);
        setError(
          "This account is not registered as authorized staff. Contact the administrator."
        );
        return;
      }

      const staffData = staffSnapshot.data();

      // Step 4: Check whether the staff account is active.
      if (staffData.active !== true) {
        await signOut(auth);
        setError(
          "Your staff account is inactive. Contact the administrator."
        );
        return;
      }

      // Step 5: Validate the role stored in Firestore.
      if (!Object.prototype.hasOwnProperty.call(roleRoutes, staffData.role)) {
        await signOut(auth);
        setError(
          "Your account has an invalid staff role. Contact the administrator."
        );
        return;
      }

      // Step 6: Ensure the selected department matches the assigned role.
      if (staffData.role !== selectedRole) {
        await signOut(auth);
        setError(
          "The selected department does not match your authorized staff role."
        );
        return;
      }

      // Step 7: Redirect to the authorized dashboard.
      setMessage("Login successful. Redirecting to your dashboard...");

      navigate(roleRoutes[staffData.role], { replace: true });
    } catch (firebaseError) {
      console.error("Staff login error:", firebaseError);

      // If authentication succeeded but a later operation failed,
      // sign out to avoid leaving an unauthorized session active.
      if (signedInUser) {
        try {
          await signOut(auth);
        } catch (signOutError) {
          console.error("Sign-out error:", signOutError);
        }
      }

      switch (firebaseError.code) {
        case "auth/invalid-credential":
        case "auth/user-not-found":
        case "auth/wrong-password":
          setError("Invalid email or password.");
          break;

        case "auth/invalid-email":
          setError("Please enter a valid email address.");
          break;

        case "auth/too-many-requests":
          setError(
            "Too many unsuccessful attempts. Please wait and try again."
          );
          break;

        case "auth/network-request-failed":
          setError(
            "Network error. Check your internet connection and try again."
          );
          break;

        case "permission-denied":
          setError(
            "Access to the staff record was denied. Check your Firestore security rules."
          );
          break;

        default:
          setError(
            "Unable to sign in. Check your connection and Firebase configuration, then try again."
          );
      }
    } finally {
      setLoading(false);
    }
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
                        disabled={loading}
                        aria-pressed={isSelected}
                        onClick={() => {
                          setSelectedRole(role.id);
                          setError("");
                          setMessage("");
                        }}
                        className={`flex w-full items-center gap-4 rounded-xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
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
                    disabled={loading}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      setError("");
                      setMessage("");
                    }}
                    className="w-full bg-transparent py-3.5 text-sm text-white outline-none placeholder:text-slate-600 disabled:opacity-60"
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
                    disabled={loading}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      setError("");
                      setMessage("");
                    }}
                    className="w-full bg-transparent py-3.5 text-sm text-white outline-none placeholder:text-slate-600 disabled:opacity-60"
                  />

                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => setShowPassword((previous) => !previous)}
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    className="shrink-0 text-slate-500 hover:text-white disabled:opacity-50"
                  >
                    {showPassword ? (
                      <EyeOff size={19} />
                    ) : (
                      <Eye size={19} />
                    )}
                  </button>
                </div>
              </div>

              {/* Error feedback */}
              {error && (
                <div
                  role="alert"
                  className="mb-5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-300"
                >
                  {error}
                </div>
              )}

              {/* Success feedback */}
              {message && (
                <div
                  role="status"
                  className="mb-5 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm leading-6 text-emerald-200"
                >
                  {message}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 px-5 py-3.5 font-semibold text-slate-950 transition hover:bg-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <LoaderCircle size={18} className="animate-spin" />
                    Verifying staff...
                  </>
                ) : (
                  <>
                    Continue to Portal
                    <ArrowRight size={18} />
                  </>
                )}
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
