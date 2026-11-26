# 편성표·선곡표 원본 (2026-11-26 조사, 수집기 구현: `src/crawl/sources/{kbs,mbc,sbs}.js`)

각 방송사 웹사이트가 내부적으로 쓰는 공개 엔드포인트다. 공식 오픈 API가 아니라 예고 없이 바뀔 수 있으므로,
수집기는 실패해도 빈 배열을 돌려주고 `crawl_runs` 에 오류를 남긴다. 호출 빈도는 낮게 유지한다(편성 하루 1회, 선곡 5분).

## 요약

| 방송사 | 편성표 | 선곡표 | 곡별 재생 시각 |
| --- | --- | --- | --- |
| KBS | JSON, 날짜·채널별 | JSON, 프로그램 코드·날짜별 | 있음 |
| MBC | JSON, 날짜·채널별 | HTML(프로그램·날짜별) + 지금 나오는 곡 JSON | 일별 목록엔 없음, 현재 곡만 |
| SBS | 정적 JSON, 날짜·채널별 | JSON, 프로그램 ID·날짜별 | 있음 |

## KBS

### 편성표
```
GET https://static.api.kbs.co.kr/mediafactory/v1/schedule/weekly
    ?local_station_code=00&channel_code={21|22|23|24|25|26}
    &program_planned_date_from=YYYYMMDD&program_planned_date_to=YYYYMMDD
```
- 응답: `[{ channel_code, schedules: [...] }]` 날짜마다 원소 1개.
- 슬롯 필드: `service_date`(실제 방송일, 자정 이후 슬롯은 다음 날짜), `service_start_time`/`service_end_time`(`HHMMSS00`),
  `program_code`(예: R2024-0174), `program_title`, `program_actor`(진행자), `image_w`(이미지), `homepage_url`, `rerun_classification`.
- 지금 방송: `.../schedule/onair_now?local_station_code=00&channel_code=25`

### 선곡표
```
GET https://kong2017.kbs.co.kr/api/mobile/select_song_list
    ?program_code={편성표의 program_code, 쉼표로 여러 개}&rtype=json&request_date=YYYYMMDD&page=1&page_size=100
```
- 응답: `{ items: [{ song_title, artist, album_name, album_image, timestamp(YYYYMMDDHHMMSS), duration, program_code }] }`
- 편성표의 `program_code` 로 조회해야 한다(상위 코드 `parent_code` 로는 비어 있을 수 있음).

## MBC

### 편성표
```
GET https://control.imbc.com/Schedule/Radio?sDate=YYYYMMDD&sType={FM|FM4U|CHM}
```
- `FM` = 표준FM, `FM4U` = FM4U, `CHM`(= `STFM`) = 올댓뮤직.
- 05:00 부터 다음 날 새벽까지 시작 시각 순서. 자정 이후 슬롯은 시작 시각이 작아지는 것으로 구분하고, 종료는 시작+`RunningTime` 으로 계산한다(`EndTime` 은 `2400` 같은 값이 나온다).
- 필드: `StartTime`(`HHMM`), `EndTime`, `RunningTime`(분), `Title`, `BroadcastID`, `HomepageURL`, `Photo`.
- 요일별 고정 편성(전체 채널): `https://miniapi.imbc.com/Schedule/schedulelist?rtype=json` (`Channel`: STFM/FM4U/CHAM, `LiveDays`, 이미지 여러 크기).

### 선곡표
- 지금 나오는 곡: `GET https://miniapi.imbc.com/music/somitem?rtype=json`
  → `[{ Channel, RegDate, SomItem: "♬곡명 - 가수", ProgCode }]`. 곡이 바뀔 때마다 1건씩이라 5분 수집이면 놓친다(1분 권장).
- 일별 목록(HTML): `https://miniweb.imbc.com/Music?page=1&progCode={ProgCode}` → `/Music/View?seqID=..&progCode=..`
  에 번호·곡명·가수 표. 재생 시각은 없다. `ProgCode`(예: 배철수의 음악캠프 `RAMFM300`)와 편성표 `BroadcastID` 대응표는 아직 없음.
- 페이지 문구: "MBC의 동의 없는 선곡 콘텐츠의 상업적 이용을 금합니다." → 상업적 이용 전에 확인 필요.

## SBS

### 편성표
```
GET https://static.cloud.sbs.co.kr/schedule/YYYY/M/D/{Power|Love}.json
```
- 월·일은 앞자리 0 없이 써야 한다(`2026/11/5` 200, `2026/11/05` 403). 응답은 슬롯 배열.
- 시각은 24시를 넘길 수 있다(`24:00`~`26:00` = 다음 날 새벽). 그 시간대 선곡도 이 날짜로 조회한다.
- 필드: `start_time`/`end_time`(`HH:MM`, 01:00 시작), `title`, `programId`(예: `S07_V0000336099`), `programcode`,
  `program_image`, `circle_image`, `homepage_url`, `is_bora`(보이는 라디오 여부), `guest`.
- 고릴라디오M 편성표는 이 경로에 없다(403).
- 지금 방송: `https://apis.sbs.co.kr/play-api/1.0/onair/channel/{S07=파워FM|S08?=러브FM}` 의 `onair.info`(title, starttime, endtime, guest_name).

### 선곡표
```
GET https://apis.sbs.co.kr/radio-api/playlist/{vodid}/YYYYMMDD   (YYYYMMDD = 편성표 파일 날짜)
```
- `vodid` 는 프로그램 메뉴 API `https://static.apis.sbs.co.kr/program-api/1.0/menu/{편성표 programcode}` 의 `"vodid"`.
  편성표 `programId` 의 `_` 뒤 부분과 같은 경우가 많지만 다른 프로그램도 있다(러브게임 `S01_V2000010869` → `V0000336099`).
- 응답: `data.playlist[]` 에 `SONG_TITLE`(곡명), `ALBUM_TITLE`(앨범명), `ARTIST_NAME`, `ALBUM_IMG`, `START_TIME`/`END_TIME`(YYYYMMDDHHMMSS), `DISPLAY_YN`.

## 그 외 방송사 (미조사)
- CPBC: `https://apis.cpbc.co.kr/play-api/1.0/onair/channel/radio` 의 `onair.info` 에 현재 프로그램(title, starttime, endtime). 하루 편성표는 아직 못 찾음.
- EBS·CBS·TBS·TBN·종교·공영 채널: 웹사이트 편성표 페이지에서 같은 방식(개발자 도구 네트워크 탭)으로 찾아야 한다.
