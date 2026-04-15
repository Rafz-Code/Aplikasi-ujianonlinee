import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  BookOpen, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight, 
  ChevronLeft, 
  GraduationCap, 
  Trophy,
  LogOut,
  Timer,
  User,
  Lock,
  Calendar as CalendarIcon,
  Search,
  Mail,
  ShieldCheck,
  Phone,
  RefreshCw,
  Volume2,
  VolumeX
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { examQuestions, Question } from "./data/questions";
import { db, auth } from "./lib/firebase";
import { 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  getDocs,
  serverTimestamp 
} from "firebase/firestore";
import { signInAnonymously } from "firebase/auth";

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}


type AppState = "login" | "register" | "landing" | "exam" | "result" | "admin";

interface UserData {
  name: string;
  username?: string;
  email?: string;
  picture?: string;
  role?: string;
  major?: string;
}

export default function App() {
  const [appState, setAppState] = useState<AppState>("login");
  const [user, setUser] = useState<UserData | null>(null);
  const [loginForm, setLoginForm] = useState({ username: "", password: "", major: "" });
  const [registerForm, setRegisterForm] = useState({ username: "", password: "", name: "", role: "siswa", major: "" });
  const [loginError, setLoginError] = useState("");
  const [registerError, setRegisterError] = useState("");
  const [registerSuccess, setRegisterSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSupabase, setIsSupabase] = useState(true);
  const [appVersion, setAppVersion] = useState("1.2.0");
  const [lastUpdated, setLastUpdated] = useState("");
  const [adminResults, setAdminResults] = useState<any[]>([]);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [timeLeft, setTimeLeft] = useState(1800); // 30 minutes for 50 questions
  const [score, setScore] = useState(0);
  const [wrongAnswers, setWrongAnswers] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isMuted, setIsMuted] = useState(false);

  // Sound Effects
  const playSound = (type: 'click' | 'tick' | 'warning' | 'success' | 'hover') => {
    if (isMuted) return;
    const sounds = {
      click: 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3',
      tick: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3',
      warning: 'https://assets.mixkit.co/active_storage/sfx/2573/2573-preview.mp3',
      success: 'https://assets.mixkit.co/active_storage/sfx/2572/2572-preview.mp3',
      hover: 'https://assets.mixkit.co/active_storage/sfx/2567/2567-preview.mp3'
    };
    const audio = new Audio(sounds[type]);
    audio.volume = type === 'tick' ? 0.1 : (type === 'hover' ? 0.05 : 0.4);
    audio.play().catch(() => {}); // Ignore autoplay blocks
  };

  // Daily Questions Logic
  const [dailyQuestions, setDailyQuestions] = useState<Question[]>([]);

  useEffect(() => {
    const today = new Date();
    const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
    
    const shuffled = [...examQuestions];
    let s = seed;
    const seededRandom = () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };

    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(seededRandom() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    setDailyQuestions(shuffled);
  }, []);

  const majors = ["TKJ", "MPLB", "DKV", "BC", "BD", "AKL"];

  const totalQuestions = dailyQuestions.length || examQuestions.length;
  const progress = ((currentQuestionIndex + 1) / totalQuestions) * 100;

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Check session and health on mount
  useEffect(() => {
    fetch("/api/health")
      .then(res => res.json())
      .then(data => {
        setIsSupabase(data.supabase);
        if (data.version) setAppVersion(data.version);
        if (data.lastUpdated) setLastUpdated(data.lastUpdated);
      })
      .catch(() => setIsSupabase(false));

    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        // If we have a firebase user, we need to fetch their profile from Firestore
        // For simplicity in this demo, we can also check if we have local storage user
        // but the most robust way is to fetch from Firestore
        // However, since we use signInAnonymously for connection test, 
        // we should be careful. 
        // Actually, let's just rely on the manual login for now to keep it simple,
        // but we can listen for auth state if we implement real Firebase Auth later.
      }
    });

    return () => unsubscribe();
  }, []);

  const fetchAdminResults = async () => {
    try {
      const q = query(collection(db, "exam_results"), orderBy("completed_at", "desc"));
      const querySnapshot = await getDocs(q);
      const results = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAdminResults(results);
    } catch (err) {
      console.error("Gagal mengambil data admin dari Firebase", err);
    }
  };

  useEffect(() => {
    if (appState === "admin") {
      fetchAdminResults();
    }
  }, [appState]);

  // Listen for Google OAuth success
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        if (event.data.user) {
          setUser(event.data.user);
          setAppState("landing");
        } else {
          // If real flow, fetch user data
          fetch("/api/me")
            .then(res => res.json())
            .then(data => {
              if (data.success) {
                setUser(data.user);
                setAppState("landing");
              }
            });
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    playSound('click');
    setLoginError("");
    setIsLoading(true);
    try {
      // Test connection
      await signInAnonymously(auth);
      
      const userDoc = await getDoc(doc(db, "users", loginForm.username.toLowerCase()));
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.password === loginForm.password) {
          const loggedInUser = { 
            username: userData.username, 
            name: userData.name, 
            role: userData.role, 
            major: loginForm.major || userData.major 
          };
          setUser(loggedInUser);
          setAppState("landing");
        } else {
          setLoginError("Password salah");
        }
      } else {
        setLoginError("Username tidak ditemukan");
      }
    } catch (err: any) {
      console.error("Login Error:", err);
      setLoginError("Gagal terhubung ke database. Pastikan internet stabil.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    playSound('click');
    setRegisterError("");
    setRegisterSuccess("");
    setIsLoading(true);
    try {
      await signInAnonymously(auth);
      
      const usernameLower = registerForm.username.toLowerCase();
      const userRef = doc(db, "users", usernameLower);
      const userDoc = await getDoc(userRef);

      if (userDoc.exists()) {
        setRegisterError("Username sudah digunakan");
        return;
      }

      await setDoc(userRef, {
        username: usernameLower,
        password: registerForm.password,
        name: registerForm.name,
        role: registerForm.role,
        major: registerForm.major,
        createdAt: serverTimestamp()
      });

      setRegisterSuccess("Akun berhasil dibuat! Silakan login.");
      setTimeout(() => setAppState("login"), 2000);
    } catch (err: any) {
      console.error("Register Error:", err);
      setRegisterError("Gagal mendaftar. Terjadi kesalahan pada database.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinishExam = async () => {
    playSound('success');
    
    let correct = 0;
    let wrong = 0;
    
    dailyQuestions.forEach(q => {
      if (answers[q.id] === q.correctAnswer) {
        correct++;
      } else if (answers[q.id] !== undefined) {
        wrong++;
      }
    });
    
    setScore(correct);
    setWrongAnswers(wrong);
    setAppState("result");

    // Save to Firebase
    if (user) {
      try {
        await addDoc(collection(db, "exam_results"), {
          username: user.username,
          name: user.name,
          score: correct,
          total_questions: totalQuestions,
          wrong_answers: wrong,
          major: user.major || "UMUM",
          status: (correct / totalQuestions) * 100 >= 70 ? 'LULUS' : 'TIDAK LULUS',
          completed_at: new Date().toISOString() // Use ISO string for consistency with UI date parsing
        });
      } catch (err) {
        console.error("Gagal menyimpan hasil ujian:", err);
      }
    }
  };


  const handleLogout = async () => {
    try {
      await auth.signOut();
      setUser(null);
      setAppState("login");
    } catch (err) {
      console.error("Logout Error:", err);
    }
  };

  const handleStartExam = () => {
    setAppState("exam");
    setCurrentQuestionIndex(0);
    setAnswers({});
    setTimeLeft(1800);
  };

  const handleGoogleLogin = async () => {
    try {
      const res = await fetch("/api/auth/google/url");
      const { url } = await res.json();
      window.open(url, "google_login", "width=500,height=600");
    } catch (err) {
      console.error("Google login error", err);
    }
  };

  useEffect(() => {
    if (appState === "exam" && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          const next = prev - 1;
          // Play tick sound every second
          if (next > 0) {
            if (next <= 60) {
              // Warning sound every second in last minute
              playSound('warning');
            } else if (next % 10 === 0) {
              // Subtle tick every 10 seconds normally
              playSound('tick');
            }
          }
          return next;
        });
      }, 1000);
      return () => clearInterval(timer);
    } else if (timeLeft === 0 && appState === "exam") {
      playSound('success');
      handleFinishExam();
    }
  }, [appState, timeLeft, handleFinishExam]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleAnswerSelect = (questionId: number, optionIndex: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
  };

  const nextQuestion = () => {
    if (currentQuestionIndex < totalQuestions - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    }
  };

  const prevQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 flex flex-col relative overflow-hidden">
      {/* Top Welcome Bar */}
      <div className="w-full bg-slate-900 py-2 text-center z-[60] relative">
        <motion.p 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-[10px] font-black text-white uppercase tracking-[0.5em] drop-shadow-sm"
        >
          Selamat Datang Di Sistem Ujian Digital SMK Prima Unggul
        </motion.p>
      </div>

      {/* Animated Background Elements (Only visible on login/register) */}
      {(appState === "login" || appState === "register") && (
        <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
          <div className="absolute inset-0 bg-dot-pattern opacity-[0.15]"></div>
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-400/20 blur-[120px] animate-float"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-400/20 blur-[150px] animate-float-delayed"></div>
          <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] rounded-full bg-sky-300/10 blur-[100px] animate-pulse-slow"></div>
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03] mix-blend-overlay"></div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-white/20 bg-white/80 backdrop-blur-2xl shadow-[0_4px_30px_rgba(0,0,0,0.03)]">
        <div className="container mx-auto flex h-24 items-center justify-between px-6">
          {/* Left side: School Name and Logo */}
          <div className="flex items-center gap-6">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onMouseEnter={() => playSound('hover')}
              className="relative cursor-pointer group"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white shadow-2xl shadow-blue-500/20 overflow-hidden border-2 border-white transition-transform group-hover:scale-105 duration-300">
                <img 
                  src="https://picsum.photos/seed/school-logo/200/200" 
                  alt="Logo" 
                  className="h-full w-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-green-500 border-2 border-white shadow-lg animate-pulse"></div>
            </motion.div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black tracking-tighter bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 bg-clip-text text-transparent leading-none">SMK PRIMA UNGGUL</h1>
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                <Badge variant="secondary" className="text-[9px] font-black uppercase tracking-widest bg-blue-50 text-blue-700 border-blue-100">Official</Badge>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Sistem Ujian Digital v{appVersion}</p>
              </div>
            </div>
          </div>
          
          {/* Right side: Date and Time */}
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setIsMuted(!isMuted)}
              onMouseEnter={() => playSound('hover')}
              className="text-slate-400 hover:text-blue-600 rounded-full"
            >
              {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </Button>
            <div className="flex flex-col items-end gap-1">
              <motion.div 
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                className="flex items-center gap-4 bg-white/50 backdrop-blur-sm px-5 py-2.5 rounded-2xl border border-white shadow-sm"
              >
              <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                <CalendarIcon className="h-4 w-4 text-blue-500" />
                <span>{currentTime.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              </div>
              <div className="h-4 w-px bg-slate-200"></div>
              <div className="flex items-center gap-2 text-xs font-mono font-black text-blue-600">
                <Clock className="h-4 w-4" />
                <span>{currentTime.toLocaleTimeString('id-ID')}</span>
              </div>
            </motion.div>
          </div>
        </div>

        {user && (
            <div className="flex items-center gap-3 ml-6 border-l pl-6">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-slate-900 leading-none">{user.name}</p>
                <p className="text-[10px] text-slate-500 font-medium uppercase tracking-tighter">{user.role || 'Siswa'}</p>
              </div>
              {user.picture ? (
                <img src={user.picture} alt="Profile" className="h-10 w-10 rounded-full border-2 border-white shadow-md" referrerPolicy="no-referrer" />
              ) : (
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold border-2 border-white shadow-md">
                  {user.name.charAt(0)}
                </div>
              )}
              <Button variant="ghost" size="icon" onClick={handleLogout} className="text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors">
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          )}
        </div>
        
        {/* Official Marquee */}
        <div className="w-full bg-blue-600 py-1.5 overflow-hidden whitespace-nowrap relative">
          <div className="flex animate-marquee whitespace-nowrap">
            <span className="text-[10px] font-black text-white uppercase tracking-[0.3em] px-4">
              PENGUMUMAN: PELAKSANAAN UJIAN AKHIR SEMESTER GENAP TAHUN PELAJARAN 2026/2027 SMK PRIMA UNGGUL KOTA TANGERANG SELATAN • HARAP MENJAGA KEJUJURAN DAN KETERTIBAN SELAMA UJIAN BERLANGSUNG • JANGAN LUPA BERDOA SEBELUM MENGERJAKAN •
            </span>
            <span className="text-[10px] font-black text-white uppercase tracking-[0.3em] px-4">
              PENGUMUMAN: PELAKSANAAN UJIAN AKHIR SEMESTER GENAP TAHUN PELAJARAN 2026/2027 SMK PRIMA UNGGUL KOTA TANGERANG SELATAN • HARAP MENJAGA KEJUJURAN DAN KETERTIBAN SELAMA UJIAN BERLANGSUNG • JANGAN LUPA BERDOA SEBELUM MENGERJAKAN •
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8 md:py-12 flex flex-col items-center justify-center z-10">
        <AnimatePresence mode="wait">
          {appState === "admin" && (
            <motion.div
              key="admin"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full max-w-6xl"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-3xl font-black text-slate-900">Dashboard Admin</h2>
                  <p className="text-slate-500 font-medium">Pantau hasil ujian siswa secara real-time</p>
                </div>
                <Button onClick={fetchAdminResults} variant="outline" className="gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Refresh Data
                </Button>
              </div>

              <div className="grid gap-6 md:grid-cols-4 mb-8">
                <Card className="p-6 bg-blue-600 text-white border-none shadow-lg shadow-blue-100">
                  <p className="text-xs font-bold uppercase tracking-widest opacity-80 mb-1">Total Peserta</p>
                  <p className="text-3xl font-black">{adminResults.length}</p>
                </Card>
                <Card className="p-6 bg-green-500 text-white border-none shadow-lg shadow-green-100">
                  <p className="text-xs font-bold uppercase tracking-widest opacity-80 mb-1">Lulus</p>
                  <p className="text-3xl font-black">{adminResults.filter(r => r.status === 'LULUS').length}</p>
                </Card>
                <Card className="p-6 bg-red-500 text-white border-none shadow-lg shadow-red-100">
                  <p className="text-xs font-bold uppercase tracking-widest opacity-80 mb-1">Tidak Lulus</p>
                  <p className="text-3xl font-black">{adminResults.filter(r => r.status === 'TIDAK LULUS').length}</p>
                </Card>
                <Card className="p-6 bg-slate-800 text-white border-none shadow-lg shadow-slate-100">
                  <p className="text-xs font-bold uppercase tracking-widest opacity-80 mb-1">Rata-rata Nilai</p>
                  <p className="text-3xl font-black">
                    {adminResults.length > 0 
                      ? Math.round(adminResults.reduce((acc, r) => acc + r.score, 0) / adminResults.reduce((acc, r) => acc + r.total_questions, 0) * 100)
                      : 0}
                  </p>
                </Card>
              </div>

              <Card className="overflow-hidden border-slate-200 shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Waktu</th>
                        <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Username</th>
                        <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Jurusan</th>
                        <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-center">Benar</th>
                        <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-center">Salah</th>
                        <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-center">Nilai</th>
                        <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {adminResults.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-10 text-center text-slate-400 font-medium">
                            Belum ada data hasil ujian.
                          </td>
                        </tr>
                      ) : (
                        adminResults.map((result) => (
                          <tr key={result.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-4 text-sm text-slate-600">
                              {new Date(result.completed_at).toLocaleString('id-ID')}
                            </td>
                            <td className="p-4 text-sm font-bold text-slate-900">{result.username}</td>
                            <td className="p-4 text-sm font-medium text-slate-600">
                              <Badge variant="outline" className="bg-slate-100">{result.major}</Badge>
                            </td>
                            <td className="p-4 text-sm font-bold text-green-600 text-center">{result.score}</td>
                            <td className="p-4 text-sm font-bold text-red-600 text-center">{result.wrong_answers}</td>
                            <td className="p-4 text-center">
                              <span className="text-lg font-black text-blue-600">
                                {Math.round((result.score / result.total_questions) * 100)}
                              </span>
                            </td>
                            <td className="p-4 text-center">
                              <Badge className={result.status === 'LULUS' ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>
                                {result.status}
                              </Badge>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </motion.div>
          )}

          {appState === "login" && (
            <motion.div
              key="login"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -20 }}
              transition={{ type: "spring", damping: 25, stiffness: 120 }}
              className="w-full max-w-md"
            >
              <Card className="border-white/40 bg-white/80 backdrop-blur-2xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] overflow-hidden border">
                <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 p-10 text-center text-white relative overflow-hidden">
                  {/* Decorative circles */}
                  <div className="absolute top-[-20%] right-[-10%] w-32 h-32 rounded-full bg-white/10 blur-2xl"></div>
                  <div className="absolute bottom-[-10%] left-[-5%] w-24 h-24 rounded-full bg-blue-400/20 blur-xl"></div>
                  
                  {/* Official Seal Watermark */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.05] pointer-events-none">
                    <GraduationCap className="w-64 h-64 text-white" />
                  </div>
                  
                  <motion.div 
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="relative z-10"
                  >
                    <p className="text-[10px] font-black uppercase tracking-[0.5em] mb-4 opacity-80">Selamat Datang Di</p>
                    <h2 className="text-3xl font-black mb-6 tracking-tight leading-tight">SMK PRIMA UNGGUL</h2>
                    <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-[2rem] bg-white/15 backdrop-blur-xl border border-white/20 shadow-2xl ring-4 ring-white/5">
                      <GraduationCap className="h-12 w-12 text-white drop-shadow-lg" />
                    </div>
                    <h3 className="text-lg font-bold tracking-[0.15em] uppercase opacity-90">Ujian Akhir Semester</h3>
                    <p className="text-blue-100 text-[10px] font-black mt-2 uppercase tracking-[0.3em] opacity-70">Kota Tangerang Selatan</p>
                  </motion.div>
                </div>
                <CardContent className="p-10">
                  <form onSubmit={handleLogin} className="space-y-6">
                    <div className="space-y-2.5">
                      <Label htmlFor="username" className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Username</Label>
                      <div className="relative group">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                        <Input 
                          id="username" 
                          placeholder="smkprimaunggul" 
                          onMouseEnter={() => playSound('hover')}
                          className="pl-11 h-12 bg-slate-50/50 border-slate-200 focus:bg-white transition-all rounded-xl"
                          value={loginForm.username}
                          onChange={(e) => setLoginForm({...loginForm, username: e.target.value})}
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2.5">
                      <Label htmlFor="password" className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Password</Label>
                      <div className="relative group">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                        <Input 
                          id="password" 
                          type="password" 
                          placeholder="••••••••" 
                          onMouseEnter={() => playSound('hover')}
                          className="pl-11 h-12 bg-slate-50/50 border-slate-200 focus:bg-white transition-all rounded-xl"
                          value={loginForm.password}
                          onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                          required
                        />
                      </div>
                    </div>
                    {loginError && (
                      <motion.div 
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-3 text-xs font-bold text-red-600 bg-red-50/80 backdrop-blur-sm p-4 rounded-xl border border-red-100"
                      >
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        {loginError}
                      </motion.div>
                    )}
                    <div className="space-y-2.5">
                      <Label htmlFor="major" className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Jurusan</Label>
                      <div className="relative">
                        <select 
                          id="major"
                          onMouseEnter={() => playSound('hover')}
                          className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-slate-50/50 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all appearance-none"
                          value={loginForm.major}
                          onChange={(e) => setLoginForm({...loginForm, major: e.target.value})}
                          required
                        >
                          <option value="">Pilih Jurusan</option>
                          {majors.map(m => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                        <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 rotate-90 pointer-events-none" />
                      </div>
                    </div>
                    <Button 
                      type="submit" 
                      disabled={isLoading} 
                      onMouseEnter={() => playSound('hover')}
                      className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 font-black text-sm uppercase tracking-widest shadow-xl shadow-blue-200/50 transition-all hover:scale-[1.02] active:scale-[0.98] rounded-xl"
                    >
                      {isLoading ? (
                        <RefreshCw className="h-5 w-5 animate-spin" />
                      ) : "Masuk Sekarang"}
                    </Button>
                    <div className="text-center pt-2">
                      <button 
                        type="button"
                        onClick={() => setAppState("register")}
                        className="text-[10px] font-black text-slate-400 hover:text-blue-600 transition-colors uppercase tracking-[0.2em]"
                      >
                        Belum punya akun? <span className="text-blue-600 underline underline-offset-4">Daftar di sini</span>
                      </button>
                    </div>
                  </form>

                  <div className="relative my-10">
                    <Separator className="bg-slate-100" />
                    <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-4 text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">Atau</span>
                  </div>

                  <Button 
                    variant="outline" 
                    onClick={handleGoogleLogin}
                    onMouseEnter={() => playSound('hover')}
                    className="w-full h-12 border-slate-200 hover:bg-slate-50 font-bold flex items-center justify-center gap-3 rounded-xl shadow-sm transition-all"
                  >
                    <img src="https://www.google.com/favicon.ico" alt="Google" className="h-5 w-5" />
                    Masuk dengan Google
                  </Button>
                </CardContent>
                <CardFooter className="bg-slate-50/50 backdrop-blur-sm p-6 text-center border-t border-slate-100">
                  <p className="w-full text-[9px] text-slate-400 font-black uppercase tracking-[0.4em]">
                    SMK Prima Unggul &copy; 2026
                  </p>
                </CardFooter>
              </Card>
            </motion.div>
          )}

          {appState === "register" && (
            <motion.div
              key="register"
              initial={{ opacity: 0, x: 20, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -20, scale: 0.95 }}
              className="w-full max-w-md"
            >
              <Card className="border-white/40 bg-white/80 backdrop-blur-2xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] overflow-hidden border">
                <CardHeader className="bg-gradient-to-br from-blue-600 to-indigo-800 text-white p-10 text-center relative overflow-hidden">
                  <div className="absolute top-[-20%] left-[-10%] w-32 h-32 rounded-full bg-white/10 blur-2xl"></div>
                  <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-[1.5rem] bg-white/15 backdrop-blur-xl border border-white/20 shadow-xl">
                    <User className="h-10 w-10 text-white" />
                  </div>
                  <CardTitle className="text-3xl font-black tracking-tight">Daftar Akun</CardTitle>
                  <CardDescription className="text-blue-100 font-bold opacity-80 mt-2">Buat akun Siswa atau Guru SMK Prima Unggul</CardDescription>
                </CardHeader>
                <CardContent className="p-10">
                  <form onSubmit={handleRegister} className="space-y-5">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nama Lengkap</Label>
                      <Input 
                        placeholder="Masukkan nama lengkap" 
                        className="h-12 bg-slate-50/50 border-slate-200 focus:bg-white transition-all rounded-xl font-medium"
                        value={registerForm.name}
                        onChange={(e) => setRegisterForm({...registerForm, name: e.target.value})}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Username</Label>
                      <Input 
                        placeholder="Buat username" 
                        className="h-12 bg-slate-50/50 border-slate-200 focus:bg-white transition-all rounded-xl font-medium"
                        value={registerForm.username}
                        onChange={(e) => setRegisterForm({...registerForm, username: e.target.value})}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Password</Label>
                      <Input 
                        type="password"
                        placeholder="Buat password" 
                        className="h-12 bg-slate-50/50 border-slate-200 focus:bg-white transition-all rounded-xl font-medium"
                        value={registerForm.password}
                        onChange={(e) => setRegisterForm({...registerForm, password: e.target.value})}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Peran</Label>
                      <div className="relative">
                        <select 
                          className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-slate-50/50 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all appearance-none"
                          value={registerForm.role}
                          onChange={(e) => setRegisterForm({...registerForm, role: e.target.value})}
                          required
                        >
                          <option value="siswa">Siswa</option>
                          <option value="guru">Guru</option>
                        </select>
                        <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 rotate-90 pointer-events-none" />
                      </div>
                    </div>

                    {registerForm.role === "siswa" && (
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Jurusan</Label>
                        <div className="relative">
                          <select 
                            className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-slate-50/50 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all appearance-none"
                            value={registerForm.major}
                            onChange={(e) => setRegisterForm({...registerForm, major: e.target.value})}
                            required
                          >
                            <option value="">Pilih Jurusan</option>
                            {majors.map(m => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                          </select>
                          <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 rotate-90 pointer-events-none" />
                        </div>
                      </div>
                    )}

                    {registerError && (
                      <motion.div 
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-3 text-xs font-bold text-red-600 bg-red-50/80 backdrop-blur-sm p-4 rounded-xl border border-red-100"
                      >
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        {registerError}
                      </motion.div>
                    )}
                    {registerSuccess && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex items-center gap-3 text-xs font-bold text-green-600 bg-green-50/80 backdrop-blur-sm p-4 rounded-xl border border-green-100"
                      >
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                        {registerSuccess}
                      </motion.div>
                    )}

                    <Button 
                      type="submit" 
                      disabled={isLoading} 
                      onMouseEnter={() => playSound('hover')}
                      className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 font-black text-sm uppercase tracking-widest shadow-xl shadow-blue-200/50 transition-all hover:scale-[1.02] active:scale-[0.98] rounded-xl"
                    >
                      {isLoading ? <RefreshCw className="h-5 w-5 animate-spin" /> : "Daftar Sekarang"}
                    </Button>
                    <div className="text-center pt-2">
                      <button 
                        type="button"
                        onClick={() => setAppState("login")}
                        className="text-[10px] font-black text-slate-400 hover:text-blue-600 transition-colors uppercase tracking-[0.2em]"
                      >
                        Sudah punya akun? <span className="text-blue-600 underline underline-offset-4">Login</span>
                      </button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          )}
          {appState === "landing" && (
            <motion.div
              key="landing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mx-auto max-w-2xl text-center"
            >
              <Badge variant="outline" className="mb-4 border-blue-200 bg-blue-50 text-blue-700 px-3 py-1">
                Selamat Datang, {user?.name}
              </Badge>
              <h2 className="mb-6 text-4xl font-extrabold tracking-tight text-slate-900 md:text-5xl">
                Siap Memulai Ujian?
              </h2>
              <p className="mb-10 text-lg text-slate-600 leading-relaxed">
                Anda akan mengerjakan ujian dengan total 50 soal. Pastikan Anda memiliki waktu luang minimal 30 menit.
              </p>

              <div className="grid gap-6 md:grid-cols-2 text-left mb-10">
                <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-blue-600" />
                      Detail Ujian
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-slate-600 space-y-2">
                    <div className="flex justify-between">
                      <span>Mata Pelajaran:</span>
                      <span className="font-semibold text-slate-900">Umum & Kejuruan</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Jumlah Soal:</span>
                      <span className="font-semibold text-slate-900">{totalQuestions} Butir</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Waktu:</span>
                      <span className="font-semibold text-slate-900">30 Menit</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Guru Pengampu:</span>
                      <span className="font-semibold text-slate-900">Tim Kurikulum</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-500" />
                      Peraturan
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-slate-600 space-y-1">
                    <p>• Dilarang membuka tab lain</p>
                    <p>• Jawaban tersimpan otomatis</p>
                    <p>• Waktu akan terus berjalan</p>
                    <p>• Gunakan kejujuran dalam menjawab</p>
                  </CardContent>
                </Card>
              </div>

              <Button 
                size="lg" 
                onClick={handleStartExam} 
                onMouseEnter={() => playSound('hover')}
                className="h-14 px-10 text-lg font-bold bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-200 transition-all hover:scale-105 active:scale-95"
              >
                Mulai Ujian Sekarang
                <ChevronRight className="ml-2 h-5 w-5" />
              </Button>
            </motion.div>
          )}

          {appState === "exam" && dailyQuestions.length > 0 && (
            <motion.div
              key="exam"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full max-w-4xl"
            >
              <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                <div className="md:col-span-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                      Progres Pengerjaan
                    </span>
                    <span className="text-xs font-bold text-blue-600">
                      {currentQuestionIndex + 1} / {totalQuestions} Soal
                    </span>
                  </div>
                  <Progress value={progress} className="h-2 bg-slate-200" />
                </div>
                <div className="flex justify-end">
                  <div className={`flex items-center gap-3 rounded-2xl px-6 py-3 font-mono text-xl font-black shadow-lg border-2 ${timeLeft < 300 ? 'bg-red-50 text-red-600 border-red-200 animate-pulse' : 'bg-white text-blue-600 border-blue-100'}`}>
                    <Timer className="h-6 w-6" />
                    {formatTime(timeLeft)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                <div className="lg:col-span-3 space-y-6">
                  <Card className="border-slate-200 shadow-xl shadow-slate-200/50 overflow-hidden">
                    <CardHeader className="bg-slate-50 border-b p-6 md:p-8">
                      <div className="flex items-center gap-2 mb-4">
                        <Badge className="bg-blue-600">Soal {currentQuestionIndex + 1}</Badge>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pilihan Ganda</span>
                      </div>
                      <CardTitle className="text-xl md:text-2xl font-bold leading-tight text-slate-800">
                        {dailyQuestions[currentQuestionIndex]?.text}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 md:p-8">
                      <RadioGroup
                        value={answers[dailyQuestions[currentQuestionIndex]?.id]?.toString()}
                        onValueChange={(val) => handleAnswerSelect(dailyQuestions[currentQuestionIndex].id, parseInt(val))}
                        className="grid gap-4"
                      >
                        {dailyQuestions[currentQuestionIndex]?.options.map((option, idx) => {
                          const questionId = dailyQuestions[currentQuestionIndex].id;
                          const optionId = `q-${questionId}-opt-${idx}`;
                          const isSelected = answers[questionId] === idx;
                          
                          return (
                            <div key={idx} className="flex items-center">
                              <RadioGroupItem
                                value={idx.toString()}
                                id={optionId}
                                className="peer sr-only"
                              />
                              <Label
                                htmlFor={optionId}
                                onClick={() => handleAnswerSelect(questionId, idx)}
                                onMouseEnter={() => playSound('hover')}
                                className={`flex flex-1 items-center gap-4 rounded-xl border-2 p-4 font-medium transition-all cursor-pointer ${
                                  isSelected 
                                    ? 'border-blue-600 bg-blue-50 shadow-md shadow-blue-100' 
                                    : 'border-slate-100 hover:bg-slate-50'
                                }`}
                              >
                                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                                  isSelected
                                    ? 'border-blue-600 bg-blue-600 text-white'
                                    : 'border-slate-200 text-slate-400'
                                }`}>
                                  <span className="text-sm font-bold">{String.fromCharCode(65 + idx)}</span>
                                </div>
                                <span className={`text-base transition-colors ${
                                  isSelected ? 'text-blue-900 font-bold' : 'text-slate-700'
                                }`}>
                                  {option}
                                </span>
                              </Label>
                            </div>
                          );
                        })}
                      </RadioGroup>
                    </CardContent>
                    <CardFooter className="flex items-center justify-between border-t bg-slate-50 p-6">
                      <Button
                        variant="outline"
                        onClick={prevQuestion}
                        onMouseEnter={() => playSound('hover')}
                        disabled={currentQuestionIndex === 0}
                        className="border-slate-300 h-11 px-6"
                      >
                        <ChevronLeft className="mr-2 h-4 w-4" />
                        Sebelumnya
                      </Button>
                      
                      {currentQuestionIndex === totalQuestions - 1 ? (
                        <Button 
                          onClick={() => setShowFinishConfirm(true)} 
                          onMouseEnter={() => playSound('hover')}
                          className="bg-green-600 hover:bg-green-700 shadow-lg shadow-green-100 h-11 px-8 font-bold"
                        >
                          Selesaikan Ujian
                          <CheckCircle2 className="ml-2 h-4 w-4" />
                        </Button>
                      ) : (
                        <Button 
                          onClick={nextQuestion} 
                          onMouseEnter={() => playSound('hover')}
                          className="bg-blue-600 hover:bg-blue-700 h-11 px-8 font-bold"
                        >
                          Selanjutnya
                          <ChevronRight className="ml-2 h-4 w-4" />
                        </Button>
                      )}
                    </CardFooter>
                  </Card>
                </div>

                {/* Confirmation Modal */}
                {showFinishConfirm && (
                  <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <motion.div 
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
                    >
                      <div className="p-8 text-center">
                        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                          <AlertCircle className="h-8 w-8" />
                        </div>
                        <h3 className="text-xl font-black text-slate-900 mb-2">Selesaikan Ujian?</h3>
                        <p className="text-slate-500 mb-8">
                          Pastikan Anda telah menjawab semua soal dengan benar. Anda tidak dapat kembali setelah menekan tombol selesai.
                        </p>
                        <div className="flex gap-3">
                          <Button 
                            variant="outline" 
                            onClick={() => setShowFinishConfirm(false)}
                            onMouseEnter={() => playSound('hover')}
                            className="flex-1 h-12 font-bold border-slate-200"
                          >
                            Batal
                          </Button>
                          <Button 
                            onClick={() => {
                              setShowFinishConfirm(false);
                              handleFinishExam();
                            }}
                            onMouseEnter={() => playSound('hover')}
                            className="flex-1 h-12 font-bold bg-green-600 hover:bg-green-700"
                          >
                            Ya, Selesai
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  </div>
                )}

                <div className="space-y-6">
                  <Card className="border-slate-200 shadow-sm">
                    <CardHeader className="p-4 border-b">
                      <CardTitle className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                        <Search className="h-3 w-3" />
                        Navigasi Soal
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4">
                      <div className="grid grid-cols-5 gap-2">
                        {dailyQuestions.map((q, idx) => (
                          <button
                            key={q.id}
                            type="button"
                            onMouseEnter={() => playSound('hover')}
                            onClick={(e) => {
                              e.preventDefault();
                              setCurrentQuestionIndex(idx);
                            }}
                            className={`flex h-10 w-full items-center justify-center rounded-md text-xs font-black transition-all cursor-pointer z-10 relative ${
                              currentQuestionIndex === idx
                                ? "bg-blue-600 text-white shadow-md ring-2 ring-blue-300"
                                : answers[q.id] !== undefined
                                ? "bg-green-500 text-white"
                                : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                            }`}
                          >
                            {idx + 1}
                          </button>
                        ))}
                      </div>
                      <div className="mt-6 space-y-2">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase">
                          <div className="h-3 w-3 rounded bg-green-500"></div>
                          <span>Sudah Dijawab</span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase">
                          <div className="h-3 w-3 rounded bg-slate-100"></div>
                          <span>Belum Dijawab</span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase">
                          <div className="h-3 w-3 rounded ring-2 ring-blue-300 bg-blue-600"></div>
                          <span>Sedang Dibuka</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </motion.div>
          )}

          {appState === "result" && (
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mx-auto w-full max-w-xl"
            >
              <Card className="border-none shadow-2xl overflow-hidden">
                <div className="bg-blue-600 p-10 text-center text-white">
                  <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-white/20 backdrop-blur-md">
                    <Trophy className="h-10 w-10 text-yellow-300" />
                  </div>
                  <h2 className="text-3xl font-bold mb-2">Ujian Selesai!</h2>
                  <p className="text-blue-100">Hasil pengerjaan Anda telah terekam di sistem.</p>
                </div>
                
                <CardContent className="p-8">
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="text-center p-4 rounded-xl bg-green-50 border border-green-100">
                      <p className="text-[10px] font-bold text-green-600 uppercase tracking-widest mb-1">Benar</p>
                      <p className="text-3xl font-black text-green-700">{score}</p>
                    </div>
                    <div className="text-center p-4 rounded-xl bg-red-50 border border-red-100">
                      <p className="text-[10px] font-bold text-red-600 uppercase tracking-widest mb-1">Salah</p>
                      <p className="text-3xl font-black text-red-700">{wrongAnswers}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-6 mb-8">
                    <div className="text-center p-6 rounded-2xl bg-slate-50 border border-slate-100">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Nilai Akhir</p>
                      <p className="text-5xl font-black text-blue-600">{Math.round((score / totalQuestions) * 100)}</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600 font-medium">Nama Siswa</span>
                      <span className="font-bold text-slate-900">{user?.name}</span>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600 font-medium">Jurusan</span>
                      <span className="font-bold text-slate-900">{user?.major || loginForm.major || 'UMUM'}</span>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600 font-medium">Status Kelulusan</span>
                      <Badge className={(score / totalQuestions) * 100 >= 70 ? "bg-green-100 text-green-700 hover:bg-green-100" : "bg-red-100 text-red-700 hover:bg-red-100"}>
                        {(score / totalQuestions) * 100 >= 70 ? "LULUS" : "TIDAK LULUS"}
                      </Badge>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600 font-medium">Waktu Selesai</span>
                      <span className="font-bold text-slate-900">{currentTime.toLocaleTimeString('id-ID')}</span>
                    </div>
                  </div>
                </CardContent>
                
                <CardFooter className="p-8 bg-slate-50 border-t flex flex-col gap-3">
                  <Button 
                    onClick={handleStartExam} 
                    onMouseEnter={() => playSound('hover')}
                    className="w-full h-12 text-base font-bold bg-blue-600 hover:bg-blue-700"
                  >
                    Ulangi Ujian
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setAppState("landing")} 
                    onMouseEnter={() => playSound('hover')}
                    className="w-full h-12 text-base font-bold border-slate-300"
                  >
                    Kembali ke Beranda
                  </Button>
                </CardFooter>
              </Card>
              
              <p className="mt-8 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                SMK Prima Unggul Kota Tangerang Selatan &bull; Sistem Ujian Digital v{appVersion}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="mt-auto py-8 border-t border-white/20 bg-white/50 backdrop-blur-xl">
        <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col items-center md:items-start gap-2">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                System Status: <span className="text-green-600">Operational</span> &bull; &copy; 2026 SMK Prima Unggul
              </p>
            </div>
            {lastUpdated && (
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter ml-4">
                Sistem Terupdate: {new Date(lastUpdated).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
          <div className="flex flex-wrap justify-center gap-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-600">
              <span className="text-[8px] font-black">VERSION</span>
              <span className="font-mono">{appVersion}</span>
            </div>
            <a 
              href="mailto:smkprimaunggul@gmail.com" 
              onMouseEnter={() => playSound('hover')}
              className="hover:text-blue-600 transition-all flex items-center gap-2 group"
            >
              <div className="p-1.5 rounded-lg bg-slate-100 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                <Mail className="h-3 w-3" />
              </div>
              Bantuan
            </a>
            <div 
              className="flex items-center gap-2 group cursor-default"
              onMouseEnter={() => playSound('hover')}
            >
              <div className="p-1.5 rounded-lg bg-slate-100 group-hover:bg-green-100 group-hover:text-green-600 transition-colors">
                <ShieldCheck className="h-3 w-3" />
              </div>
              Terlindungi
            </div>
            <a 
              href="tel:0217320184" 
              onMouseEnter={() => playSound('hover')}
              className="hover:text-blue-600 transition-all flex items-center gap-2 group"
            >
              <div className="p-1.5 rounded-lg bg-slate-100 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                <Phone className="h-3 w-3" />
              </div>
              (021) 7320184
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
