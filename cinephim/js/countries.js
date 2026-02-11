// Countries Page JavaScript
let currentPage = 1;
let currentCountry = '';
let totalPages = 1;

// Initialize page when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializePage();
});

// Initialize the page
async function initializePage() {
    try {
        // Listen for auth state changes
        auth.onAuthStateChanged((user) => {
            updateAuthUI();
        });
        
        // Check for country parameter in URL
        const urlParams = new URLSearchParams(window.location.search);
        const countryParam = urlParams.get('country');
        
        if (countryParam) {
            document.getElementById('countrySelect').value = countryParam;
            await loadCountryMovies();
        }
        
        // Add enter key support for country selection
        document.getElementById('countrySelect').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                loadCountryMovies();
            }
        });
        
    } catch (error) {
        console.error('Error initializing page:', error);
        showError('Có lỗi xảy ra khi tải trang. Vui lòng thử lại.');
    }
}

// Load movies by country
async function loadCountryMovies(page = 1) {
    const countrySelect = document.getElementById('countrySelect');
    const selectedCountry = countrySelect.value;
    
    if (!selectedCountry) {
        showWarning('Vui lòng chọn quốc gia để xem phim.');
        return;
    }
    
    try {
        showLoading(true);
        hideNoResults();
        
        currentCountry = selectedCountry;
        currentPage = page;
        
        // Scroll to top when changing page
        window.scrollTo(0, 0);
        
        const response = await fetch(`${API_BASE}/films/quoc-gia/${selectedCountry}?page=${page}`);
        
        if (!response.ok) {
            throw new Error('Failed to fetch country movies');
        }
        
        const data = await response.json();
        
        if (data.status === 'success' && data.items) {
            displayMovies(data.items);
            updatePagination(data.paginate);
            
            // Update page title
            const countryName = getCountryDisplayName(selectedCountry);
            document.title = `Phim ${countryName} - CinePhim`;
            
            // Update breadcrumb
            updateBreadcrumb(countryName);
            
        } else {
            showNoResults();
        }
        
        showLoading(false);
        
    } catch (error) {
        console.error('Error loading country movies:', error);
        showError('Không thể tải danh sách phim. Vui lòng thử lại.');
        showLoading(false);
    }
}

// Display movies
function displayMovies(movies) {
    const moviesGrid = document.getElementById('moviesGrid');
    
    if (!movies || movies.length === 0) {
        showNoResults();
        return;
    }
    
    moviesGrid.innerHTML = movies.map(movie => `
        <div class="bg-gray-800 rounded-lg overflow-hidden hover:transform hover:scale-105 transition cursor-pointer" onclick="goToMovieDetail('${movie.slug}')">
            <div class="relative">
                <img src="${getVerticalImage(movie.poster_url, movie.thumb_url)}" 
                     alt="${movie.name || movie.title}" 
                     class="w-full h-64 object-cover"
                     onerror="this.src='https://via.placeholder.com/300x450/374151/ffffff?text=No+Poster'">
                ${movie.quality ? `<span class="absolute top-2 right-2 bg-red-600 text-white px-2 py-1 text-xs rounded">${movie.quality}</span>` : ''}
                ${movie.year ? `<span class="absolute top-2 left-2 bg-gray-900 bg-opacity-75 text-white px-2 py-1 text-xs rounded">${movie.year}</span>` : ''}
            </div>
            <div class="p-3">
                <h3 class="font-medium text-sm truncate mb-1">${movie.name || movie.title}</h3>
                <p class="text-xs text-gray-400 line-clamp-2">${movie.content || movie.description || 'Không có mô tả'}</p>
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
            <button onclick="loadCountryMovies(${current - 1})" 
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
            <button onclick="loadCountryMovies(${i})" 
                    class="px-3 py-2 ${isActive ? 'bg-purple-600' : 'bg-gray-700 hover:bg-gray-600'} rounded-lg transition">
                ${i}
            </button>
        `;
    }
    
    // Next button
    if (current < total) {
        paginationHTML += `
            <button onclick="loadCountryMovies(${current + 1})" 
                    class="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition">
                <i class="fas fa-chevron-right"></i>
            </button>
        `;
    }
    
    paginationContainer.innerHTML = paginationHTML;
}

// Get country display name
function getCountryDisplayName(countrySlug) {
    const countryNames = {
        'au-my': 'Âu Mỹ',
        'anh': 'Anh',
        'trung-quoc': 'Trung Quốc',
        'indonesia': 'Indonesia',
        'viet-nam': 'Việt Nam',
        'argentina': 'Argentina',
        'ao': 'Áo',
        'uc': 'Úc',
        'bangladesh': 'Bangladesh',
        'brazil': 'Brazil',
        'bahamas': 'Bahamas',
        'belarus': 'Belarus',
        'canada': 'Canada',
        'thuy-si': 'Thụy Sĩ',
        'bo-bien-nga': 'Bờ Biển Ngà',
        'chile': 'Chile',
        'colombia': 'Colombia',
        'costa-rica': 'Costa Rica',
        'duc': 'Đức',
        'dan-mach': 'Đan Mạch',
        'tay-ban-nha': 'Tây Ban Nha',
        'phap': 'Pháp',
        'greenland': 'Greenland',
        'hong-kong': 'Hồng Kông',
        'han-quoc': 'Hàn Quốc',
        'nhat-ban': 'Nhật Bản',
        'thai-lan': 'Thái Lan',
        'dai-loan': 'Đài Loan',
        'nga': 'Nga',
        'ha-lan': 'Hà Lan',
        'quoc-gia-khac': 'Quốc gia khác',
        'philippines': 'Philippines',
        'an-do': 'Ấn Độ'
    };
    
    return countryNames[countrySlug] || countrySlug;
}

// Update breadcrumb
function updateBreadcrumb(countryName) {
    const breadcrumbContainer = document.querySelector('nav .text-gray-400');
    if (breadcrumbContainer) {
        breadcrumbContainer.innerHTML = `
            <a href="index.html" class="hover:text-purple-400 transition">Trang chủ</a>
            <i class="fas fa-chevron-right text-xs"></i>
            <span class="text-white">Phim theo quốc gia</span>
            <i class="fas fa-chevron-right text-xs"></i>
            <span class="text-white">${countryName}</span>
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
