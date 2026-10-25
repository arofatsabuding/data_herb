'use client';

import { useEffect, useRef } from 'react';
import 'swagger-ui-dist/swagger-ui.css';

/**
 * Swagger UI สำหรับทดสอบเรียก REST API จริงจากเบราว์เซอร์ (ปุ่ม Try it out)
 * อ่านเอกสารจาก url (OpenAPI JSON) — โหลด bundle เฉพาะหน้านี้ ไม่ให้หน้าอื่นหนักขึ้น
 */
export default function SwaggerUI({ url }) {
  const ref = useRef(null);

  useEffect(() => {
    const node = ref.current;
    let cancelled = false;
    import('swagger-ui-dist/swagger-ui-bundle.js').then(({ default: SwaggerUIBundle }) => {
      if (cancelled || !node) return;
      SwaggerUIBundle({
        url,
        domNode: node,
        deepLinking: true,
        tryItOutEnabled: true, // เปิดช่องกรอกค่าให้เลย ไม่ต้องกด Try it out ก่อน
        docExpansion: 'list',
        defaultModelsExpandDepth: -1, // ซ่อนส่วน Schemas ท้ายหน้า
        displayRequestDuration: true,
      });
    });
    return () => {
      cancelled = true;
      if (node) node.innerHTML = '';
    };
  }, [url]);

  return <div ref={ref} className="swagger-wrap" />;
}
