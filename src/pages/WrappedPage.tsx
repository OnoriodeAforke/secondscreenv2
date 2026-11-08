import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, type PanInfo } from 'framer-motion';
import confetti from 'canvas-confetti';
import { 
  ChevronUp, 
  ChevronDown,
  Download, 
  RotateCcw, 
  X as CloseIcon, 
  Volume2,
  VolumeX,
  Flame,
  Tv,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo';
import { wrappedAudio } from '../lib/wrappedAudio';

export default function WrappedPage() {
  const navigate = useNavigate();
  const [[activeSlide, direction], setSlide] = useState<[number, number]>([0, 0]);
  const [copiedNetwork, setCopiedNetwork] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isAudioActive, setIsAudioActive] = useState(false);
  const lastWheelTime = useRef<number>(0);

  // Initialize and play background music when user checks Wrapped
  useEffect(() => {
    wrappedAudio.setMuted(false);
    wrappedAudio.start();

    // Browser autoplay policy: resume audio context on the first user interaction
    const handleFirstGesture = () => {
      wrappedAudio.start();
      window.removeEventListener('pointerdown', handleFirstGesture);
      window.removeEventListener('touchstart', handleFirstGesture);
      window.removeEventListener('click', handleFirstGesture);
      window.removeEventListener('keydown', handleFirstGesture);
    };

    window.addEventListener('pointerdown', handleFirstGesture, { passive: true });
    window.addEventListener('touchstart', handleFirstGesture, { passive: true });
    window.addEventListener('click', handleFirstGesture, { passive: true });
    window.addEventListener('keydown', handleFirstGesture, { passive: true });

    const unsubscribe = wrappedAudio.subscribe((active) => {
      setIsAudioActive(active);
    });

    return () => {
      window.removeEventListener('pointerdown', handleFirstGesture);
      window.removeEventListener('touchstart', handleFirstGesture);
      window.removeEventListener('click', handleFirstGesture);
      window.removeEventListener('keydown', handleFirstGesture);
      unsubscribe();
      wrappedAudio.stop();
    };
  }, []);

  const toggleSound = useCallback(() => {
    setIsMuted((prev) => {
      const nextMuted = !prev;
      wrappedAudio.setMuted(nextMuted);
      if (!nextMuted) {
        wrappedAudio.start();
      }
      return nextMuted;
    });
  }, []);

  // Trigger high-energy cyberpunk esports confetti celebration
  const triggerConfettiCelebration = useCallback(() => {
    const cyberColors = ['#06b6d4', '#22d3ee', '#a855f7', '#c084fc', '#ec4899', '#f59e0b', '#38bdf8', '#ffffff'];

    // Left cannon
    confetti({
      particleCount: 50,
      angle: 60,
      spread: 65,
      origin: { x: 0.08, y: 0.8 },
      colors: cyberColors,
      ticks: 220,
      gravity: 1.1,
      scalar: 1.1,
      shapes: ['square', 'circle'],
      zIndex: 9999,
    });

    // Right cannon
    confetti({
      particleCount: 50,
      angle: 120,
      spread: 65,
      origin: { x: 0.92, y: 0.8 },
      colors: cyberColors,
      ticks: 220,
      gravity: 1.1,
      scalar: 1.1,
      shapes: ['square', 'circle'],
      zIndex: 9999,
    });

    // Delayed center superburst
    const timer1 = setTimeout(() => {
      confetti({
        particleCount: 65,
        spread: 95,
        origin: { x: 0.5, y: 0.55 },
        colors: cyberColors,
        ticks: 240,
        gravity: 0.95,
        scalar: 1.25,
        zIndex: 9999,
      });
    }, 240);

    // Subtle falling shimmer
    const timer2 = setTimeout(() => {
      confetti({
        particleCount: 30,
        spread: 120,
        origin: { x: 0.5, y: 0.35 },
        colors: cyberColors,
        ticks: 260,
        gravity: 0.75,
        scalar: 0.9,
        zIndex: 9999,
      });
    }, 550);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  // Fire confetti celebration when the user reaches the final slide (slide index 3)
  useEffect(() => {
    if (activeSlide === 3) {
      const timeout = setTimeout(() => {
        triggerConfettiCelebration();
      }, 300);
      return () => clearTimeout(timeout);
    }
  }, [activeSlide, triggerConfettiCelebration]);

  const paginate = useCallback((newDirection: number) => {
    if (!isMuted) {
      wrappedAudio.start();
    }
    setSlide(([curr]) => {
      const next = curr + newDirection;
      if (next < 0 || next > 3) return [curr, 0];
      return [next, newDirection];
    });
  }, [isMuted]);

  const goToSlide = useCallback((targetIndex: number) => {
    setSlide(([curr]) => {
      if (targetIndex === curr) return [curr, 0];
      return [targetIndex, targetIndex > curr ? 1 : -1];
    });
  }, []);

  const handleNext = useCallback(() => {
    paginate(1);
  }, [paginate]);

  const handlePrev = useCallback(() => {
    paginate(-1);
  }, [paginate]);

  // Touch and Drag Gesture Handler with Framer Motion
  const handleDragEnd = (
    _event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo
  ) => {
    const swipeThresholdY = 40;
    const swipeVelocityThresholdY = 250;
    const swipeThresholdX = 60;
    const swipeVelocityThresholdX = 300;

    const offsetY = info.offset.y;
    const velocityY = info.velocity.y;
    const offsetX = info.offset.x;
    const velocityX = info.velocity.x;

    // Detect vertical swipe (primary)
    if (offsetY < -swipeThresholdY || velocityY < -swipeVelocityThresholdY) {
      // Swiped UP -> go to next slide
      handleNext();
    } else if (offsetY > swipeThresholdY || velocityY > swipeVelocityThresholdY) {
      // Swiped DOWN -> go to prev slide
      handlePrev();
    } 
    // Detect horizontal swipe (secondary story gesture)
    else if (offsetX < -swipeThresholdX || velocityX < -swipeVelocityThresholdX) {
      // Swiped LEFT -> next slide
      handleNext();
    } else if (offsetX > swipeThresholdX || velocityX > swipeVelocityThresholdX) {
      // Swiped RIGHT -> prev slide
      handlePrev();
    }
  };

  // Mouse wheel navigation with debounce
  const handleWheel = (e: React.WheelEvent) => {
    const now = Date.now();
    if (now - lastWheelTime.current < 450) return;

    if (e.deltaY > 25) {
      lastWheelTime.current = now;
      handleNext();
    } else if (e.deltaY < -25) {
      lastWheelTime.current = now;
      handlePrev();
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      } else if (e.key === 'Escape') {
        navigate('/dashboard');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrev, navigate]);

  const handleShare = (network: string) => {
    setCopiedNetwork(network);
    const shareText = `🔥 My 2026 Esports Wrapped on SecondScreen: TOP 1% of Kai Cenat fans, 47 hours watched, Team Spirit diehard & 120 live predictions! Check yours: ${window.location.origin}/wrapped`;
    
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareText);
    }
    
    setTimeout(() => {
      setCopiedNetwork(null);
    }, 2800);
  };

  const handleDownload = () => {
    setIsDownloading(true);
    setTimeout(() => {
      setIsDownloading(false);
      setDownloadSuccess(true);
      
      const canvas = document.createElement('canvas');
      canvas.width = 1080;
      canvas.height = 1920;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const bgGrad = ctx.createLinearGradient(0, 0, 1080, 1920);
        bgGrad.addColorStop(0, '#0a0915');
        bgGrad.addColorStop(0.5, '#120b29');
        bgGrad.addColorStop(1, '#060c1a');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, 1080, 1920);

        ctx.strokeStyle = 'rgba(168, 85, 247, 0.15)';
        ctx.lineWidth = 2;
        for (let x = 0; x < 1080; x += 60) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, 1920);
          ctx.stroke();
        }
        for (let y = 0; y < 1920; y += 60) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(1080, y);
          ctx.stroke();
        }

        ctx.fillStyle = '#06b6d4';
        ctx.font = 'bold 36px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('SECONDSCREEN WRAPPED 2026', 540, 240);

        ctx.fillStyle = '#ffffff';
        ctx.font = '900 96px sans-serif';
        ctx.fillText('TOP 1%', 540, 420);

        ctx.fillStyle = '#c084fc';
        ctx.font = 'bold 44px sans-serif';
        ctx.fillText('OF KAI CENAT FANS', 540, 500);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '32px sans-serif';
        ctx.fillText('47 Hours Watched · Team Spirit #1 · 120 Live Polls', 540, 580);

        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 28px sans-serif';
        ctx.fillText('secondscreen.gg/wrapped', 540, 1800);

        const link = document.createElement('a');
        link.download = 'SecondScreen-Wrapped-2026.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
        triggerConfettiCelebration();
      }

      setTimeout(() => {
        setDownloadSuccess(false);
      }, 3500);
    }, 900);
  };

  // Slide transition animation variants for smooth vertical story gliding
  const slideVariants = {
    enter: (dir: number) => ({
      y: dir > 0 ? '100%' : dir < 0 ? '-100%' : '0%',
      opacity: 0.6,
      scale: 0.98,
      zIndex: 1
    }),
    center: {
      y: '0%',
      opacity: 1,
      scale: 1,
      zIndex: 2,
      transition: {
        y: { type: 'spring' as const, stiffness: 320, damping: 32, mass: 0.8 },
        opacity: { duration: 0.28 },
        scale: { duration: 0.28 }
      }
    },
    exit: (dir: number) => ({
      y: dir > 0 ? '-100%' : '100%',
      opacity: 0.3,
      scale: 0.96,
      zIndex: 0,
      transition: {
        y: { type: 'spring' as const, stiffness: 320, damping: 32, mass: 0.8 },
        opacity: { duration: 0.22 }
      }
    })
  };

  return (
    <div 
      onWheel={handleWheel}
      className="min-h-screen bg-[#040509] text-white flex flex-col items-center justify-center p-0 sm:p-4 select-none relative overflow-hidden font-sans touch-none"
    >
      {/* Background Ambient Orbs for desktop backdrop */}
      <div className="fixed top-1/4 -left-32 w-96 h-96 bg-purple-600/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="fixed bottom-1/4 -right-32 w-96 h-96 bg-cyan-500/15 rounded-full blur-[140px] pointer-events-none" />

      {/* Main 9:16 Aspect Ratio Container */}
      <div 
        className="relative w-full max-w-[430px] aspect-[9/16] h-[100dvh] sm:h-[min(92vh,840px)] sm:max-h-[860px] sm:rounded-[36px] overflow-hidden shadow-[0_0_80px_rgba(168,85,247,0.35)] border-0 sm:border sm:border-purple-500/30 bg-[#070811] flex flex-col"
      >
        {/* Top Story Header & Instagram Progress Bars */}
        <div className="absolute top-0 left-0 right-0 z-50 p-3 pt-3.5 sm:pt-4 bg-gradient-to-b from-[#070811]/90 via-[#070811]/60 to-transparent pointer-events-auto">
          {/* 4 Segmented Progress Bars */}
          <div className="grid grid-cols-4 gap-1.5 mb-2.5">
            {[0, 1, 2, 3].map((index) => (
              <button
                key={index}
                type="button"
                onClick={() => goToSlide(index)}
                className="h-1 rounded-full overflow-hidden bg-white/20 hover:bg-white/30 transition cursor-pointer"
                title={`Go to section ${index + 1}`}
              >
                <div
                  className={`h-full transition-all duration-300 rounded-full ${
                    index < activeSlide
                      ? 'w-full bg-gradient-to-r from-purple-400 to-cyan-400'
                      : index === activeSlide
                      ? 'w-full bg-gradient-to-r from-purple-400 to-cyan-400 shadow-[0_0_8px_#38bdf8]'
                      : 'w-0'
                  }`}
                />
              </button>
            ))}
          </div>

          {/* Brand Header */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <BrandLogo 
                iconClassName="w-6 h-6" 
                textClassName="text-sm font-black tracking-wider text-white" 
                showText={true} 
              />
              <span className="text-[10px] uppercase font-display font-black tracking-widest px-2 py-0.5 rounded-md bg-gradient-to-r from-purple-500/20 to-cyan-500/20 border border-cyan-500/30 text-cyan-300">
                WRAPPED '26
              </span>
            </div>

            {/* Actions: Sound toggle & Exit back to Dashboard */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleSound}
                className={`h-8 px-2.5 rounded-full border flex items-center gap-1.5 transition cursor-pointer ${
                  isMuted
                    ? 'bg-white/10 hover:bg-white/20 border-white/20 text-slate-400 hover:text-white'
                    : 'bg-gradient-to-r from-purple-500/25 to-cyan-500/25 hover:from-purple-500/35 hover:to-cyan-500/35 border-cyan-400/50 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.35)]'
                }`}
                title={isMuted ? 'Unmute Background Music 🎵' : 'Mute Background Music'}
              >
                {isMuted ? (
                  <>
                    <VolumeX className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:inline">Muted</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                    {/* Animated Equalizer Wave Bars */}
                    <div className="flex items-end gap-0.5 h-3 px-0.5" aria-hidden="true">
                      <span className="w-0.5 h-2 bg-cyan-400 rounded-full animate-bounce [animation-duration:500ms]" />
                      <span className="w-0.5 h-3 bg-purple-400 rounded-full animate-bounce [animation-duration:350ms]" />
                      <span className="w-0.5 h-1.5 bg-cyan-300 rounded-full animate-bounce [animation-duration:650ms]" />
                    </div>
                  </>
                )}
              </button>
              <Link
                to="/dashboard"
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center text-slate-300 hover:text-white transition cursor-pointer"
                title="Exit Wrapped"
              >
                <CloseIcon className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>

        {/* Animated Slide Canvas with Framer Motion Drag & Swipe Gestures */}
        <div className="relative w-full h-full flex-1 overflow-hidden">
          <AnimatePresence initial={false} custom={direction} mode="popLayout">
            <motion.div
              key={activeSlide}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              drag="y"
              dragDirectionLock
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={0.25}
              onDragEnd={handleDragEnd}
              className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing touch-pan-y"
            >
              {/* ========================================================================= */}
              {/* SECTION 1: "YOU ARE IN THE TOP 1% OF KAI CENAT FANS."                     */}
              {/* ========================================================================= */}
              {activeSlide === 0 && (
                <div className="w-full h-full relative flex flex-col justify-between p-6 pt-16 pb-8 overflow-hidden bg-gradient-to-b from-[#090a16] via-[#090b1c] to-[#060710]">
                  {/* Background Perspective Grid & Glowing Orbs matching reference image */}
                  <div className="absolute inset-0 cyber-grid opacity-25 pointer-events-none" />
                  
                  {/* Top-left Neon Purple Glow Ring */}
                  <div className="absolute -top-10 -left-12 w-48 h-48 rounded-full border-4 border-purple-500/60 shadow-[0_0_50px_#a855f7] pointer-events-none" />
                  <div className="absolute top-14 left-24 w-4 h-4 rounded-full border-2 border-purple-400/80 shadow-[0_0_12px_#c084fc] pointer-events-none" />

                  {/* Top-right Neon Cyan Glow Ring */}
                  <div className="absolute -top-6 -right-16 w-52 h-52 rounded-full border-4 border-cyan-400/70 shadow-[0_0_50px_#22d3ee] pointer-events-none" />
                  <div className="absolute top-16 right-20 w-5 h-5 rounded-full border-2 border-cyan-300/80 shadow-[0_0_14px_#38bdf8] pointer-events-none" />

                  {/* Floating mid Neon Orbs */}
                  <div className="absolute top-[44%] -left-8 w-24 h-24 rounded-full bg-gradient-to-br from-purple-500 to-indigo-700 shadow-[0_0_35px_#a855f7] opacity-80 pointer-events-none" />
                  <div className="absolute top-[38%] left-16 w-6 h-6 rounded-full border-2 border-purple-400 shadow-[0_0_10px_#c084fc] pointer-events-none" />
                  
                  <div className="absolute top-[60%] -right-10 w-28 h-28 rounded-full border-4 border-cyan-400/50 shadow-[0_0_40px_#06b6d4] pointer-events-none" />
                  <div className="absolute top-[62%] right-16 w-7 h-7 rounded-full border-2 border-purple-400/80 bg-purple-900/30 shadow-[0_0_12px_#a855f7] pointer-events-none" />

                  {/* Bottom-right purple ambient aura */}
                  <div className="absolute -bottom-10 -right-10 w-44 h-44 rounded-full bg-purple-600/50 blur-[50px] pointer-events-none" />

                  {/* Content Header: Massive 3D Text */}
                  <div className="relative z-10 text-center flex flex-col items-center mt-2">
                    <h1 className="text-5xl sm:text-6xl font-black font-display tracking-tight text-3d-metallic uppercase leading-none">
                      TOP 1%
                    </h1>
                    <h2 className="text-lg sm:text-xl font-black font-display tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-200 via-white to-purple-200 uppercase mt-2">
                      OF KAI CENAT FANS
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-300/90 font-medium max-w-[270px] mt-1.5 leading-snug">
                      Kai Cenat was your favorite streamer this month.
                    </p>
                  </div>

                  {/* Center Hero: Glowing 3D Cyber Headphones from Reference Image */}
                  <div className="relative z-10 flex-1 flex items-center justify-center my-1 sm:my-2">
                    <div className="relative group flex items-center justify-center">
                      <div className="absolute w-52 h-52 rounded-full bg-gradient-to-tr from-purple-600/30 via-transparent to-cyan-500/30 blur-xl animate-pulse pointer-events-none" />

                      <div className="relative w-56 sm:w-60 h-56 sm:h-60 rounded-3xl overflow-hidden flex items-center justify-center">
                        <img
                          src="/assets/aistudio/Gemini_Generated_Image_ik4yzmik4yzmik4y_cadc4ccf.jpg"
                          alt="Cyber Glowing Headphones"
                          className="w-full h-full object-cover object-center filter drop-shadow-[0_15px_25px_rgba(0,0,0,0.8)] scale-110 pointer-events-none"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#090b1c]/80 via-transparent to-transparent pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  {/* Frosted Glassmorphism Card: 47 HOURS WATCHED */}
                  <div className="relative z-10 w-full mb-2">
                    <div className="wrapped-glass-card rounded-2xl py-3 px-5 text-center flex flex-col items-center justify-center border border-white/20">
                      <span className="text-2xl sm:text-3xl font-black font-display tracking-wider text-3d-metallic leading-tight uppercase">
                        47 HOURS
                      </span>
                      <span className="text-xl sm:text-2xl font-black font-display tracking-wider text-slate-200 uppercase leading-none mt-0.5">
                        WATCHED
                      </span>
                    </div>
                  </div>

                  {/* Bottom Bar: TikTok, IG, X + Swipe Up */}
                  <div className="relative z-10 flex items-center justify-between pt-1">
                    {/* Neon Cyan Outline Social Icons */}
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => handleShare('TikTok')}
                        className="text-cyan-400 hover:text-cyan-200 transition filter drop-shadow-[0_0_8px_#22d3ee] p-1 cursor-pointer"
                        title="Share to TikTok"
                      >
                        <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                          <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.29 0 .58.04.86.12V9.42a6.34 6.34 0 0 0-.86-.06 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.75a8.16 8.16 0 0 0 4.77 1.52V6.82a4.85 4.85 0 0 1-1-.13z"/>
                        </svg>
                      </button>
                      <button
                        type="button"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => handleShare('Instagram')}
                        className="text-cyan-400 hover:text-cyan-200 transition filter drop-shadow-[0_0_8px_#22d3ee] p-1 cursor-pointer"
                        title="Share to Instagram"
                      >
                        <svg className="w-5 h-5 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                          <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                          <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
                        </svg>
                      </button>
                      <button
                        type="button"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => handleShare('X')}
                        className="text-cyan-400 hover:text-cyan-200 transition filter drop-shadow-[0_0_8px_#22d3ee] p-1 cursor-pointer"
                        title="Share to X"
                      >
                        <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                        </svg>
                      </button>
                    </div>

                    {/* Centered Animated Swipe Up Indicator */}
                    <button
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={handleNext}
                      className="flex flex-col items-center group cursor-pointer focus:outline-none"
                    >
                      <ChevronUp className="w-5 h-5 text-cyan-400 animate-bounce transition group-hover:text-white filter drop-shadow-[0_0_8px_#22d3ee]" />
                      <span className="text-[11px] font-bold text-slate-300 group-hover:text-cyan-300 tracking-wider">
                        Swipe Up
                      </span>
                    </button>

                    <div className="w-14" />
                  </div>
                </div>
              )}

              {/* ========================================================================= */}
              {/* SECTION 2: "You spent 47 HOURS watching esports this month."               */}
              {/* ========================================================================= */}
              {activeSlide === 1 && (
                <div className="w-full h-full relative flex flex-col justify-between p-6 pt-16 pb-8 overflow-hidden bg-gradient-to-b from-[#070b18] via-[#091124] to-[#050811]">
                  <div className="absolute inset-0 cyber-grid opacity-20 pointer-events-none" />

                  {/* Glowing Cyan Halo in background */}
                  <div className="absolute top-1/4 -right-20 w-64 h-64 rounded-full bg-cyan-500/20 blur-[70px] pointer-events-none" />
                  <div className="absolute bottom-1/4 -left-20 w-64 h-64 rounded-full bg-purple-600/20 blur-[70px] pointer-events-none" />

                  {/* Header */}
                  <div className="relative z-10 text-center flex flex-col items-center mt-2">
                    <span className="text-xs uppercase font-display font-black tracking-widest text-cyan-400 mb-1">
                      SCREEN TIME RECAP
                    </span>
                    <h1 className="text-5xl sm:text-6xl font-black font-display tracking-tight text-3d-cyan uppercase leading-none">
                      47 HOURS
                    </h1>
                    <h2 className="text-base sm:text-lg font-black font-display tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-purple-300 via-white to-cyan-300 uppercase mt-2">
                      WATCHING ESPORTS THIS MONTH
                    </h2>
                    <p className="text-xs text-slate-300/80 font-medium max-w-[280px] mt-1.5 leading-snug">
                      You spent 47 HOURS watching esports this month across Twitch & YouTube.
                    </p>
                  </div>

                  {/* Central 3D Graphic (Gaming Controller) */}
                  <div className="relative z-10 flex-1 flex items-center justify-center my-2">
                    <div className="relative flex items-center justify-center">
                      <div className="absolute w-44 h-44 rounded-full border border-cyan-500/30 animate-spin" style={{ animationDuration: '14s' }} />
                      <div className="absolute w-56 h-56 rounded-full border border-purple-500/20 animate-spin" style={{ animationDuration: '22s', animationDirection: 'reverse' }} />
                      
                      <div className="w-28 h-28 rounded-3xl bg-gradient-to-br from-cyan-500/20 via-purple-600/30 to-indigo-950/80 border border-cyan-400/50 flex items-center justify-center shadow-[0_0_40px_rgba(6,182,212,0.4)] backdrop-blur-md">
                        <span className="text-6xl filter drop-shadow-[0_10px_15px_rgba(0,0,0,0.6)] animate-pulse">
                          🎮
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Glassmorphism Card: Detailed Breakdown */}
                  <div className="relative z-10 w-full mb-3">
                    <div className="wrapped-glass-card rounded-2xl p-4 border border-white/20">
                      <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-white/10">
                        <div className="flex items-center gap-2">
                          <Tv className="w-4 h-4 text-cyan-400" />
                          <span className="text-xs font-bold font-display uppercase tracking-wider text-slate-200">Top Tournaments</span>
                        </div>
                        <span className="text-[11px] font-bold text-cyan-300 bg-cyan-950/60 border border-cyan-500/40 px-2 py-0.5 rounded-full">
                          TOP 2% VIEWER
                        </span>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-300 font-medium">CS2 Major Copenhagen</span>
                          <span className="font-display font-bold text-white">22h 40m</span>
                        </div>
                        <div className="w-full bg-slate-800/80 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-gradient-to-r from-purple-500 to-cyan-400 h-full w-[85%]" />
                        </div>

                        <div className="flex items-center justify-between text-xs pt-1">
                          <span className="text-slate-300 font-medium">The International Dota 2</span>
                          <span className="font-display font-bold text-white">15h 10m</span>
                        </div>
                        <div className="w-full bg-slate-800/80 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-gradient-to-r from-purple-500 to-cyan-400 h-full w-[60%]" />
                        </div>

                        <div className="flex items-center justify-between text-xs pt-1">
                          <span className="text-slate-300 font-medium">VCT Champions</span>
                          <span className="font-display font-bold text-white">9h 10m</span>
                        </div>
                        <div className="w-full bg-slate-800/80 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-gradient-to-r from-purple-500 to-cyan-400 h-full w-[38%]" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Navigation */}
                  <div className="relative z-10 flex items-center justify-between">
                    <button
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={handlePrev}
                      className="flex items-center gap-1 text-slate-400 hover:text-white transition text-xs font-display cursor-pointer"
                    >
                      <ChevronDown className="w-4 h-4 rotate-180 text-purple-400" />
                      <span>Prev</span>
                    </button>

                    <button
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={handleNext}
                      className="flex flex-col items-center group cursor-pointer focus:outline-none"
                    >
                      <ChevronUp className="w-5 h-5 text-cyan-400 animate-bounce group-hover:text-white filter drop-shadow-[0_0_8px_#22d3ee]" />
                      <span className="text-[11px] font-bold text-slate-300 group-hover:text-cyan-300 tracking-wider">
                        Swipe Up
                      </span>
                    </button>

                    <div className="w-10" />
                  </div>
                </div>
              )}

              {/* ========================================================================= */}
              {/* SECTION 3: "Your favorite team was Team Spirit."                           */}
              {/* ========================================================================= */}
              {activeSlide === 2 && (
                <div className="w-full h-full relative flex flex-col justify-between p-6 pt-16 pb-8 overflow-hidden bg-gradient-to-b from-[#11081b] via-[#150a24] to-[#07050d]">
                  <div className="absolute inset-0 cyber-grid opacity-20 pointer-events-none" />

                  {/* Glowing Violet Orbs */}
                  <div className="absolute top-1/3 -left-20 w-64 h-64 rounded-full bg-purple-600/25 blur-[75px] pointer-events-none" />
                  <div className="absolute bottom-1/3 -right-20 w-64 h-64 rounded-full bg-fuchsia-600/20 blur-[75px] pointer-events-none" />

                  {/* Header */}
                  <div className="relative z-10 text-center flex flex-col items-center mt-2">
                    <span className="text-xs uppercase font-display font-black tracking-widest text-purple-400 mb-1">
                      TOP ROSTER
                    </span>
                    <h1 className="text-4xl sm:text-5xl font-black font-display tracking-tight text-3d-metallic uppercase leading-none">
                      TEAM SPIRIT
                    </h1>
                    <h2 className="text-base sm:text-lg font-black font-display tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-purple-300 via-white to-cyan-300 uppercase mt-2">
                      YOUR FAVORITE TEAM
                    </h2>
                    <p className="text-xs text-slate-300/80 font-medium max-w-[280px] mt-1.5 leading-snug">
                      Your favorite team was Team Spirit. The dragon banner reigned supreme across your watch feed.
                    </p>
                  </div>

                  {/* Central 3D Graphic (Champion Trophy) */}
                  <div className="relative z-10 flex-1 flex items-center justify-center my-2">
                    <div className="relative flex items-center justify-center">
                      <div className="absolute w-44 h-44 rounded-full border-2 border-purple-500/50 shadow-[0_0_35px_#a855f7] animate-pulse" />
                      <div className="absolute w-56 h-56 rounded-full border border-cyan-400/40" />

                      <div className="w-32 h-32 rounded-3xl bg-gradient-to-br from-purple-600/30 via-indigo-950/80 to-slate-900 border border-purple-400/50 flex flex-col items-center justify-center shadow-[0_0_45px_rgba(168,85,247,0.4)] backdrop-blur-md">
                        <span className="text-6xl filter drop-shadow-[0_12px_18px_rgba(0,0,0,0.8)]">
                          🏆
                        </span>
                        <span className="text-[10px] font-display font-black uppercase tracking-widest text-cyan-300 mt-1">
                          CHAMPIONS
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Glassmorphism Card: Spirit Recap */}
                  <div className="relative z-10 w-full mb-3">
                    <div className="wrapped-glass-card rounded-2xl p-4 border border-white/20">
                      <div className="grid grid-cols-2 gap-3 text-center">
                        <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                          <span className="text-[10px] uppercase font-bold text-slate-400 font-display tracking-wider block">
                            Matches Watched
                          </span>
                          <span className="text-2xl font-black font-display text-white block mt-0.5">
                            18
                          </span>
                        </div>

                        <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                          <span className="text-[10px] uppercase font-bold text-cyan-300 font-display tracking-wider block">
                            Prediction Rate
                          </span>
                          <span className="text-2xl font-black font-display text-cyan-300 block mt-0.5">
                            89%
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 text-slate-300">
                          <Flame className="w-4 h-4 text-purple-400" />
                          <span>Clutch Win: 3-1 vs FaZe Clan</span>
                        </div>
                        <span className="font-display font-bold text-purple-300 uppercase text-[10px] tracking-wider">
                          Tier 1 Fan
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Navigation */}
                  <div className="relative z-10 flex items-center justify-between">
                    <button
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={handlePrev}
                      className="flex items-center gap-1 text-slate-400 hover:text-white transition text-xs font-display cursor-pointer"
                    >
                      <ChevronDown className="w-4 h-4 rotate-180 text-purple-400" />
                      <span>Prev</span>
                    </button>

                    <button
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={handleNext}
                      className="flex flex-col items-center group cursor-pointer focus:outline-none"
                    >
                      <ChevronUp className="w-5 h-5 text-cyan-400 animate-bounce group-hover:text-white filter drop-shadow-[0_0_8px_#22d3ee]" />
                      <span className="text-[11px] font-bold text-slate-300 group-hover:text-cyan-300 tracking-wider">
                        Swipe Up
                      </span>
                    </button>

                    <div className="w-10" />
                  </div>
                </div>
              )}

              {/* ========================================================================= */}
              {/* SECTION 4: "You voted in 120 POLLS while watching live."                   */}
              {/* ========================================================================= */}
              {activeSlide === 3 && (
                <div className="w-full h-full relative flex flex-col justify-between p-6 pt-16 pb-6 overflow-hidden bg-gradient-to-b from-[#0a0818] via-[#0e0a22] to-[#05060e]">
                  <div className="absolute inset-0 cyber-grid opacity-25 pointer-events-none" />

                  {/* Glowing Accent Halos */}
                  <div className="absolute top-1/4 -right-24 w-72 h-72 rounded-full bg-purple-600/30 blur-[80px] pointer-events-none" />
                  <div className="absolute bottom-1/4 -left-24 w-72 h-72 rounded-full bg-cyan-500/25 blur-[80px] pointer-events-none" />

                  {/* Header */}
                  <div className="relative z-10 text-center flex flex-col items-center mt-1">
                    <span className="text-xs uppercase font-display font-black tracking-widest text-cyan-400 mb-1">
                      ARENA PARTICIPATION
                    </span>
                    <h1 className="text-5xl sm:text-6xl font-black font-display tracking-tight text-3d-purple uppercase leading-none">
                      120 POLLS
                    </h1>
                    <h2 className="text-base sm:text-lg font-black font-display tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-white to-purple-300 uppercase mt-2">
                      WHILE WATCHING LIVE
                    </h2>
                    <p className="text-xs text-slate-300/80 font-medium max-w-[280px] mt-1.5 leading-snug">
                      You voted in 120 POLLS while watching live. Always in the arena, never on the sidelines.
                    </p>
                  </div>

                  {/* Central 3D Graphic (Lightning Bolt) */}
                  <div className="relative z-10 flex-1 flex items-center justify-center my-1">
                    <div className="relative flex flex-col items-center justify-center">
                      <div className="absolute w-40 h-40 rounded-full border border-purple-500/50 animate-ping opacity-40 pointer-events-none" />
                      <div className="absolute w-48 h-48 rounded-full border border-cyan-400/40 pointer-events-none" />

                      <button
                        type="button"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={triggerConfettiCelebration}
                        title="Tap for confetti celebration! 🎉"
                        className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-gradient-to-br from-indigo-600/40 via-purple-700/30 to-cyan-500/20 border border-cyan-400/50 flex flex-col items-center justify-center shadow-[0_0_45px_rgba(6,182,212,0.4)] backdrop-blur-md active:scale-95 hover:border-cyan-300 transition-all cursor-pointer group"
                      >
                        <span className="text-5xl filter drop-shadow-[0_10px_15px_rgba(0,0,0,0.8)] group-hover:scale-110 transition-transform">
                          ⚡
                        </span>
                        <span className="text-[9px] font-display font-black tracking-widest text-cyan-300 uppercase mt-0.5">
                          120 CLUTCHES
                        </span>
                      </button>

                      <button
                        type="button"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={triggerConfettiCelebration}
                        className="flex items-center gap-1 mt-1.5 text-[10px] text-cyan-300/80 hover:text-cyan-200 font-bold tracking-wider uppercase transition cursor-pointer"
                      >
                        <Sparkles className="w-3 h-3 text-cyan-400 animate-pulse" />
                        <span>Tap to celebrate 🎉</span>
                      </button>
                    </div>
                  </div>

                  {/* Glassmorphism Card: Live Predictions Stat Box */}
                  <div className="relative z-10 w-full mb-2">
                    <div className="wrapped-glass-card rounded-2xl p-3 sm:p-3.5 border border-white/20">
                      <div className="grid grid-cols-2 gap-2 text-center">
                        <div className="p-2 rounded-xl bg-white/5 border border-white/10">
                          <span className="text-[10px] uppercase font-bold text-slate-400 font-display tracking-wider block">
                            Poll Win Rate
                          </span>
                          <span className="text-xl sm:text-2xl font-black font-display text-cyan-300 block">
                            78%
                          </span>
                        </div>
                        <div className="p-2 rounded-xl bg-white/5 border border-white/10">
                          <span className="text-[10px] uppercase font-bold text-purple-300 font-display tracking-wider block">
                            Points Won
                          </span>
                          <span className="text-xl sm:text-2xl font-black font-display text-white block">
                            +1,420
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Actions: Share Buttons & Download Image */}
                  <div className="relative z-10 space-y-2.5">
                    {copiedNetwork && (
                      <div className="text-center text-xs font-bold text-cyan-300 bg-cyan-950/80 border border-cyan-500/50 rounded-lg py-1 animate-fade-in shadow-lg">
                        Copied share link for {copiedNetwork}! 🚀
                      </div>
                    )}
                    {downloadSuccess && (
                      <div className="text-center text-xs font-bold text-emerald-300 bg-emerald-950/80 border border-emerald-500/50 rounded-lg py-1 animate-fade-in shadow-lg">
                        Wrapped card downloaded successfully! 📸
                      </div>
                    )}

                    {/* Share Buttons Row: TikTok, IG, X */}
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => handleShare('TikTok')}
                        className="py-2 px-3 rounded-xl bg-white/10 hover:bg-white/20 border border-cyan-400/40 text-cyan-300 hover:text-white flex items-center justify-center gap-1.5 transition font-display text-xs font-bold shadow-md cursor-pointer"
                      >
                        <svg className="w-4 h-4 fill-current text-cyan-400" viewBox="0 0 24 24">
                          <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.29 0 .58.04.86.12V9.42a6.34 6.34 0 0 0-.86-.06 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.75a8.16 8.16 0 0 0 4.77 1.52V6.82a4.85 4.85 0 0 1-1-.13z"/>
                        </svg>
                        <span>TikTok</span>
                      </button>

                      <button
                        type="button"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => handleShare('Instagram')}
                        className="py-2 px-3 rounded-xl bg-white/10 hover:bg-white/20 border border-purple-400/40 text-purple-300 hover:text-white flex items-center justify-center gap-1.5 transition font-display text-xs font-bold shadow-md cursor-pointer"
                      >
                        <svg className="w-4 h-4 fill-none stroke-current stroke-2 text-purple-400" viewBox="0 0 24 24">
                          <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                          <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
                        </svg>
                        <span>Story</span>
                      </button>

                      <button
                        type="button"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => handleShare('X')}
                        className="py-2 px-3 rounded-xl bg-white/10 hover:bg-white/20 border border-cyan-400/40 text-cyan-300 hover:text-white flex items-center justify-center gap-1.5 transition font-display text-xs font-bold shadow-md cursor-pointer"
                      >
                        <svg className="w-3.5 h-3.5 fill-current text-cyan-400" viewBox="0 0 24 24">
                          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                        </svg>
                        <span>Post</span>
                      </button>
                    </div>

                    {/* Download Image Button */}
                    <button
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={handleDownload}
                      disabled={isDownloading}
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 text-white font-display font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(168,85,247,0.5)] border border-white/25 transition active:scale-[0.98] cursor-pointer"
                    >
                      {isDownloading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Rendering Card...</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4" />
                          <span>Download Image</span>
                        </>
                      )}
                    </button>

                    {/* Secondary Navigation: Replay & Back to Arena */}
                    <div className="flex items-center justify-between pt-1 px-1 text-xs">
                      <button
                        type="button"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => goToSlide(0)}
                        className="flex items-center gap-1.5 text-slate-400 hover:text-white transition font-display cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-purple-400" />
                        <span>Replay Wrapped</span>
                      </button>
                      <Link
                        to="/dashboard"
                        onPointerDown={(e) => e.stopPropagation()}
                        className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 font-display font-bold transition"
                      >
                        <span>Dashboard</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Subtle Swipe Guidance bar at the bottom */}
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-28 h-1 rounded-full bg-white/20 pointer-events-none z-30" />
      </div>
    </div>
  );
}
