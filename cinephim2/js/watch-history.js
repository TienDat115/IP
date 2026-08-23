// CinePhim - Watch History Page JavaScript

// Pagination variables
var currentPage = 1;
var itemsPerPage = 10;
var totalPages = 1;

document.addEventListener('DOMContentLoaded', function() {
    window.ensureConfigReady().then(function() {
        // Check for page parameter in URL
        var urlParams = new URLSearchParams(window.location.search);
        var page = urlParams.get('page');
        
        // Load with page from URL (default to 1 if not specified)
        var pageNumber = page ? parseInt(page) : 1;
        currentPage = pageNumber;
        
        loadWatchHistory();
        setupSearchListeners();
    });
    document.addEventListener('cinephim:auth-ready', function() {
        loadWatchHistory();
    });
});

function loadWatchHistory() {
    return new Promise(function(resolve, reject) {
        try {
            // Load from Firebase if user is logged in
            if (currentUser) {
                db.collection('users').doc(currentUser.uid).collection('watchHistory').orderBy('watchedAt', 'desc').get().then(function(snapshot) {
                    watchHistory = [];
                    snapshot.forEach(function(doc) {
                        var docData = doc.data();
                        var item = {};
                        for (var key in docData) {
                            if (docData.hasOwnProperty(key)) {
                                item[key] = docData[key];
                            }
                        }
                        item._docId = doc.id;
                        watchHistory.push(item);
                    });
                    
                    displayWatchHistory();
                    updatePagination();
                    resolve();
                }).catch(function(error) {
                    console.error('Error loading watch history:', error);
                    watchHistory = [];
                    displayWatchHistory();
                    updatePagination();
                    resolve();
                });
            } else {
                // Empty array if not logged in
                watchHistory = [];
                displayWatchHistory();
                updatePagination();
                resolve();
            }
        } catch (error) {
            console.error('Error loading watch history:', error);
            watchHistory = [];
            displayWatchHistory();
            updatePagination();
            resolve();
        }
    });
}

function refreshWatchHistory() {
    return loadWatchHistory();
}

function clearWatchHistory() {
    return Swal.fire({
        title: 'Xác nhận xóa lịch sử',
        text: 'Bạn có chắc chắn muốn xóa toàn bộ lịch sử xem phim?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'Xóa',
        cancelButtonText: 'Hủy'
    }).then(function(result) {
        if (result.isConfirmed) {
            watchHistory = [];
            
            // Clear from Firebase if user is logged in
            if (currentUser) {
                var userRef = db.collection('users').doc(currentUser.uid);
                var historyRef = userRef.collection('watchHistory');
                return historyRef.get().then(function(snapshot) {
                    var batch = db.batch();
                    
                    snapshot.forEach(function(doc) {
                        batch.delete(doc.ref);
                    });
                    
                    return batch.commit();
                }).catch(function(error) {
                    console.error('Error clearing watch history:', error);
                    return Promise.resolve();
                }).then(function() {
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
                });
            } else {
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
                return Promise.resolve();
            }
        }
    });
}

