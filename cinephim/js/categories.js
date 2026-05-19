// CinePhim - Categories Page JavaScript

// Global variables for this page
let currentPage = 1;
let currentCategory = '';
let totalPages = 1;

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    // Wait for common.js to initialize Firebase
    setTimeout(() => {
        setupEventListeners();
        // Check if category is in URL params
        const urlParams = new URLSearchParams(window.location.search);
        const category = urlParams.get('category');
        const page = urlParams.get('page');
        
        if (category) {
            const radio = document.querySelector(`input[name="category"][value="${category}"]`);
            if (radio) {
                radio.checked = true;
                // Update display text
                const selectedCategorySpan = document.getElementById('selectedCategory');
                if (selectedCategorySpan) {
                    const displayName = getCategoryDisplayName(category);
                    selectedCategorySpan.textContent = displayName;
                }
            }
            // Load with page from URL (default to 1 if not specified)
            const pageNumber = page ? parseInt(page) : 1;
            loadMoviesByCategory(category, pageNumber);
        }
    }, 1500);
});

// Setup event listeners
function setupEventListeners() {
    // Add event listeners for radio buttons to update display text
    const radioButtons = document.querySelectorAll('input[name="category"]');
    radioButtons.forEach(radio => {
        radio.addEventListener('change', function(e) {
            const selectedCategorySpan = document.getElementById('selectedCategory');
            if (selectedCategorySpan) {
                const displayName = getCategoryDisplayName(e.target.value);
                selectedCategorySpan.textContent = displayName;
            }
            
            // Load movies for selected category
            loadMoviesByCategory(e.target.value, 1);
        });
    });
}

// Load movies by category
async function loadMoviesByCategory(category, page = 1) {
    if (!category) {
        showWarning('Vui lòng chọn thể loại để xem phim.');
        return;
    }
    
    try {
        showLoading(true);
        hideNoResults();
        
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
        }
        
        const response = await fetch(getApiUrl(`${API_BASE}${endpoint}?page=${page}`));
        
        if (!response.ok) {
            throw new Error('Failed to fetch category movies');
        }
        
        const data = await response.json();
        
        if (data.status === 'success' || data.status === true) {
            const pathImage = data.pathImage || data.data?.pathImage || data.data?.APP_DOMAIN_CDN_IMAGE || '';
            const movies = (data.items || data.data?.items || []).map(item => normalizeMovieData(item, pathImage));
            displayMovies(movies);
            
            const pagination = normalizePagination(data);
            updatePagination(pagination);
            
            // Update page title
            const categoryName = getCategoryDisplayName(category);
            document.title = `Phim ${categoryName} - CinePhim`;
            
            // Update breadcrumb
            updateBreadcrumb(categoryName);
            
            // Scroll to movies container after loading category
            setTimeout(() => {
                const moviesContainer = document.getElementById('moviesContainer');
                if (moviesContainer) {
                    moviesContainer.scrollIntoView({ 
                        behavior: 'smooth', 
                        block: 'start' 
                    });
                }
            }, 100);
            
        } else {
            showNoResults();
        }
        
        showLoading(false);
        
    } catch (error) {
        console.error('Error loading category movies:', error);
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
    
    if (!paginationContainer) {
        console.error('Pagination container not found');
        return;
    }
    
    // Handle different pagination structures
    let paginationData = paginate;
    
    // If pagination is nested in data.paginate
    if (pagination && pagination.paginate) {
        paginationData = pagination.paginate;
    }
    
    // If no pagination data, create default pagination
    if (!paginationData) {
        console.log('No pagination data, creating default');
        paginationData = {
            current_page: currentPage || 1,
            total_page: 5,
            total_items: 50
        };
    }
    
    // Use global currentPage if available, otherwise use pagination data
    const current = currentPage || paginationData.current_page || 1;
    const total = paginationData.total_page || 1;
    
    console.log('Current page:', current, 'Total pages:', total);
    
    if (total <= 1) {
        console.log('Only 1 page, no pagination needed');
        paginationContainer.innerHTML = '';
        return;
    }
    
    let paginationHTML = '';
    
    // Previous button
    if (current > 1) {
        paginationHTML += `
            <button onclick="loadMoviesByCategory('${currentCategory}', ${current - 1})" 
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
            <button onclick="loadMoviesByCategory('${currentCategory}', ${i})" 
                    class="px-3 py-2 ${isActive ? 'bg-purple-600' : 'bg-gray-700 hover:bg-gray-600'} rounded-lg transition">
                ${i}
            </button>
        `;
    }
    
    // Next button
    if (current < total) {
        paginationHTML += `
            <button onclick="loadMoviesByCategory('${currentCategory}', ${current + 1})" 
                    class="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition">
                <i class="fas fa-chevron-right"></i>
            </button>
        `;
    }
    
    paginationContainer.innerHTML = paginationHTML;
}

// Get category display name
function getCategoryDisplayName(categorySlug) {
    const categoryNames = {
        'hanh-dong': 'Hành Động',
        'phieu-luu': 'Phiêu Lưu',
        'hoat-hinh': 'Hoạt Hình',
        'phim-hai': 'Phim Hài',
        'hinh-su': 'Hình Sự',
        'tai-lieu': 'Tài Liệu',
        'chinh-kich': 'Chính Kịch',
        'gia-dinh': 'Gia Đình',
        'gia-tuong': 'Giả Tưởng',
        'lich-su': 'Lịch Sử',
        'kinh-di': 'Kinh Dị',
        'phim-nhac': 'Phim Nhạc',
        'bi-an': 'Bí Ẩn',
        'lang-man': 'Lãng Mạn',
        'khoa-hoc-vien-tuong': 'Khoa Học Viễn Tưởng',
        'gay-can': 'Gây Cấn',
        'chien-tranh': 'Chiến Tranh',
        'mien-tay': 'Miền Tây',
        'co-trang': 'Cổ Trang',
        'tam-ly': 'Tâm Lý',
        'tinh-cam': 'Tình Cảm'
    };
    
    return categoryNames[categorySlug] || categorySlug;
}

// Update breadcrumb
function updateBreadcrumb(categoryName) {
    const breadcrumbContainer = document.querySelector('nav .text-gray-400');
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

function showWarning(message) {
    Swal.fire({
        icon: 'warning',
        title: 'Cảnh báo',
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
