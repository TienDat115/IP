// CinePhim - Watch History Page JavaScript

// Pagination variables
let currentPage = 1;
const itemsPerPage = 10;
let totalPages = 1;

document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        loadWatchHistory();
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

async function loadWatchHistory() {
    try {
        // Load from Firebase if user is logged in
        if (currentUser) {
            const snapshot = await db.collection('users').doc(currentUser.uid).collection('watchHistory').orderBy('watchedAt', 'desc').get();
            
            watchHistory = [];
            snapshot.forEach(doc => {
                watchHistory.push(doc.data());
            });
            
            console.log('Loaded watch history from Firebase:', watchHistory);
        } else {
            // Empty array if not logged in
            watchHistory = [];
            console.log('User not logged in, watch history set to empty array');
        }
        
        console.log('Watch history length:', watchHistory.length);
        
        const grid = document.getElementById('watchHistoryGrid');
        if (!grid) return;
        
        if (watchHistory.length === 0) {
            grid.innerHTML = `
                <div class="col-span-full text-center py-8 text-gray-400">
                    <i class="fas fa-history text-4xl mb-4"></i>
                    <p>Chưa có lịch sử xem phim</p>
                    <p class="text-sm mt-2">Hãy xem một vài phim để lịch sử được hiển thị!</p>
                </div>
            `;
            return;
        }
        
        displayWatchHistory();
        updatePagination();
    } catch (error) {
        console.error('Error loading watch history:', error);
        watchHistory = [];
        displayWatchHistory();
        updatePagination();
    }
}

async function refreshWatchHistory() {
    await loadWatchHistory();
}

async function clearWatchHistory() {
    const result = await Swal.fire({
        title: 'Xác nhận xóa lịch sử',
        text: 'Bạn có chắc chắn muốn xóa toàn bộ lịch sử xem phim?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'Xóa',
        cancelButtonText: 'Hủy'
    });
    
    if (result.isConfirmed) {
        watchHistory = [];
        
        // Clear from Firebase if user is logged in
        if (currentUser) {
            try {
                const userRef = db.collection('users').doc(currentUser.uid);
                const historyRef = userRef.collection('watchHistory');
                const snapshot = await historyRef.get();
                const batch = db.batch();
                
                snapshot.forEach(doc => {
                    batch.delete(doc.ref);
                });
                
                await batch.commit();
                console.log('Watch history cleared from Firebase');
            } catch (error) {
                console.error('Error clearing watch history:', error);
            }
        }
        
        displayWatchHistory();
        updatePagination();
        
        Swal.fire({
            icon: 'success',
            title: 'Thành công!',
            text: 'Lịch sử đã được xóa.',
            confirmButtonColor: '#8b5cf6',
            timer: 1500,
            showConfirmButton: false
        });
    }
}

function displayWatchHistory() {
    console.log('displayWatchHistory() called');
    
    // Wait a bit for DOM to be ready
    setTimeout(() => {
        const container = document.getElementById('watchHistoryGrid');
        console.log('Container found:', container);
        console.log('Watch history data:', watchHistory);
        
        if (!container) {
            console.log('Container not found!');
            return;
        }
        
        if (!watchHistory || watchHistory.length === 0) {
            container.innerHTML = '<div class="col-span-full text-center py-8 text-gray-400"><i class="fas fa-history text-4xl mb-4"></i><p>Không có dữ liệu lịch sử</p></div>';
            document.getElementById('pagination').innerHTML = '';
            return;
        }
        
        // Calculate pagination
        totalPages = Math.ceil(watchHistory.length / itemsPerPage);
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const currentItems = watchHistory.slice(startIndex, endIndex);
        
        let html = '';
        currentItems.forEach((item, index) => {
            const actualIndex = startIndex + index;
            console.log('Building HTML for item ' + actualIndex + ':', item);
            html += '<div class="film-card bg-gray-800 rounded-lg overflow-hidden cursor-pointer relative" onclick="showMovieDetail(\'' + item.movieSlug + '\')">';
            html += '<div class="absolute top-2 right-2 z-10">';
            html += '<button onclick="event.stopPropagation(); removeFromWatchHistory(\'' + item.movieSlug + '\')" class="bg-red-600 hover:bg-red-700 p-2 rounded-full transition">';
            html += '<i class="fas fa-trash text-white text-xs"></i>';
            html += '</button></div>';
            html += '<div class="absolute top-2 left-2 bg-black bg-opacity-75 px-2 py-1 rounded text-xs">';
            html += '<i class="fas fa-history text-gray-300 mr-1"></i>' + formatWatchTime(item.watchedAt);
            html += '</div>';
            html += '<div class="relative">';
            html += '<div class="film-poster w-full bg-gray-700 flex items-center justify-center" id="poster-' + item.movieSlug + '">';
            html += '<i class="fas fa-film text-4xl text-gray-500"></i>';
            html += '</div>';
            html += '<div class="absolute bottom-2 left-2 bg-purple-600 px-2 py-1 rounded text-xs font-semibold">';
            html += (item.episodeName || 'Tập phim');
            html += '</div>';
            html += '</div>';
            html += '<div class="p-4">';
            html += '<h4 class="font-semibold text-sm mb-2 line-clamp-2">' + (item.movieTitle || 'Phim không xác định') + '</h4>';
            html += '<p class="text-gray-400 text-xs mb-2">' + (item.episodeName || 'Không có thông tin tập') + '</p>';
            html += '</div>';
            html += '</div>';
        });
        
        // Clean up any zero-width spaces
        html = html.replace(/​/g, '');
        
        console.log('Final HTML length:', html.length);
        console.log('Setting innerHTML...');
        container.innerHTML = html;
        console.log('Container innerHTML set successfully');
        console.log('Container display:', container.style.display);
        console.log('Container children count:', container.children.length);
        
        // Load posters for each movie
        loadPosters();
    }, 100);
}

