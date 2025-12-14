// app.js - Updated with your Supabase credentials
const SUPABASE_URL = "https://fftxsxklrotgzturilhr.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmdHhzeGtscm90Z3p0dXJpbGhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzU1OTEsImV4cCI6MjA4MDcxMTU5MX0.YAI8OHdMMw7V0-KK59hHz9nFyGj37o63FMzqPr7YAJ0";

let supabase = null;

function initSupabase() {
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log("✅ Supabase initialized successfully");
  } else {
    console.warn("⚠️ Supabase credentials not configured");
  }
}

// Fetch articles from Supabase
async function fetchArticles(filters = {}) {
  try {
    let query = supabase
      .from("articles")
      .select(
        `
        *,
        category:categories(name, slug),
        article_tags(tag:tags(name))
      `
      )
      .eq("status", "published")
      .order("published_at", {ascending: false});

    // Apply filters
    if (filters.category) {
      const {data: category} = await supabase
        .from("categories")
        .select("id")
        .eq("slug", filters.category)
        .single();

      if (category) {
        query = query.eq("category_id", category.id);
      }
    }

    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    const {data, error} = await query;

    if (error) throw error;

    // Transform data to match existing format
    return data.map((article) => ({
      id: article.id,
      title: article.title,
      excerpt: article.excerpt,
      content: article.content,
      category: article.category?.slug || "uncategorized",
      author: article.author,
      image_url: article.image_url,
      published_at: article.published_at,
      tags:
        article.article_tags?.map((at) => at.tag?.name).filter(Boolean) || [],
    }));
  } catch (error) {
    console.error("❌ Error fetching articles:", error);
    return [];
  }
}

// Fetch single article by ID
async function fetchArticleById(id) {
  try {
    const {data, error} = await supabase
      .from("articles")
      .select(
        `
        *,
        category:categories(name, slug),
        article_tags(tag:tags(name))
      `
      )
      .eq("id", id)
      .eq("status", "published")
      .single();

    if (error) throw error;

    // Increment views
    await supabase
      .from("articles")
      .update({views: (data.views || 0) + 1})
      .eq("id", id);

    return {
      id: data.id,
      title: data.title,
      excerpt: data.excerpt,
      content: data.content,
      category: data.category?.slug || "uncategorized",
      author: data.author,
      image_url: data.image_url,
      published_at: data.published_at,
      tags: data.article_tags?.map((at) => at.tag?.name).filter(Boolean) || [],
    };
  } catch (error) {
    console.error("❌ Error fetching article:", error);
    return null;
  }
}

// Fetch categories
async function fetchCategories() {
  try {
    const {data, error} = await supabase
      .from("categories")
      .select("*")
      .order("name");

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("❌ Error fetching categories:", error);
    return [];
  }
}

// Search articles
async function searchArticles(query) {
  try {
    const {data, error} = await supabase
      .from("articles")
      .select(
        `
        *,
        category:categories(name, slug)
      `
      )
      .eq("status", "published")
      .or(
        `title.ilike.%${query}%,excerpt.ilike.%${query}%,content.ilike.%${query}%`
      )
      .order("published_at", {ascending: false})
      .limit(10);

    if (error) throw error;

    return data.map((article) => ({
      id: article.id,
      title: article.title,
      excerpt: article.excerpt,
      category: article.category?.slug || "uncategorized",
      author: article.author,
      image_url: article.image_url,
      published_at: article.published_at,
    }));
  } catch (error) {
    console.error("❌ Error searching articles:", error);
    return [];
  }
}

document.addEventListener("DOMContentLoaded", function () {
  initSupabase();
  hidePreloader();
  initTheme();
  initNavigation();
  initSearch();
  initBackToTop();
  updateDate();
  loadPageContent();
});

function hidePreloader() {
  const preloader = document.getElementById("preloader");
  if (preloader) {
    setTimeout(() => {
      preloader.classList.add("hidden");
    }, 300);
  }
}

function initTheme() {
  const themeToggle = document.getElementById("themeToggle");
  const savedTheme = localStorage.getItem("theme") || "light";

  document.documentElement.setAttribute("data-theme", savedTheme);

  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const currentTheme = document.documentElement.getAttribute("data-theme");
      const newTheme = currentTheme === "dark" ? "light" : "dark";

      document.documentElement.setAttribute("data-theme", newTheme);
      localStorage.setItem("theme", newTheme);
    });
  }
}

