const TMDB_KEY = "8ba8660b9e102dda5f80238ffba806e8";
const TMDB_IMG = "https://image.tmdb.org/t/p/w300";
const RAWG_KEY = "9aea44926c9e4d56a77b7369cc2f8186";

// ===== 기존 상태 (localStorage 복원) =====
let favorites = JSON.parse(localStorage.getItem("favorites") || "[]");
let stats = JSON.parse(localStorage.getItem("pickStats") || '{"movie":0,"drama":0,"book":0,"game":0}');
let history = [];
let lastItem = null;

const categoryEmoji = { movie: "🎬", drama: "📺", book: "📚", game: "🎮" };
const categoryLabel = { movie: "영화", drama: "드라마", book: "책", game: "게임" };

// ===== 새 기능 상태 =====
let ratings = JSON.parse(localStorage.getItem("ratings") || "{}");
let ratingCount = parseInt(localStorage.getItem("ratingCount") || "0");
let watched = JSON.parse(localStorage.getItem("watched") || "[]");
let trendingData = JSON.parse(localStorage.getItem("trendingData") || "{}");
let earnedBadges = JSON.parse(localStorage.getItem("earnedBadges") || "[]");
let currentMood = null;
let currentYear = "all";
let currentCategory = "all";

// ===== API 함수 =====
async function fetchTMDBPoster(title, type) {
  const endpoint = type === "drama" ? "tv" : "movie";
  const url = `https://api.themoviedb.org/3/search/${endpoint}?api_key=${TMDB_KEY}&language=ko-KR&query=${encodeURIComponent(title)}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    const result = data.results?.[0];
    return result?.poster_path ? `${TMDB_IMG}${result.poster_path}` : null;
  } catch { return null; }
}

async function fetchRAWGCover(title) {
  try {
    const url = `https://api.rawg.io/api/games?search=${encodeURIComponent(title)}&key=${RAWG_KEY}&page_size=1`;
    const res = await fetch(url);
    const data = await res.json();
    return data.results?.[0]?.background_image || "";
  } catch { return ""; }
}

async function fetchBookCover(title) {
  try {
    const url = `https://www.googleapis.com/books/v1/volumes?q=intitle:${encodeURIComponent(title)}&maxResults=1`;
    const res = await fetch(url);
    const data = await res.json();
    const img = data.items?.[0]?.volumeInfo?.imageLinks?.thumbnail;
    if (!img) return "";
    return img.replace("zoom=1", "zoom=3").replace("http://", "https://");
  } catch { return ""; }
}

const posterCache = {};

// ===== 기분/상황 필터 매핑 =====
const moodMap = {
  "힐링": i => i.genre.includes("드라마") || i.genre.includes("애니메이션") || i.tags.some(t => ["감동", "힐링", "가족", "따뜻", "성장", "희망", "우정"].includes(t)),
  "긴장감": i => ["스릴러", "미스터리", "액션", "공포", "범죄", "어드벤처"].some(g => i.genre.includes(g)) || i.tags.some(t => ["반전", "긴장감", "서스펜스", "심리", "미스터리"].includes(t)),
  "웃긴거": i => i.genre.includes("코미디") || i.tags.some(t => ["코미디", "유머", "통쾌", "웃음"].includes(t)),
  "명작": i => parseFloat(i.rating) >= 8.8,
  "최신": i => parseInt(i.year) >= 2022,
};

// ===== 연도 필터 매핑 =====
const yearRanges = {
  "2020s": i => parseInt(i.year) >= 2020,
  "2010s": i => parseInt(i.year) >= 2010 && parseInt(i.year) < 2020,
  "2000s": i => parseInt(i.year) >= 2000 && parseInt(i.year) < 2010,
  "1990s": i => parseInt(i.year) < 2000,
};

// ===== 카테고리 탭 =====
document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    currentCategory = tab.dataset.category;
  });
});

// ===== 기분 필터 탭 =====
document.querySelectorAll(".mood-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const mood = btn.dataset.mood;
    if (currentMood === mood) {
      currentMood = null;
      document.querySelectorAll(".mood-btn").forEach(b => b.classList.remove("active"));
    } else {
      currentMood = mood;
      document.querySelectorAll(".mood-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
    }
  });
});