// Load posters for movies in watch history
async function loadPosters() {
    for (const item of watchHistory) {
        try {
            const response = await fetch(`${API_BASE}/film/${item.movieSlug}`);
            const data = await response.json();
            
            if (data.status === 'success' && data.movie) {
                const posterContainer = document.getElementById('poster-' + item.movieSlug);
                if (posterContainer) {
                    posterContainer.innerHTML = `
                        <img src="${getVerticalImage(data.movie.poster_url, data.movie.thumb_url)}" 
                             alt="${data.movie.name || data.movie.title || item.movieTitle}" 
                             class="film-poster w-full"
                             onerror="this.src='https://via.placeholder.com/300x450/374151/ffffff?text=No+Poster'">
                    `;
                }
            }
        } catch (error) {
            console.error('Error loading poster for', item.movieSlug, ':', error);
        }
    }
}

// Pagination functions
function updatePagination() {
    const paginationContainer = document.getElementById('pagination');
    
    if (!watchHistory || watchHistory.length === 0) {
        paginationContainer.innerHTML = '';
        return;
    }
    
    totalPages = Math.ceil(watchHistory.length / itemsPerPage);
    
    let paginationHTML = '';
    
    // Previous button
    paginationHTML += `
        <button onclick="goToPage(${currentPage - 1})" 
                class="px-3 py-2 rounded-lg text-sm font-medium transition ${
                    currentPage === 1 
                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed' 
                    : 'bg-gray-700 text-white hover:bg-gray-600'
                }" 
                ${currentPage === 1 ? 'disabled' : ''}>
            <i class="fas fa-chevron-left"></i>
        </button>
    `;
    
    // Page numbers
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage < maxVisiblePages - 1) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    if (startPage > 1) {
        paginationHTML += `
            <button onclick="goToPage(1)" class="px-3 py-2 rounded-lg text-sm font-medium bg-gray-700 text-white hover:bg-gray-600 transition">1</button>
        `;
        if (startPage > 2) {
            paginationHTML += `<span class="px-2 text-gray-400">...</span>`;
        }
    }
    
    for (let i = startPage; i <= endPage; i++) {
        paginationHTML += `
            <button onclick="goToPage(${i})" 
                    class="px-3 py-2 rounded-lg text-sm font-medium transition ${
                        i === currentPage 
                        ? 'bg-purple-600 text-white' 
                        : 'bg-gray-700 text-white hover:bg-gray-600'
                    }">
                ${i}
            </button>
        `;
    }
    
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            paginationHTML += `<span class="px-2 text-gray-400">...</span>`;
        }
        paginationHTML += `
            <button onclick="goToPage(${totalPages})" class="px-3 py-2 rounded-lg text-sm font-medium bg-gray-700 text-white hover:bg-gray-600 transition">${totalPages}</button>
        `;
    }
    
    // Next button
    paginationHTML += `
        <button onclick="goToPage(${currentPage + 1})" 
                class="px-3 py-2 rounded-lg text-sm font-medium transition ${
                    currentPage === totalPages 
                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed' 
                    : 'bg-gray-700 text-white hover:bg-gray-600'
                }" 
                ${currentPage === totalPages ? 'disabled' : ''}>
            <i class="fas fa-chevron-right"></i>
        </button>
    `;
    
    paginationContainer.innerHTML = paginationHTML;
}

function goToPage(page) {
    if (page < 1 || page > totalPages || page === currentPage) {
        return;
    }
    
    currentPage = page;
    displayWatchHistory();
    updatePagination();
    
    // Scroll to top of the grid
    document.getElementById('watchHistoryGrid').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function removeFromWatchHistory(movieSlug) {
    try {
        if (currentUser) {
            // Remove from Firebase
            const userRef = db.collection('users').doc(currentUser.uid);
            const historyRef = userRef.collection('watchHistory');
            const snapshot = await historyRef.where('movieSlug', '==', movieSlug).get();
            
            const batch = db.batch();
            snapshot.forEach(doc => {
                batch.delete(doc.ref);
            });
            
            await batch.commit();
            console.log('Removed from Firebase watch history:', movieSlug);
        }
        
        // Reload and display
        await loadWatchHistory();
        
        Swal.fire({
            icon: 'success',
            title: 'Đã xóa',
            text: 'Đã xóa khỏi lịch sử xem',
            confirmButtonColor: '#8b5cf6',
            timer: 1500,
            showConfirmButton: false
        });
    } catch (error) {
        console.error('Error removing from watch history:', error);
        
        Swal.fire({
            icon: 'success',
            title: 'Đã xóa',
            text: 'Đã xóa khỏi lịch sử xem',
            confirmButtonColor: '#8b5cf6',
            timer: 1500,
            showConfirmButton: false
        });
    }
}
