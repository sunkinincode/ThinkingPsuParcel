import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query || query.length < 3) {
      return NextResponse.json({ users: [] });
    }

    // URL ของ LMS ม.อ.
    const MOODLE_BASE_URL = 'https://lms.psu.ac.th';
    
    // สำคัญมาก: ต้องขอ Token จากแอดมินระบบ Moodle ที่มีสิทธิ์ค้นหา User ได้ (moodle/user:viewdetails)
    // แล้วนำมาใส่ในไฟล์ .env.local ชื่อ MOODLE_ADMIN_TOKEN
    const MOODLE_ADMIN_TOKEN = process.env.MOODLE_ADMIN_TOKEN; 

    if (!MOODLE_ADMIN_TOKEN) {
      console.error('Missing MOODLE_ADMIN_TOKEN in .env.local');
      // ข้อมูลจำลอง (Mock) กรณีไม่มี Token แอดมิน เพื่อให้โปรเจกต์รันทดสอบต่อไปได้
      const mockUsers = [
        { id: '1', student_code: '64010001', full_name: 'สมชาย ใจดี', phone: '0812345678' },
        { id: '2', student_code: '64010002', full_name: 'สมหญิง รักเรียน', phone: '0898765432' },
        { id: '3', student_code: '65101103', full_name: 'สมชาย ยอดเยี่ยม', phone: '0811112222' }
      ].filter(u => u.full_name.includes(query) || u.phone.includes(query));
      
      return NextResponse.json({ users: mockUsers });
    }

    // ค้นหาจากชื่อ (fullname) โดยใช้ % นำหน้าและตามหลัง เพื่อค้นหาคำบางส่วน
    const moodleUrl = `${MOODLE_BASE_URL}/webservice/rest/server.php?wstoken=${MOODLE_ADMIN_TOKEN}&wsfunction=core_user_get_users&moodlewsrestformat=json&criteria[0][key]=fullname&criteria[0][value]=%${encodeURIComponent(query)}%`;

    const response = await fetch(moodleUrl, { method: 'POST' });
    const data = await response.json();

    if (data.exception) {
      throw new Error(data.message);
    }

    // จัด Format ข้อมูลที่ได้จาก Moodle ให้ใช้งานง่ายขึ้น
    let formattedUsers = [];
    if (Array.isArray(data.users)) {
      formattedUsers = data.users.map((u: any) => ({
        id: u.id,
        student_code: u.username, // Moodle มักใช้ username ในการเก็บรหัสนักศึกษา
        full_name: u.fullname,
        phone: u.phone1 || u.phone2 || '-'
      }));
    }

    return NextResponse.json({ users: formattedUsers });

  } catch (error: any) {
    console.error('Moodle Search API Error:', error);
    return NextResponse.json({ error: 'ไม่สามารถสืบค้นข้อมูลจาก Moodle ได้' }, { status: 500 });
  }
}