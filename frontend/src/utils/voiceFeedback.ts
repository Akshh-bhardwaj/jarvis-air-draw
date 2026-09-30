// Jarvis-style Text-to-Speech feedback utility
// Uses Web Speech Synthesis API — works in Chrome, Edge, Safari

let voicesLoaded = false;
let preferredVoice: SpeechSynthesisVoice | null = null;

// Load and cache a deep/robotic voice preference
const loadVoice = () => {
  if (voicesLoaded) return;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return; // Not ready yet

  // Preference order: deep male voices → any English voice → first available
  preferredVoice =
    voices.find((v) => v.name === 'Google UK English Male') ||
    voices.find((v) => v.name === 'Daniel') ||          // macOS
    voices.find((v) => v.name === 'Alex') ||            // macOS fallback
    voices.find((v) => /english/i.test(v.name) && /male/i.test(v.name)) ||
    voices.find((v) => v.lang === 'en-US') ||
    voices[0] ||
    null;

  voicesLoaded = true;
};

// speechSynthesis voices load asynchronously on first use
window.speechSynthesis.onvoiceschanged = loadVoice;
loadVoice();

/**
 * Core speak function — cancels any ongoing speech and speaks the new text.
 * @param text   The text to speak
 * @param rate   Speech rate (0.1–2.0), default 0.92 — slightly slower than normal for clarity
 * @param pitch  Pitch (0–2), default 0.85 — slightly lower for that Jarvis feel
 */
export const speak = (text: string, rate = 0.92, pitch = 0.85): void => {
  if (!window.speechSynthesis) return;

  // Lazy-load voice if it wasn't ready at init
  if (!voicesLoaded) loadVoice();

  window.speechSynthesis.cancel(); // cut off any current speech immediately

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = rate;
  utterance.pitch = pitch;
  utterance.volume = 1.0;

  if (preferredVoice) {
    utterance.voice = preferredVoice;
  }

  window.speechSynthesis.speak(utterance);
};

/**
 * Jarvis — pre-built responses for every app action.
 * Call these instead of raw speak() for consistent personality.
 */
export const jarvis = {
  // System
  ready:          () => speak('AirCanvas ready. Awaiting your command.', 0.9, 0.8),
  voiceOn:        () => speak("Voice control activated. I'm listening.", 0.92, 0.85),
  voiceOff:       () => speak('Voice control deactivated.', 0.92, 0.85),
  wakeWord:       () => speak('Yes? I am listening.', 0.95, 0.9),
  notSupported:   () => speak('Speech recognition is not supported in this browser. Please use Chrome.'),

  // Canvas actions
  clear:          () => speak('Canvas cleared.'),
  undo:           () => speak('Undone.'),
  redo:           () => speak('Redone.'),
  saved:          () => speak('Drawing saved to the cloud.'),
  erasing:        () => speak('Eraser mode activated.'),

  // Brush
  brushChange:    (brush: string) => speak(`Switched to ${brush} brush.`),
  brushBigger:    (size: number)  => speak(`Brush size increased to ${size}.`),
  brushSmaller:   (size: number)  => speak(`Brush size decreased to ${size}.`),

  // Color
  colorChange:    (color: string) => speak(`Color set to ${color}.`),

  // Mode
  modeChange:     (mode: string)  => speak(`${mode} mode activated.`),

  // AI Classification
  classified:     (label: string, confidence: number) =>
    speak(`That looks like a ${label}, ${confidence} percent confidence.`),

  // OCR
  ocr:            (text: string)  =>
    speak(text.length > 80 ? 'Handwriting recognized. Check the result panel.' : `I found: ${text}`),

  // Help
  help: () =>
    speak(
      'You can say: clear, undo, redo, save, neon, pencil, marker, spray, ' +
      'red, blue, green, yellow, white, purple, orange, pink, ' +
      'bigger brush, smaller brush, switch to 3D, switch to whiteboard, or help.'
    ),

  // Gesture feedback (short, non-intrusive)
  gestureDetected: (gesture: string) => speak(gesture, 1.1, 1.0),
};
