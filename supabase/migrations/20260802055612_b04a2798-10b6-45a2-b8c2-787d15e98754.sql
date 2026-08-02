delete from public.question_analyses where attempt_id in ('4d8e6534-7e0b-42e3-b442-86727d72c54a','6cb4f3ca-418a-4f82-a569-fc7322087004');
delete from public.test_attempts where participant_id in ('QATEST9001','TSTQA18423');
delete from public.student_rankings where participant_id in ('QATEST9001','TSTQA18423');
delete from public.test_participants where participant_id in ('QATEST9001','TSTQA18423');