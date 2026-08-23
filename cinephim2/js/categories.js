// CinePhim - Categories Page JavaScript

// Global variables for this page
var currentPage = 1;
var currentCategory = '';
var categoryNameMap = {};
var categoriesLoaded = false;


// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    window.ensureConfigReady().then(function() {
        loadCategories().then(function() {
            setupEventListeners();
            setupSearchListeners();
            // Check if category is in URL params
            var urlParams = new URLSearchParams(window.location.search);
            var category = urlParams.get('category');
            var page = urlParams.get('page');
            
            if (category) {
                var radio = document.querySelector('input[name="category"][value="' + category + '"]');
                if (radio) {
                    radio.checked = true;
                }
                // Load with page from URL (default to 1 if not specified)
                var pageNumber = page ? parseInt(page) : 1;
                loadMoviesByCategory(category, pageNumber);
            }
        });
    });
});

// Load categories from API
function loadCategories() {
    var container = document.getElementById('categoriesContainer');
    if (!container) return Promise.resolve();

    var categories = [];

    if (currentSourceKey === 'ophim' || currentSourceKey === 'vsmov') {
        return fetchJSONCached(getApiUrl(API_BASE + currentSource.endpoints.category)).then(function(data) {
            if (data.status === 'success' && data.data && data.data.items) {
                categories = data.data.items.map(function(item) {
                    return {
                        slug: item.slug,
                        name: item.name
                    };
                });
            }
            return buildCategoriesList(container, categories);
        }).catch(function(error) {
            console.warn('Failed to load categories from API, using fallback:', error);
            return buildCategoriesList(container, categories);
        });
    }

    if (currentSourceKey === 'kkphim') {
        return fetchJSONCached(getApiUrl(API_BASE + currentSource.endpoints.category)).then(function(data) {
            if (Array.isArray(data) && data.length > 0) {
                categories = data.map(function(item) {
                    return {
                        slug: item.slug,
                        name: item.name
                    };
                });
            }
            return buildCategoriesList(container, categories);
        }).catch(function(error) {
            console.warn('Failed to load categories from API, using fallback:', error);
            return buildCategoriesList(container, categories);
        });
    }

    return buildCategoriesList(container, categories);
}

function buildCategoriesList(container, categories) {
    // Fallback for NguonC or if API fails
    if (categories.length === 0) {
        categories = NGONC_CATEGORIES;
    }

    // Build name map and render
    categoryNameMap = {};
    categories.forEach(function(cat) { categoryNameMap[cat.slug] = cat.name; });

    container.innerHTML = categories.map(function(cat) {
        return '<label class="flex items-center space-x-2 cursor-pointer hover:bg-gray-600 p-2 rounded transition">' +
            '<input type="radio" name="category" value="' + cat.slug + '" onchange="loadMoviesByCategory(this.value)" class="w-4 h-4 text-purple-600 bg-gray-600 border-gray-500 rounded focus:ring-purple-500" />' +
            '<span class="text-white">' + cat.name + '</span>' +
            '</label>';
    }).join('');

    categoriesLoaded = true;
    return Promise.resolve();
}

// Setup event listeners
function setupEventListeners() {
    // Use event delegation for dynamically created radio buttons
    var container = document.getElementById('categoriesContainer');
    if (container && container.addEventListener) {
        container.addEventListener('change', function(e) {
            if (e.target && e.target.name === 'category') {
                var selectedCategorySpan = document.getElementById('selectedCategory');
                if (selectedCategorySpan) {
                    var displayName = getCategoryDisplayName(e.target.value);
                    selectedCategorySpan.textContent = displayName;
                }
            }
        });
    }
}

// Load movies by category
function loadMoviesByCategory(category, page) {
    if (page === undefined) page = 1;
    if (!category) {
        showWarning('Vui lòng chọn thể loại để xem phim.');
        return Promise.resolve();
    }
    
    return new Promise(function(resolve, reject) {
        showPageLoading(true);
        hidePageNoResults();
        
        currentCategory = category;
        currentPage = page;
        
        // Update URL with category and page parameters
        var url = new URL(window.location);
        url.searchParams.set('category', category);
        url.searchParams.set('page', page);
        window.history.pushState({}, '', url);
        
        // Scroll to top when changing page
        window.scrollTo(0, 0);
        
        var endpoint = currentSource.endpoints.category + '/' + category;
        if (currentSourceKey === 'nguonc') {
            endpoint = '/films/the-loai/' + category;
        } else if (currentSourceKey === 'kkphim') {
            endpoint = '/v1/api/the-loai/' + category;
        }
        
        fetchJSONCached(getApiUrl(API_BASE + endpoint + '?page=' + page)).then(function(data) {
            if (data.status === 'success' || data.status === true) {
                var rawItems = data.items || (data.data && data.data.items) || [];
                var movies = rawItems.map(function(item) { return normalizeMovieData(item); });
                displayMovies(movies);
                
                var pagination = normalizePagination(data);
                updatePagination(pagination);
                
                // Update page title
                var categoryName = getCategoryDisplayName(category);
                document.title = 'Phim ' + categoryName + ' - CinePhim';
                
                // Update breadcrumb
                updateBreadcrumb(categoryName);
                
                // Scroll to movies container with header offset
                setTimeout(function() {
                    var moviesContainer = document.getElementById('moviesContainer');
                    if (moviesContainer) {
                        var header = document.querySelector('header');
                        var headerHeight = header ? header.offsetHeight : 0;
                        var top = moviesContainer.getBoundingClientRect().top + window.pageYOffset - headerHeight - 10;
                        window.scrollTo({ top: top, behavior: 'smooth' });
                    }
                }, 100);
                
            } else {
                showPageNoResults();
            }
            
            showPageLoading(false);
            resolve();
        }).catch(function(error) {
            console.error('Error loading category movies:', error);
            showError('Không thể tải danh sách phim. Vui lòng thử lại.');
            showPageLoading(false);
            resolve();
        });
    });
}

// Update pagination
function updatePagination(paginate) {
    _renderPagination(paginate, 'loadMoviesByCategory(\'' + currentCategory + '\', {page})');
}

// Get category display name
function getCategoryDisplayName(categorySlug) {
    return categoryNameMap[categorySlug] || categorySlug;
}

// Update breadcrumb
function updateBreadcrumb(categoryName) {
    var breadcrumbContainer = document.getElementById('breadcrumb');
    if (breadcrumbContainer) {
        breadcrumbContainer.innerHTML = '<a href="index.html" class="hover:text-purple-400 transition">Trang chủ</a>' +
            '<i class="fas fa-chevron-right text-xs"></i>' +
            '<span class="text-white">Phim theo thể loại</span>' +
            '<i class="fas fa-chevron-right text-xs"></i>' +
            '<span class="text-white">' + categoryName + '</span>';
    }
}
