// Movie Detail Page JavaScript
let currentMovie = null;
let currentEpisodeIndex = 0;
let currentServerIndex = 0;
let player = null;

// Check if user is logged in
function isUserLoggedIn() {
    return auth.currentUser !== null;
}

// Initialize page when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializePage();
});

// Initialize the page
async function initializePage() {
    try {
        // Listen for auth state changes
        auth.onAuthStateChanged((user) => {
            updateFavoriteButton();
        });
        
        // Get movie slug from URL parameter
        const urlParams = new URLSearchParams(window.location.search);
        const movieSlug = urlParams.get('slug');
        
        if (!movieSlug) {
            showError('Không tìm thấy phim. Vui lòng quay lại trang chủ.');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 3000);
            return;
        }

        // Load movie details
        await loadMovieDetail(movieSlug);
        
        // Initialize video player
        initializeVideoPlayer();
        
        // Auto-play latest watched episode from history
        autoPlayLatestEpisode();
        
        // Load related movies
        await loadRelatedMovies();
        
    } catch (error) {
        console.error('Error initializing page:', error);
        showError('Có lỗi xảy ra khi tải trang. Vui lòng thử lại.');
    }
}

// Load movie details
async function loadMovieDetail(slug) {
    try {
        showLoading(true);
        
        const response = await fetch(`${API_BASE}/film/${slug}`);
        if (!response.ok) {
            throw new Error('Failed to fetch movie details');
        }
        
        const data = await response.json();
        
        if (data.status === 'success' && data.movie) {
            currentMovie = data.movie;
            displayMovieDetails();
            updatePageMeta();
            setupEpisodes();
            
            // Update favorite button status
            updateFavoriteButton();
            
            // Store episodes data for server switching
            window.currentMovieEpisodes = currentMovie.episodes;
            window.currentMovieSlug = slug;
            
            showLoading(false);
            document.getElementById('movieContent').classList.remove('hidden');
            
        } else {
            throw new Error('Movie not found');
        }
        
    } catch (error) {
        console.error('Error loading movie details:', error);
        showError('Không thể tải thông tin phim. Vui lòng thử lại.');
        showLoading(false);
    }
}

// Display movie details
function displayMovieDetails() {
    if (!currentMovie) return;

    // Update basic info
    document.getElementById('movieTitle').textContent = currentMovie.name || currentMovie.title || 'Không có tiêu đề';
    document.getElementById('moviePoster').src = currentMovie.poster_url || currentMovie.thumb_url || 'https://via.placeholder.com/400x600/374151/ffffff?text=No+Poster';
    document.getElementById('moviePoster').alt = currentMovie.name || currentMovie.title || '';
    
    // Update movie info
    const createdDate = currentMovie.created ? new Date(currentMovie.created) : null;
    const yearText = createdDate ? createdDate.getFullYear() : (currentMovie.year || currentMovie.release_year || 'Không rõ');
    const dateText = createdDate ? ` (${createdDate.getDate()}/${createdDate.getMonth() + 1}/${createdDate.getFullYear()})` : '';
    document.getElementById('movieYear').textContent = yearText + dateText;
    document.getElementById('movieDuration').textContent = currentMovie.time || 'Không rõ';
    document.getElementById('movieDescription').textContent = currentMovie.content || currentMovie.description || 'Không có mô tả.';
    
    // Update breadcrumb
    const firstCategory = getFirstCategory(currentMovie.category);
    document.getElementById('breadcrumbCategory').textContent = firstCategory || 'Phim';
    document.getElementById('breadcrumbMovie').textContent = currentMovie.name || currentMovie.title || 'Không có tiêu đề';
    
    // Update structured data for SEO
    updateStructuredData();
}

