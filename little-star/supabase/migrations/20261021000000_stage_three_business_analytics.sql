  create table public.product_variant_costs (
    variant_id uuid primary key references public.product_variants (id) on delete cascade,
    unit_cost numeric(12, 2) not null check (unit_cost >= 0),
    updated_at timestamptz not null default timezone('utc', now())
  );

  create table public.order_item_costs (
    order_item_id uuid primary key references public.order_items (id) on delete cascade,
    unit_cost numeric(12, 2) not null check (unit_cost >= 0),
    created_at timestamptz not null default timezone('utc', now())
  );

  create or replace function public.snapshot_order_item_cost()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
  as $$
  declare
    v_unit_cost numeric(12, 2);
  begin
    if new.variant_id is not null then
      select product_variant_costs.unit_cost into v_unit_cost
      from public.product_variant_costs
      where product_variant_costs.variant_id = new.variant_id;
      if v_unit_cost is not null then
        insert into public.order_item_costs (order_item_id, unit_cost)
        values (new.id, v_unit_cost);
      end if;
    end if;
    return new;
  end;
  $$;

  create trigger order_items_snapshot_unit_cost
    after insert on public.order_items
    for each row execute function public.snapshot_order_item_cost();

  create table public.expenses (
    id uuid primary key default gen_random_uuid(),
    category text not null check (category in (
      'Product purchasing', 'Stitching and manufacturing', 'Packaging',
      'Courier and delivery', 'Marketing and advertisements', 'Rent and utilities', 'Other'
    )),
    amount numeric(12, 2) not null check (amount > 0),
    expense_date date not null default current_date,
    recipient text not null,
    notes text,
    receipt_path text,
    created_by uuid references public.profiles (id) on delete set null,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
  );

  create index expenses_expense_date_idx on public.expenses (expense_date desc);
  create trigger expenses_set_updated_at
    before update on public.expenses
    for each row execute function public.set_updated_at();

  create table public.suppliers (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    contact_name text,
    email text,
    phone text,
    address text,
    notes text,
    is_active boolean not null default true,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
  );
  create trigger suppliers_set_updated_at
    before update on public.suppliers
    for each row execute function public.set_updated_at();

  create table public.purchase_orders (
    id uuid primary key default gen_random_uuid(),
    purchase_number bigint generated always as identity unique,
    supplier_id uuid not null references public.suppliers (id) on delete restrict,
    status text not null default 'pending' check (status in ('pending', 'partially_received', 'received')),
    notes text,
    created_by uuid references public.profiles (id) on delete set null,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
  );

  create index purchase_orders_supplier_created_idx on public.purchase_orders (supplier_id, created_at desc);
  create trigger purchase_orders_set_updated_at
    before update on public.purchase_orders
    for each row execute function public.set_updated_at();

  create table public.purchase_order_items (
    id uuid primary key default gen_random_uuid(),
    purchase_order_id uuid not null references public.purchase_orders (id) on delete cascade,
    variant_id uuid not null references public.product_variants (id) on delete restrict,
    quantity integer not null check (quantity > 0),
    received_quantity integer not null default 0 check (received_quantity >= 0 and received_quantity <= quantity),
    unit_cost numeric(12, 2) not null check (unit_cost > 0),
    created_at timestamptz not null default timezone('utc', now()),
    unique (purchase_order_id, variant_id)
  );

  create index purchase_order_items_variant_idx on public.purchase_order_items (variant_id);

  create table public.supplier_payments (
    id uuid primary key default gen_random_uuid(),
    supplier_id uuid not null references public.suppliers (id) on delete restrict,
    purchase_order_id uuid references public.purchase_orders (id) on delete set null,
    amount numeric(12, 2) not null check (amount > 0),
    paid_at date not null default current_date,
    method text not null default 'cash',
    reference text,
    notes text,
    created_by uuid references public.profiles (id) on delete set null,
    created_at timestamptz not null default timezone('utc', now())
  );

  create index supplier_payments_supplier_paid_idx on public.supplier_payments (supplier_id, paid_at desc);

  create table public.coupons (
    id uuid primary key default gen_random_uuid(),
    code text not null unique,
    description text,
    is_active boolean not null default true,
    created_at timestamptz not null default timezone('utc', now())
  );

  alter table public.orders
    add column if not exists coupon_code text;

  do $$
  begin
    if not exists (
      select 1 from pg_constraint
      where conname = 'orders_coupon_code_fkey'
        and conrelid = 'public.orders'::regclass
    ) then
      alter table public.orders
        add constraint orders_coupon_code_fkey
        foreign key (coupon_code) references public.coupons (code) on update cascade on delete set null;
    end if;
  end;
  $$;

  alter table public.expenses enable row level security;
  alter table public.suppliers enable row level security;
  alter table public.purchase_orders enable row level security;
  alter table public.purchase_order_items enable row level security;
  alter table public.supplier_payments enable row level security;
  alter table public.coupons enable row level security;
  alter table public.product_variant_costs enable row level security;
  alter table public.order_item_costs enable row level security;

  create policy "Admins can read expenses"
    on public.expenses for select to authenticated using ((select public.is_admin()));
  create policy "Admins can read suppliers"
    on public.suppliers for select to authenticated using ((select public.is_admin()));
  create policy "Admins can read purchase orders"
    on public.purchase_orders for select to authenticated using ((select public.is_admin()));
  create policy "Admins can read purchase order items"
    on public.purchase_order_items for select to authenticated using ((select public.is_admin()));
  create policy "Admins can read supplier payments"
    on public.supplier_payments for select to authenticated using ((select public.is_admin()));
  create policy "Admins can read coupons"
    on public.coupons for select to authenticated using ((select public.is_admin()));
  create policy "Admins can read product variant costs"
    on public.product_variant_costs for select to authenticated using ((select public.is_admin()));
  create policy "Admins can read order item costs"
    on public.order_item_costs for select to authenticated using ((select public.is_admin()));

  revoke all on public.expenses, public.suppliers, public.purchase_orders,
    public.purchase_order_items, public.supplier_payments, public.coupons,
    public.product_variant_costs, public.order_item_costs from anon, authenticated;
  grant select on public.expenses, public.suppliers, public.purchase_orders,
    public.purchase_order_items, public.supplier_payments, public.coupons,
    public.product_variant_costs, public.order_item_costs to authenticated;

  insert into storage.buckets (id, name, public)
  values ('expense-receipts', 'expense-receipts', false)
  on conflict (id) do update set
    public = false,
    file_size_limit = 10485760,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];

  create policy "Admins can read expense receipts"
    on storage.objects for select to authenticated
    using (bucket_id = 'expense-receipts' and (select public.is_admin()));
  create policy "Admins can upload expense receipts"
    on storage.objects for insert to authenticated
    with check (bucket_id = 'expense-receipts' and (select public.is_admin()));
  create policy "Admins can update expense receipts"
    on storage.objects for update to authenticated
    using (bucket_id = 'expense-receipts' and (select public.is_admin()))
    with check (bucket_id = 'expense-receipts' and (select public.is_admin()));

  create or replace function public.admin_save_expense(p_expense jsonb)
  returns uuid
  language plpgsql
  security definer
  set search_path = public
  as $$
  declare
    v_id uuid;
    v_amount numeric(12, 2);
    v_category text;
  begin
    if not public.is_admin() then raise exception 'Administrator access is required.' using errcode = '42501'; end if;
    v_id := nullif(p_expense ->> 'id', '')::uuid;
    v_category := p_expense ->> 'category';
    v_amount := (p_expense ->> 'amount')::numeric;
    if v_category not in (
      'Product purchasing', 'Stitching and manufacturing', 'Packaging',
      'Courier and delivery', 'Marketing and advertisements', 'Rent and utilities', 'Other'
    ) then raise exception 'Choose a valid expense category.'; end if;
    if v_amount is null or v_amount <= 0 or v_amount::text in ('NaN', 'Infinity', '-Infinity') then
      raise exception 'Expense amount must be a finite value greater than zero.';
    end if;
    if nullif(btrim(p_expense ->> 'recipient'), '') is null then raise exception 'Expense recipient is required.'; end if;
    if nullif(p_expense ->> 'expense_date', '')::date is null then raise exception 'Expense date is required.'; end if;
    if v_id is null then
      insert into public.expenses (category, amount, expense_date, recipient, notes, receipt_path, created_by)
      values (v_category, v_amount, (p_expense ->> 'expense_date')::date,
        btrim(p_expense ->> 'recipient'), nullif(btrim(p_expense ->> 'notes'), ''),
        nullif(p_expense ->> 'receipt_path', ''), auth.uid())
      returning id into v_id;
    else
      update public.expenses
      set category = v_category, amount = v_amount,
          expense_date = (p_expense ->> 'expense_date')::date,
          recipient = btrim(p_expense ->> 'recipient'),
          notes = nullif(btrim(p_expense ->> 'notes'), ''),
          receipt_path = nullif(p_expense ->> 'receipt_path', '')
      where id = v_id;
      if not found then raise exception 'Expense not found.'; end if;
    end if;
    return v_id;
  end;
  $$;

  create or replace function public.admin_save_supplier(p_supplier jsonb)
  returns uuid
  language plpgsql
  security definer
  set search_path = public
  as $$
  declare
    v_id uuid;
  begin
    if not public.is_admin() then raise exception 'Administrator access is required.' using errcode = '42501'; end if;
    if nullif(btrim(p_supplier ->> 'name'), '') is null then raise exception 'Supplier name is required.'; end if;
    v_id := nullif(p_supplier ->> 'id', '')::uuid;
    if v_id is null then
      insert into public.suppliers (name, contact_name, email, phone, address, notes, is_active)
      values (btrim(p_supplier ->> 'name'), nullif(btrim(p_supplier ->> 'contact_name'), ''),
        nullif(btrim(p_supplier ->> 'email'), ''), nullif(btrim(p_supplier ->> 'phone'), ''),
        nullif(btrim(p_supplier ->> 'address'), ''), nullif(btrim(p_supplier ->> 'notes'), ''),
        coalesce((p_supplier ->> 'is_active')::boolean, true))
      returning id into v_id;
    else
      update public.suppliers
      set name = btrim(p_supplier ->> 'name'),
          contact_name = nullif(btrim(p_supplier ->> 'contact_name'), ''),
          email = nullif(btrim(p_supplier ->> 'email'), ''),
          phone = nullif(btrim(p_supplier ->> 'phone'), ''),
          address = nullif(btrim(p_supplier ->> 'address'), ''),
          notes = nullif(btrim(p_supplier ->> 'notes'), ''),
          is_active = coalesce((p_supplier ->> 'is_active')::boolean, true)
      where id = v_id;
      if not found then raise exception 'Supplier not found.'; end if;
    end if;
    return v_id;
  end;
  $$;

  create or replace function public.admin_create_purchase(p_supplier_id uuid, p_notes text, p_items jsonb)
  returns uuid
  language plpgsql
  security definer
  set search_path = public
  as $$
  declare
    v_id uuid;
    v_item jsonb; 
    v_variant public.product_variants;
    v_quantity integer;
    v_cost numeric(12, 2);
  begin
    if not public.is_admin() then raise exception 'Administrator access is required.' using errcode = '42501'; end if;
    if not exists (select 1 from public.suppliers where id = p_supplier_id and is_active) then
      raise exception 'Choose an active supplier.';
    end if;
    if jsonb_typeof(p_items) is distinct from 'array' then
      raise exception 'Purchase items must be an array.';
    end if;
    if jsonb_array_length(p_items) = 0 then
      raise exception 'Add at least one product variant to the purchase.';
    end if;
    insert into public.purchase_orders (supplier_id, notes, created_by)
    values (p_supplier_id, nullif(btrim(p_notes), ''), auth.uid())
    returning id into v_id;
    for v_item in select value from jsonb_array_elements(p_items)
    loop
      select * into v_variant from public.product_variants where id = (v_item ->> 'variant_id')::uuid;
      if not found or not v_variant.is_active then raise exception 'A selected product variant is unavailable.'; end if;
      v_quantity := (v_item ->> 'quantity')::integer;
      v_cost := (v_item ->> 'unit_cost')::numeric;
      if v_quantity is null or v_quantity < 1 or v_cost is null or v_cost <= 0
        or v_cost::text in ('NaN', 'Infinity', '-Infinity') then
        raise exception 'Purchase quantity and unit cost must be positive.';
      end if;
      insert into public.purchase_order_items (purchase_order_id, variant_id, quantity, unit_cost)
      values (v_id, v_variant.id, v_quantity, v_cost);
    end loop;
    return v_id;
  end;
  $$;

  create or replace function public.admin_receive_purchase(p_purchase_id uuid, p_items jsonb)
  returns public.purchase_orders
  language plpgsql
  security definer
  set search_path = public
  as $$
  declare
    v_purchase public.purchase_orders;
    v_item jsonb;
    v_line public.purchase_order_items;
    v_variant public.product_variants;
    v_unit_cost numeric(12, 2);
    v_quantity integer;
    v_next_stock integer;
    v_all_received boolean;
    v_has_cost boolean;
  begin
    if not public.is_admin() then raise exception 'Administrator access is required.' using errcode = '42501'; end if;
    select * into v_purchase from public.purchase_orders where id = p_purchase_id for update;
    if not found then raise exception 'Purchase order not found.'; end if;
    if v_purchase.status = 'received' then raise exception 'This purchase has already been fully received.'; end if;
    if jsonb_typeof(p_items) is distinct from 'array' then
      raise exception 'Received items must be an array.';
    end if;
    if jsonb_array_length(p_items) = 0 then
      raise exception 'Enter at least one quantity being received.';
    end if;
    for v_item in select value from jsonb_array_elements(p_items)
    loop
      v_quantity := (v_item ->> 'quantity')::integer;
      if v_quantity is null or v_quantity < 1 then raise exception 'Received quantities must be positive whole numbers.'; end if;
      select * into v_line from public.purchase_order_items
      where id = (v_item ->> 'item_id')::uuid and purchase_order_id = p_purchase_id for update;
      if not found then raise exception 'A received item does not belong to this purchase.'; end if;
      if v_line.received_quantity + v_quantity > v_line.quantity then
        raise exception 'Received quantity exceeds the remaining quantity for a purchase line.';
      end if;
      select * into v_variant from public.product_variants where id = v_line.variant_id for update;
      v_next_stock := v_variant.stock_quantity + v_quantity;
      select unit_cost into v_unit_cost from public.product_variant_costs
      where variant_id = v_variant.id;
      v_has_cost := found;
      update public.product_variants
      set stock_quantity = v_next_stock
      where id = v_variant.id;
      if v_has_cost then
        update public.product_variant_costs
        set unit_cost = case when v_variant.stock_quantity = 0 then v_line.unit_cost
          else round(((v_unit_cost * v_variant.stock_quantity) + (v_line.unit_cost * v_quantity)) / v_next_stock, 2)
          end,
          updated_at = timezone('utc', now())
        where variant_id = v_variant.id;
      elsif v_variant.stock_quantity = 0 then
        insert into public.product_variant_costs (variant_id, unit_cost)
        values (v_variant.id, v_line.unit_cost);
      end if;
      update public.purchase_order_items
      set received_quantity = received_quantity + v_quantity
      where id = v_line.id;
      insert into public.inventory_movements (
        product_id, variant_id, actor_id, movement_type, quantity_delta, stock_after, reason
      ) values (
        v_variant.product_id, v_variant.id, auth.uid(), 'addition', v_quantity, v_next_stock,
        'Purchase #' || v_purchase.purchase_number || ' received'
      );
    end loop;
    select bool_and(received_quantity = quantity) into v_all_received
    from public.purchase_order_items where purchase_order_id = p_purchase_id;
    update public.purchase_orders
    set status = case when v_all_received then 'received' else 'partially_received' end
    where id = p_purchase_id
    returning * into v_purchase;
    return v_purchase;
  end;
  $$;

  create or replace function public.admin_record_supplier_payment(
    p_supplier_id uuid,
    p_purchase_order_id uuid,
    p_amount numeric,
    p_paid_at date,
    p_method text,
    p_reference text,
    p_notes text
  )
  returns uuid
  language plpgsql
  security definer
  set search_path = public
  as $$
  declare
    v_id uuid;
    v_purchase_total numeric(12, 2);
    v_paid_total numeric(12, 2);
  begin
    if not public.is_admin() then raise exception 'Administrator access is required.' using errcode = '42501'; end if;
    if p_amount is null or p_amount <= 0 or p_amount::text in ('NaN', 'Infinity', '-Infinity') then
      raise exception 'Payment amount must be a finite value greater than zero.';
    end if;
    if not exists (select 1 from public.suppliers where id = p_supplier_id) then raise exception 'Supplier not found.'; end if;
    if p_purchase_order_id is not null and not exists (
      select 1 from public.purchase_orders
      where id = p_purchase_order_id and supplier_id = p_supplier_id
    ) then raise exception 'The purchase order does not belong to this supplier.'; end if;
    if p_purchase_order_id is not null then
      perform 1 from public.purchase_orders where id = p_purchase_order_id for update;
      select coalesce(sum(quantity * unit_cost), 0) into v_purchase_total
      from public.purchase_order_items where purchase_order_id = p_purchase_order_id;
      select coalesce(sum(amount), 0) into v_paid_total
      from public.supplier_payments where purchase_order_id = p_purchase_order_id;
      if p_amount > v_purchase_total - v_paid_total then
        raise exception 'Payment exceeds the remaining purchase order balance.';
      end if;
    end if;
    insert into public.supplier_payments (
      supplier_id, purchase_order_id, amount, paid_at, method, reference, notes, created_by
    ) values (
      p_supplier_id, p_purchase_order_id, p_amount, coalesce(p_paid_at, current_date),
      coalesce(nullif(btrim(p_method), ''), 'cash'), nullif(btrim(p_reference), ''),
      nullif(btrim(p_notes), ''), auth.uid()
    ) returning id into v_id;
    return v_id;
  end;
  $$;

  revoke all on function public.admin_save_expense(jsonb) from public, anon;
  revoke all on function public.admin_save_supplier(jsonb) from public, anon;
  revoke all on function public.admin_create_purchase(uuid, text, jsonb) from public, anon;
  revoke all on function public.admin_receive_purchase(uuid, jsonb) from public, anon;
  revoke all on function public.admin_record_supplier_payment(uuid, uuid, numeric, date, text, text, text) from public, anon;
  grant execute on function public.admin_save_expense(jsonb) to authenticated;
  grant execute on function public.admin_save_supplier(jsonb) to authenticated;
  grant execute on function public.admin_create_purchase(uuid, text, jsonb) to authenticated;
  grant execute on function public.admin_receive_purchase(uuid, jsonb) to authenticated;
  grant execute on function public.admin_record_supplier_payment(uuid, uuid, numeric, date, text, text, text) to authenticated;
