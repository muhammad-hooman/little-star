alter table public.products
  add column if not exists age_range text,
  add column if not exists archived_at timestamptz,
  add column if not exists sale_price numeric(12, 2)
    check (sale_price is null or (sale_price > 0 and sale_price < price));

insert into public.categories (name, slug, description)
values
  ('Coat Pant', 'coat-pant', 'Tailored occasionwear for little gentlemen.'),
  ('Sherwani', 'sherwani', 'Traditional craftsmanship for memorable occasions.'),
  ('Prince Coat', 'prince-coat', 'Ceremonial pieces with a distinguished finish.'),
  ('Casual Dressing', 'casual-dressing', 'Considered comfort for everyday adventures.'),
  ('Formal Wear', 'formal-wear', 'Special occasion clothing for children.')
on conflict (slug) do nothing;

alter table public.product_variants
  add column if not exists low_stock_threshold integer not null default 3
    check (low_stock_threshold >= 0);

alter table public.orders
  drop constraint if exists orders_status_check,
  add column if not exists payment_method text not null default 'cod'
    check (payment_method in ('cod')),
  add column if not exists payment_status text not null default 'pending'
    check (payment_status in ('pending', 'paid', 'failed', 'refunded')),
  add column if not exists courier text,
  add column if not exists tracking_number text,
  add column if not exists checkout_key uuid;

update public.orders
set payment_status = 'paid', status = 'confirmed'
where status = 'paid';

alter table public.orders
  add constraint orders_status_check
    check (status in ('pending', 'confirmed', 'processing', 'packed', 'shipped', 'delivered', 'cancelled', 'returned', 'refunded'));

create unique index if not exists orders_user_checkout_key_idx
  on public.orders (user_id, checkout_key)
  where checkout_key is not null;

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete restrict,
  variant_id uuid not null references public.product_variants (id) on delete restrict,
  actor_id uuid references public.profiles (id) on delete set null,
  movement_type text not null check (movement_type in ('opening', 'addition', 'deduction', 'damaged', 'sale', 'cancellation', 'return')),
  quantity_delta integer not null check (quantity_delta <> 0),
  stock_after integer not null check (stock_after >= 0),
  reason text not null,
  order_id uuid references public.orders (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create index inventory_movements_variant_created_idx
  on public.inventory_movements (variant_id, created_at desc);
create index inventory_movements_order_idx
  on public.inventory_movements (order_id) where order_id is not null;

create table public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  event_type text not null,
  from_status text,
  to_status text,
  note text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default timezone('utc', now())
);

create index order_events_order_created_idx on public.order_events (order_id, created_at);

create table public.checkout_requests (
  user_id uuid not null references public.profiles (id) on delete cascade,
  idempotency_key uuid not null,
  order_id uuid not null references public.orders (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, idempotency_key),
  unique (order_id)
);

create index checkout_requests_created_at_idx on public.checkout_requests (created_at);

alter table public.inventory_movements enable row level security;
alter table public.order_events enable row level security;
alter table public.checkout_requests enable row level security;

create policy "Admins can read inventory movements"
  on public.inventory_movements for select to authenticated
  using ((select public.is_admin()));
create policy "Admins can read order events"
  on public.order_events for select to authenticated
  using ((select public.is_admin()));
create policy "Customers can read events for their own orders"
  on public.order_events for select to authenticated
  using (
    exists (
      select 1 from public.orders
      where orders.id = order_events.order_id and orders.user_id = (select auth.uid())
    )
  );
create policy "Admins can read customer profiles"
  on public.profiles for select to authenticated
  using ((select public.is_admin()));

grant select on public.inventory_movements, public.order_events to authenticated;
grant select on public.checkout_requests to authenticated;
revoke insert, update, delete on public.inventory_movements, public.order_events, public.checkout_requests from anon, authenticated;
revoke insert, update, delete
  on public.categories, public.products, public.product_images, public.product_variants,
     public.orders, public.order_items, public.carts, public.cart_items
  from anon, authenticated;

create or replace function public.sync_product_stock_total()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op <> 'INSERT' then
    update public.products
    set stock_quantity = coalesce((
      select sum(stock_quantity)::integer
      from public.product_variants
      where product_id = old.product_id
    ), 0)
    where id = old.product_id;
  end if;
  if tg_op <> 'DELETE' and (tg_op = 'INSERT' or new.product_id is distinct from old.product_id) then
    update public.products
    set stock_quantity = coalesce((
      select sum(stock_quantity)::integer
      from public.product_variants
      where product_id = new.product_id
    ), 0)
    where id = new.product_id;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger product_variant_stock_total
  after insert or update or delete on public.product_variants
  for each row execute function public.sync_product_stock_total();

