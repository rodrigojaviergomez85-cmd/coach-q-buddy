ALTER TABLE public.templates ADD COLUMN IF NOT EXISTS score_rule text;

DO $$
DECLARE old_id uuid; new_id uuid; old_sort int; 
  a1 text := 'The most enjoyable, dynamic, entertaining and results oriented classes (your kid will beg you to be there)';
  a2 text := 'Mental training and Growth Mindset';
  a3 text := 'Emotional connection';
BEGIN
  SELECT id, sort_order INTO old_id, old_sort FROM public.templates WHERE code = 'MTH';
  UPDATE public.templates SET active = false, name = 'Clase regular (Lun–Jue) · versión anterior' WHERE id = old_id;

  INSERT INTO public.templates (code, name, source_sheet, scoring, subject, active, has_student_grid, sort_order, score_rule, notes)
  VALUES ('MTH_2026', 'Clase regular (Lun–Jue)', 'M-TH', 'points_sum', 'coach', true, false, COALESCE(old_sort,0), 'mth_2026',
    'QA_Forms_2026_2.xlsx · M-TH. Final = MIN(Auto5 ? 5+bonus : base+bonus, 10). Bonus: EPIC AF = 2, any Yes = 1.')
  RETURNING id INTO new_id;

  INSERT INTO public.template_items (template_id, kind, sort_order, ss, area, item_number, description, points, penalty_kind, short_label) VALUES
  (new_id,'item',1,'D',a1,'1','The coach followed the three elements of dynamism (energy, voice projection, and body language) and adhered to the core processes (DPCQ, TPRS, "I do, we do, you do," and followed Prezi instructions and timing).',0.5,null,null),
  (new_id,'item',2,'D',a1,'2','The coach actively involved trainees through constant repetition (corrections, titles, instructions, and examples). The coach developed the required number of boosters for the LOB with enthusiasm, maintaining a student-centered class with equal participation. The WOF was properly displayed and explained (emojis, points, how to earn dollars, Bowser, and pay trainees). The class environment remained energetic at all times through strong voice projection, smiling, competitions, and stars.',1,null,null),
  (new_id,'item',3,'D',a1,'3','The coach corrected at least 80% of grammar and pronunciation mistakes related to the main topic using the feedback flow focused on modeling the correct structure instead of emphasizing the mistake (e.g., avoid asking trainees “Is this correct?”). The coach applied effective retakes, pushed for the stars when needed, and encouraged BET/WELL responses by asking follow-up questions that promoted critical thinking and expanded answers.',1,null,null),
  (new_id,'item',4,'D',a1,'4','Did the coach ensure that at least 60% of students understood the grammar topic? (e.g., through QA checks, translation exercises, and comprehension verification)',0.5,null,null),
  (new_id,'item',5,'D',a1,'5','The coach used the sandwich technique at least 70% of the time and applied at least two effective correction/pushing techniques, including the 3 times technique, syllable, and exaggeration, slow-fast, spoon technique, whiteboard, layout and spotlight, among others.',0.5,null,null),
  (new_id,'item',6,'D',a1,'6','The coach demonstrated strong leadership by effectively addressing situations like distracted students, camera positions, misbehavior, and reading during AF. He/she maintained an English-speaking environment suitable for the level, using TPR, short commands, and keeping instructions simple to minimize unnecessary Spanish. English critical mistakes were not detected.',1,null,null),
  (new_id,'item',7,'D',a1,'7','Three to four trainees were evaluated during AF, and probing questions were asked. 2-3 Spiral learning questions per student were asked. (Mandatory for Filter and ADV levels).',1,null,null),
  (new_id,'item',8,'M',a2,'1','The coach developed the MT with a high level of energy and encouraged trainees to engage with it and believe in themselves. A motivational speech was given.',1,null,null),
  (new_id,'item',9,'M',a2,'2','The coach motivated trainees to believe in themselves by incorporating 5-6 growth mindset affirmations throughout the class. (Set the tone, MT and Champion reminder count as 3 affirmations).',1,null,null),
  (new_id,'item',10,'E',a3,'1','The coach took the time to get to know his/her students using FODO / Follow up time with Adults or rapport time with Teens/Kids/Juniors including new classes or trainees.',1,null,null),
  (new_id,'item',11,'E',a3,'2','The coach dedicated the first 5 minutes to build rapport or follow up questions throughout the class to reinforce the emotional connection with his students. The coach showed genuine interest in each of his students.',1,null,null),
  (new_id,'item',12,'E',a3,'3','The coach smiled and maintained a friendly approach throughout the class.',0.5,null,null),
  (new_id,'penalty',13,null,null,'1','1. Low English or Leadership Skills: The coach didn’t show the needed level of English or leadership (posture, tone of voice, how to address students behaviour and reading in AF).',null,'needs_improve',null),
  (new_id,'penalty',14,null,null,'2','2. Distracted in Class: The coach used his/her phone or did other things not related to the class, either during or after the session. Wasted time was detected.',null,'needs_improve',null),
  (new_id,'penalty',15,null,null,'3','3. Too Much Spanish: The coach spoke too much Spanish, instead of keeping the class in English.',null,'needs_improve',null),
  (new_id,'penalty',16,null,null,'4','4. Not Correcting Mistakes: The coach didn’t correct at least 80% of student mistakes in grammar, pronunciation, fluency, or understanding.',null,'needs_improve',null),
  (new_id,'penalty',17,null,null,'5','5. No Boosters: The coach didn’t do activities (boosters) to fulfill our sale promise.',null,'needs_improve',null),
  (new_id,'penalty',18,null,null,'6','6. Timing: The coach failed to evaluate at least three trainees in AF.',null,'needs_improve',null),
  (new_id,'penalty',19,null,null,'7','7. Parents'' Meeting: The coach failed to cover one or more elements of the meeting (all slides in the Prezi).',null,'needs_improve',null),
  (new_id,'penalty',20,null,null,'8','8. Gamification & Engagement (WOF/Boosters/Challenges) The coach didn''t implement gamification consistently (WOF, points/emojis, challenges, boosters, rewards) to keep the class fun, dynamic, and motivating.',null,'needs_improve',null),
  (new_id,'bonus',21,null,null,'1','1. EQUAL PARTICIPATION: The coach ensures active and balanced participation by giving all students a first opportunity to participate before providing additional turns or rewards to the same trainees.',1,null,null),
  (new_id,'bonus',22,null,null,'2','2- EPIC AF - ENGAGEMENT BOOST!: The coach maintained active trainee participation through chat and reactions, achieving at least 30% engagement (+1 point), and 70% or more engagement during Automatic Fluency (+2 points), creating a highly interactive and dynamic learning environment.',2,null,'EPIC_AF'),
  (new_id,'bonus',23,null,null,'3','3- BET/WELL: Did the coach push for critical thinking at least 5 times during the class?',1,null,null);
END $$;