// ===== 연도 필터 =====
document.getElementById("yearFilter")?.addEventListener("change", function () {
  currentYear = this.value;
});

// ===== 별점 기능 =====
function setRating(score) {
  if (!lastItem) return;
  const cat = document.getElementById("recCard").dataset.category;
  const key = `${cat}_${lastItem.title}`;
  const isNew = ratings[key] === undefined;
  ratings[key] = score;
  localStorage.setItem("ratings", JSON.stringify(ratings));
  if (isNew) {
    ratingCount++;
    localStorage.setItem("ratingCount", String(ratingCount));
  }
  updateStarUI(score);
  checkBadges();
}

function updateStarUI(score) {
  document.querySelectorAll(".star-btn").forEach((btn, i) => {
    btn.classList.toggle("on", i < score);
  });
}

// ===== 이미 봤어요 =====
function toggleWatched() {
  if (!lastItem) { alert("먼저 추천을 뽑아보세요!"); return; }
  const cat = document.getElementById("recCard").dataset.category;
  const key = `${cat}_${lastItem.title}`;
  const idx = watched.indexOf(key);
  const btn = document.getElementById("watchedBtn");
  if (idx === -1) {
    watched.push(key);
    btn.textContent = "✅ 봤어요!";
    btn.classList.add("watched-on");
  } else {
    watched.splice(idx, 1);
    btn.textContent = "👁 이미 봤어요";
    btn.classList.remove("watched-on");
  }
  localStorage.setItem("watched", JSON.stringify(watched));
}

// ===== 즐겨찾기 =====
function toggleFavorite() {
  if (!lastItem) { alert("먼저 추천을 뽑아보세요!"); return; }
  const cat = document.getElementById("recCard").dataset.category;
  if (!cat) return;
  const key = `${cat}_${lastItem.title}`;
  const idx = favorites.findIndex(f => f.key === key);
  if (idx === -1) {
    favorites.unshift({ key, cat, title: lastItem.title, emoji: lastItem.emoji, year: lastItem.year, rating: lastItem.rating });
    document.getElementById("favBtn").textContent = "❤️";
  } else {
    favorites.splice(idx, 1);
    document.getElementById("favBtn").textContent = "🤍";
  }
  localStorage.setItem("favorites", JSON.stringify(favorites));
  updateFavorites();
}

function updateFavorites() {
  const el = document.getElementById("favoritesList");
  if (!el) return;
  if (favorites.length === 0) {
    el.innerHTML = `<p class="empty-history">아직 즐겨찾기가 없어요.</p>`;
    return;
  }
  el.innerHTML = favorites.map(f => `
    <div class="fav-item" onclick="window.location.href='detail.html?category=${f.cat}&title=${encodeURIComponent(f.title)}'">
      <span class="fav-emoji">${f.emoji}</span>
      <span class="fav-title">${f.title}</span>
      <span style="font-size:0.8rem;color:#f59e0b">⭐${f.rating}</span>
    </div>
  `).join("");
}

// ===== 햄버거 메뉴 =====
function toggleMenu() {
  document.getElementById("mainNav").classList.toggle("open");
}