create or replace function public.admin_adjust_inventory(
  p_variant_id uuid,
  p_quantity_delta integer,
  p_movement_type text,
  p_reason text
)
returns public.product_variants
language plpgsql
security definer
set search_path = public
as $$
declare
  v_variant public.product_variants;
  v_next_stock integer;
begin
  if not public.is_admin() then
    raise exception 'Administrator access is required.' using errcode = '42501';
  end if;
  if p_quantity_delta = 0 or p_quantity_delta is null then
    raise exception 'Inventory adjustment must not be zero.';
  end if;
  if p_movement_type not in ('addition', 'deduction', 'damaged', 'return', 'opening') then
    raise exception 'Unsupported inventory movement type.';
  end if;
  if nullif(btrim(p_reason), '') is null then
    raise exception 'A reason is required for inventory adjustments.';
  end if;
  if (p_movement_type in ('addition', 'return', 'opening') and p_quantity_delta < 0)
    or (p_movement_type in ('deduction', 'damaged') and p_quantity_delta > 0) then
    raise exception 'The adjustment sign does not match the movement type.';
  end if;

  select * into v_variant
  from public.product_variants
  where id = p_variant_id
  for update;
  if not found then
    raise exception 'The selected product variant does not exist.';
  end if;
  v_next_stock := v_variant.stock_quantity + p_quantity_delta;
  if v_next_stock < 0 then
    raise exception 'Inventory cannot be reduced below zero.' using errcode = '23514';
  end if;

  update public.product_variants
  set stock_quantity = v_next_stock
  where id = p_variant_id
  returning * into v_variant;

  insert into public.inventory_movements (
    product_id, variant_id, actor_id, movement_type, quantity_delta, stock_after, reason
  ) values (
    v_variant.product_id, v_variant.id, auth.uid(), p_movement_type,
    p_quantity_delta, v_next_stock, btrim(p_reason)
  );
  return v_variant;
end;
$$;

revoke all on function public.admin_adjust_inventory(uuid, integer, text, text) from public, anon;
grant execute on function public.admin_adjust_inventory(uuid, integer, text, text) to authenticated;

