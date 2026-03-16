const categoryEmoji = { movie: "🎬", drama: "📺", book: "📚", game: "🎮" };
const categoryLabel = { movie: "영화", drama: "드라마", book: "책", game: "게임" };

const TMDB_KEY = "8ba8660b9e102dda5f80238ffba806e8";
const RAWG_KEY = "9aea44926c9e4d56a77b7369cc2f8186";

// 햄버거 메뉴
function toggleMenu() {
  document.getElementById("mainNav")?.classList.toggle("open");
}

// 즐겨찾기 (상세 페이지)
let favorites = JSON.parse(localStorage.getItem("favorites") || "[]");

function toggleFavoriteDetail() {
  const key = `${category}_${item.title}`;
  const idx = favorites.findIndex(f => f.key === key);
  const btn = document.getElementById("favBtnDetail");
  if (idx === -1) {
    favorites.unshift({ key, cat: category, title: item.title, emoji: item.emoji, year: item.year, rating: item.rating });
    if (btn) btn.textContent = "❤️ 즐겨찾기";
  } else {
    favorites.splice(idx, 1);
    if (btn) btn.textContent = "🤍 즐겨찾기";
  }
  localStorage.setItem("favorites", JSON.stringify(favorites));
}

// 포스터 이미지 로딩
async function loadDetailPoster() {
  let imageUrl = "";
  if (category === "movie" || category === "drama") {
    const endpoint = category === "drama" ? "tv" : "movie";
    try {
      const res = await fetch(`https://api.themoviedb.org/3/search/${endpoint}?api_key=${TMDB_KEY}&language=ko-KR&query=${encodeURIComponent(item.title)}`);
      const data = await res.json();
      const poster = data.results?.[0]?.poster_path;
      imageUrl = poster ? `https://image.tmdb.org/t/p/w300${poster}` : "";
    } catch {}
  } else if (category === "book") {
    try {
      const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=intitle:${encodeURIComponent(item.title)}&maxResults=1`);
      const data = await res.json();
      const img = data.items?.[0]?.volumeInfo?.imageLinks?.thumbnail;
      imageUrl = img ? img.replace("zoom=1", "zoom=3").replace("http://", "https://") : "";
    } catch {}
  } else if (category === "game") {
    if (item.steamId) {
      imageUrl = `https://cdn.cloudflare.steamstatic.com/steam/apps/${item.steamId}/library_600x900.jpg`;
    } else {
      try {
        const res = await fetch(`https://api.rawg.io/api/games?search=${encodeURIComponent(item.title)}&key=${RAWG_KEY}&page_size=1`);
        const data = await res.json();
        imageUrl = data.results?.[0]?.background_image || "";
      } catch {}
    }
  }
  if (imageUrl) {
    const imgEl = document.getElementById("detailPosterImg");
    const emojiEl = document.getElementById("detailPosterEmoji");
    if (imgEl) {
      imgEl.src = imageUrl;
      imgEl.style.display = "block";
      if (emojiEl) emojiEl.style.display = "none";
    }
  }
}

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

  // 관련 추천 3개 (태그 기반 유사도 정렬)
  const related = recommendations[category]
    .filter(i => i.title !== item.title)
    .map(i => ({
      ...i,
      score: i.tags.filter(t => item.tags.includes(t)).length * 2 +
             (i.genre.split("/").some(g => item.genre.includes(g)) ? 2 : 0) +
             Math.random() * 0.5
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const relatedHTML = related.map(r => `
    <div class="related-card" onclick="goToDetail('${category}', '${encodeURIComponent(r.title)}')">
      <div class="r-emoji">${r.emoji}</div>
      <div class="r-title">${r.title}</div>
      <div class="r-meta">${r.year} · ⭐${r.rating}</div>
    </div>
  `).join("");

  const isFav = favorites.some(f => f.key === `${category}_${item.title}`);

  container.innerHTML = `
    <div class="detail-hero">
      <div class="detail-poster" id="detailPosterWrap">
        <img id="detailPosterImg" src="" alt="${item.title}"
          onerror="this.style.display='none';document.getElementById('detailPosterEmoji').style.display='block'"
          style="display:none;width:180px;height:270px;object-fit:cover;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.2)">
        <span id="detailPosterEmoji" style="font-size:6rem;line-height:1.2">${item.emoji}</span>
      </div>
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
        <button class="btn-kakao" onclick="kakaoShareDetail()">💬 카카오 공유</button>
        <button class="btn-twitter" onclick="twitterShareDetail()">🐦 X 공유</button>
        <button id="favBtnDetail" class="btn-share" onclick="toggleFavoriteDetail()">${isFav ? "❤️" : "🤍"} 즐겨찾기</button>
        <button class="btn-share" onclick="window.location.href='index.html'">🎲 다른 추천 받기</button>
      </div>
    </div>

    <div class="related-section">
      <h2>같은 카테고리의 다른 추천</h2>
      <div class="related-list">${relatedHTML}</div>
    </div>
  `;
}

// JSON-LD 구조화 데이터 동적 생성
if (item) {
  const schemaTypeMap = { movie: "Movie", drama: "TVSeries", book: "Book", game: "VideoGame" };
  const schema = {
    "@context": "https://schema.org",
    "@type": schemaTypeMap[category] || "CreativeWork",
    "name": item.title,
    "description": item.desc,
    "datePublished": item.year,
    "genre": item.genre,
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": item.rating,
      "bestRating": "10",
      "ratingCount": "100"
    }
  };
  const ldScript = document.createElement("script");
  ldScript.type = "application/ld+json";
  ldScript.textContent = JSON.stringify(schema);
  document.head.appendChild(ldScript);
}

// 포스터 로딩 시작
if (item) loadDetailPoster();

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

function twitterShareDetail() {
  const url = `https://today-pick.vercel.app/detail.html?category=${category}&title=${encodeURIComponent(item.title)}`;
  const text = `🎲 오늘의 픽 추천: ${item.title}\n${item.desc.slice(0, 60)}...\n\n#오늘의픽 #랜덤추천`;
  window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, "_blank");
}

function kakaoShareDetail() {
  if (!window.Kakao || !Kakao.isInitialized()) {
    alert("카카오 SDK를 불러오는 중입니다. 잠시 후 다시 시도해주세요.");
    return;
  }
  const url = `https://today-pick.vercel.app/detail.html?category=${category}&title=${encodeURIComponent(item.title)}`;
  Kakao.Share.sendDefault({
    objectType: "feed",
    content: {
      title: `🎲 오늘의 픽: ${item.title}`,
      description: item.desc.slice(0, 100) + "...",
      imageUrl: "https://today-pick.vercel.app/og-image.svg",
      link: { mobileWebUrl: url, webUrl: url },
    },
    buttons: [{ title: "자세히 보기", link: { mobileWebUrl: url, webUrl: url } }],
  });
}

// 카카오 SDK 초기화
if (window.Kakao && !Kakao.isInitialized()) {
  Kakao.init("ee0415e0ce4c37653f918097c9f151e6");
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