// ===== 뱃지 정의 =====
const badgeDefs = [
  { id: "first",    icon: "🎲", name: "첫 번째 픽",   desc: "첫 추천을 뽑았어요!",          cond: s => s.total >= 1 },
  { id: "ten",      icon: "🎯", name: "10번의 도전",   desc: "10번 추천을 뽑았어요!",         cond: s => s.total >= 10 },
  { id: "fifty",    icon: "🌟", name: "50번의 탐험",   desc: "50번 추천을 뽑았어요!",         cond: s => s.total >= 50 },
  { id: "hundred",  icon: "🏆", name: "픽 마스터",     desc: "100번 추천을 뽑았어요!",        cond: s => s.total >= 100 },
  { id: "allcat",   icon: "🌈", name: "장르 탐험가",   desc: "모든 카테고리를 경험했어요!",   cond: s => s.movie >= 1 && s.drama >= 1 && s.book >= 1 && s.game >= 1 },
  { id: "moviefan", icon: "🎬", name: "영화 광",       desc: "영화를 10번 추천받았어요!",     cond: s => s.movie >= 10 },
  { id: "bookworm", icon: "📚", name: "독서광",         desc: "책을 10번 추천받았어요!",       cond: s => s.book >= 10 },
  { id: "gamer",    icon: "🎮", name: "게이머",         desc: "게임을 10번 추천받았어요!",     cond: s => s.game >= 10 },
  { id: "critic",   icon: "⭐", name: "평론가",         desc: "별점을 5번 남겼어요!",          cond: s => s.ratingCount >= 5 },
  { id: "watcher",  icon: "👁", name: "다 봤어",       desc: "10개 작품을 봤어요 체크했어요!", cond: s => s.watchedCount >= 10 },
];

function checkBadges() {
  const total = Object.values(stats).reduce((a, b) => a + b, 0);
  const s = {
    total,
    movie: stats.movie, drama: stats.drama, book: stats.book, game: stats.game,
    ratingCount,
    watchedCount: watched.length,
  };
  let newBadge = null;
  for (const badge of badgeDefs) {
    if (!earnedBadges.includes(badge.id) && badge.cond(s)) {
      earnedBadges.push(badge.id);
      if (!newBadge) newBadge = badge;
    }
  }
  localStorage.setItem("earnedBadges", JSON.stringify(earnedBadges));
  updateBadgeWidget();
  if (newBadge) showBadgePopup(newBadge);
}

function showBadgePopup(badge) {
  const popup = document.getElementById("badgePopup");
  document.getElementById("badgePopupIcon").textContent = badge.icon;
  document.getElementById("badgePopupName").textContent = badge.name;
  document.getElementById("badgePopupDesc").textContent = badge.desc;
  popup.style.display = "flex";
  setTimeout(() => closeBadgePopup(), 4000);
}

function closeBadgePopup() {
  document.getElementById("badgePopup").style.display = "none";
}

function updateBadgeWidget() {
  const el = document.getElementById("badgeCollection");
  if (!el) return;
  if (earnedBadges.length === 0) {
    el.innerHTML = `<p class="empty-history">뽑기를 시작하면 뱃지를 획득해요!</p>`;
    return;
  }
  el.innerHTML = `<div class="badge-chips">` + badgeDefs.map(b => {
    const earned = earnedBadges.includes(b.id);
    return `<span class="badge-chip ${earned ? "earned" : "locked"}" title="${b.name}: ${b.desc}">${earned ? b.icon : "🔒"}</span>`;
  }).join("") + `</div>`;
}

// ===== 트렌딩 =====
function updateTrending() {
  const el = document.getElementById("trendingList");
  if (!el) return;
  const sorted = Object.entries(trendingData).sort(([, a], [, b]) => b - a).slice(0, 5);
  if (sorted.length === 0) {
    el.innerHTML = `<p class="empty-history">뽑기를 시작하면 나타나요!</p>`;
    return;
  }
  el.innerHTML = sorted.map(([key, count], idx) => {
    const underIdx = key.indexOf("_");
    const cat = key.slice(0, underIdx);
    const title = key.slice(underIdx + 1);
    const item = recommendations[cat]?.find(i => i.title === title);
    if (!item) return "";
    return `
      <div class="trending-item" onclick="window.location.href='detail.html?category=${cat}&title=${encodeURIComponent(title)}'">
        <span class="trending-rank">${idx + 1}</span>
        <span class="trending-emoji">${item.emoji}</span>
        <span class="trending-title">${title}</span>
        <span class="trending-count">${count}회</span>
      </div>`;
  }).join("");
}