function initNavigation() {
  const menuToggle = document.getElementById("menuToggle");
  const navList = document.querySelector(".nav-list");

  if (menuToggle && navList) {
    menuToggle.addEventListener("click", () => {
      menuToggle.classList.toggle("active");
      navList.classList.toggle("active");
    });

    document.querySelectorAll(".nav-list a").forEach((link) => {
      link.addEventListener("click", () => {
        menuToggle.classList.remove("active");
        navList.classList.remove("active");
      });
    });
  }

  setActiveNavLink();
}

function setActiveNavLink() {
  const currentPage = window.location.pathname.split("/").pop() || "index.html";

  document.querySelectorAll(".nav-list a").forEach((link) => {
    link.classList.remove("active");
    const href = link.getAttribute("href");
    if (href === currentPage || (currentPage === "" && href === "index.html")) {
      link.classList.add("active");
    }
  });
}

function initSearch() {
  const searchToggle = document.getElementById("searchToggle");
  const searchModal = document.getElementById("searchModal");
  const searchClose = document.getElementById("searchClose");
  const searchInput = document.getElementById("searchInput");
  const searchBtn = document.getElementById("searchBtn");
  const searchResults = document.getElementById("searchResults");

  if (searchToggle && searchModal) {
    searchToggle.addEventListener("click", () => {
      searchModal.classList.add("active");
      searchInput?.focus();
    });

    searchClose?.addEventListener("click", () => {
      searchModal.classList.remove("active");
    });

    searchModal.addEventListener("click", (e) => {
      if (e.target === searchModal) {
        searchModal.classList.remove("active");
      }
    });

    searchBtn?.addEventListener("click", () =>
      performSearch(searchInput?.value)
    );

    searchInput?.addEventListener("keyup", (e) => {
      if (e.key === "Enter") {
        performSearch(searchInput.value);
      }
    });

    searchInput?.addEventListener(
      "input",
      debounce(async (e) => {
        if (e.target.value.length >= 2) {
          await performSearch(e.target.value);
        } else {
          searchResults.innerHTML = "";
        }
      }, 300)
    );
  }
}

async function performSearch(query) {
  const searchResults = document.getElementById("searchResults");
  if (!query || !searchResults) return;

  searchResults.innerHTML =
    '<div class="search-result-item"><p>Searching...</p></div>';

  const results = await searchArticles(query);

  if (results.length === 0) {
    searchResults.innerHTML =
      '<div class="search-result-item"><p>No articles found matching your search.</p></div>';
    return;
  }

  searchResults.innerHTML = results
    .map(
      (article) => `
        <div class="search-result-item" onclick="goToArticle(${article.id})">
            <h4>${article.title}</h4>
            <p>${article.excerpt.substring(0, 100)}...</p>
            <span class="category-badge">${article.category}</span>
        </div>
    `
    )
    .join("");
}

function initBackToTop() {
  const backToTop = document.getElementById("backToTop");

  if (backToTop) {
    window.addEventListener("scroll", () => {
      if (window.scrollY > 300) {
        backToTop.classList.add("visible");
      } else {
        backToTop.classList.remove("visible");
      }
    });

    backToTop.addEventListener("click", () => {
      window.scrollTo({top: 0, behavior: "smooth"});
    });
  }
}

function updateDate() {
  const dateDisplay = document.getElementById("currentDate");
  if (dateDisplay) {
    const options = {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    };
    dateDisplay.textContent = new Date().toLocaleDateString("en-NG", options);
  }
}

async function loadPageContent() {
  const currentPage = window.location.pathname.split("/").pop() || "index.html";

  switch (currentPage) {
    case "index.html":
    case "":
      await loadHomePage();
      break;
    case "politics.html":
      await loadCategoryPage("politics");
      break;
    case "business.html":
      await loadCategoryPage("business");
      break;
    case "tech.html":
      await loadCategoryPage("tech");
      break;
    case "entertainment.html":
      await loadCategoryPage("entertainment");
      break;
    case "crypto.html":
      await loadCategoryPage("crypto");
      break;
    case "article.html":
      await loadArticlePage();
      break;
  }

  await loadTicker();
}

async function loadHomePage() {
  await loadHeroSection();
  await loadLatestNews();
  await loadCategoryNews("politics", "politicsNews");
  await loadCategoryNews("tech", "techNews");
  await loadCategoryNews("entertainment", "entertainmentNews");
  await loadTrendingSection();
  await loadCategoryList();
}

