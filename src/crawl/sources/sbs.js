/**
 * SBS 편성표·선곡표 수집.
 * TODO: SBS 온에어 웹페이지를 브라우저 개발자 도구(네트워크 탭)로 열어
 *       편성표·선곡표를 내려주는 요청을 찾고, 그 응답을 SlotInput / SongInput 으로 바꾼다.
 *       찾기 전까지는 빈 배열을 돌려줘 앱은 "편성 정보 없음"으로 표시된다.
 *
 * @type {import('./types.js').BroadcasterSource}
 */
export const sbs = {
  async fetchSchedule(_channel, _date) {
    return [];
  },
  async fetchRecentSongs(_channel) {
    return [];
  },
};
