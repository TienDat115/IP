// CinePhim - Favorites Page JavaScript

document.addEventListener('DOMContentLoaded', async function() {
    await window.ensureConfigReady();
    loadFavorites();
    setupSearchListeners();
    document.addEventListener('cinephim:auth-ready', () => {
        loadFavorites();
    });
});

async function loadFavorites() {
    try {
        if (currentUser) {
            const userRef = db.collection('users').doc(currentUser.uid);
            const favoritesRef = userRef.collection('favorites');
            const snapshot = await favoritesRef.orderBy('addedAt', 'desc').get();
            
            favorites = [];
            snapshot.forEach(doc => {
                favorites.push(doc.data());
            });
        } else {
            favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
        }
        
        const container = document.getElementById('favoritesGrid');
        if (!container) return;
        
        if (favorites.length === 0) {
            container.innerHTML = `
                <div class="col-span-full text-center py-8 text-gray-400">
                    <i class="fas fa-heart text-4xl mb-4"></i>
                    <p>Chưa có phim yêu thích nào</p>
                    <p class="text-sm mt-2">Hãy thêm phim yêu thích để xem lại sau!</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = '<div class="loading-spinner mx-auto"></div><p class="mt-4">Đang tải...</p>';
        
        (async function loadFavoriteMovies() {
            const allMovies = [];
            
            for (const fav of favorites) {
                const slug = typeof fav.slug === 'string' ? fav.slug : String(fav.slug || '');
                if (!slug) continue;
                
                const favSource = fav.source || currentSourceKey;
                const isCurrentSource = favSource === currentSourceKey;
                
                if (isCurrentSource) {
                    try {
                        const data = await fetchJSONCached(getApiUrl(`${API_BASE}${currentSource.endpoints.detail}/${slug}`));
                        const movieData = data.movie || data.item || data.data?.item;
                        if ((data.status === 'success' || data.status === true) && movieData) {
                            allMovies.push({ ...normalizeMovieData(movieData), source: favSource });
                            continue;
                        }
                    } catch (error) {
                        console.warn('Cannot load favorite movie from current source:', slug, error.message);
                    }
                }
                
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
            
            displayFavoriteMovies(allMovies);
        })();
    } catch (error) {
        console.error('Error loading favorites:', error);
        favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
        displayFavoriteMovies([]);
    }
}

function displayFavoriteMovies(movies = []) {
    const container = document.getElementById('favoritesGrid');
    if (!container) return;
    
    if (movies.length === 0) {
        container.innerHTML = `
            <div class="col-span-full text-center py-8 text-gray-400">
                <i class="fas fa-heart text-4xl mb-4"></i>
                <p>Chưa có phim yêu thích nào</p>
                <p class="text-sm mt-2">Hãy thêm phim yêu thích để xem lại sau!</p>
            </div>
        `;
        return;
    }
    
    let html = movies.map(movie => {
        const sourceKey = movie.source || currentSourceKey;
        const sourceLabel = SOURCES[sourceKey]?.name || sourceKey;
        const displayName = movie.name || movie.title || movie.slug || 'Phim không xác định';
        const posterUrl = movie.poster_url || movie.thumb_url || '';
        
        const posterImg = posterUrl
            ? `<img src="${getVerticalImage(posterUrl)}" alt="${displayName}" loading="lazy" decoding="async" class="film-poster w-full" onerror="this.src=placeholderImg(300,450,'No Poster')">`
            : `<div class="w-full bg-gray-700 flex items-center justify-center" style="aspect-ratio: 2/3"><i class="fas fa-film text-5xl text-gray-500"></i></div>`;
        
        return `
            <div class="film-card bg-gray-800 rounded-lg overflow-hidden cursor-pointer relative" onclick="showMovieDetail('${movie.slug}', '${sourceKey}')">
                <button onclick="event.stopPropagation(); removeFromFavorites('${movie.slug}')" 
                        class="absolute top-2 right-2 z-10 bg-red-600 hover:bg-red-700 p-2 rounded-full transition">
                    <i class="fas fa-heart text-white"></i>
                </button>
                <div class="relative">
                    ${posterImg}
                    <div class="badge-quality" style="left:8px;right:auto">${sourceLabel}</div>
                    ${movie.current_episode ? `
                        <div class="absolute bottom-2 left-2 bg-black bg-opacity-75 px-2 py-1 rounded text-xs">
                            ${formatEpisodeInfo(movie.current_episode, movie.total_episodes)}
                        </div>
                    ` : ''}
                </div>
                <div class="p-4">
                    <h3 class="font-semibold text-sm mb-2 line-clamp-2">${displayName}</h3>
                    <p class="text-gray-400 text-xs mb-2">${movie.year || movie.time || ''}</p>
                    <div class="flex items-center justify-between">
                        <span class="text-xs text-gray-500">${getCountryFromCategory(movie.category) || ''}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = html;
}

async function removeFromFavorites(movieSlug) {
    try {
        if (currentUser) {
            const userRef = db.collection('users').doc(currentUser.uid);
            const favoritesRef = userRef.collection('favorites');
            const snapshot = await favoritesRef.where('slug', '==', movieSlug).get();
            
            const batch = db.batch();
            snapshot.forEach(doc => {
                batch.delete(doc.ref);
            });
            
            await batch.commit();
        } else {
            favorites = favorites.filter(item => item.slug !== movieSlug);
            localStorage.setItem('favorites', JSON.stringify(favorites));
        }
        
        await loadFavorites();
    } catch (error) {
        console.error('Error removing from favorites:', error);
        favorites = favorites.filter(item => item.slug !== movieSlug);
        localStorage.setItem('favorites', JSON.stringify(favorites));
        displayFavoriteMovies([]);
    }
}