// Remove duplicate watch history items
function removeDuplicateHistory() {
    if (!watchHistory || watchHistory.length === 0) {
        Swal.fire({
            icon: 'info',
            title: 'Thông báo',
            text: 'Không có lịch sử để kiểm tra trùng lặp.',
            confirmButtonColor: '#8b5cf6'
        });
        return Promise.resolve();
    }

    // Find duplicates based on movieSlug
    var uniqueMovies = {};
    var duplicates = [];
    
    watchHistory.forEach(function(item, index) {
        var movieSlug = item.movieSlug;
        if (uniqueMovies[movieSlug]) {
            // This is a duplicate
            duplicates.push({
                movieSlug: movieSlug,
                movieTitle: item.movieTitle,
                originalIndex: uniqueMovies[movieSlug].index,
                duplicateIndex: index,
                originalWatchedAt: uniqueMovies[movieSlug].watchedAt,
                duplicateWatchedAt: item.watchedAt
            });
        } else {
            // First occurrence
            uniqueMovies[movieSlug] = {
                index: index,
                watchedAt: item.watchedAt,
                data: item
            };
        }
    });

    if (duplicates.length === 0) {
        Swal.fire({
            icon: 'info',
            title: 'Thông báo',
            text: 'Không có lịch sử trùng lặp nào được tìm thấy.',
            confirmButtonColor: '#8b5cf6'
        });
        return Promise.resolve();
    }

    // Show confirmation with details
    var duplicateListItems = duplicates.slice(0, 5).map(function(d) {
        return (d.movieTitle || d.movieSlug) + ' (x2)';
    });
    var duplicateList = duplicateListItems.join('\n');
    
    var moreText = duplicates.length > 5 ? ('\n... và ' + (duplicates.length - 5) + ' phim khác') : '';

    return Swal.fire({
        title: 'Xóa lịch sử trùng lặp',
        html: '<p>Tìm thấy <strong>' + duplicates.length + '</strong> phim có lịch sử trùng lặp.</p>' +
            '<p class="text-sm text-gray-400 mt-2">Chỉ giữ lại bản xem gần nhất cho mỗi phim:</p>' +
            '<div class="text-left mt-3 text-sm">' +
            '<pre class="bg-gray-700 p-2 rounded">' + duplicateList + moreText + '</pre>' +
            '</div>' +
            '<p class="text-sm text-orange-400 mt-3">Bạn có chắc chắn muốn xóa các bản trùng lặp?</p>',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#f97316',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'Xóa trùng lặp',
        cancelButtonText: 'Hủy'
    }).then(function(result) {
        if (result.isConfirmed) {
            if (currentUser) {
                // Process in Firebase
                var userRef = db.collection('users').doc(currentUser.uid);
                var historyRef = userRef.collection('watchHistory');
                
                // Get all documents to process duplicates more efficiently
                return historyRef.get().then(function(allSnapshot) {
                    var movieGroups = {};
                    
                    // Group documents by movieSlug
                    allSnapshot.forEach(function(doc) {
                        var data = doc.data();
                        var movieSlug = data.movieSlug;
                        if (!movieGroups[movieSlug]) {
                            movieGroups[movieSlug] = [];
                        }
                        movieGroups[movieSlug].push({
                            doc: doc,
                            data: data,
                            watchedAt: data.watchedAt
                        });
                    });

                    // Create batch for deletions
                    var batch = db.batch();
                    var deletedCount = 0;

                    // Process each movie group
                    for (var slug in movieGroups) {
                        if (movieGroups.hasOwnProperty(slug)) {
                            var documents = movieGroups[slug];
                            if (documents.length > 1) {
                                // Sort by watchedAt descending (newest first)
                                documents.sort(function(a, b) {
                                    var timeA = a.watchedAt.toDate ? a.watchedAt.toDate().getTime() : a.watchedAt.getTime();
                                    var timeB = b.watchedAt.toDate ? b.watchedAt.toDate().getTime() : b.watchedAt.getTime();
                                    return timeB - timeA;
                                });

                                // Keep the first (newest) document, delete the rest
                                for (var i = 1; i < documents.length; i++) {
                                    batch.delete(documents[i].doc.ref);
                                    deletedCount++;
                                }
                            }
                        }
                    }

                    if (deletedCount > 0) {
                        return batch.commit();
                    }
                }).then(function() {
                    // Reload and display
                    return loadWatchHistory();
                }).then(function() {
                    Swal.fire({
                        icon: 'success',
                        title: 'Thành công!',
                        text: 'Đã xóa các lịch sử trùng lặp. Chỉ giữ lại bản mới nhất cho mỗi phim.',
                        confirmButtonColor: '#8b5cf6',
                        timer: 2000,
                        showConfirmButton: false
                    });
                }).catch(function(error) {
                    console.error('Error removing duplicate watch history:', error);
                    
                    // Show more detailed error information
                    var errorMessage = 'Không thể xóa lịch sử trùng lặp. Vui lòng thử lại.';
                    if (error.code === 'permission-denied') {
                        errorMessage = 'Bạn không có quyền xóa lịch sử. Vui lòng đăng nhập lại.';
                    } else if (error.code === 'unavailable') {
                        errorMessage = 'Kết nối đến server bị gián đoạn. Vui lòng thử lại sau.';
                    } else if (error.message) {
                        errorMessage = 'Lỗi: ' + error.message;
                    }
                    
                    Swal.fire({
                        icon: 'error',
                        title: 'Lỗi!',
                        text: errorMessage,
                        confirmButtonColor: '#8b5cf6'
                    });
                });
            } else {
                // If not logged in, filter local array
                var uniqueMovies = {};
                var filteredHistory = [];
                
                watchHistory.forEach(function(item) {
                    var movieSlug = item.movieSlug;
                    if (!uniqueMovies[movieSlug]) {
                        uniqueMovies[movieSlug] = true;
                        filteredHistory.push(item);
                    }
                });
                
                watchHistory = filteredHistory;

                // Reload and display
                return loadWatchHistory().then(function() {
                    Swal.fire({
                        icon: 'success',
                        title: 'Thành công!',
                        text: 'Đã xóa các lịch sử trùng lặp. Chỉ giữ lại bản mới nhất cho mỗi phim.',
                        confirmButtonColor: '#8b5cf6',
                        timer: 2000,
                        showConfirmButton: false
                    });
                });
            }
        }
    });
}