// Helper function to extract categories from category data
function getCategoriesFromCategory(category) {
    if (!category) return '';
    
    // Handle different category structures
    if (Array.isArray(category)) {
        const categories = category.filter(item => item.group && item.group.name === 'Thể loại')
                                 .flatMap(item => item.list ? item.list.map(cat => cat.name) : []);
        return categories.join(', ');
    } else if (category.list) {
        return category.list.map(cat => cat.name).join(', ');
    }
    
    return '';
}

// Helper function to get first category for breadcrumb
function getFirstCategory(category) {
    if (!category) return '';
    
    // Handle different category structures
    if (Array.isArray(category)) {
        const firstCategory = category.find(item => item.group && item.group.name === 'Thể loại');
        if (firstCategory && firstCategory.list && firstCategory.list.length > 0) {
            return firstCategory.list[0].name;
        }
    } else if (category.list && category.list.length > 0) {
        return category.list[0].name;
    }
    
    return '';
}

// Update structured data for SEO
function updateStructuredData() {
    if (!currentMovie) return;

    const structuredData = {
        "@context": "https://schema.org",
        "@type": "Movie",
        "name": currentMovie.name || currentMovie.title || 'Không có tiêu đề',
        "description": currentMovie.content || currentMovie.description || 'Không có mô tả.',
        "url": window.location.href,
        "image": currentMovie.poster_url || currentMovie.thumb_url || '',
        "datePublished": currentMovie.year ? `${currentMovie.year}-01-01` : '',
        "director": currentMovie.director ? {
            "@type": "Person",
            "name": currentMovie.director
        } : {},
        "actor": currentMovie.casts ? currentMovie.casts.split(',').map(actor => ({
            "@type": "Person",
            "name": actor.trim()
        })) : [],
        "genre": getCategoriesFromCategory(currentMovie.category).split(', ').map(genre => genre.trim()),
        "contentRating": currentMovie.rating ? currentMovie.rating.toString() : '',
        "aggregateRating": currentMovie.rating ? {
            "@type": "AggregateRating",
            "ratingValue": currentMovie.rating.toString(),
            "ratingCount": "1"
        } : {}
    };

    const structuredDataElement = document.getElementById('structuredData');
    if (structuredDataElement) {
        structuredDataElement.textContent = JSON.stringify(structuredData, null, 2);
    }
}

// Update page meta tags for SEO
function updatePageMeta() {
    if (!currentMovie) return;

    const title = `${currentMovie.name || currentMovie.title} - Xem phim HD | CinePhim`;
    const description = `Xem ${currentMovie.name || currentMovie.title} (${currentMovie.year}) online miễn phí với chất lượng HD. ${currentMovie.content ? currentMovie.content.substring(0, 150) + '...' : ''}`;
    
    // Update title and meta description
    document.title = title;
    document.getElementById('pageTitle').textContent = title;
    document.getElementById('pageDescription').content = description;
    
    // Update Open Graph tags
    document.getElementById('ogTitle').content = title;
    document.getElementById('ogDescription').content = description;
    document.getElementById('ogImage').content = currentMovie.poster_url || '';
}

// Auto-play latest watched episode from history
function autoPlayLatestEpisode() {
    if (!currentMovie || !currentMovie.episodes) return;
    
    // Find latest watched episode for this movie from history
    const movieHistory = watchHistory.filter(item => item.movieSlug === currentMovie.slug);
    
    if (movieHistory.length > 0) {
        // Get the latest watched episode
        const latestEpisode = movieHistory[0]; // Most recent is at index 0
        
        // Find the episode in current movie episodes
        for (let server of currentMovie.episodes) {
            if (server.items) {
                const episode = server.items.find(ep => ep.name === latestEpisode.episodeName);
                if (episode) {
                    console.log('Auto-playing latest episode:', latestEpisode.episodeName);
                    playEpisode(episode.slug, episode.embed || episode.m3u8);
                    return;
                }
            }
        }
    }
    
    // If no history, play first episode
    if (currentMovie.episodes.length > 0 && currentMovie.episodes[0].items.length > 0) {
        const firstEpisode = currentMovie.episodes[0].items[0];
        console.log('No history found, playing first episode:', firstEpisode.name || 'Tập 1');
        playEpisode(firstEpisode.slug, firstEpisode.embed || firstEpisode.m3u8);
    }
}

