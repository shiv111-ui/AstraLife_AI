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
  const listeningEnabledRef = useRef(false);
  const armedRef = useRef(false);
  const restartTimerRef = useRef(null);
  const mountedRef = useRef(false);

  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(true);
  const [armed, setArmed] = useState(false);
  const [voiceMessage, setVoiceMessage] = useState(
    'Starting voice assistant. Say "Hey Astra"...'
  );

  const normalizeSpeech = (text) =>
    text
      .toLowerCase()
      .replace(/[.,!?]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const isEmergencyCommand = (text) => {
    const commandPattern =
      /\b(help|help me|medical help|medical emergency|send sos|emergency help|call ambulance|road accident|heart attack|cannot breathe|can't breathe|can not breathe|breathing difficulty|pregnancy emergency|fire emergency)\b/i;

    return commandPattern.test(text);
  };

  const triggerSOS = () => {
    if (triggeredRef.current) return;

    triggeredRef.current = true;
    listeningEnabledRef.current = false;
    armedRef.current = false;

    setListening(false);
    setArmed(false);

    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
    }

    try {
      recognitionRef.current?.stop();
    } catch {
      // Recognition may already be stopped.
    }

    setVoiceMessage("Emergency command detected. Opening Patient Dashboard...");

    navigate("/patient", {
      state: { startSOS: true },
    });
  };

  useEffect(() => {
    mountedRef.current = true;

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setVoiceSupported(false);
      setVoiceMessage(
        "Speech recognition is not supported in this browser. Use the manual SOS button."
      );

      return () => {
        mountedRef.current = false;
      };
    }

    const recognition = new SpeechRecognition();

    recognition.lang = "en-IN";
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      if (!mountedRef.current) return;

      setListening(true);
      setVoiceMessage('Listening for "Hey Astra"...');
    };

    recognition.onresult = (event) => {
      if (triggeredRef.current) return;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (!event.results[i].isFinal) continue;

        const spokenText = normalizeSpeech(
          event.results[i][0].transcript
        );

        setVoiceMessage(`Heard: "${spokenText}"`);

        const wakePhrase = /\bhey\s+astra\b/i;

        if (wakePhrase.test(spokenText)) {
          const commandAfterWake = spokenText
            .replace(wakePhrase, "")
            .trim();

          // Example: "Hey Astra, Medical Help"
          if (isEmergencyCommand(commandAfterWake)) {
            triggerSOS();
            return;
          }

          // Example: "Hey Astra" followed by "Help"
          armedRef.current = true;
          setArmed(true);

          setVoiceMessage(
            'Hey Astra activated. Now say "Help" or "Medical Help".'
          );

          continue;
        }

        // Accept an emergency command after the wake phrase.
        if (armedRef.current && isEmergencyCommand(spokenText)) {
          triggerSOS();
          return;
        }
      }
    };

    recognition.onerror = (event) => {
      if (!mountedRef.current) return;

      if (
        event.error === "not-allowed" ||
        event.error === "service-not-allowed"
      ) {
        listeningEnabledRef.current = false;
        setListening(false);

        setVoiceMessage(
          "Chrome blocked automatic microphone access or speech recognition. Use the manual SOS button."
        );
      } else if (event.error === "audio-capture") {
        listeningEnabledRef.current = false;
        setListening(false);

        setVoiceMessage(
          "No microphone detected. Check your microphone connection."
        );
      } else if (event.error !== "no-speech" && event.error !== "aborted") {
        setVoiceMessage(
          `Voice recognition error: ${event.error}. Attempting to restart...`
        );
      }
    };

    recognition.onend = () => {
      if (!mountedRef.current) return;

      setListening(false);

      if (
        listeningEnabledRef.current &&
        !triggeredRef.current
      ) {
        if (restartTimerRef.current) {
          clearTimeout(restartTimerRef.current);
        }

        restartTimerRef.current = setTimeout(() => {
          if (
            !mountedRef.current ||
            !listeningEnabledRef.current ||
            triggeredRef.current
          ) {
            return;
          }

          try {
            recognition.start();
          } catch {
            setVoiceMessage(
              "Automatic listening could not restart. Chrome may require a user gesture."
            );
          }
        }, 1000);
      }
    };

    recognitionRef.current = recognition;

    /*
     * Attempt hands-free startup.
     *
     * Chrome may reject this because speech recognition can require
     * a user gesture. Microphone permission alone does not guarantee
     * that automatic startup is permitted.
     */
    listeningEnabledRef.current = true;

    try {
      recognition.start();
    } catch {
      listeningEnabledRef.current = false;

      setVoiceMessage(
        'Chrome did not allow automatic startup. If needed, use "Start Voice Listening" below.'
      );
    }

    return () => {
      mountedRef.current = false;
      listeningEnabledRef.current = false;

      if (restartTimerRef.current) {
        clearTimeout(restartTimerRef.current);
      }

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

  // Fallback if Chrome blocks automatic startup.
  const startVoiceListening = () => {
    const recognition = recognitionRef.current;

    if (!recognition || listeningEnabledRef.current) return;

    triggeredRef.current = false;
    armedRef.current = false;
    listeningEnabledRef.current = true;

    setArmed(false);
    setVoiceMessage('Listening for "Hey Astra"...');

    try {
      recognition.start();
    } catch {
      listeningEnabledRef.current = false;

      setVoiceMessage(
        "Could not start voice recognition. Check Chrome microphone permissions and try again."
      );
    }
  };

  const stopVoiceListening = () => {
    listeningEnabledRef.current = false;
    armedRef.current = false;

    setListening(false);
    setArmed(false);

    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
    }

    try {
      recognitionRef.current?.stop();
    } catch {
      // Recognition may already be stopped.
    }

    setVoiceMessage(
      "Voice listening stopped. The manual SOS button remains available."
    );
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

        {/* Manual SOS */}
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

          {/* Hey Astra */}
          <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
            <p className="text-lg font-bold text-white">Hey Astra</p>

            <p className="mt-1 text-sm text-slate-400">
              Voice-activated emergency assistance
            </p>

            <div className="mt-4 flex items-center justify-center gap-2">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  listening
                    ? armed
                      ? "animate-pulse bg-emerald-400"
                      : "animate-pulse bg-cyan-400"
                    : "bg-slate-600"
                }`}
              />

              <span className="text-xs font-medium text-slate-400">
                {!listening
                  ? "Voice assistant inactive"
                  : armed
                    ? "Wake word detected — waiting for command"
                    : "Listening for Hey Astra"}
              </span>
            </div>

            <p
              className="mt-3 text-sm leading-6 text-slate-300"
              role="status"
              aria-live="polite"
            >
              {voiceMessage}
            </p>

            {/* Only shown when automatic listening is unavailable or stopped. */}
            {voiceSupported && !listening && (
              <button
                type="button"
                onClick={startVoiceListening}
                className="mt-4 inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-400/20"
              >
                <Mic size={17} />
                Start Voice Listening
              </button>
            )}

            {listening && (
              <button
                type="button"
                onClick={stopVoiceListening}
                className="mt-4 inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-700"
              >
                <MicOff size={17} />
                Stop Listening
              </button>
            )}

            <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-left">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Voice commands
              </p>

              <ul className="space-y-2 text-sm text-slate-300">
                <li>🎙️ "Hey Astra" → then "Help"</li>
                <li>🎙️ "Hey Astra, Medical Help"</li>
                <li>🎙️ "Hey Astra, Road Accident"</li>
                <li>🎙️ "Hey Astra, Call Ambulance"</li>
                <li>🎙️ "Hey Astra, Breathing Difficulty"</li>
              </ul>
            </div>

            <p className="mt-3 text-xs leading-5 text-slate-500">
              Automatic startup is attempted when this page opens. Chrome
              may still require a user gesture. Voice recognition may stop
              when the tab is backgrounded or the device is locked.
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