'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Package, ScanBarcode, CheckCircle2, Loader2, ArrowLeft } from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import Link from 'next/link';

// 🎵 ฟังก์ชันสร้างเสียงสังเคราะห์ 
const playSuccessSound = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator(); 
    const gain = ctx.createGain();
    osc.connect(gain); 
    gain.connect(ctx.destination);
    osc.type = 'sine'; 
    osc.frequency.setValueAtTime(880, ctx.currentTime); 
    osc.frequency.setValueAtTime(1046.50, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.1, ctx.currentTime); 
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start(); 
    osc.stop(ctx.currentTime + 0.3);
  } catch (e) {}
};

// 🌟 Component สแกนเนอร์ (แก้บั๊กกล้องแฝดด้วย useRef)
const FastScanner = ({ onScanSuccess, onCancel, readerId = 'reader-courier' }: any) => {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    // ล้าง UI เก่าออกให้สะอาด
    const element = document.getElementById(readerId); 
    if (element) element.innerHTML = '';

    // ถ้ายังไม่เคยกดเปิดกล้อง ค่อยสร้างมันขึ้นมา
    if (!scannerRef.current) {
      scannerRef.current = new Html5QrcodeScanner(
        readerId, 
        { fps: 10, rememberLastUsedCamera: true }, 
        false
      );

      scannerRef.current.render(
        (text) => { 
          if (scannerRef.current) {
            scannerRef.current.clear().catch(() => {});
            scannerRef.current = null;
          }
          playSuccessSound(); 
          onScanSuccess(text); 
        }, 
        () => {} // ปิดแจ้งเตือน Error จุกจิก
      );
    }

    // ปิดกล้องทุกครั้งที่ Component หายไป หรือกดยกเลิก
    return () => { 
      if (scannerRef.current) {
        scannerRef.current.clear().catch(()=>{}); 
        scannerRef.current = null;
      }
    };
  }, [onScanSuccess, readerId]);

  return (
    <div className="w-full flex flex-col items-center">
      <div id={readerId} className="w-full bg-white text-slate-900 rounded-2xl overflow-hidden shadow-inner [&>div]:border-none"></div>
      <button onClick={onCancel} className="mt-6 w-full py-4 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl font-bold transition-colors shadow-sm">
        ยกเลิก
      </button>
    </div>
  );
};

