const SUPABASE_URL = "https://fftxsxklrotgzturilhr.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmdHhzeGtscm90Z3p0dXJpbGhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzU1OTEsImV4cCI6MjA4MDcxMTU5MX0.YAI8OHdMMw7V0-KK59hHz9nFyGj37o63FMzqPr7YAJ0";
let supabase = null;
let currentUser = null;
let articleTags = []; // Global variable for article tags

function initSupabase() {
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log("✅ Supabase initialized successfully");
  } else {
    console.warn("⚠️ Supabase credentials not configured");
  }
}

// Check authentication on admin pages
async function checkAuth() {
  try {
    const {
      data: {user},
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      // Redirect to login if not authenticated
      if (!window.location.pathname.includes("login.html")) {
        window.location.href = "login.html";
      }
      return null;
    }

    currentUser = user;
    console.log("✅ User authenticated:", user.email);
    return user;
  } catch (error) {
    console.error("❌ Auth check error:", error);
    return null;
  }
}

// Admin login
async function adminLogin(email, password) {
  try {
    const {data, error} = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    // Update last login
    await supabase
      .from("admin_users")
      .update({last_login: new Date().toISOString()})
      .eq("email", email);

    return {success: true, user: data.user};
  } catch (error) {
    console.error(" Login error:", error);
    return {success: false, error: error.message};
  }
}

// Admin logout
async function adminLogout() {
  try {
    const {error} = await supabase.auth.signOut();
    if (error) throw error;
    window.location.href = "login.html";
  } catch (error) {
    console.error("❌ Logout error:", error);
  }
}

// Fetch all articles (admin view)
async function fetchAllArticles(filters = {}) {
  try {
    let query = supabase
      .from("articles")
      .select(
        `
        *,
        category:categories(name, slug)
      `
      )
      .order("created_at", {ascending: false});

    if (filters.status) {
      query = query.eq("status", filters.status);
    }

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

    const {data, error} = await query;
    if (error) throw error;

    return data.map((article) => ({
      id: article.id,
      title: article.title,
      excerpt: article.excerpt,
      category: article.category?.slug || "uncategorized",
      author: article.author,
      image_url: article.image_url,
      published_at: article.published_at || article.created_at,
      status: article.status,
    }));
  } catch (error) {
    console.error("❌ Error fetching articles:", error);
    return [];
  }
}

