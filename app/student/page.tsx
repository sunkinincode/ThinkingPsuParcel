'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Package, MapPin, Key, Loader2, LogOut, Search, UserCheck, ArrowLeft, BellRing } from 'lucide-react';
import Link from 'next/link';

const playNotificationSound = () => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.connect(gainNode); gainNode.connect(ctx.destination);
    osc.type = 'sine'; osc.frequency.setValueAtTime(1046.50, ctx.currentTime);
    gainNode.gain.setValueAtTime(0.1, ctx.currentTime); gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.start(); osc.stop(ctx.currentTime + 0.5);
  } catch (e) {}
};

export default function StudentMobilePage() {
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const [studentCode, setStudentCode] = useState('');
  const [password, setPassword] = useState('');
  const [studentName, setStudentName] = useState('');
  const [dbStudentId, setDbStudentId] = useState('');
  
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [title, setTitle] = useState('นาย');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  const [pendingParcels, setPendingParcels] = useState<any[]>([]);
  const [claimTracking, setClaimTracking] = useState('');
  const [isClaiming, setIsClaiming] = useState(false);
  const [isNewParcelArrived, setIsNewParcelArrived] = useState(false);

  // ดึงข้อมูลเบาๆ ไม่เป็นภาระเซิร์ฟเวอร์
  const fetchParcels = async (supabaseStudentId: string) => {
    try {
      const { data } = await supabase.from('parcels')
        .select(`id, courier, size, pickup_code, deposited_at, tracking_number, lockers ( zone, locker_number )`)
        .eq('student_id', supabaseStudentId)
        .eq('status', 'PENDING')
        .order('deposited_at', { ascending: false });
      setPendingParcels(data || []);
    } catch (err) {}
  };

  // 🚀 LocalStorage Session: เปิดแอปมาไม่ต้องล็อกอินใหม่
  useEffect(() => {
    const session = localStorage.getItem('studentSession');
    if (session) {
      const parsedSession = JSON.parse(session);
      setDbStudentId(parsedSession.id);
      setStudentName(parsedSession.name);
      setIsLoggedIn(true);
      fetchParcels(parsedSession.id);
    }
    setIsCheckingSession(false);
  }, []);

  // 🚀 Realtime Database: ไม่ต้องดึงซ้ำๆ รออัปเดตเอง
  useEffect(() => {
    if (!dbStudentId) return;

    const parcelChannel = supabase
      .channel('realtime:student_parcels')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'parcels', filter: `student_id=eq.${dbStudentId}` },
        (payload) => {
          if (payload.eventType === 'INSERT' || (payload.eventType === 'UPDATE' && payload.new.status === 'PENDING')) {
            playNotificationSound();
            setIsNewParcelArrived(true);
            setTimeout(() => setIsNewParcelArrived(false), 3000);
          }
          fetchParcels(dbStudentId);
        }
      ).subscribe();

    return () => { supabase.removeChannel(parcelChannel); };
  }, [dbStudentId]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentCode || !password) return alert('กรุณากรอกข้อมูลให้ครบถ้วน');
    
    setIsLoading(true);
    try {
      const response = await fetch('/api/moodle/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: studentCode, password: password })
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'รหัสนักศึกษา หรือ รหัสผ่าน LMS ไม่ถูกต้อง');

      const realFullName = data.fullname || studentCode;
      const { data: studentData, error: studentErr } = await supabase.from('students').select('*').eq('student_code', studentCode).single();

      let currentStudentId = '';

      if (studentErr || !studentData) {
        const { data: newStudent } = await supabase.from('students').insert([{ student_code: studentCode, full_name: realFullName }]).select('*').single();
        if (newStudent) {
          currentStudentId = newStudent.id;
          setNeedsOnboarding(true);
        }
      } else {
        currentStudentId = studentData.id;
        if (!studentData.first_name || !studentData.last_name) {
          setNeedsOnboarding(true);
        } else {
          const finalName = `${studentData.title}${studentData.first_name} ${studentData.last_name}`;
          setStudentName(finalName);
          localStorage.setItem('studentSession', JSON.stringify({ id: currentStudentId, name: finalName }));
          
          fetchParcels(currentStudentId);
          setIsLoggedIn(true);
        }
      }
      setDbStudentId(currentStudentId);
    } catch (err: any) { alert(err.message); } finally { setIsLoading(false); }
  };

  const handleOnboardingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !lastName) return alert('กรุณากรอกชื่อและนามสกุล');
    setIsLoading(true);
    
    const cleanFirstName = firstName.trim().replace(/\s+/g, ' ');
    const cleanLastName = lastName.trim().replace(/\s+/g, ' ');

    try {
      await supabase.from('students').update({ title, first_name: cleanFirstName, last_name: cleanLastName }).eq('id', dbStudentId);
      
      // ผูกพัสดุเก่าที่ค้างอยู่ ตอนเด็กลงทะเบียนครั้งแรก
      await supabase.from('parcels').update({ student_id: dbStudentId }).eq('recipient_title', title).eq('recipient_first_name', cleanFirstName).eq('recipient_last_name', cleanLastName).is('student_id', null);

      const finalName = `${title}${cleanFirstName} ${cleanLastName}`;
      setStudentName(finalName);
      localStorage.setItem('studentSession', JSON.stringify({ id: dbStudentId, name: finalName }));
      
      setNeedsOnboarding(false);
      setIsLoggedIn(true);
      fetchParcels(dbStudentId);
    } catch (error: any) { alert(`เกิดข้อผิดพลาด: ${error.message}`); } finally { setIsLoading(false); }
  };

  const handleClaimParcel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimTracking) return;
    setIsClaiming(true);
    const cleanTracking = claimTracking.replace(/\s+/g, ''); // 💡 ตัดช่องว่างให้เด็กด้วย

    try {
      const { data: foundParcel, error: searchErr } = await supabase.from('parcels').select('id').ilike('tracking_number', cleanTracking).is('student_id', null).eq('status', 'PENDING').single();
      if (searchErr || !foundParcel) throw new Error('ไม่พบพัสดุนี้ในระบบ หรือพัสดุถูกรับไปแล้ว');
      
      await supabase.from('parcels').update({ student_id: dbStudentId }).eq('id', foundParcel.id);
      
      alert('ดึงพัสดุเข้าบัญชีสำเร็จ!');
      setClaimTracking('');
    } catch (err: any) { alert(err.message); } finally { setIsClaiming(false); }
  };

  const handleLogout = () => {
    localStorage.removeItem('studentSession');
    setIsLoggedIn(false); setNeedsOnboarding(false); setStudentCode(''); setPassword(''); setPendingParcels([]);
  };

  if (isCheckingSession) return <div className="min-h-screen bg-emerald-600 flex items-center justify-center"><Loader2 className="w-10 h-10 text-white animate-spin" /></div>;

  if (!isLoggedIn && !needsOnboarding) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-emerald-600 p-4 relative">
        <Link href="/" className="absolute top-6 left-6 text-white/80 hover:text-white flex items-center font-medium transition-colors">
          <ArrowLeft className="w-5 h-5 mr-1" /> กลับ
        </Link>
        <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-md">
          <div className="text-center mb-8">
            <Package className="w-16 h-16 text-emerald-600 mx-auto mb-3 drop-shadow-sm" />
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">ระบบรับพัสดุ</h1>
            <p className="text-slate-500 font-medium mt-1">เข้าสู่ระบบด้วยบัญชี LMS PSU</p>
          </div>
          <form onSubmit={handleLogin}>
            <input type="text" value={studentCode} onChange={(e) => setStudentCode(e.target.value)} placeholder="รหัสนักศึกษา" className="w-full p-4 border border-slate-300 rounded-xl mb-4 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none font-medium text-slate-900" required />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="รหัสผ่าน" className="w-full p-4 border border-slate-300 rounded-xl mb-6 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none font-medium text-slate-900" required />
            <button type="submit" disabled={isLoading} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all flex justify-center items-center">
              {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'เข้าสู่ระบบ'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (needsOnboarding) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md border border-slate-100">
          <div className="text-center mb-8">
            <div className="bg-emerald-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <UserCheck className="w-8 h-8 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">ยืนยันข้อมูลส่วนตัว</h2>
            <p className="text-slate-500 mt-2 font-medium">กรุณากรอกข้อมูลให้ตรงกับจ่าหน้าพัสดุ</p>
          </div>
          <form onSubmit={handleOnboardingSubmit} className="space-y-4">
            <div className="flex gap-2">
              <select value={title} onChange={(e) => setTitle(e.target.value)} className="w-1/3 p-4 border border-slate-300 rounded-xl outline-none font-medium text-slate-900 bg-white"><option value="นาย">นาย</option><option value="นางสาว">นางสาว</option><option value="นาง">นาง</option><option value="คุณ">คุณ</option><option value="">ไม่ระบุ</option></select>
              <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="ชื่อจริง" className="w-2/3 p-4 border border-slate-300 rounded-xl outline-none font-medium text-slate-900" required />
            </div>
            <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="นามสกุล" className="w-full p-4 border border-slate-300 rounded-xl outline-none font-medium text-slate-900" required />
            <button type="submit" disabled={isLoading} className="w-full mt-8 bg-slate-900 hover:bg-slate-800 text-white py-4 rounded-xl font-bold shadow-lg transition-all flex justify-center items-center">
              {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'บันทึกข้อมูล'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <header className="bg-emerald-600 text-white p-6 md:p-8 rounded-b-[2rem] shadow-lg flex justify-between items-start relative overflow-hidden">
        {/* แบนเนอร์ Notification Realtime */}
        <div className={`absolute top-0 left-0 w-full bg-emerald-400 text-emerald-950 font-bold py-2 px-4 flex justify-center items-center gap-2 transition-transform duration-500 ${isNewParcelArrived ? 'translate-y-0' : '-translate-y-full'}`}>
          <BellRing className="w-4 h-4" /> พัสดุใหม่มาถึงแล้ว!
        </div>

        <div className="mt-2">
          <h1 className="text-2xl font-bold drop-shadow-sm">สวัสดี, {studentName}</h1>
          <p className="text-emerald-50 mt-1 font-medium">คุณมีพัสดุรอรับ {pendingParcels.length} ชิ้น</p>
        </div>
        <button onClick={handleLogout} className="p-3 bg-emerald-700 hover:bg-emerald-800 rounded-full transition-colors shadow-sm mt-2 z-10">
          <LogOut className="w-5 h-5" />
        </button>
      </header>

      <main className="p-4 md:p-6 mt-2 max-w-2xl mx-auto space-y-6">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
          <h2 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
            <Search className="w-5 h-5 text-emerald-600"/> หาพัสดุของคุณไม่เจอใช่ไหม?
          </h2>
          <p className="text-sm text-slate-500 mb-4 font-medium">กรอกเลขแทรคกิ้งเพื่อดึงพัสดุเข้าบัญชีของคุณ</p>
          <form onSubmit={handleClaimParcel} className="flex gap-2">
            <input type="text" value={claimTracking} onChange={(e) => setClaimTracking(e.target.value)} placeholder="TH0123456789" className="flex-1 p-4 border border-slate-300 rounded-xl outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 uppercase font-mono text-slate-900 font-bold bg-slate-50" required />
            <button type="submit" disabled={isClaiming} className="bg-emerald-600 text-white px-6 py-4 rounded-xl font-bold hover:bg-emerald-700 transition-colors shadow-md hover:shadow-lg whitespace-nowrap">
              {isClaiming ? 'รอสักครู่' : 'ค้นหา'}
            </button>
          </form>
        </div>

        <div>
          <h2 className="font-bold text-slate-800 mb-4 ml-2 text-lg">รายการพัสดุของคุณ</h2>
          {pendingParcels.length === 0 ? (
            <div className="text-center text-slate-500 py-10 bg-white rounded-3xl shadow-sm border border-slate-100">
              <Package className="w-16 h-16 mx-auto mb-4 text-slate-300 drop-shadow-sm" />
              <p className="font-medium">ยังไม่มีพัสดุมาส่งในขณะนี้</p>
            </div>
          ) : (
            pendingParcels.map((parcel) => (
              <div key={parcel.id} className={`bg-white p-6 rounded-3xl shadow-sm hover:shadow-lg transition-all border border-slate-100 relative overflow-hidden mb-4 ${isNewParcelArrived && parcel === pendingParcels[0] ? 'ring-4 ring-emerald-400 animate-in fade-in slide-in-from-bottom-4 duration-500' : ''}`}>
                <div className="absolute top-0 right-0 bg-yellow-400 text-yellow-900 text-sm font-bold px-4 py-1.5 rounded-bl-xl shadow-sm">รอรับ</div>
                
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <Package className="text-emerald-600 w-6 h-6" />
                    <span className="font-bold text-slate-900 text-lg">{parcel.courier}</span>
                  </div>
                </div>
                <p className="text-sm text-slate-500 mb-5 font-mono font-medium">แทรคกิ้ง: {parcel.tracking_number}</p>
                
                <div className="bg-slate-50 rounded-2xl p-5 flex flex-col items-center justify-center border border-slate-200 mb-5 shadow-inner">
                  <span className="text-sm text-slate-600 font-bold flex items-center gap-1 mb-1"><Key className="w-4 h-4"/> รหัสรับพัสดุของคุณ</span>
                  <span className="text-5xl font-black text-emerald-600 tracking-[0.2em] drop-shadow-sm">{parcel.pickup_code}</span>
                </div>

                <div className="flex items-center gap-3 text-sm text-slate-700 bg-emerald-50 p-4 rounded-xl border border-emerald-100 font-medium">
                  <MapPin className="w-6 h-6 text-emerald-600 flex-shrink-0" />
                  <span>รับของที่ตู้: <b className="text-lg">โซน {parcel.lockers?.zone} (เบอร์ {parcel.lockers?.locker_number})</b></span>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}