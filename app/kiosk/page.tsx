'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { CheckCircle2, Package, Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import Link from 'next/link';

// 🎵 ฟังก์ชันสร้างเสียงสังเคราะห์ 
const playSound = () => { 
  try { 
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)(); 
    const osc = ctx.createOscillator(); 
    osc.connect(ctx.destination); 
    osc.frequency.setValueAtTime(880, ctx.currentTime); 
    osc.start(); 
    osc.stop(ctx.currentTime + 0.1); 
  } catch (e) {} 
};

// 🌟 Component สแกนเนอร์สำหรับ Kiosk (แก้บั๊กกล้องแฝดด้วย useRef)
const FastKioskScanner = ({ onScanSuccess, readerId = 'reader-kiosk' }: any) => {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    const element = document.getElementById(readerId); 
    if (element) element.innerHTML = '';

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
          playSound(); 
          onScanSuccess(text); 
        }, 
        () => {}
      );
    }

    return () => { 
      if (scannerRef.current) {
        scannerRef.current.clear().catch(()=>{}); 
        scannerRef.current = null;
      }
    };
  }, [onScanSuccess, readerId]);

  return (
    <div className="w-full bg-white rounded-2xl overflow-hidden shadow-inner">
      <div id={readerId} className="w-full text-slate-900 [&>div]:border-none"></div>
    </div>
  );
};

