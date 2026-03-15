const TMDB_KEY = "8ba8660b9e102dda5f80238ffba806e8";
const TMDB_IMG = "https://image.tmdb.org/t/p/w300";
const RAWG_KEY = "9aea44926c9e4d56a77b7369cc2f8186";

// 즐겨찾기
let favorites = JSON.parse(localStorage.getItem("favorites") || "[]");

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

// 햄버거 메뉴
function toggleMenu() {
  document.getElementById("mainNav").classList.toggle("open");
}

let currentCategory = "all";
let history = [];
let stats = { movie: 0, drama: 0, book: 0, game: 0 };
let lastItem = null;

const categoryEmoji = { movie: "🎬", drama: "📺", book: "📚", game: "🎮" };
const categoryLabel = { movie: "영화", drama: "드라마", book: "책", game: "게임" };

// TMDB 포스터 가져오기
async function fetchTMDBPoster(title, type) {
  const endpoint = type === "drama" ? "tv" : "movie";
  const url = `https://api.themoviedb.org/3/search/${endpoint}?api_key=${TMDB_KEY}&language=ko-KR&query=${encodeURIComponent(title)}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    const result = data.results?.[0];
    return result?.poster_path ? `${TMDB_IMG}${result.poster_path}` : null;
  } catch {
    return null;
  }
}

// RAWG 게임 커버 가져오기 (Steam 없는 게임용)
async function fetchRAWGCover(title) {
  try {
    const url = `https://api.rawg.io/api/games?search=${encodeURIComponent(title)}&key=${RAWG_KEY}&page_size=1`;
    const res = await fetch(url);
    const data = await res.json();
    return data.results?.[0]?.background_image || "";
  } catch {
    return "";
  }
}

// 책 표지 가져오기 (Google Books API - 키 불필요)
async function fetchBookCover(title) {
  try {
    const url = `https://www.googleapis.com/books/v1/volumes?q=intitle:${encodeURIComponent(title)}&maxResults=1`;
    const res = await fetch(url);
    const data = await res.json();
    const img = data.items?.[0]?.volumeInfo?.imageLinks?.thumbnail;
    if (!img) return "";
    // 고화질로 업그레이드
    return img.replace("zoom=1", "zoom=3").replace("http://", "https://");
  } catch {
    return "";
  }
}

// 포스터 캐시
const posterCache = {};

// 탭 이벤트
document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    currentCategory = tab.dataset.category;
  });
});

function pickRandom() {
  const card = document.getElementById("recCard");

  // 스켈레톤 로딩 시작
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
    // 카테고리 결정
    const categories = ["movie", "drama", "book", "game"];
    let cat = currentCategory === "all"
      ? categories[Math.floor(Math.random() * categories.length)]
      : currentCategory;

    const pool = recommendations[cat];

    // 직전 항목 제외
    let filtered = pool.filter(item => !lastItem || item.title !== lastItem.title);
    if (filtered.length === 0) filtered = pool;

    const item = filtered[Math.floor(Math.random() * filtered.length)];
    lastItem = item;

    // 스켈레톤 해제 + 카드 업데이트
    card.classList.remove("loading");
    card.classList.remove("animate");
    void card.offsetWidth;
    card.classList.add("animate");

    document.getElementById("cardBadge").textContent = `${categoryEmoji[cat]} ${categoryLabel[cat]}`;
    document.getElementById("cardBadge").className = `card-badge ${cat}`;
    document.getElementById("cardTitle").textContent = item.title;

    // 포스터 이미지 처리
    const imgEl = document.getElementById("cardImg");
    const emojiEl = document.getElementById("cardPoster");
    emojiEl.textContent = item.emoji;
    imgEl.style.display = "none";
    emojiEl.style.display = "block";

    // 포스터 불러오기 (비동기)
    const cacheKey = `${cat}_${item.title}`;
    const loadPoster = async () => {
      let imageUrl = posterCache[cacheKey];

      if (imageUrl === undefined) {
        if (cat === "movie" || cat === "drama") {
          imageUrl = await fetchTMDBPoster(item.title, cat) || "";
        } else if (cat === "book") {
          imageUrl = await fetchBookCover(item.title);
        } else if (cat === "game") {
          if (item.steamId) {
            imageUrl = `https://cdn.cloudflare.steamstatic.com/steam/apps/${item.steamId}/library_600x900.jpg`;
          } else {
            imageUrl = await fetchRAWGCover(item.title) || "";
          }
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
    };
    loadPoster();
    document.getElementById("cardMeta").innerHTML =
      `<span>📅 ${item.year}</span><span>🎭 ${item.genre}</span><span>⭐ ${item.rating}</span><span>📍 ${item.where}</span>`;
    document.getElementById("cardDesc").textContent = item.desc;

    const tagsEl = document.getElementById("cardTags");
    tagsEl.innerHTML = item.tags.map(t => `<span class="tag">#${t}</span>`).join("");

    // 통계 업데이트
    stats[cat]++;
    updateStats();

    // 히스토리 추가
    history.unshift({ ...item, cat });
    if (history.length > 5) history.pop();
    updateHistory();

    // 카드 클릭 → 상세 페이지
    card.style.cursor = "pointer";
    card.dataset.category = cat;
    card.dataset.title = item.title;

    // 즐겨찾기 버튼 상태 업데이트
    const isFav = favorites.some(f => f.key === `${cat}_${item.title}`);
    document.getElementById("favBtn").textContent = isFav ? "❤️" : "🤍";
  }, 600);
}

