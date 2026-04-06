// Single Movies Page JavaScript
let currentPage = 1;
let totalPages = 1;

// Initialize page when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializePage();
});

// Initialize page
async function initializePage() {
    try {
        // Listen for auth state changes
        auth.onAuthStateChanged((user) => {
            updateAuthUI();
        });
        
        // Check for page parameter in URL
        const urlParams = new URLSearchParams(window.location.search);
        const page = urlParams.get('page');
        
        // Load with page from URL (default to 1 if not specified)
        const pageNumber = page ? parseInt(page) : 1;
        
        // Load single movies
        await loadSingleMovies(pageNumber);
        
    } catch (error) {
        console.error('Error initializing page:', error);
        showError('Có lỗi xảy ra khi tải trang. Vui lòng thử lại.');
    }
}

// Load single movies
async function loadSingleMovies(page = 1) {
    try {
        showLoading(true);
        hideNoResults();
        
        currentPage = page;
        
        // Scroll to top when changing page
        window.scrollTo(0, 0);
        
        const response = await fetch(getApiUrl(`${API_BASE}/films/danh-sach/phim-le?page=${page}`));
        
        if (!response.ok) {
            throw new Error('Failed to fetch single movies');
        }
        
        const data = await response.json();
        
        if (data.status === 'success' && data.items) {
            displayMovies(data.items);
            updatePagination(data.paginate);
            
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
            showNoResults();
        }
        
        showLoading(false);
        
    } catch (error) {
        console.error('Error loading single movies:', error);
        showError('Không thể tải danh sách phim. Vui lòng thử lại.');
        showLoading(false);
    }
}

// Format episode information
function formatEpisodeInfo(currentEpisode, totalEpisodes) {
    if (!currentEpisode) return '';
    
    // If current episode contains "full" or "hoàn tất", just return it
    if (currentEpisode.toLowerCase().includes('full') || 
        currentEpisode.toLowerCase().includes('hoàn tất') ||
        currentEpisode.toLowerCase().includes('completed')) {
        return currentEpisode;
    }
    
    // Extract current episode number
    const currentMatch = currentEpisode.match(/(\d+)/);
    const currentNum = currentMatch ? parseInt(currentMatch[1]) : 0;
    
    // Extract total episodes if available
    let totalNum = 0;
    if (totalEpisodes) {
        const totalMatch = totalEpisodes.toString().match(/(\d+)/);
        totalNum = totalMatch ? parseInt(totalMatch[1]) : 0;
    }
    
    // If we have both current and total, show "X/Y"
    if (currentNum > 0 && totalNum > 0) {
        return `${currentNum}/${totalNum}`;
    }
    
    // If only current episode, show "Tập X"
    if (currentNum > 0) {
        return `Tập ${currentNum}`;
    }
    
    // Default to current episode text
    return currentEpisode;
}

// Display movies
function displayMovies(movies) {
    const moviesGrid = document.getElementById('moviesGrid');
    
    if (!movies || movies.length === 0) {
        showNoResults();
        return;
    }
    
    moviesGrid.innerHTML = movies.map(movie => `
        <div class="film-card bg-gray-800 rounded-lg overflow-hidden cursor-pointer" onclick="goToMovieDetail('${movie.slug}')">
            <div class="relative">
                <img src="${getVerticalImage(movie.poster_url, movie.thumb_url)}" 
                     alt="${movie.name || movie.title}" 
                     class="film-poster w-full"
                     onerror="this.src='https://via.placeholder.com/300x450/374151/ffffff?text=No+Poster'">
                <div class="absolute top-2 right-2 bg-purple-600 px-2 py-1 rounded text-xs font-semibold">
                    ${movie.quality || 'HD'}
                </div>
                ${movie.current_episode ? `
                    <div class="absolute bottom-2 left-2 bg-black bg-opacity-75 px-2 py-1 rounded text-xs">
                        ${formatEpisodeInfo(movie.current_episode, movie.total_episodes)}
                    </div>
                ` : ''}
            </div>
            <div class="p-4">
                <h3 class="font-semibold text-sm mb-2 line-clamp-2">${movie.name || movie.title}</h3>
                <p class="text-gray-400 text-xs mb-2">${movie.year || movie.time || ''}</p>
                <div class="flex items-center justify-between">
                    <span class="text-xs text-gray-500">${getCountryFromCategory(movie.category) || ''}</span>
                </div>
            </div>
        </div>
    `).join('');
}