// Create new article
async function createArticle(articleData) {
  try {
    // Get category ID
    const {data: category} = await supabase
      .from("categories")
      .select("id")
      .eq("slug", articleData.category)
      .single();

    if (!category) {
      throw new Error("Category not found");
    }

    // Generate slug from title
    const slug = articleData.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    // Create article
    const {data: article, error} = await supabase
      .from("articles")
      .insert({
        title: articleData.title,
        slug,
        excerpt: articleData.excerpt,
        content: articleData.content,
        image_url: articleData.image_url,
        category_id: category.id,
        author: articleData.author,
        status: articleData.status || "draft",
        published_at:
          articleData.status === "published" ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (error) throw error;

    // Add tags if provided
    if (articleData.tags && articleData.tags.length > 0) {
      await addArticleTags(article.id, articleData.tags);
    }

    return {success: true, article};
  } catch (error) {
    console.error("❌ Error creating article:", error);
    return {success: false, error: error.message};
  }
}

// Update article
async function updateArticle(id, articleData) {
  try {
    // Get category ID if category is provided
    let category_id = null;
    if (articleData.category) {
      const {data: category} = await supabase
        .from("categories")
        .select("id")
        .eq("slug", articleData.category)
        .single();
      category_id = category?.id;
    }

    // Update article
    const updateData = {
      ...articleData,
      category_id,
      updated_at: new Date().toISOString(),
    };

    // Set published_at if changing to published
    if (articleData.status === "published" && !articleData.published_at) {
      updateData.published_at = new Date().toISOString();
    }

    // Remove category from update data as we use category_id
    delete updateData.category;

    const {data: article, error} = await supabase
      .from("articles")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    // Update tags if provided
    if (articleData.tags) {
      // Remove existing tags
      await supabase.from("article_tags").delete().eq("article_id", id);
      // Add new tags
      await addArticleTags(id, articleData.tags);
    }

    return {success: true, article};
  } catch (error) {
    console.error("❌ Error updating article:", error);
    return {success: false, error: error.message};
  }
}

// Delete article
async function deleteArticle(id) {
  try {
    const {error} = await supabase.from("articles").delete().eq("id", id);
    if (error) throw error;
    return {success: true};
  } catch (error) {
    console.error("❌ Error deleting article:", error);
    return {success: false, error: error.message};
  }
}

// Add tags to article
async function addArticleTags(articleId, tagNames) {
  try {
    for (const tagName of tagNames) {
      // Get or create tag
      let {data: tag} = await supabase
        .from("tags")
        .select("id")
        .eq("name", tagName)
        .single();

      if (!tag) {
        const {data: newTag} = await supabase
          .from("tags")
          .insert({name: tagName})
          .select()
          .single();
        tag = newTag;
      }

      // Link tag to article
      await supabase.from("article_tags").insert({
        article_id: articleId,
        tag_id: tag.id,
      });
    }
  } catch (error) {
    console.error(" Error adding article tags:", error);
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
    console.error(" Error fetching categories:", error);
    return [];
  }
}

// Create category
async function createCategory(categoryData) {
  try {
    const {data, error} = await supabase
      .from("categories")
      .insert(categoryData)
      .select()
      .single();

    if (error) throw error;
    return {success: true, category: data};
  } catch (error) {
    console.error(" Error creating category:", error);
    return {success: false, error: error.message};
  }
}

// Fetch tags
async function fetchTags() {
  try {
    const {data, error} = await supabase.from("tags").select(`
      *,
      article_tags(count)
    `);

    if (error) throw error;

    return data.map((tag) => ({
      id: tag.id,
      name: tag.name,
      count: tag.article_tags?.length || 0,
    }));
  } catch (error) {
    console.error(" Error fetching tags:", error);
    return [];
  }
}

// Create tag
async function createTag(tagName) {
  try {
    const {data, error} = await supabase
      .from("tags")
      .insert({name: tagName})
      .select()
      .single();

    if (error) throw error;
    return {success: true, tag: data};
  } catch (error) {
    console.error(" Error creating tag:", error);
    return {success: false, error: error.message};
  }
}

// Get dashboard stats
async function getDashboardStats() {
  try {
    // Total articles
    const {count: totalArticles} = await supabase
      .from("articles")
      .select("*", {count: "exact", head: true});

    // Published articles
    const {count: publishedArticles} = await supabase
      .from("articles")
      .select("*", {count: "exact", head: true})
      .eq("status", "published");

    // Total categories
    const {count: totalCategories} = await supabase
      .from("categories")
      .select("*", {count: "exact", head: true});

    // Total views
    const {data: viewsData} = await supabase.from("articles").select("views");
    const totalViews =
      viewsData?.reduce((sum, article) => sum + (article.views || 0), 0) || 0;

    return {
      totalArticles: totalArticles || 0,
      publishedArticles: publishedArticles || 0,
      totalCategories: totalCategories || 0,
      totalViews,
    };
  } catch (error) {
    console.error(" Error fetching dashboard stats:", error);
    return {
      totalArticles: 0,
      publishedArticles: 0,
      totalCategories: 0,
      totalViews: 0,
    };
  }
}

// PAGE INITIALIZATION

document.addEventListener("DOMContentLoaded", async function () {
  initSupabase();

  // Check authentication except on login page
  if (!window.location.pathname.includes("login.html")) {
    const user = await checkAuth();
    if (!user) return;
  }

  initSidebar();
  await loadPageContent();
});

function initSidebar() {
  const mobileToggle = document.getElementById("mobileToggle");
  const sidebar = document.getElementById("sidebar");

  if (mobileToggle && sidebar) {
    mobileToggle.addEventListener("click", () => {
      sidebar.classList.toggle("active");
    });
  }

  // Logout functionality
  const logoutLinks = document.querySelectorAll('a[href="login.html"]');
  logoutLinks.forEach((link) => {
    link.addEventListener("click", async (e) => {
      if (link.textContent.includes("Logout")) {
        e.preventDefault();
        await adminLogout();
      }
    });
  });
}

async function loadPageContent() {
  const path = window.location.pathname;

  if (path.includes("dashboard.html")) {
    await loadDashboard();
  } else if (path.includes("articles.html")) {
    await loadArticles();
  } else if (path.includes("categories.html")) {
    await loadCategories();
  } else if (path.includes("tags.html")) {
    await loadTags();
  } else if (path.includes("new-article.html")) {
    await initArticleEditor();
  } else if (path.includes("login.html")) {
    initLogin();
  }
}

// LOGIN PAGE

function initLogin() {
  const loginForm = document.getElementById("loginForm");
  if (!loginForm) return;

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const submitBtn = loginForm.querySelector('button[type="submit"]');

    // Disable button and show loading
    submitBtn.disabled = true;
    submitBtn.textContent = "Signing in...";

    const result = await adminLogin(email, password);

    if (result.success) {
      window.location.href = "dashboard.html";
    } else {
      alert("Login failed: " + result.error);
      submitBtn.disabled = false;
      submitBtn.textContent = "Sign In";
    }
  });
}

