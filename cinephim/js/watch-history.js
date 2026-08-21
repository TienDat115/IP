// CinePhim - Watch History Page JavaScript

// Pagination variables
let currentPage = 1;
const itemsPerPage = 10;
let totalPages = 1;

document.addEventListener('DOMContentLoaded', async function() {
    await window.ensureConfigReady();
    // Check for page parameter in URL
    const urlParams = new URLSearchParams(window.location.search);
    const page = urlParams.get('page');
    
    // Load with page from URL (default to 1 if not specified)
    const pageNumber = page ? parseInt(page) : 1;
    currentPage = pageNumber;
    
    loadWatchHistory();
    setupSearchListeners();
    document.addEventListener('cinephim:auth-ready', () => {
        loadWatchHistory();
    });
});

async function loadWatchHistory() {
    try {
        // Load from Firebase if user is logged in
        if (currentUser) {
            const snapshot = await db.collection('users').doc(currentUser.uid).collection('watchHistory').orderBy('watchedAt', 'desc').get();
            
            watchHistory = [];
            snapshot.forEach(doc => {
                watchHistory.push(doc.data());
            });
            
        } else {
            // Empty array if not logged in
            watchHistory = [];
        }
        
        
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

// Remove duplicate watch history items
async function removeDuplicateHistory() {
    if (!watchHistory || watchHistory.length === 0) {
        Swal.fire({
            icon: 'info',
            title: 'Thông báo',
            text: 'Không có lịch sử để kiểm tra trùng lặp.',
            confirmButtonColor: '#8b5cf6'
        });
        return;
    }

    // Find duplicates based on movieSlug
    const uniqueMovies = new Map();
    const duplicates = [];
    
    watchHistory.forEach((item, index) => {
        const movieSlug = item.movieSlug;
        if (uniqueMovies.has(movieSlug)) {
            // This is a duplicate
            duplicates.push({
                movieSlug: movieSlug,
                movieTitle: item.movieTitle,
                originalIndex: uniqueMovies.get(movieSlug).index,
                duplicateIndex: index,
                originalWatchedAt: uniqueMovies.get(movieSlug).watchedAt,
                duplicateWatchedAt: item.watchedAt
            });
        } else {
            // First occurrence
            uniqueMovies.set(movieSlug, {
                index: index,
                watchedAt: item.watchedAt,
                data: item
            });
        }
    });

    if (duplicates.length === 0) {
        Swal.fire({
            icon: 'info',
            title: 'Thông báo',
            text: 'Không có lịch sử trùng lặp nào được tìm thấy.',
            confirmButtonColor: '#8b5cf6'
        });
        return;
    }

    // Show confirmation with details
    const duplicateList = duplicates.slice(0, 5).map(d => 
        `${d.movieTitle || d.movieSlug} (x2)`
    ).join('\n');
    
    const moreText = duplicates.length > 5 ? `\n... và ${duplicates.length - 5} phim khác` : '';

    const result = await Swal.fire({
        title: 'Xóa lịch sử trùng lặp',
        html: `
            <p>Tìm thấy <strong>${duplicates.length}</strong> phim có lịch sử trùng lặp.</p>
            <p class="text-sm text-gray-400 mt-2">Chỉ giữ lại bản xem gần nhất cho mỗi phim:</p>
            <div class="text-left mt-3 text-sm">
                <pre class="bg-gray-700 p-2 rounded">${duplicateList}${moreText}</pre>
            </div>
            <p class="text-sm text-orange-400 mt-3">Bạn có chắc chắn muốn xóa các bản trùng lặp?</p>
        `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#f97316',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'Xóa trùng lặp',
        cancelButtonText: 'Hủy'
    });

    if (result.isConfirmed) {
        try {
            if (currentUser) {
                // Process in Firebase
                const userRef = db.collection('users').doc(currentUser.uid);
                const historyRef = userRef.collection('watchHistory');
                
                // Get all documents to process duplicates more efficiently
                const allSnapshot = await historyRef.get();
                const movieGroups = new Map();
                
                // Group documents by movieSlug
                allSnapshot.forEach(doc => {
                    const data = doc.data();
                    const movieSlug = data.movieSlug;
                    if (!movieGroups.has(movieSlug)) {
                        movieGroups.set(movieSlug, []);
                    }
                    movieGroups.get(movieSlug).push({
                        doc: doc,
                        data: data,
                        watchedAt: data.watchedAt
                    });
                });

                // Create batch for deletions
                const batch = db.batch();
                let deletedCount = 0;

                // Process each movie group
                for (const [movieSlug, documents] of movieGroups) {
                    if (documents.length > 1) {
                        // Sort by watchedAt descending (newest first)
                        documents.sort((a, b) => {
                            const timeA = a.watchedAt.toDate ? a.watchedAt.toDate().getTime() : a.watchedAt.getTime();
                            const timeB = b.watchedAt.toDate ? b.watchedAt.toDate().getTime() : b.watchedAt.getTime();
                            return timeB - timeA;
                        });

                        // Keep the first (newest) document, delete the rest
                        for (let i = 1; i < documents.length; i++) {
                            batch.delete(documents[i].doc.ref);
                            deletedCount++;
                        }
                    }
                }

                if (deletedCount > 0) {
                    await batch.commit();
                }
            } else {
                // If not logged in, filter local array
                const uniqueMovies = new Map();
                const filteredHistory = [];
                
                watchHistory.forEach(item => {
                    const movieSlug = item.movieSlug;
                    if (!uniqueMovies.has(movieSlug)) {
                        uniqueMovies.set(movieSlug, true);
                        filteredHistory.push(item);
                    }
                });
                
                watchHistory = filteredHistory;
            }

            // Reload and display
            await loadWatchHistory();

            Swal.fire({
                icon: 'success',
                title: 'Thành công!',
                text: `Đã xóa các lịch sử trùng lặp. Chỉ giữ lại bản mới nhất cho mỗi phim.`,
                confirmButtonColor: '#8b5cf6',
                timer: 2000,
                showConfirmButton: false
            });

        } catch (error) {
            console.error('Error removing duplicate watch history:', error);
            
            // Show more detailed error information
            let errorMessage = 'Không thể xóa lịch sử trùng lặp. Vui lòng thử lại.';
            if (error.code === 'permission-denied') {
                errorMessage = 'Bạn không có quyền xóa lịch sử. Vui lòng đăng nhập lại.';
            } else if (error.code === 'unavailable') {
                errorMessage = 'Kết nối đến server bị gián đoạn. Vui lòng thử lại sau.';
            } else if (error.message) {
                errorMessage = `Lỗi: ${error.message}`;
            }
            
            Swal.fire({
                icon: 'error',
                title: 'Lỗi!',
                text: errorMessage,
                confirmButtonColor: '#8b5cf6'
            });
        }
    }
}

function displayWatchHistory() {
    // Wait a bit for DOM to be ready
    setTimeout(() => {
        const container = document.getElementById('watchHistoryGrid');
        
        if (!container) {
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
            const sourceKey = item.source || currentSourceKey;
            const sourceLabel = SOURCES[sourceKey]?.name || sourceKey;
            html += '<div class="film-card bg-gray-800 rounded-lg overflow-hidden cursor-pointer relative" onclick="showMovieDetail(\'' + item.movieSlug + '\', \'' + (item.source || '') + '\')">';
            html += '<div class="absolute top-2 right-2 z-10">';
            html += '<button onclick="event.stopPropagation(); removeFromWatchHistory(\'' + item.movieSlug + '\')" class="bg-red-600 hover:bg-red-700 p-2 rounded-full transition">';
            html += '<i class="fas fa-trash text-white text-xs"></i>';
            html += '</button></div>';
            html += '<div class="badge-quality" style="left:8px;right:auto">' + sourceLabel + '</div>';
            html += '<div class="absolute top-10 left-2 bg-black bg-opacity-75 px-2 py-1 rounded text-xs">';
            html += '<i class="fas fa-history text-gray-300 mr-1"></i>' + formatWatchTime(item.watchedAt);
            html += '</div>';
            html += '<div class="relative">';
            html += '<div class="w-full aspect-[2/3] bg-gray-700 flex items-center justify-center" id="poster-' + item.movieSlug + '">';
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
        
        container.innerHTML = html;
        
        // Load posters for each movie
        loadPosters();
    }, 100);
}

// Load posters for movies in watch history
async function loadPosters() {
    for (const item of watchHistory) {
        try {
            const posterContainer = document.getElementById('poster-' + item.movieSlug);
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
    paginationContainer.innerHTML = getPaginationHTML(currentPage, totalPages, 'goToPage({page})', 3);
}

function goToPage(page) {
    if (page < 1 || page > totalPages || page === currentPage) {
        return;
    }
    
    currentPage = page;
    
    // Update URL with page parameter
    const url = new URL(window.location);
    url.searchParams.set('page', page);
    window.history.pushState({}, '', url);
    
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
        }
        
        // Reload and display
        await loadWatchHistory();
        
        showToast('Đã xóa khỏi lịch sử xem', 'success');
    } catch (error) {
        console.error('Error removing from watch history:', error);
        
        showToast('Không thể xóa khỏi lịch sử xem', 'error');
    }
}


