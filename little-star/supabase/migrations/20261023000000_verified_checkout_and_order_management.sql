alter table public.addresses
  add column if not exists alternate_phone text,
  add column if not exists area text,
  add column if not exists house_landmark text,
  add column if not exists delivery_instructions text;

alter table public.orders
  drop constraint if exists orders_payment_method_check,
  drop constraint if exists orders_payment_status_check,
  drop constraint if exists orders_status_check,
  add constraint orders_payment_method_check
    check (payment_method in ('cod', 'easypaisa')),
  add constraint orders_payment_status_check
    check (payment_status in ('pending', 'unpaid', 'processing', 'paid', 'failed', 'refunded', 'partially_refunded')),
  add constraint orders_status_check
    check (status in ('pending', 'confirmed', 'processing', 'packed', 'shipped', 'delivered', 'cancelled', 'returned', 'refunded'));

update public.orders
set payment_status = 'unpaid'
where payment_method = 'cod' and payment_status = 'pending';

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
  v_email text;
  v_email_confirmed_at timestamptz;
  v_profile_role text;
  v_existing_order public.orders;
  v_order public.orders;
  v_address_id uuid;
  v_line record;
  v_product public.products;
  v_variant public.product_variants;
  v_subtotal numeric(12,2) := 0;
  v_shipping numeric(12,2);
  v_discount numeric(12,2) := 0;
  v_unit_price numeric(12,2);
  v_order_id uuid;
begin
  if v_user_id is null then
    raise exception 'Sign in to place an order.' using errcode = '42501';
  end if;

  select users.email, users.email_confirmed_at
  into v_email, v_email_confirmed_at
  from auth.users as users
  where users.id = v_user_id and users.deleted_at is null;
  if not found or v_email_confirmed_at is null or nullif(btrim(v_email), '') is null then
    raise exception 'Verify your email address before placing an order.' using errcode = '42501';
  end if;

  select profiles.role into v_profile_role
  from public.profiles
  where profiles.id = v_user_id;
  if not found or v_profile_role <> 'customer' then
    raise exception 'A customer account is required to place an order.' using errcode = '42501';
  end if;

  if jsonb_typeof(p_items) is distinct from 'array'
    or jsonb_array_length(p_items) = 0
    or jsonb_array_length(p_items) > 50 then
    raise exception 'The cart is empty or has too many items.';
  end if;
  if jsonb_typeof(p_shipping_address) is distinct from 'object'
    or nullif(btrim(p_shipping_address ->> 'full_name'), '') is null
    or nullif(btrim(p_shipping_address ->> 'phone'), '') is null
    or nullif(btrim(p_shipping_address ->> 'province'), '') is null
    or nullif(btrim(p_shipping_address ->> 'city'), '') is null
    or nullif(btrim(p_shipping_address ->> 'area'), '') is null
    or nullif(btrim(p_shipping_address ->> 'address_line1'), '') is null then
    raise exception 'Complete your name, phone, province, city, area, and street address.';
  end if;
  if p_idempotency_key is null then
    raise exception 'Checkout request identifier is required.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text || p_idempotency_key::text, 0));
  select orders.* into v_existing_order
  from public.checkout_requests as requests
  join public.orders on public.orders.id = requests.order_id
  where requests.user_id = v_user_id
    and requests.idempotency_key = p_idempotency_key;
  if found then return v_existing_order; end if;

  for v_line in
    select (entry.item ->> 'product_id')::uuid as product_id,
           (entry.item ->> 'variant_id')::uuid as variant_id,
           sum((entry.item ->> 'quantity')::integer)::integer as quantity,
           count(entry.item ->> 'expected_unit_price') as expected_price_count,
           count(*) as line_count,
           min((entry.item ->> 'expected_unit_price')::numeric) as min_expected_price,
           max((entry.item ->> 'expected_unit_price')::numeric) as max_expected_price
    from jsonb_array_elements(p_items) as entry(item)
    group by (entry.item ->> 'product_id')::uuid, (entry.item ->> 'variant_id')::uuid
    order by (entry.item ->> 'variant_id')::uuid
  loop
    if v_line.product_id is null or v_line.variant_id is null
      or v_line.quantity is null or v_line.quantity <= 0 or v_line.quantity > 100
      or v_line.expected_price_count not in (0, v_line.line_count)
      or (v_line.expected_price_count > 0 and (
        v_line.min_expected_price is null
        or v_line.min_expected_price is distinct from v_line.max_expected_price
      )) then
      raise exception 'Cart product, variant, or quantity is invalid.';
    end if;

    select * into v_product
    from public.products
    where id = v_line.product_id and status = 'active';
    if not found then raise exception 'A product is no longer available.'; end if;

    select * into v_variant
    from public.product_variants
    where id = v_line.variant_id and product_id = v_product.id and is_active
    for update;
    if not found then raise exception 'A selected size or color is no longer available.'; end if;
    if v_variant.stock_quantity < v_line.quantity then
      raise exception 'Insufficient stock for % / %.', v_variant.size, v_variant.color;
    end if;

    v_unit_price := coalesce(v_variant.price_override, v_product.sale_price, v_product.price);
    if v_unit_price < 0 or v_unit_price::text in ('NaN', 'Infinity', '-Infinity') then
      raise exception 'A product has an invalid price.';
    end if;
    if v_line.expected_price_count > 0 and v_unit_price <> v_line.min_expected_price then
      raise exception 'A product price changed. Review your cart and confirm the updated total.';
    end if;
    v_subtotal := v_subtotal + (v_unit_price * v_line.quantity);
  end loop;

  v_shipping := case when v_subtotal >= 10000 then 0 else 500 end;

  insert into public.addresses (
    user_id, label, full_name, phone, alternate_phone, address_line1, address_line2,
    area, house_landmark, delivery_instructions, city, region, country_code, is_default
  ) values (
    v_user_id, 'Order delivery', btrim(p_shipping_address ->> 'full_name'),
    btrim(p_shipping_address ->> 'phone'),
    nullif(btrim(p_shipping_address ->> 'alternate_phone'), ''),
    btrim(p_shipping_address ->> 'address_line1'),
    nullif(btrim(p_shipping_address ->> 'address_line2'), ''),
    btrim(p_shipping_address ->> 'area'),
    nullif(btrim(p_shipping_address ->> 'house_landmark'), ''),
    nullif(btrim(p_shipping_address ->> 'delivery_instructions'), ''),
    btrim(p_shipping_address ->> 'city'),
    btrim(p_shipping_address ->> 'province'), 'PK', false
  ) returning id into v_address_id;

  insert into public.orders (
    user_id, address_id, status, payment_method, payment_status, currency, subtotal,
    shipping_total, discount_total, total, shipping_address, notes, checkout_key
  ) values (
    v_user_id, v_address_id, 'pending', 'cod', 'unpaid', 'PKR', v_subtotal,
    v_shipping, v_discount, v_subtotal + v_shipping - v_discount,
    (p_shipping_address - 'email' - 'email_verified') || jsonb_build_object('email', v_email),
    nullif(btrim(p_shipping_address ->> 'delivery_instructions'), ''), p_idempotency_key
  ) returning * into v_order;
  v_order_id := v_order.id;

  for v_line in
    select (entry.item ->> 'product_id')::uuid as product_id,
           (entry.item ->> 'variant_id')::uuid as variant_id,
           sum((entry.item ->> 'quantity')::integer)::integer as quantity
    from jsonb_array_elements(p_items) as entry(item)
    group by (entry.item ->> 'product_id')::uuid, (entry.item ->> 'variant_id')::uuid
    order by (entry.item ->> 'variant_id')::uuid
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

  insert into public.order_events (order_id, actor_id, event_type, to_status, note, metadata)
  values (
    v_order_id, v_user_id, 'order_placed', 'pending',
    'Cash on delivery order awaiting store confirmation.',
    jsonb_build_object('payment_status', 'unpaid')
  );
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

