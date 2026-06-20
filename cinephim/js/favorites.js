// CinePhim - Favorites Page JavaScript

document.addEventListener('DOMContentLoaded', function() {
    loadFavorites();
    setupEventListeners();
    document.addEventListener('cinephim:auth-ready', () => {
        loadFavorites();
    });
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
            const currentMovies = [];
            const otherFavs = [];
            
            for (const fav of favorites) {
                const slug = typeof fav.slug === 'string' ? fav.slug : String(fav.slug || '');
                if (!slug) continue;
                
                const favSource = fav.source || '';
                const isCurrentSource = !favSource || favSource === currentSourceKey;
                
                if (isCurrentSource) {
                    try {
                        const data = await fetchJSONCached(getApiUrl(`${API_BASE}${currentSource.endpoints.detail}/${slug}`));
                        const movieData = data.movie || data.item || data.data?.item;
                        if ((data.status === 'success' || data.status === true) && movieData) {
                            if (currentSourceKey === 'ophim') {
                                const pathImage = data.pathImage || data.data?.pathImage || data.data?.APP_DOMAIN_CDN_IMAGE || '';
                                movieData.poster_url = resolveOPhimImageUrl(movieData.poster_url || '', pathImage);
                                movieData.thumb_url = resolveOPhimImageUrl(movieData.thumb_url || '', pathImage);
                            } else if (currentSourceKey === 'kkphim') {
                                const pathImage = data.pathImage || data.data?.pathImage || data.data?.APP_DOMAIN_CDN_IMAGE || '';
                                movieData.poster_url = resolveKKPhimImageUrl(movieData.poster_url || '', pathImage);
                                movieData.thumb_url = resolveKKPhimImageUrl(movieData.thumb_url || '', pathImage);
                            }
                            currentMovies.push(normalizeMovieData(movieData));
                        } else {
                            otherFavs.push(fav);
                        }
                    } catch (error) {
                        console.warn('Cannot load favorite movie from current source:', slug, error.message);
                        otherFavs.push(fav);
                    }
                } else {
                    otherFavs.push(fav);
                }
            }
            
            displayFavoriteMovies(currentMovies, otherFavs);
        })();
    } catch (error) {
        console.error('Error loading favorites:', error);
        favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
        displayFavoriteMovies([], favorites);
    }
}

function getCountryName(country) {
    if (!country) return '';
    if (Array.isArray(country)) {
        return country.map(c => c.name || c).filter(Boolean).join(', ');
    }
    if (typeof country === 'object') {
        return country.name || '';
    }
    return String(country);
}

