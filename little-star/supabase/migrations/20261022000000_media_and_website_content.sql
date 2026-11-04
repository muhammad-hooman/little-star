create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  asset_key text not null unique,
  product_id uuid references public.products (id) on delete set null,
  asset_name text not null,
  asset_type text not null check (asset_type in (
    'product', 'hero', 'banner', 'category', 'brand', 'size-chart', 'section', 'other'
  )),
  storage_path text unique,
  external_url text,
  mime_type text,
  file_size bigint check (file_size is null or file_size >= 0),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  alt_text text not null default '',
  display_order integer not null default 0 check (display_order >= 0),
  is_published boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (storage_path is not null or external_url is not null)
);

create index media_assets_type_order_idx on public.media_assets (asset_type, display_order, asset_name);
create index media_assets_created_idx on public.media_assets (created_at desc);
create trigger media_assets_set_updated_at
  before update on public.media_assets
  for each row execute function public.set_updated_at();

create table public.website_content (
  content_key text primary key,
  label text not null,
  content_type text not null check (content_type in ('hero', 'banner', 'section', 'size-chart', 'announcement', 'footer')),
  published_payload jsonb not null default '{}'::jsonb check (jsonb_typeof(published_payload) = 'object'),
  draft_payload jsonb not null default '{}'::jsonb check (jsonb_typeof(draft_payload) = 'object'),
  is_published boolean not null default false,
  draft_enabled boolean not null default true,
  published_enabled boolean not null default true,
  display_order integer not null default 0 check (display_order >= 0),
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index website_content_type_order_idx on public.website_content (content_type, display_order);
create trigger website_content_set_updated_at
  before update on public.website_content
  for each row execute function public.set_updated_at();

create table public.media_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  event_type text not null check (event_type in (
    'asset_uploaded', 'asset_replaced', 'asset_metadata_updated', 'asset_deleted',
    'product_created', 'product_updated',
    'content_draft_saved', 'content_published', 'content_unpublished'
  )),
  asset_id uuid references public.media_assets (id) on delete set null,
  content_key text,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default timezone('utc', now())
);

create index media_audit_log_created_idx on public.media_audit_log (created_at desc);
create index media_audit_log_actor_idx on public.media_audit_log (actor_id, created_at desc);

alter table public.product_images
  add column if not exists alt_text text not null default '';

alter table public.media_assets enable row level security;
alter table public.website_content enable row level security;
alter table public.media_audit_log enable row level security;

create policy "Public can read published media assets"
  on public.media_assets for select to anon, authenticated
  using (is_published or (select public.is_admin()));
create policy "Public can read published website content"
  on public.website_content for select to anon, authenticated
  using (is_published or (select public.is_admin()));
create policy "Admins can read media audit log"
  on public.media_audit_log for select to authenticated
  using ((select public.is_admin()));

revoke all on public.media_assets, public.website_content, public.media_audit_log from anon, authenticated;
grant select on public.media_assets, public.website_content to anon, authenticated;
grant select on public.media_audit_log to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images', 'product-images', true, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Admins can delete product images" on storage.objects;
create policy "Admins can delete unused product images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'product-images'
    and (select public.is_admin())
    and not exists (
      select 1 from public.product_images
      where product_images.storage_path = storage.objects.name
    )
    and not exists (
      select 1 from public.media_assets
      where media_assets.storage_path = storage.objects.name
    )
  );

create or replace function public.sync_product_image_media_asset()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  if tg_op = 'DELETE' then
    update public.media_assets
    set product_id = (
      select product_id from public.product_images
      where storage_path = old.storage_path
      limit 1
    )
    where asset_key = 'product-image:' || old.id::text;
    return old;
  end if;

  select products.name into v_name
  from public.products
  where products.id = new.product_id;

  update public.media_assets
  set product_id = new.product_id,
      storage_path = new.storage_path,
      alt_text = coalesce(nullif(new.alt_text, ''), v_name, 'Product image'),
      display_order = new.sort_order,
      is_published = true
  where asset_key = 'product-image:' || new.id::text;
  if not found then
    insert into public.media_assets (
      asset_key, product_id, asset_name, asset_type, storage_path, alt_text, display_order, is_published
    ) values (
      'product-image:' || new.id::text, new.product_id,
      coalesce(v_name, 'Product image') || ' image',
      'product', new.storage_path,
      coalesce(nullif(new.alt_text, ''), v_name, 'Product image'),
      new.sort_order, true
    )
    on conflict (storage_path) do update set
      asset_key = excluded.asset_key,
      product_id = excluded.product_id,
      alt_text = excluded.alt_text,
      display_order = excluded.display_order,
      is_published = true;
  end if;
  return new;
end;
$$;

create trigger product_images_sync_media_asset_insert
  after insert on public.product_images
  for each row execute function public.sync_product_image_media_asset();

create trigger product_images_sync_media_asset_update
  after update of storage_path, alt_text, sort_order on public.product_images
  for each row execute function public.sync_product_image_media_asset();

create trigger product_images_sync_media_asset_delete
  after delete on public.product_images
  for each row execute function public.sync_product_image_media_asset();

