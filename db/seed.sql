-- 채널 30개 (MHz-FE src/data/channels.ts 와 같은 값)
-- 앱 목록과 맞추기 위해 이미 있는 채널도 값을 덮어쓴다(is_active 는 건드리지 않는다).
insert into public.channels (id, broadcaster, name, short_name, frequency, frequency_band, colors, resolver_type, resolver_params, sort_order) values
  ('kbs-1radio', 'kbs', 'KBS 1라디오', '1Radio', '97.3', 'FM', '{#2B3A67,#11162B}', 'kbs', '{"code":"21"}', 1),
  ('kbs-2radio', 'kbs', 'KBS 2라디오', 'Happy FM', '106.1', 'FM', '{#E0743A,#3A1A0E}', 'kbs', '{"code":"22"}', 2),
  ('kbs-cool', 'kbs', 'KBS 쿨FM', 'Cool FM', '89.1', 'FM', '{#1FA2D6,#0B2A3D}', 'kbs', '{"code":"25"}', 3),
  ('kbs-classic', 'kbs', 'KBS 클래식FM', 'Classic', '93.1', 'FM', '{#7A5C3E,#21180F}', 'kbs', '{"code":"24"}', 4),
  ('kbs-3radio', 'kbs', 'KBS 3라디오', '3Radio', '104.9', 'FM', '{#3E8E7E,#0F2722}', 'kbs', '{"code":"23"}', 5),
  ('kbs-hanminjok', 'kbs', 'KBS 한민족방송', '한민족', '972', 'AM', '{#5B6B8C,#171C26}', 'kbs', '{"code":"26"}', 6),
  ('mbc-sfm', 'mbc', 'MBC 표준FM', 'MBC 표준', '95.9', 'FM', '{#6A5CFF,#1B1640}', 'mbc', '{"channel":"sfm"}', 7),
  ('mbc-fm4u', 'mbc', 'MBC FM4U', 'FM4U', '91.9', 'FM', '{#E5484D,#3D1214}', 'mbc', '{"channel":"mfm"}', 8),
  ('mbc-allthat', 'mbc', 'MBC 올댓뮤직', 'All That', null, null, '{#B455E0,#2A1236}', 'mbc', '{"channel":"chm"}', 9),
  ('sbs-love', 'sbs', 'SBS 러브FM', 'Love FM', '103.5', 'FM', '{#E85D9E,#3B1229}', 'sbs', '{"path":"lovepc/lovefm"}', 10),
  ('sbs-power', 'sbs', 'SBS 파워FM', 'Power FM', '107.7', 'FM', '{#F5A524,#3D2706}', 'sbs', '{"path":"powerpc/powerfm"}', 11),
  ('sbs-gorealra', 'sbs', 'SBS 고릴라디오M', '고릴라M', null, null, '{#4CB86B,#11301A}', 'sbs', '{"path":"sbsdmbpc/sbsdmb"}', 12),
  ('ebs-fm', 'ebs', 'EBS FM', 'EBS FM', '104.5', 'FM', '{#2FA84F,#0D2A15}', 'url', '{"url":"https://ebsonair.ebs.co.kr/fmradiofamilypc/familypc1m/playlist.m3u8"}', 13),
  ('ebs-bandi', 'ebs', 'EBS 반디', '반디', null, null, '{#E0C23A,#332A0B}', 'url', '{"url":"https://ebsonair.ebs.co.kr/cloud1/iradio/playlist.m3u8"}', 14),
  ('kugak', 'kugak', '국악방송', '국악', '99.1', 'FM', '{#C0533A,#33140D}', 'url', '{"url":"https://mgugaklive.nowcdn.co.kr/gugakradio/gugakradio.stream/playlist.m3u8"}', 15),
  ('kookbang', 'kookbang', '국방FM', '국방FM', '100.9', 'FM', '{#5E7A3A,#1A220F}', 'url', '{"url":"https://mediaworks.dema.mil.kr/live_edge/audio.sdp/playlist.m3u8"}', 16),
  ('arirang', 'arirang', 'Arirang Radio', 'Arirang', null, null, '{#2E7DD7,#0B1F36}', 'url', '{"url":"https://amdlive-ch03-ctnd-com.akamaized.net/arirang_3ch/smil:arirang_3ch.smil/playlist.m3u8"}', 17),
  ('ytn', 'ytn', 'YTN 라디오', 'YTN', '94.5', 'FM', '{#3A6FE0,#0E1C3A}', 'url', '{"url":"https://radiolive.ytn.co.kr/radio/_definst_/20211118_fmlive/playlist.m3u8"}', 18),
  ('tbs-fm', 'tbs', 'TBS FM', 'TBS', '95.1', 'FM', '{#00A3A1,#002B2B}', 'url', '{"url":"https://cdnfm.tbs.seoul.kr/tbs/_definst_/tbs_fm_web_360.smil/playlist.m3u8"}', 19),
  ('tbs-efm', 'tbs', 'TBS eFM', 'eFM', '101.3', 'FM', '{#7FB82E,#20300B}', 'url', '{"url":"https://cdnefm.tbs.seoul.kr/tbs/_definst_/tbs_efm_web_360.smil/playlist.m3u8"}', 20),
  ('tbn-gyeongin', 'tbn', 'TBN 경인교통방송', 'TBN', '99.9', 'FM', '{#F06A2A,#3A190A}', 'url', '{"url":"https://www.tbn.it.kr/gyeongin/myStream/playlist.m3u8"}', 21),
  ('cbs-sfm', 'cbs', 'CBS 표준FM', 'CBS 표준', '98.1', 'FM', '{#1D5FA8,#0A1A2E}', 'url', '{"url":"https://m-aac.cbs.co.kr/mweb_cbs981/_definst_/cbs981.stream/playlist.m3u8"}', 22),
  ('cbs-mfm', 'cbs', 'CBS 음악FM', 'CBS 음악', '93.9', 'FM', '{#D2416E,#36101C}', 'url', '{"url":"https://m-aac.cbs.co.kr/mweb_cbs939/_definst_/cbs939.stream/playlist.m3u8"}', 23),
  ('cbs-joy4u', 'cbs', 'CBS JOY4U', 'JOY4U', null, null, '{#F2B33D,#3A2A0C}', 'url', '{"url":"https://m-aac.cbs.co.kr/mweb_cbscmc/_definst_/cbscmc.stream/playlist.m3u8"}', 24),
  ('febc', 'febc', 'FEBC 극동방송', '극동', '106.9', 'FM', '{#3D9BD1,#0D2533}', 'url', '{"url":"https://mlive3.febc.net/live5/seoulfm/playlist.m3u8"}', 25),
  ('bbs', 'bbs', 'BBS 불교방송', 'BBS', '101.9', 'FM', '{#D98A2B,#35210A}', 'url', '{"url":"https://bbslive.clouducs.com/bbsradio-mlive/radio.stream/playlist.m3u8"}', 26),
  ('cpbc', 'cpbc', 'CPBC 가톨릭평화방송', 'CPBC', '105.3', 'FM', '{#8C3B4A,#260F14}', 'cpbc', '{}', 27),
  ('wbs', 'wbs', 'WBS 원음방송', 'WBS', '89.7', 'FM', '{#4B5FC7,#121833}', 'url', '{"url":"https://wbsradio.kr/wbs-seoul","format":"progressive"}', 28),
  ('ifm', 'ifm', 'iFM 경인방송', 'iFM', '90.7', 'FM', '{#E04A8A,#360F22}', 'url', '{"url":"https://stream.ifm.kr/live/aod1/playlist.m3u8"}', 29),
  ('obs', 'obs', 'OBS 라디오', 'OBS', null, null, '{#2C9C8F,#0B2824}', 'url', '{"url":"https://vod3.obs.co.kr:444/live/obsstream1/radio.stream/playlist.m3u8"}', 30)
on conflict (id) do update set
  broadcaster = excluded.broadcaster,
  name = excluded.name,
  short_name = excluded.short_name,
  frequency = excluded.frequency,
  frequency_band = excluded.frequency_band,
  colors = excluded.colors,
  resolver_type = excluded.resolver_type,
  resolver_params = excluded.resolver_params,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.app_config (key, value) values
  ('min_app_version', '"1.0.0"'),
  ('emergency_notice', 'null')
on conflict (key) do nothing;