// ===== 취향 분석 =====
function updateTasteAnalysis() {
  const el = document.getElementById("tasteAnalysis");
  if (!el) return;
  const total = Object.values(stats).reduce((a, b) => a + b, 0);
  if (total < 3) {
    el.innerHTML = `<p class="empty-history">3번 이상 뽑으면 분석해드려요!</p>`;
    return;
  }
  const catNames = { movie: "영화", drama: "드라마", book: "책", game: "게임" };
  const tasteLabels = { movie: "영화 마니아 🎬", drama: "드라마 덕후 📺", book: "독서광 📚", game: "게이머 🎮" };
  const sorted = Object.entries(stats).filter(([, v]) => v > 0).sort(([, a], [, b]) => b - a);
  const [topCat] = sorted[0];
  const pct = Math.round((stats[topCat] / total) * 100);

  el.innerHTML = `
    <p class="taste-label">${tasteLabels[topCat]}</p>
    <p class="taste-sub">전체 ${total}번 중 ${catNames[topCat]} ${pct}%</p>
    <div class="taste-bars">
      ${sorted.map(([cat, cnt]) => `
        <div class="taste-bar-row">
          <span>${categoryEmoji[cat]}</span>
          <div class="taste-bar-bg">
            <div class="taste-bar-fill ${cat}" style="width:${Math.round((cnt / total) * 100)}%"></div>
          </div>
          <span class="taste-pct">${Math.round((cnt / total) * 100)}%</span>
        </div>`).join("")}
    </div>`;
}

// ===== 추천 제보 모달 =====
function openSuggestModal() {
  document.getElementById("suggestModal").style.display = "flex";
}

function closeSuggestModal() {
  document.getElementById("suggestModal").style.display = "none";
}

document.getElementById("suggestForm")?.addEventListener("submit", async function (e) {
  e.preventDefault();
  const btn = this.querySelector("[type=submit]");
  btn.textContent = "전송 중...";
  btn.disabled = true;
  try {
    const res = await fetch(this.action, {
      method: "POST",
      body: new FormData(this),
      headers: { Accept: "application/json" },
    });
    if (res.ok) {
      this.style.display = "none";
      document.getElementById("suggestSuccess").style.display = "block";
      setTimeout(closeSuggestModal, 2000);
    } else {
      btn.textContent = "제출하기";
      btn.disabled = false;
    }
  } catch {
    btn.textContent = "제출하기";
    btn.disabled = false;
  }
});

