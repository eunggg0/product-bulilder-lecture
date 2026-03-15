const categoryEmoji = { movie: "🎬", drama: "📺", book: "📚", game: "🎮" };
const categoryLabel = { movie: "영화", drama: "드라마", book: "책", game: "게임" };

// 다크모드
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

// URL 파라미터 파싱
const params = new URLSearchParams(window.location.search);
const category = params.get("category");
const titleParam = decodeURIComponent(params.get("title") || "");

const container = document.getElementById("detailContainer");

const item = recommendations[category]?.find(i => i.title === titleParam);

if (!item) {
  container.innerHTML = `
    <div class="not-found">
      <h2>항목을 찾을 수 없어요 😢</h2>
      <p>잘못된 주소이거나 삭제된 항목입니다.</p>
      <br>
      <a href="index.html" class="btn-pick" style="display:inline-block;padding:14px 32px;border-radius:50px;background:linear-gradient(135deg,#6c63ff,#ff6584);color:#fff;font-weight:800;text-decoration:none;">홈으로 돌아가기</a>
    </div>
  `;
} else {
  // 메타 태그 업데이트
  const desc = `${item.title} (${item.year}) · ${item.genre} · ⭐${item.rating} | ${item.desc.slice(0, 80)}...`;
  const url = `https://today-pick.vercel.app/detail.html?category=${category}&title=${encodeURIComponent(item.title)}`;
  document.title = `${item.title} - 오늘의 픽`;
  setMeta("description", desc);
  setMeta("og:title", `${item.title} - 오늘의 픽`);
  setMeta("og:description", desc);
  setMeta("og:url", url);
  setMeta("twitter:title", `${item.title} - 오늘의 픽`);
  setMeta("twitter:description", desc);

  // 태그 렌더링
  const tagsHTML = item.tags.map(t => `<span class="tag">#${t}</span>`).join("");

  // 관련 추천 3개
  const related = recommendations[category]
    .filter(i => i.title !== item.title)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);

  const relatedHTML = related.map(r => `
    <div class="related-card" onclick="goToDetail('${category}', '${encodeURIComponent(r.title)}')">
      <div class="r-emoji">${r.emoji}</div>
      <div class="r-title">${r.title}</div>
      <div class="r-meta">${r.year} · ⭐${r.rating}</div>
    </div>
  `).join("");

  container.innerHTML = `
    <div class="detail-hero">
      <div class="detail-poster">${item.emoji}</div>
      <div class="detail-header">
        <span class="card-badge ${category}">${categoryEmoji[category]} ${categoryLabel[category]}</span>
        <h1>${item.title}</h1>
        <div class="card-meta">
          <span>📅 ${item.year}</span>
          <span>🎭 ${item.genre}</span>
          <span>⭐ ${item.rating}</span>
          <span>📍 ${item.where}</span>
        </div>
        <div class="card-tags" style="margin-top:12px">${tagsHTML}</div>
      </div>
    </div>

    <div class="ad-container ad-middle">
      <div class="ad-placeholder"><span>광고</span></div>
    </div>

    <div class="detail-body">
      <h2>작품 소개</h2>
      <p>${item.desc}</p>
      <div class="detail-platform">
        <h3>📍 어디서 볼 수 있나요?</h3>
        <p>${item.where}</p>
      </div>
      <div class="detail-actions">
        <button class="btn-pick" style="flex:1" onclick="shareDetail()">📤 공유하기</button>
        <button class="btn-share" onclick="window.location.href='index.html'">🎲 다른 추천 받기</button>
      </div>
    </div>

    <div class="related-section">
      <h2>같은 카테고리의 다른 추천</h2>
      <div class="related-list">${relatedHTML}</div>
    </div>
  `;
}

function goToDetail(cat, encodedTitle) {
  window.location.href = `detail.html?category=${cat}&title=${encodedTitle}`;
}

function shareDetail() {
  const text = `🎲 오늘의 픽 추천: ${item?.title}\n${item?.desc}\n\nhttps://today-pick.vercel.app`;
  if (navigator.share) {
    navigator.share({ title: "오늘의 픽", text });
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => alert("클립보드에 복사되었습니다!"));
  }
}

function setMeta(nameOrProperty, content) {
  let el = document.querySelector(`meta[property="${nameOrProperty}"]`)
        || document.querySelector(`meta[name="${nameOrProperty}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(nameOrProperty.startsWith("og:") || nameOrProperty.startsWith("twitter:") ? "property" : "name", nameOrProperty);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}
