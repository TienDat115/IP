// CinePhim - Countries Page JavaScript

// Global variables for this page
let currentPage = 1;
let currentCountry = '';

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    // Wait for common.js to initialize Firebase
    setTimeout(() => {
        loadCountries();
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
                    // Redirect to search results or implement search here
                    window.location.href = `index.html?search=${encodeURIComponent(query)}`;
                }
            }, 500);
        });
    }
}

// Load countries
function loadCountries() {
    const grid = document.getElementById('countriesGrid');
    if (!grid) return;
    
    grid.innerHTML = countries.map(country => `
        <div onclick="loadMoviesByCountry('${country.slug}')" 
             class="bg-gray-800 p-4 rounded-lg text-center cursor-pointer hover:bg-gray-700 transition">
            <i class="fas ${country.icon} text-3xl mb-2 text-purple-400"></i>
            <p class="text-sm">${country.name}</p>
        </div>
    `).join('');
}

// Load movies by country
async function loadMoviesByCountry(slug, page = 1) {
    showLoading();
    currentPage = page;
    currentCountry = slug;
    
    try {
        const response = await fetch(`${API_BASE}/films/quoc-gia/${slug}?page=${page}`);
        const data = await response.json();
        
        if (data.status === 'success') {
            // Hide countries grid and show movies section
            document.getElementById('countriesGrid').parentElement.classList.add('hidden');
            const moviesSection = document.getElementById('moviesSection');
            if (moviesSection) {
                moviesSection.classList.remove('hidden');
            }
            
            // Update country title
            const countryTitle = document.getElementById('countryTitle');
            if (countryTitle) {
                const country = countries.find(c => c.slug === slug);
                countryTitle.textContent = `Phim ${country ? country.name : slug}`;
            }
            
            displayMovies(data.items);
            displayPagination(data.pagination);
        } else {
            showError('Không thể tải danh sách phim theo quốc gia');
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
            current_page: currentPage || 1,
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
    currentPage = page;
    loadMoviesByCountry(currentCountry, page);
}

// Back to countries
function backToCountries() {
    // Show countries grid and hide movies section
    document.getElementById('countriesGrid').parentElement.classList.remove('hidden');
    const moviesSection = document.getElementById('moviesSection');
    if (moviesSection) {
        moviesSection.classList.add('hidden');
    }
    
    // Reset current page
    currentPage = 1;
    currentCountry = '';
}