// ===== 핵심: 뽑기 함수 =====
function pickRandom() {
  const card = document.getElementById("recCard");

  // 스켈레톤 로딩
  card.classList.add("loading");
  document.getElementById("cardBadge").textContent = "";
  document.getElementById("cardPoster").textContent = "";
  document.getElementById("cardTitle").innerHTML = `<span class="skeleton skeleton-title"></span>`;
  document.getElementById("cardMeta").innerHTML = `<span class="skeleton skeleton-meta"></span>`;
  document.getElementById("cardDesc").innerHTML = `
    <span class="skeleton skeleton-line"></span>
    <span class="skeleton skeleton-line"></span>
    <span class="skeleton skeleton-line short"></span>`;
  document.getElementById("cardTags").innerHTML = "";

  setTimeout(() => {
    const categories = ["movie", "drama", "book", "game"];
    let cat = currentCategory === "all"
      ? categories[Math.floor(Math.random() * categories.length)]
      : currentCategory;

    let pool = [...recommendations[cat]];

    // 이미 봤어요 제외
    const notWatched = pool.filter(i => !watched.includes(`${cat}_${i.title}`));
    if (notWatched.length > 0) pool = notWatched;

    // 기분 필터
    if (currentMood && moodMap[currentMood]) {
      const moodFiltered = pool.filter(moodMap[currentMood]);
      if (moodFiltered.length > 0) pool = moodFiltered;
    }

    // 연도 필터
    if (currentYear !== "all" && yearRanges[currentYear]) {
      const yearFiltered = pool.filter(yearRanges[currentYear]);
      if (yearFiltered.length > 0) pool = yearFiltered;
    }

    // 직전 항목 제외
    let filtered = pool.filter(i => !lastItem || i.title !== lastItem.title);
    if (filtered.length === 0) filtered = pool;

    const item = filtered[Math.floor(Math.random() * filtered.length)];
    lastItem = item;

    // 카드 업데이트
    card.classList.remove("loading");
    card.classList.remove("animate");
    void card.offsetWidth;
    card.classList.add("animate");

    document.getElementById("cardBadge").textContent = `${categoryEmoji[cat]} ${categoryLabel[cat]}`;
    document.getElementById("cardBadge").className = `card-badge ${cat}`;
    document.getElementById("cardTitle").textContent = item.title;

    // 포스터
    const imgEl = document.getElementById("cardImg");
    const emojiEl = document.getElementById("cardPoster");
    emojiEl.textContent = item.emoji;
    imgEl.style.display = "none";
    emojiEl.style.display = "block";

    const cacheKey = `${cat}_${item.title}`;
    (async () => {
      let imageUrl = posterCache[cacheKey];
      if (imageUrl === undefined) {
        if (cat === "movie" || cat === "drama") {
          imageUrl = await fetchTMDBPoster(item.title, cat) || "";
        } else if (cat === "book") {
          imageUrl = await fetchBookCover(item.title);
        } else if (cat === "game") {
          imageUrl = item.steamId
            ? `https://cdn.cloudflare.steamstatic.com/steam/apps/${item.steamId}/library_600x900.jpg`
            : await fetchRAWGCover(item.title) || "";
        } else {
          imageUrl = "";
        }
        posterCache[cacheKey] = imageUrl;
      }
      if (imageUrl && lastItem?.title === item.title) {
        imgEl.src = imageUrl;
        imgEl.alt = item.title;
        imgEl.style.display = "block";
        emojiEl.style.display = "none";
      }
    })();

    document.getElementById("cardMeta").innerHTML =
      `<span>📅 ${item.year}</span><span>🎭 ${item.genre}</span><span>⭐ ${item.rating}</span><span>📍 ${item.where}</span>`;
    document.getElementById("cardDesc").textContent = item.desc;

    const tagsEl = document.getElementById("cardTags");
    tagsEl.innerHTML = item.tags.map(t => `<span class="tag">#${t}</span>`).join("");

    // 별점 바 표시
    const ratingBar = document.getElementById("ratingBar");
    ratingBar.style.display = "flex";
    updateStarUI(ratings[cacheKey] || 0);

    // 봤어요 버튼 상태
    const wb = document.getElementById("watchedBtn");
    const isWatched = watched.includes(cacheKey);
    wb.textContent = isWatched ? "✅ 봤어요!" : "👁 이미 봤어요";
    wb.classList.toggle("watched-on", isWatched);

    // 즐겨찾기 버튼 상태
    card.style.cursor = "pointer";
    card.dataset.category = cat;
    card.dataset.title = item.title;
    const isFav = favorites.some(f => f.key === cacheKey);
    document.getElementById("favBtn").textContent = isFav ? "❤️" : "🤍";

    // 통계 (저장)
    stats[cat]++;
    localStorage.setItem("pickStats", JSON.stringify(stats));
    updateStats();

    // 히스토리
    history.unshift({ ...item, cat });
    if (history.length > 5) history.pop();
    updateHistory();

    // 트렌딩 추적
    trendingData[cacheKey] = (trendingData[cacheKey] || 0) + 1;
    localStorage.setItem("trendingData", JSON.stringify(trendingData));
    updateTrending();

    // 취향 분석
    updateTasteAnalysis();

    // 뱃지 체크
    checkBadges();
  }, 600);
}

// ===== 통계 업데이트 =====
function updateStats() {
  const total = Object.values(stats).reduce((a, b) => a + b, 0);
  document.getElementById("totalCount").textContent = total;
  document.getElementById("movieCount").textContent = stats.movie;
  document.getElementById("dramaCount").textContent = stats.drama;
  document.getElementById("bookCount").textContent = stats.book;
  document.getElementById("gameCount").textContent = stats.game;
}

