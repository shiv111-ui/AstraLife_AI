
import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, AudioLines } from "lucide-react";

export default function VoiceAssistant({ onCommand }) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const [transcript, setTranscript] = useState("");
  const [message, setMessage] = useState("Tap the microphone to speak");

  const recognitionRef = useRef(null);
  const onCommandRef = useRef(onCommand);
  const listeningRef = useRef(false);

  useEffect(() => {
    onCommandRef.current = onCommand;
  }, [onCommand]);

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSupported(false);
      setMessage("Voice recognition is not supported. Use Chrome or Edge.");
      return;
    }

    const recognition = new SpeechRecognition();

    recognition.lang = "en-IN";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      listeningRef.current = true;
      setListening(true);
      setMessage("Listening... Speak now");
    };

    recognition.onresult = (event) => {
      const text =
        event.results[0][0].transcript.trim();

      setTranscript(text);

      if (!text) {
        setMessage("I could not hear you. Please try again.");
        return;
      }

      const result = interpretVoiceCommand(text);

      setMessage(`You said: "${text}". ${result.reply}`);

      if (result.command) {
        onCommandRef.current?.(result.command);
      }

      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(
          result.reply
        );

        utterance.lang = "en-IN";
        window.speechSynthesis.speak(utterance);
      }
    };

    recognition.onerror = (event) => {
      listeningRef.current = false;
      setListening(false);

      if (event.error === "not-allowed") {
        setMessage("Please allow microphone access in your browser.");
      } else if (event.error === "no-speech") {
        setMessage("No speech detected. Please try again.");
      } else {
        setMessage(`Voice recognition error: ${event.error}`);
      }
    };

    recognition.onend = () => {
      listeningRef.current = false;
      setListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      listeningRef.current = false;
      recognition.onstart = null;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.abort();
      window.speechSynthesis?.cancel();
    };
  }, []);

  const toggleListening = () => {
    const recognition = recognitionRef.current;

    if (!supported || !recognition) {
      setMessage("Voice recognition is unavailable.");
      return;
    }

    if (listeningRef.current) {
      recognition.stop();
      listeningRef.current = false;
      setListening(false);
      setMessage("Voice assistant stopped.");
      return;
    }

    setTranscript("");

    try {
      recognition.start();
    } catch {
      setMessage("Please wait a moment and try again.");
    }
  };

  return (
    <section className="flex min-h-[500px] w-full flex-col items-center justify-center overflow-hidden rounded-3xl border border-blue-400/20 bg-[#080d1c] px-6 py-10 text-center shadow-2xl">

      {/* Header */}

      <div className="mb-10">
        <div className="mb-3 flex items-center justify-center gap-3">
          <AudioLines className="h-7 w-7 text-cyan-400" />

          <h2 className="text-3xl font-bold text-white">
            Voice Assistant
          </h2>
        </div>

        <p className="text-sm text-slate-400">
          Your emergency assistance companion
        </p>
      </div>

      {/* Microphone button */}

      <div className="relative flex items-center justify-center">

        {listening && (
          <div className="absolute h-48 w-48 animate-ping rounded-full border-2 border-cyan-400/40" />
        )}

        <button
          type="button"
          onClick={toggleListening}
          disabled={!supported}
          aria-label={
            listening ? "Stop listening" : "Start listening"
          }
          aria-pressed={listening}
          className={`relative flex h-40 w-40 items-center justify-center rounded-full border-4 transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-50 sm:h-48 sm:w-48 ${
            listening
              ? "animate-pulse border-cyan-300 bg-gradient-to-br from-cyan-400 via-blue-600 to-purple-600 shadow-[0_0_80px_rgba(34,211,238,0.6)]"
              : "border-blue-400/50 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 shadow-[0_0_55px_rgba(79,70,229,0.4)] hover:scale-105 hover:shadow-[0_0_80px_rgba(34,211,238,0.5)]"
          }`}
        >
          {listening ? (
            <MicOff
              className="h-20 w-20 text-white"
              strokeWidth={1.5}
            />
          ) : (
            <Mic
              className="h-20 w-20 text-white"
              strokeWidth={1.5}
            />
          )}
        </button>
      </div>

      {/* Listening status */}

      <div className="mt-10">
        <div className="mb-4 flex items-center justify-center gap-2">
          <span
            className={`h-3 w-3 rounded-full ${
              listening
                ? "animate-pulse bg-cyan-400"
                : supported
                ? "bg-green-400"
                : "bg-red-400"
            }`}
          />

          <h3
            className={`text-lg font-semibold tracking-widest ${
              listening ? "text-cyan-300" : "text-white"
            }`}
          >
            {!supported
              ? "VOICE UNAVAILABLE"
              : listening
              ? "LISTENING..."
              : "READY TO HELP"}
          </h3>
        </div>

        <p
          role="status"
          aria-live="polite"
          className="mx-auto max-w-md text-sm leading-6 text-slate-400"
        >
          {message}
        </p>
      </div>

      {/* Recognized speech */}

      {transcript && (
        <div className="mt-6 w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900/80 p-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-cyan-400">
            Recognized Speech
          </p>

          <p className="break-words text-white">
            "{transcript}"
          </p>
        </div>
      )}

      {/* Example commands */}

      <div className="mt-10 max-w-md">
        <p className="mb-3 text-xs uppercase tracking-widest text-slate-500">
          Try saying
        </p>

        <p className="text-sm leading-7 text-slate-300">
          "Medical emergency"
          <br />
          "Critical severity"
          <br />
          "My name is Rahul"
          <br />
          "Two victims"
        </p>
      </div>

      {!supported && (
        <p className="mt-5 text-sm text-amber-300">
          Open this project in Chrome or Edge and allow microphone access.
        </p>
      )}
    </section>
  );
}

