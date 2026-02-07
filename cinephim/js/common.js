// CinePhim - Common JavaScript Functions

// API Configuration
const API_BASE = 'https://phim.nguonc.com/api';

// Global variables
let favorites = [];
let isDarkMode = localStorage.getItem('darkMode') !== 'false';
let watchHistory = JSON.parse(localStorage.getItem('watchHistory') || '[]');
let currentUser = null;
let authListener = null;

// Initialize Firebase
const db = firebase.firestore();
const auth = firebase.auth();

// Categories data
const categories = [
    { slug: 'hanh-dong', name: 'Hành động', icon: 'fa-fist-raised' },
    { slug: 'phieu-luu', name: 'Phiêu lưu', icon: 'fa-compass' },
    { slug: 'hai-huoc', name: 'Hài hước', icon: 'fa-laugh' },
    { slug: 'tinh-cam', name: 'Tình cảm', icon: 'fa-heart' },
    { slug: 'kinh-di', name: 'Kinh dị', icon: 'fa-ghost' },
    { slug: 'vien-tuong', name: 'Viễn tưởng', icon: 'fa-rocket' },
    { slug: 'phim-18', name: 'Phim 18+', icon: 'fa-fire' },
    { slug: 'chien-tranh', name: 'Chiến tranh', icon: 'fa-shield-alt' },
    { slug: 'tham-tu', name: 'Thám tử', icon: 'fa-search' },
    { slug: 'hoat-hinh', name: 'Hoạt hình', icon: 'fa-palette' },
    { slug: 'gia-dinh', name: 'Gia đình', icon: 'fa-home' },
    { slug: 'su-pham', name: 'Sử phạm', icon: 'fa-gavel' }
];

// Countries data
const countries = [
    { slug: 'au-my', name: 'Âu Mỹ', icon: 'fa-flag-usa' },
    { slug: 'han-quoc', name: 'Hàn Quốc', icon: 'fa-kimchi' },
    { slug: 'trung-quoc', name: 'Trung Quốc', icon: 'fa-dragon' },
    { slug: 'nhat-ban', name: 'Nhật Bản', icon: 'fa-torii-gate' },
    { slug: 'thai-lan', name: 'Thái Lan', icon: 'fa-elephant' },
    { slug: 'viet-nam', name: 'Việt Nam', icon: 'fa-flag' },
    { slug: 'philippines', name: 'Philippines', icon: 'fa-island-tropical' },
    { slug: 'india', name: 'Ấn Độ', icon: 'fa-om' }
];

// Initialize Firebase and common functions
document.addEventListener('DOMContentLoaded', function() {
    // Wait for Firebase to be ready
    setTimeout(() => {
        // Clear any existing auth listener
        if (authListener) {
            authListener();
        }
        
        // Set up auth state listener once
        authListener = auth.onAuthStateChanged(function(user) {
            currentUser = user;
            if (user) {
                console.log('User logged in:', user.email);
                loadWatchHistoryFromFirebase();
                loadFavoritesFromFirebase();
            } else {
                console.log('User not logged in');
                watchHistory = JSON.parse(localStorage.getItem('watchHistory') || '[]');
                favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
            }
            updateLoginButton();
            applyTheme();
        });
    }, 1000);
});

// Load favorites from Firebase
async function loadFavoritesFromFirebase() {
    if (!currentUser) {
        // Fallback to localStorage if not logged in
        favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
        return;
    }
    
    try {
        const snapshot = await db.collection('users').doc(currentUser.uid).collection('favorites').get();
        favorites = [];
        snapshot.forEach(doc => {
            favorites.push(doc.data());
        });
        console.log('Favorites loaded from Firebase:', favorites);
    } catch (error) {
        console.error('Error loading favorites:', error);
        // Fallback to localStorage
        favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
    }
}

// Save favorites to Firebase
async function saveFavoritesToFirebase() {
    if (!currentUser) return;
    
    try {
        const userRef = db.collection('users').doc(currentUser.uid);
        const favoritesRef = userRef.collection('favorites');
        
        // Clear existing favorites
        const existingDocs = await favoritesRef.get();
        const batch = db.batch();
        
        existingDocs.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        // Add new favorites
        favorites.forEach(item => {
            const docRef = favoritesRef.doc();
            // Clean data before saving
            const cleanItem = {
                slug: item.slug || '',
                title: item.title || item.name || item.slug || '',
                name: item.name || item.title || item.slug || '',
                addedAt: item.addedAt || new Date().toISOString()
            };
            batch.set(docRef, cleanItem);
        });
        
        await batch.commit();
        console.log('Favorites saved to Firebase');
    } catch (error) {
        console.error('Error saving favorites:', error);
    }
}