insert into public.media_assets (asset_key, asset_name, asset_type, external_url, alt_text, display_order)
values
  ('home.hero.primary', 'Home hero - Little Stars', 'hero',
   'https://lh3.googleusercontent.com/aida-public/AB6AXuCD5cYks7Tf8e_zfKaX2vd6XGTuhFeajcqYNxUopDtj3ahh4LcKYTjX1JfNhKmxl4mzd2im0_Z0TbBjCDsW9fYiBVDWF9kSzE3r5XRaAhZTZHZqnPuMuJQALpL0XXq-SEYoWSZxskq5pqk2H2sZbutHybIigM2qaI582CgsUnlzhU1Vc_X4vZ491yVQpiQiqPHgf19i2laqp2iax4zfyM89M7Y1A_lqxcyWLYwHXMKt4DJKHBd5CXSu',
   'Stylish young model in tailored luxury children''s clothing', 0),
  ('home.hero.formal', 'Home hero - Handcrafted Elegance', 'hero',
   'https://lh3.googleusercontent.com/aida-public/AB6AXuAOHZj7Sep-7290IsgdzITdlnbtIx0TGNaA-iXSGMyu6RrqjvDbWlcExEEXGAjA_X2uQn1HuhdY7Ec1RWTRp34OkCT3M8mpOhFuYxIl0E_I7LHBx_ORIByEqdXuu94Ye4sRA04V6bbTCrIQVN0IRve6ylZ8tCBSX9sXTbxnVrW1CtO65TqU88u9mUrOWtTAxF9-yMP_mjxqdwgp61w8RsmaHSDPgZyzxfa-SuU04I4u5IsH6fi218oj',
   'Tailored luxury formal suit', 1),
  ('home.editorial.everyday', 'Editorial - Little Street Wear', 'banner',
   'https://lh3.googleusercontent.com/aida-public/AB6AXuBrokJeVORIhZLZ6UivfcbgwJVi4NqQjc5Cdoc4Wd0zfx2A40QymK6lAKzIgExApQLGiKtm0cuFtPr05CgV-jd3VY2svEPKXkxC6hiUSmraBEnEz1wdb0dX16xVAG2BETbTOF6eAgrwXlM-rlUQ67Mj23JWn-_n4NbCs6UdzVX5qbfnOumABQ78zhdepO42SUTFJO_rKg1BfTHQdSkszhg6Wmj6T9DfbMhz3YFBaW_aknh2h_CXT6cT',
   'Little Street Wear campaign', 2),
  ('home.editorial.sherwani', 'Editorial - Traditional Elegance', 'banner',
   'https://lh3.googleusercontent.com/aida-public/AB6AXuDi5XjgVAm49nLl3SG-Cv4VhO8UarmBdhkomskNtwMHHSqRW4WxgCXj0lYTznetTQ4YdpGFZx5a3GWrghwgHsGJdjfR9riJYevfRm_Q_PPer7qMEw5TPJ2Jj01HmSU8MEwJVMXsrtAlZEa1kgGw0MAr6psC8qnf0MBoC6A3RWJaZPLH0eF_CfvP7QLymE-ALK14G8nXvJj7upPcM3Ji2MvLn_Bw_tF97bBWQIAbhP93atG5jbSGydTL',
   'Festive traditional children''s wear', 3),
  ('home.wide-banner', 'Wide banner - Little Gentleman', 'banner',
   'https://lh3.googleusercontent.com/aida-public/AB6AXuA13Ad-HhVxjF9JgHgst9URKs4iyPE2D7PzvmrnntbPzbvWrk7BRMsfH8lwVIA4vg3rQf_rU8eZCMxD2tOww4fRhg-UGO8L1A5ZLC5iFpMKzYU9emjSEgbAchB-rZMafZ-0aJdoJskD6867PyLsC3ZT5Ry5jsZ8s6EVyUBvHBVvKWe3Y3DpcnWtjSsC_LlXgaNb0kYVuJD329eTAUgMAcLzUThTsTbamM41sO1T12Zs08nzT_9ksgxe',
   'Young model wearing jacket in casual urban setting', 4),
  ('home.occasion.wedding', 'Occasion - Weddings', 'section',
   'https://lh3.googleusercontent.com/aida-public/AB6AXuBC7ZYWcXX4tBPhxQkUCTvFMXESokVH8zoPpnujsK-njRUM82jg7KmxzQpZOHwYoj5PeWaUIht8nUl5fTJaJPc_gfNlASSN_xfMjCPvgZbhILnZKz97Drb4sZJmXmtqMAkG6v6E5Lp8N75MfRxyJThUDxp-6JWHEtUEAVqkRTRYU6cZ7I9yf307DzwlHqrqLnzDH5DiaU52aC2hMgS9gH6uhHKhSXf-u9Ed2hbVi6CEJAEhOpbhZKB4',
   'Weddings and celebrations children''s clothing', 5),
  ('home.occasion.eid', 'Occasion - Eid', 'section',
   'https://lh3.googleusercontent.com/aida-public/AB6AXuDIr-AAEDYVwwzTvslv_ixJ1SJvguu3DHZeWKoV0HsCqtwfc8S_KKKGIb3jzEEljT3futBI6Cypt6lgDEEK6E5Wa6EEY9NYC3NhZAI1Jm3sJ-k6jOVcpOiI_2-vepAbJWBHURC-TCz1J5EUeYGre8mEEe5Q3ckuHsddEnL9sXqttGNF8E_X_GxXLv_96jgMY6M8yi3zsHozfBPgsQ4w397nIa0gdeCe7V5q6JFkOGQgXJ3_c7xF1Zjq',
   'Eid and festive wear for boys', 6),
  ('home.occasion.prince', 'Occasion - Prince Collection', 'section',
   'https://lh3.googleusercontent.com/aida-public/AB6AXuDk-8D9UXdvwXEG-6QTj2-dLcbkWd31Onj4P0Cflaw1zif4bjtYCbhSVq95fCzC2w056P-2afAxvXLHHz9yn8h7xtCW9KJA3xsSLXR93eiBxMRBnqyC7jjnYlmVbusTvUCmSj2XWTGeKOBZNW70T8Ll2uP6ci_RsmGhLRWsJv7gYICqn3FxY7ubaRn-PBVnYm5atQ0vLdKw3_06a7Nfuf72XlWSDlyxpYjAVaKCcBLRc6XGjaQa29iK',
   'Prince Coat Regal Collection', 7),
  ('product.sample.1', 'Sample product 1 - Premium Casual Shirt', 'product',
   'https://lh3.googleusercontent.com/aida-public/AB6AXuCa1ZdZJa_rs6beBRYfQBddKvPaYsES9mXcar8wrapM9E52vdeXPjMFXHC5mFf4eMOVL5vPl6GKB4GqgTyyQ5i7w7AkskFztug8iUQ9KzUEiW_K8ieJnx4A3h0A_XCLTAIAHUVsBHSoqS58WNnomVxPSb9S2fuauP6dchV3zruP4qkkxywfsS1Z9k0oL7IegrGYusy6hhpqGQHtQnduC6uBmWhmSxY-sBTCT1lEPchTEfor5VHZdxGP',
   'Premium casual shirt for children', 8),
  ('product.sample.2', 'Sample product 2 - Kids Cotton Kurta', 'product',
   'https://lh3.googleusercontent.com/aida-public/AB6AXuDNA3tOxEOGKUBsFFjkmleRAX_ip5Lnuew10TLoNShLbt5KPepLQGLkazXgZicAKeS2UxBWdz5VrBt1tCjaTjXRBjH5lhVC4jAUHFhGomdG8sTNQjtto38Lwi3FmErXA738R8EJxilQXtQJTwhsCL17kdvJ7vOJMJCI9EvPn8UKM90n2x-wwhMbDBtPomQy5Jy-4pJ1aH3hg5V1u6px9HPmqf2e5Lrk6ya-JBQv0CUXXygRC3kZqVx9',
   'Kids cotton kurta', 9),
  ('product.sample.3', 'Sample product 3 - Classic Coat Pant Suit', 'product',
   'https://lh3.googleusercontent.com/aida-public/AB6AXuBSEU2wYPcGk50LKixVLakLj1nydAykbl0y-KGjfCkI-o95UQtk3PAQ_EEfkGU8PYuqVmVwlCvM6QWrkLnPjniEmKJYZ6G-yywQu7qYhOLO2EsFNpEbzJ22wZqhFfLGknzi3bWb40Tsu2-3ugkp2fOZeZu_2AR7Sue1QZYSLJj3YEpCi4qoHydV6YOE-Sa6wjwnKWPe99t5CG1tor4GhtkdcJ-XOGSqBQqm8bKiGuwMjwY7BhIdWLpX',
   'Classic coat pant suit', 10),
  ('product.sample.4', 'Sample product 4 - Elegant Prince Coat', 'product',
   'https://lh3.googleusercontent.com/aida-public/AB6AXuB92k2Eu1s7gxOllDSvdc5WI3WAJisXSBS9flfwjjvL4seXkWjLAJK0YR6eYe7bst6YsiPwGUAmQ_HFP_7J99_aYSwAleWc8lLCOlbHD0gzF6ld36v54DSk_fWe7qEylITczxStdEcXR8PTt6rUiDA5oLAu_2xbQhBSu_vzBcmt_SfxKLge6kWES1b5qBFzxYwRBKKzxFAWQUAnqBMT2F72GHgYERwBj8w9WzGINSB_ww1C4Ydm48QP',
   'Elegant prince coat', 11),
  ('product.sale.101', 'Sale product 101 - Casual Shirt Set', 'product',
   'https://lh3.googleusercontent.com/aida-public/AB6AXuD95JUaeJeWIzX42M58-3Xh2qGBZ6ZzmxZilSIY-VJgLMN4MepAxbRTqqGif4Up_u8yK4dM3rpoBIwmwqUNsaZQ8DaB_BjHzK8aX9Z4UxdQ6poSdLzXN4gsKeSfpTmEllyKUzycdo_rTB_Y593mFJNPYCgE7gtt7rqTa1hTGYXboyGhVxV-Lo5ebXdvcIaYG1CTpjCdQMqsXiYFiWY4krZWk31W6tfjhC_L4pmCYh5H83-XOWzF3JpL',
   'Casual shirt set', 12),
  ('product.sale.102', 'Sale product 102 - Waistcoat Outfit', 'product',
   'https://lh3.googleusercontent.com/aida-public/AB6AXuCTN2THzMPRStUTr9zUlKZQroTHbmQkAtgpasPwz00ax26YeH3ol0cZQLf2tuu9z9sgScNbdPjP25cmUKT83sVP6nPvwsLuMVVVjAkEclN4K-2fvm22V2O8gh-4S7ROf3vuHqjVIHw8LJ9ELnMiDqGyA3icQlXLe3qkVfDe17JGqZD25BxS2eyb3dZwPvgCBO6LBeiBK4Nglro6aeKP0fkD7pPpTrox99wINJVN2BMJzjxmmbRzMxDJ',
   'Kids waistcoat outfit', 13),
  ('product.sale.103', 'Sale product 103 - Formal Coat Pant Suit', 'product',
   'https://lh3.googleusercontent.com/aida-public/AB6AXuB98udwtWBlJ2FPB4L_O30bDmpie8SSObMq40N6QvPr3lTVmJbgHrN9E3ID-aiv-KepaAB8adEr8a0dWIgpNnv-PKwFMCGSb5PVRyla2zui_6Wp5PPVSEwIOlj3pwF7-FWMlJgbeepebMJJEloV2e8GFSB-PSl1UnBGWM8Kk7h-MrUnJAZF5YMuwmSjU5OAGDRg1C22O_rSwcvvI85HJLRci_PayJNFBVXmIjPscwNBgJGQquAZbhX7',
   'Formal coat pant suit', 14),
  ('product.sale.104', 'Sale product 104 - Festive Sherwani', 'product',
   'https://lh3.googleusercontent.com/aida-public/AB6AXuCXMevKAsI9Kb297wibBbX8amnXYyISofXvbxn_QzpZREKVAqdQrmECMvmO8hi7_iqVqZ3YCGz1aNHUKF7mTo26uzBrbx66NbM_3xXBz9O2kcd4hzktfynVqga906rmJ5QxlxMPHTVKiSy4SlLG5ZJWvzVHml67ObaZe6Q0DEOuRFZJb64h_0rocWVUYRazj3MtpICnjQVYmem_tBcL3T3bHnLrrhdEIa-cbcKPUG97v5kG27VEhtcz',
   'Festive sherwani', 15),
  ('journal.1', 'Journal 1 - Casual style guide', 'section',
   'https://lh3.googleusercontent.com/aida-public/AB6AXuBA3_mVDWHOul7X5cmpjJsYslkcXXcZI4zKv56OAGF7dwOwfMtaRVXUVDH1FTaEYLKHOaqQ3AUQUqbd9dcGzIb14Jl6BTO5OVEQs0RPeMcQBkUrD3enLWOaguM3J8sdDoJF1XPwKGag9DPjPYT1zw5b9Om_eyX4ftDIsf6sPXd8WteZIhKSGlJUZDL6dvNjlo7eIFLdXN-45vaose3aizsTVd3QXgYkLiEgYVZ-CKqEG4VBx8jWHd2M',
   'Casual kids style guide', 17),
  ('journal.2', 'Journal 2 - Wedding style guide', 'section',
   'https://lh3.googleusercontent.com/aida-public/AB6AXuCYPEPhAEIqLgFatVCC-WEkMoG1SEgUv_VARzEWqtusJa7TbGB6I-Vtwy1lCIQXUhtwBpO2OxMDe_woXgbfCIf2BNJS-m3MpTAqmPXoyAvgr04vbOmJ1HD22ocAA9vQz11OWrSCfRd_lPy3TcmterPla6VoaMDaf39NutH4ywP8_KcekC4OhTQHM4JoQ-uDl1TFUvaqj4fKv_cGAik_fYt7z_Lm4AABzX6sYU-wXs5iK3ucKCJ4bXMC',
   'Little gentleman wedding style guide', 18),
  ('journal.3', 'Journal 3 - Festive heritage guide', 'section',
   'https://lh3.googleusercontent.com/aida-public/AB6AXuBa3bhadm3-aO-_EkMEgb1AbLpflCgEUfr-sxxUMLJp6mCJzX4ELYdqhw414dJHgQmlStDxXXdSe0mI4yymtvq5HJksdVKxaFQEiaQ2i8HB7e-6PDKMSQEU-tMhnwxrPSX1veSXpiu1vFd9ucCv4rLS-e1wefWKxDST5o9agjeFhx0Ji0DoTWRvCi2oQLL4-b1bVEWSs-qi2e2Lr_VOsJ_bPTjKRfWn2ZjCDYMdJhaazgwoFUvQDJhB',
   'Festive sherwani and prince coat guide', 19),
  ('instagram.1', 'Instagram image 1', 'section', 'https://lh3.googleusercontent.com/aida-public/AB6AXuDd5EmeG9Hdm3u8C1Iel3EzYtbydZrHd3SS3V-QH0AbmYKvPhSRqaZ5WeLNzXRM41T2eh_RkoAJ52O4TH7RfD64qJQEFDnG9sUmnqKd6unqLcO5yHtQkpPkdxAJLaTvqD3XETZS02KiI2oWScEHyWa4MieNYwlzUXPlqiETGrxc_5eMOEAJgRScq31EMz5m1r7FM_EZ4KnZMgBaZlui02v2ZPmv8k1CMZK0ePQ5O6K2cIZ9H9kK9Xgz', 'Instagram community image 1', 20),
  ('instagram.2', 'Instagram image 2', 'section', 'https://lh3.googleusercontent.com/aida-public/AB6AXuAHI18pK-g1UKTn6SsAhEsS4nVXOEK3qRrxuxvTlIKHpDPSMpTaO2yY-DTRceYAldN91EKpiUCAayV0h0eRuw2OtCrxy1MJ2QO0HvvuZilGdUpL4nwW3t_S0X1xSno2tjH4HK7DnScmFZcVrHwaOMb5PCdXg6F3Lg9r4P9j7Pt6x4tn-T7mGbLKxRw-ilJ-O6uhnSSu8PuaD1wZGOecHzchnDLdfdJUppi8OJv6RaRtDpKT7mjfk6vz', 'Instagram community image 2', 21),
  ('instagram.3', 'Instagram image 3', 'section', 'https://lh3.googleusercontent.com/aida-public/AB6AXuAYglHId0B3xXruVcIsfknJSsRi5XCkQjDn9NjcRcvpjeVcPSugBey5SbfAgoQ6nebIDnUZTAn3yoZAbomgk0S9-ZlsQI-adOzh0TGXTKXMcjMAXbH7oo86Qeza2KA1NIjnUDZ10_YK-kRFhciwsgYK2Ljey-SGoKVGc2d0gD8jXIH_auuswyMPj23V1wr3f7Czp0IxCf4givJ5m4Y7DOH8hDI9EK0Z_gxOhyeq5CZeMdiSi--uga8r', 'Instagram community image 3', 22),
  ('instagram.4', 'Instagram image 4', 'section', 'https://lh3.googleusercontent.com/aida-public/AB6AXuBDwG3NzjrKo1Sc-XJHkOojQOmb1JYU_3ZZ3ZrugslaKGuDbM-TjmksmeguYx-QjBbgpMWsOCu8GqJVJgxY_06r4bmLHJl58UyO-B_0lud3q1vaAOdTHV8z8IzDmHbSF8Flwyg_DmFmHVwQ6hIiow3mmw8ReYlffJfnh4UQZiaym7wdXJqymoMO0RPDYXw66qDroX2iTk0xgy8oC755IHjV0NMvwjbxxonEP_lG-ra8Ck9aT25crfSV', 'Instagram community image 4', 23),
  ('instagram.5', 'Instagram image 5', 'section', 'https://lh3.googleusercontent.com/aida-public/AB6AXuBdhNq_z2rpnzvKFRrM3sch0YPWzltyovLSlwa45BD95V7bmZ3DmfOf7zEggbW9dZQ4An5UQoJUkAOJ_ZspaESlVHohmVa5G9jCUVMz21CwPXxqrSmd11qhjDK69XashbhTvb8TVIg0b_stdBM_g-dQG9kGC2QswqhlGkpbV72HHNwxBqww21gGeiFxQ4TJrwVeKOJdECV1d3w_Vziw88_-iQoS_3hf9HOcDV9jJju1qZgH7jeK0-F_', 'Instagram community image 5', 24),
  ('instagram.6', 'Instagram image 6', 'section', 'https://lh3.googleusercontent.com/aida-public/AB6AXuB7IZo2iMFUY-Jqm99ourvOjcE_Gihn-U8u5ri4iu4hfNpTiPsmJg9wR28pZE-eKl0MHbl7wFO3A2ur90liZ6jtQhZB0nHy7O-YTdhoFwGDd9ZQX6IftJucKTF2bY1lNA8EDVwmcPrd_19qBmKHEVhRaQi5_eYaYUsrT7R6vwVJ9SCLEgNi4RT7BHp9CxzLdQ2AtK0PgNXqHi6CXM4j1W2XHMS3D2jsG24yUsBhUUS4kGOcq69MAJNh', 'Instagram community image 6', 25),
  ('size-chart', 'LITTLE STAR size chart', 'size-chart', '/little-star-size-chart.png',
   'Official LITTLE STAR children''s clothing size chart', 26)