async function loadHeroSection() {
  const heroSection = document.getElementById("heroSection");
  if (!heroSection) return;

  const heroArticles = await fetchArticles({limit: 3});

  if (heroArticles.length === 0) {
    heroSection.innerHTML =
      '<div class="empty-state"><p>No articles available yet. Check back soon!</p></div>';
    return;
  }

  heroSection.innerHTML = `
    <div class="hero-grid">
      <article class="hero-main" onclick="goToArticle(${heroArticles[0].id})">
        <img src="${heroArticles[0].image_url}" alt="${
    heroArticles[0].title
  }" loading="lazy">
        <div class="hero-overlay">
          <span class="category-badge">${heroArticles[0].category}</span>
          <h1 class="hero-title">${heroArticles[0].title}</h1>
          <div class="article-meta">
            <span>By ${heroArticles[0].author}</span>
            <span>${formatDate(heroArticles[0].published_at)}</span>
          </div>
        </div>
      </article>
      <div class="hero-sidebar">
        ${heroArticles
          .slice(1, 3)
          .map(
            (article) => `
          <article class="hero-small" onclick="goToArticle(${article.id})">
            <img src="${article.image_url}" alt="${article.title}" loading="lazy">
            <div class="hero-overlay">
              <span class="category-badge">${article.category}</span>
              <h2 class="hero-title">${article.title}</h2>
            </div>
          </article>
        `
          )
          .join("")}
      </div>
    </div>
  `;
}

async function loadLatestNews() {
  const latestNews = document.getElementById("latestNews");
  if (!latestNews) return;

  const articles = await fetchArticles({limit: 6});

  if (articles.length === 0) {
    latestNews.innerHTML =
      '<div class="empty-state"><p>No articles available yet.</p></div>';
    return;
  }

  latestNews.innerHTML = articles
    .map((article) => createNewsCard(article))
    .join("");
}

async function loadCategoryNews(category, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const articles = await fetchArticles({category, limit: 3});

  if (articles.length === 0) {
    container.innerHTML =
      '<div class="empty-state"><p>No articles in this category yet.</p></div>';
    return;
  }

  container.innerHTML = articles
    .map((article) => createNewsCard(article))
    .join("");
}

async function loadCategoryPage(category) {
  const newsGrid = document.querySelector(".news-grid");
  if (!newsGrid) return;

  const articles = await fetchArticles({category});

  if (articles.length === 0) {
    newsGrid.innerHTML = `
      <div class="empty-state">
        <h3>No articles found</h3>
        <p>There are no articles in this category yet.</p>
      </div>
    `;
    return;
  }

  newsGrid.innerHTML = articles
    .map((article) => createNewsCard(article))
    .join("");

  await loadTrendingSection();
  await loadCategoryList();
}

async function loadArticlePage() {
  const urlParams = new URLSearchParams(window.location.search);
  const articleId = parseInt(urlParams.get("id"));

  const article = await fetchArticleById(articleId);

  if (!article) {
    document.querySelector("main .container").innerHTML = `
      <div class="empty-state">
        <h3>Article not found</h3>
        <p>The article you're looking for doesn't exist.</p>
        <a href="index.html" class="submit-btn" style="display: inline-block; margin-top: 20px;">Back to Home</a>
      </div>
    `;
    return;
  }

  const articleContainer = document.getElementById("articleContainer");
  if (articleContainer) {
    articleContainer.innerHTML = `
      <div class="breadcrumb">
        <a href="index.html">Home</a>
        <span>/</span>
        <a href="${article.category}.html">${
      article.category.charAt(0).toUpperCase() + article.category.slice(1)
    }</a>
        <span>/</span>
        <span>${article.title.substring(0, 30)}...</span>
      </div>
      
      <article class="article-page">
        <header class="article-header">
          <span class="category-badge">${article.category}</span>
          <h1>${article.title}</h1>
          <div class="article-meta">
            <span>By ${article.author}</span>
            <span>${formatDate(article.published_at)}</span>
            <span>5 min read</span>
          </div>
        </header>
        
        <img src="${article.image_url}" alt="${
      article.title
    }" class="article-image" loading="lazy">
        
        <div class="article-content">
          ${article.content}
          
          <div class="article-tags">
            <h4>Tags</h4>
            <div class="tags-list">
              ${article.tags
                .map((tag) => `<a href="#" class="tag">${tag}</a>`)
                .join("")}
            </div>
          </div>
          
          <div class="share-section">
            <span>Share this article:</span>
            <div class="share-buttons">
              <a href="#" class="share-btn facebook" aria-label="Share on Facebook">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              </a>
              <a href="#" class="share-btn twitter" aria-label="Share on Twitter">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              </a>
              <a href="#" class="share-btn whatsapp" aria-label="Share on WhatsApp">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              </a>
              <a href="#" class="share-btn linkedin" aria-label="Share on LinkedIn">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
              </a>
            </div>
          </div>
        </div>
      </article>
      
      <section class="related-articles">
        <div class="section-header">
          <h2 class="section-title">Related Articles</h2>
        </div>
        <div class="news-grid" id="relatedArticles"></div>
      </section>
    `;

    const related = await fetchArticles({category: article.category, limit: 4});
    const relatedContainer = document.getElementById("relatedArticles");
    if (relatedContainer) {
      relatedContainer.innerHTML = related
        .filter((a) => a.id !== article.id)
        .slice(0, 3)
        .map((a) => createNewsCard(a))
        .join("");
    }
  }
}