// Setup episodes
function setupEpisodes() {
    if (!currentMovie || !currentMovie.episodes || currentMovie.episodes.length === 0) return;

    const serverSelect = document.getElementById('serverSelect');
    const episodesList = document.getElementById('episodesList');
    
    // Clear existing content
    serverSelect.innerHTML = '';
    episodesList.innerHTML = '';
    
    // Populate server options
    currentMovie.episodes.forEach((server, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = server.server_name;
        serverSelect.appendChild(option);
    });
    
    // Load episodes for first server
    updateEpisodesList();
}

// Update episodes list when server changes
function updateEpisodesList() {
    const serverSelect = document.getElementById('serverSelect');
    const episodesList = document.getElementById('episodesList');
    
    if (!serverSelect || !episodesList || !currentMovie || !currentMovie.episodes) return;
    
    const serverIndex = parseInt(serverSelect.value);
    const server = currentMovie.episodes[serverIndex];
    
    if (server && server.items) {
        episodesList.innerHTML = [...server.items].reverse().map((episode, index) => `
            <button onclick="playEpisode('${episode.slug}', '${episode.embed || episode.m3u8}')" 
                    class="bg-purple-600 hover:bg-purple-700 px-3 py-2 rounded text-sm transition ${isEpisodeWatched(episode.slug, currentMovie.slug) ? 'ring-2 ring-blue-500' : ''}">
                ${episode.name || `Tập ${server.items.length - index}`}
                ${isEpisodeWatched(episode.slug, currentMovie.slug) ? '<i class="fas fa-check-circle text-xs ml-1"></i>' : ''}
            </button>
        `).join('');
    }
}

// Initialize video player
function initializeVideoPlayer() {
    const iframeElement = document.getElementById('videoPlayer');
    if (!iframeElement) {
        console.error('Video iframe not found');
        return;
    }
    
    console.log('Video iframe initialized');
}

// Play episode
function playEpisode(episodeSlug, videoUrl) {
    const iframeElement = document.getElementById('videoPlayer');
    
    if (!iframeElement) {
        showError('Không tìm thấy player video. Vui lòng tải lại trang.');
        return;
    }

    if (!videoUrl) {
        showError('Không tìm thấy link video. Vui lòng chọn tập khác.');
        return;
    }

    try {
        // Find episode index
        currentEpisodeIndex = findEpisodeIndex(episodeSlug);
        
        // Log video URL for debugging
        console.log('Playing episode:', episodeSlug, 'URL:', videoUrl);
        
        // Update iframe src with embed URL
        iframeElement.src = videoUrl;
        
        // Save to watch history
        saveToWatchHistory(currentMovie.slug, episodeSlug);
        
        // Update episodes list to show watched status
        updateEpisodesList();
        
        // Mark as watched after 5 seconds (simulating watching)
        setTimeout(() => {
            markEpisodeAsWatched(currentMovie.slug, currentEpisodeIndex);
        }, 5000);
        
    } catch (error) {
        console.error('Error playing episode:', error);
        showError('Có lỗi xảy ra khi phát video: ' + error.message + '. Vui lòng thử lại.');
    }
}

