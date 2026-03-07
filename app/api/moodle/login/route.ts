import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json({ error: 'กรุณาส่ง Username และ Password' }, { status: 400 });
    }

    // 1. ขอ Token จาก LMS PSU
    const moodleUrl = `https://lms.psu.ac.th/login/token.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&service=moodle_mobile_app`;

    const response = await fetch(moodleUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await response.json();

    if (data.error) {
      return NextResponse.json({ success: false, error: data.error }, { status: 401 });
    }

    // 2. ถ้าได้ Token มาแล้ว ให้เอา Token ไปดึงข้อมูลโปรไฟล์ (ชื่อ-นามสกุล) ต่อ
    if (data.token) {
      const userInfoUrl = `https://lms.psu.ac.th/webservice/rest/server.php?wstoken=${data.token}&wsfunction=core_webservice_get_site_info&moodlewsrestformat=json`;
      
      const userInfoRes = await fetch(userInfoUrl, { method: 'POST' });
      const userInfo = await userInfoRes.json();

      return NextResponse.json({ 
        success: true, 
        token: data.token,
        fullname: userInfo.fullname || username // ถ้าดึงชื่อไม่ได้ให้ใช้รหัสนักศึกษาแทน
      });
    }

    return NextResponse.json({ success: false, error: 'ไม่สามารถยืนยันตัวตนได้' }, { status: 400 });

  } catch (error: any) {
    console.error('Moodle API Error:', error);
    return NextResponse.json({ success: false, error: 'ระบบขัดข้อง ไม่สามารถเชื่อมต่อ LMS ได้' }, { status: 500 });
  }
}