function updateStats() {
  const total = Object.values(stats).reduce((a, b) => a + b, 0);
  document.getElementById("totalCount").textContent = total;
  document.getElementById("movieCount").textContent = stats.movie;
  document.getElementById("dramaCount").textContent = stats.drama;
  document.getElementById("bookCount").textContent = stats.book;
  document.getElementById("gameCount").textContent = stats.game;
}

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

// 추천 카드 클릭 이벤트
document.getElementById("recCard").addEventListener("click", function () {
  const cat = this.dataset.category;
  const title = this.dataset.title;
  if (cat && title) {
    window.location.href = `detail.html?category=${cat}&title=${encodeURIComponent(title)}`;
  }
});

function shareRecommendation() {
  if (!lastItem) {
    alert("먼저 추천을 뽑아보세요!");
    return;
  }
  const text = `🎲 오늘의 픽 추천: ${lastItem.title}\n${lastItem.desc}\n\n오늘의 픽에서 확인하세요!`;
  if (navigator.share) {
    navigator.share({ title: "오늘의 픽", text });
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => alert("클립보드에 복사되었습니다!"));
  } else {
    alert(text);
  }
}

// 오늘의 명언 초기화
function initQuote() {
  const q = quotes[Math.floor(Math.random() * quotes.length)];
  document.getElementById("quoteText").textContent = `"${q.text}"`;
  document.getElementById("quoteAuthor").textContent = q.author;
}

// 다크모드
function toggleDark() {
  const isDark = document.body.classList.toggle("dark");
  document.getElementById("darkToggle").textContent = isDark ? "☀️" : "🌙";
  localStorage.setItem("darkMode", isDark ? "on" : "off");
}

// 다크모드 상태 복원 (저장값 없으면 시스템 설정 따라감)
const savedMode = localStorage.getItem("darkMode");
const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

if (savedMode === "on" || (savedMode === null && prefersDark)) {
  document.body.classList.add("dark");
  document.getElementById("darkToggle").textContent = "☀️";
}

// 시스템 다크모드 변경 감지 (수동 설정 없을 때만)
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", e => {
  if (localStorage.getItem("darkMode") === null) {
    document.body.classList.toggle("dark", e.matches);
    document.getElementById("darkToggle").textContent = e.matches ? "☀️" : "🌙";
  }
});

// 카카오 SDK 초기화
if (window.Kakao && !Kakao.isInitialized()) {
  Kakao.init("ee0415e0ce4c37653f918097c9f151e6");
}

function kakaoShare() {
  if (!lastItem) {
    alert("먼저 추천을 뽑아보세요!");
    return;
  }
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
      imageUrl: "https://today-pick.vercel.app/og-image.png",
      link: { mobileWebUrl: url, webUrl: url },
    },
    buttons: [{ title: "자세히 보기", link: { mobileWebUrl: url, webUrl: url } }],
  });
}

// 초기화
initQuote();
updateFavorites();
