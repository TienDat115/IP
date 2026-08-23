// CinePhim - Favorites Page JavaScript

document.addEventListener('DOMContentLoaded', function() {
    window.ensureConfigReady().then(function() {
        loadFavorites();
        setupSearchListeners();
    });
    document.addEventListener('cinephim:auth-ready', function() {
        loadFavorites();
    });
});

function loadFavorites() {
    return new Promise(function(resolve, reject) {
        try {
            if (currentUser) {
                var userRef = db.collection('users').doc(currentUser.uid);
                var favoritesRef = userRef.collection('favorites');
                favoritesRef.orderBy('addedAt', 'desc').get().then(function(snapshot) {
                    favorites = [];
                    snapshot.forEach(function(doc) {
                        favorites.push(doc.data());
                    });
                    renderFavoritesGrid();
                    resolve();
                }).catch(function(error) {
                    console.error('Error loading favorites:', error);
                    favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
                    displayFavoriteMovies([]);
                    resolve();
                });
            } else {
                favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
                renderFavoritesGrid();
                resolve();
            }
        } catch (error) {
            console.error('Error loading favorites:', error);
            favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
            displayFavoriteMovies([]);
            resolve();
        }
    });
}

function renderFavoritesGrid() {
    var container = document.getElementById('favoritesGrid');
    if (!container) return;
    
    if (favorites.length === 0) {
        container.innerHTML = '<div class="col-span-full text-center py-8 text-gray-400">' +
            '<i class="fas fa-heart text-4xl mb-4"></i>' +
            '<p>Chưa có phim yêu thích nào</p>' +
            '<p class="text-sm mt-2">Hãy thêm phim yêu thích để xem lại sau!</p>' +
            '</div>';
        return;
    }
    
    container.innerHTML = '<div class="loading-spinner mx-auto"></div><p class="mt-4">Đang tải...</p>';
    
    var allMovies = [];
    var loadIndex = 0;
    
    function loadNext() {
        if (loadIndex >= favorites.length) {
            displayFavoriteMovies(allMovies);
            return;
        }
        
        var fav = favorites[loadIndex];
        loadIndex++;
        var slug = typeof fav.slug === 'string' ? fav.slug : String(fav.slug || '');
        if (!slug) {
            loadNext();
            return;
        }
        
        var favSource = fav.source || currentSourceKey;
        var isCurrentSource = favSource === currentSourceKey;
        
        if (isCurrentSource) {
            fetchJSONCached(getApiUrl(API_BASE + currentSource.endpoints.detail + '/' + slug)).then(function(data) {
                var movieData = data.movie || data.item || (data.data && data.data.item);
                if ((data.status === 'success' || data.status === true) && movieData) {
                    var normalized = normalizeMovieData(movieData);
                    normalized.source = favSource;
                    allMovies.push(normalized);
                } else {
                    allMovies.push({
                        slug: slug,
                        name: fav.name || fav.title || slug,
                        title: fav.title || fav.name || slug,
                        poster_url: fav.poster_url || '',
                        thumb_url: fav.thumb_url || '',
                        source: favSource,
                        year: fav.year || '',
                        quality: fav.quality || '',
                        current_episode: fav.current_episode || ''
                    });
                }
                loadNext();
            }).catch(function(error) {
                console.warn('Cannot load favorite movie from current source:', slug, error.message);
                allMovies.push({
                    slug: slug,
                    name: fav.name || fav.title || slug,
                    title: fav.title || fav.name || slug,
                    poster_url: fav.poster_url || '',
                    thumb_url: fav.thumb_url || '',
                    source: favSource,
                    year: fav.year || '',
                    quality: fav.quality || '',
                    current_episode: fav.current_episode || ''
                });
                loadNext();
            });
        } else {
            allMovies.push({
                slug: slug,
                name: fav.name || fav.title || slug,
                title: fav.title || fav.name || slug,
                poster_url: fav.poster_url || '',
                thumb_url: fav.thumb_url || '',
                source: favSource,
                year: fav.year || '',
                quality: fav.quality || '',
                current_episode: fav.current_episode || ''
            });
            loadNext();
        }
    }
    
    loadNext();
}

