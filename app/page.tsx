import Link from 'next/link';
import { Package, User, MonitorSmartphone, ArrowRight } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
      <div className="text-center mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="bg-blue-600 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-600/30">
          <Package className="w-12 h-12 text-white" />
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-slate-900 tracking-tight mb-4">ระบบจัดการพัสดุอัจฉริยะ</h1>
        <p className="text-lg text-slate-600 max-w-xl mx-auto font-medium">เลือกระบบที่คุณต้องการเข้าใช้งานจากเมนูด้านล่าง</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl">
        <Link href="/courier" className="group bg-white p-8 rounded-3xl shadow-sm hover:shadow-xl hover:-translate-y-2 transition-all duration-300 border border-slate-100">
          <div className="bg-blue-50 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-blue-600 transition-colors">
            <Package className="w-8 h-8 text-blue-600 group-hover:text-white transition-colors" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">พนักงานขนส่ง</h2>
          <p className="text-slate-600 mb-6 font-medium leading-relaxed">สำหรับพนักงานขนส่งเพื่อบันทึกพัสดุเข้าตู้ล็อกเกอร์</p>
          <div className="flex items-center text-blue-600 font-bold group-hover:translate-x-2 transition-transform">เข้าใช้งาน <ArrowRight className="w-5 h-5 ml-2" /></div>
        </Link>

        <Link href="/student" className="group bg-white p-8 rounded-3xl shadow-sm hover:shadow-xl hover:-translate-y-2 transition-all duration-300 border border-slate-100">
          <div className="bg-emerald-50 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-emerald-500 transition-colors">
            <User className="w-8 h-8 text-emerald-600 group-hover:text-white transition-colors" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">นักศึกษา</h2>
          <p className="text-slate-600 mb-6 font-medium leading-relaxed">เช็คสถานะพัสดุและรับรหัส 6 หลัก สำหรับเปิดตู้</p>
          <div className="flex items-center text-emerald-600 font-bold group-hover:translate-x-2 transition-transform">เข้าใช้งาน <ArrowRight className="w-5 h-5 ml-2" /></div>
        </Link>

        <Link href="/kiosk" className="group bg-white p-8 rounded-3xl shadow-sm hover:shadow-xl hover:-translate-y-2 transition-all duration-300 border border-slate-100">
          <div className="bg-purple-50 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-purple-600 transition-colors">
            <MonitorSmartphone className="w-8 h-8 text-purple-600 group-hover:text-white transition-colors" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">ตู้ Kiosk (หน้าห้อง)</h2>
          <p className="text-slate-600 mb-6 font-medium leading-relaxed">หน้าจอสัมผัสสำหรับตั้งไว้หน้าห้องพัสดุเพื่อสแกนรับของ</p>
          <div className="flex items-center text-purple-600 font-bold group-hover:translate-x-2 transition-transform">เข้าใช้งาน <ArrowRight className="w-5 h-5 ml-2" /></div>
        </Link>
      </div>
    </div>
  );
}