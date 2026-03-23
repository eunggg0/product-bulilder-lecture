const TMDB_KEY = "8ba8660b9e102dda5f80238ffba806e8";
const TMDB_IMG = "https://image.tmdb.org/t/p/w300";
const RAWG_KEY = "9aea44926c9e4d56a77b7369cc2f8186";
const SUPABASE_URL = "https://inqzrmsnwvtqqtfqfgpq.supabase.co";
const SUPABASE_KEY = "sb_publishable_oipbUCJqlCvhFegqde2QeA_Lls86Nmx";

// ===== 기존 상태 (localStorage 복원) =====
let favorites = JSON.parse(localStorage.getItem("favorites") || "[]");
let stats = JSON.parse(localStorage.getItem("pickStats") || '{"movie":0,"drama":0,"anime":0,"book":0,"game":0}');
if (!stats.anime) stats.anime = 0;
let history = [];
let lastItem = null;

const categoryEmoji = { movie: "🎬", drama: "📺", anime: "✨", book: "📚", game: "🎮" };
const categoryLabel = { movie: "영화", drama: "드라마", anime: "애니", book: "책", game: "게임" };

// ===== 새 기능 상태 =====
let ratings = JSON.parse(localStorage.getItem("ratings") || "{}");
let ratingCount = parseInt(localStorage.getItem("ratingCount") || "0");
let watched = JSON.parse(localStorage.getItem("watched") || "[]");
let trendingData = JSON.parse(localStorage.getItem("trendingData") || "{}");
let earnedBadges = JSON.parse(localStorage.getItem("earnedBadges") || "[]");
let currentMood = null;
let currentYear = "all";
let currentCategory = "all";
let forcedNextPick = null; // { cat, item } — URL 파라미터로 특정 작품 지정 시 사용
const seenItems = {}; // { cat: Set<title> } — 세션 내 중복 방지
let isAnimating = false; // 중복 클릭 방지

// ===== OTT URL 매핑 =====
const ottUrlMap = {
  "넷플릭스": { url: "https://www.netflix.com/search?q=", color: "#e50914", label: "Netflix" },
  "왓챠": { url: "https://watcha.com/search?query=", color: "#ff0558", label: "Watcha" },
  "디즈니+": { url: "https://www.disneyplus.com/search?q=", color: "#0063e5", label: "Disney+" },
  "웨이브": { url: "https://www.wavve.com/search?searchword=", color: "#0088ff", label: "Wavve" },
  "티빙": { url: "https://www.tving.com/search/all/", color: "#ff153c", label: "Tving" },
  "쿠팡플레이": { url: "https://www.coupangplay.com/search?keyword=", color: "#c00023", label: "Coupang" },
  "애플TV+": { url: "https://tv.apple.com/search?term=", color: "#555", label: "Apple TV+" },
  "스팀": { url: "https://store.steampowered.com/search/?term=", color: "#1b2838", label: "Steam" },
  "플레이스테이션": { url: "https://store.playstation.com/ko-kr/search/", color: "#003087", label: "PS Store" },
  "크런치롤": { url: "https://www.crunchyroll.com/search?q=", color: "#f47521", label: "Crunchyroll" },
  "라프텔": { url: "https://laftel.net/search?keyword=", color: "#00c4b4", label: "Laftel" },
  "교보문고": { url: "https://search.kyobobook.co.kr/search?keyword=", color: "#e65c1b", label: "교보문고" },
  "알라딘": { url: "https://www.aladin.co.kr/search/wsearchresult.aspx?SearchWord=", color: "#e50914", label: "알라딘" },
  "YES24": { url: "https://www.yes24.com/Product/Search?domain=ALL&query=", color: "#f2672a", label: "YES24" },
  "밀리의서재": { url: "https://www.millie.co.kr/search/book?keyword=", color: "#2baf8c", label: "밀리의서재" },
};

// ===== 가중치 랜덤 선택 =====
function weightedRandom(pool) {
  const currentYr = new Date().getFullYear();
  const scored = pool.map(item => {
    const rating = parseFloat(item.rating) || 5;
    const age = currentYr - parseInt(item.year);
    const recency = Math.max(0, 10 - age * 0.3);
    return { item, score: rating * 0.5 + recency * 0.3 + Math.random() * 2 };
  });
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, Math.max(5, Math.floor(scored.length * 0.4)));
  return top[Math.floor(Math.random() * top.length)].item;
}

