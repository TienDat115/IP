// New Movies Page JavaScript
let currentPage = 1;
let totalPages = 1;

// Initialize page when DOM is loaded
document.addEventListener('DOMContentLoaded', async function() {
    await window.ensureConfigReady();
    setupSearchListeners();
    initializePage();
});

// Initialize page
async function initializePage() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const page = urlParams.get('page');
        const pageNumber = page ? parseInt(page) : 1;
        await loadNewMovies(pageNumber);
    } catch (error) {
        console.error('Error initializing page:', error);
        showError('Có lỗi xảy ra khi tải trang. Vui lòng thử lại.');
    }
}

// Load new movies
async function loadNewMovies(page = 1) {
    try {
        showPageLoading(true);
        hidePageNoResults();

        currentPage = page;

        const data = await fetchJSONCached(getApiUrl(`${API_BASE}${currentSource.endpoints.new}?page=${page}`));

        if (data.status === 'success' || data.status === true) {
            const movies = (data.items || data.data?.items || []).map(item => normalizeMovieData(item));
            displayMovies(movies);

            const pagination = normalizePagination(data);
            updatePagination(pagination);

            // Update page title
            document.title = `Phim Mới Cập Nhật - CinePhim`;

        } else {
            showPageNoResults();
        }

        showPageLoading(false);

        setTimeout(() => {
            const target = document.getElementById('moviesContainer');
            if (target) {
                const headerHeight = document.querySelector('header')?.offsetHeight || 60;
                const targetPosition = target.getBoundingClientRect().top + window.scrollY - headerHeight - 10;
                window.scrollTo({ top: targetPosition, behavior: 'smooth' });
            }
        }, 100);

    } catch (error) {
        console.error('Error loading new movies:', error);
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
    _renderPagination(paginate, 'loadNewMovies({page})');
    const url = new URL(window.location);
    url.searchParams.set('page', current);
    window.history.pushState({}, '', url);
}