async function loadTrendingSection() {
  const trendingList = document.getElementById("trendingList");
  if (!trendingList) return;

  const trending = await fetchArticles({limit: 5});

  if (trending.length === 0) {
    trendingList.innerHTML = '<p style="padding: 15px;">No articles yet.</p>';
    return;
  }

  trendingList.innerHTML = trending
    .map(
      (article, index) => `
        <div class="trending-item" onclick="goToArticle(${article.id})">
            <span class="trending-number">0${index + 1}</span>
            <div class="trending-content">
                <h4 class="trending-title">${article.title}</h4>
                <span class="trending-meta">${formatDate(
                  article.published_at
                )}</span>
            </div>
        </div>
    `
    )
    .join("");
}

async function loadCategoryList() {
  const categoryList = document.getElementById("categoryList");
  if (!categoryList) return;

  const categories = await fetchCategories();

  if (categories.length === 0) {
    categoryList.innerHTML = "<p>No categories available.</p>";
    return;
  }

  // Count articles per category
  const categoryCounts = {};
  for (const cat of categories) {
    const articles = await fetchArticles({category: cat.slug});
    categoryCounts[cat.slug] = articles.length;
  }

  categoryList.innerHTML = categories
    .map((cat) => {
      const count = categoryCounts[cat.slug] || 0;
      return `
        <a href="${cat.slug}.html" class="category-item">
          ${cat.name} <span>(${count})</span>
        </a>
      `;
    })
    .join("");
}

async function loadTicker() {
  const tickerContent = document.getElementById("tickerContent");
  if (!tickerContent) return;

  const articles = await fetchArticles({limit: 5});

  if (articles.length === 0) {
    tickerContent.innerHTML =
      '<span class="ticker-item">Welcome to Creed Hub - Your trusted news source</span>';
    return;
  }

  const tickerItems = articles
    .map((article) => `<span class="ticker-item">${article.title}</span>`)
    .join("");

  tickerContent.innerHTML = tickerItems + tickerItems;
}

function createNewsCard(article) {
  return `
    <article class="news-card" onclick="goToArticle(${article.id})">
      <div class="news-card-image">
        <img src="${article.image_url}" alt="${article.title}" loading="lazy">
        <span class="category-badge">${article.category}</span>
      </div>
      <div class="news-card-content">
        <h3 class="news-card-title">${article.title}</h3>
        <p class="news-card-excerpt">${article.excerpt}</p>
        <div class="news-card-footer">
          <div class="news-card-author">
            <span class="author-avatar">${article.author.charAt(0)}</span>
            <span>${article.author}</span>
          </div>
          <span>${formatDate(article.published_at)}</span>
        </div>
      </div>
    </article>
  `;
}

function goToArticle(id) {
  window.location.href = `article.html?id=${id}`;
}

function formatDate(dateString) {
  const date = new Date(dateString);
  const options = {month: "short", day: "numeric", year: "numeric"};
  return date.toLocaleDateString("en-NG", options);
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function showToast(message, type = "success") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => toast.classList.add("show"), 100);
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

const newsletterForm = document.getElementById("newsletterForm");
if (newsletterForm) {
  newsletterForm.addEventListener("submit", (e) => {
    e.preventDefault();
    showToast("Thank you for subscribing to our newsletter!");
    newsletterForm.reset();
  });
}