function displayWatchHistory() {
    // Wait a bit for DOM to be ready
    setTimeout(function() {
        var container = document.getElementById('watchHistoryGrid');
        
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
        if (currentPage > totalPages) currentPage = totalPages || 1;
        var startIndex = (currentPage - 1) * itemsPerPage;
        var endIndex = startIndex + itemsPerPage;
        var currentItems = watchHistory.slice(startIndex, endIndex);
        
        var html = '';
        currentItems.forEach(function(item, index) {
            var actualIndex = startIndex + index;
            var sourceKey = item.source || currentSourceKey;
            var sourceLabel = SOURCES[sourceKey] ? SOURCES[sourceKey].name : sourceKey;
            html += '<a href="movie-detail.html?slug=' + encodeURIComponent(item.movieSlug) + '" class="film-card bg-gray-800 rounded-lg overflow-hidden cursor-pointer relative" onclick="handleMovieCardClick(event, \'' + item.movieSlug + '\', \'' + (item.source || '') + '\')">';
            html += '<div class="absolute top-2 right-2 z-10">';
            html += '<button onclick="event.preventDefault(); event.stopPropagation(); removeFromWatchHistory(' + actualIndex + ')" class="bg-red-600 hover:bg-red-700 p-2 rounded-full transition">';
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
            html += '</a>';
        });
        
        // Clean up any zero-width spaces
        html = html.replace(/\u200B/g, '');
        
        container.innerHTML = html;
        
        // Load posters for each movie
        loadPosters();
    }, 100);
}