// Save to watch history
function saveToWatchHistory(movieSlug, episodeSlug) {
    if (!isUserLoggedIn()) return;
    
    const movieTitle = currentMovie.name || currentMovie.title || movieSlug;
    const episodeName = getEpisodeName(episodeSlug);
    const watchedAt = new Date();
    
    // Use the same logic as the old system
    const historyItem = {
        movieSlug: movieSlug,
        movieTitle: movieTitle,
        episodeSlug: episodeSlug,
        episodeName: episodeName,
        videoUrl: getCurrentVideoUrl(),
        watchedAt: watchedAt
    };
    
    console.log('Adding to watch history:', historyItem);
    
    // Remove existing entry for this movie (ghi đè)
    watchHistory = watchHistory.filter(item => item.movieSlug !== movieSlug);
    
    // Add new entry at the beginning
    watchHistory.unshift(historyItem);
    
    // Keep only last 50 items
    if (watchHistory.length > 50) {
        watchHistory = watchHistory.slice(0, 50);
    }
    
    // Save to localStorage
    localStorage.setItem('watchHistory', JSON.stringify(watchHistory));
    
    // Save to Firebase if user is logged in
    const user = auth.currentUser;
    if (user) {
        saveWatchHistoryToFirebase();
    }
    
    console.log('Watch history saved. Total items:', watchHistory.length);
}

// Save watch history to Firebase (same as old system)
async function saveWatchHistoryToFirebase() {
    if (!auth.currentUser) return;
    
    try {
        const userRef = db.collection('users').doc(auth.currentUser.uid);
        const historyRef = userRef.collection('watchHistory');
        
        // Clear existing history
        const existingDocs = await historyRef.get();
        const batch = db.batch();
        
        existingDocs.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        // Add new history
        watchHistory.forEach(item => {
            const docRef = historyRef.doc();
            batch.set(docRef, item);
        });
        
        await batch.commit();
        console.log('Watch history saved to Firebase');
    } catch (error) {
        console.error('Error saving watch history to Firebase:', error);
    }
}
function getEpisodeName(episodeSlug) {
    if (!currentMovie || !currentMovie.episodes) return episodeSlug;
    
    for (let server of currentMovie.episodes) {
        if (server.items) {
            const episode = server.items.find(ep => ep.slug === episodeSlug);
            if (episode) {
                return episode.name || `Tập ${server.items.indexOf(episode) + 1}`;
            }
        }
    }
    return episodeSlug;
}

// Get current video URL
function getCurrentVideoUrl() {
    const iframeElement = document.getElementById('videoPlayer');
    return iframeElement ? iframeElement.src : '';
}

// Mark episode as watched
function markEpisodeAsWatched(movieSlug, episodeIndex) {
    if (!isUserLoggedIn()) return;
    
    const user = auth.currentUser;
    if (!user) return;
    
    // Save to users collection
    const userRef = db.collection('users').doc(user.uid);
    
    userRef.get().then((doc) => {
        const userData = doc.exists ? doc.data() : {};
        const watched = userData.watchedEpisodes || [];
        const episodeKey = `${movieSlug}_${episodeIndex}`;
        
        if (!watched.includes(episodeKey)) {
            watched.push(episodeKey);
            return userRef.update({
                watchedEpisodes: watched,
                lastUpdated: new Date()
            });
        }
    }).catch((error) => {
        console.error('Error marking episode as watched:', error);
    });
}

// Check if episode is watched
function isEpisodeWatched(episodeSlug, movieSlug = null) {
    const slugToCheck = movieSlug || currentMovie.slug;
    return watchHistory.some(item => 
        item.movieSlug === slugToCheck && 
        item.episodeSlug === episodeSlug
    );
}

// Find episode index by slug
function findEpisodeIndex(episodeSlug) {
    if (!currentMovie || !currentMovie.episodes) return 0;
    
    for (let server of currentMovie.episodes) {
        if (server.items) {
            const index = server.items.findIndex(ep => ep.slug === episodeSlug);
            if (index !== -1) return index;
        }
    }
    return 0;
}

