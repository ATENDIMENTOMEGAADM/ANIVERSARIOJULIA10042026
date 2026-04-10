import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useScroll, useTransform, useSpring } from 'motion/react';
import { 
  Sun, 
  Music, 
  Calendar, 
  MapPin, 
  CheckCircle2, 
  Users, 
  MessageSquare,
  ChevronDown,
  Sparkles,
  Crown,
  Star,
  BookOpen,
  Clock,
  Gamepad2,
  Image as ImageIcon,
  Heart,
  History,
  Map as MapIcon,
  Search,
  Video,
  Plus,
  Trash2,
  Leaf,
  Target
} from 'lucide-react';
import { db, OperationType, handleFirestoreError, storage } from './lib/firebase';
import { collection, addDoc, serverTimestamp, onSnapshot, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './components/ui/card';
import { Toaster } from './components/ui/sonner';
import { toast } from 'sonner';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [guestData, setGuestData] = useState<any>(null);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [activeTab, setActiveTab] = useState('home');
  const [gallerySubTab, setGallerySubTab] = useState('all');
  const [allGuests, setAllGuests] = useState<any[]>([]);
  const [media, setMedia] = useState<any[]>([]);
  const [isMediaLoading, setIsMediaLoading] = useState(false);
  const [mediaForm, setMediaForm] = useState({ url: '', type: 'image', caption: '' });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [gameScore, setGameScore] = useState(0);
  const [riddleAnswer, setRiddleAnswer] = useState('');
  const [showRiddleResult, setShowRiddleResult] = useState(false);
  const [themeSettings, setThemeSettings] = useState<any>(null);
  
  const [isMuted, setIsMuted] = useState(true);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [hasInteracted, setHasInteracted] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    guestsCount: 0,
    message: '',
    confirmed: true
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"]
  });

  const sunY = useTransform(scrollYProgress, [0, 1], [0, 200]);
  const textY = useTransform(scrollYProgress, [0, 1], [0, -100]);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.5], [1, 0.8]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    
    const handleFirstInteraction = () => {
      setHasInteracted(true);
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
      window.removeEventListener('touchstart', handleFirstInteraction);
    };

    window.addEventListener('click', handleFirstInteraction);
    window.addEventListener('keydown', handleFirstInteraction);
    window.addEventListener('touchstart', handleFirstInteraction);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
      window.removeEventListener('touchstart', handleFirstInteraction);
    };
  }, []);

  useEffect(() => {
    if (hasInteracted && !isMuted && audioRef.current) {
      audioRef.current.play().catch(err => console.log("Autoplay blocked:", err));
    } else if (isMuted && audioRef.current) {
      audioRef.current.pause();
    }
  }, [hasInteracted, isMuted]);

  // Seed a demo guest if none exists (for testing)
  useEffect(() => {
    const testConnection = async () => {
      try {
        const { getDocFromServer, doc } = await import('firebase/firestore');
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. The client is offline.");
          toast.error("Erro de conexão com o Banco de Dados.");
        }
      }
    };
    testConnection();
    
    // Seed initial media if empty
    const seedMedia = async () => {
      const path = 'media';
      try {
        const { getDocs, collection, query, limit, addDoc, getDoc, setDoc, doc } = await import('firebase/firestore');
        
        // Seed Media
        const q = query(collection(db, path), limit(1));
        const snapshot = await getDocs(q);
        
        const loginBgUrl = 'https://images.unsplash.com/photo-1605142859862-978be7eba909?q=80&w=2000&auto=format&fit=crop';

        if (snapshot.empty) {
          await addDoc(collection(db, path), {
            url: loginBgUrl,
            type: 'image',
            caption: 'Apolo em Glória Dourada',
            createdAt: serverTimestamp()
          });
        }

        // Seed/Fetch Theme Settings
        const themeRef = doc(db, 'settings', 'theme');
        const themeSnap = await getDoc(themeRef);
        if (!themeSnap.exists()) {
          const initialTheme = {
            loginBgUrl: loginBgUrl,
            updatedAt: serverTimestamp()
          };
          await setDoc(themeRef, initialTheme);
          setThemeSettings(initialTheme);
        } else {
          setThemeSettings(themeSnap.data());
        }
      } catch (error) {
        // Only handle if it's a real error, not just a permission skip
        if (error instanceof Error && error.message.includes('Missing or insufficient permissions')) {
          handleFirestoreError(error, OperationType.CREATE, path);
        } else {
          console.error("Erro ao semear mídia:", error);
        }
      }
    };
    seedMedia();

    console.log("Dica: Use 'convidado' / 'apolo' para testar o login.");
  }, []);

  useEffect(() => {
    if (isLoggedIn) {
      const fetchGuests = async () => {
        try {
          const { getDocs, query, orderBy } = await import('firebase/firestore');
          const q = query(collection(db, 'guests'), orderBy('family', 'asc'));
          const querySnapshot = await getDocs(q);
          const guests = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setAllGuests(guests);
        } catch (error) {
          console.error("Erro ao buscar convidados:", error);
        }
      };
      
      const qMedia = query(collection(db, 'media'), orderBy('createdAt', 'desc'));
      const unsubscribeMedia = onSnapshot(qMedia, (snapshot) => {
        const mediaData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setMedia(mediaData);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'media');
      });

      fetchGuests();
      return () => unsubscribeMedia();
    }
  }, [isLoggedIn]);

  const isAdmin = guestData?.role === 'admin';

  const handleMediaUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setIsMediaLoading(true);
    try {
      let finalUrl = mediaForm.url;

      if (selectedFile) {
        const storageRef = ref(storage, `media/${Date.now()}_${selectedFile.name}`);
        const snapshot = await uploadBytes(storageRef, selectedFile);
        finalUrl = await getDownloadURL(snapshot.ref);
      }

      if (!finalUrl) {
        toast.error('Por favor, forneça uma URL ou selecione um arquivo.');
        setIsMediaLoading(false);
        return;
      }

      await addDoc(collection(db, 'media'), {
        url: finalUrl,
        type: mediaForm.type,
        caption: mediaForm.caption,
        createdAt: serverTimestamp()
      });
      setMediaForm({ url: '', type: 'image', caption: '' });
      setSelectedFile(null);
      toast.success('Mídia adicionada com sucesso!');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'media');
      toast.error('Erro ao adicionar mídia.');
    } finally {
      setIsMediaLoading(false);
    }
  };

  const handleDeleteMedia = async (id: string) => {
    if (!isAdmin) return;
    try {
      await deleteDoc(doc(db, 'media', id));
      toast.success('Mídia removida.');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'media');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    try {
      const { query, where, getDocs } = await import('firebase/firestore');
      const q = query(
        collection(db, 'guests'), 
        where('username', '==', loginForm.username.toLowerCase()),
        where('password', '==', loginForm.password)
      );
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        const data = doc.data();
        setGuestData({ id: doc.id, ...data });
        setFormData(prev => ({ ...prev, name: data.name || '' }));
        setIsLoggedIn(true);
        toast.success(`Bem-vindo ao Olimpo, ${data.name}!`);
      } else {
        toast.error('Credenciais inválidas. Verifique seu convite.');
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'guests');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const { doc, updateDoc } = await import('firebase/firestore');
      const guestRef = doc(db, 'guests', guestData.id);
      await updateDoc(guestRef, {
        ...formData,
        updatedAt: serverTimestamp()
      });
      setIsSubmitted(true);
      toast.success('Presença confirmada com sucesso!');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'guests');
      toast.error('Erro ao confirmar presença.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div ref={containerRef} className="min-h-screen marble-texture selection:bg-gold/30 relative overflow-x-hidden">
      <Toaster position="top-center" />
      
      <audio 
        ref={audioRef}
        src="https://cdn.pixabay.com/audio/2022/03/10/audio_c8c8a73456.mp3"
        loop
        preload="auto"
      />

      <motion.button
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsMuted(!isMuted)}
        className="fixed bottom-6 right-6 z-[100] w-12 h-12 rounded-full bg-black/60 border border-gold/50 flex items-center justify-center text-gold shadow-[0_0_15px_rgba(212,175,55,0.3)] backdrop-blur-md hover:border-gold transition-all"
        title={isMuted ? "Ativar Música" : "Silenciar Música"}
      >
        {isMuted ? (
          <div className="relative">
            <Music className="w-5 h-5 opacity-50" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-[2px] bg-gold rotate-45" />
          </div>
        ) : (
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Music className="w-5 h-5" />
          </motion.div>
        )}
      </motion.button>
      
      {/* Interactive Light Follow */}
      <motion.div 
        className="fixed inset-0 pointer-events-none z-50"
        animate={{
          background: `radial-gradient(600px circle at ${mousePos.x}px ${mousePos.y}px, rgba(212, 175, 55, 0.05), transparent 80%)`
        }}
      />

      {!isLoggedIn ? (
        <div 
          className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden divine-bg"
          style={themeSettings?.loginBgUrl ? { backgroundImage: `radial-gradient(circle at 50% 0%, rgba(255, 215, 0, 0.5) 0%, transparent 70%), linear-gradient(rgba(0,0,0,0.6), rgba(0,0,0,0.3)), url(${themeSettings.loginBgUrl})` } : {}}
        >
          {/* Divine Light Overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-gold/20 via-transparent to-black/60 pointer-events-none z-0" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[60vh] bg-[radial-gradient(ellipse_at_top,_rgba(255,215,0,0.4)_0%,_transparent_70%)] pointer-events-none z-0" />

          {/* Golden Dust / Bokeh Particles */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden z-[1]">
            {[...Array(40)].map((_, i) => {
              const size = 2 + Math.random() * 6;
              const duration = 10 + Math.random() * 20;
              const delay = Math.random() * -20;
              const left = Math.random() * 100;
              
              return (
                <motion.div
                  key={`dust-${i}`}
                  initial={{ 
                    y: "110vh",
                    opacity: 0 
                  }}
                  animate={{ 
                    y: "-10vh",
                    opacity: [0, 0.8, 0.8, 0],
                    x: [0, (Math.random() - 0.5) * 100, 0]
                  }}
                  transition={{ 
                    duration: duration,
                    repeat: Infinity,
                    delay: delay,
                    ease: "easeInOut"
                  }}
                  className="absolute bg-gold-light rounded-full blur-[1px] shadow-[0_0_10px_rgba(255,215,0,0.8)]"
                  style={{ 
                    left: `${left}%`,
                    width: size,
                    height: size
                  }}
                />
              );
            })}
            
            {/* Apollo Symbols */}
            {[...Array(12)].map((_, i) => {
              const Icon = [Sun, Crown, Leaf, Music, Target][i % 5];
              const size = 20 + Math.random() * 30;
              const duration = 25 + Math.random() * 35;
              const delay = Math.random() * -30;
              const left = Math.random() * 100;
              
              return (
                <motion.div
                  key={`symbol-${i}`}
                  initial={{ 
                    y: "110vh",
                    rotate: 0,
                    opacity: 0 
                  }}
                  animate={{ 
                    y: "-20vh",
                    rotate: 360,
                    opacity: [0, 0.5, 0.5, 0],
                  }}
                  transition={{ 
                    duration: duration,
                    repeat: Infinity,
                    delay: delay,
                    ease: "linear"
                  }}
                  className="absolute text-gold-light/40"
                  style={{ left: `${left}%` }}
                >
                  <Icon size={size} strokeWidth={1} />
                </motion.div>
              );
            })}
          </div>

          {/* Animated Background Elements */}
          <div className="absolute inset-0 z-0">
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-5"
            >
              <Sun className="w-[800px] h-[800px] text-gold" strokeWidth={0.2} />
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-[95%] sm:max-w-md z-10"
          >
            <Card className="glass-card border-gold/50 shadow-[0_0_50px_rgba(184,134,11,0.4)] rounded-none relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 gold-gradient shadow-[0_0_15px_rgba(255,215,0,0.8)]" />
              <CardHeader className="text-center space-y-6 pt-10 sm:pt-14">
                <div className="flex justify-center relative">
                  <motion.div
                    animate={{ scale: [1, 1.1, 1], opacity: [0.8, 1, 0.8] }}
                    transition={{ duration: 3, repeat: Infinity }}
                    className="absolute inset-0 bg-gold/20 blur-2xl rounded-full"
                  />
                  <Crown className="w-12 h-12 sm:w-16 sm:h-16 text-gold-light drop-shadow-[0_0_10px_rgba(255,215,0,0.8)]" />
                </div>
                <div className="space-y-2">
                  <CardTitle className="text-4xl sm:text-5xl font-serif gold-text-shimmer tracking-[0.25em] drop-shadow-lg">
                    OLIMPO
                  </CardTitle>
                  <div className="h-[1px] w-24 bg-gradient-to-r from-transparent via-gold to-transparent mx-auto" />
                </div>
                <CardDescription className="flex flex-col items-center space-y-3">
                  <span className="text-gold-light font-serif italic tracking-[0.2em] text-base sm:text-lg drop-shadow-md">
                    "Ao poderoso como um deus"
                  </span>
                  <span className="text-white/60 font-sans tracking-[0.3em] uppercase text-[10px] sm:text-xs">
                    Portal de Acesso Sagrado
                  </span>
                </CardDescription>
              </CardHeader>
              <CardContent className="p-8 sm:p-10">
                <form onSubmit={handleLogin} className="space-y-8">
                  <div className="space-y-3">
                    <Label className="text-gold-light uppercase tracking-[0.3em] text-[10px] font-bold">Identidade</Label>
                    <div className="relative group">
                      <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gold/60 group-focus-within:text-gold transition-colors" />
                      <Input 
                        required
                        placeholder="USUÁRIO"
                        className="bg-black/40 border-gold/30 focus:border-gold pl-10 h-14 rounded-none tracking-[0.2em] text-white placeholder:text-white/20 transition-all"
                        value={loginForm.username}
                        onChange={(e) => setLoginForm({...loginForm, username: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Label className="text-gold-light uppercase tracking-[0.3em] text-[10px] font-bold">Chave de Acesso</Label>
                    <div className="relative group">
                      <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gold/60 group-focus-within:text-gold transition-colors" />
                      <Input 
                        type="password"
                        required
                        placeholder="SENHA"
                        className="bg-black/40 border-gold/30 focus:border-gold pl-10 h-14 rounded-none tracking-[0.2em] text-white placeholder:text-white/20 transition-all"
                        value={loginForm.password}
                        onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                      />
                    </div>
                  </div>
                  <Button 
                    type="submit" 
                    disabled={isLoggingIn}
                    className="w-full gold-button gold-gradient text-white font-serif tracking-[0.4em] h-16 rounded-none mt-6 shadow-[0_0_20px_rgba(212,175,55,0.3)] hover:shadow-[0_0_30px_rgba(212,175,55,0.5)] transition-all text-lg"
                  >
                    {isLoggingIn ? 'CONSULTANDO ORÁCULO...' : 'ASCENDER AO OLIMPO'}
                  </Button>
                </form>
                
                  <div className="mt-8 text-center space-y-4">
                    <div className="flex flex-col sm:flex-row justify-center gap-2">
                      <Button 
                        variant="link" 
                        className="text-[10px] text-gold-light/40 uppercase tracking-[0.4em] hover:text-gold-light transition-colors"
                        onClick={async () => {
                          try {
                            await addDoc(collection(db, 'guests'), {
                              username: 'convidado',
                              password: 'apolo',
                              name: 'Convidado de Honra',
                              role: 'guest',
                              greekProfile: {
                                title: 'HERÓI DO OLIMPO',
                                description: 'Um lendário guerreiro cuja bravura ecoa pelos séculos, convidado pessoalmente por Apolo.'
                              },
                              createdAt: serverTimestamp()
                            });
                            toast.success('Convidado demo criado! Use convidado / apolo');
                          } catch (error) {
                            console.error("Erro ao criar demo:", error);
                            toast.error("Erro ao gerar convite.");
                          }
                        }}
                      >
                        SOLICITAR BENÇÃO DE TESTE
                      </Button>
                      <Button 
                        variant="link" 
                        className="text-[10px] text-gold/40 uppercase tracking-widest hover:text-gold"
                        onClick={async () => {
                          try {
                            await addDoc(collection(db, 'guests'), {
                              username: 'admin',
                              password: 'julia',
                              name: 'Administrador',
                              role: 'admin',
                              greekProfile: {
                                title: 'GUARDIÃO DO OLIMPO',
                                description: 'Responsável por manter a ordem e a beleza divina no evento.'
                              },
                              createdAt: serverTimestamp()
                            });
                            toast.success('Admin demo criado! Use admin / julia');
                          } catch (error) {
                            console.error("Erro ao criar admin demo:", error);
                            toast.error('Erro ao criar admin demo.');
                          }
                        }}
                      >
                        Gerar Admin de Teste
                      </Button>
                    </div>
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest">
                      Julia Dantas Almeida Pacheco • 15 Anos
                    </p>
                  </div>
              </CardContent>
            </Card>
            
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              transition={{ delay: 1 }}
              className="text-center mt-6 text-xs text-slate-500 font-serif tracking-widest italic"
            >
              "Apenas os convidados de Apolo podem cruzar este portal"
            </motion.p>
          </motion.div>
        </div>
      ) : (
        <div className="pb-20 sm:pb-0 sm:pt-20">
          {/* Top Header (Logo & Logout) */}
          <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gold/10 py-4 px-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Crown className="w-6 h-6 text-gold" />
              <span className="font-serif text-gold tracking-[0.2em] text-lg font-bold">JULIA 15</span>
            </div>
            <Button 
              variant="ghost" 
              size="sm"
              className="text-[10px] text-gold/60 hover:text-gold tracking-widest font-bold"
              onClick={() => setIsLoggedIn(false)}
            >
              SAIR
            </Button>
          </header>

          {/* Bottom Navigation (Instagram Style) */}
          <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-lg border-t border-gold/10 py-2 sm:py-4 px-2 sm:px-4">
            <div className="max-w-lg mx-auto flex items-center justify-around">
              {[
                { id: 'home', label: 'INÍCIO', icon: Sun },
                { id: 'mitos', label: 'MITOS', icon: BookOpen },
                { id: 'jornada', label: 'JORNADA', icon: Clock },
                { id: 'oraculo', label: 'ORÁCULO', icon: Gamepad2 },
                { id: 'galeria', label: 'GALERIA', icon: ImageIcon },
                { id: 'convidados', label: 'CONVIDADOS', icon: Users },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className={`flex flex-col items-center gap-1 transition-all ${
                    activeTab === tab.id ? 'text-gold scale-110' : 'text-slate-400 hover:text-gold/60'
                  }`}
                >
                  <tab.icon className={`w-5 h-5 sm:w-6 sm:h-6 ${activeTab === tab.id ? 'fill-gold/20' : ''}`} />
                  <span className="text-[8px] sm:text-[10px] font-bold tracking-tighter sm:tracking-widest uppercase">
                    {tab.label}
                  </span>
                </button>
              ))}
            </div>
          </nav>

          <AnimatePresence mode="wait">
            {activeTab === 'home' && (
              <motion.div
                key="home"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
              >
                {/* Hero Section */}
          <section className="relative h-screen flex flex-col items-center justify-center text-center px-4 overflow-hidden">
            {/* Animated Sunbeams */}
            <div className="absolute inset-0 z-0 opacity-20">
              {[...Array(12)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute top-1/2 left-1/2 w-[200vw] h-[2px] bg-gold origin-left"
                  style={{ rotate: i * 30 }}
                  animate={{
                    opacity: [0.2, 0.5, 0.2],
                    scaleX: [1, 1.1, 1],
                  }}
                  transition={{
                    duration: 4 + i % 3,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                />
              ))}
            </div>

            <motion.div 
              style={{ y: sunY, opacity, scale }}
              className="z-10 flex flex-col items-center"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
                className="relative mb-8"
              >
                <Sun className="w-32 h-32 md:w-48 md:h-48 text-gold" strokeWidth={0.5} />
                <motion.div 
                  animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                  transition={{ duration: 3, repeat: Infinity }}
                  className="absolute inset-0 blur-3xl bg-gold/40 rounded-full" 
                />
              </motion.div>
              
              <motion.div style={{ y: textY }}>
                <h1 className="text-5xl sm:text-7xl md:text-9xl font-serif gold-text-shimmer mb-4 sm:mb-6 tracking-[0.1em] sm:tracking-[0.2em]">
                  JULIA
                </h1>
                <p className="text-sm sm:text-lg md:text-2xl font-sans font-light text-slate-500 tracking-[0.3em] sm:tracking-[0.5em] uppercase mb-8 sm:mb-12">
                  15 Anos • O Brilho de Apolo
                </p>
                
                <div className="flex flex-col items-center gap-4 sm:gap-6">
                  <Button 
                    variant="outline" 
                    className="gold-button gold-border hover:bg-gold/5 text-gold font-serif tracking-[0.2em] sm:tracking-[0.3em] px-8 sm:px-12 py-6 sm:py-8 text-lg sm:text-xl rounded-none transition-all duration-500 w-full sm:w-auto"
                    onClick={() => document.getElementById('details')?.scrollIntoView({ behavior: 'smooth' })}
                  >
                    EXPLORAR O OLIMPO
                  </Button>
                  
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-2 text-gold/60 font-serif text-sm tracking-widest"
                  >
                    <Star className="w-3 h-3 fill-gold" />
                    <span>BEM-VINDO, {guestData?.name?.toUpperCase()}</span>
                    <Star className="w-3 h-3 fill-gold" />
                  </motion.div>
                </div>
              </motion.div>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              transition={{ delay: 2 }}
              className="absolute bottom-12 left-1/2 -translate-x-1/2 animate-bounce"
            >
              <ChevronDown className="text-gold w-10 h-10" />
            </motion.div>
          </section>

          {/* Greek Profile Section */}
          <section className="py-24 px-4 bg-gold/5 border-y border-gold/10 relative overflow-hidden">
            {/* Decorative Greek Assets (Simulated PNGs) */}
            <motion.div 
              animate={{ y: [0, -15, 0], rotate: [0, 2, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -top-10 -left-10 opacity-10 pointer-events-none hidden lg:block"
            >
              <img 
                src="https://picsum.photos/seed/greek-vase-1/400/600" 
                alt="Vaso Grego" 
                className="w-64 h-auto grayscale sepia brightness-125 mix-blend-multiply"
                referrerPolicy="no-referrer"
              />
            </motion.div>

            <div className="max-w-4xl mx-auto text-center space-y-8 sm:space-y-12 relative z-10">
              <motion.div
                whileInView={{ opacity: 1, y: 0 }}
                initial={{ opacity: 0, y: 20 }}
                viewport={{ once: true }}
                className="space-y-4"
              >
                <Crown className="w-8 h-8 sm:w-10 sm:h-10 text-gold mx-auto" />
                <h2 className="text-3xl sm:text-4xl font-serif text-gold tracking-[0.2em] sm:tracking-[0.3em]">SEU PERFIL GREGO</h2>
                <div className="w-16 sm:w-20 h-[1px] bg-gold mx-auto" />
              </motion.div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 items-center">
                <motion.div 
                  whileInView={{ opacity: 1, x: 0 }}
                  initial={{ opacity: 0, x: -50 }}
                  viewport={{ once: true }}
                  className="glass-card p-6 sm:p-10 space-y-4 sm:space-y-6 text-left border-l-4 border-l-gold relative overflow-hidden group"
                >
                  <div className="absolute -right-10 -bottom-10 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Music className="w-32 h-32 sm:w-40 sm:h-40 text-gold rotate-12" />
                  </div>
                  
                  <div className="space-y-1">
                    <p className="text-[8px] sm:text-[10px] text-gold font-bold tracking-[0.2em] sm:tracking-[0.3em] uppercase">Convidado de Honra</p>
                    <h4 className="text-2xl sm:text-3xl font-serif text-slate-800">{guestData?.name}</h4>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs sm:text-sm text-slate-500 font-serif italic leading-relaxed">
                      {guestData?.greekProfile?.description || "Um nobre viajante convocado pelas divindades para celebrar o florescer de uma nova era."}
                    </p>
                    <div className="flex items-center gap-2 text-gold">
                      <Star className="w-3 h-3 sm:w-4 sm:h-4 fill-gold" />
                      <span className="text-[10px] sm:text-xs font-bold tracking-widest uppercase">{guestData?.greekProfile?.title || "PROTEGIDO DE APOLO"}</span>
                    </div>
                  </div>
                </motion.div>

                <motion.div 
                  whileInView={{ opacity: 1, x: 0 }}
                  initial={{ opacity: 0, x: 50 }}
                  viewport={{ once: true }}
                  className="space-y-6"
                >
                  {/* Interactive Systems */}
                  <div className="flex justify-center gap-4 sm:gap-6 mb-2 sm:mb-4">
                    <motion.div 
                      whileHover={{ scale: 1.1, rotate: 5 }}
                      whileTap={{ scale: 0.9 }}
                      className="cursor-pointer p-3 sm:p-4 rounded-full bg-gold/10 border border-gold/20 group relative"
                      onClick={() => toast.info("A Lira de Apolo ecoa em sua honra!")}
                    >
                      <Music className="w-6 h-6 sm:w-8 sm:h-8 text-gold group-hover:animate-bounce" />
                      <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[8px] text-gold font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">TOCAR LIRA</span>
                    </motion.div>
                    
                    <motion.div 
                      whileHover={{ scale: 1.1, rotate: -5 }}
                      whileTap={{ scale: 0.9 }}
                      className="cursor-pointer p-3 sm:p-4 rounded-full bg-gold/10 border border-gold/20 group relative"
                      onClick={() => toast.info("O Oráculo prevê uma noite inesquecível.")}
                    >
                      <Sparkles className="w-6 h-6 sm:w-8 sm:h-8 text-gold group-hover:animate-pulse" />
                      <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[8px] text-gold font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">ORÁCULO</span>
                    </motion.div>
                  </div>

                  <p className="text-slate-600 font-light leading-relaxed text-base sm:text-lg italic px-4 sm:px-0">
                    "Como um verdadeiro habitante do Olimpo, sua presença é a luz que completa este banquete. Julia aguarda sua chegada triunfal."
                  </p>
                  <Button 
                    variant="ghost" 
                    className="text-gold hover:bg-gold/5 tracking-[0.2em] font-serif text-sm sm:text-base"
                    onClick={() => setIsLoggedIn(false)}
                  >
                    SAIR DO PORTAL
                  </Button>
                </motion.div>
              </div>
            </div>
          </section>

          {/* Greek Metadata Section */}
          <section className="py-16 px-4 bg-white/40 backdrop-blur-sm border-b border-gold/10">
            <div className="max-w-6xl mx-auto">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {[
                  { label: "DEUS PATRONO", value: "APOLO", desc: "Luz e Artes" },
                  { label: "SÍMBOLO", value: "LIRA", desc: "Harmonia" },
                  { label: "LOCAL", value: "OLIMPO", desc: "Morada Divina" },
                  { label: "ERA", value: "OURO", desc: "Ciclo de Julia" }
                ].map((meta, i) => (
                  <motion.div
                    key={i}
                    whileHover={{ y: -5 }}
                    className="p-6 border border-gold/10 bg-white/60 text-center space-y-2 group"
                  >
                    <p className="text-[10px] text-gold font-bold tracking-widest group-hover:scale-110 transition-transform">{meta.label}</p>
                    <p className="text-2xl font-serif text-slate-800">{meta.value}</p>
                    <p className="text-[10px] text-slate-400 italic">{meta.desc}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>

          {/* Details Section */}
          <section id="details" className="py-16 sm:py-32 px-4 max-w-7xl mx-auto relative">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-16 relative z-10">
              {[
                { icon: Calendar, title: "QUANDO", detail: "Sábado, 23 de Maio de 2026", sub: "Às 21:00 Horas", delay: 0 },
                { icon: MapPin, title: "ONDE", detail: "Palácio de Mármore", sub: "Av. Olimpo, 1000 - São Paulo", delay: 0.2 },
                { icon: Music, title: "TRAJE", detail: "Gala com Toque Dourado", sub: "Black Tie & Gold Accents", delay: 0.4 }
              ].map((item, idx) => (
                <motion.div 
                  key={idx}
                  whileInView={{ opacity: 1, y: 0 }}
                  initial={{ opacity: 0, y: 50 }}
                  viewport={{ once: true }}
                  transition={{ delay: item.delay, duration: 0.8 }}
                  className="group p-6 sm:p-8 text-center space-y-4 sm:space-y-6 hover:bg-white/40 transition-all duration-500 rounded-2xl border border-transparent hover:border-gold/20"
                >
                  <div className="flex justify-center">
                    <div className="relative">
                      <item.icon className="w-10 h-10 sm:w-12 sm:h-12 text-gold group-hover:scale-110 transition-transform duration-500" />
                      <div className="absolute inset-0 blur-lg bg-gold/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-serif text-gold tracking-[0.2em] sm:tracking-widest">{item.title}</h3>
                  <div className="space-y-1 sm:space-y-2">
                    <p className="text-slate-800 text-lg sm:text-xl font-medium">{item.detail}</p>
                    <p className="text-slate-500 font-light tracking-wide text-xs sm:text-base">{item.sub}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>

          {/* RSVP Section */}
          <section id="rsvp" className="py-16 sm:py-32 px-4 relative">
            <div className="max-w-3xl mx-auto relative z-10">
              <motion.div
                whileInView={{ opacity: 1, y: 0 }}
                initial={{ opacity: 0, y: 50 }}
                viewport={{ once: true }}
              >
                <Card className="glass-card border-gold/30 overflow-hidden">
                  <div className="h-2 gold-gradient w-full" />
                  <CardHeader className="text-center pt-8 sm:pt-12">
                    <CardTitle className="text-3xl sm:text-5xl font-serif gold-text-shimmer mb-2 sm:mb-4 tracking-tighter sm:tracking-normal">R.S.V.P</CardTitle>
                    <CardDescription className="text-slate-600 font-sans tracking-[0.1em] sm:tracking-[0.2em] uppercase text-xs sm:text-sm px-4">
                      Confirmação de Presença • Até 01 de Maio
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-6 sm:p-12">
                    <AnimatePresence mode="wait">
                      {!isSubmitted ? (
                        <motion.form 
                          key="form"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          onSubmit={handleSubmit} 
                          className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8"
                        >
                          <div className="md:col-span-2 space-y-2 sm:space-y-3">
                            <Label htmlFor="name" className="text-slate-500 uppercase tracking-widest text-[10px] sm:text-xs font-semibold">Nome do Convidado</Label>
                            <Input 
                              id="name" 
                              required 
                              placeholder="DIGITE SEU NOME"
                              className="bg-white/50 border-gold/20 focus:border-gold h-12 sm:h-14 text-base sm:text-lg tracking-wider rounded-none"
                              value={formData.name}
                              onChange={(e) => setFormData({...formData, name: e.target.value})}
                            />
                          </div>
                          
                          <div className="space-y-2 sm:space-y-3">
                            <Label htmlFor="email" className="text-slate-500 uppercase tracking-widest text-[10px] sm:text-xs font-semibold">E-mail</Label>
                            <Input 
                              id="email" 
                              type="email"
                              placeholder="EMAIL@EXEMPLO.COM"
                              className="bg-white/50 border-gold/20 focus:border-gold h-12 sm:h-14 rounded-none text-sm sm:text-base"
                              value={formData.email}
                              onChange={(e) => setFormData({...formData, email: e.target.value})}
                            />
                          </div>
                          <div className="space-y-2 sm:space-y-3">
                            <Label htmlFor="phone" className="text-slate-500 uppercase tracking-widest text-[10px] sm:text-xs font-semibold">Celular</Label>
                            <Input 
                              id="phone" 
                              placeholder="(00) 00000-0000"
                              className="bg-white/50 border-gold/20 focus:border-gold h-12 sm:h-14 rounded-none text-sm sm:text-base"
                              value={formData.phone}
                              onChange={(e) => setFormData({...formData, phone: e.target.value})}
                            />
                          </div>

                          <div className="space-y-2 sm:space-y-3">
                            <Label htmlFor="guests" className="text-slate-500 uppercase tracking-widest text-[10px] sm:text-xs font-semibold">Acompanhantes</Label>
                            <div className="flex items-center gap-4 bg-white/50 border border-gold/20 p-4 h-12 sm:h-14">
                              <Users className="text-gold w-5 h-5" />
                              <input 
                                id="guests" 
                                type="number" 
                                min="0" 
                                max="10"
                                className="bg-transparent border-none focus:ring-0 w-full text-base sm:text-lg"
                                value={formData.guestsCount}
                                onChange={(e) => setFormData({...formData, guestsCount: parseInt(e.target.value) || 0})}
                              />
                            </div>
                          </div>

                          <div className="md:col-span-2 space-y-2 sm:space-y-3">
                            <Label htmlFor="message" className="text-slate-500 uppercase tracking-widest text-[10px] sm:text-xs font-semibold">Mensagem para Julia</Label>
                            <textarea 
                              id="message"
                              rows={4}
                              className="w-full p-4 bg-white/50 border border-gold/20 focus:outline-none focus:border-gold transition-all rounded-none text-base sm:text-lg"
                              placeholder="SUA MENSAGEM..."
                              value={formData.message}
                              onChange={(e) => setFormData({...formData, message: e.target.value})}
                            />
                          </div>

                          <div className="md:col-span-2 pt-4">
                            <Button 
                              type="submit" 
                              disabled={isSubmitting}
                              className="w-full gold-button gold-gradient text-white font-serif tracking-[0.2em] sm:tracking-[0.4em] h-14 sm:h-16 text-lg sm:text-xl rounded-none shadow-xl hover:shadow-gold/20 transition-all"
                            >
                              {isSubmitting ? 'PROCESSANDO...' : 'CONFIRMAR PRESENÇA'}
                            </Button>
                          </div>
                        </motion.form>
                      ) : (
                        <motion.div 
                          key="success"
                          initial={{ scale: 0.9, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          className="text-center py-8 sm:py-16 space-y-6 sm:space-y-8"
                        >
                          <div className="relative inline-block">
                            <CheckCircle2 className="w-16 h-16 sm:w-24 h-24 text-gold" />
                            <motion.div 
                              animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                              transition={{ duration: 2, repeat: Infinity }}
                              className="absolute inset-0 bg-gold rounded-full"
                            />
                          </div>
                          <div className="space-y-4">
                            <h3 className="text-3xl sm:text-4xl font-serif text-gold">Presença Confirmada</h3>
                            <p className="text-slate-600 text-base sm:text-lg max-w-md mx-auto px-4">
                              Sua confirmação foi registrada no Palácio de Mármore. Julia espera por você!
                            </p>
                          </div>
                          <Button 
                            variant="ghost" 
                            className="text-gold hover:text-gold/80 tracking-widest uppercase font-semibold text-xs sm:text-sm"
                            onClick={() => setIsSubmitted(false)}
                          >
                            Enviar outra confirmação
                          </Button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </section>

          {/* Location Map Section */}
          <section className="py-16 sm:py-24 px-4 bg-gold/5 border-y border-gold/10">
            <div className="max-w-6xl mx-auto space-y-8 sm:space-y-12">
              <div className="text-center space-y-4">
                <MapIcon className="w-8 h-8 sm:w-10 sm:h-10 text-gold mx-auto" />
                <h2 className="text-3xl sm:text-4xl font-serif text-gold tracking-[0.2em] sm:tracking-[0.3em]">LOCALIZAÇÃO</h2>
                <p className="text-slate-500 font-serif italic text-sm sm:text-base">O caminho para o Palácio de Mármore.</p>
              </div>
              
              <div className="relative h-[300px] sm:h-[400px] w-full glass-card border-gold/20 overflow-hidden group">
                <img 
                  src="https://picsum.photos/seed/map-location/1600/800" 
                  alt="Mapa de Localização" 
                  className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-1000"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gold/10 mix-blend-overlay pointer-events-none" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                  <motion.div 
                    animate={{ y: [0, -10, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="relative"
                  >
                    <MapPin className="w-10 h-10 sm:w-12 sm:h-12 text-gold fill-gold/20" />
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-1 bg-black/20 blur-sm rounded-full" />
                  </motion.div>
                </div>
                <div className="absolute bottom-4 sm:bottom-8 right-4 sm:right-8 p-4 sm:p-6 glass-card border-gold/30 max-w-[250px] sm:max-w-xs">
                  <p className="text-gold font-serif text-base sm:text-lg mb-1 sm:mb-2">Palácio de Mármore</p>
                  <p className="text-slate-600 text-[10px] sm:text-xs leading-relaxed">
                    Av. Olimpo, 1000 - Jardins do Olimpo, São Paulo - SP. Estacionamento com manobrista no local.
                  </p>
                  <Button 
                    variant="link" 
                    className="text-gold p-0 h-auto text-[8px] sm:text-[10px] mt-2 sm:mt-4 tracking-widest uppercase font-bold"
                    onClick={() => window.open('https://maps.google.com', '_blank')}
                  >
                    ABRIR NO GOOGLE MAPS
                  </Button>
                </div>
              </div>
            </div>
          </section>
        </motion.div>
      )}

      {activeTab === 'mitos' && (
              <motion.div
                key="mitos"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="py-12 sm:py-20 px-4 max-w-5xl mx-auto space-y-16 sm:space-y-24"
              >
                <div className="text-center space-y-4 sm:space-y-6">
                  <BookOpen className="w-10 h-10 sm:w-12 sm:h-12 text-gold mx-auto" />
                  <h2 className="text-3xl sm:text-5xl font-serif text-gold tracking-[0.2em] sm:tracking-[0.3em]">MITOS E LENDAS</h2>
                  <p className="text-slate-500 font-serif italic max-w-2xl mx-auto text-sm sm:text-base px-4">
                    Viaje pelos contos do Olimpo e descubra a história de Apolo, o deus que inspira esta celebração.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-16 items-center">
                  <div className="space-y-4 sm:space-y-6 text-center md:text-left">
                    <h3 className="text-2xl sm:text-3xl font-serif text-slate-800 border-b border-gold/20 pb-4">Apolo: O Deus da Luz</h3>
                    <p className="text-slate-600 leading-relaxed text-sm sm:text-base">
                      Filho de Zeus e Leto, Apolo é uma das divindades mais complexas e importantes do Olimpo. Conhecido como o deus do sol, da música, da poesia, da profecia e da cura, ele personifica a ordem, a harmonia e a razão.
                    </p>
                    <p className="text-slate-600 leading-relaxed text-sm sm:text-base">
                      Sua carruagem dourada cruza os céus diariamente, trazendo a luz ao mundo, assim como Julia traz brilho à vida de todos ao seu redor nestes 15 anos.
                    </p>
                  </div>
                  <div className="relative group px-4 sm:px-0">
                    <img 
                      src="https://picsum.photos/seed/apollo-statue/800/1000" 
                      alt="Apolo" 
                      className="w-full h-auto rounded-none shadow-2xl grayscale hover:grayscale-0 transition-all duration-700"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 border-2 border-gold/30 -m-2 sm:-m-4 pointer-events-none group-hover:m-0 transition-all duration-500" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-16 items-center">
                  <div className="relative order-2 md:order-1 group px-4 sm:px-0">
                    <img 
                      src="https://picsum.photos/seed/greek-temple/800/1000" 
                      alt="Grécia Antiga" 
                      className="w-full h-auto rounded-none shadow-2xl grayscale hover:grayscale-0 transition-all duration-700"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 border-2 border-gold/30 -m-2 sm:-m-4 pointer-events-none group-hover:m-0 transition-all duration-500" />
                  </div>
                  <div className="space-y-4 sm:space-y-6 order-1 md:order-2 text-center md:text-left">
                    <h3 className="text-2xl sm:text-3xl font-serif text-slate-800 border-b border-gold/20 pb-4">A Grécia de Julia</h3>
                    <p className="text-slate-600 leading-relaxed text-sm sm:text-base">
                      A Grécia Antiga não foi apenas um lugar, mas o berço da civilização, da arte e da filosofia. O mármore branco e os detalhes em ouro que decoram esta festa remetem à sofisticação e à eternidade dos templos gregos.
                    </p>
                    <p className="text-slate-600 leading-relaxed text-sm sm:text-base">
                      Nesta noite, o Palácio de Mármore se transforma em um pedaço do Olimpo para celebrar a transição de Julia para uma nova fase de sua vida.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'jornada' && (
              <motion.div
                key="jornada"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="py-12 sm:py-20 px-4 max-w-4xl mx-auto space-y-12 sm:space-y-16"
              >
                <div className="text-center space-y-4 sm:space-y-6">
                  <Clock className="w-10 h-10 sm:w-12 sm:h-12 text-gold mx-auto" />
                  <h2 className="text-3xl sm:text-5xl font-serif text-gold tracking-[0.2em] sm:tracking-[0.3em]">LINHA DO TEMPO</h2>
                  <p className="text-slate-500 font-serif italic text-sm sm:text-base px-4">Os momentos sagrados desta celebração.</p>
                </div>

                <div className="relative space-y-8 sm:space-y-12 before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gold/30 before:to-transparent">
                  {[
                    { time: "21:00", title: "Abertura dos Portais", desc: "Recepção dos convidados no átrio de mármore com harpa ao vivo." },
                    { time: "22:30", title: "O Cortejo de Apolo", desc: "Entrada triunfal da debutante e valsa com os familiares." },
                    { time: "23:30", title: "Banquete Olímpico", desc: "Jantar servido com as iguarias mais finas do reino." },
                    { time: "00:30", title: "Festa no Olimpo", desc: "Abertura da pista com DJ e efeitos especiais de luz." },
                    { time: "02:00", title: "O Oráculo da Madrugada", desc: "Entrega de lembranças e encerramento místico." },
                  ].map((item, idx) => (
                    <div key={idx} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                      <div className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full border border-gold bg-white text-gold font-serif text-[10px] sm:text-xs z-10 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 group-hover:scale-125 transition-transform duration-500">
                        {idx + 1}
                      </div>
                      <div className="w-[calc(100%-3rem)] sm:w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 sm:p-6 glass-card border border-gold/10 group-hover:border-gold/30 transition-all">
                        <div className="flex items-center justify-between mb-1 sm:mb-2">
                          <time className="font-serif text-gold font-bold text-sm sm:text-base">{item.time}</time>
                          <Star className="w-2 h-2 sm:w-3 sm:h-3 text-gold/40" />
                        </div>
                        <h4 className="text-lg sm:text-xl font-serif text-slate-800 mb-1 sm:mb-2">{item.title}</h4>
                        <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === 'oraculo' && (
              <motion.div
                key="oraculo"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="py-12 sm:py-20 px-4 max-w-4xl mx-auto space-y-8 sm:space-y-12"
              >
                <div className="text-center space-y-4 sm:space-y-6">
                  <Gamepad2 className="w-10 h-10 sm:w-12 sm:h-12 text-gold mx-auto" />
                  <h2 className="text-3xl sm:text-5xl font-serif text-gold tracking-[0.2em] sm:tracking-[0.3em]">O ENIGMA DO ORÁCULO</h2>
                  <p className="text-slate-500 font-serif italic text-sm sm:text-base px-4">Prove sua sabedoria para ganhar a benção de Apolo.</p>
                </div>

                <Card className="glass-card border-gold/20 overflow-hidden">
                  <CardHeader className="bg-gold/5 border-b border-gold/10 text-center py-8 sm:py-12">
                    <Sparkles className="w-8 h-8 sm:w-10 sm:h-10 text-gold mx-auto mb-4 animate-pulse" />
                    <CardTitle className="text-xl sm:text-2xl font-serif text-gold">O Enigma de Delfos</CardTitle>
                    <CardDescription className="text-slate-500 italic text-sm sm:text-base px-4">"Eu trago a luz, mas não sou o fogo. Eu trago a música, mas não sou a voz. Quem sou eu?"</CardDescription>
                  </CardHeader>
                  <CardContent className="p-6 sm:p-12 space-y-6 sm:space-y-8">
                    {!showRiddleResult ? (
                      <div className="space-y-4 sm:space-y-6">
                        <Input 
                          placeholder="SUA RESPOSTA..." 
                          className="bg-white/50 border-gold/20 h-14 sm:h-16 text-center text-lg sm:text-xl tracking-widest uppercase focus:border-gold"
                          value={riddleAnswer}
                          onChange={(e) => setRiddleAnswer(e.target.value)}
                        />
                        <Button 
                          className="w-full gold-button gold-gradient text-white h-14 sm:h-16 text-base sm:text-lg tracking-[0.2em] sm:tracking-[0.3em] font-serif"
                          onClick={() => {
                            if (riddleAnswer.toLowerCase().includes('apolo')) {
                              setGameScore(prev => prev + 100);
                              setShowRiddleResult(true);
                              toast.success("O Oráculo sorri para você!");
                            } else {
                              toast.error("O Oráculo permanece em silêncio... Tente novamente.");
                            }
                          }}
                        >
                          CONSULTAR ORÁCULO
                        </Button>
                      </div>
                    ) : (
                      <div className="text-center space-y-4 sm:space-y-6">
                        <div className="text-4xl sm:text-6xl font-serif text-gold">CORRETO</div>
                        <p className="text-slate-600 text-base sm:text-lg">Apolo, o deus da luz e da música, é a resposta. Você recebeu 100 pontos de sabedoria!</p>
                        <div className="p-3 sm:p-4 bg-gold/10 border border-gold/20 inline-block">
                          <p className="text-[8px] sm:text-[10px] text-gold font-bold tracking-widest">PONTUAÇÃO TOTAL</p>
                          <p className="text-2xl sm:text-3xl font-serif text-gold">{gameScore}</p>
                        </div>
                        <Button 
                          variant="outline" 
                          className="block mx-auto border-gold/30 text-gold hover:bg-gold/5 text-sm sm:text-base"
                          onClick={() => {
                            setShowRiddleResult(false);
                            setRiddleAnswer('');
                          }}
                        >
                          JOGAR NOVAMENTE
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {activeTab === 'galeria' && (
              <motion.div
                key="galeria"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="py-12 sm:py-20 px-4 max-w-7xl mx-auto space-y-12 sm:space-y-20"
              >
                <div className="text-center space-y-4 sm:space-y-6">
                  <ImageIcon className="w-10 h-10 sm:w-12 sm:h-12 text-gold mx-auto" />
                  <h2 className="text-3xl sm:text-5xl font-serif text-gold tracking-[0.2em] sm:tracking-[0.3em]">GALERIA DIVINA</h2>
                  <p className="text-slate-500 font-serif italic text-sm sm:text-base px-4">Registros da nossa debutante e do evento.</p>
                  
                  {/* Gallery Sub-tabs */}
                  <div className="flex justify-center gap-4 sm:gap-8 pt-4">
                    {[
                      { id: 'all', label: 'TUDO', icon: Sparkles },
                      { id: 'photos', label: 'FOTOS', icon: ImageIcon },
                      { id: 'videos', label: 'VÍDEOS', icon: Video }
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setGallerySubTab(tab.id)}
                        className={`flex flex-col items-center gap-2 transition-all duration-300 group`}
                      >
                        <div className={`p-3 rounded-full border transition-all duration-500 ${
                          gallerySubTab === tab.id 
                            ? 'bg-gold border-gold text-white shadow-lg shadow-gold/20' 
                            : 'bg-white/50 border-gold/20 text-gold/40 group-hover:border-gold/50'
                        }`}>
                          <tab.icon size={18} />
                        </div>
                        <span className={`text-[10px] font-bold tracking-[0.2em] transition-colors ${
                          gallerySubTab === tab.id ? 'text-gold' : 'text-slate-400'
                        }`}>
                          {tab.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {isAdmin && (
                  <Card className="glass-card border-gold/30 max-w-2xl mx-auto overflow-hidden">
                    <CardHeader className="bg-gold/5 border-b border-gold/10">
                      <CardTitle className="text-lg sm:text-xl font-serif text-gold flex items-center gap-2">
                        <Plus className="w-5 h-5" /> ADICIONAR MÍDIA
                      </CardTitle>
                      <CardDescription className="text-[10px] uppercase tracking-widest">Somente administradores podem postar</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6">
                      <form onSubmit={handleMediaUpload} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-[10px] uppercase tracking-widest font-bold text-gold">Upload de Arquivo</Label>
                            <Input 
                              type="file"
                              accept="image/*,video/*"
                              className="bg-white/50 border-gold/20 focus:border-gold cursor-pointer file:bg-gold file:text-white file:border-none file:px-4 file:py-1 file:rounded-sm file:mr-4 file:hover:bg-gold-dark transition-all"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  setSelectedFile(file);
                                  setMediaForm(prev => ({ ...prev, type: file.type.startsWith('video') ? 'video' : 'image' }));
                                }
                              }}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] uppercase tracking-widest font-bold text-gold">Ou URL Direta</Label>
                            <Input 
                              placeholder="https://..."
                              className="bg-white/50 border-gold/20 focus:border-gold"
                              value={mediaForm.url}
                              onChange={(e) => setMediaForm({...mediaForm, url: e.target.value})}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] uppercase tracking-widest font-bold text-gold">Legenda (Opcional)</Label>
                          <Input 
                            placeholder="Descreva este momento..."
                            className="bg-white/50 border-gold/20 focus:border-gold"
                            value={mediaForm.caption}
                            onChange={(e) => setMediaForm({...mediaForm, caption: e.target.value})}
                          />
                        </div>
                        <Button 
                          type="submit" 
                          disabled={isMediaLoading}
                          className="w-full gold-button gold-gradient text-white font-serif tracking-widest"
                        >
                          {isMediaLoading ? 'ENVIANDO...' : 'POSTAR NO OLIMPO'}
                        </Button>
                      </form>
                    </CardContent>
                  </Card>
                )}

                <div className="space-y-12 sm:space-y-20">
                  {/* Dynamic Media Section */}
                  {media.filter(item => gallerySubTab === 'all' || (gallerySubTab === 'photos' && item.type === 'image') || (gallerySubTab === 'videos' && item.type === 'video')).length > 0 && (
                    <div className="space-y-8 sm:space-y-12">
                      <h3 className="text-2xl sm:text-3xl font-serif text-slate-800 border-l-4 border-gold pl-4 sm:pl-6">
                        {gallerySubTab === 'all' ? 'Momentos Recentes' : gallerySubTab === 'photos' ? 'Registros Fotográficos' : 'Memórias em Vídeo'}
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-8">
                        {media
                          .filter(item => gallerySubTab === 'all' || (gallerySubTab === 'photos' && item.type === 'image') || (gallerySubTab === 'videos' && item.type === 'video'))
                          .map((item) => (
                          <motion.div 
                            key={item.id}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            className="relative aspect-[3/4] overflow-hidden group shadow-xl bg-slate-100"
                          >
                            {item.type === 'video' ? (
                              <div className="w-full h-full relative">
                                <video 
                                  src={item.url} 
                                  className="w-full h-full object-cover"
                                  controls={false}
                                  muted
                                  loop
                                  onMouseOver={(e) => e.currentTarget.play()}
                                  onMouseOut={(e) => e.currentTarget.pause()}
                                />
                                <div className="absolute top-4 right-4 bg-black/50 p-2 rounded-full">
                                  <Video className="w-4 h-4 text-white" />
                                </div>
                              </div>
                            ) : (
                              <img 
                                src={item.url} 
                                alt={item.caption || "Mídia do Evento"} 
                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                referrerPolicy="no-referrer"
                              />
                            )}
                            
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-6 sm:p-8">
                              {item.caption && (
                                <p className="text-white font-serif text-sm sm:text-base mb-2">{item.caption}</p>
                              )}
                              <p className="text-gold font-sans tracking-widest text-[10px] uppercase">
                                {item.type === 'video' ? 'VÍDEO DIVINO' : 'REGISTRO ETERNO'}
                              </p>
                              
                              {isAdmin && (
                                <Button 
                                  variant="destructive" 
                                  size="icon"
                                  className="absolute top-4 left-4 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={() => handleDeleteMedia(item.id)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(gallerySubTab === 'all' || gallerySubTab === 'photos') && (
                    <div className="space-y-8 sm:space-y-12">
                      <h3 className="text-2xl sm:text-3xl font-serif text-slate-800 border-l-4 border-gold pl-4 sm:pl-6">A Debutante</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-8">
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                          <motion.div 
                            key={i}
                            whileHover={{ scale: 1.02, y: -10 }}
                            className="relative aspect-[3/4] overflow-hidden group shadow-xl"
                          >
                            <img 
                              src={`https://picsum.photos/seed/julia-${i}/600/800`} 
                              alt={`Julia ${i}`} 
                              className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700"
                              referrerPolicy="no-referrer"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-6 sm:p-8">
                              <p className="text-white font-serif tracking-widest text-xs sm:text-sm">JULIA • ENSAIO PRÉ-15</p>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(gallerySubTab === 'all' || gallerySubTab === 'photos') && (
                    <div className="space-y-8 sm:space-y-12">
                      <h3 className="text-2xl sm:text-3xl font-serif text-slate-800 border-l-4 border-gold pl-4 sm:pl-6">O Palácio</h3>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
                        {[1, 2, 3, 4].map((i) => (
                          <motion.div 
                            key={i}
                            whileHover={{ opacity: 0.8 }}
                            className="aspect-square overflow-hidden"
                          >
                            <img 
                              src={`https://picsum.photos/seed/palace-${i}/800/800`} 
                              alt={`Palácio ${i}`} 
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'convidados' && (
              <motion.div
                key="convidados"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="py-12 sm:py-20 px-4 max-w-5xl mx-auto space-y-12 sm:space-y-16"
              >
                <div className="text-center space-y-4 sm:space-y-6">
                  <Users className="w-10 h-10 sm:w-12 sm:h-12 text-gold mx-auto" />
                  <h2 className="text-3xl sm:text-5xl font-serif text-gold tracking-[0.2em] sm:tracking-[0.3em]">LISTA DE CONVIDADOS</h2>
                  <p className="text-slate-500 font-serif italic text-sm sm:text-base px-4">Aqueles que cruzaram o portal do Olimpo.</p>
                  
                  <div className="max-w-md mx-auto relative px-4 sm:px-0">
                    <Search className="absolute left-8 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gold/40" />
                    <Input 
                      placeholder="BUSCAR CONVIDADO..." 
                      className="pl-12 bg-white/50 border-gold/20 h-12 rounded-none focus:border-gold text-sm sm:text-base"
                      onChange={(e) => {
                        const term = e.target.value.toLowerCase();
                        // Simple filtering logic could be added here if needed, 
                        // but for now we'll just show the UI
                      }}
                    />
                  </div>
                </div>

                <div className="grid gap-8 sm:gap-12">
                  {Array.from(new Set(allGuests.map(g => g.family || 'Amigos'))).sort().map((family: any) => (
                    <div key={family} className="space-y-4 sm:space-y-6">
                      <h3 className="text-xl sm:text-2xl font-serif text-gold border-b border-gold/10 pb-2 flex items-center gap-3 sm:gap-4 px-4 sm:px-0">
                        <Heart className="w-4 h-4 sm:w-5 sm:h-5 fill-gold" />
                        FAMÍLIA {String(family).toUpperCase()}
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 px-4 sm:px-0">
                        {allGuests.filter(g => (g.family || 'Amigos') === family).map((guest) => (
                          <div key={guest.id} className="p-3 sm:p-4 glass-card border border-gold/5 flex items-center gap-3 sm:gap-4 hover:border-gold/20 transition-all">
                            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gold/10 flex items-center justify-center text-gold font-serif text-xs sm:text-sm shrink-0">
                              {guest.name?.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <p className="font-serif text-slate-800 text-xs sm:text-sm truncate">{guest.name}</p>
                              <p className="text-[8px] sm:text-[10px] text-gold font-bold tracking-widest uppercase truncate">{guest.greekProfile?.title || 'CONVIDADO'}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Footer */}
          <footer className="py-24 pb-32 sm:pb-24 text-center border-t border-gold/10 bg-white/30 backdrop-blur-md">
            <div className="max-w-4xl mx-auto space-y-8">
              <div className="flex justify-center gap-4">
                <div className="w-12 h-[1px] bg-gold/30 self-center" />
                <Sun className="text-gold w-6 h-6" />
                <div className="w-12 h-[1px] bg-gold/30 self-center" />
              </div>
              <div className="space-y-2">
                <p className="font-serif text-3xl gold-text-shimmer tracking-[0.3em]">JULIA DANTAS ALMEIDA PACHECO</p>
                <p className="text-slate-400 font-sans font-light tracking-[0.8em] uppercase text-xs">
                  Olimpo • 23.05.2026
                </p>
              </div>
            </div>
          </footer>
        </div>
      )}
    </div>
  );
}
