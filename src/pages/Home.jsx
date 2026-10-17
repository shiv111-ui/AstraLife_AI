import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Siren,
  ShieldCheck,
  ArrowRight,
  HeartPulse,
  Mic,
  MicOff,
} from "lucide-react";

/*
 * Normalize speech-recognition output.
 * Declared outside Home to avoid initialization-order errors.
 */
function normalizeSpeech(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/*
 * Recognize Nova, Noava, and similar pronunciations.
 */
function containsWakeWord(text) {
  const normalized = normalizeSpeech(text);

  const wakePatterns = [
    /\bhey\s+nova\b/,
    /\bhey\s+noava\b/,
    /\bhey\s+noova\b/,
    /\bhey\s+noba\b/,
    /\bhey\s+novah\b/,
    /\bhey\s+no\s+va\b/,
    /\bhi\s+nova\b/,
    /\bhi\s+noava\b/,
    /\bhello\s+nova\b/,
    /\bhello\s+noava\b/,
    /\bokay\s+nova\b/,
    /\bok\s+nova\b/,
    /\bnova\b/,
    /\bnoava\b/,
    /\bnoova\b/,
    /\bnoba\b/,
    /\bnovah\b/,
    /\bno\s+va\b/,
  ];

  return wakePatterns.some((pattern) => pattern.test(normalized));
}

/*
 * Recognize emergency commands and common recognition variations.
 */
function containsEmergencyCommand(text) {
  const normalized = normalizeSpeech(text);

  const emergencyPatterns = [
    /\bhelp\b/,
    /\bhepl\b/,
    /\bhellp\b/,
    /\bhelp me\b/,
    /\bmedical help\b/,
    /\bmedical emergency\b/,
    /\bsend sos\b/,
    /\btrigger sos\b/,
    /\bemergency help\b/,
    /\bemergency\b/,
    /\bsos\b/,
    /\bcall ambulance\b/,
    /\bsend ambulance\b/,
    /\bambulance\b/,
    /\broad accident\b/,
    /\bcar accident\b/,
    /\bvehicle accident\b/,
    /\bheart attack\b/,
    /\bcardiac emergency\b/,
    /\bcannot breathe\b/,
    /\bcan't breathe\b/,
    /\bcan not breathe\b/,
    /\bbreathing difficulty\b/,
    /\bdifficulty breathing\b/,
    /\bshortness of breath\b/,
    /\bpregnancy emergency\b/,
    /\bfire emergency\b/,
  ];

  return emergencyPatterns.some((pattern) => pattern.test(normalized));
}

function inferEmergencyType(text) {
  const normalized = normalizeSpeech(text);
  if (/\b(cardiac|heart attack|stroke)\b/.test(normalized)) return "Cardiac Emergency";
  if (/\b(breath|breathing|respirat|cannot breathe|can't breathe)\b/.test(normalized)) return "Breathing Difficulty";
  if (/\b(pregnan|maternity|obstetric|childbirth|labou?r)\b/.test(normalized)) return "Pregnancy Emergency";
  if (/\b(accident|crash|collision)\b/.test(normalized)) return "Road Accident";
  if (/\bfire\b/.test(normalized)) return "Fire Emergency";
  if (/\bmedical\b/.test(normalized)) return "Medical Emergency";
  return null;
}

/*
 * Remove a wake phrase to identify a command spoken in the same sentence.
 */
function removeWakeWord(text) {
  return normalizeSpeech(text)
    .replace(
      /\b(hey|hi|hello|okay|ok)\s+(nova|noava|noova|noba|novah)\b/g,
      " "
    )
    .replace(/\b(nova|noava|noova|noba|novah)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function Home() {
  const navigate = useNavigate();

  const recognitionRef = useRef(null);
  const listeningRef = useRef(false);
  const triggeredRef = useRef(false);
  const mountedRef = useRef(false);
  const restartTimerRef = useRef(null);
  const armedRef = useRef(false);
  const manuallyStoppedRef = useRef(false);

  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(true);
  const [voiceMessage, setVoiceMessage] = useState(
    'Listening for "Hey Nova" or "Help"...'
  );
  const [wakeDetected, setWakeDetected] = useState(false);

  /*
   * Keep React state and refs synchronized.
   */
  const updateListening = useCallback((value) => {
    listeningRef.current = value;
    setListening(value);
  }, []);

  /*
   * Clear the automatic restart timer.
   */
  const clearRestartTimer = useCallback(() => {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  }, []);

  /*
   * Stop speech recognition safely.
   */
  const stopRecognition = useCallback(() => {
    clearRestartTimer();

    const recognition = recognitionRef.current;

    if (recognition) {
      try {
        recognition.stop();
      } catch {
        // Recognition may already be stopped.
      }
    }

    updateListening(false);
  }, [clearRestartTimer, updateListening]);

  /*
   * Trigger emergency navigation only once.
   */
  const triggerSOS = useCallback((recognizedText = "") => {
    if (triggeredRef.current) {
      return;
    }

    triggeredRef.current = true;
    armedRef.current = false;
    manuallyStoppedRef.current = true;

    setWakeDetected(false);
    setVoiceMessage("Emergency command detected. Opening SOS...");

    stopRecognition();

    navigate("/patient", {
      state: {
        startSOS: true,
        emergencyType: inferEmergencyType(recognizedText),
      },
    });
  }, [navigate, stopRecognition]);

  /*
   * Handle recognized speech.
   *
   * Help / Hepl:
   *   Trigger SOS immediately.
   *
   * Nova / Noava / Hey Nova:
   *   Activate the assistant and wait for a command.
   *
   * Hey Nova, Call Ambulance:
   *   Trigger SOS immediately.
   */
  const handleRecognizedSpeech = useCallback(
    (rawText) => {
      const text = normalizeSpeech(rawText);

      if (!text || triggeredRef.current) {
        return;
      }

      setVoiceMessage(`Heard: "${text}"`);

      // Direct emergency command without a wake phrase.
      if (containsEmergencyCommand(text)) {
        triggerSOS(text);
        return;
      }

      // Recognize Nova and similar pronunciations.
      if (containsWakeWord(text)) {
        armedRef.current = true;
        setWakeDetected(true);

        const remainingText = removeWakeWord(text);

        // Handle wake phrase and command spoken together.
        if (containsEmergencyCommand(remainingText)) {
          triggerSOS(remainingText);
          return;
        }

        setVoiceMessage(
          'Nova activated. Say "Help" or an emergency command.'
        );

        return;
      }

      // Nova has already been activated. Wait for the next command.
      if (armedRef.current) {
        setVoiceMessage(
          'Nova is ready. Say "Help" or an emergency command.'
        );
      }
    },
    [triggerSOS]
  );

  /*
   * Initialize browser speech recognition.
   */
  useEffect(() => {
    mountedRef.current = true;
    manuallyStoppedRef.current = false;

    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setVoiceSupported(false);

      setVoiceMessage(
        "Voice recognition is unavailable. Please use Chrome or Edge."
      );

      return () => {
        mountedRef.current = false;
      };
    }

    const recognition = new SpeechRecognition();

    recognition.lang = "en-IN";
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.maxAlternatives = 5;

    recognitionRef.current = recognition;

    recognition.onstart = () => {
      if (!mountedRef.current) {
        return;
      }

      updateListening(true);

      setVoiceMessage(
        armedRef.current
          ? 'Nova is ready. Say "Help".'
          : 'Listening for "Hey Nova" or "Help"...'
      );
    };

    recognition.onresult = (event) => {
      for (
        let i = event.resultIndex;
        i < event.results.length;
        i += 1
      ) {
        const result = event.results[i];

        if (!result.isFinal || triggeredRef.current) {
          continue;
        }

        /*
         * Check multiple recognition alternatives to improve
         * the chances of matching pronunciation variations.
         */
        const alternatives = [];

        for (let j = 0; j < result.length; j += 1) {
          alternatives.push(result[j].transcript || "");
        }

        const recognizedText = alternatives.find((transcript) => {
          const normalized = normalizeSpeech(transcript);

          return (
            containsWakeWord(normalized) ||
            containsEmergencyCommand(normalized)
          );
        });

        handleRecognizedSpeech(
          recognizedText || alternatives[0] || ""
        );

        if (triggeredRef.current) {
          return;
        }
      }
    };

    recognition.onerror = (event) => {
      if (!mountedRef.current) {
        return;
      }

      updateListening(false);

      if (
        event.error === "not-allowed" ||
        event.error === "service-not-allowed"
      ) {
        manuallyStoppedRef.current = true;

        setVoiceMessage(
          "Microphone access denied. Allow microphone access in Chrome."
        );
      } else if (event.error === "audio-capture") {
        setVoiceMessage(
          "No microphone detected. Check your microphone connection."
        );
      } else if (event.error === "no-speech") {
        setVoiceMessage(
          'No speech detected. Listening will restart automatically.'
        );
      } else if (event.error === "network") {
        setVoiceMessage(
          "Speech recognition network error. Check your internet connection."
        );
      } else if (event.error !== "aborted") {
        setVoiceMessage(
          `Voice recognition error: ${event.error}`
        );
      }
    };

    /*
     * Restart recognition when Chrome ends the session.
     * Do not restart after manual stop or SOS activation.
     */
    recognition.onend = () => {
      updateListening(false);

      if (
        !mountedRef.current ||
        triggeredRef.current ||
        manuallyStoppedRef.current
      ) {
        return;
      }

      clearRestartTimer();

      restartTimerRef.current = setTimeout(() => {
        restartTimerRef.current = null;

        if (
          !mountedRef.current ||
          triggeredRef.current ||
          manuallyStoppedRef.current ||
          listeningRef.current ||
          recognitionRef.current !== recognition
        ) {
          return;
        }

        try {
          recognition.start();
        } catch (error) {
          if (error.name !== "InvalidStateError") {
            setVoiceMessage(
              'Voice recognition stopped. Click "Start Listening" to resume.'
            );
          }
        }
      }, 800);
    };

    /*
     * Attempt automatic startup.
     * Some browsers require a user gesture first.
     */
    try {
      recognition.start();
    } catch {
      setVoiceMessage(
        'Click "Start Listening" to activate Nova.'
      );
    }

    return () => {
      mountedRef.current = false;
      manuallyStoppedRef.current = true;

      clearRestartTimer();

      recognition.onstart = null;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;

      try {
        recognition.abort();
      } catch {
        // Ignore cleanup errors.
      }

      recognitionRef.current = null;
    };
  }, [
    clearRestartTimer,
    handleRecognizedSpeech,
    updateListening,
  ]);

  /*
   * Manual listening control.
   */
  const startListening = () => {
    const recognition = recognitionRef.current;

    if (!recognition || listeningRef.current) {
      return;
    }

    triggeredRef.current = false;
    manuallyStoppedRef.current = false;
    armedRef.current = false;

    setWakeDetected(false);
    clearRestartTimer();

    try {
      recognition.start();

      setVoiceMessage(
        'Listening for "Hey Nova" or "Help"...'
      );
    } catch (error) {
      if (error.name === "InvalidStateError") {
        setVoiceMessage("Voice recognition is already starting.");
      } else {
        setVoiceMessage(
          "Could not start voice recognition. Please try again."
        );
      }
    }
  };

  const handleStopListening = () => {
    manuallyStoppedRef.current = true;
    armedRef.current = false;

    setWakeDetected(false);

    stopRecognition();

    setVoiceMessage(
      "Voice listening stopped. Use Start Listening to resume."
    );
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-5 py-12 text-white sm:px-6">
      {/* Background effects */}
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
          Connecting patients, ambulances, hospitals, and control
          rooms for faster emergency response.
        </p>

        {/* SOS button */}
        <div className="mx-auto mt-10 w-full max-w-md">
          <button
            type="button"
            onClick={() => triggerSOS()}
            className="group flex min-h-48 w-full flex-col items-center justify-center rounded-3xl border border-red-400/30 bg-gradient-to-br from-red-600 to-red-700 px-6 py-7 shadow-xl shadow-red-950/40 transition duration-200 hover:-translate-y-1 hover:from-red-500 hover:to-red-600 focus:outline-none focus:ring-4 focus:ring-red-400/40"
            aria-label="Trigger emergency SOS"
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10">
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
              <ArrowRight size={15} />
            </span>
          </button>

          {/* Voice assistant */}
          <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
            <div className="mb-3 flex items-center justify-center gap-2">
              <span
                className={`h-3 w-3 rounded-full ${
                  listening
                    ? "animate-pulse bg-cyan-400"
                    : voiceSupported
                    ? "bg-slate-500"
                    : "bg-red-500"
                }`}
              />

              <h2 className="text-2xl font-bold">
                Hey Nova
              </h2>
            </div>

            <p className="text-sm text-slate-400">
              Voice-activated emergency assistance
            </p>

            <p className="mt-4 text-sm font-medium text-cyan-300">
              {!voiceSupported
                ? "Voice recognition unavailable"
                : listening
                ? wakeDetected
                  ? "Nova activated. Listening for a command."
                  : "Listening for Hey Nova or Help"
                : "Voice assistant is not listening"}
            </p>

            <p
              role="status"
              aria-live="polite"
              className="mt-4 min-h-6 text-sm leading-6 text-slate-300"
            >
              {voiceMessage}
            </p>

            <button
              type="button"
              onClick={
                listening
                  ? handleStopListening
                  : startListening
              }
              disabled={!voiceSupported}
              className="mt-5 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-cyan-400/30 bg-slate-800 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {listening ? (
                <>
                  <MicOff size={18} />
                  Stop Listening
                </>
              ) : (
                <>
                  <Mic size={18} />
                  Start Listening
                </>
              )}
            </button>

            {/* Voice commands */}
            <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-left">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Voice Commands
              </p>

              <div className="space-y-2 text-sm leading-6 text-slate-300">
                <p>🎙️ "Help" → Request emergency assistance</p>
                <p>🎙️ "Hepl" → Request emergency assistance</p>
                <p>🎙️ "Nova" or "Noava" → Activate assistant</p>
                <p>🎙️ "Hey Nova" → Activate assistant</p>
                <p>🎙️ "Hey Noava, Medical Help"</p>
                <p>🎙️ "Hey Nova, Road Accident"</p>
                <p>🎙️ "Hey Nova, Call Ambulance"</p>
                <p>🎙️ "Hey Nova, Breathing Difficulty"</p>
              </div>
            </div>

            <p className="mt-4 text-xs leading-5 text-slate-500">
              Automatic startup is attempted when this page opens.
              Chrome may require a user gesture. Voice recognition
              may stop when the tab is backgrounded or the device
              is locked.
            </p>
          </div>

          {/* Staff login */}
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
