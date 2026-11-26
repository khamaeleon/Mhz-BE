-- 채널 8개 (MHz-FE src/data/channels.ts 와 같은 값)
insert into public.channels (id, broadcaster, name, short_name, frequency, colors, resolver_type, resolver_params, sort_order) values
  ('kbs-1radio',  'kbs', 'KBS 1라디오',  '1Radio',   '97.3',  '{#2B3A67,#11162B}', 'kbs', '{"code":"21"}', 1),
  ('kbs-2radio',  'kbs', 'KBS 2라디오',  'Happy FM', '106.1', '{#E0743A,#3A1A0E}', 'kbs', '{"code":"22"}', 2),
  ('kbs-cool',    'kbs', 'KBS 쿨FM',     'Cool FM',  '89.1',  '{#1FA2D6,#0B2A3D}', 'kbs', '{"code":"25"}', 3),
  ('kbs-classic', 'kbs', 'KBS 클래식FM', 'Classic',  '93.1',  '{#7A5C3E,#21180F}', 'kbs', '{"code":"24"}', 4),
  ('mbc-sfm',     'mbc', 'MBC 표준FM',   'MBC 표준', '95.9',  '{#6A5CFF,#1B1640}', 'mbc', '{"channel":"sfm"}', 5),
  ('mbc-fm4u',    'mbc', 'MBC FM4U',     'FM4U',     '91.9',  '{#E5484D,#3D1214}', 'mbc', '{"channel":"mfm"}', 6),
  ('sbs-love',    'sbs', 'SBS 러브FM',   'Love FM',  '103.5', '{#E85D9E,#3B1229}', 'sbs', '{"path":"lovepc/lovefm"}', 7),
  ('sbs-power',   'sbs', 'SBS 파워FM',   'Power FM', '107.7', '{#F5A524,#3D2706}', 'sbs', '{"path":"powerpc/powerfm"}', 8)
on conflict (id) do nothing;

insert into public.app_config (key, value) values
  ('min_app_version', '"1.0.0"'),
  ('emergency_notice', 'null')
on conflict (key) do nothing;