function displayFavoriteMovies(movies) {
    if (!movies) movies = [];
    var container = document.getElementById('favoritesGrid');
    if (!container) return;
    
    if (movies.length === 0) {
        container.innerHTML = '<div class="col-span-full text-center py-8 text-gray-400">' +
            '<i class="fas fa-heart text-4xl mb-4"></i>' +
            '<p>Chưa có phim yêu thích nào</p>' +
            '<p class="text-sm mt-2">Hãy thêm phim yêu thích để xem lại sau!</p>' +
            '</div>';
        return;
    }
    
    var html = movies.map(function(movie) {
        var sourceKey = movie.source || currentSourceKey;
        var sourceLabel = SOURCES[sourceKey] ? SOURCES[sourceKey].name : sourceKey;
        var displayName = movie.name || movie.title || movie.slug || 'Phim không xác định';
        var posterUrl = movie.poster_url || movie.thumb_url || '';
        
        var posterImg = posterUrl
            ? '<img src="' + getVerticalImage(posterUrl) + '" alt="' + displayName + '" loading="lazy" decoding="async" class="film-poster w-full" onerror="this.src=placeholderImg(300,450,\'No Poster\')">'
            : '<div class="w-full bg-gray-700 flex items-center justify-center" style="aspect-ratio: 2/3"><i class="fas fa-film text-5xl text-gray-500"></i></div>';
        
        var episodeHtml = '';
        if (movie.current_episode) {
            episodeHtml = '<div class="absolute bottom-2 left-2 bg-black bg-opacity-75 px-2 py-1 rounded text-xs">' +
                formatEpisodeInfo(movie.current_episode, movie.total_episodes) +
                '</div>';
        }
        
        return '<a href="movie-detail.html?slug=' + encodeURIComponent(movie.slug) + '" class="film-card bg-gray-800 rounded-lg overflow-hidden cursor-pointer relative" onclick="handleMovieCardClick(event, \'' + movie.slug + '\', \'' + sourceKey + '\')">' +
            '<button onclick="event.stopPropagation(); removeFromFavorites(\'' + movie.slug + '\')"' +
            ' class="absolute top-2 right-2 z-10 bg-red-600 hover:bg-red-700 p-2 rounded-full transition">' +
            '<i class="fas fa-heart text-white"></i>' +
            '</button>' +
            '<div class="relative">' +
            posterImg +
            '<div class="badge-quality" style="left:8px;right:auto">' + sourceLabel + '</div>' +
            episodeHtml +
            '</div>' +
            '<div class="p-4">' +
            '<h3 class="font-semibold text-sm mb-2 line-clamp-2">' + displayName + '</h3>' +
            '<p class="text-gray-400 text-xs mb-2">' + (movie.year || movie.time || '') + '</p>' +
            '<div class="flex items-center justify-between">' +
            '<span class="text-xs text-gray-500">' + (getCountryFromCategory(movie.category) || '') + '</span>' +
            '</div>' +
            '</div>' +
            '</a>';
    }).join('');
    
    container.innerHTML = html;
}

function removeFromFavorites(movieSlug) {
    return new Promise(function(resolve, reject) {
        try {
            if (currentUser) {
                var userRef = db.collection('users').doc(currentUser.uid);
                var favoritesRef = userRef.collection('favorites');
                favoritesRef.where('slug', '==', movieSlug).get().then(function(snapshot) {
                    var batch = db.batch();
                    snapshot.forEach(function(doc) {
                        batch.delete(doc.ref);
                    });
                    
                    return batch.commit();
                }).then(function() {
                    return loadFavorites();
                }).then(function() {
                    resolve();
                }).catch(function(error) {
                    console.error('Error removing from favorites:', error);
                    favorites = favorites.filter(function(item) { return item.slug !== movieSlug; });
                    localStorage.setItem('favorites', JSON.stringify(favorites));
                    displayFavoriteMovies([]);
                    resolve();
                });
            } else {
                favorites = favorites.filter(function(item) { return item.slug !== movieSlug; });
                localStorage.setItem('favorites', JSON.stringify(favorites));
                loadFavorites().then(function() {
                    resolve();
                });
            }
        } catch (error) {
            console.error('Error removing from favorites:', error);
            favorites = favorites.filter(function(item) { return item.slug !== movieSlug; });
            localStorage.setItem('favorites', JSON.stringify(favorites));
            displayFavoriteMovies([]);
            resolve();
        }
    });
}