// DASHBOARD PAGE

async function loadDashboard() {
  const stats = await getDashboardStats();

  // Update stat cards
  const statValues = document.querySelectorAll(".stat-value");
  if (statValues.length >= 4) {
    statValues[0].textContent = stats.totalArticles;
    statValues[1].textContent = stats.totalCategories;
    statValues[2].textContent = ""; // Placeholder
    statValues[3].textContent = stats.totalViews.toLocaleString();
  }

  // Load recent articles
  const recentArticles = document.getElementById("recentArticles");
  if (recentArticles) {
    const articles = await fetchAllArticles();
    const recent = articles.slice(0, 5);

    recentArticles.innerHTML = recent
      .map(
        (article) => `
      <tr>
        <td>
          <div class="article-cell">
            <img src="${article.image_url}" alt="${
          article.title
        }" class="article-thumb">
            <div class="article-info">
              <h4>${article.title.substring(0, 40)}...</h4>
              <span>${article.author}</span>
            </div>
          </div>
        </td>
        <td>${
          article.category.charAt(0).toUpperCase() + article.category.slice(1)
        }</td>
        <td><span class="status-badge ${article.status}">${
          article.status.charAt(0).toUpperCase() + article.status.slice(1)
        }</span></td>
        <td>${formatDate(article.published_at)}</td>
        <td>
          <div class="action-btns">
            <button class="action-btn" onclick="window.location.href='new-article.html?id=${
              article.id
            }'" title="Edit">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path></svg>
            </button>
            <button class="action-btn" onclick="window.open('../article.html?id=${
              article.id
            }', '_blank')" title="View">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path><circle cx="12" cy="12" r="3"></circle></svg>
            </button>
            <button class="action-btn delete" onclick="handleDeleteArticle(${
              article.id
            })" title="Delete">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
            </button>
          </div>
        </td>
      </tr>
    `
      )
      .join("");
  }
}

async function loadArticles() {
  const articlesTable = document.getElementById("articlesTable");
  if (!articlesTable) return;

  const articles = await fetchAllArticles();
  displayArticlesTable(articles);

  // Setup search and filters
  setupArticleFilters();
}

function displayArticlesTable(articles) {
  const articlesTable = document.getElementById("articlesTable");
  if (!articlesTable) return;

  articlesTable.innerHTML = articles
    .map(
      (article) => `
    <tr>
      <td>
        <div class="article-cell">
          <img src="${article.image_url}" alt="${
        article.title
      }" class="article-thumb">
          <div class="article-info">
            <h4>${article.title.substring(0, 50)}...</h4>
            <span>ID: ${article.id}</span>
          </div>
        </div>
      </td>
      <td>${
        article.category.charAt(0).toUpperCase() + article.category.slice(1)
      }</td>
      <td>${article.author}</td>
      <td><span class="status-badge ${article.status}">${
        article.status.charAt(0).toUpperCase() + article.status.slice(1)
      }</span></td>
      <td>${formatDate(article.published_at)}</td>
      <td>
        <div class="action-btns">
          <a href="new-article.html?id=${
            article.id
          }" class="action-btn" title="Edit">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path></svg>
          </a>
          <a href="../article.html?id=${
            article.id
          }" target="_blank" class="action-btn" title="View">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path><circle cx="12" cy="12" r="3"></circle></svg>
          </a>
          <button class="action-btn delete" onclick="handleDeleteArticle(${
            article.id
          })" title="Delete">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
          </button>
        </div>
      </td>
    </tr>
  `
    )
    .join("");
}

