insert into public.production_order_status (
  pcode,
  status,
  produced_quantity,
  quantity,
  completion_pct,
  updated_by,
  updated_at
)
select
  summary.pcode,
  case
    when summary.closed or (summary.quantity > 0 and summary.produced_quantity >= summary.quantity) then 'Đã SX'
    when summary.produced_quantity > 0 then 'Đang SX'
    else 'Chưa SX'
  end as status,
  summary.produced_quantity,
  summary.quantity,
  case
    when summary.quantity > 0 then least(100, round((summary.produced_quantity / summary.quantity) * 100, 2))
    else 0
  end as completion_pct,
  null as updated_by,
  now() as updated_at
from (
  select
    d."PCODE" as pcode,
    coalesce(max(d."QUANTITY"), 0)::numeric as quantity,
    coalesce(sum(p.poutput), 0)::numeric as produced_quantity,
    bool_or(p.save_status = 'closed') as closed
  from public.data d
  left join public."Production" p on p.pcode = d."PCODE"
  where d."PCODE" is not null and d."PCODE" <> ''
  group by d."PCODE"
) summary
on conflict (pcode) do update set
  status = excluded.status,
  produced_quantity = excluded.produced_quantity,
  quantity = excluded.quantity,
  completion_pct = excluded.completion_pct,
  updated_by = excluded.updated_by,
  updated_at = excluded.updated_at;