// Load related movies
async function loadRelatedMovies() {
    try {
        if (!currentMovie || !currentMovie.category) return;

        // Lấy category đầu tiên để tìm phim liên quan
        let categoryData = null;
        
        // Check if category is an array or object
        if (Array.isArray(currentMovie.category)) {
            categoryData = currentMovie.category.find(item => item.group && item.group.name === 'Thể loại');
        } else if (currentMovie.category.list) {
            categoryData = currentMovie.category;
        }
        
        if (!categoryData || !categoryData.list || categoryData.list.length === 0) return;
        
        const categorySlug = categoryData.list[0].slug;
        const response = await fetch(`${API_BASE}/films/category/${categorySlug}?page=1`);
        
        if (!response.ok) throw new Error('Failed to fetch related movies');
        
        const data = await response.json();
        
        if (data.status === 'success' && data.items) {
            displayRelatedMovies(data.items);
        }
        
    } catch (error) {
        console.error('Error loading related movies:', error);
    }
}

// Display related movies
function displayRelatedMovies(movies) {
    const relatedMoviesContainer = document.getElementById('relatedMovies');
    if (!relatedMoviesContainer) return;

    // Filter out current movie and limit to 8 movies
    const relatedMovies = movies
        .filter(movie => movie.slug !== currentMovie.slug)
        .slice(0, 8);

    if (relatedMovies.length === 0) {
        relatedMoviesContainer.innerHTML = '<p class="text-gray-400">Không có phim liên quan.</p>';
        return;
    }

    relatedMoviesContainer.innerHTML = relatedMovies.map(movie => `
        <div class="bg-gray-700 rounded-lg overflow-hidden hover:transform hover:scale-105 transition cursor-pointer" onclick="goToMovieDetail('${movie.slug}')">
            <img src="${movie.poster_url || movie.thumb_url || 'https://via.placeholder.com/300x450/374151/ffffff?text=No+Poster'}" 
                 alt="${movie.name || movie.title}" 
                 class="w-full h-48 object-cover"
                 onerror="this.src='https://via.placeholder.com/300x450/374151/ffffff?text=No+Poster'">
            <div class="p-3">
                <h4 class="font-medium text-sm truncate">${movie.name || movie.title}</h4>
                <p class="text-xs text-gray-400 mt-1">${movie.year || ''}</p>
            </div>
        </div>
    `).join('');
}

// Go to movie detail page
function goToMovieDetail(slug) {
    window.location.href = `movie-detail.html?slug=${slug}`;
}

// Toggle favorite
function toggleFavorite() {
    if (!isUserLoggedIn()) {
        showLoginModal();
        return;
    }

    if (!currentMovie) {
        showError('Không có thông tin phim');
        return;
    }

    const user = auth.currentUser;
    const userRef = db.collection('users').doc(user.uid);
    const favoritesRef = userRef.collection('favorites');
    
    // Check if movie is already in favorites
    favoritesRef.where('slug', '==', currentMovie.slug).get().then((snapshot) => {
        if (snapshot.empty) {
            // Add to favorites
            const movieData = {
                slug: currentMovie.slug || '',
                title: currentMovie.name || currentMovie.title || '',
                name: currentMovie.name || currentMovie.title || '',
                addedAt: new Date().toISOString()
            };
            
            favoritesRef.add(movieData).then(() => {
                showSuccess('Đã thêm vào danh sách yêu thích');
                updateFavoriteButton();
            }).catch((error) => {
                console.error('Error adding to favorites:', error);
                showError('Không thể thêm vào yêu thích: ' + error.message);
            });
        } else {
            // Remove from favorites
            const batch = db.batch();
            snapshot.forEach(doc => {
                batch.delete(doc.ref);
            });
            batch.commit().then(() => {
                showSuccess('Đã xóa khỏi danh sách yêu thích');
                // Reload page after successful removal
                setTimeout(() => {
                    window.location.reload();
                }, 1500);
            }).catch((error) => {
                console.error('Error removing from favorites:', error);
                showError('Không thể xóa khỏi yêu thích: ' + error.message);
            });
        }
    }).catch((error) => {
        console.error('Error querying favorites:', error);
        showError('Lỗi khi kiểm tra danh sách yêu thích: ' + error.message);
    });
}

