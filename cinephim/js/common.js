// CinePhim - Common JavaScript Functions

// API Configuration
const SOURCES = {
    nguonc: {
        name: 'NguonC',
        base: 'https://phim.nguonc.com/api',
        endpoints: {
            new: '/films/phim-moi-cap-nhat',
            search: '/films/search',
            detail: '/film',
            category: '/categories',
            country: '/countries'
        }
    },
    ophim: {
        name: 'OPhim',
        base: 'https://ophim1.com/v1/api',
        endpoints: {
            new: '/danh-sach/phim-moi-cap-nhat',
            search: '/tim-kiem',
            detail: '/phim',
            category: '/the-loai',
            country: '/quoc-gia'
        }
    }
};

// Current source management
let currentSourceKey = localStorage.getItem('movieSource') || 'nguonc';
if (!SOURCES[currentSourceKey]) currentSourceKey = 'nguonc';

let currentSource = SOURCES[currentSourceKey];
let API_BASE = currentSource.base;

// Function to switch source
function setSource(sourceKey) {
    if (SOURCES[sourceKey]) {
        localStorage.setItem('movieSource', sourceKey);
        
        // If on movie detail page, remove episode/server params so it loads history of the new source
        if (window.location.pathname.includes('movie-detail.html')) {
            const url = new URL(window.location.href);
            url.searchParams.delete('episode');
            url.searchParams.delete('server');
            window.location.href = url.toString();
        } else {
            window.location.reload();
        }
    }
}

// Helper function to normalize API url
function getApiUrl(url) {
    return url;
}

const API_CACHE_TTL = 2 * 60 * 1000;
const apiResponseCache = new Map();
const inFlightRequests = new Map();

async function fetchJSONCached(url, { ttl = API_CACHE_TTL, force = false } = {}) {
    const now = Date.now();
    const cached = apiResponseCache.get(url);
    if (!force && cached && now - cached.timestamp < ttl) {
        return cached.data;
    }

    if (!force && inFlightRequests.has(url)) {
        return inFlightRequests.get(url);
    }

    const request = fetch(url)
        .then((response) => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            return response.json();
        })
        .then((data) => {
            apiResponseCache.set(url, { data, timestamp: Date.now() });
            return data;
        })
        .finally(() => {
            inFlightRequests.delete(url);
        });

    inFlightRequests.set(url, request);
    return request;
}

// Global variables
let favorites = [];
let pinnedMovies = [];
let isDarkMode = localStorage.getItem('darkMode') !== 'false';
let watchHistory = [];
let currentUser = null;
let authListener = null;
let hasResolvedInitialAuth = false;

// Initialize Firebase
const db = firebase.firestore();
const auth = firebase.auth();

// Image Helper Functions
function getImageOrientation(url) {
    if (!url) return 'unknown';
    
    const verticalPatterns = [
        /poster/i,
        /\/post\//i,
        /\/poster-/i,
        /-poster\./i,
        /_poster\./i,
        /\/images\/Post\//i,
        /300x450/i,
        /200x300/i,
        /400x600/i,
        /vertical/i
    ];
    
    const horizontalPatterns = [
        /thumb/i,
        /thumbnail/i,
        /\/thumb\//i,
        /-thumb\./i,
        /_thumb\./i,
        /\/images\/Thumb\//i,
        /16x9/i,
        /1280x720/i,
        /1920x1080/i,
        /horizontal/i,
        /landscape/i
    ];
    
    for (const pattern of verticalPatterns) {
        if (pattern.test(url)) {
            return 'vertical';
        }
    }
    
    for (const pattern of horizontalPatterns) {
        if (pattern.test(url)) {
            return 'horizontal';
        }
    }
    
    return 'unknown';
}

function getBestImageForOrientation(posterUrl, thumbUrl, preferredOrientation = 'vertical') {
    if (!posterUrl && !thumbUrl) return null;
    if (posterUrl && !thumbUrl) return posterUrl;
    if (!posterUrl && thumbUrl) return thumbUrl;
    
    const posterOrientation = getImageOrientation(posterUrl);
    const thumbOrientation = getImageOrientation(thumbUrl);
    
    if (preferredOrientation === 'vertical') {
        if (thumbOrientation === 'vertical') {
            return thumbUrl;
        } else if (posterOrientation === 'vertical') {
            return posterUrl;
        } else {
            return thumbUrl;
        }
    }
    
    if (preferredOrientation === 'horizontal') {
        if (posterOrientation === 'horizontal') {
            return posterUrl;
        } else if (thumbOrientation === 'horizontal') {
            return thumbUrl;
        } else {
            return posterUrl;
        }
    }
    
    return posterUrl;
}

