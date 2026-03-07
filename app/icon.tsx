import { ImageResponse } from 'next/og';

export const runtime = 'edge';

// ตั้งค่าขนาดและประเภทของภาพ
export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#059669', // สีพื้นหลัง (Emerald 600)
          borderRadius: '8px',
        }}
      >
        {/* วาด SVG รูปกล่องพัสดุ (Package) ดิบๆ ลงไปเลย */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z" />
          <polyline points="12 22 12 12 3 7" />
          <polyline points="21 7 12 12" />
          <polyline points="12 12 16.5 9.4" />
        </svg>
      </div>
    ),
    { ...size }
  );
}