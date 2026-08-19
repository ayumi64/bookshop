import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { isAdminEmail } from '@/lib/config';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';

/**
 * POST /api/admin/upload-cover  (multipart form-data: `file`)
 * Admin-only upload of a book cover into the public `covers` Storage bucket
 * (migration 0003). Uses the service-role client (bypasses RLS; the RLS
 * `covers_admin_write` policy also permits admin uploads but we rely on the
 * explicit ADMIN_EMAILS check here for clarity and portability).
 *
 * Returns `{ url }` = the public URL to store in books.cover_url.
 */
export async function POST(req: Request) {
  // Admin gate (defense-in-depth; the middleware already redirects non-admins).
  const { user } = await getCurrentUser();
  if (!user?.email || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file (image) required' }, { status: 400 });
  }

  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.type)) {
    return NextResponse.json({ error: '仅支持 JPEG/PNG/WebP 图片' }, { status: 400 });
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: '封面超过 5MB 限制' }, { status: 400 });
  }

  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const key = `covers/${randomUUID()}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const supabase = createServiceClient();
  const { error } = await supabase.storage
    .from('covers')
    .upload(key, bytes, {
      contentType: file.type,
      upsert: false,
    });
  if (error) return NextResponse.json({ error: `上传失败：${error.message}` }, { status: 500 });

  const { data: url } = supabase.storage.from('covers').getPublicUrl(key);
  return NextResponse.json({ url: url.publicUrl });
}
