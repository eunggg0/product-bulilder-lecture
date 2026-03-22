const { TwitterApi } = require('twitter-api-v2');

const client = new TwitterApi({
  appKey: process.env.X_API_KEY,
  appSecret: process.env.X_API_SECRET,
  accessToken: process.env.X_ACCESS_TOKEN,
  accessSecret: process.env.X_ACCESS_TOKEN_SECRET,
});

const categories = [
  {
    label: '🎬 오늘의 영화 추천',
    items: [
      { title: '기생충', desc: '봉준호 감독의 아카데미 4관왕 수상작. 계층 간 갈등을 날카롭게 담은 걸작', tags: '#한국영화 #영화추천 #기생충' },
      { title: '인터스텔라', desc: '놀란 감독의 우주 서사시. 웅장한 스케일과 감동적인 부녀 서사', tags: '#SF영화 #영화추천 #인터스텔라' },
      { title: '쇼생크 탈출', desc: 'IMDb 역대 1위 명작. 20년에 걸친 희망과 우정의 이야기', tags: '#명작 #영화추천 #쇼생크탈출' },
      { title: '올드보이', desc: '박찬욱 감독의 칸 영화제 수상작. 충격적인 복수극', tags: '#한국영화 #영화추천 #올드보이' },
      { title: '어벤져스: 엔드게임', desc: '마블 22편의 완벽한 피날레. 역대급 히어로 대결', tags: '#마블 #영화추천 #어벤져스' },
    ]
  },
  {
    label: '📺 오늘의 드라마 추천',
    items: [
      { title: '오징어 게임', desc: '넷플릭스 역사상 가장 많이 본 시리즈. 서바이벌 게임의 충격적 반전', tags: '#드라마추천 #오징어게임 #넷플릭스' },
      { title: '이상한 변호사 우영우', desc: '자폐 스펙트럼 천재 변호사의 따뜻하고 유쾌한 법정 드라마', tags: '#드라마추천 #우영우 #힐링드라마' },
      { title: '사랑의 불시착', desc: '남북을 초월한 순수한 로맨스. 따뜻한 감동과 웃음', tags: '#드라마추천 #사불 #로맨스' },
      { title: '더 글로리', desc: '학교폭력 피해자의 치밀한 복수극. 전 세계를 강타한 화제작', tags: '#드라마추천 #더글로리 #넷플릭스' },
    ]
  },
  {
    label: '🎮 오늘의 게임 추천',
    items: [
      { title: '젤다의 전설: 왕국의 눈물', desc: '오픈월드 어드벤처의 새 기준. 무한한 자유도와 창의적인 플레이', tags: '#게임추천 #젤다 #닌텐도' },
      { title: '엘든 링', desc: '미야자키 히데타카 × 조지 R.R. 마틴의 역작. 소울류 게임의 정점', tags: '#게임추천 #엘든링 #소울라이크' },
      { title: '스텔라 블레이드', desc: '국산 액션 게임의 자존심. 화려한 전투와 아름다운 그래픽', tags: '#게임추천 #스텔라블레이드 #한국게임' },
    ]
  },
  {
    label: '📚 오늘의 책 추천',
    items: [
      { title: '채식주의자', desc: '한강 작가의 맨부커상 수상작. 폭력적 세계에 저항하는 한 여성의 이야기', tags: '#책추천 #한강 #채식주의자' },
      { title: '82년생 김지영', desc: '평범한 여성의 삶을 통해 본 한국 사회의 구조적 문제', tags: '#책추천 #82년생김지영 #소설' },
      { title: '아몬드', desc: '감정을 모르는 소년과 세상의 따뜻한 연결. 국내외 베스트셀러', tags: '#책추천 #아몬드 #청소년소설' },
    ]
  },
];

const cat = categories[Math.floor(Math.random() * categories.length)];
const item = cat.items[Math.floor(Math.random() * cat.items.length)];

const tweet = `${cat.label}

📌 "${item.title}"
${item.desc}

🎯 오늘 뭐 볼지 / 뭐 할지 고민된다면?
랜덤으로 콘텐츠를 추천해드려요!

👉 https://today-pick.vercel.app

${item.tags} #오늘의픽 #추천`;

console.log('포스팅할 트윗:');
console.log(tweet);
console.log('글자 수:', tweet.length);

client.v2.tweet(tweet)
  .then(result => {
    console.log('✅ 트윗 성공!', result.data.id);
  })
  .catch(err => {
    console.error('❌ 트윗 실패:', JSON.stringify(err, null, 2));
    process.exit(1);
  });