// Load posters for movies in watch history
function loadPosters() {
    var posterIndex = 0;
    
    function loadNextPoster() {
        if (posterIndex >= watchHistory.length) return;
        
        var item = watchHistory[posterIndex];
        posterIndex++;
        
        try {
            var posterContainer = document.getElementById('poster-' + item.movieSlug);
            if (!posterContainer) {
                loadNextPoster();
                return;
            }

            var posterUrl = '';
            var thumbUrl = '';

            fetchJSONCached(getApiUrl(API_BASE + currentSource.endpoints.detail + '/' + item.movieSlug)).then(function(data) {
                var movieData = data.movie || data.item || (data.data && data.data.item);
                if ((data.status === 'success' || data.status === true) && movieData) {
                    var movie = normalizeMovieData(movieData);
                    posterUrl = movie.poster_url || '';
                    thumbUrl = movie.thumb_url || '';
                }
                
                if (!posterUrl && !thumbUrl) {
                    posterUrl = item.poster_url || '';
                    thumbUrl = item.thumb_url || '';
                }

                var imgSrc = getVerticalImage(posterUrl) || placeholderImg(300, 450, 'No Poster');

                posterContainer.innerHTML = '<img src="' + imgSrc + '" ' +
                    'alt="' + (item.movieTitle || '') + '" ' +
                    'loading="lazy" decoding="async" class="film-poster w-full" ' +
                    'onerror="this.src=placeholderImg(300,450,\'No Poster\')">';
                
                loadNextPoster();
            }).catch(function(apiError) {
                console.warn('API fallback for', item.movieSlug, ':', apiError);
                
                if (!posterUrl && !thumbUrl) {
                    posterUrl = item.poster_url || '';
                    thumbUrl = item.thumb_url || '';
                }

                var imgSrc = getVerticalImage(posterUrl) || placeholderImg(300, 450, 'No Poster');

                posterContainer.innerHTML = '<img src="' + imgSrc + '" ' +
                    'alt="' + (item.movieTitle || '') + '" ' +
                    'loading="lazy" decoding="async" class="film-poster w-full" ' +
                    'onerror="this.src=placeholderImg(300,450,\'No Poster\')">';
                
                loadNextPoster();
            });
        } catch (error) {
            console.error('Error loading poster for', item.movieSlug, ':', error);
            loadNextPoster();
        }
    }
    
    loadNextPoster();
}

// Pagination functions
function updatePagination() {
    var paginationContainer = document.getElementById('pagination');
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
    var url = new URL(window.location);
    url.searchParams.set('page', page);
    window.history.pushState({}, '', url);
    
    displayWatchHistory();
    updatePagination();
    
    // Scroll to top of the grid
    document.getElementById('watchHistoryGrid').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function removeFromWatchHistory(index) {
    var item = watchHistory[index];
    if (!item) return Promise.resolve();

    return new Promise(function(resolve, reject) {
        try {
            if (currentUser) {
                // Remove from Firebase
                var historyRef = db.collection('users').doc(currentUser.uid).collection('watchHistory');

                if (item._docId) {
                    historyRef.doc(item._docId).delete().then(function() {
                        return loadWatchHistory();
                    }).then(function() {
                        showToast('Đã xóa khỏi lịch sử xem', 'success');
                        resolve();
                    }).catch(function(error) {
                        console.error('Error removing from watch history:', error);
                        showToast('Không thể xóa khỏi lịch sử xem', 'error');
                        resolve();
                    });
                } else {
                    // Fallback for legacy entries without _docId:
                    // match by movieSlug, then filter to the exact same episode client-side
                    historyRef.where('movieSlug', '==', item.movieSlug).get().then(function(snapshot) {
                        var batch = db.batch();
                        snapshot.forEach(function(doc) {
                            var data = doc.data();
                            if ((data.episodeName || '') === (item.episodeName || '')) {
                                batch.delete(doc.ref);
                            }
                        });

                        return batch.commit();
                    }).then(function() {
                        return loadWatchHistory();
                    }).then(function() {
                        showToast('Đã xóa khỏi lịch sử xem', 'success');
                        resolve();
                    }).catch(function(error) {
                        console.error('Error removing from watch history:', error);
                        showToast('Không thể xóa khỏi lịch sử xem', 'error');
                        resolve();
                    });
                }
            } else {
                resolve();
            }
        } catch (error) {
            console.error('Error removing from watch history:', error);
            showToast('Không thể xóa khỏi lịch sử xem', 'error');
            resolve();
        }
    });
}
