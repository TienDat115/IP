// CinePhim - Index Page JavaScript

// Global variables for this page
let currentPage = 1;
let searchQuery = '';

// Initialize page
document.addEventListener('DOMContentLoaded', async function() {
    await window.ensureConfigReady();
    // Check for page parameter in URL
    const urlParams = new URLSearchParams(window.location.search);
    const page = urlParams.get('page');
    const search = urlParams.get('search');
    
    // Load with page from URL (default to 1 if not specified)
    const pageNumber = page ? parseInt(page) : 1;
    
    loadRecentWatched();
    loadPinnedMovies();
    document.addEventListener('cinephim:auth-ready', () => {
        loadRecentWatched();
        loadPinnedMovies();
    });
    
    if (search) {
        searchMovies(search, pageNumber);
    } else {
        loadNewMovies(pageNumber);
    }
    
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    const searchInput = document.getElementById('searchInput');
    let searchTimeout;
    
    if (searchInput) {
        searchInput.addEventListener('input', function(e) {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                const query = e.target.value.trim();
                if (query) {
                    searchMovies(query);
                } else {
                    loadNewMovies();
                }
            }, 500);
        });
    }
}

// Load new movies
async function loadNewMovies(page = 1) {
    showLoading();
    currentPage = page;
    currentCategory = '';
    currentCountry = '';
    currentYear = '';
    searchQuery = '';
    
    // Update URL with page parameter
    const url = new URL(window.location);
    url.searchParams.delete('search');
    url.searchParams.set('page', page);
    window.history.pushState({}, '', url);
    
    try {
        const data = await fetchJSONCached(getApiUrl(`${API_BASE}${currentSource.endpoints.new}?page=${page}`));
        
        if (data.status === 'success' || data.status === true) {
            const movies = (data.items || data.data?.items || []).map(item => normalizeMovieData(item));
            displayMovies(movies);
            
            const pagination = normalizePagination(data);
            
            if (pagination) {
                currentPage = pagination.current_page;
                displayPagination(pagination);
            } else {
                // Create mock pagination for testing
                displayPagination({
                    current_page: currentPage,
                    total_page: 5,
                    per_page: 20,
                    total_items: 100
                });
            }
            
            // Scroll to movies container after loading new page
            if (page > 1) {
                setTimeout(() => {
                    const target = document.getElementById('moviesContainer');
                    if (target) {
                        const headerHeight = document.querySelector('header')?.offsetHeight || 60;
                        const targetPosition = target.getBoundingClientRect().top + window.scrollY - headerHeight - 10;
                        window.scrollTo({ top: targetPosition, behavior: 'smooth' });
                    }
                }, 100);
            }
        } else {
            showError('Không thể tải phim');
        }
    } catch (error) {
        showError('Lỗi kết nối đến server');
    } finally {
        hideLoading();
    }
}

// Search movies
async function searchMovies(keyword, page = 1) {
    showLoading();
    currentPage = page;
    searchQuery = keyword;
    
    // Update URL with search and page parameters
    const url = new URL(window.location);
    url.searchParams.set('search', keyword);
    url.searchParams.set('page', page);
    window.history.pushState({}, '', url);
    
    try {
        const data = await fetchJSONCached(getApiUrl(`${API_BASE}${currentSource.endpoints.search}?keyword=${encodeURIComponent(keyword)}&page=${page}`));
        
        if (data.status === 'success' || data.status === true) {
            const movies = (data.items || data.data?.items || []).map(item => normalizeMovieData(item));
            displayMovies(movies);
            
            const pagination = normalizePagination(data);
            
            if (pagination) {
                currentPage = pagination.current_page;
                displayPagination(pagination);
            } else {
                // Create mock pagination for testing
                displayPagination({
                    current_page: currentPage,
                    total_page: 5,
                    per_page: 20,
                    total_items: 100
                });
            }
            
            // Scroll to search bar with offset for sticky header
            setTimeout(() => {
                const target = document.getElementById('searchBarSection');
                if (target) {
                    const headerHeight = document.querySelector('header')?.offsetHeight || 60;
                    const targetPosition = target.getBoundingClientRect().top + window.scrollY - headerHeight - 10;
                    window.scrollTo({ top: targetPosition, behavior: 'smooth' });
                }
            }, 100);
        } else {
            showError('Không tìm thấy kết quả');
        }
    } catch (error) {
        showError('Lỗi kết nối đến server');
    } finally {
        hideLoading();
    }
}

