'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Package, ScanBarcode, CheckCircle2, Loader2, ArrowLeft } from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import Link from 'next/link';

const playSuccessSound = () => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.connect(gainNode); gainNode.connect(ctx.destination);
    osc.type = 'sine'; osc.frequency.setValueAtTime(880, ctx.currentTime); osc.frequency.setValueAtTime(1046.50, ctx.currentTime + 0.1);
    gainNode.gain.setValueAtTime(0.1, ctx.currentTime); gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start(); osc.stop(ctx.currentTime + 0.3);
  } catch (e) {}
};

const FastScanner = ({ onScanSuccess, onCancel, readerId = 'reader-courier' }: any) => {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isScanning = useRef(false);

  useEffect(() => {
    if (isScanning.current) return;
    isScanning.current = true;

    const formatsToSupport = [Html5QrcodeSupportedFormats.QR_CODE, Html5QrcodeSupportedFormats.CODE_128, Html5QrcodeSupportedFormats.CODE_39];
    const html5QrCode = new Html5Qrcode(readerId, { formatsToSupport });
    scannerRef.current = html5QrCode;

    html5QrCode.start(
      { facingMode: 'environment' },
      { fps: 10 }, // 🚀 ลด FPS เหลือ 10 ประหยัด CPU มือถือมหาศาล สแกนยังไวเหมือนเดิม
      (decodedText) => {
        if (html5QrCode.isScanning) {
          html5QrCode.stop().then(() => {
            isScanning.current = false;
            playSuccessSound();
            onScanSuccess(decodedText);
          }).catch(() => {});
        }
      },
      () => {}
    ).catch(() => { isScanning.current = false; });

    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().then(() => { scannerRef.current?.clear(); isScanning.current = false; }).catch(() => {});
      }
    };
  }, [onScanSuccess, readerId]);

  return (
    <div className="relative w-full">
      <div id={readerId} className="w-full rounded-2xl overflow-hidden border-4 border-slate-100 shadow-inner bg-black min-h-[300px]"></div>
      <button onClick={onCancel} className="mt-6 w-full py-4 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl font-bold transition-colors">ยกเลิก</button>
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
      const cleanFirstName = recipientFirstName.trim().replace(/\s+/g, ' ');
      const cleanLastName = recipientLastName.trim().replace(/\s+/g, ' ');

      let matchedStudentId = null;
      const { data: existingStudent } = await supabase.from('students').select('id').eq('first_name', cleanFirstName).eq('last_name', cleanLastName).maybeSingle();
      if (existingStudent) matchedStudentId = existingStudent.id;
      
      // 🚀 แก้ปัญหาคอขวดที่ 1: การล็อกตู้ (Optimistic Locking)
      const { data: availableLockers } = await supabase.from('lockers').select('id, zone, locker_number').eq('size', size).eq('is_available', true).limit(1);
      if (!availableLockers || availableLockers.length === 0) throw new Error(`ไม่มีตู้ว่างสำหรับขนาด ${size}`);

      const selectedLocker = availableLockers[0];
      
      // พยายามจองตู้ก่อน เพื่อป้องกันคนอื่นแย่งในเสี้ยววินาที
      const { data: lockedLocker, error: lockErr } = await supabase.from('lockers')
        .update({ is_available: false })
        .eq('id', selectedLocker.id)
        .eq('is_available', true) // เงื่อนไขสำคัญ: ต้องว่างอยู่ถึงจะอัปเดตได้
        .select();

      if (lockErr || !lockedLocker || lockedLocker.length === 0) {
        throw new Error('คิวตู้ชนกัน! มีคนใช้ตู้นี้ไปในเสี้ยววินาทีที่ผ่านมา กรุณากดบันทึกใหม่อีกครั้ง');
      }

      const mockPickupCode = Math.floor(100000 + Math.random() * 900000).toString();
      const fullName = `${recipientTitle}${cleanFirstName} ${cleanLastName}`;

      const { error: parcelError } = await supabase.from('parcels').insert([{
        tracking_number: cleanTracking, student_id: matchedStudentId, recipient_name: fullName, recipient_title: recipientTitle, recipient_first_name: cleanFirstName, recipient_last_name: cleanLastName,
        locker_id: selectedLocker.id, courier, size, pickup_code: mockPickupCode, status: 'PENDING'
      }]);

      if (parcelError) {
        // หากบันทึกพัสดุไม่ลง ให้คืนสถานะตู้กลับเป็นว่าง (Rollback)
        await supabase.from('lockers').update({ is_available: true }).eq('id', selectedLocker.id);
        throw new Error(`บันทึกพัสดุไม่สำเร็จ: ${parcelError.message}`);
      }

      playSuccessSound();
      setSuccessData({ code: mockPickupCode, zone: selectedLocker.zone, locker: selectedLocker.locker_number });

    } catch (err: any) {
      alert(err.message);
    } finally { setIsProcessing(false); }
  };

  // ... (ส่วน UI Render คงเดิมเหมือนที่เคยให้ไปเลยครับ เพื่อประหยัดพื้นที่ในการแสดงผล)
  if (successData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6">
        <div className="bg-white p-10 rounded-3xl shadow-xl border border-slate-100 text-center w-full max-w-md animate-in zoom-in duration-500">
          <CheckCircle2 className="w-24 h-24 text-emerald-500 mx-auto mb-6 drop-shadow-sm" />
          <h1 className="text-3xl font-bold text-slate-900 mb-2">บันทึกพัสดุสำเร็จ!</h1>
          <p className="text-slate-600 mb-8 font-medium">กรุณานำพัสดุไปวางที่</p>
          <div className="bg-blue-50 rounded-2xl p-6 mb-8 border border-blue-100 shadow-inner">
            <div className="text-5xl font-black text-blue-600 mb-2 drop-shadow-sm">โซน {successData.zone}</div>
            <div className="text-3xl font-bold text-blue-800">ตู้ {successData.locker}</div>
          </div>
          <button onClick={() => window.location.reload()} className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold text-lg hover:bg-slate-800 hover:shadow-lg transition-all">บันทึกชิ้นต่อไป</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-xl mx-auto">
        <Link href="/" className="inline-flex items-center text-slate-500 hover:text-blue-600 font-medium mb-6 transition-colors">
          <ArrowLeft className="w-5 h-5 mr-2" /> กลับหน้าหลัก
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
                  <input type="text" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} placeholder="เช่น TH012345..." className="w-full p-4 border border-slate-300 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none text-lg font-mono bg-white uppercase shadow-sm transition-all text-slate-900" required />
                  <button type="button" onClick={() => setShowScanner(true)} className="bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center shrink-0">
                    <ScanBarcode className="w-6 h-6" />
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-2">2. ชื่อที่ปรากฏบนกล่อง</label>
                <div className="flex gap-2 mb-3">
                  <select value={recipientTitle} onChange={(e) => setRecipientTitle(e.target.value)} className="w-1/3 p-4 border border-slate-300 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none bg-white shadow-sm font-medium text-slate-900">
                    <option value="นาย">นาย</option><option value="นางสาว">นางสาว</option><option value="นาง">นาง</option><option value="คุณ">คุณ</option><option value="">ไม่ระบุ</option>
                  </select>
                  <input type="text" value={recipientFirstName} onChange={(e) => setRecipientFirstName(e.target.value)} placeholder="ชื่อจริง" className="w-2/3 p-4 border border-slate-300 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none bg-white shadow-sm font-medium text-slate-900" required />
                </div>
                <input type="text" value={recipientLastName} onChange={(e) => setRecipientLastName(e.target.value)} placeholder="นามสกุล" className="w-full p-4 border border-slate-300 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none bg-white shadow-sm font-medium text-slate-900" required />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-2">3. บริษัทขนส่ง</label>
                <select value={courier} onChange={(e) => setCourier(e.target.value)} className="w-full p-4 border border-slate-300 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none bg-white shadow-sm font-medium text-slate-900">
                  <option value="Shopee Express">Shopee Express</option><option value="Flash Express">Flash Express</option><option value="Kerry (KEX)">Kerry (KEX)</option><option value="Ninja Van">Ninja Van</option><option value="Thailand Post">ไปรษณีย์ไทย</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-2">4. ขนาดพัสดุ</label>
                <select value={size} onChange={(e) => setSize(e.target.value)} className="w-full p-4 border border-slate-300 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none bg-white shadow-sm font-medium text-slate-900">
                  <option value="S">S (เล็ก)</option><option value="M">M (กลาง)</option><option value="L">L (ใหญ่)</option>
                </select>
              </div>
            </div>
            <button type="submit" disabled={isProcessing} className="w-full font-bold py-5 rounded-xl text-xl transition-all shadow-lg hover:shadow-xl mt-6 bg-blue-600 hover:bg-blue-700 text-white flex justify-center items-center gap-2">
              {isProcessing ? <Loader2 className="w-6 h-6 animate-spin"/> : 'บันทึกพัสดุเข้าตู้'}
            </button>
          </form>
        </div>
      </div>

      {showScanner && (
        <div className="fixed inset-0 bg-slate-900/90 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-3xl shadow-2xl w-full max-w-md text-center">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">สแกนบาร์โค้ดหน้ากล่อง</h2>
            <p className="text-slate-500 mb-6 font-medium">นำบาร์โค้ดมาเล็งหน้ากล้อง</p>
            <FastScanner onScanSuccess={(text: string) => { setTrackingNumber(text); setShowScanner(false); }} onCancel={() => setShowScanner(false)} />
          </div>
        </div>
      )}
    </div>
  );
}