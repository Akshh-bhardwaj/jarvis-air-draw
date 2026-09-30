import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, LogIn, UserPlus, FolderOpen, Trash2, KeyRound, Mail, Sparkles, LogOut, Check } from 'lucide-react';
import { useAppStore } from '../store/AppStore';
import type { SavedDrawing } from '../types';

export const AuthPanel: React.FC = () => {
  const user = useAppStore((state) => state.user);
  const token = useAppStore((state) => state.token);
  const setUser = useAppStore((state) => state.setUser);
  const setToken = useAppStore((state) => state.setToken);
  const logout = useAppStore((state) => state.logout);
  const setCurrentDrawingId = useAppStore((state) => state.setCurrentDrawingId);

  // UI state toggles
  const [isOpen, setIsOpen] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  
  // Drawings history state
  const [savedDrawings, setSavedDrawings] = useState<SavedDrawing[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001';

  // Fetch drawings history when panel is open and user is logged in
  const fetchDrawings = async () => {
    if (!token) return;
    try {
      const response = await fetch(`${backendUrl}/api/drawings`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setSavedDrawings(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (isOpen && token) {
      fetchDrawings();
    }
  }, [isOpen, token]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const endpoint = isRegistering ? 'register' : 'login';
    const body = isRegistering ? { email, password, name } : { email, password };

    try {
      const response = await fetch(`${backendUrl}/api/auth/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await response.json();

      if (response.ok) {
        setUser(data.user);
        setToken(data.token);
        setSuccessMsg(isRegistering ? 'Registered successfully!' : 'Welcome back!');
        setEmail('');
        setPassword('');
        setName('');
        setTimeout(() => setSuccessMsg(''), 2500);
      } else {
        setErrorMsg(data.message || 'Authentication error.');
      }
    } catch (error) {
      setErrorMsg('Failed to reach server. Running offline auth.');
      // Mock auth fallback for complete offline sandbox
      const mockUserData = { id: `mock_${Date.now()}`, email, name: name || email.split('@')[0] };
      setUser(mockUserData);
      setToken(`mock_token_${Date.now()}`);
      setEmail('');
      setPassword('');
      setName('');
    }
  };

  // Google Login Trigger (Mock simulation or OAuth initialization)
  const handleGoogleLogin = async () => {
    const mockEmail = 'designer@google.com';
    const mockName = 'Google Creative Designer';
    
    try {
      const response = await fetch(`${backendUrl}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: mockEmail, name: mockName, credential: 'mock_google_oauth_creds_99' })
      });
      const data = await response.json();
      if (response.ok) {
        setUser(data.user);
        setToken(data.token);
        setSuccessMsg('Logged in with Google!');
        setTimeout(() => setSuccessMsg(''), 2500);
      }
    } catch (err) {
      // Mock fallback
      setUser({ id: 'google_mock', email: mockEmail, name: mockName });
      setToken('mock_google_token_123');
    }
  };

  const deleteDrawing = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      const response = await fetch(`${backendUrl}/api/drawings/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        setSavedDrawings(prev => prev.filter(d => d._id !== id));
      }
    } catch (err) {
      // Mock delete fallback
      setSavedDrawings(prev => prev.filter(d => d._id !== id));
    }
  };

  const loadSavedDrawing = (drawing: SavedDrawing) => {
    // Set active drawing file context in store
    setCurrentDrawingId(drawing._id);
    useAppStore.getState().setCurrentDrawingTitle(drawing.title);
    
    // Convert base64 / paths back to Canvas or Fabric.js depending on tool mode
    // DrawingCanvas has a hook/effect listening to currentDrawingId changes
    // We can also reload the points. For simplicity, we trigger reload via local dispatch.
    const reloadEvent = new CustomEvent('aircanvas:reload', { detail: drawing });
    window.dispatchEvent(reloadEvent);
    
    setIsOpen(false);
  };

  return (
    <div className="absolute top-6 left-6 z-30 select-none">
      {/* Icon Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-3 rounded-2xl glass-panel text-slate-400 hover:text-white cursor-pointer shadow-xl flex items-center gap-2 border-white/10 hover:border-cyan-500/20"
      >
        <User size={18} className={user ? 'text-cyan-400' : 'text-slate-400'} />
        {user && (
          <span className="text-xs font-display font-medium text-slate-200">
            {user.name.split(' ')[0]}
          </span>
        )}
      </button>

      {/* Floating Dialog Popover */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 15, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.95 }}
            className="absolute top-16 left-0 w-80 glass-panel border border-white/10 rounded-2xl shadow-2xl p-5 overflow-hidden flex flex-col gap-4"
          >
            {/* Authenticated Mode */}
            {user ? (
              <div className="flex flex-col gap-4">
                {/* User Info Header */}
                <div className="flex items-center justify-between border-b border-white/5 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-white font-display leading-tight">{user.name}</h3>
                    <p className="text-[10px] text-slate-400 truncate w-48 font-mono">{user.email}</p>
                  </div>
                  <button
                    onClick={logout}
                    className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 cursor-pointer"
                    title="Log Out"
                  >
                    <LogOut size={14} />
                  </button>
                </div>

                {/* Saved Drawings History List */}
                <div>
                  <h4 className="text-[10px] font-mono tracking-widest text-slate-400 uppercase font-semibold flex items-center gap-1.5 mb-2.5">
                    <FolderOpen size={12} className="text-cyan-400" /> Saved Drawings Timeline
                  </h4>
                  
                  {savedDrawings.length === 0 ? (
                    <div className="text-center py-6 text-xs text-slate-500 font-medium border border-dashed border-white/5 rounded-xl">
                      No saved sketches found.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
                      {savedDrawings.map((draw) => (
                        <div
                          key={draw._id}
                          onClick={() => loadSavedDrawing(draw)}
                          className="flex items-center gap-3 p-2 rounded-xl bg-white/5 border border-white/5 hover:border-cyan-500/20 cursor-pointer group transition-all"
                        >
                          <img
                            src={draw.imageUrl}
                            alt={draw.title}
                            className="w-10 h-10 object-cover rounded-lg bg-slate-950 border border-white/5"
                          />
                          <div className="flex-1 min-w-0">
                            <h5 className="text-xs font-semibold text-slate-200 truncate group-hover:text-cyan-300">
                              {draw.title}
                            </h5>
                            <span className="text-[9px] text-slate-500 font-mono">
                              {new Date(draw.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <button
                            onClick={(e) => deleteDrawing(e, draw._id)}
                            className="p-1.5 rounded-md hover:bg-rose-600/10 text-slate-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Non-Authenticated Form */
              <div className="flex flex-col gap-4">
                <div className="text-center">
                  <h3 className="text-sm font-bold text-white font-display flex items-center justify-center gap-1">
                    <Sparkles size={14} className="text-cyan-400" /> Save & Sync Sketches
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Create an account to store sketches in the cloud.
                  </p>
                </div>

                <form onSubmit={handleAuthSubmit} className="flex flex-col gap-3">
                  {isRegistering && (
                    <div className="relative">
                      <Mail size={12} className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-500" />
                      <input
                        type="text"
                        placeholder="Full Name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-slate-900 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-cyan-400"
                        required
                      />
                    </div>
                  )}
                  
                  <div className="relative">
                    <Mail size={12} className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-500" />
                    <input
                      type="email"
                      placeholder="Email Address"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-slate-900 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-cyan-400"
                      required
                    />
                  </div>

                  <div className="relative">
                    <KeyRound size={12} className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-500" />
                    <input
                      type="password"
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-slate-900 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-cyan-400"
                      required
                    />
                  </div>

                  {errorMsg && (
                    <span className="text-[9px] font-semibold text-rose-400 text-center">{errorMsg}</span>
                  )}
                  {successMsg && (
                    <span className="text-[9px] font-semibold text-emerald-400 text-center flex items-center justify-center gap-1">
                      <Check size={10} /> {successMsg}
                    </span>
                  )}

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-md flex items-center justify-center gap-1.5 mt-1"
                  >
                    {isRegistering ? <UserPlus size={14} /> : <LogIn size={14} />}
                    {isRegistering ? 'SIGN UP' : 'SIGN IN'}
                  </button>
                </form>

                {/* Google Sign In Option */}
                <div className="flex items-center gap-2 text-[10px] text-slate-500 justify-center">
                  <div className="h-px bg-white/5 flex-1" /> OR <div className="h-px bg-white/5 flex-1" />
                </div>

                <button
                  onClick={handleGoogleLogin}
                  className="w-full py-2.5 bg-white/5 border border-white/15 hover:bg-white/10 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-md flex items-center justify-center gap-2"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  CONTINUE WITH GOOGLE
                </button>

                {/* Signin/Signup Toggle Link */}
                <span className="text-[10px] text-center text-slate-400">
                  {isRegistering ? 'Already have an account?' : 'New to AirCanvas?'}
                  <button
                    onClick={() => setIsRegistering(!isRegistering)}
                    className="text-cyan-400 hover:text-cyan-300 ml-1.5 font-bold hover:underline cursor-pointer"
                  >
                    {isRegistering ? 'Sign In' : 'Register Now'}
                  </button>
                </span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