// Display pagination
function displayPagination(pagination) {
    _renderPagination(pagination, 'changePage({page})');
}

// Change page
function changePage(page) {
    currentPage = page; // Update global currentPage
    
    if (searchQuery) {
        searchMovies(searchQuery, page);
    } else {
        loadNewMovies(page);
    }
}

// Load recent watched movies
async function loadRecentWatched() {
    try {
        const grid = document.getElementById('recentWatchedGrid');
        const emptyState = document.getElementById('recentWatchedEmpty');
        
        if (!grid || !emptyState) return;
        
        // Load from Firebase if user is logged in
        let recentWatched = [];
        if (currentUser) {
            const snapshot = await db.collection('users').doc(currentUser.uid).collection('watchHistory').orderBy('watchedAt', 'desc').limit(5).get();
            
            snapshot.forEach(doc => {
                recentWatched.push(doc.data());
            });
            
        }
        
        if (recentWatched.length === 0) {
            grid.innerHTML = '';
            emptyState.classList.remove('hidden');
            return;
        }
        
        emptyState.classList.add('hidden');
        
        let html = '';
        for (const item of recentWatched) {
            html += `
                <div class="film-card bg-gray-800 rounded-lg overflow-hidden cursor-pointer relative" onclick="showMovieDetail('${item.movieSlug}')">
                    <div class="relative">
                        <div class="w-full aspect-[2/3] bg-gray-700 flex items-center justify-center" id="recent-poster-${item.movieSlug}">
                            <i class="fas fa-film text-4xl text-gray-500"></i>
                        </div>
                        <div class="absolute bottom-2 left-2 bg-purple-600 px-2 py-1 rounded text-xs font-semibold">
                            ${item.episodeName || 'Tập phim'}
                        </div>
                    </div>
                    <div class="p-4">
                        <h3 class="font-semibold text-sm mb-2 line-clamp-2">${item.movieTitle || ''}</h3>
                        <p class="text-gray-400 text-xs">${item.episodeName || ''}</p>
                    </div>
                </div>
            `;
        }
        
        grid.innerHTML = html;
        
        // Load posters for recent watched movies
        loadRecentWatchedPosters(recentWatched);
        
    } catch (error) {
        console.error('Error loading recent watched:', error);
        const grid = document.getElementById('recentWatchedGrid');
        const emptyState = document.getElementById('recentWatchedEmpty');
        if (grid && emptyState) {
            grid.innerHTML = '';
            emptyState.classList.remove('hidden');
        }
    }
}

// Load posters for recent watched movies
async function loadRecentWatchedPosters(recentWatched) {
    for (const item of recentWatched) {
        try {
            const posterContainer = document.getElementById('recent-poster-' + item.movieSlug);
            if (!posterContainer) continue;

            let posterUrl = '';
            let thumbUrl = '';

            try {
                const data = await fetchJSONCached(getApiUrl(`${API_BASE}${currentSource.endpoints.detail}/${item.movieSlug}`));
                const movieData = data.movie || data.item || data.data?.item;
                if ((data.status === 'success' || data.status === true) && movieData) {
                    const movie = normalizeMovieData(movieData);
                    posterUrl = movie.poster_url || '';
                    thumbUrl = movie.thumb_url || '';
                }
            } catch (apiError) {
                console.warn('API fallback for', item.movieSlug, ':', apiError);
            }

            if (!posterUrl && !thumbUrl) {
                posterUrl = item.poster_url || '';
                thumbUrl = item.thumb_url || '';
            }

            const imgSrc = getVerticalImage(posterUrl) || placeholderImg(300, 450, 'No Poster');

            posterContainer.innerHTML = `
                <img src="${imgSrc}" 
                     alt="${item.movieTitle || ''}" 
                     loading="lazy" decoding="async" class="film-poster w-full"
                     onerror="this.src=placeholderImg(300,450,'No Poster')">
            `;
        } catch (error) {
            console.error('Error loading poster for recent watched', item.movieSlug, ':', error);
        }
    }
}