on conflict (asset_key) do nothing;

insert into public.media_assets (asset_key, product_id, asset_name, asset_type, storage_path, external_url, alt_text, is_published, display_order)
select
  'product-image:' || images.id::text,
  images.product_id,
  coalesce(products.name, 'Product') || ' image',
  'product', images.storage_path, null,
  coalesce(nullif(images.alt_text, ''), products.name, 'Product image'),
  true, images.sort_order
from public.product_images images
left join public.products on products.id = images.product_id
on conflict (asset_key) do nothing;

insert into public.website_content (
  content_key, label, content_type, published_payload, draft_payload, is_published, display_order
)
values
  ('home.hero.primary', 'Homepage hero - Little Stars', 'hero',
   '{"season":"New Season 2025 / Luxury Kids","headline":"Little Stars.\nBig Style.","description":"Discover timeless outfits for everyday adventures, special celebrations, and unforgettable little moments. Handcrafted perfection for ages 1-13.","image_key":"home.hero.primary","mobile_image_key":"","alt_text":"Stylish young model in tailored luxury children''s clothing","link_text":"Shop Collection →","link_href":"#/new-arrivals"}',
   '{"season":"New Season 2025 / Luxury Kids","headline":"Little Stars.\nBig Style.","description":"Discover timeless outfits for everyday adventures, special celebrations, and unforgettable little moments. Handcrafted perfection for ages 1-13.","image_key":"home.hero.primary","mobile_image_key":"","alt_text":"Stylish young model in tailored luxury children''s clothing","link_text":"Shop Collection →","link_href":"#/new-arrivals"}',
   true, 0),
  ('home.hero.formal', 'Homepage hero - Handcrafted Elegance', 'hero',
   '{"season":"Bespoke Sartorial 2025","headline":"Handcrafted\\nElegance.","description":"Impeccable Italian-cut coat pants and handcrafted royal sherwanis made with pure fabrics and heirloom attention to detail.","image_key":"home.hero.formal","mobile_image_key":"","alt_text":"Tailored luxury formal suit","link_text":"Shop Collection →","link_href":"#/new-arrivals"}',
   '{"season":"Bespoke Sartorial 2025","headline":"Handcrafted\\nElegance.","description":"Impeccable Italian-cut coat pants and handcrafted royal sherwanis made with pure fabrics and heirloom attention to detail.","image_key":"home.hero.formal","mobile_image_key":"","alt_text":"Tailored luxury formal suit","link_text":"Shop Collection →","link_href":"#/new-arrivals"}',
   true, 1),
  ('home.editorial.everyday', 'Homepage editorial - Everyday', 'banner',
   '{"tag":"Casual Collection","headline":"Little Street Wear.","description":"Everyday essentials crafted with ultra-soft organic cotton for effortless little adventures.","image_key":"home.editorial.everyday","alt_text":"Little Street Wear campaign","link_text":"Shop Collection","link_href":"#/casual-dressing"}',
   '{"tag":"Casual Collection","headline":"Little Street Wear.","description":"Everyday essentials crafted with ultra-soft organic cotton for effortless little adventures.","image_key":"home.editorial.everyday","alt_text":"Little Street Wear campaign","link_text":"Shop Collection","link_href":"#/casual-dressing"}',
   true, 2),
  ('home.editorial.formal', 'Homepage editorial - Coat Pant', 'banner',
   '{"tag":"Tailored Sartorial","headline":"Classic Coat Pant.","description":"A refined Italian-cut silhouette for special moments.","image_key":"home.hero.formal","alt_text":"Boy in tailored coat pant suit","link_text":"Explore Collection →","link_href":"#/coat-pant"}',
   '{"tag":"Tailored Sartorial","headline":"Classic Coat Pant.","description":"A refined Italian-cut silhouette for special moments.","image_key":"home.hero.formal","alt_text":"Boy in tailored coat pant suit","link_text":"Explore Collection →","link_href":"#/coat-pant"}',
   true, 3),
  ('home.editorial.sherwani', 'Homepage editorial - Sherwani', 'banner',
   '{"tag":"Heritage Edition","headline":"Traditional Elegance.","description":"Handcrafted festive Sherwanis with subtle threadwork.","image_key":"home.editorial.sherwani","alt_text":"Festive traditional children''s wear","link_text":"Explore Formal Wear →","link_href":"#/sherwani"}',
   '{"tag":"Heritage Edition","headline":"Traditional Elegance.","description":"Handcrafted festive Sherwanis with subtle threadwork.","image_key":"home.editorial.sherwani","alt_text":"Festive traditional children''s wear","link_text":"Explore Formal Wear →","link_href":"#/sherwani"}',
   true, 4),
  ('home.wide-banner', 'Homepage wide banner', 'banner',
   '{"tag":"Winter & Spring 2025 Edition","headline":"The Little Gentleman Selection","description":"From everyday playtime outfits to bespoke occasion tuxedos, discover timeless garments made with breathability, ease of movement, and enduring tailoring.","image_key":"home.wide-banner","alt_text":"Young model wearing jacket in casual urban setting","link_text":"Discover The Collection →","link_href":"#/coat-pant"}',
   '{"tag":"Winter & Spring 2025 Edition","headline":"The Little Gentleman Selection","description":"From everyday playtime outfits to bespoke occasion tuxedos, discover timeless garments made with breathability, ease of movement, and enduring tailoring.","image_key":"home.wide-banner","alt_text":"Young model wearing jacket in casual urban setting","link_text":"Discover The Collection →","link_href":"#/coat-pant"}',
   true, 5),
  ('home.occasion.wedding', 'Homepage occasion - Wedding', 'section',
   '{"tag":"Bespoke Suits","headline":"Weddings & Celebrations","image_key":"home.occasion.wedding","alt_text":"Weddings and celebrations children''s clothing","link_text":"Explore Coat Pants →","link_href":"#/coat-pant"}',
   '{"tag":"Bespoke Suits","headline":"Weddings & Celebrations","image_key":"home.occasion.wedding","alt_text":"Weddings and celebrations children''s clothing","link_text":"Explore Coat Pants →","link_href":"#/coat-pant"}',
   true, 6),
  ('home.occasion.eid', 'Homepage occasion - Eid', 'section',
   '{"tag":"Eastern Heritage","headline":"Eid & Festive Sherwanis","image_key":"home.occasion.eid","alt_text":"Eid and festive wear for boys","link_text":"Shop Festive Wear →","link_href":"#/sherwani"}',
   '{"tag":"Eastern Heritage","headline":"Eid & Festive Sherwanis","image_key":"home.occasion.eid","alt_text":"Eid and festive wear for boys","link_text":"Shop Festive Wear →","link_href":"#/sherwani"}',
   true, 7),
  ('home.occasion.prince', 'Homepage occasion - Prince Coat', 'section',
   '{"tag":"Regal Cut","headline":"Royal Prince Collection","image_key":"home.occasion.prince","alt_text":"Prince Coat Regal Collection","link_text":"View Prince Coats →","link_href":"#/prince-coat"}',
   '{"tag":"Regal Cut","headline":"Royal Prince Collection","image_key":"home.occasion.prince","alt_text":"Prince Coat Regal Collection","link_text":"View Prince Coats →","link_href":"#/prince-coat"}',
   true, 8),
  ('home.journal.1', 'Journal article - Casual style guide', 'section',
   '{"date":"22 Oct","category":"Style Guide","headline":"Top 10 Casual Look Ideas To Dress Up Your Kids in 2025","description":"Balancing playground practicality with contemporary silhouette cuts for busy school days and weekends.","image_key":"journal.1","alt_text":"Casual kids style guide"}',
   '{"date":"22 Oct","category":"Style Guide","headline":"Top 10 Casual Look Ideas To Dress Up Your Kids in 2025","description":"Balancing playground practicality with contemporary silhouette cuts for busy school days and weekends.","image_key":"journal.1","alt_text":"Casual kids style guide"}',
   true, 10),
  ('home.journal.2', 'Journal article - Wedding style guide', 'section',
   '{"date":"25 Oct","category":"Weddings","headline":"How to Style Your Little Gentleman For a Wedding","description":"From coordinating custom pocket squares to picking lightweight suiting fabrics that keep young ones cheerful.","image_key":"journal.2","alt_text":"Little gentleman wedding style guide"}',
   '{"date":"25 Oct","category":"Weddings","headline":"How to Style Your Little Gentleman For a Wedding","description":"From coordinating custom pocket squares to picking lightweight suiting fabrics that keep young ones cheerful.","image_key":"journal.2","alt_text":"Little gentleman wedding style guide"}',
   true, 11),
  ('home.journal.3', 'Journal article - Festive heritage guide', 'section',
   '{"date":"28 Oct","category":"Festive Heritage","headline":"Traditional Sherwanis & Prince Coats For Eid","description":"A tribute to royal Eastern tailoring, jamawar trims, and comfortable ban collars designed for little leaders.","image_key":"journal.3","alt_text":"Festive sherwani and prince coat guide"}',
   '{"date":"28 Oct","category":"Festive Heritage","headline":"Traditional Sherwanis & Prince Coats For Eid","description":"A tribute to royal Eastern tailoring, jamawar trims, and comfortable ban collars designed for little leaders.","image_key":"journal.3","alt_text":"Festive sherwani and prince coat guide"}',
   true, 12),
  ('home.instagram.1', 'Instagram image 1', 'section', '{"image_key":"instagram.1","alt_text":"Instagram community image 1"}', '{"image_key":"instagram.1","alt_text":"Instagram community image 1"}', true, 13),
  ('home.instagram.2', 'Instagram image 2', 'section', '{"image_key":"instagram.2","alt_text":"Instagram community image 2"}', '{"image_key":"instagram.2","alt_text":"Instagram community image 2"}', true, 14),
  ('home.instagram.3', 'Instagram image 3', 'section', '{"image_key":"instagram.3","alt_text":"Instagram community image 3"}', '{"image_key":"instagram.3","alt_text":"Instagram community image 3"}', true, 15),
  ('home.instagram.4', 'Instagram image 4', 'section', '{"image_key":"instagram.4","alt_text":"Instagram community image 4"}', '{"image_key":"instagram.4","alt_text":"Instagram community image 4"}', true, 16),
  ('home.instagram.5', 'Instagram image 5', 'section', '{"image_key":"instagram.5","alt_text":"Instagram community image 5"}', '{"image_key":"instagram.5","alt_text":"Instagram community image 5"}', true, 17),
  ('home.instagram.6', 'Instagram image 6', 'section', '{"image_key":"instagram.6","alt_text":"Instagram community image 6"}', '{"image_key":"instagram.6","alt_text":"Instagram community image 6"}', true, 18),
  ('home.featured', 'Featured products section', 'section',
   '{"headline":"Featured Products","description":"Curated picks loved by parents & kids"}',
   '{"headline":"Featured Products","description":"Curated picks loved by parents & kids"}',
   true, 22),
  ('home.flash-sales', 'Flash sale section', 'section',
   '{"headline":"Flash Sales","description":"Exclusive discounts on signature seasonal garments","tag":"Limited Period"}',
   '{"headline":"Flash Sales","description":"Exclusive discounts on signature seasonal garments","tag":"Limited Period"}',
   true, 23),
  ('home.occasion.heading', 'Occasion section heading', 'section',
   '{"tag":"Tailored for Milestones","headline":"Made for Special Moments"}',
   '{"tag":"Tailored for Milestones","headline":"Made for Special Moments"}',
   true, 24),
  ('home.journal.heading', 'Journal section heading', 'section',
   '{"headline":"Our Journal","description":"Style guides, styling tips & festive inspirations"}',
   '{"headline":"Our Journal","description":"Style guides, styling tips & festive inspirations"}',
   true, 25),
  ('home.instagram.heading', 'Instagram section heading', 'section',
   '{"tag":"Follow Our Little Stars","headline":"@littlestar.pk","instagram_url":"https://instagram.com"}',
   '{"tag":"Follow Our Little Stars","headline":"@littlestar.pk","instagram_url":"https://instagram.com"}',
   true, 26),
  ('size-chart', 'Product size chart', 'size-chart',
   '{"image_key":"size-chart","alt_text":"Official LITTLE STAR children''s clothing size chart"}',
   '{"image_key":"size-chart","alt_text":"Official LITTLE STAR children''s clothing size chart"}',
   true, 27),
  ('store.announcement', 'Announcement bar', 'announcement',
   '{"text":"Welcome to LITTLE STAR — Dress the Future","link_text":"Shop now","link_href":"#/new-arrivals"}',
   '{"text":"Welcome to LITTLE STAR — Dress the Future","link_text":"Shop now","link_href":"#/new-arrivals"}',
   false, 28),
  ('store.footer', 'Footer information and social links', 'footer',
   '{"description":"LITTLE STAR is Pakistan''s premier luxury children''s clothing atelier, delivering timeless everyday pieces and handcrafted bespoke ceremonial ensembles for ages 1 through 13.","instagram_url":"https://instagram.com","facebook_url":"https://facebook.com","copyright":"© 2025 LITTLE STAR — Dress the Future. All Rights Reserved."}',
   '{"description":"LITTLE STAR is Pakistan''s premier luxury children''s clothing atelier, delivering timeless everyday pieces and handcrafted bespoke ceremonial ensembles for ages 1 through 13.","instagram_url":"https://instagram.com","facebook_url":"https://facebook.com","copyright":"© 2025 LITTLE STAR — Dress the Future. All Rights Reserved."}',
   true, 29)
