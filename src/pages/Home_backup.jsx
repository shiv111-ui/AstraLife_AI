import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Siren,
  ShieldCheck,
  ArrowRight,
  HeartPulse,
  Mic,
  MicOff,
} from "lucide-react";

function Home() {
  const navigate = useNavigate();
  const recognitionRef = useRef(null);
  const triggeredRef = useRef(false);

  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(true);
  const [voiceMessage, setVoiceMessage] = useState(
    'Tap "Enable Voice SOS" and say "Medical Help".'
  );

  // Both click and voice use the same emergency navigation.
  const triggerSOS = () => {
    if (triggeredRef.current) return;

    triggeredRef.current = true;

    try {
      recognitionRef.current?.stop();
    } catch {
      // Recognition may already be stopped.
    }

    navigate("/patient", {
      state: { startSOS: true },
    });
  };

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setVoiceSupported(false);
      setVoiceMessage(
        "Voice SOS is unavailable in this browser. Use the SOS button."
      );
      return;
    }

    const recognition = new SpeechRecognition();

    recognition.lang = "en-IN";
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setListening(true);
      setVoiceMessage('Listening. Say "Medical Help" to trigger SOS.');
    };

    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (!event.results[i].isFinal) continue;

        const text = event.results[i][0].transcript
          .toLowerCase()
          .replace(/[.,!?]/g, " ")
          .replace(/\s+/g, " ")
          .trim();

        setVoiceMessage(`Heard: "${text}"`);

        const emergencyPhrase =
          /\b(medical help|medical emergency|send sos|emergency help|help me|call ambulance|road accident|heart attack|cannot breathe|can't breathe|breathing difficulty|pregnancy emergency|fire emergency)\b/i;

        if (emergencyPhrase.test(text)) {
          triggerSOS();
          return;
        }
      }
    };

    recognition.onerror = (event) => {
      setListening(false);

      if (event.error === "not-allowed") {
        setVoiceMessage(
          "Microphone access denied. Allow microphone access in your browser."
        );
      } else if (event.error === "no-speech") {
        setVoiceMessage("No speech detected. You can try again.");
      } else {
        setVoiceMessage(`Voice recognition error: ${event.error}`);
      }
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onstart = null;
      recognition.onend = null;

      try {
        recognition.abort();
      } catch {
        // Ignore cleanup errors.
      }
    };
  }, []);

  const enableVoiceSOS = () => {
    triggeredRef.current = false;

    if (!recognitionRef.current || listening) return;

    try {
      recognitionRef.current.start();
    } catch {
      setVoiceMessage(
        "Voice recognition could not start. Please try again."
      );
    }
  };

  const stopVoiceSOS = () => {
    try {
      recognitionRef.current?.stop();
    } catch {
      // Ignore if already stopped.
    }

    setListening(false);
    setVoiceMessage("Voice SOS stopped. You can still use the SOS button.");
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-5 py-12 text-white sm:px-6">
      <div className="pointer-events-none absolute -left-32 -top-32 h-80 w-80 rounded-full bg-red-600/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />

      <main className="relative z-10 mx-auto w-full max-w-3xl text-center">
        {/* Logo */}
        <div className="mb-7 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10 text-red-400 shadow-lg shadow-red-950/20">
            <HeartPulse size={36} />
          </div>
        </div>

        {/* Heading */}
        <h1 className="text-4xl font-black tracking-tight sm:text-6xl">
          ASTRALIFE <span className="text-red-500">AI</span>
        </h1>

        <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-slate-300 sm:text-lg">
          Emergency Response Coordination System
        </p>

        <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
          Connecting patients, ambulances, hospitals, and control rooms
          for faster emergency response.
        </p>

        {/* Single SOS button */}
        <div className="mx-auto mt-10 w-full max-w-md">
          <button
            type="button"
            onClick={triggerSOS}
            className="group flex min-h-48 w-full flex-col items-center justify-center rounded-3xl border border-red-400/30 bg-gradient-to-br from-red-600 to-red-700 px-6 py-7 shadow-xl shadow-red-950/40 transition duration-200 hover:-translate-y-1 hover:from-red-500 hover:to-red-600 hover:shadow-2xl focus:outline-none focus:ring-4 focus:ring-red-400/40"
            aria-label="Trigger emergency SOS"
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 transition group-hover:scale-105">
              <Siren size={40} />
            </span>

            <span className="mt-4 text-3xl font-black tracking-widest">
              SOS
            </span>

            <span className="mt-2 text-sm font-medium text-red-100">
              Request Emergency Assistance
            </span>

            <span className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-white/80">
              Tap to send SOS
              <ArrowRight
                size={15}
                className="transition group-hover:translate-x-1"
              />
            </span>
          </button>

          {/* Voice activation control */}
          <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <button
              type="button"
              onClick={listening ? stopVoiceSOS : enableVoiceSOS}
              disabled={!voiceSupported}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-5 py-3 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {listening ? (
                <MicOff size={18} />
              ) : (
                <Mic size={18} />
              )}

              {listening ? "Stop Voice SOS" : "Enable Voice SOS"}
            </button>

            <p
              className="mt-3 text-sm leading-6 text-slate-300"
              role="status"
              aria-live="polite"
            >
              {voiceMessage}
            </p>

            <p className="mt-2 text-xs text-slate-500">
              Voice commands: "Medical Help", "Send SOS", or "Call Ambulance".
              Allow microphone access when prompted.
            </p>
          </div>

          {/* Staff Login */}
          <Link
            to="/login"
            className="mt-6 flex w-full items-center justify-center gap-3 rounded-xl border border-slate-700 bg-slate-900/70 px-6 py-4 font-semibold text-slate-200 transition hover:border-cyan-400/50 hover:bg-slate-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
          >
            <ShieldCheck size={21} className="text-cyan-400" />
            Staff Login
            <ArrowRight size={16} className="text-slate-500" />
          </Link>

          <p className="mt-3 text-xs text-amber-400">
            🔒 Only for Authorized Users
          </p>
        </div>

        {/* Features */}
        <div className="mx-auto mt-12 grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-4">
            <Siren size={21} className="mx-auto text-red-400" />
            <p className="mt-2 text-sm font-semibold text-slate-200">
              One-Tap SOS
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Quick emergency reporting
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-4">
            <HeartPulse size={21} className="mx-auto text-cyan-400" />
            <p className="mt-2 text-sm font-semibold text-slate-200">
              Live Tracking
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Follow emergency response
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-4">
            <ShieldCheck size={21} className="mx-auto text-emerald-400" />
            <p className="mt-2 text-sm font-semibold text-slate-200">
              Coordinated Care
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Connected response teams
            </p>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-10 text-xs leading-5 text-slate-600">
          Astralife AI · Emergency Response Coordination System
          <p className="mt-1">
            For immediate emergency assistance in India, call{" "}
            <a
              href="tel:112"
              className="font-semibold text-red-400 underline underline-offset-2"
            >
              112
            </a>
            .
          </p>
        </footer>
      </main>
    </div>
  );
}

export default Home;