create or replace function public.admin_save_product(
  p_product jsonb,
  p_variants jsonb,
  p_image_paths text[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product_id uuid;
  v_variant jsonb;
  v_image text;
  v_slug text;
  v_status text;
begin
  if not public.is_admin() then
    raise exception 'Administrator access is required.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_product) <> 'object' or jsonb_typeof(p_variants) <> 'array' then
    raise exception 'Product and variant data have an invalid format.';
  end if;
  if jsonb_array_length(p_variants) = 0 then
    raise exception 'Add at least one size and color variant before saving.';
  end if;

  v_product_id := nullif(p_product ->> 'id', '')::uuid;
  v_slug := nullif(btrim(p_product ->> 'slug'), '');
  v_status := coalesce(p_product ->> 'status', 'draft');
  if v_slug is null or nullif(btrim(p_product ->> 'name'), '') is null then
    raise exception 'Product name and slug are required.';
  end if;
  if v_status not in ('draft', 'active', 'archived') then
    raise exception 'Invalid product status.';
  end if;

  if v_product_id is null then
    insert into public.products (
      name, slug, description, sku, category_id, price, compare_at_price,
      sale_price, age_range, status, metadata, archived_at
    ) values (
      btrim(p_product ->> 'name'), v_slug, nullif(btrim(p_product ->> 'description'), ''),
      nullif(btrim(p_product ->> 'sku'), ''), nullif(p_product ->> 'category_id', '')::uuid,
      (p_product ->> 'price')::numeric, nullif(p_product ->> 'compare_at_price', '')::numeric,
      nullif(p_product ->> 'sale_price', '')::numeric,
      nullif(btrim(p_product ->> 'age_range'), ''), v_status,
      coalesce(p_product -> 'metadata', '{}'::jsonb),
      case when v_status = 'archived' then timezone('utc', now()) else null end
    ) returning id into v_product_id;
  else
    update public.products
    set name = btrim(p_product ->> 'name'),
        slug = v_slug,
        description = nullif(btrim(p_product ->> 'description'), ''),
        sku = nullif(btrim(p_product ->> 'sku'), ''),
        category_id = nullif(p_product ->> 'category_id', '')::uuid,
        price = (p_product ->> 'price')::numeric,
        compare_at_price = nullif(p_product ->> 'compare_at_price', '')::numeric,
        sale_price = nullif(p_product ->> 'sale_price', '')::numeric,
        age_range = nullif(btrim(p_product ->> 'age_range'), ''),
        status = v_status,
        metadata = coalesce(p_product -> 'metadata', '{}'::jsonb),
        archived_at = case when v_status = 'archived' then coalesce(archived_at, timezone('utc', now())) else null end
    where id = v_product_id;
    if not found then
      insert into public.products (
        id, name, slug, description, sku, category_id, price, compare_at_price,
        sale_price, age_range, status, metadata, archived_at
      ) values (
        v_product_id, btrim(p_product ->> 'name'), v_slug,
        nullif(btrim(p_product ->> 'description'), ''),
        nullif(btrim(p_product ->> 'sku'), ''),
        nullif(p_product ->> 'category_id', '')::uuid,
        (p_product ->> 'price')::numeric,
        nullif(p_product ->> 'compare_at_price', '')::numeric,
        nullif(p_product ->> 'sale_price', '')::numeric,
        nullif(btrim(p_product ->> 'age_range'), ''), v_status,
        coalesce(p_product -> 'metadata', '{}'::jsonb),
        case when v_status = 'archived' then timezone('utc', now()) else null end
      );
    end if;
  end if;

  for v_variant in select value from jsonb_array_elements(p_variants)
  loop
    if nullif(btrim(v_variant ->> 'size'), '') is null
      or nullif(btrim(v_variant ->> 'color'), '') is null then
      raise exception 'Every variant must include a size and color.';
    end if;
    insert into public.product_variants (
      product_id, size, color, sku, price_override, stock_quantity, is_active
    ) values (
      v_product_id, btrim(v_variant ->> 'size'), btrim(v_variant ->> 'color'),
      nullif(btrim(v_variant ->> 'sku'), ''),
      nullif(v_variant ->> 'price_override', '')::numeric, 0, true
    )
    on conflict (product_id, size, color) do update
      set sku = excluded.sku,
          price_override = excluded.price_override,
          is_active = true;
  end loop;

  if exists (
    select 1 from public.product_variants variants
    where variants.product_id = v_product_id
      and variants.stock_quantity > 0
      and not exists (
        select 1 from jsonb_array_elements(p_variants) entries(value)
        where entries.value ->> 'size' = variants.size
          and entries.value ->> 'color' = variants.color
      )
  ) then
    raise exception 'Remove or adjust stock for omitted variants before saving.';
  end if;
  update public.product_variants variants
  set is_active = false
  where variants.product_id = v_product_id
    and not exists (
      select 1 from jsonb_array_elements(p_variants) entries(value)
      where entries.value ->> 'size' = variants.size
        and entries.value ->> 'color' = variants.color
    );

  delete from public.product_images where product_id = v_product_id;
  for v_image in select distinct unnest(coalesce(p_image_paths, array[]::text[]))
  loop
    if v_image is null or v_image !~ ('^' || v_product_id::text || '/[^/]+$') then
      raise exception 'Product image path is invalid.';
    end if;
    insert into public.product_images (product_id, storage_path, sort_order)
    values (v_product_id, v_image, (
      select count(*)::integer from public.product_images where product_id = v_product_id
    ));
  end loop;

  return v_product_id;
end;
$$;

revoke all on function public.admin_save_product(jsonb, jsonb, text[]) from public, anon;
grant execute on function public.admin_save_product(jsonb, jsonb, text[]) to authenticated;

create or replace function public.admin_set_product_status(p_product_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Administrator access is required.' using errcode = '42501';
  end if;
  if p_status not in ('draft', 'active', 'archived') then
    raise exception 'Invalid product status.';
  end if;
  update public.products
  set status = p_status,
      archived_at = case when p_status = 'archived' then timezone('utc', now()) else null end
  where id = p_product_id;
  if not found then raise exception 'Product not found.'; end if;
end;
$$;

revoke all on function public.admin_set_product_status(uuid, text) from public, anon;
grant execute on function public.admin_set_product_status(uuid, text) to authenticated;

create or replace function public.admin_save_category(p_category jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then raise exception 'Administrator access is required.' using errcode = '42501'; end if;
  if nullif(btrim(p_category ->> 'name'), '') is null or nullif(btrim(p_category ->> 'slug'), '') is null then
    raise exception 'Category name and slug are required.';
  end if;
  v_id := nullif(p_category ->> 'id', '')::uuid;
  if v_id is null then
    insert into public.categories (name, slug, description, is_active)
    values (btrim(p_category ->> 'name'), btrim(p_category ->> 'slug'),
      nullif(btrim(p_category ->> 'description'), ''), coalesce((p_category ->> 'is_active')::boolean, true))
    returning id into v_id;
  else
    update public.categories
    set name = btrim(p_category ->> 'name'), slug = btrim(p_category ->> 'slug'),
        description = nullif(btrim(p_category ->> 'description'), ''),
        is_active = coalesce((p_category ->> 'is_active')::boolean, true)
    where id = v_id;
    if not found then raise exception 'Category not found.'; end if;
  end if;
  return v_id;
end;
$$;

revoke all on function public.admin_save_category(jsonb) from public, anon;
grant execute on function public.admin_save_category(jsonb) to authenticated;

create or replace function public.place_cod_order(
  p_items jsonb,
  p_shipping_address jsonb,
  p_idempotency_key uuid
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing_order public.orders;
  v_order public.orders;
  v_line record;
  v_product public.products;
  v_variant public.product_variants;
  v_subtotal numeric(12,2) := 0;
  v_shipping numeric(12,2);
  v_discount numeric(12,2) := 0;
  v_unit_price numeric(12,2);
  v_order_id uuid;
begin
  if v_user_id is null then raise exception 'Sign in to place an order.' using errcode = '42501'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 50 then
    raise exception 'The cart is empty or has too many items.';
  end if;
  if jsonb_typeof(p_shipping_address) <> 'object'
    or nullif(btrim(p_shipping_address ->> 'full_name'), '') is null
    or nullif(btrim(p_shipping_address ->> 'phone'), '') is null
    or nullif(btrim(p_shipping_address ->> 'address_line1'), '') is null
    or nullif(btrim(p_shipping_address ->> 'city'), '') is null then
    raise exception 'Complete the delivery name, phone, street address, and city.';
  end if;
  if p_idempotency_key is null then raise exception 'Checkout request identifier is required.'; end if;

  perform 1 from public.profiles where id = v_user_id;
  if not found then raise exception 'Your customer profile is missing.'; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text || p_idempotency_key::text, 0));
  select orders.* into v_existing_order
  from public.checkout_requests requests
  join public.orders on orders.id = requests.order_id
  where requests.user_id = v_user_id and requests.idempotency_key = p_idempotency_key;
  if found then return v_existing_order; end if;

  for v_line in
    select (item ->> 'product_id')::uuid as product_id,
           (item ->> 'variant_id')::uuid as variant_id,
           sum((item ->> 'quantity')::integer)::integer as quantity
    from jsonb_array_elements(p_items) as entries(item)
    group by (item ->> 'product_id')::uuid, (item ->> 'variant_id')::uuid
    order by (item ->> 'variant_id')::uuid
  loop
    if v_line.quantity <= 0 then raise exception 'Cart quantities must be positive.'; end if;
    select * into v_product from public.products
    where id = v_line.product_id and status = 'active';
    if not found then raise exception 'A product is no longer available.'; end if;

    select * into v_variant from public.product_variants
    where id = v_line.variant_id and product_id = v_product.id and is_active
    for update;
    if not found then raise exception 'A selected size or color is no longer available.'; end if;
    if v_variant.stock_quantity < v_line.quantity then
      raise exception 'Insufficient stock for % / %.', v_variant.size, v_variant.color;
    end if;
    v_unit_price := coalesce(v_variant.price_override, v_product.sale_price, v_product.price);
    v_subtotal := v_subtotal + (v_unit_price * v_line.quantity);
  end loop;

  v_shipping := case when v_subtotal >= 10000 then 0 else 500 end;
  insert into public.orders (
    user_id, status, payment_method, payment_status, currency, subtotal,
    shipping_total, discount_total, total, shipping_address, notes, checkout_key
  ) values (
    v_user_id, 'pending', 'cod', 'pending', 'PKR', v_subtotal,
    v_shipping, v_discount, v_subtotal + v_shipping - v_discount,
    p_shipping_address, nullif(btrim(p_shipping_address ->> 'notes'), ''), p_idempotency_key
  ) returning * into v_order;
  v_order_id := v_order.id;

  for v_line in
    select (item ->> 'product_id')::uuid as product_id,
           (item ->> 'variant_id')::uuid as variant_id,
           sum((item ->> 'quantity')::integer)::integer as quantity
    from jsonb_array_elements(p_items) as entries(item)
    group by (item ->> 'product_id')::uuid, (item ->> 'variant_id')::uuid
    order by (item ->> 'variant_id')::uuid
  loop
    select * into v_product from public.products where id = v_line.product_id;
    select * into v_variant from public.product_variants where id = v_line.variant_id for update;
    v_unit_price := coalesce(v_variant.price_override, v_product.sale_price, v_product.price);
    update public.product_variants
    set stock_quantity = stock_quantity - v_line.quantity
    where id = v_variant.id
    returning * into v_variant;
    insert into public.order_items (
      order_id, product_id, variant_id, product_name, sku, selected_size,
      selected_color, quantity, unit_price, line_total
    ) values (
      v_order_id, v_product.id, v_variant.id, v_product.name, v_variant.sku,
      v_variant.size, v_variant.color, v_line.quantity, v_unit_price,
      v_unit_price * v_line.quantity
    );
    insert into public.inventory_movements (
      product_id, variant_id, actor_id, movement_type, quantity_delta,
      stock_after, reason, order_id
    ) values (
      v_product.id, v_variant.id, v_user_id, 'sale', -v_line.quantity,
      v_variant.stock_quantity, 'Cash on delivery order placed', v_order_id
    );
  end loop;

  insert into public.order_events (order_id, actor_id, event_type, to_status, note)
  values (v_order_id, v_user_id, 'order_placed', 'pending', 'Cash on delivery order placed.');
  insert into public.checkout_requests (user_id, idempotency_key, order_id)
  values (v_user_id, p_idempotency_key, v_order_id);
  delete from public.cart_items
  where cart_id in (select id from public.carts where user_id = v_user_id);
  update public.carts set status = 'checked_out' where user_id = v_user_id;

  return v_order;
end;
$$;

revoke all on function public.place_cod_order(jsonb, jsonb, uuid) from public, anon;
grant execute on function public.place_cod_order(jsonb, jsonb, uuid) to authenticated;

create or replace function public.save_customer_cart(p_items jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_cart_id uuid;
  v_line record;
begin
  if v_user_id is null then raise exception 'Sign in to save your cart.' using errcode = '42501'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 100 then
    raise exception 'Cart data is invalid.';
  end if;
  insert into public.carts (user_id, status)
  values (v_user_id, 'active')
  on conflict (user_id) do update set status = 'active'
  returning id into v_cart_id;

  delete from public.cart_items where cart_id = v_cart_id;
  for v_line in
    select (item ->> 'product_id')::uuid as product_id,
           nullif(item ->> 'variant_id', '')::uuid as variant_id,
           (item ->> 'quantity')::integer as quantity
    from jsonb_array_elements(p_items) as entries(item)
  loop
    if v_line.quantity <= 0 then raise exception 'Cart quantities must be positive.'; end if;
    if not exists (
      select 1 from public.products
      where id = v_line.product_id and status = 'active'
    ) then raise exception 'A cart product is no longer available.'; end if;
    if v_line.variant_id is not null and not exists (
      select 1 from public.product_variants
      where id = v_line.variant_id and product_id = v_line.product_id and is_active
    ) then raise exception 'A cart variant is no longer available.'; end if;
    insert into public.cart_items (cart_id, product_id, variant_id, quantity)
    values (v_cart_id, v_line.product_id, v_line.variant_id, v_line.quantity)
    on conflict (cart_id, product_id, variant_id) do update
      set quantity = excluded.quantity;
  end loop;
end;
$$;

revoke all on function public.save_customer_cart(jsonb) from public, anon;
grant execute on function public.save_customer_cart(jsonb) to authenticated;

create or replace function public.admin_update_order(
  p_order_id uuid,
  p_status text,
  p_payment_status text default null,
  p_courier text default null,
  p_tracking_number text default null,
  p_note text default null
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_item record;
  v_valid_transition boolean := false;
  v_previous_status text;
  v_status_changed boolean := false;
  v_stock_after integer;
begin
  if not public.is_admin() then raise exception 'Administrator access is required.' using errcode = '42501'; end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found.'; end if;
  v_previous_status := v_order.status;

  if p_status is not null and p_status <> v_order.status then
    v_valid_transition := case v_order.status
      when 'pending' then p_status in ('confirmed', 'cancelled')
      when 'confirmed' then p_status in ('processing', 'cancelled')
      when 'processing' then p_status in ('packed', 'cancelled')
      when 'packed' then p_status in ('shipped', 'cancelled')
      when 'shipped' then p_status in ('delivered', 'returned')
      when 'delivered' then p_status = 'returned'
      when 'returned' then p_status = 'refunded'
      else false
    end;
    if not v_valid_transition then
      raise exception 'Order status transition from % to % is not allowed.', v_order.status, p_status;
    end if;
    v_status_changed := true;
  end if;

  if p_payment_status is not null and p_payment_status <> v_order.payment_status then
    if p_payment_status not in ('paid', 'failed', 'refunded')
      or (p_payment_status = 'refunded' and v_order.payment_status <> 'paid')
      or (p_payment_status in ('paid', 'failed') and v_order.payment_status <> 'pending') then
      raise exception 'Payment status transition from % to % is not allowed.', v_order.payment_status, p_payment_status;
    end if;
    if p_payment_status = 'paid' and v_order.status <> 'delivered' then
      raise exception 'Cash on delivery can only be recorded as paid after delivery.';
    end if;
    if p_payment_status = 'refunded' and v_order.status <> 'returned' then
      raise exception 'A returned order must be recorded before issuing a refund.';
    end if;
  end if;

  if p_status = 'refunded' then
    if v_order.status <> 'returned' then
      raise exception 'Only a returned order can be marked refunded.';
    end if;
    if v_order.payment_status <> 'paid' and p_payment_status is distinct from 'refunded' then
      raise exception 'Only a paid order can be refunded.';
    end if;
    p_payment_status := 'refunded';
  end if;

  if v_status_changed and p_status = 'cancelled' then
    for v_item in
      select order_items.variant_id, order_items.product_id, order_items.quantity
      from public.order_items
      where order_items.order_id = p_order_id
      order by order_items.variant_id
    loop
      update public.product_variants
      set stock_quantity = stock_quantity + v_item.quantity
      where id = v_item.variant_id
      returning stock_quantity into v_stock_after;
      if found then
        insert into public.inventory_movements (
          product_id, variant_id, actor_id, movement_type, quantity_delta,
          stock_after, reason, order_id
        ) values (
          v_item.product_id, v_item.variant_id, auth.uid(), 'cancellation',
          v_item.quantity,
          v_stock_after,
          'Order cancelled; reserved stock restored', p_order_id
        );
      end if;
    end loop;
  elsif v_status_changed and p_status = 'returned' then
    for v_item in
      select order_items.variant_id, order_items.product_id, order_items.quantity
      from public.order_items
      where order_items.order_id = p_order_id
      order by order_items.variant_id
    loop
      update public.product_variants
      set stock_quantity = stock_quantity + v_item.quantity
      where id = v_item.variant_id
      returning stock_quantity into v_stock_after;
      if found then
        insert into public.inventory_movements (
          product_id, variant_id, actor_id, movement_type, quantity_delta,
          stock_after, reason, order_id
        ) values (
          v_item.product_id, v_item.variant_id, auth.uid(), 'return',
          v_item.quantity,
          v_stock_after,
          'Returned order; stock restored', p_order_id
        );
      end if;
    end loop;
  end if;

  update public.orders
  set status = coalesce(p_status, status),
      payment_status = coalesce(p_payment_status, payment_status),
      courier = coalesce(nullif(btrim(p_courier), ''), courier),
      tracking_number = coalesce(nullif(btrim(p_tracking_number), ''), tracking_number)
  where id = p_order_id
  returning * into v_order;

  if p_status is not null or p_payment_status is not null then
    insert into public.order_events (
      order_id, actor_id, event_type, from_status, to_status, note, metadata
    ) values (
      p_order_id, auth.uid(), 'admin_update',
      case when p_status is not null then v_previous_status else null end,
      p_status, nullif(btrim(p_note), ''),
      jsonb_build_object('payment_status', v_order.payment_status)
    );
  end if;
  return v_order;
end;
$$;

revoke all on function public.admin_update_order(uuid, text, text, text, text, text) from public, anon;
grant execute on function public.admin_update_order(uuid, text, text, text, text, text) to authenticated;
