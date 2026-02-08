// CinePhim - Favorites Page JavaScript

document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        loadFavorites();
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

async function loadFavorites() {
    try {
        // Load from Firebase if user is logged in
        if (currentUser) {
            const userRef = db.collection('users').doc(currentUser.uid);
            const favoritesRef = userRef.collection('favorites');
            const snapshot = await favoritesRef.get();
            
            favorites = [];
            snapshot.forEach(doc => {
                favorites.push(doc.data());
            });
            
            console.log('Loaded favorites from Firebase:', favorites);
        } else {
            // Fallback to localStorage if not logged in
            favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
            console.log('Loaded favorites from localStorage:', favorites);
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
        
        // Load favorite movies sequentially to avoid Object in URL
        (async function loadFavoriteMovies() {
            const movies = [];
            for (const fav of favorites) {
                const slug = typeof fav.slug === 'string' ? fav.slug : String(fav.slug || '');
                if (!slug) continue;
                
                try {
                    const response = await fetch(`${API_BASE}/film/${slug}`);
                    const data = await response.json();
                    if (data.status === 'success') {
                        movies.push(data.movie);
                    }
                } catch (error) {
                    console.error('Error loading favorite movie:', error);
                }
            }
            
            displayFavoriteMovies(movies);
        })();
    } catch (error) {
        console.error('Error loading favorites:', error);
        // Fallback to localStorage
        favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
        displayFavoriteMovies([]);
    }
}

function displayFavoriteMovies(movies) {
    const container = document.getElementById('favoritesGrid');
    
    if (!container) return;
    
    if (movies.length === 0) {
        container.innerHTML = `
            <div class="col-span-full text-center py-8 text-gray-400">
                <i class="fas fa-heart text-4xl mb-4"></i>
                <p>Không thể tải phim yêu thích</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = movies.map(movie => `
        <div class="film-card bg-gray-800 rounded-lg overflow-hidden cursor-pointer relative" onclick="showMovieDetail('${movie.slug}')">
            <button onclick="event.stopPropagation(); removeFromFavorites('${movie.slug}')" 
                    class="absolute top-2 right-2 z-10 bg-red-600 hover:bg-red-700 p-2 rounded-full transition">
                <i class="fas fa-heart text-white"></i>
            </button>
            <div class="relative">
                <img src="${movie.poster_url || movie.thumb_url || 'https://via.placeholder.com/300x450/374151/ffffff?text=No+Poster'}" 
                     alt="${movie.name || movie.title || movie.slug}" 
                     class="film-poster w-full"
                     onerror="this.src='https://via.placeholder.com/300x450/374151/ffffff?text=No+Poster'">
                <div class="absolute top-2 left-2 bg-purple-600 px-2 py-1 rounded text-xs font-semibold">
                    ${movie.quality || 'HD'}
                </div>
                ${movie.current_episode ? `
                    <div class="absolute bottom-2 left-2 bg-black bg-opacity-75 px-2 py-1 rounded text-xs">
                        ${movie.current_episode}
                    </div>
                ` : ''}
            </div>
            <div class="p-4">
                <h3 class="font-semibold text-sm mb-2 line-clamp-2">${movie.name || movie.title || movie.slug || 'Phim không xác định'}</h3>
                <p class="text-gray-400 text-xs mb-2">${movie.year || movie.time || ''}</p>
                <div class="flex items-center justify-between">
                    <span class="text-xs text-gray-500">${movie.country || getCountryFromCategory(movie.category) || ''}</span>
                </div>
            </div>
        </div>
    `).join('');
}

async function removeFromFavorites(movieSlug) {
    try {
        if (currentUser) {
            // Remove from Firebase
            const userRef = db.collection('users').doc(currentUser.uid);
            const favoritesRef = userRef.collection('favorites');
            const snapshot = await favoritesRef.where('slug', '==', movieSlug).get();
            
            const batch = db.batch();
            snapshot.forEach(doc => {
                batch.delete(doc.ref);
            });
            
            await batch.commit();
            console.log('Removed from Firebase favorites:', movieSlug);
        } else {
            // Remove from localStorage
            favorites = favorites.filter(item => item.slug !== movieSlug);
            localStorage.setItem('favorites', JSON.stringify(favorites));
        }
        
        // Reload and display
        await loadFavorites();
    } catch (error) {
        console.error('Error removing from favorites:', error);
        // Fallback to localStorage
        favorites = favorites.filter(item => item.slug !== movieSlug);
        localStorage.setItem('favorites', JSON.stringify(favorites));
        displayFavoriteMovies([]);
    }
}
