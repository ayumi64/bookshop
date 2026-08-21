'use client';

import { useState } from 'react';
import { useFormState } from 'react-dom';
import type { AdminFormState } from '@/app/admin/actions';
import { SubmitButton } from '@/components/forms/submit-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/**
 * Admin book form (上架 / 编辑) — reused by /admin/books/new and
 * /admin/books/[id]/edit. Submits to a Server Action (createBook or updateBook)
 * via useFormState so errors are shown inline. Covers can be uploaded as a
 * file; the action pushes it to the `covers` storage bucket.
 */

export interface BookFormValues {
  id?: string;
  slug: string;
  title: string;
  author: string;
  category: string;
  blurb: string;
  price_cents: string;
  currency: string;
  cover_url: string;
  body_location: string;
  body_text: string;
  trial_chapters: string;
  trial_percent: string;
  status: string;
}

export function BookForm({
  action,
  initial,
  submitLabel,
}: {
  action: (prev: AdminFormState, formData: FormData) => Promise<AdminFormState>;
  initial?: Partial<BookFormValues>;
  submitLabel: string;
}) {
  const [state, formAction] = useFormState(action, {});
  const [coverUrl, setCoverUrl] = useState(initial?.cover_url ?? '');
  const [bodyLocation, setBodyLocation] = useState(initial?.body_location ?? '');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const uploadCover = async (file: File) => {
    setUploading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/admin/upload-cover', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '封面上传失败');
      setCoverUrl(json.url);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : '封面上传失败');
    } finally {
      setUploading(false);
    }
  };

  return (
    <form action={formAction} className="space-y-6">
      {initial?.id && <input type="hidden" name="id" value={initial.id} />}

      {state.error && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="slug">Slug（URL 标识）*</Label>
          <Input
            id="slug"
            name="slug"
            defaultValue={initial?.slug}
            placeholder="my-new-book"
            required
          />
          <p className="text-xs text-muted-foreground">仅限 a-z 0-9 连字符，用作 /books/{'{slug}'}。</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="title">标题 *</Label>
          <Input id="title" name="title" defaultValue={initial?.title} placeholder="书名" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="author">作者</Label>
          <Input id="author" name="author" defaultValue={initial?.author} placeholder="作者名" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="category">分类</Label>
          <Input id="category" name="category" defaultValue={initial?.category} placeholder="Classic / Mystery / …" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="price">价格（元，支持小数）*</Label>
          <Input
            id="price"
            name="price"
            type="number"
            step="0.01"
            min="0"
            defaultValue={initial?.price_cents ? (Number(initial.price_cents) / 100).toString() : ''}
            placeholder="2.99"
            required
          />
          <p className="text-xs text-muted-foreground">将换算为「分」存储。</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="currency">币种</Label>
          <Input id="currency" name="currency" defaultValue={initial?.currency || 'usd'} placeholder="usd" />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="blurb">简介（可展开）</Label>
        <Textarea id="blurb" name="blurb" defaultValue={initial?.blurb} rows={3} placeholder="书籍简介…" />
      </div>

      <fieldset className="grid gap-4 rounded-md border p-4 md:grid-cols-4">
        <legend className="px-2 text-sm font-medium">试读阈值</legend>
        <div className="space-y-2">
          <Label htmlFor="trial_chapters">试读章数</Label>
          <Input
            id="trial_chapters"
            name="trial_chapters"
            type="number"
            min="0"
            defaultValue={initial?.trial_chapters ?? '2'}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="trial_percent">试读百分比 (%)</Label>
          <Input
            id="trial_percent"
            name="trial_percent"
            type="number"
            min="0"
            max="100"
            defaultValue={initial?.trial_percent ?? '10'}
          />
        </div>
        <div className="space-y-2 col-span-2">
          <Label htmlFor="status">状态</Label>
          <Select name="status" defaultValue={initial?.status || 'published'}>
            <SelectTrigger aria-label="状态"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="published">已上架（published）</SelectItem>
              <SelectItem value="draft">草稿（draft）</SelectItem>
              <SelectItem value="archived">已归档（archived）</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </fieldset>

      <div className="space-y-2 rounded-md border p-4">
        <Label htmlFor="cover">封面（上传到 Storage `covers`）</Label>
        <div className="flex flex-wrap items-center gap-3">
          <input
            id="cover"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadCover(f);
            }}
            className="text-sm text-muted-foreground"
          />
          {uploading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />}
          {uploadError && <span className="text-sm text-destructive">{uploadError}</span>}
          {coverUrl && <span className="max-w-full truncate text-xs text-primary">{coverUrl}</span>}
        </div>
        <input type="hidden" name="cover_url" value={coverUrl} />
        <p className="text-xs text-muted-foreground">或直接填写已存在封面 URL 在下方：</p>
        <Input
          aria-label="封面 URL"
          value={coverUrl}
          onChange={(e) => setCoverUrl(e.target.value)}
          placeholder="https://…/cover.jpg"
        />
      </div>

      <div className="space-y-2 rounded-md border p-4">
        <Label htmlFor="body_location">正文 Storage 位置（book-content bucket）</Label>
        <Input
          id="body_location"
          name="body_location"
          value={bodyLocation}
          onChange={(e) => setBodyLocation(e.target.value)}
          placeholder="book-content/my-book"
        />
        <Label htmlFor="body_text" className="mt-4">或直接粘贴正文（自动分章）</Label>
        <Textarea
          id="body_text"
          name="body_text"
          defaultValue={initial?.body_text}
          rows={6}
          placeholder={'# 第一章\n正文…\n\n# 第二章\n正文…'}
        />
        <p className="text-xs text-muted-foreground">
          以主题行（# 标题）或空行分章。若已提供 Storage location 可留空。
        </p>
      </div>

      <SubmitButton className="w-full md:w-auto">{submitLabel}</SubmitButton>
    </form>
  );
}
