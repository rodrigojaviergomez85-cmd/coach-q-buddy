ALTER TABLE public.monitorings
  ADD COLUMN IF NOT EXISTS share_token uuid;

CREATE UNIQUE INDEX IF NOT EXISTS monitorings_share_token_idx
  ON public.monitorings (share_token)
  WHERE share_token IS NOT NULL;

CREATE OR REPLACE FUNCTION public.can_write_monitoring(_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.monitorings m
    WHERE m.id = _id
      AND (
        public.is_senior_or_admin()
        OR (
          m.coordinator_id = auth.uid()
          AND (
            m.status = 'borrador'
            OR (m.status = 'enviado' AND m.updated_at >= now() - interval '48 hours')
          )
        )
      )
  )
$$;

REVOKE ALL ON FUNCTION public.can_write_monitoring(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_write_monitoring(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS monitorings_update ON public.monitorings;
CREATE POLICY monitorings_update
ON public.monitorings
FOR UPDATE
TO authenticated
USING (public.can_write_monitoring(id))
WITH CHECK (public.can_write_monitoring(id));

CREATE OR REPLACE FUNCTION public.get_report_by_token(_token uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'coach', jsonb_build_object(
      'name', c.full_name,
      'lob', m.syllabus,
      'level', m.level
    ),
    'template', jsonb_build_object(
      'id', t.id,
      'name', t.name,
      'code', t.code,
      'scoring', t.scoring,
      'has_student_grid', t.has_student_grid
    ),
    'coordinator', jsonb_build_object(
      'name', COALESCE(p.full_name, p.email)
    ),
    'monitoring', jsonb_build_object(
      'id', m.id,
      'class_date', m.class_date,
      'qa_date', m.qa_date,
      'syllabus', m.syllabus,
      'schedule', m.schedule,
      'level', m.level,
      'status', m.status,
      'base_score', m.base_score,
      'bonus_total', m.bonus_total,
      'penalty_applied', m.penalty_applied,
      'final_score', m.final_score,
      'result_phrase', m.result_phrase,
      'customer_expectation', m.customer_expectation,
      'kudos', m.kudos,
      'aois', m.aois,
      'main_aoi', m.main_aoi,
      'previous_aois', m.previous_aois,
      'transcript_metrics', m.transcript_metrics,
      'general_comments', m.general_comments,
      'created_at', m.created_at,
      'updated_at', m.updated_at
    ),
    'answers', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', a.id,
          'item_id', a.item_id,
          'result', a.result,
          'score', a.score,
          'comment', a.comment,
          'item', jsonb_build_object(
            'kind', i.kind,
            'section', i.section,
            'area', i.area,
            'item_number', i.item_number,
            'short_label', i.short_label,
            'description', i.description,
            'points', i.points,
            'area_points', i.area_points,
            'penalty_kind', i.penalty_kind,
            'sort_order', i.sort_order
          )
        ) ORDER BY i.sort_order NULLS LAST, i.item_number
      )
      FROM public.monitoring_answers a
      LEFT JOIN public.template_items i ON i.id = a.item_id
      WHERE a.monitoring_id = m.id
    ), '[]'::jsonb),
    'students', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'student_number', s.student_number,
          'student_name', s.student_name,
          'gr', s.gr,
          'pr', s.pr,
          'fl', s.fl,
          'co', s.co,
          'in', s.in,
          'score', s.score,
          'phrase', s.phrase,
          'goal', s.goal,
          'coach_phrase', s.coach_phrase,
          'comment', s.comment
        ) ORDER BY s.student_number
      )
      FROM public.monitoring_students s
      WHERE s.monitoring_id = m.id
    ), '[]'::jsonb),
    'previous', (
      SELECT jsonb_build_object(
        'id', pm.id,
        'date', pm.class_date,
        'final_score', pm.final_score,
        'students_pct', pm.transcript_metrics->'students_pct',
        'aois', pm.aois,
        'main_aoi', pm.main_aoi
      )
      FROM public.monitorings pm
      WHERE pm.coach_id = m.coach_id
        AND pm.status = 'enviado'
        AND pm.id <> m.id
        AND pm.created_at < m.created_at
      ORDER BY pm.created_at DESC
      LIMIT 1
    ),
    'recent_scores', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('date', x.class_date, 'score', x.final_score) ORDER BY x.created_at)
      FROM (
        SELECT lm.class_date, lm.final_score, lm.created_at
        FROM public.monitorings lm
        WHERE lm.coach_id = m.coach_id
          AND lm.status = 'enviado'
          AND lm.final_score IS NOT NULL
          AND lm.created_at <= m.created_at
        ORDER BY lm.created_at DESC
        LIMIT 6
      ) x
    ), '[]'::jsonb)
  )
  FROM public.monitorings m
  JOIN public.coaches c ON c.id = m.coach_id
  JOIN public.templates t ON t.id = m.template_id
  LEFT JOIN public.profiles p ON p.id = m.coordinator_id
  WHERE m.share_token = _token
    AND m.status = 'enviado'
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.get_report_by_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_report_by_token(uuid) TO anon, authenticated, service_role;