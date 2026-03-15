let currentCategory = "all";
let history = [];
let stats = { movie: 0, drama: 0, book: 0, game: 0 };
let lastItem = null;

const categoryEmoji = { movie: "🎬", drama: "📺", book: "📚", game: "🎮" };
const categoryLabel = { movie: "영화", drama: "드라마", book: "책", game: "게임" };

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
    document.getElementById("cardPoster").textContent = item.emoji;
    document.getElementById("cardTitle").textContent = item.title;
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

// 초기화
initQuote();