function setupArticleFilters() {
  const searchInput = document.getElementById("searchArticles");
  const filterCategory = document.getElementById("filterCategory");
  const filterStatus = document.getElementById("filterStatus");

  if (searchInput) {
    searchInput.addEventListener("input", async function () {
      await filterAndDisplayArticles(this.value, {
        category: filterCategory?.value,
        status: filterStatus?.value,
      });
    });
  }

  if (filterCategory) {
    filterCategory.addEventListener("change", async function () {
      await filterAndDisplayArticles(searchInput?.value, {
        category: this.value,
        status: filterStatus?.value,
      });
    });
  }

  if (filterStatus) {
    filterStatus.addEventListener("change", async function () {
      await filterAndDisplayArticles(searchInput?.value, {
        category: filterCategory?.value,
        status: this.value,
      });
    });
  }
}

async function filterAndDisplayArticles(searchQuery = "", filters = {}) {
  let articles = await fetchAllArticles(filters);

  if (searchQuery) {
    articles = articles.filter(
      (article) =>
        article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        article.author.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }

  displayArticlesTable(articles);
}

async function handleDeleteArticle(id) {
  if (!confirm("Are you sure you want to delete this article?")) return;

  const result = await deleteArticle(id);
  if (result.success) {
    alert("Article deleted successfully!");
    location.reload();
  } else {
    alert("Error deleting article: " + result.error);
  }
}

async function loadCategories() {
  const categoriesGrid = document.getElementById("categoriesGrid");
  if (!categoriesGrid) return;

  const categories = await fetchCategories();

  categoriesGrid.innerHTML = categories
    .map(
      (cat) => `
    <div class="category-card">
      <div class="category-info">
        <h4>${cat.name}</h4>
        <span>${cat.slug}</span>
      </div>
      <div class="action-btns">
        <button class="action-btn" title="Edit">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path></svg>
        </button>
      </div>
    </div>
  `
    )
    .join("");

  setupCategoryModal();
}

function setupCategoryModal() {
  const addCategoryBtn = document.getElementById("addCategoryBtn");
  const categoryModal = document.getElementById("categoryModal");
  const closeModal = document.getElementById("closeModal");
  const cancelCategory = document.getElementById("cancelCategory");
  const saveCategory = document.getElementById("saveCategory");

  if (addCategoryBtn && categoryModal) {
    addCategoryBtn.addEventListener("click", () => {
      categoryModal.classList.add("active");
    });

    closeModal?.addEventListener("click", () => {
      categoryModal.classList.remove("active");
    });

    cancelCategory?.addEventListener("click", () => {
      categoryModal.classList.remove("active");
    });

    saveCategory?.addEventListener("click", async () => {
      const name = document.getElementById("categoryName").value;
      const slug =
        document.getElementById("categorySlug").value ||
        name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const description = document.getElementById("categoryDesc").value;

      if (name) {
        const result = await createCategory({name, slug, description});
        if (result.success) {
          alert("Category created successfully!");
          categoryModal.classList.remove("active");
          document.getElementById("categoryForm").reset();
          await loadCategories();
        } else {
          alert("Error creating category: " + result.error);
        }
      }
    });
  }
}

async function loadTags() {
  const tagsGrid = document.getElementById("tagsGrid");
  if (!tagsGrid) return;

  const tags = await fetchTags();

  tagsGrid.innerHTML = tags
    .map(
      (tag) => `
    <div class="tag-card">
      <div class="tag-info">
        <h4>${tag.name}</h4>
        <span>${tag.count} articles</span>
      </div>
      <div class="action-btns">
        <button class="action-btn" title="Edit">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path></svg>
        </button>
      </div>
    </div>
  `
    )
    .join("");

  setupTagModal();
}

function setupTagModal() {
  const addTagBtn = document.getElementById("addTagBtn");
  const tagModal = document.getElementById("tagModal");
  const closeTagModal = document.getElementById("closeTagModal");
  const cancelTag = document.getElementById("cancelTag");
  const saveTag = document.getElementById("saveTag");

  if (addTagBtn && tagModal) {
    addTagBtn.addEventListener("click", () => {
      tagModal.classList.add("active");
    });

    closeTagModal?.addEventListener("click", () => {
      tagModal.classList.remove("active");
    });

    cancelTag?.addEventListener("click", () => {
      tagModal.classList.remove("active");
    });

    saveTag?.addEventListener("click", async () => {
      const name = document.getElementById("tagName").value;

      if (name) {
        const result = await createTag(name);
        if (result.success) {
          alert("Tag created successfully!");
          tagModal.classList.remove("active");
          document.getElementById("tagForm").reset();
          await loadTags();
        } else {
          alert("Error creating tag: " + result.error);
        }
      }
    });
  }
}

// NEW ARTICLE PAGE

async function initArticleEditor() {
  articleTags = []; // Reset tags array

  const tagInput = document.getElementById("tagInput");
  const tagContainer = document.getElementById("tagContainer");

  // Setup tag input
  if (tagInput && tagContainer) {
    tagInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault();
        const tag = this.value.trim();
        if (tag && !articleTags.includes(tag)) {
          articleTags.push(tag);
          renderTags();
        }
        this.value = "";
      }
    });
  }

  // Load categories for dropdown
  const categorySelect = document.getElementById("category");
  if (categorySelect) {
    const categories = await fetchCategories();
    categorySelect.innerHTML = '<option value="">Select category</option>';
    categories.forEach((cat) => {
      const option = document.createElement("option");
      option.value = cat.slug;
      option.textContent = cat.name;
      categorySelect.appendChild(option);
    });
  }

  // Handle form submission
  const articleForm = document.getElementById("articleForm");
  if (articleForm) {
    articleForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      await handleArticleSubmit("published");
    });
  }

  // Save draft button
  const saveDraftBtn = document.getElementById("saveDraftBtn");
  if (saveDraftBtn) {
    saveDraftBtn.addEventListener("click", async function () {
      await handleArticleSubmit("draft");
    });
  }
}