// Update pagination
function updatePagination(paginate) {
    const paginationContainer = document.getElementById('pagination');
    
    if (!paginate) {
        paginationContainer.innerHTML = '';
        return;
    }
    
    const { current_page: current, total_page: total } = paginate;
    currentPage = current;
    totalPages = total;
    
    if (total <= 1) {
        paginationContainer.innerHTML = '';
        return;
    }
    
    let paginationHTML = '';
    
    // Previous button
    if (current > 1) {
        paginationHTML += `
            <button onclick="loadSingleMovies(${current - 1})" 
                    class="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition">
                <i class="fas fa-chevron-left"></i>
            </button>
        `;
    }
    
    // Page numbers - same logic as index.js
    const startPage = Math.max(1, current - 2);
    const endPage = Math.min(total, current + 2);
    
    for (let i = startPage; i <= endPage; i++) {
        const isActive = i === current;
        paginationHTML += `
            <button onclick="loadSingleMovies(${i})" 
                    class="px-3 py-2 ${isActive ? 'bg-purple-600' : 'bg-gray-700 hover:bg-gray-600'} rounded-lg transition">
                ${i}
            </button>
        `;
    }
    
    // Next button
    if (current < total) {
        paginationHTML += `
            <button onclick="loadSingleMovies(${current + 1})" 
                    class="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition">
                <i class="fas fa-chevron-right"></i>
            </button>
        `;
    }
    
    paginationContainer.innerHTML = paginationHTML;
    
    // Update URL with page parameter
    const url = new URL(window.location);
    url.searchParams.set('page', current);
    window.history.pushState({}, '', url);
}

// Go to movie detail page
function goToMovieDetail(slug) {
    window.location.href = `movie-detail.html?slug=${slug}`;
}

// Show/hide loading
function showLoading(show) {
    const loading = document.getElementById('loading');
    const moviesContainer = document.getElementById('moviesContainer');
    
    if (loading) {
        loading.classList.toggle('hidden', !show);
    }
    
    if (moviesContainer) {
        moviesContainer.classList.toggle('hidden', show);
    }
}

// Show no results message
function showNoResults() {
    const noResults = document.getElementById('noResults');
    const moviesContainer = document.getElementById('moviesContainer');
    
    if (noResults) {
        noResults.classList.remove('hidden');
    }
    
    if (moviesContainer) {
        moviesContainer.classList.add('hidden');
    }
}

// Hide no results message
function hideNoResults() {
    const noResults = document.getElementById('noResults');
    const moviesContainer = document.getElementById('moviesContainer');
    
    if (noResults) {
        noResults.classList.add('hidden');
    }
    
    if (moviesContainer) {
        moviesContainer.classList.remove('hidden');
    }
}

// Update auth UI
function updateAuthUI() {
    const loginText = document.getElementById('loginText');
    const loginIcon = document.getElementById('loginIcon');
    const mobileLoginIcon = document.getElementById('mobileLoginIcon');
    
    if (auth.currentUser) {
        if (loginText) loginText.textContent = 'Đăng xuất';
        if (loginIcon) loginIcon.className = 'fas fa-sign-out-alt mr-1';
        if (mobileLoginIcon) mobileLoginIcon.className = 'fas fa-sign-out-alt';
    } else {
        if (loginText) loginText.textContent = 'Đăng nhập';
        if (loginIcon) loginIcon.className = 'fas fa-sign-in-alt mr-1';
        if (mobileLoginIcon) mobileLoginIcon.className = 'fas fa-sign-in-alt';
    }
}

// Utility functions
function showError(message) {
    Swal.fire({
        icon: 'error',
        title: 'Lỗi',
        text: message,
        confirmButtonColor: '#8b5cf6'
    });
}

function showSuccess(message) {
    Swal.fire({
        icon: 'success',
        title: 'Thành công',
        text: message,
        timer: 2000,
        showConfirmButton: false
    });
}

// Handle search
document.getElementById('searchInput')?.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        const query = e.target.value.trim();
        if (query) {
            window.location.href = `index.html?search=${encodeURIComponent(query)}`;
        }
    }
});

document.getElementById('mobileSearchInput')?.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        const query = e.target.value.trim();
        if (query) {
            window.location.href = `index.html?search=${encodeURIComponent(query)}`;
        }
    }
});
