// New Movies Page JavaScript
var currentPage = 1;

// Initialize page when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.ensureConfigReady().then(function() {
        setupSearchListeners();
        initializePage();
    });
});

// Initialize page
function initializePage() {
    return new Promise(function(resolve, reject) {
        try {
            var urlParams = new URLSearchParams(window.location.search);
            var page = urlParams.get('page');
            var pageNumber = page ? parseInt(page) : 1;
            loadNewMovies(pageNumber).then(resolve).catch(reject);
        } catch (error) {
            console.error('Error initializing page:', error);
            showError('Có lỗi xảy ra khi tải trang. Vui lòng thử lại.');
            resolve();
        }
    });
}

// Load new movies
function loadNewMovies(page) {
    if (page === undefined) page = 1;
    return new Promise(function(resolve, reject) {
        showPageLoading(true);
        hidePageNoResults();

        currentPage = page;

        fetchJSONCached(getApiUrl(API_BASE + currentSource.endpoints.new + '?page=' + page)).then(function(data) {
            if (data.status === 'success' || data.status === true) {
                var rawItems = data.items || (data.data && data.data.items) || [];
                var movies = rawItems.map(function(item) { return normalizeMovieData(item); });
                displayMovies(movies);

                var pagination = normalizePagination(data);
                updatePagination(pagination);

                // Update page title
                document.title = 'Phim Mới Cập Nhật - CinePhim';

            } else {
                showPageNoResults();
            }

            showPageLoading(false);

            setTimeout(function() {
                var target = document.getElementById('moviesContainer');
                if (target) {
                    var header = document.querySelector('header');
                    var headerHeight = (header && header.offsetHeight) ? header.offsetHeight : 60;
                    var targetPosition = target.getBoundingClientRect().top + window.scrollY - headerHeight - 10;
                    window.scrollTo({ top: targetPosition, behavior: 'smooth' });
                }
            }, 100);

            resolve();
        }).catch(function(error) {
            console.error('Error loading new movies:', error);
            showError('Không thể tải danh sách phim. Vui lòng thử lại.');
            showPageLoading(false);
            resolve();
        });
    });
}

// Update pagination
function updatePagination(paginate) {
    if (!paginate) { document.getElementById('pagination').innerHTML = ''; return; }
    var current = paginate.current_page;
    currentPage = current;
    _renderPagination(paginate, 'loadNewMovies({page})');
    var url = new URL(window.location);
    url.searchParams.set('page', current);
    window.history.pushState({}, '', url);
}
