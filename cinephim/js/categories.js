// CinePhim - Categories Page JavaScript

// Global variables for this page
let currentPage = 1;
let currentCategory = '';
let categoryNameMap = {};
let categoriesLoaded = false;


// Initialize page
document.addEventListener('DOMContentLoaded', async function() {
    await window.ensureConfigReady();
    await loadCategories();
    setupEventListeners();
    setupSearchListeners();
    // Check if category is in URL params
    const urlParams = new URLSearchParams(window.location.search);
    const category = urlParams.get('category');
    const page = urlParams.get('page');
    
    if (category) {
        const radio = document.querySelector(`input[name="category"][value="${category}"]`);
        if (radio) {
            radio.checked = true;
        }
        // Load with page from URL (default to 1 if not specified)
        const pageNumber = page ? parseInt(page) : 1;
        loadMoviesByCategory(category, pageNumber);
    }
});

// Load categories from API
async function loadCategories() {
    const container = document.getElementById('categoriesContainer');
    if (!container) return;

    let categories = [];

    if (currentSourceKey === 'ophim' || currentSourceKey === 'vsmov') {
        try {
            const data = await fetchJSONCached(getApiUrl(`${API_BASE}${currentSource.endpoints.category}`));
            if (data.status === 'success' && data.data?.items) {
                categories = data.data.items.map(item => ({
                    slug: item.slug,
                    name: item.name
                }));
            }
        } catch (error) {
            console.warn('Failed to load categories from API, using fallback:', error);
        }
    }

    if (currentSourceKey === 'kkphim') {
        try {
            const data = await fetchJSONCached(getApiUrl(`${API_BASE}${currentSource.endpoints.category}`));
            if (Array.isArray(data) && data.length > 0) {
                categories = data.map(item => ({
                    slug: item.slug,
                    name: item.name
                }));
            }
        } catch (error) {
            console.warn('Failed to load categories from API, using fallback:', error);
        }
    }

    // Fallback for NguonC or if API fails
    if (categories.length === 0) {
        categories = NGONC_CATEGORIES;
    }

    // Build name map and render
    categoryNameMap = {};
    categories.forEach(cat => { categoryNameMap[cat.slug] = cat.name; });

    container.innerHTML = categories.map(cat => `
        <label class="flex items-center space-x-2 cursor-pointer hover:bg-gray-600 p-2 rounded transition">
            <input type="radio" name="category" value="${cat.slug}" onchange="loadMoviesByCategory(this.value)" class="w-4 h-4 text-purple-600 bg-gray-600 border-gray-500 rounded focus:ring-purple-500" />
            <span class="text-white">${cat.name}</span>
        </label>
    `).join('');

    categoriesLoaded = true;
}

// Setup event listeners
function setupEventListeners() {
    // Use event delegation for dynamically created radio buttons
    document.getElementById('categoriesContainer')?.addEventListener('change', function(e) {
        if (e.target && e.target.name === 'category') {
            const selectedCategorySpan = document.getElementById('selectedCategory');
            if (selectedCategorySpan) {
                const displayName = getCategoryDisplayName(e.target.value);
                selectedCategorySpan.textContent = displayName;
            }
        }
    });
}

// Load movies by category
async function loadMoviesByCategory(category, page = 1) {
    if (!category) {
        showWarning('Vui lòng chọn thể loại để xem phim.');
        return;
    }
    
    try {
        showPageLoading(true);
        hidePageNoResults();
        
        currentCategory = category;
        currentPage = page;
        
        // Update URL with category and page parameters
        const url = new URL(window.location);
        url.searchParams.set('category', category);
        url.searchParams.set('page', page);
        window.history.pushState({}, '', url);
        
        // Scroll to top when changing page
        window.scrollTo(0, 0);
        
        let endpoint = `${currentSource.endpoints.category}/${category}`;
        if (currentSourceKey === 'nguonc') {
            endpoint = `/films/the-loai/${category}`;
        } else if (currentSourceKey === 'kkphim') {
            endpoint = `/v1/api/the-loai/${category}`;
        }
        
        const data = await fetchJSONCached(getApiUrl(`${API_BASE}${endpoint}?page=${page}`));
        
        if (data.status === 'success' || data.status === true) {
            const movies = (data.items || data.data?.items || []).map(item => normalizeMovieData(item));
            displayMovies(movies);
            
            const pagination = normalizePagination(data);
            updatePagination(pagination);
            
            // Update page title
            const categoryName = getCategoryDisplayName(category);
            document.title = `Phim ${categoryName} - CinePhim`;
            
            // Update breadcrumb
            updateBreadcrumb(categoryName);
            
            // Scroll to movies container with header offset
            setTimeout(() => {
                const moviesContainer = document.getElementById('moviesContainer');
                if (moviesContainer) {
                    const header = document.querySelector('header');
                    const headerHeight = header ? header.offsetHeight : 0;
                    const top = moviesContainer.getBoundingClientRect().top + window.pageYOffset - headerHeight - 10;
                    window.scrollTo({ top, behavior: 'smooth' });
                }
            }, 100);
            
        } else {
            showPageNoResults();
        }
        
        showPageLoading(false);
        
    } catch (error) {
        console.error('Error loading category movies:', error);
        showError('Không thể tải danh sách phim. Vui lòng thử lại.');
        showPageLoading(false);
    }
}

// Update pagination
function updatePagination(paginate) {
    _renderPagination(paginate, `loadMoviesByCategory('${currentCategory}', {page})`);
}

// Get category display name
function getCategoryDisplayName(categorySlug) {
    return categoryNameMap[categorySlug] || categorySlug;
}

// Update breadcrumb
function updateBreadcrumb(categoryName) {
    const breadcrumbContainer = document.getElementById('breadcrumb');
    if (breadcrumbContainer) {
        breadcrumbContainer.innerHTML = `
            <a href="index.html" class="hover:text-purple-400 transition">Trang chủ</a>
            <i class="fas fa-chevron-right text-xs"></i>
            <span class="text-white">Phim theo thể loại</span>
            <i class="fas fa-chevron-right text-xs"></i>
            <span class="text-white">${categoryName}</span>
        `;
    }
}