function getVerticalImage(posterUrl, thumbUrl) {
    return getBestImageForOrientation(posterUrl, thumbUrl, 'vertical') || 
           posterUrl || 
           thumbUrl || 
           'https://placehold.co/300x450/374151/ffffff?text=No+Poster';
}

function getHorizontalImage(posterUrl, thumbUrl) {
    return getBestImageForOrientation(posterUrl, thumbUrl, 'horizontal') || 
           posterUrl || 
           thumbUrl || 
           'https://placehold.co/800x450/374151/ffffff?text=No+Image';
}

function getHeroImage(posterUrl, thumbUrl) {
    return getVerticalImage(posterUrl, thumbUrl);
}

// Initialize Firebase and common functions
document.addEventListener('DOMContentLoaded', function() {
    // Render source switcher if container exists
    renderSourceSwitcher();

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
            loadPinnedMoviesFromFirebase();
        } else {
            console.log('User not logged in');
            watchHistory = [];
            favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
            pinnedMovies = JSON.parse(localStorage.getItem('pinnedMovies') || '[]');
        }
        updateLoginButton();
        applyTheme();

        if (!hasResolvedInitialAuth) {
            hasResolvedInitialAuth = true;
        }
        document.dispatchEvent(new CustomEvent('cinephim:auth-ready', { detail: { user: currentUser } }));
    });
});

