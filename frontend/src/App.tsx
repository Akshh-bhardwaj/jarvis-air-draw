import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Mic,
  MicOff,
  ScanText,
  Globe,
  Users
} from 'lucide-react';

import { useAppStore } from './store/AppStore';
import { DrawingCanvas } from './components/DrawingCanvas';
import { Whiteboard } from './components/Whiteboard';
import { ThreeCanvas } from './components/ThreeCanvas';
import { FloatingToolbar } from './components/FloatingToolbar';
import { WebcamPreview } from './components/WebcamPreview';
import { SettingsPanel } from './components/SettingsPanel';
import { AuthPanel } from './components/AuthPanel';
import { recognizeHandwriting } from './utils/handwritingRecognizer';
import { jarvis } from './utils/voiceFeedback';
import { drawShapeFromVoice } from './utils/shapeGenerator';

function App() {
  // ── Zustand state ──────────────────────────────────────────────────────────
  const theme           = useAppStore((s) => s.theme);
  const activeTool      = useAppStore((s) => s.activeTool);
  const is3DMode        = useAppStore((s) => s.is3DMode);
  const roomId          = useAppStore((s) => s.roomId);
  const isCollaborating = useAppStore((s) => s.isCollaborating);
  const collaborators   = useAppStore((s) => s.collaborators);
  const brushSize       = useAppStore((s) => s.brushSize);
  const setActiveBrush  = useAppStore((s) => s.setActiveBrush);
  const setBrushColor   = useAppStore((s) => s.setBrushColor);
  const setBrushSize    = useAppStore((s) => s.setBrushSize);
  const setActiveTool   = useAppStore((s) => s.setActiveTool);
  const set3DMode       = useAppStore((s) => s.set3DMode);

  // ── Local state ────────────────────────────────────────────────────────────
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [isVoiceOn, setIsVoiceOn]           = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [ocrText, setOcrText]               = useState<string | null>(null);
  const [isOcrLoading, setIsOcrLoading]     = useState(false);

  // keep brushSize accessible inside the voice handler without stale closure
  const brushSizeRef = useRef(brushSize);
  useEffect(() => { brushSizeRef.current = brushSize; }, [brushSize]);

  // ── Apply theme ────────────────────────────────────────────────────────────
  useEffect(() => {
    const root = document.documentElement;
    root.className = '';
    root.classList.add(`theme-${theme}`);
  }, [theme]);

  // ── Process a voice command string ────────────────────────────────────────
  const handleVoiceCommand = (command: string) => {
    console.log('[Voice]', command);
    setVoiceTranscript(command);
    setTimeout(() => setVoiceTranscript(''), 2500);

    // ── Canvas actions ──────────────────────────────────────────────────────
    if (command.includes('clear') || command.includes('erase all')) {
      window.dispatchEvent(new CustomEvent('aircanvas:clear'));
      // jarvis.clear() is called inside DrawingCanvas on the event
      return;
    }
    if (command.includes('undo')) {
      const btn = document.querySelector('[title="Undo"]') as HTMLButtonElement;
      btn?.click();
      jarvis.undo();
      return;
    }
    if (command.includes('redo')) {
      const btn = document.querySelector('[title="Redo"]') as HTMLButtonElement;
      btn?.click();
      jarvis.redo();
      return;
    }
    if (command.includes('save') || command.includes('download')) {
      const btn = document.querySelector('[title="Save / Download"]') as HTMLButtonElement;
      btn?.click();
      // jarvis.saved() fires inside DrawingCanvas when the API responds
      return;
    }

    // ── Brush type ──────────────────────────────────────────────────────────
    if (command.includes('neon'))        { setActiveBrush('neon');        jarvis.brushChange('neon');        return; }
    if (command.includes('pencil'))      { setActiveBrush('pencil');      jarvis.brushChange('pencil');      return; }
    if (command.includes('marker'))      { setActiveBrush('marker');      jarvis.brushChange('marker');      return; }
    if (command.includes('spray'))       { setActiveBrush('spray');       jarvis.brushChange('spray');       return; }
    if (command.includes('highlighter')) { setActiveBrush('highlighter'); jarvis.brushChange('highlighter'); return; }
    if (command.includes('calligraphy')) { setActiveBrush('calligraphy'); jarvis.brushChange('calligraphy'); return; }
    if (command.includes('eraser'))      { setActiveBrush('eraser');      jarvis.erasing();                  return; }

    // ── Brush size ──────────────────────────────────────────────────────────
    if (command.includes('bigger brush') || command.includes('increase brush') || command.includes('brush up')) {
      const next = Math.min(50, brushSizeRef.current + 5);
      setBrushSize(next);
      jarvis.brushBigger(next);
      return;
    }
    if (command.includes('smaller brush') || command.includes('decrease brush') || command.includes('brush down')) {
      const next = Math.max(2, brushSizeRef.current - 5);
      setBrushSize(next);
      jarvis.brushSmaller(next);
      return;
    }

    // ── Color ───────────────────────────────────────────────────────────────
    if (command.includes('red'))    { setBrushColor('#FF003C'); jarvis.colorChange('red');    return; }
    if (command.includes('cyan') || command.includes('blue')) {
                                      setBrushColor('#00F0FF'); jarvis.colorChange('cyan');   return; }
    if (command.includes('green'))  { setBrushColor('#39FF14'); jarvis.colorChange('green');  return; }
    if (command.includes('yellow')) { setBrushColor('#FFEF00'); jarvis.colorChange('yellow'); return; }
    if (command.includes('white'))  { setBrushColor('#FFFFFF'); jarvis.colorChange('white');  return; }
    if (command.includes('purple')) { setBrushColor('#A855F7'); jarvis.colorChange('purple'); return; }
    if (command.includes('orange')) { setBrushColor('#F97316'); jarvis.colorChange('orange'); return; }
    if (command.includes('pink'))   { setBrushColor('#EC4899'); jarvis.colorChange('pink');   return; }
    if (command.includes('black'))  { setBrushColor('#000000'); jarvis.colorChange('black');  return; }

    // ── Draw shapes from voice ──────────────────────────────────────────────
    // "draw a circle", "make a triangle on the right", "add a square at the top"
    if (command.includes('draw') || command.includes('make') || command.includes('add')) {
      const shapeCmd = command.replace(/(draw|make|add)\s+/, '').trim();
      if (shapeCmd.includes('circle') || shapeCmd.includes('square') || shapeCmd.includes('triangle') ||
          shapeCmd.includes('rectangle') || shapeCmd.includes('line') || shapeCmd.includes('arrow') ||
          shapeCmd.includes('polygon')) {
        // Dispatch event — DrawingCanvas will listen and draw the shape
        window.dispatchEvent(new CustomEvent('aircanvas:shape', {
          detail: { command: shapeCmd }
        }));
        return;
      }
    }

    // ── Mode switching ──────────────────────────────────────────────────────
    if (command.includes('3d') || command.includes('three d')) {
      set3DMode(true); jarvis.modeChange('3D sculpting'); return;
    }
    if (command.includes('whiteboard')) {
      setActiveTool('select'); jarvis.modeChange('Whiteboard'); return;
    }
    if (command.includes('drawing mode') || command.includes('draw mode') || command.includes('air draw')) {
      setActiveTool('draw'); jarvis.modeChange('Air drawing'); return;
    }

    // ── Help ────────────────────────────────────────────────────────────────
    if (command.includes('help') || command.includes('what can you do') || command.includes('commands')) {
      jarvis.help(); return;
    }

    // ── Unrecognised — give gentle feedback ─────────────────────────────────
    // (no jarvis call here to avoid noise on partial transcripts)
  };

  // ── Active voice command recognition ──────────────────────────────────────
  useEffect(() => {
    if (!isVoiceOn) return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      jarvis.notSupported();
      setIsVoiceOn(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous     = true;
    recognition.interimResults = false;
    recognition.lang           = 'en-US';

    recognition.onresult = (event: any) => {
      const result  = event.results[event.results.length - 1];
      const command = result[0].transcript.trim().toLowerCase();
      handleVoiceCommand(command);
    };

    recognition.onerror = (e: any) => {
      console.error('[SpeechRecognition error]', e.error);
    };

    recognition.start();
    return () => recognition.stop();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVoiceOn]);

  // ── Always-on wake word listener ("hey jarvis" / "hey canvas") ────────────
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const wake = new SpeechRecognition();
    wake.continuous     = true;
    wake.interimResults = true;
    wake.lang           = 'en-US';

    wake.onresult = (event: any) => {
      const transcript = Array.from(event.results as SpeechRecognitionResultList)
        .map((r) => r[0].transcript)
        .join(' ')
        .toLowerCase();

      if (transcript.includes('hey jarvis') || transcript.includes('hey canvas')) {
        if (!isVoiceOn) {
          setIsVoiceOn(true);
          jarvis.wakeWord();
        }
      }
      if (transcript.includes('stop listening') || transcript.includes('go to sleep')) {
        setIsVoiceOn(false);
        jarvis.voiceOff();
      }
    };

    wake.onerror = () => { /* ignore — wake word listener runs silently */ };

    wake.start();
    return () => wake.stop();
  // We intentionally don't re-run on isVoiceOn change to keep the wake listener alive
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Toggle voice on/off from the button ───────────────────────────────────
  const toggleVoice = () => {
    if (!isVoiceOn) {
      setIsVoiceOn(true);
      jarvis.voiceOn();
    } else {
      setIsVoiceOn(false);
      jarvis.voiceOff();
    }
  };

  // ── Handwriting OCR ───────────────────────────────────────────────────────
  const triggerOcrScan = async () => {
    const canvas = document.querySelector('canvas') as HTMLCanvasElement;
    if (!canvas) return;
    try {
      setIsOcrLoading(true);
      setOcrText(null);
      const recognized = await recognizeHandwriting(canvas);
      const result = recognized.trim() || 'Could not recognize any legible text.';
      setOcrText(result);
      jarvis.ocr(result);
    } catch (e) {
      console.error(e);
      setOcrText('OCR Service failed. Ensure drawing is clear.');
    } finally {
      setIsOcrLoading(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="relative w-full h-full overflow-hidden text-slate-100 flex flex-col font-sans">

      {/* ── Onboarding splash ── */}
      <AnimatePresence>
        {showOnboarding && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-950/90 z-50 flex flex-col items-center justify-center select-none"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} transition={{ delay: 0.15 }}
              className="max-w-2xl px-8 py-10 rounded-3xl glass-panel border-white/10 shadow-2xl flex flex-col items-center text-center gap-6"
            >
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-400/20 text-cyan-300 accent-glow-effect">
                <Sparkles size={16} className="animate-spin" />
                <span className="text-xs font-mono font-bold tracking-widest uppercase">Spatial Creative Engine</span>
              </div>
              <div>
                <h1 className="text-4xl font-extrabold font-display tracking-tight text-white leading-none bg-gradient-to-r from-cyan-400 to-indigo-300 bg-clip-text text-transparent">
                  AirCanvas AI
                </h1>
                <p className="text-sm text-slate-400 mt-3.5 max-w-lg leading-relaxed">
                  Draw in mid-air with your hands. Control everything with your voice. Say "Hey Jarvis" to activate.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-4 w-full border-t border-white/5 pt-6 mt-2">
                {[
                  { emoji: '☝️', title: 'Index finger', sub: 'Draw paths' },
                  { emoji: '✌️', title: 'Victory sign',  sub: 'Undo stroke' },
                  { emoji: '✊', title: 'Closed fist',   sub: 'Clear canvas' },
                ].map((g) => (
                  <div key={g.title} className="flex flex-col items-center gap-1">
                    <span className="text-2xl">{g.emoji}</span>
                    <span className="text-xs font-semibold text-white">{g.title}</span>
                    <span className="text-[10px] text-slate-400">{g.sub}</span>
                  </div>
                ))}
              </div>
              <div className="text-xs text-slate-500 border border-white/5 rounded-xl px-4 py-2 font-mono">
                💬 Voice: "clear" · "undo" · "neon" · "red" · "bigger brush" · "help"
              </div>
              <button
                onClick={() => { setShowOnboarding(false); jarvis.ready(); }}
                className="mt-2 px-8 py-3.5 bg-cyan-600 hover:bg-cyan-500 hover:scale-105 active:scale-100 text-white rounded-2xl text-sm font-bold tracking-wider cursor-pointer shadow-lg hover:shadow-cyan-500/20 transition-all"
              >
                ENTER SPATIAL WORKSPACE
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Header ── */}
      <header className="absolute top-6 left-6 right-6 h-14 z-20 flex items-center justify-between pointer-events-none select-none">
        <div className="flex items-center gap-2.5 px-5 h-full rounded-2xl glass-panel border-white/10 shadow-lg pointer-events-auto">
          <span className="text-base font-extrabold tracking-tight font-display bg-gradient-to-r from-cyan-400 to-indigo-300 bg-clip-text text-transparent">
            AirCanvas AI
          </span>
          <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-400/20 text-[9px] font-mono text-cyan-300 font-bold uppercase">
            {is3DMode ? '3D' : activeTool === 'draw' ? '2D Draw' : 'Whiteboard'}
          </span>
        </div>

        <div className="flex items-center gap-3 h-full pointer-events-auto">
          {/* OCR button */}
          <button
            onClick={triggerOcrScan}
            disabled={isOcrLoading}
            className={`px-4 h-full rounded-2xl font-display font-medium text-xs tracking-wider glass-button text-cyan-300 border-cyan-500/20 hover:border-cyan-400 cursor-pointer shadow-md flex items-center gap-2 ${isOcrLoading ? 'opacity-50 cursor-wait' : ''}`}
          >
            <ScanText size={14} />
            {isOcrLoading ? 'SCANNING…' : 'HANDWRITING OCR'}
          </button>

          {/* Voice toggle */}
          <button
            onClick={toggleVoice}
            className={`px-4 h-full rounded-2xl font-display font-medium text-xs tracking-wider glass-button cursor-pointer shadow-md flex items-center gap-2 ${
              isVoiceOn
                ? 'bg-rose-500/20 text-rose-300 border border-rose-400/40 animate-pulse'
                : 'text-slate-300 border-white/10 hover:border-white/20'
            }`}
            title="Voice Commands — or say 'Hey Jarvis'"
          >
            {isVoiceOn ? <Mic size={14} /> : <MicOff size={14} />}
            VOICE {isVoiceOn ? 'ON' : 'OFF'}
          </button>

          {/* Collaboration badge */}
          {isCollaborating && roomId && (
            <div className="flex items-center gap-2.5 px-4 h-full rounded-2xl glass-panel border-cyan-500/20 shadow-lg text-xs font-display font-medium text-cyan-300">
              <Globe size={13} className="text-cyan-400" />
              <span>Room: <span className="font-mono text-white">{roomId}</span></span>
              <div className="h-4 w-px bg-white/10" />
              <Users size={13} className="text-cyan-400" />
              <span>{collaborators.length + 1} users</span>
            </div>
          )}
        </div>
      </header>

      {/* ── Voice transcript HUD ── */}
      {voiceTranscript && (
        <div className="absolute top-24 right-6 z-30 flex items-center gap-2 px-4 py-2.5 rounded-xl glass-panel border-rose-500/20 text-rose-300 text-xs font-mono font-bold shadow-lg">
          <Mic size={12} className="animate-ping" />
          <span>"{voiceTranscript}"</span>
        </div>
      )}

      {/* ── OCR modal ── */}
      <AnimatePresence>
        {ocrText && (
          <div className="absolute inset-0 z-40 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="w-96 p-6 rounded-3xl glass-panel border border-white/15 shadow-2xl flex flex-col gap-4 text-white"
            >
              <h3 className="text-sm font-bold font-display tracking-wide text-cyan-300">OCR Handwriting Result</h3>
              <div className="p-4 bg-slate-900/80 border border-white/5 rounded-2xl min-h-[80px] text-xs font-mono text-slate-200 break-words leading-relaxed select-text">
                {ocrText}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => navigator.clipboard.writeText(ocrText)}
                  className="flex-1 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-md"
                >
                  COPY TEXT
                </button>
                <button
                  onClick={() => setOcrText(null)}
                  className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  CLOSE
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Main canvas area ── */}
      <main className="flex-1 w-full h-full relative">
        {is3DMode ? (
          <ThreeCanvas />
        ) : activeTool === 'draw' || activeTool === 'laser' ? (
          <DrawingCanvas videoWidth={640} videoHeight={480} />
        ) : (
          <Whiteboard />
        )}
      </main>

      {/* ── Overlays ── */}
      <AuthPanel />
      <FloatingToolbar />
      <WebcamPreview />
      <SettingsPanel />
    </div>
  );
}

export default App;
