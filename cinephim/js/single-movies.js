// Single Movies Page JavaScript
let currentPage = 1;
let totalPages = 1;

// Initialize page when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    setupSearchListeners();
    initializePage();
});

// Initialize page
async function initializePage() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const page = urlParams.get('page');
        const pageNumber = page ? parseInt(page) : 1;
        await loadSingleMovies(pageNumber);
    } catch (error) {
        console.error('Error initializing page:', error);
        showError('Có lỗi xảy ra khi tải trang. Vui lòng thử lại.');
    }
}

// Load single movies
async function loadSingleMovies(page = 1) {
    try {
        showPageLoading(true);
        hidePageNoResults();
        
        currentPage = page;
        
        // Scroll to top when changing page
        window.scrollTo(0, 0);
        
        let endpoint = `/danh-sach/phim-le`;
        if (currentSourceKey === 'nguonc') {
            endpoint = `/films/danh-sach/phim-le`;
        } else if (currentSourceKey === 'kkphim') {
            endpoint = `/v1/api/danh-sach/phim-le`;
        }
        
        const data = await fetchJSONCached(getApiUrl(`${API_BASE}${endpoint}?page=${page}`));
        
        if (data.status === 'success' || data.status === true) {
            const pathImage = data.pathImage || data.data?.pathImage || data.data?.APP_DOMAIN_CDN_IMAGE || '';
            const movies = (data.items || data.data?.items || []).map(item => normalizeMovieData(item, pathImage));
            displayMovies(movies);
            
            const pagination = normalizePagination(data);
            updatePagination(pagination);
            
            // Update page title
            document.title = `Phim Lẻ - CinePhim`;
            
            // Scroll to movies container after loading new page
            if (page > 1) {
                setTimeout(() => {
                    const moviesGrid = document.getElementById('moviesGrid');
                    if (moviesGrid) {
                        moviesGrid.scrollIntoView({ 
                            behavior: 'smooth', 
                            block: 'start' 
                        });
                    }
                }, 100);
            }
            
        } else {
            showPageNoResults();
        }
        
        showPageLoading(false);
        
    } catch (error) {
        console.error('Error loading single movies:', error);
        showError('Không thể tải danh sách phim. Vui lòng thử lại.');
        showPageLoading(false);
    }
}

// Update pagination
function updatePagination(paginate) {
    if (!paginate) { document.getElementById('pagination').innerHTML = ''; return; }
    const { current_page: current, total_page: total } = paginate;
    currentPage = current;
    totalPages = total;
    _renderPagination(paginate, 'loadSingleMovies({page})');
    const url = new URL(window.location);
    url.searchParams.set('page', current);
    window.history.pushState({}, '', url);
}