// Update favorite button text
function updateFavoriteButton() {
    const favoriteBtn = document.querySelector('button[onclick="toggleFavorite()"]');
    if (!favoriteBtn) return;
    
    if (!currentMovie) {
        favoriteBtn.innerHTML = '<i class="fas fa-heart mr-2"></i>Thêm vào yêu thích';
        return;
    }
    
    if (!isUserLoggedIn()) {
        favoriteBtn.innerHTML = '<i class="fas fa-heart mr-2"></i>Thêm vào yêu thích';
        return;
    }
    
    const user = auth.currentUser;
    const favoritesRef = db.collection('users').doc(user.uid).collection('favorites');
    
    favoritesRef.where('slug', '==', currentMovie.slug).get().then((snapshot) => {
        if (snapshot.empty) {
            favoriteBtn.innerHTML = '<i class="fas fa-heart mr-2"></i>Thêm vào yêu thích';
        } else {
            favoriteBtn.innerHTML = '<i class="fas fa-heart mr-2"></i>Bỏ yêu thích';
        }
    }).catch((error) => {
        console.error('Error checking favorite status:', error);
        favoriteBtn.innerHTML = '<i class="fas fa-heart mr-2"></i>Thêm vào yêu thích';
    });
}

// Share movie
function shareMovie() {
    if (!currentMovie) return;

    const shareUrl = window.location.href;
    const shareText = `Xem ${currentMovie.name || currentMovie.title} (${currentMovie.year}) trên CinePhim`;

    if (navigator.share) {
        navigator.share({
            title: currentMovie.name || currentMovie.title,
            text: shareText,
            url: shareUrl
        }).catch((error) => {
            console.log('Error sharing:', error);
        });
    } else {
        // Fallback: copy to clipboard
        navigator.clipboard.writeText(shareUrl).then(() => {
            showSuccess('Đã sao chép link vào clipboard');
        }).catch(() => {
            showError('Không thể sao chép link');
        });
    }
}

// Toggle watch history section
function toggleWatchHistory() {
    const watchHistorySection = document.getElementById('watchHistorySection');
    if (watchHistorySection) {
        watchHistorySection.classList.toggle('hidden');
        
        if (!watchHistorySection.classList.contains('hidden')) {
            loadWatchHistory();
        }
    }
}

// Load watch history for current movie
function loadWatchHistory() {
    if (!isUserLoggedIn() || !currentMovie) return;

    // Use global watchHistory variable like the old system
    const movieHistory = watchHistory.filter(item => item.movieSlug === currentMovie.slug);
    
    if (movieHistory.length === 0) {
        displayWatchHistory([]);
    } else {
        displayWatchHistory(movieHistory);
    }
}

// Display watch history
function displayWatchHistory(history) {
    const watchHistoryGrid = document.getElementById('watchHistoryGrid');
    if (!watchHistoryGrid) return;

    if (history.length === 0) {
        watchHistoryGrid.innerHTML = '<p class="text-gray-400">Chưa có lịch sử xem phim này.</p>';
        return;
    }

    // Since we only have latest entry per movie, no need to sort
    watchHistoryGrid.innerHTML = history.map(item => `
        <div class="bg-gray-700 rounded-lg p-3 flex justify-between items-center">
            <div>
                <p class="font-medium">${item.episodeName || 'Tập không xác định'}</p>
            </div>
            <button onclick="playEpisode('${item.episodeSlug}', '${item.videoUrl}')" class="bg-purple-600 hover:bg-purple-700 px-3 py-1 rounded text-sm">
                <i class="fas fa-play"></i>
            </button>
        </div>
    `).join('');
}

// Show/hide loading
function showLoading(show) {
    const loading = document.getElementById('loading');
    if (loading) {
        loading.classList.toggle('hidden', !show);
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

function formatDate(date) {
    return new Intl.DateTimeFormat('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
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
