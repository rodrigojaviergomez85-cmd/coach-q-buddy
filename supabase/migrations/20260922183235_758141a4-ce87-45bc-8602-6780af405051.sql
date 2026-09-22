create or replace function public.get_betty_by_token(_token uuid)
returns json
language sql
stable
security definer
set search_path to 'public'
as $$
  select json_build_object(
    'coach', json_build_object('name', c.full_name, 'lob', c.lob, 'level', c.level),
    'scan', json_build_object(
      'id', s.id,
      'class_date', s.class_date,
      'level', s.level,
      'lob', s.lob,
      'betty_score', s.betty_score,
      'betty_phrase', s.betty_phrase,
      'summary', s.ai_summary,
      'kudos', s.ai_kudos,
      'aois', s.ai_aois,
      'transcript_metrics', s.transcript_metrics,
      'class_timeline', s.class_timeline,
      'status', s.status
    ),
    'config', json_build_object(
      'coach_sees_score', coalesce((select value from app_config where key = 'coach_sees_score'), 'false'::jsonb),
      'talk_time_green', coalesce((select value from app_config where key = 'talk_time_green'), '70'::jsonb),
      'talk_time_yellow', coalesce((select value from app_config where key = 'talk_time_yellow'), '55'::jsonb),
      'student_min_pct', coalesce((select value from app_config where key = 'student_min_pct'), '8'::jsonb)
    ),
    'answers', coalesce((
      select json_agg(json_build_object(
        'item_id', a.item_id,
        'result', coalesce(a.final_result, a.ai_result),
        'comment', a.comment,
        'item', json_build_object(
          'id', ti.id, 'kind', ti.kind, 'area', ti.area, 'item_number', ti.item_number,
          'short_label', ti.short_label, 'description', ti.description,
          'points', ti.points, 'area_points', ti.area_points, 'sort_order', ti.sort_order
        )
      ) order by ti.sort_order)
      from betty_scan_answers a join template_items ti on ti.id = a.item_id
      where a.scan_id = s.id
    ), '[]'::json)
  )
  from betty_scans s
  join coaches c on c.id = s.coach_id
  where s.share_token = _token
$$;

revoke all on function public.get_betty_by_token(uuid) from public;
grant execute on function public.get_betty_by_token(uuid) to anon, authenticated, service_role;