function displayFavoriteMovies(currentMovies, otherFavs = []) {
    const container = document.getElementById('favoritesGrid');
    if (!container) return;
    
    const hasCurrent = currentMovies.length > 0;
    const hasOther = otherFavs.length > 0;
    
    if (!hasCurrent && !hasOther) {
        container.innerHTML = `
            <div class="col-span-full text-center py-8 text-gray-400">
                <i class="fas fa-heart text-4xl mb-4"></i>
                <p>Không thể tải phim yêu thích</p>
                <p class="text-sm mt-2">Vui lòng chuyển về nguồn phim cũ để xem các phim đã yêu thích trước đó.</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    
    if (hasCurrent) {
        if (hasOther) {
            html += `
                <div class="col-span-full mb-2">
                    <h2 class="text-lg font-semibold text-purple-400">
                        <i class="fas fa-play mr-2"></i>Phim từ nguồn ${SOURCES[currentSourceKey].name}
                    </h2>
                </div>
            `;
        }
        html += currentMovies.map(movie => `
            <div class="film-card bg-gray-800 rounded-lg overflow-hidden cursor-pointer relative" onclick="showMovieDetail('${movie.slug}')">
                <button onclick="event.stopPropagation(); removeFromFavorites('${movie.slug}')" 
                        class="absolute top-2 right-2 z-10 bg-red-600 hover:bg-red-700 p-2 rounded-full transition">
                    <i class="fas fa-heart text-white"></i>
                </button>
                <div class="relative">
                    <img src="${getVerticalImage(movie.poster_url, movie.thumb_url)}" 
                         alt="${movie.name || movie.title || movie.slug}" 
                         loading="lazy" decoding="async" class="film-poster w-full"
                         onerror="this.src=placeholderImg(300,450,'No Poster')"
                         onload="applyPosterOrientationClass(this)">
                    <div class="absolute top-2 left-2 bg-purple-600 px-2 py-1 rounded text-xs font-semibold">
                        ${movie.quality || 'HD'}
                    </div>
                    ${movie.current_episode ? `
                        <div class="absolute bottom-2 left-2 bg-black bg-opacity-75 px-2 py-1 rounded text-xs">
                            ${formatEpisodeInfo(movie.current_episode, movie.total_episodes)}
                        </div>
                    ` : ''}
                </div>
                <div class="p-4">
                    <h3 class="font-semibold text-sm mb-2 line-clamp-2">${movie.name || movie.title || movie.slug || 'Phim không xác định'}</h3>
                    <p class="text-gray-400 text-xs mb-2">${movie.year || movie.time || ''}</p>
                    <div class="flex items-center justify-between">
                        <span class="text-xs text-gray-500">${getCountryName(movie.country) || getCountryFromCategory(movie.category) || ''}</span>
                    </div>
                </div>
            </div>
        `).join('');
    }
    
    if (hasOther) {
        const sourceColors = {
            'nguonc': 'blue',
            'ophim': 'green',
            'kkphim': 'orange',
        };
        const sourceLabels = {
            'nguonc': 'Nguồn C',
            'ophim': 'OPhim',
            'kkphim': 'KKPhim',
        };
        
        const grouped = otherFavs.reduce((acc, fav) => {
            const key = fav.source || 'unknown';
            if (!acc[key]) acc[key] = [];
            acc[key].push(fav);
            return acc;
        }, {});
        
        const sourceOrder = Object.keys(SOURCES).filter(s => grouped[s]).concat(Object.keys(grouped).filter(s => !SOURCES[s]));
        
        let isFirstGroup = !hasCurrent;
        sourceOrder.forEach(sourceKey => {
            const group = grouped[sourceKey];
            if (!group) return;
            
            const color = sourceColors[sourceKey] || 'yellow';
            const label = SOURCES[sourceKey]?.name || sourceLabels[sourceKey] || sourceKey || 'Không rõ';
            
            if (!isFirstGroup) {
                html += `<div class="col-span-full mt-6"></div>`;
            }
            isFirstGroup = false;
            
            html += `
                <div class="col-span-full mb-2">
                    <h2 class="text-lg font-semibold text-${color}-400">
                        <i class="fas fa-link mr-2"></i>${label}
                    </h2>
                    <p class="text-sm text-gray-400 mt-1">Chuyển sang nguồn ${label} để xem các phim này</p>
                </div>
            `;
            
            html += group.map(fav => {
                const displayName = fav.name || fav.title || fav.slug || 'Phim không xác định';
                const posterImg = fav.poster_url
                    ? `<img src="${fav.poster_url}" alt="${displayName}" loading="lazy" decoding="async" class="w-full h-full object-cover" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="w-full h-full bg-gray-700 flex items-center justify-center hidden" style="aspect-ratio: 2/3"><i class="fas fa-film text-5xl text-gray-500"></i></div>`
                    : `<div class="w-full bg-gray-700 flex items-center justify-center" style="aspect-ratio: 2/3"><i class="fas fa-film text-5xl text-gray-500"></i></div>`;
                return `
                    <div class="film-card bg-gray-800/50 rounded-lg overflow-hidden border border-gray-700 relative">
                        <button onclick="event.stopPropagation(); removeFromFavorites('${fav.slug}')" 
                                class="absolute top-2 right-2 z-10 bg-red-600 hover:bg-red-700 p-2 rounded-full transition">
                            <i class="fas fa-heart text-white"></i>
                        </button>
                        <div class="relative">
                            ${posterImg}
                            <div class="absolute top-2 left-2 bg-${color}-600 px-2 py-1 rounded text-xs font-semibold">
                                <i class="fas fa-link mr-1"></i>${label}
                            </div>
                        </div>
                        <div class="p-4">
                            <h3 class="font-semibold text-sm mb-2 line-clamp-2">${displayName}</h3>
                            <p class="text-xs text-gray-400">Nguồn: ${label}</p>
                            <button onclick="event.stopPropagation(); switchToSource('${fav.source || ''}')" 
                                    class="mt-2 w-full bg-${color}-600 hover:bg-${color}-700 text-white text-xs py-2 rounded-lg transition">
                                <i class="fas fa-exchange-alt mr-1"></i>Chuyển sang ${label}
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
        });
    }
    
    container.innerHTML = html;
}

function switchToSource(sourceKey) {
    if (!sourceKey || !SOURCES[sourceKey]) {
        showError('Không thể chuyển nguồn: nguồn không hợp lệ');
        return;
    }
    setSource(sourceKey);
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
        displayFavoriteMovies([], []);
    }
}

