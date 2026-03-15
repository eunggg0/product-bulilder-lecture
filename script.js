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

  // 카드 업데이트
  const card = document.getElementById("recCard");
  card.classList.remove("animate");
  void card.offsetWidth; // reflow
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
    <div class="history-item">
      <span class="h-emoji">${item.emoji}</span>
      <span class="h-title">${item.title}</span>
      <span class="h-badge ${item.cat}">${categoryLabel[item.cat]}</span>
    </div>
  `).join("");
}

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

// 다크모드 상태 복원
if (localStorage.getItem("darkMode") === "on") {
  document.body.classList.add("dark");
  document.getElementById("darkToggle").textContent = "☀️";
}

// 초기화
initQuote();