// Load pinned movies
async function loadPinnedMovies() {
    try {
        const grid = document.getElementById('pinnedMoviesGrid');
        const emptyState = document.getElementById('pinnedMoviesEmpty');
        
        if (!grid || !emptyState) return;
        
        // Wait for pinnedMovies to be loaded from Firebase
        let attempts = 0;
        while (pinnedMovies.length === 0 && attempts < 20) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        if (pinnedMovies.length === 0) {
            grid.innerHTML = '';
            emptyState.classList.remove('hidden');
            return;
        }
        
        emptyState.classList.add('hidden');
        
        let html = '';
        // Limit to 10 pinned movies for display
        const displayPinned = pinnedMovies.slice(0, 10);
        
        for (const item of displayPinned) {
            html += `
                <div class="film-card bg-gray-800 rounded-lg overflow-hidden cursor-pointer relative group" onclick="showMovieDetail('${item.slug}')">
                    <div class="relative">
                        <div id="pin-poster-${item.slug}">
                                <img src="${getVerticalImage(item.poster_url)}" 
                                     alt="${item.title || item.name}" 
                                     loading="lazy" decoding="async" class="film-poster w-full"
                                     onerror="this.src=placeholderImg(300,450,'No Poster')">
                            </div>
                            <div class="absolute top-2 right-2 bg-purple-600 px-2 py-1 rounded text-xs font-semibold">
                            HD
                        </div>
                        <div class="absolute top-2 left-2 bg-yellow-600 px-2 py-1 rounded text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                            <i class="fas fa-thumbtack"></i> Đã ghim
                        </div>
                    </div>
                    <div class="p-4">
                        <h3 class="font-semibold text-sm mb-2 line-clamp-2">${item.title || item.name || ''}</h3>
                    </div>
                </div>
            `;
        }
        
        grid.innerHTML = html;
        
        // Refresh posters from API for pinned movies (fallback to saved value)
        loadPinnedMoviesPosters(displayPinned);
        
    } catch (error) {
        console.error('Error loading pinned movies:', error);
        const grid = document.getElementById('pinnedMoviesGrid');
        const emptyState = document.getElementById('pinnedMoviesEmpty');
        if (grid && emptyState) {
            grid.innerHTML = '';
            emptyState.classList.remove('hidden');
        }
    }
}

// Load posters for pinned movies
async function loadPinnedMoviesPosters(pinnedMovies) {
    for (const item of pinnedMovies) {
        try {
            const posterContainer = document.getElementById('pin-poster-' + item.slug);
            if (!posterContainer) continue;

            let posterUrl = '';

            try {
                const data = await fetchJSONCached(getApiUrl(`${API_BASE}${currentSource.endpoints.detail}/${item.slug}`));
                const movieData = data.movie || data.item || data.data?.item;
                if ((data.status === 'success' || data.status === true) && movieData) {
                    const movie = normalizeMovieData(movieData);
                    posterUrl = movie.poster_url || '';
                }
            } catch (apiError) {
                console.warn('API fallback for pinned', item.slug, ':', apiError);
            }

            if (!posterUrl) {
                posterUrl = item.poster_url || '';
            }

            if (!posterUrl) continue;

            posterContainer.innerHTML = `
                <img src="${getVerticalImage(posterUrl)}" 
                     alt="${item.title || item.name || ''}" 
                     loading="lazy" decoding="async" class="film-poster w-full"
                     onerror="this.src=placeholderImg(300,450,'No Poster')">
            `;
        } catch (error) {
            console.error('Error loading poster for pinned movie', item.slug, ':', error);
        }
    }
}