export default function KioskPage() {
  const [pickupCode, setPickupCode] = useState('');
  const [step, setStep] = useState<'ENTER_CODE' | 'SCAN_BARCODE' | 'SUCCESS'>('ENTER_CODE');
  const [isLoading, setIsLoading] = useState(false);
  const [parcelData, setParcelData] = useState<any>(null);

  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault(); 
    if (pickupCode.length !== 6) return alert('กรุณากรอกรหัสรับพัสดุให้ครบ 6 หลัก');
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from('parcels').select('id, tracking_number, locker_id, lockers(zone, locker_number)').eq('pickup_code', pickupCode).eq('status', 'PENDING').single();
      if (error || !data) throw new Error('รหัสไม่ถูกต้อง หรือพัสดุนี้ถูกรับไปแล้ว');
      playSound(); 
      setParcelData(data); 
      setStep('SCAN_BARCODE');
    } catch (err: any) { 
      alert(err.message); 
      setPickupCode(''); 
    } finally { 
      setIsLoading(false); 
    }
  };

  const checkout = async (scannedText: string) => {
    if (isLoading) return; 
    setIsLoading(true);
    try {
      if (!scannedText.includes(parcelData.tracking_number) && !parcelData.tracking_number.includes(scannedText)) {
        throw new Error('บาร์โค้ดไม่ตรงกับพัสดุของคุณ! กรุณาตรวจสอบว่าหยิบถูกกล่องหรือไม่');
      }
      await supabase.from('parcels').update({ status: 'PICKED_UP', picked_up_at: new Date().toISOString() }).eq('id', parcelData.id);
      await supabase.from('lockers').update({ is_available: true }).eq('id', parcelData.locker_id);
      
      setStep('SUCCESS'); 
      setTimeout(() => { setPickupCode(''); setParcelData(null); setStep('ENTER_CODE'); }, 7000);
    } catch (err: any) { 
      alert(err.message); 
    } finally { 
      setIsLoading(false); 
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-8 text-slate-900 relative">
      <Link href="/" className="absolute top-6 left-8 text-slate-400 hover:text-white transition-colors flex items-center">
        <ArrowLeft className="w-5 h-5 mr-2"/> กลับหน้าหลัก
      </Link>
      <div className="bg-white w-full max-w-5xl rounded-[2.5rem] shadow-2xl overflow-hidden flex min-h-[600px] border border-slate-800">
        
        <div className="w-1/3 bg-slate-900 p-12 text-white flex flex-col justify-between hidden md:flex border-r border-slate-800">
          <div>
            <div className="bg-purple-600 w-20 h-20 rounded-3xl flex items-center justify-center mb-8 shadow-lg shadow-purple-600/30">
              <Package className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-4xl font-bold leading-snug tracking-tight">ระบบรับพัสดุ<br/>อัตโนมัติ</h1>
          </div>
          <div className="space-y-6 opacity-80 font-medium">
            <p className="text-lg flex items-center"><span className="bg-slate-800 w-8 h-8 rounded-full flex items-center justify-center mr-3 text-sm font-bold">1</span> กรอกรหัส 6 หลัก</p>
            <p className="text-lg flex items-center"><span className="bg-slate-800 w-8 h-8 rounded-full flex items-center justify-center mr-3 text-sm font-bold">2</span> หยิบกล่องตามหมายเลข</p>
            <p className="text-lg flex items-center"><span className="bg-slate-800 w-8 h-8 rounded-full flex items-center justify-center mr-3 text-sm font-bold">3</span> สแกนบาร์โค้ดหน้ากล่อง</p>
          </div>
        </div>

        <div className="w-full md:w-2/3 p-12 flex flex-col items-center justify-center relative bg-slate-50">
          {step === 'ENTER_CODE' && (
            <div className="w-full max-w-md text-center animate-in fade-in duration-500">
              <h2 className="text-4xl font-bold text-slate-900 mb-4 tracking-tight">กรอกรหัสรับพัสดุ</h2>
              <form onSubmit={verifyCode}>
                <input type="text" maxLength={6} value={pickupCode} onChange={e=>setPickupCode(e.target.value.replace(/[^0-9]/g, ''))} className="w-full text-center text-6xl tracking-[0.4em] font-black text-slate-800 bg-white border-4 border-slate-200 rounded-3xl py-8 mb-8 focus:border-purple-500 outline-none shadow-sm transition-all" placeholder="------" autoFocus />
                <button disabled={pickupCode.length !== 6 || isLoading} className="w-full bg-purple-600 disabled:bg-slate-300 text-white py-6 text-2xl font-bold rounded-2xl flex justify-center hover:bg-purple-700 transition-all shadow-lg">
                  {isLoading ? <Loader2 className="animate-spin w-8 h-8"/> : 'ยืนยันรหัส'}
                </button>
              </form>
            </div>
          )}
          {step === 'SCAN_BARCODE' && (
            <div className="w-full max-w-lg text-center animate-in zoom-in-95 duration-500">
              <div className="bg-white border-2 border-yellow-400 p-6 rounded-3xl mb-8 shadow-lg">
                <p className="text-slate-600 text-lg mb-2 font-bold flex items-center justify-center gap-2"><AlertCircle className="w-6 h-6 text-yellow-500"/> พัสดุของคุณอยู่ที่</p>
                <div className="text-6xl font-black text-slate-900 drop-shadow-sm">โซน {parcelData.lockers?.zone} - ตู้ {parcelData.lockers?.locker_number}</div>
              </div>
              <h3 className="text-2xl font-bold mb-2 text-slate-800">กรุณาหยิบพัสดุและสแกนบาร์โค้ด</h3>
              <p className="text-slate-500 mb-6 font-medium">นำบาร์โค้ดหรือ QR Code มาเล็งหน้ากล้องเพื่อยืนยัน</p>
              
              <div className="max-w-sm mx-auto mb-4 relative">
                {isLoading && <div className="absolute inset-0 bg-black/60 z-10 flex items-center justify-center rounded-3xl"><Loader2 className="w-12 h-12 text-white animate-spin"/></div>}
                <FastKioskScanner onScanSuccess={checkout} />
              </div>
              
              <button onClick={() => checkout(parcelData.tracking_number)} className="mt-4 text-sm text-slate-400 hover:text-slate-600 font-medium transition-colors">
                (Dev Mode) ข้ามการสแกน
              </button>
            </div>
          )}
          {step === 'SUCCESS' && (
            <div className="text-center animate-in zoom-in duration-500">
              <CheckCircle2 className="w-40 h-40 text-emerald-500 mx-auto mb-8 drop-shadow-md"/>
              <h2 className="text-5xl font-black text-slate-900 mb-4 tracking-tight">รับพัสดุสำเร็จ!</h2>
              <p className="text-2xl text-slate-600 font-medium mb-10">ขอบคุณที่ใช้บริการตู้รับพัสดุอัตโนมัติ</p>
              <div className="inline-block bg-slate-100 px-6 py-3 rounded-full text-slate-500 font-medium animate-pulse">หน้าจอจะกลับสู่หน้าหลักใน 7 วินาที...</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}