// Load watch history from Firebase
async function loadWatchHistoryFromFirebase() {
    if (!currentUser) return;
    
    try {
        const snapshot = await db.collection('users').doc(currentUser.uid).collection('watchHistory').orderBy('watchedAt', 'desc').get();
        watchHistory = [];
        snapshot.forEach(doc => {
            watchHistory.push(doc.data());
        });
        console.log('Watch history loaded from Firebase:', watchHistory);
    } catch (error) {
        console.error('Error loading watch history:', error);
        watchHistory = JSON.parse(localStorage.getItem('watchHistory') || '[]');
    }
}

// Save watch history to Firebase
async function saveWatchHistoryToFirebase() {
    if (!currentUser) return;
    
    try {
        const userRef = db.collection('users').doc(currentUser.uid);
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
        console.error('Error saving watch history:', error);
    }
}

// Apply theme
function applyTheme() {
    if (isDarkMode) {
        document.body.classList.add('dark');
        const themeIcon = document.getElementById('themeIcon');
        if (themeIcon) {
            themeIcon.className = 'fas fa-sun mr-1';
        }
    } else {
        document.body.classList.remove('dark');
        const themeIcon = document.getElementById('themeIcon');
        if (themeIcon) {
            themeIcon.className = 'fas fa-moon mr-1';
        }
    }
}

// Toggle theme
function toggleTheme() {
    isDarkMode = !isDarkMode;
    localStorage.setItem('darkMode', isDarkMode);
    applyTheme();
}

// Toggle login/logout
async function toggleLogin() {
    const loginIcon = document.getElementById('loginIcon');
    const loginText = document.getElementById('loginText');
    
    if (currentUser) {
        // Logout
        try {
            await auth.signOut();
            currentUser = null;
            watchHistory = JSON.parse(localStorage.getItem('watchHistory') || '[]');
            if (loginIcon) loginIcon.className = 'fas fa-sign-in-alt mr-1';
            if (loginText) loginText.textContent = 'Đăng nhập';
            console.log('User logged out');
        } catch (error) {
            console.error('Logout error:', error);
        }
    } else {
        // Show login modal
        showLoginModal();
    }
}

// Show login modal
function showLoginModal() {
    const modal = document.getElementById('loginModal');
    if (modal) {
        modal.classList.remove('hidden');
    }
    const registerModal = document.getElementById('registerModal');
    if (registerModal) {
        registerModal.classList.add('hidden');
    }
}