create or replace function public.customer_cancel_order(p_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_order public.orders;
  v_item record;
  v_stock_after integer;
begin
  if v_user_id is null then
    raise exception 'Sign in to manage your orders.' using errcode = '42501';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id and user_id = v_user_id
  for update;
  if not found then raise exception 'Order not found.' using errcode = '42501'; end if;
  if v_order.status = 'cancelled' then return v_order; end if;
  if v_order.status <> 'pending' then
    raise exception 'Only orders awaiting confirmation can be cancelled online.';
  end if;

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
        v_item.product_id, v_item.variant_id, v_user_id, 'cancellation',
        v_item.quantity, v_stock_after, 'Customer cancelled pending order; stock restored', p_order_id
      );
    end if;
  end loop;

  update public.orders
  set status = 'cancelled'
  where id = p_order_id
  returning * into v_order;
  insert into public.order_events (
    order_id, actor_id, event_type, from_status, to_status, note,
    metadata
  ) values (
    p_order_id, v_user_id, 'customer_cancelled', 'pending', 'cancelled',
    'Customer cancelled before store confirmation.',
    jsonb_build_object('payment_status', v_order.payment_status)
  );
  return v_order;
end;
$$;

revoke all on function public.customer_cancel_order(uuid) from public, anon;
grant execute on function public.customer_cancel_order(uuid) to authenticated;

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
  if not public.is_admin() then
    raise exception 'Administrator access is required.' using errcode = '42501';
  end if;
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
    if p_payment_status not in ('paid', 'failed', 'refunded', 'partially_refunded')
      or (p_payment_status = 'paid' and (v_order.payment_status not in ('unpaid', 'pending') or v_order.status <> 'delivered' or v_order.payment_method <> 'cod'))
      or (p_payment_status = 'failed' and v_order.payment_status not in ('pending', 'processing'))
      or (p_payment_status in ('refunded', 'partially_refunded') and v_order.payment_status <> 'paid') then
      raise exception 'Payment status transition from % to % is not allowed.', v_order.payment_status, p_payment_status;
    end if;
    if p_payment_status = 'paid' and v_order.status <> 'delivered' then
      raise exception 'Cash on delivery can only be recorded as paid after delivery.';
    end if;
    if p_payment_status in ('refunded', 'partially_refunded') and v_order.status <> 'returned' then
      raise exception 'A returned order must be recorded before issuing a refund.';
    end if;
  end if;

  if p_status = 'refunded' then
    if v_order.status <> 'returned' then
      raise exception 'Only a returned order can be marked refunded.';
    end if;
    if v_order.payment_status not in ('paid', 'refunded', 'partially_refunded')
      and p_payment_status is distinct from 'refunded' then
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
          v_item.quantity, v_stock_after,
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
          v_item.quantity, v_stock_after, 'Returned order; stock restored', p_order_id
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