export default function CourierPage() {
  const [trackingNumber, setTrackingNumber] = useState('');
  const [recipientTitle, setRecipientTitle] = useState('นาย');
  const [recipientFirstName, setRecipientFirstName] = useState('');
  const [recipientLastName, setRecipientLastName] = useState('');
  const [courier, setCourier] = useState('Shopee Express');
  const [size, setSize] = useState('S');
  const [showScanner, setShowScanner] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [successData, setSuccessData] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackingNumber || !recipientFirstName || !recipientLastName) return alert('กรุณากรอกข้อมูลให้ครบถ้วน');
    setIsProcessing(true);
    try {
      const cleanTracking = trackingNumber.replace(/\s+/g, '');
      const cleanFirst = recipientFirstName.trim().replace(/\s+/g, ' ');
      const cleanLast = recipientLastName.trim().replace(/\s+/g, ' ');

      let studentId = null;
      const { data: stu } = await supabase.from('students').select('id').eq('first_name', cleanFirst).eq('last_name', cleanLast).maybeSingle();
      if (stu) studentId = stu.id;
      
      const { data: lockers } = await supabase.from('lockers').select('id, zone, locker_number').eq('size', size).eq('is_available', true).limit(1);
      if (!lockers || lockers.length === 0) throw new Error(`ไม่มีตู้ว่างสำหรับขนาด ${size}`);

      const locker = lockers[0];
      const { data: locked, error: lockErr } = await supabase.from('lockers').update({ is_available: false }).eq('id', locker.id).eq('is_available', true).select();
      if (lockErr || !locked || locked.length === 0) throw new Error('ตู้โดนแย่งคิว! กรุณากดบันทึกอีกครั้ง');

      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const { error: pErr } = await supabase.from('parcels').insert([{
        tracking_number: cleanTracking, student_id: studentId, recipient_name: `${recipientTitle}${cleanFirst} ${cleanLast}`, recipient_title: recipientTitle, recipient_first_name: cleanFirst, recipient_last_name: cleanLast,
        locker_id: locker.id, courier, size, pickup_code: code, status: 'PENDING'
      }]);

      if (pErr) { await supabase.from('lockers').update({ is_available: true }).eq('id', locker.id); throw new Error(pErr.message); }
      playSuccessSound(); 
      setSuccessData({ code, zone: locker.zone, locker: locker.locker_number });
    } catch (err: any) { 
      alert(err.message); 
    } finally { 
      setIsProcessing(false); 
    }
  };

  if (successData) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="bg-white p-10 rounded-3xl shadow-xl text-center w-full max-w-md animate-in zoom-in duration-500">
        <CheckCircle2 className="w-24 h-24 text-emerald-500 mx-auto mb-6 drop-shadow-sm" />
        <h1 className="text-3xl font-bold mb-2 text-slate-900">บันทึกสำเร็จ!</h1>
        <p className="text-slate-600 mb-8 font-medium">นำพัสดุไปวางที่</p>
        <div className="bg-blue-50 rounded-2xl p-6 mb-8 border border-blue-100 shadow-inner">
          <div className="text-5xl font-black text-blue-600 mb-2 drop-shadow-sm">โซน {successData.zone}</div>
          <div className="text-3xl font-bold text-blue-800">ตู้ {successData.locker}</div>
        </div>
        <button onClick={() => window.location.reload()} className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold text-lg hover:bg-slate-800 hover:shadow-lg transition-all">
          บันทึกชิ้นต่อไป
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-xl mx-auto">
        <Link href="/" className="inline-flex items-center text-slate-500 hover:text-blue-600 font-medium mb-6 transition-colors">
          <ArrowLeft className="w-5 h-5 mr-2"/> กลับหน้าหลัก
        </Link>
        <div className="bg-white rounded-3xl shadow-lg border border-slate-100 p-6 md:p-10">
          <div className="flex items-center gap-4 mb-8 border-b border-slate-100 pb-6">
            <div className="bg-blue-50 p-4 rounded-2xl shadow-sm"><Package className="w-8 h-8 text-blue-600" /></div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">บันทึกพัสดุเข้าตู้</h1>
              <p className="text-slate-500 font-medium mt-1">สแกนบาร์โค้ดและกรอกข้อมูลผู้รับ</p>
            </div>
          </div>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-2">1. เลขแทรคกิ้งขนส่ง</label>
                <div className="flex gap-2">
                  <input type="text" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} placeholder="เช่น TH012345..." className="w-full p-4 border border-slate-300 rounded-xl focus:border-blue-500 outline-none font-mono uppercase text-slate-900" required />
                  <button type="button" onClick={() => setShowScanner(true)} className="bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-xl shadow-md transition-all shrink-0">
                    <ScanBarcode className="w-6 h-6"/>
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-2">2. ชื่อที่ปรากฏบนกล่อง</label>
                <div className="flex gap-2 mb-3">
                  <select value={recipientTitle} onChange={(e) => setRecipientTitle(e.target.value)} className="w-1/3 p-4 border border-slate-300 rounded-xl focus:border-blue-500 outline-none text-slate-900 bg-white">
                    <option value="นาย">นาย</option><option value="นางสาว">นางสาว</option><option value="นาง">นาง</option><option value="คุณ">คุณ</option><option value="">ไม่ระบุ</option>
                  </select>
                  <input type="text" value={recipientFirstName} onChange={(e) => setRecipientFirstName(e.target.value)} placeholder="ชื่อจริง" className="w-2/3 p-4 border border-slate-300 rounded-xl focus:border-blue-500 outline-none text-slate-900" required />
                </div>
                <input type="text" value={recipientLastName} onChange={(e) => setRecipientLastName(e.target.value)} placeholder="นามสกุล" className="w-full p-4 border border-slate-300 rounded-xl focus:border-blue-500 outline-none text-slate-900" required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-2">3. บริษัทขนส่ง</label>
                <select value={courier} onChange={(e) => setCourier(e.target.value)} className="w-full p-4 border border-slate-300 rounded-xl focus:border-blue-500 outline-none text-slate-900 bg-white">
                  <option value="Shopee Express">Shopee Express</option><option value="Flash Express">Flash Express</option><option value="Kerry (KEX)">Kerry (KEX)</option><option value="Ninja Van">Ninja Van</option><option value="Thailand Post">ไปรษณีย์ไทย</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-2">4. ขนาดพัสดุ</label>
                <select value={size} onChange={(e) => setSize(e.target.value)} className="w-full p-4 border border-slate-300 rounded-xl focus:border-blue-500 outline-none text-slate-900 bg-white">
                  <option value="S">ไซส์ S</option><option value="M">ไซส์ M</option><option value="L">ไซส์ L</option>
                </select>
              </div>
            </div>
            <button type="submit" disabled={isProcessing} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-5 rounded-xl font-bold text-xl shadow-lg transition-all flex justify-center gap-2 mt-6">
              {isProcessing ? <Loader2 className="animate-spin w-6 h-6"/> : 'บันทึกเข้าตู้'}
            </button>
          </form>
        </div>
      </div>
      {showScanner && (
        <div className="fixed inset-0 bg-slate-900/90 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-3xl w-full max-w-md text-center shadow-2xl">
            <h2 className="text-2xl font-bold mb-4 text-slate-900">สแกนบาร์โค้ด</h2>
            <FastScanner onScanSuccess={(t: string) => { setTrackingNumber(t); setShowScanner(false); }} onCancel={() => setShowScanner(false)} />
          </div>
        </div>
      )}
    </div>
  );
}