on conflict (content_key) do nothing;

create or replace function public.admin_save_website_content(
  p_content_key text,
  p_payload jsonb,
  p_enabled boolean default true,
  p_display_order integer default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text;
  v_url text;
begin
  if not public.is_admin() then raise exception 'Administrator access is required.' using errcode = '42501'; end if;
  if jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'Content must be a JSON object.'; end if;
  if nullif(btrim(p_content_key), '') is null then raise exception 'Content key is required.'; end if;
  if p_display_order is not null and p_display_order < 0 then raise exception 'Display order cannot be negative.'; end if;
  for v_url in
    select value from jsonb_each_text(p_payload)
    where key ~* '(_href|_url)$' and value <> ''
  loop
    if v_url !~* '^(https://|#|/|mailto:|tel:)' then
      raise exception 'Links must use HTTPS or a supported local, email, or phone link.';
    end if;
  end loop;
  for v_key in select value from unnest(array[
    p_payload ->> 'image_key', p_payload ->> 'mobile_image_key'
  ]) as keys(value) where value is not null and value <> ''
  loop
    if not exists (select 1 from public.media_assets where asset_key = v_key) then
      raise exception 'The selected media asset is unavailable.';
    end if;
  end loop;
  update public.website_content
  set draft_payload = p_payload,
      draft_enabled = coalesce(p_enabled, true),
      display_order = coalesce(p_display_order, display_order),
      updated_by = auth.uid()
  where content_key = p_content_key;
  if not found then raise exception 'Website content item not found.'; end if;
  insert into public.media_audit_log (actor_id, event_type, content_key, details)
  values (auth.uid(), 'content_draft_saved', p_content_key, jsonb_build_object('enabled', p_enabled));
end;
$$;

create or replace function public.admin_publish_website_content(p_content_key text, p_publish boolean default true)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.website_content;
begin
  if not public.is_admin() then raise exception 'Administrator access is required.' using errcode = '42501'; end if;
  update public.website_content
  set published_payload = case when p_publish then draft_payload else published_payload end,
      published_enabled = case when p_publish then draft_enabled else published_enabled end,
      is_published = coalesce(p_publish, true),
      updated_by = auth.uid()
  where content_key = p_content_key
  returning * into v_row;
  if not found then raise exception 'Website content item not found.'; end if;
  insert into public.media_audit_log (actor_id, event_type, content_key, details)
  values (
    auth.uid(),
    case when p_publish then 'content_published' else 'content_unpublished' end,
    p_content_key,
    jsonb_build_object('published', p_publish)
  );
end;
$$;

create or replace function public.admin_register_media(
  p_asset_key text,
  p_asset_name text,
  p_asset_type text,
  p_storage_path text,
  p_mime_type text,
  p_file_size bigint,
  p_width integer,
  p_height integer,
  p_alt_text text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then raise exception 'Administrator access is required.' using errcode = '42501'; end if;
  if p_asset_type not in ('product', 'hero', 'banner', 'category', 'brand', 'size-chart', 'section', 'other') then
    raise exception 'Choose a valid media type.';
  end if;
  if nullif(btrim(p_asset_name), '') is null or p_storage_path !~ '^managed/[a-f0-9-]+/[^/]+$'
    or p_mime_type not in ('image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif')
    or p_file_size is null or p_file_size < 0 or p_file_size > 10485760 then
    raise exception 'Media name or storage path is invalid.';
  end if;
  if not exists (
    select 1 from storage.objects
    where bucket_id = 'product-images' and name = p_storage_path
  ) then raise exception 'The uploaded image could not be found in storage.'; end if;
  insert into public.media_assets (
    asset_key, asset_name, asset_type, storage_path, mime_type, file_size, width, height,
    alt_text, created_by, is_published
  ) values (
    p_asset_key, btrim(p_asset_name), p_asset_type, p_storage_path, p_mime_type, p_file_size,
    p_width, p_height, coalesce(p_alt_text, ''), auth.uid(), true
  ) returning id into v_id;
  insert into public.media_audit_log (actor_id, event_type, asset_id, details)
  values (auth.uid(), 'asset_uploaded', v_id, jsonb_build_object('storage_path', p_storage_path));
  return v_id;
end;
$$;

create or replace function public.admin_update_media(
  p_asset_id uuid,
  p_asset_name text,
  p_asset_type text,
  p_alt_text text,
  p_display_order integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Administrator access is required.' using errcode = '42501'; end if;
  if p_asset_type not in ('product', 'hero', 'banner', 'category', 'brand', 'size-chart', 'section', 'other')
    or nullif(btrim(p_asset_name), '') is null then
    raise exception 'Choose a valid media type.';
  end if;
  if exists (
    select 1 from public.media_assets
    where id = p_asset_id and product_id is not null
  ) and p_asset_type <> 'product' then
    raise exception 'Product gallery images must keep the product media type.';
  end if;
  if p_display_order is not null and p_display_order < 0 then raise exception 'Display order cannot be negative.'; end if;
  update public.media_assets
  set asset_name = btrim(p_asset_name), asset_type = p_asset_type,
      alt_text = coalesce(p_alt_text, ''), display_order = coalesce(p_display_order, 0)
  where id = p_asset_id;
  if not found then raise exception 'Media asset not found.'; end if;
  update public.product_images
  set alt_text = coalesce(p_alt_text, ''),
      sort_order = coalesce(p_display_order, 0)
  where storage_path = (select storage_path from public.media_assets where id = p_asset_id);
  insert into public.media_audit_log (actor_id, event_type, asset_id)
  values (auth.uid(), 'asset_metadata_updated', p_asset_id);
end;
$$;

create or replace function public.admin_replace_media(
  p_asset_id uuid,
  p_storage_path text,
  p_mime_type text,
  p_file_size bigint,
  p_width integer,
  p_height integer
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_path text;
begin
  if not public.is_admin() then raise exception 'Administrator access is required.' using errcode = '42501'; end if;
  if p_storage_path !~ '^managed/[a-f0-9-]+/[^/]+$'
    or p_mime_type not in ('image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif')
    or p_file_size is null or p_file_size < 0 or p_file_size > 10485760
    or not exists (
    select 1 from storage.objects
    where bucket_id = 'product-images' and name = p_storage_path
  ) then raise exception 'The replacement image is not available in storage.'; end if;
  select storage_path into v_old_path from public.media_assets where id = p_asset_id for update;
  if not found then raise exception 'Media asset not found.'; end if;
  if exists (select 1 from public.media_assets where storage_path = p_storage_path and id <> p_asset_id) then
    raise exception 'This image is already registered.';
  end if;
  update public.media_assets
  set storage_path = p_storage_path, external_url = null,
      mime_type = p_mime_type, file_size = p_file_size, width = p_width, height = p_height
  where id = p_asset_id;
  update public.product_images
  set storage_path = p_storage_path
  where storage_path = v_old_path;
  insert into public.media_audit_log (actor_id, event_type, asset_id, details)
  values (
    auth.uid(), 'asset_replaced', p_asset_id,
    jsonb_build_object('previous_path', v_old_path, 'storage_path', p_storage_path)
  );
  return v_old_path;
end;
$$;

create or replace function public.admin_delete_media(p_asset_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_asset public.media_assets;
begin
  if not public.is_admin() then raise exception 'Administrator access is required.' using errcode = '42501'; end if;
  select * into v_asset from public.media_assets where id = p_asset_id for update;
  if not found then raise exception 'Media asset not found.'; end if;
  if exists (select 1 from public.product_images where storage_path = v_asset.storage_path) then
    raise exception 'This image is assigned to a product. Remove it from the product gallery before deleting it.';
  end if;
  if v_asset.asset_key like 'product.sample.%' or v_asset.asset_key like 'product.sale.%' then
    raise exception 'This image is assigned to a sample catalog product. Replace it in the media library instead of deleting it.';
  end if;
  if exists (
    select 1 from public.website_content
    where (published_payload::text like '%' || v_asset.asset_key || '%'
      and is_published and published_enabled)
      or draft_payload::text like '%' || v_asset.asset_key || '%'
  ) then raise exception 'This image is used by website content. Replace or unpublish the content before deleting it.'; end if;
  insert into public.media_audit_log (actor_id, event_type, asset_id, details)
  values (auth.uid(), 'asset_deleted', p_asset_id, jsonb_build_object('asset_key', v_asset.asset_key));
  delete from public.media_assets where id = p_asset_id;
  return v_asset.storage_path;
end;
$$;

create or replace function public.admin_save_product_media(
  p_product_id uuid,
  p_image_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_image_id uuid;
  v_order integer := 0;
begin
  if not public.is_admin() then raise exception 'Administrator access is required.' using errcode = '42501'; end if;
  if not exists (select 1 from public.products where id = p_product_id) then raise exception 'Product not found.'; end if;
  if exists (
    select 1 from unnest(coalesce(p_image_ids, array[]::uuid[])) as requested(id)
    where not exists (
      select 1 from public.product_images
      where product_images.id = requested.id and product_images.product_id = p_product_id
    )
  ) then raise exception 'An image does not belong to the selected product.'; end if;
  foreach v_image_id in array coalesce(p_image_ids, array[]::uuid[])
  loop
    update public.product_images
    set sort_order = v_order
    where id = v_image_id and product_id = p_product_id;
    v_order := v_order + 1;
  end loop;
end;
$$;

create or replace function public.admin_set_product_featured(p_product_id uuid, p_featured boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Administrator access is required.' using errcode = '42501'; end if;
  update public.products set is_featured = coalesce(p_featured, false) where id = p_product_id;
  if not found then raise exception 'Product not found.'; end if;
end;
$$;

create or replace function public.admin_set_variant_cost(p_variant_id uuid, p_unit_cost numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Administrator access is required.' using errcode = '42501'; end if;
  if p_unit_cost is null or p_unit_cost < 0 or p_unit_cost::text in ('NaN', 'Infinity', '-Infinity') then
    raise exception 'Unit cost must be a finite non-negative amount.';
  end if;
  if not exists (select 1 from public.product_variants where id = p_variant_id) then
    raise exception 'Product variant not found.';
  end if;
  insert into public.product_variant_costs (variant_id, unit_cost)
  values (p_variant_id, p_unit_cost)
  on conflict (variant_id) do update set unit_cost = excluded.unit_cost, updated_at = timezone('utc', now());
end;
$$;

create or replace function public.admin_save_product_details(
  p_product jsonb,
  p_variants jsonb,
  p_image_paths text[],
  p_image_alt_texts text[],
  p_featured boolean,
  p_variant_costs jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product_id uuid;
  v_variant public.product_variants;
  v_item jsonb;
  v_cost numeric(12, 2);
  v_index integer;
  v_image text;
  v_existing_media_keys jsonb := '{}'::jsonb;
  v_is_new boolean;
begin
  if not public.is_admin() then raise exception 'Administrator access is required.' using errcode = '42501'; end if;
  if jsonb_typeof(p_variant_costs) is distinct from 'array' then
    raise exception 'Product costs must be an array.';
  end if;
  v_is_new := nullif(p_product ->> 'id', '') is null
    or not exists (select 1 from public.products where id = (p_product ->> 'id')::uuid);
  if not v_is_new then
    select coalesce(jsonb_object_agg(storage_path, 'product-image:' || id::text), '{}'::jsonb)
    into v_existing_media_keys
    from public.product_images
    where product_id = (p_product ->> 'id')::uuid;
  end if;
  v_product_id := public.admin_save_product(p_product, p_variants, p_image_paths);
  update public.products set is_featured = coalesce(p_featured, false) where id = v_product_id;

  for v_item in select value from jsonb_array_elements(p_variant_costs)
  loop
    v_cost := (v_item ->> 'unit_cost')::numeric;
    if v_cost is null or v_cost < 0 or v_cost::text in ('NaN', 'Infinity', '-Infinity') then
      raise exception 'Product cost must be a finite non-negative amount.';
    end if;
    select * into v_variant from public.product_variants
    where product_id = v_product_id
      and size = v_item ->> 'size'
      and color = v_item ->> 'color'
      and is_active
    for update;
    if not found then raise exception 'A cost refers to an unavailable product variant.'; end if;
    insert into public.product_variant_costs (variant_id, unit_cost)
    values (v_variant.id, v_cost)
    on conflict (variant_id) do update
      set unit_cost = excluded.unit_cost, updated_at = timezone('utc', now());
  end loop;

  if coalesce(array_length(p_image_paths, 1), 0) <> coalesce(array_length(p_image_alt_texts, 1), 0) then
    raise exception 'Each product image needs matching alt text.';
  end if;
  update public.product_images
  set sort_order = sort_order + 1000000
  where product_id = v_product_id;
  for v_index in 1..coalesce(array_length(p_image_paths, 1), 0)
  loop
    v_image := p_image_paths[v_index];
    update public.product_images
    set sort_order = v_index - 1,
        alt_text = coalesce(p_image_alt_texts[v_index], '')
    where product_id = v_product_id and storage_path = v_image;
    if not found then raise exception 'A product image was not saved.'; end if;
    if v_existing_media_keys ? v_image then
      update public.media_assets
      set asset_key = v_existing_media_keys ->> v_image
      where storage_path = v_image;
    end if;
  end loop;
  insert into public.media_audit_log (actor_id, event_type, details)
  values (
    auth.uid(),
    case when v_is_new then 'product_created' else 'product_updated' end,
    jsonb_build_object('product_id', v_product_id, 'name', p_product ->> 'name')
  );
  return v_product_id;
end;
$$;

revoke all on function public.admin_save_website_content(text, jsonb, boolean, integer) from public, anon;
revoke all on function public.admin_publish_website_content(text, boolean) from public, anon;
revoke all on function public.admin_register_media(text, text, text, text, text, bigint, integer, integer, text) from public, anon;
revoke all on function public.admin_update_media(uuid, text, text, text, integer) from public, anon;
revoke all on function public.admin_replace_media(uuid, text, text, bigint, integer, integer) from public, anon;
revoke all on function public.admin_delete_media(uuid) from public, anon;
revoke all on function public.admin_save_product_media(uuid, uuid[]) from public, anon;
revoke all on function public.admin_set_product_featured(uuid, boolean) from public, anon;
revoke all on function public.admin_set_variant_cost(uuid, numeric) from public, anon;
revoke all on function public.admin_save_product_details(jsonb, jsonb, text[], text[], boolean, jsonb) from public, anon;

grant execute on function public.admin_save_website_content(text, jsonb, boolean, integer) to authenticated;
grant execute on function public.admin_publish_website_content(text, boolean) to authenticated;
grant execute on function public.admin_register_media(text, text, text, text, text, bigint, integer, integer, text) to authenticated;
grant execute on function public.admin_update_media(uuid, text, text, text, integer) to authenticated;
grant execute on function public.admin_replace_media(uuid, text, text, bigint, integer, integer) to authenticated;
grant execute on function public.admin_delete_media(uuid) to authenticated;
grant execute on function public.admin_save_product_media(uuid, uuid[]) to authenticated;
grant execute on function public.admin_set_product_featured(uuid, boolean) to authenticated;
grant execute on function public.admin_set_variant_cost(uuid, numeric) to authenticated;
grant execute on function public.admin_save_product_details(jsonb, jsonb, text[], text[], boolean, jsonb) to authenticated;
