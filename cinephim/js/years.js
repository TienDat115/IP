// CinePhim - Years Page JavaScript

let currentPage = 1;
let currentYear = '';

document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        loadYears();
        setupEventListeners();
    }, 1500);
});

function setupEventListeners() {
    const searchInput = document.getElementById('searchInput');
    let searchTimeout;
    
    if (searchInput) {
        searchInput.addEventListener('input', function(e) {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                const query = e.target.value.trim();
                if (query) {
                    window.location.href = `index.html?search=${encodeURIComponent(query)}`;
                }
            }, 500);
        });
    }
}

function loadYears() {
    const grid = document.getElementById('yearsGrid');
    if (!grid) return;
    
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = currentYear; i >= currentYear - 20; i--) {
        years.push(i);
    }
    
    grid.innerHTML = years.map(year => `
        <div onclick="loadMoviesByYear(${year})" 
             class="bg-gray-800 p-3 rounded-lg text-center cursor-pointer hover:bg-gray-700 transition">
            <p class="text-sm font-semibold">${year}</p>
        </div>
    `).join('');
}

async function loadMoviesByYear(year, page = 1) {
    showLoading();
    currentPage = page;
    currentYear = year;
    
    try {
        const response = await fetch(`${API_BASE}/films/nam-phat-hanh/${year}?page=${page}`);
        const data = await response.json();
        
        if (data.status === 'success') {
            document.getElementById('yearsGrid').parentElement.classList.add('hidden');
            const moviesSection = document.getElementById('moviesSection');
            if (moviesSection) {
                moviesSection.classList.remove('hidden');
            }
            
            const yearTitle = document.getElementById('yearTitle');
            if (yearTitle) {
                yearTitle.textContent = `Phim năm ${year}`;
            }
            
            displayMovies(data.items);
            displayPagination(data.pagination);
        } else {
            showError('Không thể tải danh sách phim theo năm');
        }
    } catch (error) {
        showError('Lỗi kết nối đến server');
    } finally {
        hideLoading();
    }
}

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

function displayPagination(pagination) {
    const container = document.getElementById('pagination');
    
    if (!container) {
        console.error('Pagination container not found');
        return;
    }
    
    let paginationData = pagination;
    
    if (pagination && pagination.pagination) {
        paginationData = pagination.pagination;
    }
    
    if (!paginationData) {
        paginationData = {
            current_page: currentPage || 1,
            total_pages: 5,
            total_items: 50
        };
    }
    
    const current_page = currentPage || paginationData.current_page || 1;
    const total_pages = paginationData.total_pages || 1;
    
    if (total_pages <= 1) {
        container.innerHTML = '';
        return;
    }
    
    let html = '';
    
    if (current_page > 1) {
        html += `<button onclick="changePage(${current_page - 1})" class="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded transition">
            <i class="fas fa-chevron-left"></i>
        </button>`;
    }
    
    const startPage = Math.max(1, current_page - 2);
    const endPage = Math.min(total_pages, current_page + 2);
    
    for (let i = startPage; i <= endPage; i++) {
        const isActive = i === current_page;
        html += `<button onclick="changePage(${i})" class="px-3 py-2 ${isActive ? 'bg-purple-600' : 'bg-gray-700 hover:bg-gray-600'} rounded transition">
            ${i}
        </button>`;
    }
    
    if (current_page < total_pages) {
        html += `<button onclick="changePage(${current_page + 1})" class="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded transition">
            <i class="fas fa-chevron-right"></i>
        </button>`;
    }
    
    container.innerHTML = html;
}

function changePage(page) {
    currentPage = page;
    loadMoviesByYear(currentYear, page);
}

function backToYears() {
    document.getElementById('yearsGrid').parentElement.classList.remove('hidden');
    const moviesSection = document.getElementById('moviesSection');
    if (moviesSection) {
        moviesSection.classList.add('hidden');
    }
    
    currentPage = 1;
    currentYear = '';
}