async function handleArticleSubmit(status) {
  const submitBtn = document.querySelector('button[type="submit"]');
  const saveDraftBtn = document.getElementById("saveDraftBtn");

  // Disable both buttons
  if (submitBtn) submitBtn.disabled = true;
  if (saveDraftBtn) saveDraftBtn.disabled = true;

  const btnText = status === "published" ? "Publishing..." : "Saving...";
  if (status === "published" && submitBtn) {
    submitBtn.textContent = btnText;
  } else if (saveDraftBtn) {
    saveDraftBtn.textContent = btnText;
  }

  const articleData = {
    title: document.getElementById("title").value,
    excerpt: document.getElementById("excerpt").value,
    content: document.getElementById("editor").innerHTML,
    image_url:
      document.getElementById("imageUrl").value ||
      "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=800",
    category: document.getElementById("category").value,
    author: document.getElementById("author").value,
    status: status,
    tags: articleTags,
  };

  const result = await createArticle(articleData);

  if (result.success) {
    alert(
      status === "published"
        ? "Article published successfully!"
        : "Draft saved successfully!"
    );
    window.location.href = "articles.html";
  } else {
    alert(
      `Error ${status === "published" ? "publishing" : "saving"} article: ${
        result.error
      }`
    );
  } // Re-enable buttons
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.textContent = "Publish Article";
  }
  if (saveDraftBtn) {
    saveDraftBtn.disabled = false;
    saveDraftBtn.textContent = "Save Draft";
  }
  window.formatText = function (command) {
    document.execCommand(command, false, null);
  };

  window.formatBlock = function (tag) {
    document.execCommand("formatBlock", false, tag);
  };

  window.deleteArticle = function (id) {
    if (confirm("Are you sure you want to delete this article?")) {
      alert("Article deleted!");
      location.reload();
    }
  };

  function formatDate(dateString) {
    const date = new Date(dateString);
    const options = {month: "short", day: "numeric", year: "numeric"};
    return date.toLocaleDateString("en-NG", options);
  }
}
