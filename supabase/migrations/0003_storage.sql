-- Storage buckets + policies (PRD §10 deliverable 5)
--  - `covers`        book cover images (public read; admin/writer upload)
--  - `book-content`  full chapter/body blobs (private; only purchasers read)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('covers', 'covers', true, 5 * 1024 * 1024, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- Book content kept in DB for MVP (small/few chapter texts). If you store full
-- bodies here instead, treat it as PRIVATE (public=false):
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('book-content', 'book-content', false, 50 * 1024 * 1024, array['text/plain','application/json'])
on conflict (id) do nothing;

-- Covers: public read, writers (admin; here: authenticated members of an admin
-- list cannot be enforced by RLS easily, so we allow authenticated upload into
-- a path by admin flag via the is_admin() helper).
create policy "covers_public_read"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'covers');

-- Admin uploads only. We gate on public.is_admin() so only configured admins
-- can write into the bucket (defense-in-depth with app-level checks).
create policy "covers_admin_write"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'covers' and public.is_admin());

create policy "covers_admin_update"
  on storage.objects for update to authenticated
  using (bucket_id = 'covers' and public.is_admin());

create policy "covers_admin_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'covers' and public.is_admin());

-- book-content: private. Purchasers can read files under the path of books they
-- bought. We scope reads by an RLS subquery on chapters.books -> purchases.
-- File paths convention: <book_id>/<chapter_slug>.txt OR <book_id>/body.json
create policy "bookcontent_read_purchased"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'book-content'
    and exists (
      select 1 from public.books b
      join public.purchases p on p.book_id = b.id
      where b.id::text = (storage.foldername(name))[1]  -- first path segment = book_id
        and p.user_id = auth.uid()
        and p.status = 'paid'
    )
  );

-- Admin can read/Write book-content.
create policy "bookcontent_admin_all"
  on storage.objects for all to authenticated
  using (bucket_id = 'book-content' and public.is_admin());