// ===== 히스토리 업데이트 =====
function updateHistory() {
  const list = document.getElementById("historyList");
  if (history.length === 0) {
    list.innerHTML = `<p class="empty-history">아직 추천 기록이 없어요. 뽑기를 시작해보세요!</p>`;
    return;
  }
  list.innerHTML = history.map(item => `
    <div class="history-item" style="cursor:pointer"
      onclick="window.location.href='detail.html?category=${item.cat}&title=${encodeURIComponent(item.title)}'">
      <span class="h-emoji">${item.emoji}</span>
      <span class="h-title">${item.title}</span>
      <span class="h-badge ${item.cat}">${categoryLabel[item.cat]}</span>
    </div>
  `).join("");
}

// ===== 카드 클릭 이벤트 =====
document.getElementById("recCard").addEventListener("click", function () {
  const cat = this.dataset.category;
  const title = this.dataset.title;
  if (cat && title) {
    window.location.href = `detail.html?category=${cat}&title=${encodeURIComponent(title)}`;
  }
});

// ===== 공유 기능 =====
function twitterShare() {
  if (!lastItem) { alert("먼저 추천을 뽑아보세요!"); return; }
  const cat = document.getElementById("recCard").dataset.category || "movie";
  const url = `https://today-pick.vercel.app/detail.html?category=${cat}&title=${encodeURIComponent(lastItem.title)}`;
  const text = `🎲 오늘의 픽 추천: ${lastItem.title}\n${lastItem.desc.slice(0, 60)}...\n\n#오늘의픽 #랜덤추천`;
  window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, "_blank");
}

function shareRecommendation() {
  if (!lastItem) { alert("먼저 추천을 뽑아보세요!"); return; }
  const text = `🎲 오늘의 픽 추천: ${lastItem.title}\n${lastItem.desc}\n\n오늘의 픽에서 확인하세요!`;
  if (navigator.share) {
    navigator.share({ title: "오늘의 픽", text });
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => alert("클립보드에 복사되었습니다!"));
  } else {
    alert(text);
  }
}

function kakaoShare() {
  if (!lastItem) { alert("먼저 추천을 뽑아보세요!"); return; }
  if (!window.Kakao || !Kakao.isInitialized()) {
    alert("카카오 SDK를 불러오는 중입니다. 잠시 후 다시 시도해주세요.");
    return;
  }
  const cat = document.getElementById("recCard").dataset.category || "movie";
  const url = `https://today-pick.vercel.app/detail.html?category=${cat}&title=${encodeURIComponent(lastItem.title)}`;
  Kakao.Share.sendDefault({
    objectType: "feed",
    content: {
      title: `🎲 오늘의 픽: ${lastItem.title}`,
      description: lastItem.desc.slice(0, 100) + "...",
      imageUrl: "https://today-pick.vercel.app/og-image.svg",
      link: { mobileWebUrl: url, webUrl: url },
    },
    buttons: [{ title: "자세히 보기", link: { mobileWebUrl: url, webUrl: url } }],
  });
}

// ===== 오늘의 명언 =====
function initQuote() {
  const q = quotes[Math.floor(Math.random() * quotes.length)];
  document.getElementById("quoteText").textContent = `"${q.text}"`;
  document.getElementById("quoteAuthor").textContent = q.author;
}

// ===== 다크모드 =====
function toggleDark() {
  const isDark = document.body.classList.toggle("dark");
  document.getElementById("darkToggle").textContent = isDark ? "☀️" : "🌙";
  localStorage.setItem("darkMode", isDark ? "on" : "off");
}

const savedMode = localStorage.getItem("darkMode");
const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
if (savedMode === "on" || (savedMode === null && prefersDark)) {
  document.body.classList.add("dark");
  document.getElementById("darkToggle").textContent = "☀️";
}
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", e => {
  if (localStorage.getItem("darkMode") === null) {
    document.body.classList.toggle("dark", e.matches);
    document.getElementById("darkToggle").textContent = e.matches ? "☀️" : "🌙";
  }
});

// ===== 카카오 SDK 초기화 =====
if (window.Kakao && !Kakao.isInitialized()) {
  Kakao.init("ee0415e0ce4c37653f918097c9f151e6");
}

// ===== 초기화 =====
initQuote();
updateStats();
updateFavorites();
updateBadgeWidget();
updateTrending();
updateTasteAnalysis();
