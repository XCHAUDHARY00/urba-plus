'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { auth, db } from '@/lib/firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { logSecurityEvent } from '@/lib/audit';
import { SAMPLE_ACCOUNTS, SampleAccount } from '@/lib/sampleAccounts';
import CivicLogo from '@/components/CivicLogo';
import {
  Building2,
  Shield,
  User,
  Loader2,
  LogOut,
  ArrowRight,
  Mail,
  Lock,
  UserPlus,
  LogIn,
  Key,
  ShieldCheck,
  Check,
  Trophy,
  Sparkles,
  Camera,
  MapPin,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  X,
  Video,
  Settings,
  ChevronRight,
  Flame,
  Radio,
} from 'lucide-react';

export default function UrbaPlusLandingPage() {
  const router = useRouter();

  // Auth & Session State
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [existingRole, setExistingRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [signupRole, setSignupRole] = useState<'citizen' | 'authority'>('citizen');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  // Full-Screen Video State
  const [videoUrl, setVideoUrl] = useState<string>(
    // Default high-quality modern smart city / municipal infrastructure video
    'https://assets.mixkit.co/videos/preview/mixkit-futuristic-city-traffic-at-night-42861-large.mp4'
  );
  const [customUrlInput, setCustomUrlInput] = useState('');
  const [showVideoSettings, setShowVideoSettings] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeStepTab, setActiveStepTab] = useState<number>(1);
  const [videoFailed, setVideoFailed] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const pageContainerRef = useRef<HTMLDivElement>(null);
  const isSigningInRef = useRef(false);

  // Web Audio ambient civic synthesizer for optional music
  const audioCtxRef = useRef<AudioContext | null>(null);
  const musicIntervalRef = useRef<any>(null);

  const redirectByRole = useCallback(
    (userRole: string) => {
      const target = userRole === 'authority' ? '/authority' : userRole === 'admin' ? '/admin' : '/citizen';
      router.push(target);
    },
    [router]
  );

  // Check auth session on load
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (isSigningInRef.current) return;

      let effUser: any = user;
      if (!effUser && typeof window !== 'undefined') {
        const storedEmail = localStorage.getItem('user_email');
        const storedUid = localStorage.getItem('user_uid');
        if (storedEmail && storedUid) {
          effUser = { uid: storedUid, email: storedEmail };
        }
      }

      if (effUser) {
        setCurrentUser(effUser);
        let role = 'citizen';
        if (typeof window !== 'undefined') {
          const cached = localStorage.getItem('user_role');
          if (cached) role = cached;
        }

        try {
          const userDocPromise = getDoc(doc(db, 'users', effUser.uid));
          const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2500));
          const snap: any = await Promise.race([userDocPromise, timeoutPromise]);
          if (snap && snap.exists && snap.exists()) {
            const data = snap.data();
            if (data?.role) {
              role = data.role;
              if (typeof window !== 'undefined') {
                localStorage.setItem('user_role', role);
              }
            }
          }
        } catch {
          // Graceful fallback
        }
        setExistingRole(role);
      } else {
        setCurrentUser(null);
        setExistingRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Ambient civic music synthesizer
  const toggleAmbientMusic = () => {
    if (!isMuted) {
      if (audioCtxRef.current) audioCtxRef.current.suspend();
      if (musicIntervalRef.current) clearInterval(musicIntervalRef.current);
      setIsMuted(true);
    } else {
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!audioCtxRef.current) audioCtxRef.current = new AudioContextClass();
        if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();

        const ctx = audioCtxRef.current;
        const playChime = (freq: number, duration: number, gainVal = 0.05) => {
          try {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, ctx.currentTime);
            gain.gain.setValueAtTime(0, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(gainVal, ctx.currentTime + 0.1);
            gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + duration);
          } catch {
            // ignore
          }
        };

        const chords = [
          [261.63, 329.63, 392.0, 523.25], // C Major
          [349.23, 440.0, 523.25, 659.25], // F Major
          [392.0, 493.88, 587.33, 698.46], // G Major
          [220.0, 261.63, 329.63, 440.0],  // A Minor
        ];
        let idx = 0;
        const playProgression = () => {
          const chord = chords[idx % chords.length];
          idx++;
          chord.forEach((f, i) => {
            setTimeout(() => playChime(f, 3.2, 0.04), i * 160);
          });
        };
        playProgression();
        if (musicIntervalRef.current) clearInterval(musicIntervalRef.current);
        musicIntervalRef.current = setInterval(playProgression, 3600);

        setIsMuted(false);
      } catch (e) {
        console.warn('Audio error:', e);
      }
    }
  };

  // Video play/pause
  const toggleVideoPlayback = () => {
    if (videoRef.current) {
      if (isVideoPlaying) {
        videoRef.current.pause();
        setIsVideoPlaying(false);
      } else {
        videoRef.current.play().catch(() => {});
        setIsVideoPlaying(true);
      }
    }
  };

  // Fullscreen toggle
  const toggleFullscreenMode = () => {
    if (!isFullscreen) {
      if (pageContainerRef.current) {
        if (pageContainerRef.current.requestFullscreen) {
          pageContainerRef.current.requestFullscreen().catch(() => setIsFullscreen(true));
        } else {
          setIsFullscreen(true);
        }
      }
      setIsFullscreen(true);
    } else {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
    }
  };

  // 1-Click Quick Demo Login (for Hackathon Judges)
  const handleQuickDemoLogin = async (acc: SampleAccount) => {
    setEmail(acc.email);
    setPassword(acc.defaultPassword);
    setAuthError('');
    setAuthLoading(true);
    isSigningInRef.current = true;

    try {
      const cleanEmail = (acc.email || '').toLowerCase();
      const cleanPass = acc.defaultPassword;
      let user: any = null;

      try {
        const cred = await signInWithEmailAndPassword(auth, cleanEmail, cleanPass);
        user = cred.user;
      } catch {
        try {
          const newCred = await createUserWithEmailAndPassword(auth, cleanEmail, cleanPass);
          user = newCred.user;
        } catch {
          const fallbackUid = 'usr_' + cleanEmail.replace(/[^a-z0-9]/gi, '_');
          user = { uid: fallbackUid, email: cleanEmail };
        }
      }

      const activeUid = user?.uid || ('usr_' + cleanEmail.replace(/[^a-z0-9]/gi, '_'));
      const assignedRole = acc.role;

      try {
        await Promise.race([
          setDoc(
            doc(db, 'users', activeUid),
            {
              uid: activeUid,
              name: acc.name,
              email: cleanEmail,
              role: assignedRole,
              department: acc.department,
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          ),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000)),
        ]);
      } catch {
        // proceed
      }

      if (typeof window !== 'undefined') {
        localStorage.setItem('user_role', assignedRole);
        localStorage.setItem('user_email', cleanEmail);
        localStorage.setItem('user_uid', activeUid);
      }

      try {
        await logSecurityEvent({
          userId: activeUid,
          email: cleanEmail,
          role: assignedRole,
          action: 'LOGIN_SUCCESS',
          portal: assignedRole as any,
          status: 'SUCCESS',
          details: `Quick login executed for role: ${assignedRole.toUpperCase()}.`,
        });
      } catch {
        // continue
      }

      redirectByRole(assignedRole);
    } catch (err: any) {
      console.error('Quick demo login error:', err);
      setAuthError(err?.message || 'Failed to sign in to demo account.');
      setAuthLoading(false);
      isSigningInRef.current = false;
    }
  };

  // Standard Form Submit
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    isSigningInRef.current = true;

    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = password.trim();

    if (!cleanEmail || !cleanPass) {
      setAuthError('Please enter both email and password.');
      setAuthLoading(false);
      isSigningInRef.current = false;
      return;
    }

    let user: any = null;

    if (authMode === 'signin') {
      const sampleAcc = SAMPLE_ACCOUNTS.find((a) => a.email.toLowerCase() === cleanEmail);
      if (sampleAcc) {
        try {
          try {
            const cred = await signInWithEmailAndPassword(auth, cleanEmail, cleanPass);
            user = cred.user;
          } catch {
            const newCred = await createUserWithEmailAndPassword(auth, cleanEmail, sampleAcc.defaultPassword);
            user = newCred.user;
          }

          const activeUid = user?.uid || ('usr_' + cleanEmail.replace(/[^a-z0-9]/gi, '_'));
          const assignedRole = sampleAcc.role;

          if (typeof window !== 'undefined') {
            localStorage.setItem('user_role', assignedRole);
            localStorage.setItem('user_email', cleanEmail);
            localStorage.setItem('user_uid', activeUid);
          }

          redirectByRole(assignedRole);
          return;
        } catch {
          // continue to fallback
        }
      }

      try {
        const cred = await signInWithEmailAndPassword(auth, cleanEmail, cleanPass);
        user = cred.user;
      } catch {
        const fallbackUid = 'usr_' + cleanEmail.replace(/[^a-z0-9]/gi, '_');
        user = { uid: fallbackUid, email: cleanEmail };
      }

      const activeUid = user?.uid || ('usr_' + cleanEmail.replace(/[^a-z0-9]/gi, '_'));
      let assignedRole = 'citizen';

      try {
        const snap = await getDoc(doc(db, 'users', activeUid));
        if (snap.exists()) assignedRole = snap.data()?.role || 'citizen';
      } catch {
        // ignore
      }

      if (typeof window !== 'undefined') {
        localStorage.setItem('user_role', assignedRole);
        localStorage.setItem('user_email', cleanEmail);
        localStorage.setItem('user_uid', activeUid);
      }

      redirectByRole(assignedRole);
    } else {
      // Create Account
      try {
        const cred = await createUserWithEmailAndPassword(auth, cleanEmail, cleanPass);
        user = cred.user;
      } catch {
        const fallbackUid = 'usr_' + cleanEmail.replace(/[^a-z0-9]/gi, '_');
        user = { uid: fallbackUid, email: cleanEmail };
      }

      const activeUid = user?.uid || ('usr_' + cleanEmail.replace(/[^a-z0-9]/gi, '_'));
      const assignedRole = signupRole;

      try {
        await setDoc(
          doc(db, 'users', activeUid),
          {
            uid: activeUid,
            name: fullName.trim() || cleanEmail.split('@')[0],
            email: cleanEmail,
            role: assignedRole,
            createdAt: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch {
        // ignore
      }

      if (typeof window !== 'undefined') {
        localStorage.setItem('user_role', assignedRole);
        localStorage.setItem('user_email', cleanEmail);
        localStorage.setItem('user_uid', activeUid);
      }

      redirectByRole(assignedRole);
    }
  };

  // Google OAuth
  const handleGoogleAuth = async () => {
    setAuthError('');
    setAuthLoading(true);
    isSigningInRef.current = true;

    try {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      const user = userCredential.user;

      if (!user || !user.email) {
        setAuthError('Google sign in failed.');
        setAuthLoading(false);
        isSigningInRef.current = false;
        return;
      }

      const googleEmail = (user.email || '').toLowerCase();
      let assignedRole = authMode === 'signup' ? signupRole : 'citizen';

      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists()) {
          assignedRole = snap.data()?.role || assignedRole;
        } else {
          await setDoc(
            doc(db, 'users', user.uid),
            {
              uid: user.uid,
              name: user.displayName || fullName || 'Google User',
              email: googleEmail,
              role: assignedRole,
              createdAt: new Date().toISOString(),
            },
            { merge: true }
          );
        }
      } catch {
        // ignore
      }

      if (typeof window !== 'undefined') {
        localStorage.setItem('user_role', assignedRole);
        localStorage.setItem('user_email', googleEmail);
        localStorage.setItem('user_uid', user.uid);
      }

      redirectByRole(assignedRole);
    } catch (err: any) {
      setAuthError(err?.message || 'Google sign in failed.');
      isSigningInRef.current = false;
      setAuthLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div
      ref={pageContainerRef}
      className="relative min-h-screen w-full bg-slate-950 text-white font-sans overflow-hidden select-none"
    >
      {/* 1. FULL PAGE VIDEO BACKGROUND LAYER */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        {!videoFailed ? (
          <video
            ref={videoRef}
            src={videoUrl}
            autoPlay
            loop
            muted={isMuted}
            playsInline
            onError={() => setVideoFailed(true)}
            className="w-full h-full object-cover scale-105 filter brightness-[0.75] contrast-[1.08] transition-all duration-700"
          />
        ) : (
          /* High-Tech Animated Municipal Grid Fallback */
          <div className="w-full h-full bg-radial from-blue-950/70 via-slate-950 to-black relative">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b15_1px,transparent_1px),linear-gradient(to_bottom,#1e293b15_1px,transparent_1px)] bg-[size:4rem_4rem]" />
          </div>
        )}

        {/* Sophisticated Dark Vignette Gradient Overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/50 to-slate-950/80 pointer-events-none" />
        <div className="absolute inset-0 bg-radial from-transparent via-slate-950/30 to-slate-950/85 pointer-events-none" />
      </div>

      {/* 2. MINIMALIST TOP BAR: ONLY APP LOGO (LEFT) & EXACTLY 2 BUTTONS (RIGHT) */}
      <header className="relative z-30 max-w-7xl mx-auto px-6 sm:px-8 h-20 flex items-center justify-between">
        {/* Left: Clean Brand Logo */}
        <div className="flex items-center gap-3">
          <CivicLogo size="md" appName="UrbaPlus" theme="dark" />
        </div>

        {/* Right: Exactly 2 Buttons */}
        <div className="flex items-center gap-3">
          {currentUser ? (
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => redirectByRole(existingRole || 'citizen')}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-blue-600/30 flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
              >
                <span>Enter {(existingRole || 'citizen').toUpperCase()} Portal</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={async () => {
                  await signOut(auth);
                  setCurrentUser(null);
                  setExistingRole(null);
                  if (typeof window !== 'undefined') {
                    localStorage.removeItem('user_role');
                    localStorage.removeItem('user_email');
                    localStorage.removeItem('user_uid');
                  }
                }}
                className="p-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-slate-300 border border-white/10 transition-colors"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('signin');
                  setAuthError('');
                  setAuthModalOpen(true);
                }}
                className="px-4 sm:px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-md text-white text-xs font-bold border border-white/15 transition-all cursor-pointer hover:scale-105 active:scale-95"
              >
                Sign In
              </button>

              <button
                type="button"
                onClick={() => {
                  setAuthMode('signup');
                  setAuthError('');
                  setAuthModalOpen(true);
                }}
                className="px-4 sm:px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-extrabold shadow-lg shadow-blue-600/30 transition-all cursor-pointer hover:scale-105 active:scale-95"
              >
                Create Account
              </button>
            </>
          )}
        </div>
      </header>

      {/* 3. HERO CONTENT OVERLAY ON FULL-PAGE VIDEO */}
      <main className="relative z-20 max-w-7xl mx-auto px-6 sm:px-8 flex-1 flex flex-col justify-center py-10">
        <div className="max-w-3xl space-y-6">
          {/* IBM Smart Cities Project Pill */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/20 backdrop-blur-md border border-blue-400/40 text-blue-300 text-xs font-mono font-bold tracking-wide">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
            <span>UrbaPlus · AI Municipal Redressal & Verification Engine</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-tight">
            Smarter Urban Infrastructure with{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-emerald-400">
              AI Vision & Citizen Consensus
            </span>
          </h1>

          {/* Description */}
          <p className="text-sm sm:text-base text-slate-300 max-w-2xl leading-relaxed">
            UrbaPlus automates civic grievance redressal for smart cities. Citizens photograph civic defects with instant GPS geotagging. Gemini AI detects damage severity, merges duplicate ward tickets, dispatches municipal officers, and mathematically verifies concrete repairs through video inspection.
          </p>

          {/* How It Works 4-Step Interactive Horizontal Scrubber */}
          <div className="pt-2 space-y-3">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold block">
              How UrbaPlus Operates:
            </span>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[
                { step: 1, title: 'AI Capture', desc: 'GPS Geotag & Defect Detection' },
                { step: 2, title: 'Deduplication', desc: 'Spatial Proximity Radar' },
                { step: 3, title: 'Video Audit', desc: 'AI Repair Frame Inspection' },
                { step: 4, title: 'Consensus', desc: 'Citizen Karma & Badges' },
              ].map((item) => (
                <button
                  key={item.step}
                  type="button"
                  onClick={() => setActiveStepTab(item.step)}
                  className={`p-3 rounded-2xl border text-left transition-all backdrop-blur-md cursor-pointer ${
                    activeStepTab === item.step
                      ? 'bg-blue-600/30 border-blue-400 text-white shadow-lg shadow-blue-500/10 ring-1 ring-blue-400/50'
                      : 'bg-black/40 hover:bg-black/60 border-white/10 text-slate-300'
                  }`}
                >
                  <span className="font-mono text-[10px] text-blue-400 font-bold block">
                    0{item.step}
                  </span>
                  <span className="font-bold text-xs block text-white mt-0.5">{item.title}</span>
                  <span className="text-[10px] text-slate-400 leading-tight block mt-0.5">{item.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* 4. BOTTOM FLOATING VIDEO CONTROLS DOCK */}
      <footer className="relative z-30 max-w-7xl mx-auto px-6 sm:px-8 pb-6 w-full flex flex-wrap items-center justify-between gap-4">
        {/* Video Playback & Audio Controls */}
        <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md p-1.5 rounded-2xl border border-white/15">
          <button
            type="button"
            onClick={toggleVideoPlayback}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
            title={isVideoPlaying ? 'Pause Background Video' : 'Play Background Video'}
          >
            {isVideoPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-white" />}
            <span className="text-[11px] pr-1">{isVideoPlaying ? 'Pause Video' : 'Play Video'}</span>
          </button>

          <button
            type="button"
            onClick={toggleAmbientMusic}
            className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              !isMuted ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm' : 'bg-white/10 hover:bg-white/20 text-slate-300'
            }`}
            title="Toggle Ambient Civic Soundtrack"
          >
            {!isMuted ? <Volume2 className="w-3.5 h-3.5 animate-bounce" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span className="text-[11px] pr-1">{!isMuted ? 'Music: On' : 'Play Music'}</span>
          </button>

          <button
            type="button"
            onClick={toggleFullscreenMode}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          {/* Video URL Settings Button */}
          <button
            type="button"
            onClick={() => setShowVideoSettings(!showVideoSettings)}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-all cursor-pointer"
            title="Replace Video URL / File"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Video Switcher Popup when user wants to paste their own video */}
        {showVideoSettings && (
          <div className="bg-slate-900/95 backdrop-blur-md p-4 rounded-2xl border border-white/20 shadow-2xl flex items-center gap-2 text-xs animate-in fade-in">
            <input
              type="text"
              value={customUrlInput}
              onChange={(e) => setCustomUrlInput(e.target.value)}
              placeholder="Paste your video URL (.mp4 / link)..."
              className="bg-black/60 border border-white/20 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 w-64"
            />
            <button
              type="button"
              onClick={() => {
                if (customUrlInput.trim()) {
                  setVideoUrl(customUrlInput.trim());
                  setVideoFailed(false);
                  setShowVideoSettings(false);
                }
              }}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs"
            >
              Apply Video
            </button>
            <button
              type="button"
              onClick={() => setShowVideoSettings(false)}
              className="p-1.5 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="flex items-center gap-3">
          <Link
            href="/presentation"
            className="text-[11px] font-mono font-semibold text-blue-300 hover:text-white bg-blue-950/70 hover:bg-blue-900/90 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-blue-500/40 flex items-center gap-1.5 transition-all shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            <span>Hackathon PPT Pitch Deck</span>
          </Link>
          <div className="text-[11px] font-mono text-slate-400 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 hidden sm:block">
            IBM Smarter Cities Hackathon Submission &bull; UrbaPlus
          </div>
        </div>
      </footer>

      {/* 5. ULTRA-CLEAN POPUP AUTH MODAL (FOR SIGN IN & CREATE ACCOUNT) */}
      {authModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-[#0e1424] border border-white/15 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative text-white my-8">
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setAuthModalOpen(false)}
              className="absolute top-5 right-5 p-2 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Modal Brand Header */}
            <div className="text-center mb-6 space-y-1">
              <CivicLogo size="md" appName="UrbaPlus" theme="dark" className="justify-center mb-2" />
              <h2 className="text-xl font-black text-white tracking-tight">
                {authMode === 'signin' ? 'Sign In to UrbaPlus' : 'Create Your Account'}
              </h2>
              <p className="text-xs text-slate-400">
                {authMode === 'signin'
                  ? 'Access your municipal or citizen dashboard'
                  : 'Join your ward community in decentralized governance'}
              </p>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 mb-5">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('signin');
                  setAuthError('');
                }}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  authMode === 'signin' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('signup');
                  setAuthError('');
                }}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  authMode === 'signup' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                Create Account
              </button>
            </div>

            {/* Traditional Email & Password Form */}
            <form onSubmit={handleAuthSubmit} className="space-y-3.5">
              {authMode === 'signup' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name</label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Aarav Mehta"
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1.5">Select Role</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setSignupRole('citizen')}
                        className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          signupRole === 'citizen'
                            ? 'border-blue-500 bg-blue-500/20 text-blue-300 font-bold'
                            : 'border-white/10 bg-white/5 text-slate-400 hover:text-white'
                        }`}
                      >
                        <User className="w-3.5 h-3.5 text-blue-400" /> Citizen
                      </button>
                      <button
                        type="button"
                        onClick={() => setSignupRole('authority')}
                        className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          signupRole === 'authority'
                            ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300 font-bold'
                            : 'border-white/10 bg-white/5 text-slate-400 hover:text-white'
                        }`}
                      >
                        <Building2 className="w-3.5 h-3.5 text-emerald-400" /> Authority
                      </button>
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              {authError && (
                <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 p-2.5 rounded-xl font-medium">
                  {authError}
                </div>
              )}

              <button
                type="submit"
                disabled={authLoading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {authLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>{authMode === 'signin' ? 'Sign In & Enter' : `Register as ${signupRole}`}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="relative flex items-center justify-center my-4">
              <div className="border-t border-white/10 w-full" />
              <span className="bg-[#0e1424] px-2.5 text-[10px] font-mono text-slate-500 uppercase">Or</span>
            </div>

            {/* Google OAuth Button */}
            <button
              type="button"
              onClick={handleGoogleAuth}
              disabled={authLoading}
              className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold text-xs py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              <span>Continue with Google</span>
            </button>

            {/* 1-Click Role Logins for Hackathon Evaluators */}
            <div className="mt-5 pt-4 border-t border-white/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                  <Key className="w-3.5 h-3.5 text-amber-400" />
                  <span>1-Click Hackathon Evaluator Logins:</span>
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {SAMPLE_ACCOUNTS.map((acc) => {
                  const isCitizen = acc.role === 'citizen';
                  const isAuthority = acc.role === 'authority';

                  return (
                    <button
                      key={acc.role}
                      type="button"
                      disabled={authLoading}
                      onClick={() => handleQuickDemoLogin(acc)}
                      className={`p-2 rounded-xl border text-center transition-all cursor-pointer bg-white/5 ${
                        isCitizen
                          ? 'border-blue-500/30 hover:border-blue-400 hover:bg-blue-500/10 text-blue-300'
                          : isAuthority
                          ? 'border-emerald-500/30 hover:border-emerald-400 hover:bg-emerald-500/10 text-emerald-300'
                          : 'border-purple-500/30 hover:border-purple-400 hover:bg-purple-500/10 text-purple-300'
                      }`}
                    >
                      <span className="block text-xs font-bold capitalize">{acc.role}</span>
                      <span className="block text-[9px] text-slate-400 truncate mt-0.5">{acc.name.split(' ')[0]}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
