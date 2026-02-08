// CinePhim - Watch History Page JavaScript

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
            const userRef = db.collection('users').doc(currentUser.uid);
            const historyRef = userRef.collection('watchHistory');
            const snapshot = await historyRef.get();
            
            watchHistory = [];
            snapshot.forEach(doc => {
                watchHistory.push(doc.data());
            });
            
            console.log('Loaded watch history from Firebase:', watchHistory);
        } else {
            // Fallback to localStorage if not logged in
            watchHistory = JSON.parse(localStorage.getItem('watchHistory') || '[]');
            console.log('Loaded watch history from localStorage:', watchHistory);
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
                    <p class="text-xs mt-4 text-gray-500">Mẹo: Mở Developer Console (F12) để xem logs</p>
                </div>
            `;
            return;
        }
        
        displayWatchHistory();
    } catch (error) {
        console.error('Error loading watch history:', error);
        // Fallback to localStorage
        watchHistory = JSON.parse(localStorage.getItem('watchHistory') || '[]');
        displayWatchHistory();
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
        
        // Clear from localStorage as fallback
        localStorage.setItem('watchHistory', JSON.stringify(watchHistory));
        displayWatchHistory();
        
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
            return;
        }
        
        let html = '';
        watchHistory.forEach((item, index) => {
            console.log('Building HTML for item ' + index + ':', item);
            html += '<div class="film-card bg-gray-800 rounded-lg overflow-hidden cursor-pointer relative" onclick="showMovieDetail(\'' + item.movieSlug + '\')">';
            html += '<div class="absolute top-2 right-2 z-10">';
            html += '<button onclick="event.stopPropagation(); removeFromWatchHistory(\'' + item.movieSlug + '\')" class="bg-red-600 hover:bg-red-700 p-2 rounded-full transition">';
            html += '<i class="fas fa-trash text-white text-xs"></i>';
            html += '</button></div>';
            html += '<div class="absolute top-2 left-2 bg-black bg-opacity-75 px-2 py-1 rounded text-xs">';
            html += '<i class="fas fa-history text-gray-300 mr-1"></i>' + formatWatchTime(item.watchedAt);
            html += '</div>';
            html += '<div class="relative">';
            html += '<div class="aspect-video bg-gray-700 flex items-center justify-center" id="poster-' + item.movieSlug + '">';
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
                        <img src="${data.movie.poster_url || data.movie.thumb_url || 'https://via.placeholder.com/300x450/374151/ffffff?text=No+Poster'}" 
                             alt="${data.movie.name || data.movie.title || item.movieTitle}" 
                             class="w-full h-full object-cover"
                             onerror="this.src='https://via.placeholder.com/300x450/374151/ffffff?text=No+Poster'">
                    `;
                }
            }
        } catch (error) {
            console.error('Error loading poster for', item.movieSlug, ':', error);
        }
    }
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
        } else {
            // Remove from localStorage
            watchHistory = watchHistory.filter(item => item.movieSlug !== movieSlug);
            localStorage.setItem('watchHistory', JSON.stringify(watchHistory));
        }
        
        // Reload and display
        await loadWatchHistory();
    } catch (error) {
        console.error('Error removing from watch history:', error);
        // Fallback to localStorage
        watchHistory = watchHistory.filter(item => item.movieSlug !== movieSlug);
        localStorage.setItem('watchHistory', JSON.stringify(watchHistory));
        displayWatchHistory();
    }
}