// Load favorites from Firebase
async function loadFavoritesFromFirebase() {
    if (!currentUser) {
        // Fallback to localStorage if not logged in
        favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
        return;
    }
    
    try {
        const snapshot = await db.collection('users').doc(currentUser.uid).collection('favorites').orderBy('addedAt', 'desc').get();
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
    
    // Only load if watchHistory is empty (first time login)
    if (watchHistory.length > 0) {
        console.log('Watch history already loaded, skipping Firebase load');
        return;
    }
    
    try {
        const snapshot = await db.collection('users').doc(currentUser.uid).collection('watchHistory').orderBy('watchedAt', 'desc').get();
        watchHistory = [];
        snapshot.forEach(doc => {
            watchHistory.push(doc.data());
        });
        console.log('Watch history loaded from Firebase:', watchHistory);
    } catch (error) {
        console.error('Error loading watch history:', error);
        watchHistory = [];
    }
}

// Save watch history to Firebase
async function saveWatchHistoryToFirebase() {
    if (!currentUser) return;
    
    try {
        const userRef = db.collection('users').doc(currentUser.uid);
        const historyRef = userRef.collection('watchHistory');
        
        // Process each item in watchHistory array
        const batch = db.batch();
        
        for (const item of watchHistory) {
            // Check if this movie already exists in Firebase
            const existingSnapshot = await historyRef.where('movieSlug', '==', item.movieSlug).get();
            
            if (!existingSnapshot.empty) {
                // Update existing document
                existingSnapshot.forEach(doc => {
                    batch.update(doc.ref, item);
                });
            } else {
                // Add new document
                const docRef = historyRef.doc();
                batch.set(docRef, item);
            }
        }
        
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
            watchHistory = [];
            if (loginIcon) loginIcon.className = 'fas fa-sign-in-alt mr-1';
            if (loginText) loginText.textContent = 'Đăng nhập';
            console.log('User logged out');
            // Reload page after logout
            window.location.reload();
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
        
        console.log('Login successful:', currentUser.email);
        Swal.fire({
            icon: 'success',
            title: 'Thành công!',
            text: 'Đăng nhập thành công!',
            confirmButtonColor: '#8b5cf6',
            timer: 2000,
            showConfirmButton: false
        }).then(() => {
            // Reload page after successful login
            window.location.reload();
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
        }).then(() => {
            // Reload page after successful registration
            window.location.reload();
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

// Toggle mobile user dropdown menu
function toggleMobileUserDropdown() {
    const dropdown = document.getElementById('mobileUserDropdown');
    if (dropdown) {
        dropdown.classList.toggle('hidden');
    }
}

// Close mobile user dropdown when clicking outside
document.addEventListener('click', function(event) {
    const mobileUserProfileMenu = document.getElementById('mobileUserProfileMenu');
    const mobileUserDropdown = document.getElementById('mobileUserDropdown');
    
    if (mobileUserProfileMenu && mobileUserDropdown && !mobileUserDropdown.classList.contains('hidden')) {
        if (!mobileUserProfileMenu.contains(event.target)) {
            mobileUserDropdown.classList.add('hidden');
        }
    }
});

// Toggle user dropdown menu
function toggleUserDropdown() {
    const dropdown = document.getElementById('userDropdown');
    if (dropdown) {
        dropdown.classList.toggle('hidden');
    }
}

// Close user dropdown when clicking outside
document.addEventListener('click', function(event) {
    const userProfileMenu = document.getElementById('userProfileMenu');
    const userDropdown = document.getElementById('userDropdown');
    
    if (userProfileMenu && userDropdown && !userDropdown.classList.contains('hidden')) {
        if (!userProfileMenu.contains(event.target)) {
            userDropdown.classList.add('hidden');
        }
    }
});

// Handle logout from dropdown
async function handleLogout() {
    try {
        await auth.signOut();
        currentUser = null;
        watchHistory = [];
        
        // Close desktop dropdown
        const dropdown = document.getElementById('userDropdown');
        if (dropdown) {
            dropdown.classList.add('hidden');
        }
        
        // Close mobile dropdown
        const mobileDropdown = document.getElementById('mobileUserDropdown');
        if (mobileDropdown) {
            mobileDropdown.classList.add('hidden');
        }
        
        // Update UI
        updateLoginButton();
        
        console.log('User logged out');
        
        Swal.fire({
            icon: 'success',
            title: 'Đã đăng xuất!',
            text: 'Bạn đã đăng xuất thành công.',
            confirmButtonColor: '#8b5cf6',
            timer: 2000,
            showConfirmButton: false
        }).then(() => {
            // Reload page after successful logout
            window.location.reload();
        });
    } catch (error) {
        console.error('Logout error:', error);
        Swal.fire({
            icon: 'error',
            title: 'Lỗi',
            text: 'Không thể đăng xuất. Vui lòng thử lại.',
            confirmButtonColor: '#8b5cf6'
        });
    }
}

// Show account modal (placeholder function)
function showAccountModal() {
    // Close desktop dropdown first
    const dropdown = document.getElementById('userDropdown');
    if (dropdown) {
        dropdown.classList.add('hidden');
    }
    
    // Close mobile dropdown
    const mobileDropdown = document.getElementById('mobileUserDropdown');
    if (mobileDropdown) {
        mobileDropdown.classList.add('hidden');
    }
    
    Swal.fire({
        icon: 'info',
        title: 'Tài khoản',
        text: 'Chức năng quản lý tài khoản sẽ sớm được cập nhật!',
        confirmButtonColor: '#8b5cf6'
    });
}

// Update login button based on auth state
function updateLoginButton() {
    // Desktop elements
    const userProfileMenu = document.getElementById('userProfileMenu');
    const loginButton = document.getElementById('loginButton');
    const userEmail = document.getElementById('userEmail');
    const userAvatar = document.getElementById('userAvatar');
    
    // Mobile elements
    const mobileUserProfileMenu = document.getElementById('mobileUserProfileMenu');
    const mobileLoginButton = document.getElementById('mobileLoginButton');
    const mobileUserEmail = document.getElementById('mobileUserEmail');
    const mobileUserAvatar = document.getElementById('mobileUserAvatar');
    
    if (currentUser) {
        // Show user profile menu, hide login button for desktop
        if (userProfileMenu) {
            userProfileMenu.classList.remove('hidden');
            
            // Update user email
            if (userEmail) {
                userEmail.textContent = currentUser.email || 'user@example.com';
            }
            
            // Generate user avatar with first letter of email
            if (userAvatar) {
                const firstLetter = currentUser.email ? currentUser.email.charAt(0).toUpperCase() : 'U';
                userAvatar.src = `https://ui-avatars.com/api/?name=${firstLetter}&background=6366f1&color=ffffff&size=32`;
                userAvatar.alt = currentUser.email || 'User Avatar';
            }
        }
        
        if (loginButton) {
            loginButton.classList.add('hidden');
        }
        
        // Show user profile menu, hide login button for mobile
        if (mobileUserProfileMenu) {
            mobileUserProfileMenu.classList.remove('hidden');
            
            // Update mobile user email
            if (mobileUserEmail) {
                mobileUserEmail.textContent = currentUser.email || 'user@example.com';
            }
            
            // Generate mobile user avatar
            if (mobileUserAvatar) {
                const firstLetter = currentUser.email ? currentUser.email.charAt(0).toUpperCase() : 'U';
                mobileUserAvatar.src = `https://ui-avatars.com/api/?name=${firstLetter}&background=6366f1&color=ffffff&size=28`;
                mobileUserAvatar.alt = currentUser.email || 'User Avatar';
            }
        }
        
        if (mobileLoginButton) {
            mobileLoginButton.classList.add('hidden');
        }
    } else {
        // Show login button, hide user profile menu for desktop
        if (userProfileMenu) {
            userProfileMenu.classList.add('hidden');
        }
        
        if (loginButton) {
            loginButton.classList.remove('hidden');
            
            // Update login button content
            const loginIcon = document.getElementById('loginIcon');
            const loginText = document.getElementById('loginText');
            
            if (loginIcon) loginIcon.className = 'fas fa-sign-in-alt mr-1';
            if (loginText) loginText.textContent = 'Đăng nhập';
        }
        
        // Show login button, hide user profile menu for mobile
        if (mobileUserProfileMenu) {
            mobileUserProfileMenu.classList.add('hidden');
        }
        
        if (mobileLoginButton) {
            mobileLoginButton.classList.remove('hidden');
            
            // Update mobile login icon
            const mobileLoginIcon = document.getElementById('mobileLoginIcon');
            if (mobileLoginIcon) {
                mobileLoginIcon.className = 'fas fa-sign-in-alt';
            }
        }
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

// Show movie detail - redirect to detail page
function showMovieDetail(slug) {
    window.location.href = `movie-detail.html?slug=${slug}`;
}

// Close movie modal
function closeMovieModal() {
    const modal = document.getElementById('movieModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// Check if episode is watched
function isEpisodeWatched(episodeSlug, movieSlug = null) {
    const slugToCheck = movieSlug || window.currentMovieSlug;
    return watchHistory.some(item => 
        item.movieSlug === slugToCheck && 
        item.episodeSlug === episodeSlug
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
        }).then(() => {
            // Reload page after showing notification
            window.location.reload();
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

// Resolve OPhim relative image paths robustly
function resolveOPhimImageUrl(url, pathImageFromApi = '') {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    
    // Default CDN domain
    let cdnDomain = 'https://img.ophim.live';
    
    // Try to extract cdn domain from pathImageFromApi if it is valid
    if (pathImageFromApi && typeof pathImageFromApi === 'string' && pathImageFromApi.startsWith('http')) {
        // Remove trailing slash if present
        cdnDomain = pathImageFromApi.replace(/\/$/, '');
    }
    
    // Check if url already contains /uploads/movies/ or uploads/movies/
    if (url.startsWith('/uploads/movies/')) {
        return `${cdnDomain}${url}`;
    } else if (url.startsWith('uploads/movies/')) {
        return `${cdnDomain}/${url}`;
    } else {
        // If it's just a filename, prepend cdnDomain + /uploads/movies/
        return `${cdnDomain}/uploads/movies/${url}`;
    }
}

// Data Normalization Helpers
function normalizeMovieData(item, pathImage = '') {
    if (!item) return null;
    
    // Normalize based on source
    if (currentSourceKey === 'ophim') {
        let poster_url = resolveOPhimImageUrl(item.poster_url || '', pathImage);
        let thumb_url = resolveOPhimImageUrl(item.thumb_url || '', pathImage);
        
        return {
            name: item.name || item.title || '',
            slug: item.slug || '',
            poster_url: poster_url,
            thumb_url: thumb_url,
            quality: item.quality || 'HD',
            current_episode: item.episode_current || '',
            total_episodes: item.episode_total || '',
            year: item.year || '',
            category: item.category || [],
            country: item.country || []
        };
    }
    
    // NguonC is already in the expected format, but let's ensure consistency
    return {
        name: item.name || item.title || '',
        slug: item.slug || '',
        poster_url: item.poster_url || '',
        thumb_url: item.thumb_url || '',
        quality: item.quality || 'HD',
        current_episode: item.current_episode || '',
        total_episodes: item.total_episodes || '',
        year: item.year || item.time || '',
        category: item.category || [],
        country: item.country || []
    };
}

function normalizePagination(data) {
    if (currentSourceKey === 'ophim') {
        const p = data.data?.params?.pagination || data.params?.pagination;
        if (!p) return null;
        return {
            current_page: p.currentPage,
            total_page: p.totalPages || Math.ceil(p.totalItems / p.totalItemsPerPage) || 1,
            total_items: p.totalItems,
            per_page: p.totalItemsPerPage
        };
    }
    
    return data.paginate || null;
}

// Render source switcher UI
function renderSourceSwitcher() {
    const desktopContainer = document.getElementById('sourceSwitcherDesktop');
    const mobileContainer = document.getElementById('sourceSwitcherMobile');
    
    const html = `
        <div class="flex items-center space-x-2 bg-gray-700 rounded-lg p-1">
            ${Object.keys(SOURCES).map(key => `
                <button onclick="setSource('${key}')" 
                        class="px-3 py-1 text-xs rounded-md transition ${currentSourceKey === key ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-gray-600'}">
                    ${SOURCES[key].name}
                </button>
            `).join('')}
        </div>
    `;
    
    if (desktopContainer) desktopContainer.innerHTML = html;
    if (mobileContainer) mobileContainer.innerHTML = html;
}

// Add to watch history
async function addToWatchHistory(movieSlug, movieTitle, episodeName) {
    if (!movieSlug || !movieTitle) {
        console.log('Missing required data for watch history:', { movieSlug, movieTitle, episodeName });
        return;
    }
    
    // Check if this episode is already in watch history (avoid duplicates)
    const existingEntry = watchHistory.find(item => 
        item.movieSlug === movieSlug && 
        item.source === currentSourceKey && // Source-specific history
        (item.episodeSlug === episodeName || item.episodeName === episodeName)
    );
    
    if (existingEntry) {
        console.log('Episode already in watch history, skipping save');
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
    if (!dateString) return 'Không rõ';
    
    const date = new Date(dateString);
    
    // Check if date is invalid
    if (isNaN(date.getTime())) {
        return 'Không rõ';
    }
    
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
    
    // Check if this episode is already in watch history (avoid duplicates)
    const existingEntry = watchHistory.find(item => 
        item.movieSlug === movieSlug && 
        (item.episodeSlug === episodeName || item.episodeName === episodeName)
    );
    
    if (existingEntry) {
        console.log('Episode already in watch history, skipping save');
        return;
    }
    
    // Get current server index if available
    const serverSelect = document.getElementById('serverSelect');
    const serverIndex = serverSelect ? parseInt(serverSelect.value) : 0;
    const serverName = window.currentMovieEpisodes && window.currentMovieEpisodes[serverIndex] ? 
                      window.currentMovieEpisodes[serverIndex].server_name : 'Server 1';
    
    const historyItem = {
        movieSlug,
        movieTitle,
        episodeName,
        episodeSlug: episodeName,
        serverIndex: serverIndex,
        serverName: serverName,
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
        episodesList.innerHTML = [...server.items].reverse().map((episode, index) => `
            <button onclick="playEpisode('${episode.slug}', '${episode.embed || episode.m3u8}')" 
                    class="bg-purple-600 hover:bg-purple-700 px-3 py-2 rounded text-sm transition ${isEpisodeWatched(episode.slug, window.currentMovieSlug) ? 'ring-2 ring-blue-500' : ''}">
                ${episode.name || `Tập ${server.items.length - index}`}
                ${isEpisodeWatched(episode.slug, window.currentMovieSlug) ? '<i class="fas fa-check-circle text-xs ml-1"></i>' : ''}
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

function showLoading() {
    const loading = document.getElementById('loading');
    if (loading) {
        loading.classList.remove('hidden');
    }
}

function hideLoading() {
    const loading = document.getElementById('loading');
    if (loading) {
        loading.classList.add('hidden');
    }
}

// Load pinned movies from Firebase
async function loadPinnedMoviesFromFirebase() {
    if (!currentUser) {
        // Fallback to localStorage if not logged in
        pinnedMovies = JSON.parse(localStorage.getItem('pinnedMovies') || '[]');
        return;
    }
    
    try {
        const snapshot = await db.collection('users').doc(currentUser.uid).collection('pinnedMovies').orderBy('pinnedAt', 'desc').get();
        pinnedMovies = [];
        snapshot.forEach(doc => {
            pinnedMovies.push(doc.data());
        });
        console.log('Pinned movies loaded from Firebase:', pinnedMovies);
    } catch (error) {
        console.error('Error loading pinned movies:', error);
        // Fallback to localStorage
        pinnedMovies = JSON.parse(localStorage.getItem('pinnedMovies') || '[]');
    }
}

// Save pinned movies to Firebase
async function savePinnedMoviesToFirebase() {
    if (!currentUser) return;
    
    try {
        const userRef = db.collection('users').doc(currentUser.uid);
        const pinnedRef = userRef.collection('pinnedMovies');
        
        // Clear existing pinned movies
        const existingDocs = await pinnedRef.get();
        const batch = db.batch();
        
        existingDocs.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        // Add new pinned movies
        pinnedMovies.forEach(item => {
            const docRef = pinnedRef.doc();
            // Clean data before saving
            const cleanItem = {
                slug: item.slug || '',
                title: item.title || '',
                name: item.name || '',
                poster_url: item.poster_url || '',
                thumb_url: item.thumb_url || '',
                pinnedAt: item.pinnedAt || new Date().toISOString()
            };
            batch.set(docRef, cleanItem);
        });
        
        await batch.commit();
        console.log('Pinned movies saved to Firebase');
    } catch (error) {
        console.error('Error saving pinned movies:', error);
    }
}

// Toggle pin movie
async function togglePin(slug, movieData = null) {
    const index = pinnedMovies.findIndex(pin => pin.slug === slug);
    
    if (index > -1) {
        // Remove from pinned movies
        pinnedMovies.splice(index, 1);
        
        // Show notification
        Swal.fire({
            icon: 'success',
            title: 'Đã bỏ ghim',
            text: 'Phim đã được bỏ khỏi danh sách ghim',
            timer: 2000,
            showConfirmButton: false
        });
        
        // Update pin button if it exists
        updatePinButton(slug, false);
    } else {
        // Add to pinned movies
        const movieInfo = movieData || {
            slug: slug,
            title: slug,
            name: slug,
            poster_url: '',
            thumb_url: '',
            year: ''
        };
        
        const newMovieData = {
            slug: movieInfo.slug,
            title: movieInfo.name || movieInfo.title || slug,
            name: movieInfo.name || movieInfo.title || slug,
            poster_url: movieInfo.poster_url || '',
            thumb_url: movieInfo.thumb_url || '',
            year: movieInfo.year || '',
            pinnedAt: new Date().toISOString()
        };
        pinnedMovies.unshift(newMovieData);
        
        // Show notification
        Swal.fire({
            icon: 'success',
            title: 'Đã ghim phim',
            text: 'Phim đã được thêm vào danh sách ghim',
            timer: 2000,
            showConfirmButton: false
        });
        
        // Update pin button if it exists
        updatePinButton(slug, true);
    }
    
    // Save to Firebase if logged in, otherwise localStorage
    if (currentUser) {
        await savePinnedMoviesToFirebase();
    } else {
        localStorage.setItem('pinnedMovies', JSON.stringify(pinnedMovies));
    }
    
    // Update movie detail page if it's open
    if (typeof updatePinButton === 'function') {
        updatePinButton(slug, pinnedMovies.some(pin => pin.slug === slug));
    }
}

// Update pin button state
function updatePinButton(slug, isPinned) {
    const pinButton = document.querySelector('button[onclick="togglePinMovie()"]');
    if (pinButton && currentMovie && currentMovie.slug === slug) {
        if (isPinned) {
            pinButton.innerHTML = '<i class="fas fa-thumbtack mr-2"></i>Bỏ ghim';
            pinButton.classList.remove('bg-yellow-600', 'hover:bg-yellow-700');
            pinButton.classList.add('bg-gray-600', 'hover:bg-gray-700');
        } else {
            pinButton.innerHTML = '<i class="fas fa-thumbtack mr-2"></i>Ghim phim';
            pinButton.classList.remove('bg-gray-600', 'hover:bg-gray-700');
            pinButton.classList.add('bg-yellow-600', 'hover:bg-yellow-700');
        }
    }
}

// Check if movie is pinned
function isMoviePinned(slug) {
    return pinnedMovies.some(pin => pin.slug === slug);
}

function showError(message) {
    Swal.fire({
        icon: 'error',
        title: 'Lỗi',
        text: message,
        confirmButtonColor: '#8b5cf6'
    });
}