function interpretVoiceCommand(rawText) {
  const text = rawText
    .toLowerCase()
    .replace(/[.,!?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (
    text.includes("road accident") ||
    text.includes("car accident") ||
    text.includes("vehicle accident") ||
    text.includes("accident")
  ) {
    return {
      command: { emergencyType: "Road Accident" },
      reply: "I selected Road Accident.",
    };
  }

  if (text.includes("cardiac") || text.includes("heart attack")) {
    return {
      command: { emergencyType: "Cardiac Emergency" },
      reply: "I selected Cardiac Emergency.",
    };
  }

  if (
    text.includes("breathing difficulty") ||
    text.includes("difficulty breathing") ||
    text.includes("shortness of breath") ||
    text.includes("cannot breathe") ||
    text.includes("can't breathe")
  ) {
    return {
      command: { emergencyType: "Breathing Difficulty" },
      reply: "I selected Breathing Difficulty.",
    };
  }

  if (text.includes("pregnancy")) {
    return {
      command: { emergencyType: "Pregnancy Emergency" },
      reply: "I selected Pregnancy Emergency.",
    };
  }

  if (text.includes("fire")) {
    return {
      command: { emergencyType: "Fire Emergency" },
      reply: "I selected Fire Emergency.",
    };
  }

  if (text.includes("medical")) {
    return {
      command: { emergencyType: "Medical Emergency" },
      reply: "I selected Medical Emergency.",
    };
  }

  if (text.includes("critical severity") || text === "critical") {
    return {
      command: { severity: "Critical" },
      reply: "I set the severity to Critical.",
    };
  }

  if (text.includes("high severity") || text === "high") {
    return {
      command: { severity: "High" },
      reply: "I set the severity to High.",
    };
  }

  if (text.includes("moderate severity") || text === "moderate") {
    return {
      command: { severity: "Moderate" },
      reply: "I set the severity to Moderate.",
    };
  }

  const nameMatch = text.match(
    /\b(?:my name is|patient name is|name is)\s+(.+)/i
  );

  if (nameMatch) {
    const name = nameMatch[1]
      .trim()
      .replace(/\b(and|phone number|severity)\b.*$/i, "")
      .trim();

    if (name) {
      const patientName = toTitleCase(name);

      return {
        command: { patientName },
        reply: `I entered the name ${patientName}.`,
      };
    }
  }

  if (
    text.includes("phone number") ||
    text.includes("mobile number") ||
    text.includes("contact number") ||
    text.includes("my number is")
  ) {
    const phoneMatch = text.match(/\d[\d\s-]{8,}/);

    if (phoneMatch) {
      const phone = phoneMatch[0].replace(/\D/g, "");

      if (phone.length === 10) {
        return {
          command: { phone },
          reply: "I entered the phone number. Please verify it.",
        };
      }
    }

    return {
      command: null,
      reply: "Please say a valid 10-digit phone number.",
    };
  }

  if (
    text.includes("unknown victim count") ||
    text.includes("victim count unknown")
  ) {
    return {
      command: { victimCount: "Unknown" },
      reply: "I set the victim count to Unknown.",
    };
  }

  if (
    text.includes("one victim") ||
    text.includes("one person") ||
    text === "one"
  ) {
    return {
      command: { victimCount: "1" },
      reply: "I set the victim count to one.",
    };
  }

  if (
    text.includes("two victims") ||
    text.includes("two people") ||
    text === "two"
  ) {
    return {
      command: { victimCount: "2" },
      reply: "I set the victim count to two.",
    };
  }

  if (
    text.includes("three victims") ||
    text.includes("three people") ||
    text === "three"
  ) {
    return {
      command: { victimCount: "3" },
      reply: "I set the victim count to three.",
    };
  }

  if (
    text.includes("four victims") ||
    text.includes("four people") ||
    text === "four"
  ) {
    return {
      command: { victimCount: "4" },
      reply: "I set the victim count to four.",
    };
  }

  if (
    text.includes("five victims") ||
    text.includes("five people") ||
    text === "five"
  ) {
    return {
      command: { victimCount: "5+" },
      reply: "I set the victim count to five or more.",
    };
  }

  return {
    command: null,
    reply:
      "Command not recognized. Try an emergency type, severity, patient name, phone number, or victim count.",
  };
}

function toTitleCase(value) {
  return value.replace(/\b[a-z]/g, (letter) =>
    letter.toUpperCase()
  );
}