// ===== 추천 이유 =====
function getRecommendReason(item) {
  const rating = parseFloat(item.rating);
  const age = new Date().getFullYear() - parseInt(item.year);
  if (rating >= 9.5) return { icon: "🏆", text: "역대 최고 평점 작품" };
  if (rating >= 9.3) return { icon: "💎", text: "극찬받은 명작" };
  if (rating >= 9.0) return { icon: "🌟", text: "시대를 초월한 명작" };
  if (age <= 1) return { icon: "🔥", text: "최신 인기 콘텐츠" };
  if (age <= 3) return { icon: "✨", text: "최근 화제작" };
  if (item.tags && item.tags.includes("명작")) return { icon: "🎖", text: "검증된 명작" };
  if (item.tags && item.tags.includes("힐링")) return { icon: "🌿", text: "힐링 보장 픽" };
  if (item.tags && item.tags.includes("반전")) return { icon: "⚡", text: "반전의 명수" };
  return { icon: "🎲", text: "오늘의 랜덤 픽" };
}

// ===== OTT 버튼 생성 =====
function getOTTButtons(item) {
  if (!item.where) return "";
  const platforms = item.where.split(",").map(p => p.trim()).filter(Boolean);
  const searchTitle = item.enTitle || item.title;
  return platforms.map(p => {
    const info = ottUrlMap[p];
    if (!info) return `<span class="btn-ott btn-ott-plain">${p}</span>`;
    return `<a class="btn-ott" href="${info.url}${encodeURIComponent(searchTitle)}" target="_blank" rel="noopener" style="background:${info.color}">${info.label}</a>`;
  }).join("");
}

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

async function fetchTMDBById(id, type = "tv") {
  try {
    const url = `https://api.themoviedb.org/3/${type}/${id}?api_key=${TMDB_KEY}&language=ko-KR`;
    const res = await fetch(url);
    const data = await res.json();
    return data.poster_path ? `${TMDB_IMG}${data.poster_path}` : null;
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

// ===== Supabase 함수 =====
async function recordPick(category, title) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/picks`, {
      method: "POST",
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
      },
      body: JSON.stringify({ category, title }),
    });
  } catch { /* silent */ }
}

async function loadTodayCounter() {
  const el = document.getElementById("todayCounter");
  if (!el) return;
  try {
    const today = new Date().toISOString().slice(0, 10);
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/picks?date=eq.${today}&select=id`,
      {
        headers: {
          "apikey": SUPABASE_KEY,
          "Authorization": `Bearer ${SUPABASE_KEY}`,
          "Prefer": "count=exact",
          "Range": "0-0",
        },
      }
    );
    const range = res.headers.get("Content-Range");
    const count = range ? parseInt(range.split("/")[1]) || 0 : 0;
    el.textContent = `오늘 ${count.toLocaleString()}명이 픽을 뽑았습니다 🎲`;
  } catch {
    el.textContent = "";
  }
}