// Close login modal
function closeLoginModal() {
    const modal = document.getElementById('loginModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// Show register modal
function showRegisterModal() {
    const modal = document.getElementById('registerModal');
    if (modal) {
        modal.classList.remove('hidden');
    }
    const loginModal = document.getElementById('loginModal');
    if (loginModal) {
        loginModal.classList.add('hidden');
    }
}

// Close register modal
function closeRegisterModal() {
    const modal = document.getElementById('registerModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// Handle login
async function handleLogin(event) {
    event.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        currentUser = userCredential.user;
        
        // Update UI
        updateLoginButton();
        closeLoginModal();
        
        // Load watch history from Firebase
        await loadWatchHistoryFromFirebase();
        
        console.log('Login successful:', currentUser.email);
        Swal.fire({
            icon: 'success',
            title: 'Thành công!',
            text: 'Đăng nhập thành công!',
            confirmButtonColor: '#8b5cf6',
            timer: 2000,
            showConfirmButton: false
        });
        
    } catch (error) {
        console.error('Login error:', error);
        let errorMessage = 'Đăng nhập thất bại. Vui lòng thử lại.';
        
        switch (error.code) {
            case 'auth/user-not-found':
                errorMessage = 'Email không tồn tại.';
                break;
            case 'auth/wrong-password':
                errorMessage = 'Mật khẩu không đúng.';
                break;
            case 'auth/invalid-email':
                errorMessage = 'Email không hợp lệ.';
                break;
            case 'auth/user-disabled':
                errorMessage = 'Tài khoản đã bị vô hiệu hóa.';
                break;
            case 'auth/too-many-requests':
                errorMessage = 'Quá nhiều yêu cầu. Vui lòng thử lại sau.';
                break;
        }
        
        Swal.fire({
            icon: 'error',
            title: 'Lỗi',
            text: errorMessage,
            confirmButtonColor: '#8b5cf6'
        });
    }
}

// Handle register
async function handleRegister(event) {
    event.preventDefault();
    
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('registerConfirmPassword').value;
    
    // Validate passwords match
    if (password !== confirmPassword) {
        Swal.fire({
            icon: 'error',
            title: 'Lỗi',
            text: 'Mật khẩu xác nhận không khớp.',
            confirmButtonColor: '#8b5cf6'
        });
        return;
    }
    
    // Validate password length
    if (password.length < 6) {
        Swal.fire({
            icon: 'error',
            title: 'Lỗi',
            text: 'Mật khẩu phải có ít nhất 6 ký tự.',
            confirmButtonColor: '#8b5cf6'
        });
        return;
    }
    
    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        currentUser = userCredential.user;
        
        // Update UI
        updateLoginButton();
        closeRegisterModal();
        
        console.log('Register successful:', currentUser.email);
        Swal.fire({
            icon: 'success',
            title: 'Thành công!',
            text: 'Đăng ký thành công!',
            confirmButtonColor: '#8b5cf6',
            timer: 2000,
            showConfirmButton: false
        });
        
    } catch (error) {
        console.error('Register error:', error);
        let errorMessage = 'Đăng ký thất bại. Vui lòng thử lại.';
        
        switch (error.code) {
            case 'auth/email-already-in-use':
                errorMessage = 'Email đã được sử dụng.';
                break;
            case 'auth/invalid-email':
                errorMessage = 'Email không hợp lệ.';
                break;
            case 'auth/weak-password':
                errorMessage = 'Mật khẩu quá yếu. Vui lòng chọn mật khẩu mạnh hơn.';
                break;
            case 'auth/too-many-requests':
                errorMessage = 'Quá nhiều yêu cầu. Vui lòng thử lại sau.';
                break;
        }
        
        Swal.fire({
            icon: 'error',
            title: 'Lỗi',
            text: errorMessage,
            confirmButtonColor: '#8b5cf6'
        });
    }
}

// Update login button based on auth state
function updateLoginButton() {
    const loginIcon = document.getElementById('loginIcon');
    const loginText = document.getElementById('loginText');
    
    if (currentUser) {
        if (loginIcon) loginIcon.className = 'fas fa-sign-out-alt mr-1';
        if (loginText) loginText.textContent = 'Đăng xuất';
    } else {
        if (loginIcon) loginIcon.className = 'fas fa-sign-in-alt mr-1';
        if (loginText) loginText.textContent = 'Đăng nhập';
    }
}

// Show loading
function showLoading() {
    const loading = document.getElementById('loading');
    if (loading) {
        loading.classList.remove('hidden');
    }
    const container = document.getElementById('moviesContainer');
    if (container) {
        container.innerHTML = '';
    }
    const pagination = document.getElementById('pagination');
    if (pagination) {
        pagination.innerHTML = '';
    }
}

// Hide loading
function hideLoading() {
    const loading = document.getElementById('loading');
    if (loading) {
        loading.classList.add('hidden');
    }
}

// Show movie detail
async function showMovieDetail(slug) {
    try {
        const response = await fetch(`${API_BASE}/film/${slug}`);
        const data = await response.json();
        
        if (data.status === 'success') {
            const movie = data.movie;
            const modal = document.getElementById('movieModal');
            const content = document.getElementById('movieDetailContent');
            const isFavorite = favorites.some(fav => fav.slug === slug);
            
            // Extract categories
            let categoryNames = [];
            let countryName = '';
            let yearName = '';
            
            if (movie.category) {
                for (const key in movie.category) {
                    const group = movie.category[key].group;
                    const list = movie.category[key].list;
                    
                    if (group.name === 'Thể loại') {
                        categoryNames = list.map(item => item.name);
                    } else if (group.name === 'Quốc gia') {
                        countryName = list.map(item => item.name).join(', ');
                    } else if (group.name === 'Năm') {
                        yearName = list.map(item => item.name).join(', ');
                    }
                }
            }
            
            if (content) {
                content.innerHTML = `
                    <div class="relative">
                        <img src="${movie.poster_url || movie.thumb_url || 'https://via.placeholder.com/800x450/374151/ffffff?text=No+Poster'}" 
                             alt="${movie.name || movie.title}" 
                             class="w-full h-96 object-cover"
                             onerror="this.src='https://via.placeholder.com/800x450/374151/ffffff?text=No+Poster'">
                        <div class="absolute inset-0 bg-gradient-to-t from-black to-transparent"></div>
                        <div class="absolute bottom-4 left-4 right-4">
                            <h2 class="text-3xl font-bold mb-2">${movie.name || movie.title}</h2>
                            <div class="flex items-center space-x-4 text-sm">
                                <span><i class="fas fa-calendar mr-1"></i>${yearName || ''}</span>
                                <span><i class="fas fa-clock mr-1"></i>${movie.time || ''}</span>
                                <span><i class="fas fa-globe mr-1"></i>${countryName || ''}</span>
                                <span><i class="fas fa-star mr-1 text-yellow-400"></i>${movie.rating || 'N/A'}</span>
                            </div>
                        </div>
                        <div class="absolute top-4 left-4 flex space-x-2">
                            <button onclick="toggleFavorite('${slug}')" class="bg-red-600 hover:bg-red-700 px-3 py-2 rounded-lg transition">
                                <i class="fas fa-heart ${isFavorite ? '' : 'text-gray-300'}"></i>
                            </button>
                        </div>
                    </div>
                    
                    <div class="p-6">
                        <div class="mb-6">
                            <h3 class="text-xl font-semibold mb-3">Nội dung</h3>
                            <p class="text-gray-300">${movie.description || 'Chưa có mô tả.'}</p>
                        </div>
                        
                        <div class="mb-6">
                            <h3 class="text-xl font-semibold mb-3">Thông tin</h3>
                            <div class="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span class="text-gray-400">Thể loại:</span>
                                    <span class="ml-2">${categoryNames.join(', ') || ''}</span>
                                </div>
                                <div>
                                    <span class="text-gray-400">Đạo diễn:</span>
                                    <span class="ml-2">${movie.director || ''}</span>
                                </div>
                                <div>
                                    <span class="text-gray-400">Diễn viên:</span>
                                    <span class="ml-2">${movie.casts || ''}</span>
                                </div>
                                <div>
                                    <span class="text-gray-400">Chất lượng:</span>
                                    <span class="ml-2">${movie.quality || ''}</span>
                                </div>
                            </div>
                        </div>
                        
                        ${movie.episodes && movie.episodes.length > 0 ? `
                            <div class="mb-6">
                                <!-- Watch History Section - Hidden by default -->
                                <div id="watchHistoryInModal" class="hidden mb-6">
                                    <div class="flex justify-between items-center mb-4">
                                        <h3 class="text-xl font-semibold">Lịch sử xem phim này</h3>
                                    </div>
                                    <div id="modalWatchHistoryGrid" class="grid grid-cols-1 gap-4 max-h-60 overflow-y-auto">
                                        <!-- Watch history will be loaded here -->
                                    </div>
                                </div>
                                
                                <!-- Episodes Section -->
                                <div>
                                    <div class="flex justify-between items-center mb-4">
                                        <h3 class="text-xl font-semibold">Danh sách tập</h3>
                                        <button onclick="toggleWatchHistoryInModal()" class="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm transition">
                                            <i class="fas fa-history mr-2"></i>Lịch sử xem
                                        </button>
                                    </div>
                                    <div class="mb-4">
                                        <select id="serverSelect" class="bg-gray-700 text-white px-4 py-2 rounded-lg" onchange="updateEpisodesList()">
                                            ${movie.episodes.map((server, index) => `
                                                <option value="${index}">${server.server_name}</option>
                                            `).join('')}
                                        </select>
                                    </div>
                                    <div id="episodesList" class="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                                        ${movie.episodes[0].items.map((episode, index) => `
                                            <button onclick="playEpisode('${episode.slug}', '${episode.embed || episode.m3u8}')" 
                                                    class="bg-purple-600 hover:bg-purple-700 px-3 py-2 rounded text-sm transition ${isEpisodeWatched(episode.slug) ? 'ring-2 ring-blue-500' : ''}">
                                                ${episode.name || `Tập ${index + 1}`}
                                                ${isEpisodeWatched(episode.slug) ? '<i class="fas fa-check-circle text-xs ml-1"></i>' : ''}
                                            </button>
                                        `).join('')}
                                    </div>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                `;
            }
            
            // Store episodes data for server switching
            window.currentMovieEpisodes = movie.episodes;
            window.currentMovieTitle = movie.name || movie.title;
            window.currentMovieSlug = slug;
            
            if (modal) {
                modal.classList.remove('hidden');
            }
        } else {
            showError('Không thể tải thông tin phim');
        }
    } catch (error) {
        showError('Lỗi kết nối đến server');
    }
}

// Close movie modal
function closeMovieModal() {
    const modal = document.getElementById('movieModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// Check if episode is watched
function isEpisodeWatched(episodeSlug) {
    return watchHistory.some(item => 
        item.movieSlug === window.currentMovieSlug && 
        item.episodeName === episodeSlug
    );
}

// Toggle favorite
async function toggleFavorite(slug) {
    const index = favorites.findIndex(fav => fav.slug === slug);
    
    if (index > -1) {
        // Remove from favorites
        favorites.splice(index, 1);
        
        // Show notification
        Swal.fire({
            icon: 'success',
            title: 'Đã xóa',
            text: 'Đã xóa khỏi danh sách yêu thích',
            confirmButtonColor: '#8b5cf6',
            timer: 1500,
            showConfirmButton: false
        });
    } else {
        // Add to favorites
        const movieData = {
            slug: slug,
            title: slug, // Use slug as title fallback
            name: slug, // Use slug as name fallback
            addedAt: new Date().toISOString()
        };
        favorites.unshift(movieData);
        
        // Show notification
        Swal.fire({
            icon: 'success',
            title: 'Đã thêm',
            text: 'Đã thêm vào danh sách yêu thích',
            confirmButtonColor: '#8b5cf6',
            timer: 1500,
            showConfirmButton: false
        });
    }
    
    // Save to Firebase if logged in, otherwise localStorage
    if (currentUser) {
        await saveFavoritesToFirebase();
    } else {
        localStorage.setItem('favorites', JSON.stringify(favorites));
    }
    
    // Update movie detail modal if it's open
    if (document.getElementById('movieModal') && !document.getElementById('movieModal').classList.contains('hidden')) {
        showMovieDetail(slug);
    }
}

// Add to watch history
async function addToWatchHistory(movieSlug, movieTitle, episodeName) {
    if (!movieSlug || !movieTitle) {
        console.log('Missing required data for watch history:', { movieSlug, movieTitle, episodeName });
        return;
    }
    
    const historyItem = {
        movieSlug,
        movieTitle,
        episodeName,
        watchedAt: new Date().toISOString()
    };
    
    console.log('Adding to watch history:', historyItem);
    
    // Remove existing entry for same movie
    watchHistory = watchHistory.filter(item => item.movieSlug !== movieSlug);
    
    // Add new entry at the beginning
    watchHistory.unshift(historyItem);
    
    // Keep only last 50 items
    if (watchHistory.length > 50) {
        watchHistory = watchHistory.slice(0, 50);
    }
    
    // Save to Firebase if user is logged in
    if (currentUser) {
        await saveWatchHistoryToFirebase();
    }
    
    console.log('Watch history saved. Total items:', watchHistory.length);
}

// Format watch time (relative time)
function formatWatchTime(watchedAt) {
    const now = new Date();
    const watched = new Date(watchedAt);
    const diffMs = now - watched;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Vừa xong';
    if (diffMins < 60) return `${diffMins} phút`;
    if (diffHours < 24) return `${diffHours} giờ`;
    if (diffDays < 7) return `${diffDays} ngày`;
    return formatDate(watchedAt);
}

// Format date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

// Show error message
function showError(message) {
    const container = document.getElementById('moviesContainer');
    if (container) {
        container.innerHTML = `
            <div class="col-span-full text-center py-8">
                <div class="text-red-400 mb-4">
                    <i class="fas fa-exclamation-triangle text-4xl"></i>
                </div>
                <p class="text-gray-400">${message}</p>
            </div>
        `;
    }
}

// Helper function to extract country from category
function getCountryFromCategory(category) {
    if (!category) return '';
    
    // Check if category has country group (id: 4)
    for (const key in category) {
        if (category[key].group && category[key].group.id === '67c6a1e7ce56d3d6fa748ab6d9af3fd7') {
            const countryList = category[key].list;
            if (countryList && countryList.length > 0) {
                return countryList[0].name;
            }
        }
    }
    return '';
}

// Mobile menu functions
function toggleMobileMenu() {
    const mobileMenu = document.getElementById('mobileMenu');
    if (mobileMenu) {
        mobileMenu.classList.toggle("hidden");
    }
}

function closeMobileMenu() {
    const mobileMenu = document.getElementById('mobileMenu');
    if (mobileMenu) {
        mobileMenu.classList.add("hidden");
    }
}

// Sync theme icons
function syncThemeIcons() {
    const desktopIcon = document.getElementById("themeIcon");
    const mobileIcon = document.getElementById("mobileThemeIcon");

    if (desktopIcon && mobileIcon) {
        if (desktopIcon.classList.contains("fa-moon")) {
            mobileIcon.className = "fas fa-moon";
        } else {
            mobileIcon.className = "fas fa-sun";
        }
    }
}

// Sync login icons
function syncLoginIcons() {
    const desktopIcon = document.getElementById("loginIcon");
    const mobileIcon = document.getElementById("mobileLoginIcon");
    const desktopText = document.getElementById("loginText");

    if (desktopIcon && mobileIcon) {
        mobileIcon.className = desktopIcon.className;
        if (desktopText && desktopText.textContent === "Đăng xuất") {
            mobileIcon.className = "fas fa-sign-out-alt";
        } else {
            mobileIcon.className = "fas fa-sign-in-alt";
        }
    }
}

// Toggle watch history in modal - Show/hide toggle
function toggleWatchHistoryInModal() {
    const modal = document.getElementById('watchHistoryInModal');
    const grid = document.getElementById('modalWatchHistoryGrid');
    
    if (modal.classList.contains('hidden')) {
        // Show history
        modal.classList.remove('hidden');
        loadWatchHistoryInModal();
    } else {
        // Hide history
        modal.classList.add('hidden');
    }
}

// Load watch history in modal
function loadWatchHistoryInModal() {
    const grid = document.getElementById('modalWatchHistoryGrid');
    const movieHistory = watchHistory.filter(item => item.movieSlug === window.currentMovieSlug);
    
    if (movieHistory.length === 0) {
        grid.innerHTML = '<div class="text-center py-8 text-gray-400"><p>Chưa có tập nào được xem của phim này</p></div>';
        return;
    }
    
    grid.innerHTML = movieHistory.map(item => `
        <div class="bg-gray-700 p-4 rounded-lg cursor-pointer hover:bg-gray-600 transition" 
             onclick="playEpisodeFromHistory('${item.episodeSlug || item.episodeName}')">
            <div class="flex justify-between items-center">
                <div class="flex-1">
                    <p class="font-semibold">${item.episodeName || 'Không xác định'}</p>
                    <p class="text-sm text-gray-400">${formatDate(item.watchedAt)}</p>
                </div>
                <button onclick="event.stopPropagation(); removeFromWatchHistory('${item.movieSlug}', '${item.episodeName}')" 
                        class="text-red-400 hover:text-red-300 transition ml-4">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
}

// Play episode from history
function playEpisodeFromHistory(episodeSlug) {
    // Find the episode in current movie episodes
    if (window.currentMovieEpisodes) {
        for (const server of window.currentMovieEpisodes) {
            const episode = server.items.find(ep => ep.slug === episodeSlug || ep.name === episodeSlug);
            if (episode) {
                playEpisode(episode.slug, episode.embed || episode.m3u8);
                return;
            }
        }
    }
    
    // If not found in current episodes, try to play directly
    playEpisode(episodeSlug, '');
}

// Remove from watch history
function removeFromWatchHistory(movieSlug, episodeName) {
    watchHistory = watchHistory.filter(item => 
        !(item.movieSlug === movieSlug && item.episodeName === episodeName)
    );
    
    localStorage.setItem('watchHistory', JSON.stringify(watchHistory));
    
    if (currentUser) {
        saveWatchHistoryToFirebase();
    }
    
    loadWatchHistoryInModal();
    
    Swal.fire({
        icon: 'success',
        title: 'Đã xóa',
        text: 'Đã xóa khỏi lịch sử xem',
        confirmButtonColor: '#8b5cf6',
        timer: 1500,
        showConfirmButton: false
    });
}

// Add movie to watch history
function addToWatchHistory(movieSlug) {
    const movieTitle = window.currentMovieTitle || movieSlug;
    const watchedAt = new Date().toISOString();
    
    // Remove all existing entries for this movie
    watchHistory = watchHistory.filter(item => item.movieSlug !== movieSlug);
    
    // Add new entry
    watchHistory.push({
        movieSlug: movieSlug,
        movieTitle: movieTitle,
        episodeName: 'Chi tiết phim',
        watchedAt: watchedAt
    });
    
    // Save to localStorage
    localStorage.setItem('watchHistory', JSON.stringify(watchHistory));
    
    // Save to Firebase if user is logged in
    if (currentUser) {
        saveWatchHistoryToFirebase();
    }
    
    // Show notification
    Swal.fire({
        icon: 'success',
        title: 'Đã thêm!',
        text: 'Đã thêm vào lịch sử xem',
        confirmButtonColor: '#8b5cf6',
        timer: 1500,
        showConfirmButton: false
    });
}

// Play episode with actual video URL
function playEpisode(slug, videoUrl) {
    if (!videoUrl || videoUrl === 'undefined') {
        Swal.fire({
            icon: 'error',
            title: 'Lỗi',
            text: 'Không thể tải thông tin tập phim. Vui lòng thử lại sau.',
            confirmButtonColor: '#8b5cf6'
        });
        return;
    }
    
    // Get current movie info
    const movieTitle = window.currentMovieTitle || 'Phim';
    const movieSlug = window.currentMovieSlug || slug;
    const episodes = window.currentMovieEpisodes || [];
    
    console.log('Playing episode:', { movieSlug, movieTitle, episodeSlug: slug, videoUrl });
    
    // Find current episode, previous episode and next episode
    let currentEpisodeIndex = -1;
    let prevEpisode = null;
    let nextEpisode = null;
    
    if (episodes && episodes.length > 0 && episodes[0] && episodes[0].items) {
        const episodeList = episodes[0].items;
        currentEpisodeIndex = episodeList.findIndex(ep => ep.slug === slug);
        
        if (currentEpisodeIndex !== -1) {
            // Find previous episode
            if (currentEpisodeIndex > 0) {
                prevEpisode = episodeList[currentEpisodeIndex - 1];
            }
            // Find next episode
            if (currentEpisodeIndex < episodeList.length - 1) {
                nextEpisode = episodeList[currentEpisodeIndex + 1];
            }
        }
    }
    
    // Add to watch history
    addToWatchHistoryForEpisode(movieSlug, movieTitle, slug);
    
    // Create video player modal
    const videoModal = document.createElement('div');
    videoModal.className = 'fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center';
    videoModal.innerHTML = `
        <div class="bg-gray-800 rounded-lg max-w-6xl w-full max-h-[95vh] overflow-hidden">
            <div class="relative">
                <button onclick="closeVideoModal()" class="absolute top-4 right-4 text-white text-2xl hover:text-red-400 z-10 bg-black bg-opacity-50 rounded-full w-10 h-10 flex items-center justify-center">
                    <i class="fas fa-times"></i>
                </button>
                <div class="aspect-video bg-black">
                    ${videoUrl.includes('.m3u8') ? `
                        <video id="videoPlayer" class="w-full h-full" controls>
                            <source src="${videoUrl}" type="application/x-mpegURL">
                            Your browser does not support video tag.
                        </video>
                    ` : `
                        <iframe id="videoPlayer" src="${videoUrl}" class="w-full h-full" frameborder="0" allowfullscreen></iframe>
                    `}
                </div>
                <div class="absolute top-4 left-4 bg-black bg-opacity-75 px-3 py-2 rounded">
                    <p class="text-white text-sm font-semibold">${movieTitle}</p>
                    <p class="text-gray-300 text-xs">${slug}</p>
                </div>
            </div>
            <!-- Episode Navigation Buttons -->
            <div class="bg-gray-900 p-4 flex justify-between items-center">
                ${prevEpisode ? `
                    <button onclick="playPrevEpisodeFromHistory('${prevEpisode.slug}', '${prevEpisode.embed || prevEpisode.m3u8}')" 
                            class="bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded-lg text-white font-semibold transition flex items-center space-x-2">
                        <i class="fas fa-backward"></i>
                        <span>Tập trước</span>
                        <span class="text-xs opacity-75">${prevEpisode.name || `Tập ${currentEpisodeIndex}`}</span>
                    </button>
                ` : '<div></div>'}
                ${nextEpisode ? `
                    <button onclick="playNextEpisodeFromHistory('${nextEpisode.slug}', '${nextEpisode.embed || nextEpisode.m3u8}')" 
                            class="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg text-white font-semibold transition flex items-center space-x-2">
                        <span>Tập tiếp theo</span>
                        <span class="text-xs opacity-75">${nextEpisode.name || `Tập ${currentEpisodeIndex + 2}`}</span>
                        <i class="fas fa-forward"></i>
                    </button>
                ` : '<div></div>'}
            </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(videoModal);
    videoModal.id = 'videoModal';
    
    // Load HLS.js for m3u8 support if needed
    if (videoUrl.includes('.m3u8')) {
        loadHLSPlayer();
    }
}

// Add to watch history for episode
async function addToWatchHistoryForEpisode(movieSlug, movieTitle, episodeName) {
    if (!movieSlug || !movieTitle) {
        console.log('Missing required data for watch history:', { movieSlug, movieTitle, episodeName });
        return;
    }
    
    const historyItem = {
        movieSlug,
        movieTitle,
        episodeName,
        episodeSlug: episodeName,
        watchedAt: new Date().toISOString()
    };
    
    console.log('Adding to watch history:', historyItem);
    
    // Remove all existing entries for this movie (ghi đè)
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
    if (currentUser) {
        await saveWatchHistoryToFirebase();
    }
    
    console.log('Watch history saved. Total items:', watchHistory.length);
    
    // Update watch history display if it's currently visible
    const watchHistorySection = document.getElementById('watchHistorySection');
    if (watchHistorySection) {
        displayWatchHistory();
    }
}

// Close video modal
function closeVideoModal() {
    const videoModal = document.getElementById('videoModal');
    if (videoModal) {
        videoModal.remove();
    }
}

// Play previous episode from history
function playPrevEpisodeFromHistory(slug, videoUrl) {
    closeVideoModal();
    playEpisode(slug, videoUrl);
}

// Play next episode from history
function playNextEpisodeFromHistory(slug, videoUrl) {
    closeVideoModal();
    playEpisode(slug, videoUrl);
}

// Load HLS.js for m3u8 streaming
function loadHLSPlayer() {
    if (window.Hls) {
        const video = document.getElementById('videoPlayer');
        if (video) {
            const hls = new Hls();
            hls.loadSource(video.src);
            hls.attachMedia(video);
        }
        return;
    }
    
    // Load HLS.js if not available
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/hls.js@latest';
    script.onload = function() {
        const video = document.getElementById('videoPlayer');
        if (video && window.Hls) {
            const hls = new Hls();
            hls.loadSource(video.src);
            hls.attachMedia(video);
        }
    };
    document.head.appendChild(script);
}

// Update episodes list when server changes
function updateEpisodesList() {
    const serverSelect = document.getElementById('serverSelect');
    const episodesList = document.getElementById('episodesList');
    
    if (!serverSelect || !episodesList || !window.currentMovieEpisodes) return;
    
    const serverIndex = parseInt(serverSelect.value);
    const server = window.currentMovieEpisodes[serverIndex];
    
    if (server && server.items) {
        episodesList.innerHTML = server.items.map((episode, index) => `
            <button onclick="playEpisode('${episode.slug}', '${episode.embed || episode.m3u8}')" 
                    class="bg-purple-600 hover:bg-purple-700 px-3 py-2 rounded text-sm transition ${isEpisodeWatched(episode.slug) ? 'ring-2 ring-blue-500' : ''}">
                ${episode.name || `Tập ${index + 1}`}
                ${isEpisodeWatched(episode.slug) ? '<i class="fas fa-check-circle text-xs ml-1"></i>' : ''}
            </button>
        `).join('');
    }
}

// Close modal when clicking outside
document.addEventListener('DOMContentLoaded', function() {
    const movieModal = document.getElementById('movieModal');
    if (movieModal) {
        movieModal.addEventListener('click', function(e) {
            if (e.target === this) {
                closeMovieModal();
            }
        });
    }
});
