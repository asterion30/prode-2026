-- Migration to fix knockout match dates for Prode 2026

-- Round of 16
update public.matches set match_date = '2026-07-04T17:00:00-04:00' where id = 'm89';
update public.matches set match_date = '2026-07-04T13:00:00-04:00' where id = 'm90';
update public.matches set match_date = '2026-07-05T16:00:00-04:00' where id = 'm91';
update public.matches set match_date = '2026-07-05T20:00:00-04:00' where id = 'm92';
update public.matches set match_date = '2026-07-06T15:00:00-04:00' where id = 'm93';
update public.matches set match_date = '2026-07-06T20:00:00-04:00' where id = 'm94';
update public.matches set match_date = '2026-07-07T12:00:00-04:00' where id = 'm95';
update public.matches set match_date = '2026-07-07T16:00:00-04:00' where id = 'm96';

-- Quarter-finals
update public.matches set match_date = '2026-07-09T16:00:00-04:00' where id = 'm97';
update public.matches set match_date = '2026-07-10T15:00:00-04:00' where id = 'm98';
update public.matches set match_date = '2026-07-11T17:00:00-04:00' where id = 'm99';
update public.matches set match_date = '2026-07-11T21:00:00-04:00' where id = 'm100';

-- Semi-finals
update public.matches set match_date = '2026-07-14T15:00:00-04:00' where id = 'm101';
update public.matches set match_date = '2026-07-15T15:00:00-04:00' where id = 'm102';

-- Third Place Play-off
update public.matches set match_date = '2026-07-18T17:00:00-04:00' where id = 'm103';

-- Final
update public.matches set match_date = '2026-07-19T15:00:00-04:00' where id = 'm104';