async function loadPopularPicks() {
  const el = document.getElementById("popularList");
  if (!el) return;
  // 3초 안에 안 오면 fallback
  const timeout = setTimeout(() => renderPopularFallback(el), 3000);
  try {
    const today = new Date().toISOString().slice(0, 10);
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/picks?date=eq.${today}&select=category,title&limit=200`,
      {
        headers: {
          "apikey": SUPABASE_KEY,
          "Authorization": `Bearer ${SUPABASE_KEY}`,
        },
      }
    );
    clearTimeout(timeout);
    if (!res.ok) { renderPopularFallback(el); return; }
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      renderPopularFallback(el);
      return;
    }
    // 집계
    const counts = {};
    data.forEach(({ category, title }) => {
      const key = `${category}_${title}`;
      counts[key] = (counts[key] || 0) + 1;
    });
    const sorted = Object.entries(counts).sort(([, a], [, b]) => b - a).slice(0, 5);
    el.innerHTML = sorted.map(([key, cnt], idx) => {
      const sep = key.indexOf("_");
      const cat = key.slice(0, sep);
      const title = key.slice(sep + 1);
      const item = recommendations[cat]?.find(i => i.title === title);
      const emoji = item ? item.emoji : categoryEmoji[cat] || "🎲";
      return `
        <div class="pp-item" onclick="window.location.href='detail.html?category=${cat}&title=${encodeURIComponent(title)}'">
          <span class="pp-rank">${idx + 1}</span>
          <span class="pp-emoji">${emoji}</span>
          <div class="pp-info">
            <span class="pp-title">${title}</span>
            <span class="pp-cat">${categoryLabel[cat] || cat}</span>
          </div>
          <span class="pp-count">${cnt}회</span>
        </div>`;
    }).join("");
  } catch {
    clearTimeout(timeout);
    renderPopularFallback(el);
  }
}

function renderPopularFallback(el) {
  // 실 데이터가 쌓이기 전 임시 인기픽 (data.js 기반 고정 추천)
  const fallback = [
    { cat: "movie",  title: "인터스텔라",       cnt: 38 },
    { cat: "drama",  title: "이상한 변호사 우영우", cnt: 31 },
    { cat: "anime",  title: "귀멸의 칼날",       cnt: 27 },
    { cat: "game",   title: "스텔라 블레이드",    cnt: 22 },
    { cat: "book",   title: "아몬드",            cnt: 19 },
  ];
  el.innerHTML = fallback.map(({ cat, title, cnt }, idx) => {
    const item = recommendations[cat]?.find(i => i.title === title);
    const emoji = item ? item.emoji : categoryEmoji[cat];
    return `
      <div class="pp-item" onclick="window.location.href='detail.html?category=${cat}&title=${encodeURIComponent(title)}'">
        <span class="pp-rank">${idx + 1}</span>
        <span class="pp-emoji">${emoji}</span>
        <div class="pp-info">
          <span class="pp-title">${title}</span>
          <span class="pp-cat">${categoryLabel[cat]}</span>
        </div>
        <span class="pp-count">${cnt}회</span>
      </div>`;
  }).join("") + `<p style="font-size:0.72rem;color:var(--text-muted);text-align:center;margin-top:10px;opacity:0.6">실시간 데이터 집계 중...</p>`;
}

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
document.addEventListener("click", function (e) {
  const nav = document.getElementById("mainNav");
  const hamburger = document.getElementById("hamburger");
  if (nav && nav.classList.contains("open") && !nav.contains(e.target) && e.target !== hamburger) {
    nav.classList.remove("open");
  }
});

// ===== 뱃지 정의 =====
const badgeDefs = [
  { id: "first",    icon: "🎲", name: "첫 번째 픽",   desc: "첫 추천을 뽑았어요!",          cond: s => s.total >= 1 },
  { id: "ten",      icon: "🎯", name: "10번의 도전",   desc: "10번 추천을 뽑았어요!",         cond: s => s.total >= 10 },
  { id: "fifty",    icon: "🌟", name: "50번의 탐험",   desc: "50번 추천을 뽑았어요!",         cond: s => s.total >= 50 },
  { id: "hundred",  icon: "🏆", name: "픽 마스터",     desc: "100번 추천을 뽑았어요!",        cond: s => s.total >= 100 },
  { id: "allcat",   icon: "🌈", name: "장르 탐험가",   desc: "모든 카테고리를 경험했어요!",   cond: s => s.movie >= 1 && s.drama >= 1 && s.anime >= 1 && s.book >= 1 && s.game >= 1 },
  { id: "animefan", icon: "✨", name: "애니 덕후",     desc: "애니를 10번 추천받았어요!",     cond: s => s.anime >= 10 },
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
    movie: stats.movie, drama: stats.drama, anime: stats.anime || 0, book: stats.book, game: stats.game,
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
  el.innerHTML = `<div class="badge-chips">` + badgeDefs.map(b => {
    const earned = earnedBadges.includes(b.id);
    return `<span class="badge-chip ${earned ? "earned" : "locked"}" onclick="showBadgeInfo('${b.id}')">${earned ? b.icon : "🔒"}</span>`;
  }).join("") + `</div>`;
}

function showBadgeInfo(id) {
  const badge = badgeDefs.find(b => b.id === id);
  if (!badge) return;
  const box = document.getElementById("badgeInfo");
  const earned = earnedBadges.includes(id);
  document.getElementById("badgeInfoIcon").textContent = earned ? badge.icon : "🔒";
  document.getElementById("badgeInfoName").textContent = earned ? badge.name : "미획득 뱃지";
  document.getElementById("badgeInfoDesc").textContent = earned ? badge.desc : `조건: ${badge.desc}`;
  box.style.display = "flex";
  box.className = "badge-info-box " + (earned ? "earned" : "locked");
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
  const catNames = { movie: "영화", drama: "드라마", anime: "애니", book: "책", game: "게임" };
  const tasteLabels = { movie: "영화 마니아 🎬", drama: "드라마 덕후 📺", anime: "애니 덕후 ✨", book: "독서광 📚", game: "게이머 🎮" };
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

// ===== 오늘의 운명 픽 =====
function fatePick() {
  const today = new Date().toDateString();
  const storageKey = `fatePick_${today}`;
  const existing = localStorage.getItem(storageKey);

  if (existing) {
    try {
      const saved = JSON.parse(existing);
      showFateModal(saved.item, saved.cat, true);
    } catch {
      localStorage.removeItem(storageKey);
      fatePick();
    }
    return;
  }

  // 오늘의 운명 픽 - 전체 풀에서 가중치 랜덤
  const categories = ["movie", "drama", "anime", "book", "game"];
  const cat = categories[Math.floor(Math.random() * categories.length)];
  const pool = [...recommendations[cat]];
  const item = weightedRandom(pool);

  localStorage.setItem(storageKey, JSON.stringify({ item, cat }));
  showFateModal(item, cat, false);
}

function showFateModal(item, cat, isExisting) {
  const modal = document.getElementById("fateModal");
  if (!modal) return;

  document.getElementById("fateEmoji").textContent = item.emoji;
  document.getElementById("fateTitle").textContent = item.title;
  document.getElementById("fateMeta").textContent = `${categoryLabel[cat]} · ${item.year} · ⭐ ${item.rating}`;
  document.getElementById("fateDesc").textContent = item.desc;
  document.getElementById("fateMessage").textContent = isExisting
    ? "오늘의 운명 픽은 이미 정해졌어요!"
    : "오늘 하루 당신을 위한 운명의 픽!";

  const ottEl = document.getElementById("fateOTT");
  if (ottEl) ottEl.innerHTML = getOTTButtons(item);

  const reason = getRecommendReason(item);
  const reasonEl = document.getElementById("fateReason");
  if (reasonEl) reasonEl.textContent = `${reason.icon} ${reason.text}`;

  modal.style.display = "flex";
}

function closeFateModal() {
  const modal = document.getElementById("fateModal");
  if (modal) modal.style.display = "none";
}

// ===== 이미지 카드 공유 =====
async function loadHtml2Canvas() {
  if (window.html2canvas) return;
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function shareImage() {
  if (!lastItem) { alert("먼저 추천을 뽑아보세요!"); return; }
  await loadHtml2Canvas();

  const cat = document.getElementById("recCard").dataset.category || "movie";
  const reason = getRecommendReason(lastItem);

  // 공유 카드 요소 채우기
  const el = document.getElementById("shareCardEl");
  if (!el) return;

  document.getElementById("sc-emoji").textContent = lastItem.emoji;
  document.getElementById("sc-badge").textContent = `${categoryEmoji[cat]} ${categoryLabel[cat]}`;
  document.getElementById("sc-title").textContent = lastItem.title;
  document.getElementById("sc-meta").textContent = `${lastItem.year} · ⭐ ${lastItem.rating}`;
  document.getElementById("sc-reason").textContent = `${reason.icon} ${reason.text}`;
  document.getElementById("sc-desc").textContent = lastItem.desc.slice(0, 80) + "...";

  el.style.visibility = "visible";
  el.style.position = "fixed";
  el.style.left = "-9999px";
  el.style.top = "0";

  try {
    const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: null });
    el.style.visibility = "hidden";

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], "today-pick.png", { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "오늘의 픽", text: `🎲 ${lastItem.title}` });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "today-pick.png";
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    });
  } catch {
    el.style.visibility = "hidden";
    alert("이미지 생성에 실패했습니다.");
  }
}

// ===== 핵심: 뽑기 함수 (슬롯 애니메이션 + 가중치 랜덤) =====
function pickRandom() {
  if (isAnimating) return;
  isAnimating = true;

  const pickBtn = document.getElementById("pickBtn");
  if (pickBtn) pickBtn.disabled = true;

  const card = document.getElementById("recCard");
  const categories = ["movie", "drama", "anime", "book", "game"];

  // 슬롯 애니메이션 시작
  card.classList.add("slot-spinning");
  document.getElementById("cardBadge").textContent = "";
  document.getElementById("cardPoster").textContent = "🎲";
  document.getElementById("cardTitle").innerHTML = `<span class="skeleton skeleton-title"></span>`;
  document.getElementById("cardMeta").innerHTML = `<span class="skeleton skeleton-meta"></span>`;
  document.getElementById("cardDesc").innerHTML = `
    <span class="skeleton skeleton-line"></span>
    <span class="skeleton skeleton-line"></span>
    <span class="skeleton skeleton-line short"></span>`;
  document.getElementById("cardTags").innerHTML = "";

  const reasonEl = document.getElementById("cardReason");
  if (reasonEl) reasonEl.innerHTML = "";
  const ottEl = document.getElementById("cardOTT");
  if (ottEl) ottEl.innerHTML = "";

  let frame = 0;
  const totalFrames = 10;
  const interval = setInterval(() => {
    frame++;
    const fakeCat = categories[Math.floor(Math.random() * categories.length)];
    const fakePool = recommendations[fakeCat] || [];
    if (fakePool.length > 0) {
      const fakeItem = fakePool[Math.floor(Math.random() * fakePool.length)];
      document.getElementById("cardPoster").textContent = fakeItem.emoji;
      document.getElementById("cardTitle").textContent = fakeItem.title;
    }
    if (frame >= totalFrames) {
      clearInterval(interval);
      try {
        revealPick(card, categories);
      } catch (e) {
        console.error("revealPick error:", e);
        card.classList.remove("slot-spinning");
        document.getElementById("cardTitle").textContent = "다시 시도해주세요";
        document.getElementById("cardDesc").textContent = "";
      } finally {
        isAnimating = false;
        const pickBtn = document.getElementById("pickBtn");
        if (pickBtn) pickBtn.disabled = false;
      }
    }
  }, 70);
}

function revealPick(card, categories) {
  let cat, item;
  let isForced = false;

  if (forcedNextPick) {
    cat = forcedNextPick.cat;
    item = forcedNextPick.item;
    forcedNextPick = null;
    isForced = true;
  } else {
    cat = currentCategory === "all"
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

    // 세션 중복 제외 (다 뽑으면 초기화)
    if (!seenItems[cat]) seenItems[cat] = new Set();
    let filtered = pool.filter(i => !seenItems[cat].has(i.title));
    if (filtered.length === 0) {
      seenItems[cat].clear(); // 전부 뽑았으면 초기화
      filtered = pool;
    }

    // 가중치 랜덤 선택
    item = weightedRandom(filtered);
  }

  lastItem = item;
  if (!isForced) {
    if (!seenItems[cat]) seenItems[cat] = new Set();
    seenItems[cat].add(item.title);
  }

  // 카드 업데이트
  card.classList.remove("slot-spinning");
  card.classList.remove("animate");
  void card.offsetWidth;
  card.classList.add("animate");

  document.getElementById("cardBadge").textContent = `${categoryEmoji[cat]} ${categoryLabel[cat]}`;
  document.getElementById("cardBadge").className = `card-badge ${cat}`;
  document.getElementById("cardTitle").textContent = item.title;

  // 추천 이유
  const reason = getRecommendReason(item);
  const reasonEl = document.getElementById("cardReason");
  if (reasonEl) reasonEl.innerHTML = `<span class="reason-icon">${reason.icon}</span> ${reason.text}`;

  // OTT 버튼
  const ottEl = document.getElementById("cardOTT");
  if (ottEl) ottEl.innerHTML = getOTTButtons(item);

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
      const searchTitle = item.enTitle || item.title;
      if (cat === "movie" || cat === "drama") {
        imageUrl = item.tmdbId
          ? await fetchTMDBById(item.tmdbId, cat === "drama" ? "tv" : "movie") || ""
          : await fetchTMDBPoster(searchTitle, cat) || (item.enTitle ? await fetchTMDBPoster(item.title, cat) : "") || "";
      } else if (cat === "anime") {
        imageUrl = item.tmdbId
          ? await fetchTMDBById(item.tmdbId, item.tmdbType || "tv") || ""
          : await fetchTMDBPoster(searchTitle, "drama") || await fetchTMDBPoster(searchTitle, "movie") || "";
      } else if (cat === "book") {
        imageUrl = await fetchBookCover(searchTitle) || (item.enTitle ? await fetchBookCover(item.title) : "") || "";
      } else if (cat === "game") {
        imageUrl = item.steamId
          ? `https://cdn.cloudflare.steamstatic.com/steam/apps/${item.steamId}/library_600x900.jpg`
          : await fetchRAWGCover(searchTitle) || "";
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
    `<span>📅 ${item.year}</span><span>🎭 ${item.genre}</span><span>⭐ ${item.rating}</span>`;
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

  // Supabase 기록
  recordPick(cat, item.title);
  setTimeout(loadTodayCounter, 500);
}

// ===== 통계 업데이트 =====
function updateStats() {
  const total = Object.values(stats).reduce((a, b) => a + b, 0);
  document.getElementById("totalCount").textContent = total;
  document.getElementById("movieCount").textContent = stats.movie;
  document.getElementById("dramaCount").textContent = stats.drama;
  document.getElementById("animeCount").textContent = stats.anime || 0;
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
  const cat = document.getElementById("recCard").dataset.category || "movie";
  const shareUrl = `https://today-pick.vercel.app/?category=${cat}&title=${encodeURIComponent(lastItem.title)}`;
  if (navigator.share) {
    navigator.share({ title: `오늘의 픽: ${lastItem.title}`, text: lastItem.desc.slice(0, 100), url: shareUrl });
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(shareUrl).then(() => alert("링크가 클립보드에 복사되었습니다!"));
  } else {
    alert(shareUrl);
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
  if (typeof quotes === "undefined" || !quotes.length) return;
  const q = quotes[Math.floor(Math.random() * quotes.length)];
  const textEl = document.getElementById("quoteText");
  const authorEl = document.getElementById("quoteAuthor");
  if (textEl) textEl.textContent = `"${q.text}"`;
  if (authorEl) authorEl.textContent = q.author;
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

// ===== 사이드바 탭 =====
document.querySelectorAll(".stab").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".stab").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".stab-content").forEach(c => c.style.display = "none");
    btn.classList.add("active");
    document.getElementById("stab-" + btn.dataset.stab).style.display = "block";
  });
});

// ===== 초기화 =====
initQuote();
updateStats();
updateFavorites();
updateBadgeWidget();
updateTrending();
updateTasteAnalysis();
loadTodayCounter();
loadPopularPicks();

// URL 파라미터로 특정 작품 지정 시 해당 작품, 없으면 랜덤
(function () {
  const params = new URLSearchParams(window.location.search);
  const paramCat = params.get("category");
  const paramTitle = params.get("title");
  if (paramCat && paramTitle && recommendations[paramCat]) {
    const decodedTitle = decodeURIComponent(paramTitle);
    const found = recommendations[paramCat].find(i => i.title === decodedTitle);
    if (found) {
      currentCategory = paramCat;
      document.querySelectorAll(".tab").forEach(t => {
        t.classList.toggle("active", t.dataset.category === paramCat);
      });
      forcedNextPick = { cat: paramCat, item: found };
      setTimeout(() => pickRandom(), 400);
      return;
    }
  }
  setTimeout(() => pickRandom(), 400);
})();
