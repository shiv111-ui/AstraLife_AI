/**
 * VoiceSOSButton.jsx
 *
 * Voice-activated emergency detection using the Web Speech API.
 *
 * DESIGN PRINCIPLES:
 *  - Microphone permission is asked only when the user explicitly presses
 *    the "Voice SOS" button.
 *  - Detected phrases trigger a visible CONFIRMATION dialog before any
 *    emergency is created.
 *  - If the browser does not support SpeechRecognition the button is hidden
 *    and the normal SOS button remains fully functional.
 *  - No audio is transmitted to any server. Speech recognition runs locally
 *    in the browser.
 *  - The component does NOT create the emergency itself — it calls the
 *    onConfirmed() callback provided by the parent (PatientDashboard), which
 *    uses the same startSOS() path as the regular SOS button.
 *
 * SUPPORTED PHRASES (case-insensitive, partial match):
 *   "emergency", "help me", "call an ambulance", "need an ambulance",
 *   "medical emergency", "sos", "i need help"
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, X, AlertTriangle } from "lucide-react";

const EMERGENCY_PHRASES = [
  "emergency",
  "help me",
  "call an ambulance",
  "need an ambulance",
  "i need an ambulance",
  "medical emergency",
  "sos",
  "i need help",
];

function isSpeechSupported() {
  return typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);
}

function createRecognition() {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = "en-IN";
  recognition.maxAlternatives = 3;
  return recognition;
}

function detectPhrase(transcript) {
  const lower = transcript.toLowerCase().trim();
  return EMERGENCY_PHRASES.some((phrase) => lower.includes(phrase));
}

/**
 * @param {function} onConfirmed — called with no arguments when the user
 *   confirms the voice-detected emergency.
 */
export default function VoiceSOSButton({ onConfirmed }) {
  const [supported] = useState(isSpeechSupported);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const recognitionRef = useRef(null);
  const listeningRef = useRef(false);

  // Stop recognition cleanly on unmount.
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
    };
  }, []);

  const stopListening = useCallback(() => {
    listeningRef.current = false;
    setListening(false);
    setTranscript("");
    setStatusMessage("");
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }
  }, []);

  const startListening = useCallback(() => {
    if (!supported) return;
    if (listeningRef.current) {
      stopListening();
      return;
    }

    setPermissionDenied(false);
    setStatusMessage("Requesting microphone permission…");
    setTranscript("");

    let phraseDetected = false;

    const recognition = createRecognition();
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      if (listeningRef.current) {
        setListening(true);
        setStatusMessage("Listening for emergency phrase…");
      }
    };

    recognition.onresult = (event) => {
      let latestTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const alt = result[0]?.transcript || "";
        latestTranscript = alt;
      }

      setTranscript(latestTranscript);

      if (!phraseDetected && detectPhrase(latestTranscript)) {
        phraseDetected = true;
        try { recognition.stop(); } catch {}
        listeningRef.current = false;
        setListening(false);
        setStatusMessage("Emergency phrase detected!");
        setShowConfirm(true);
      }
    };

    recognition.onerror = (event) => {
      listeningRef.current = false;
      setListening(false);
      recognitionRef.current = null;

      if (event.error === "not-allowed" || event.error === "permission-denied") {
        setPermissionDenied(true);
        setStatusMessage("Microphone permission denied. Use the SOS button below.");
      } else if (event.error === "no-speech") {
        setStatusMessage("No speech detected. Tap the mic again to retry.");
      } else {
        setStatusMessage(`Speech recognition error: ${event.error}`);
      }
    };

    recognition.onend = () => {
      if (listeningRef.current) {
        // Auto-restart if user hasn't stopped manually (continuous workaround)
        try { recognition.start(); } catch {}
      }
    };

    listeningRef.current = true;
    try {
      recognition.start();
    } catch (error) {
      listeningRef.current = false;
      setStatusMessage(`Could not start recognition: ${error.message}`);
    }
  }, [supported, stopListening]);

  function handleConfirm() {
    setShowConfirm(false);
    stopListening();
    onConfirmed();
  }

  function handleCancel() {
    setShowConfirm(false);
    setStatusMessage("Emergency cancelled. Press the mic again to listen.");
    setTranscript("");
  }

  // Don't render anything if unsupported.
  if (!supported) return null;

  return (
    <div className="mt-4">
      {/* Voice SOS button */}
      <button
        type="button"
        onClick={startListening}
        disabled={showConfirm}
        aria-label={listening ? "Stop voice listening" : "Start voice SOS"}
        className={`flex w-full items-center justify-center gap-3 rounded-xl border px-5 py-3.5 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-cyan-400/40 disabled:opacity-60 ${
          listening
            ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20"
            : permissionDenied
            ? "border-slate-700 bg-slate-800/50 text-slate-400"
            : "border-slate-700 bg-slate-900/70 text-slate-300 hover:border-cyan-500/40 hover:text-white"
        }`}
      >
        {listening ? (
          <>
            <span className="relative flex h-5 w-5 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-50" />
              <Mic size={20} className="relative text-cyan-300" />
            </span>
            <span>
              Voice Listening
              <span className="ml-2 font-normal text-slate-400">
                (tap to stop)
              </span>
            </span>
          </>
        ) : (
          <>
            {permissionDenied ? (
              <MicOff size={20} className="shrink-0 text-slate-400" />
            ) : (
              <Mic size={20} className="shrink-0 text-cyan-400" />
            )}
            <span>Voice SOS</span>
          </>
        )}
      </button>

      {/* Status message */}
      {statusMessage && !showConfirm && (
        <p
          className={`mt-2 text-center text-xs leading-5 ${
            permissionDenied ? "text-amber-400" : "text-slate-400"
          }`}
        >
          {statusMessage}
        </p>
      )}

      {/* Live transcript */}
      {listening && transcript && (
        <p className="mt-2 text-center text-xs italic text-slate-500">
          "{transcript}"
        </p>
      )}

      {/* Confirmation overlay */}
      {showConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="voice-confirm-title"
          className="mt-4 rounded-2xl border border-red-500/40 bg-red-500/10 p-5"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle
              size={22}
              className="mt-0.5 shrink-0 text-red-300"
            />
            <div className="flex-1">
              <h3
                id="voice-confirm-title"
                className="font-bold text-red-200"
              >
                Emergency phrase detected
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                We heard an emergency phrase. Do you want to send an SOS
                and share your location with emergency services?
              </p>
              <div className="mt-4 flex gap-3">
                <button
                  type="button"
                  id="voice-confirm-yes"
                  onClick={handleConfirm}
                  className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-bold text-white hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-400"
                >
                  Yes, Send SOS
                </button>
                <button
                  type="button"
                  id="voice-confirm-cancel"
                  onClick={handleCancel}
                  className="flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:bg-slate-700"
                >
                  <X size={15} />
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hint text */}
      {!listening && !showConfirm && !permissionDenied && (
        <p className="mt-2 text-center text-xs text-slate-600">
          Say &quot;Emergency&quot;, &quot;Help me&quot; or &quot;Call an ambulance&quot;
        </p>
      )}
    </div>
  );
}
