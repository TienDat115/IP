// CinePhim - Index Page JavaScript

// Global variables for this page
let currentPage = 1;
let searchQuery = '';

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    // Wait for common.js to initialize Firebase
    setTimeout(() => {
        loadNewMovies();
        setupEventListeners();
    }, 1500);
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
    
    try {
        const response = await fetch(`${API_BASE}/films/phim-moi-cap-nhat?page=${page}`);
        const data = await response.json();
        
        console.log('API Response:', data);
        
        if (data.status === 'success') {
            displayMovies(data.items);
            
            // Update currentPage from API response
            if (data.pagination && data.pagination.current_page) {
                currentPage = data.pagination.current_page;
            } else {
                currentPage = page;
            }
            
            // Always show pagination for testing
            if (data.pagination) {
                displayPagination(data.pagination);
            } else {
                // Create mock pagination for testing
                displayPagination({
                    current_page: currentPage,
                    total_pages: 5,
                    total_items: data.items?.length || 50
                });
            }
        } else {
            showError('Không thể tải danh sách phim');
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
    
    try {
        const response = await fetch(`${API_BASE}/films/search?keyword=${encodeURIComponent(keyword)}`);
        const data = await response.json();
        
        if (data.status === 'success') {
            displayMovies(data.items);
            displayPagination(data.pagination);
        } else {
            showError('Không tìm thấy phim nào');
        }
    } catch (error) {
        showError('Lỗi kết nối đến server');
    } finally {
        hideLoading();
    }
}

// Display movies
function displayMovies(movies) {
    const container = document.getElementById('moviesContainer');
    
    if (!container) return;
    
    if (!movies || movies.length === 0) {
        container.innerHTML = '<div class="col-span-full text-center py-8 text-gray-400">Không có phim nào để hiển thị</div>';
        return;
    }
    
    container.innerHTML = movies.map(movie => `
        <div class="film-card bg-gray-800 rounded-lg overflow-hidden cursor-pointer" onclick="showMovieDetail('${movie.slug}')">
            <div class="relative">
                <img src="${movie.poster_url || movie.thumb_url || 'https://via.placeholder.com/300x450/374151/ffffff?text=No+Poster'}" 
                     alt="${movie.name || movie.title}" 
                     class="film-poster w-full"
                     onerror="this.src='https://via.placeholder.com/300x450/374151/ffffff?text=No+Poster'">
                <div class="absolute top-2 right-2 bg-purple-600 px-2 py-1 rounded text-xs font-semibold">
                    ${movie.quality || 'HD'}
                </div>
                ${movie.current_episode ? `
                    <div class="absolute bottom-2 left-2 bg-black bg-opacity-75 px-2 py-1 rounded text-xs">
                        ${movie.current_episode}
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

// Display pagination
function displayPagination(pagination) {
    const container = document.getElementById('pagination');
    
    if (!container) {
        console.error('Pagination container not found');
        return;
    }
    
    // Debug: Log pagination data
    console.log('Pagination data:', pagination);
    
    // Handle different pagination structures
    let paginationData = pagination;
    
    // If pagination is nested in data.pagination
    if (pagination && pagination.pagination) {
        paginationData = pagination.pagination;
    }
    
    // If no pagination data, create default pagination
    if (!paginationData) {
        console.log('No pagination data, creating default');
        paginationData = {
            current_page: currentPage || 1, // Use global currentPage
            total_pages: 5,
            total_items: 50
        };
    }
    
    // Use global currentPage if available, otherwise use pagination data
    const current_page = currentPage || paginationData.current_page || 1;
    const total_pages = paginationData.total_pages || 1;
    
    console.log('Current page:', current_page, 'Total pages:', total_pages);
    
    if (total_pages <= 1) {
        console.log('Only 1 page, no pagination needed');
        container.innerHTML = '';
        return;
    }
    
    let html = '';
    
    // Previous button
    if (current_page > 1) {
        html += `<button onclick="changePage(${current_page - 1})" class="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded transition">
            <i class="fas fa-chevron-left"></i>
        </button>`;
    }
    
    // Page numbers
    const startPage = Math.max(1, current_page - 2);
    const endPage = Math.min(total_pages, current_page + 2);
    
    for (let i = startPage; i <= endPage; i++) {
        const isActive = i === current_page;
        console.log(`Page ${i}: ${isActive ? 'ACTIVE' : 'inactive'}`);
        html += `<button onclick="changePage(${i})" class="px-3 py-2 ${isActive ? 'bg-purple-600' : 'bg-gray-700 hover:bg-gray-600'} rounded transition">
            ${i}
        </button>`;
    }
    
    // Next button
    if (current_page < total_pages) {
        html += `<button onclick="changePage(${current_page + 1})" class="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded transition">
            <i class="fas fa-chevron-right"></i>
        </button>`;
    }
    
    console.log('Pagination HTML:', html);
    container.innerHTML = html;
}

// Change page
function changePage(page) {
    console.log('Changing to page:', page);
    currentPage = page; // Update global currentPage
    
    if (searchQuery) {
        searchMovies(searchQuery, page);
    } else {
        loadNewMovies(page);
    }
}
