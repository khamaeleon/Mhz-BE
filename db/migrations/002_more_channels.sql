-- 3사 외 채널 추가(EBS·CBS·TBS·TBN·종교·공영 등)에 맞춰 channels 제약을 넓힌다.
-- 인터넷 전용 채널은 주파수가 없고, KBS 한민족방송처럼 AM 채널도 있다.

alter table public.channels drop constraint if exists channels_broadcaster_check;
alter table public.channels add constraint channels_broadcaster_check check (broadcaster in (
  'kbs', 'mbc', 'sbs', 'ebs', 'cbs', 'tbs', 'tbn', 'febc', 'bbs', 'cpbc', 'wbs',
  'kugak', 'ytn', 'ifm', 'obs', 'kookbang', 'arirang'
));

alter table public.channels drop constraint if exists channels_resolver_type_check;
alter table public.channels add constraint channels_resolver_type_check
  check (resolver_type in ('kbs', 'mbc', 'sbs', 'cpbc', 'url'));

-- frequency: 서울 기준 숫자(FM은 MHz, AM은 kHz). 인터넷 전용이면 null
alter table public.channels alter column frequency drop not null;
alter table public.channels add column frequency_band text
  check (frequency_band in ('FM', 'AM'));
update public.channels set frequency_band = 'FM' where frequency is not null;
