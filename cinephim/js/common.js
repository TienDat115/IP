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
    },
    kkphim: {
        name: 'KKPhim',
        base: 'https://phimapi.com',
        endpoints: {
            new: '/danh-sach/phim-moi-cap-nhat',
            search: '/v1/api/tim-kiem',
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
        localStorage.setItem('previousMovieSource', currentSourceKey);
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
        if (currentSourceKey === 'kkphim') {
            return posterUrl || thumbUrl;
        }

        if (currentSourceKey === 'ophim') {
            // For OPhim:
            // posterUrl is mapped to image_url (often a landscape seo image/banner)
            // thumbUrl is mapped to item.thumb_url (the actual vertical poster)
            return thumbUrl || posterUrl;
        }

        if (thumbOrientation === 'vertical') {
            return thumbUrl;
        } else if (posterOrientation === 'vertical') {
            return posterUrl;
        } else {
            return posterUrl || thumbUrl;
        }
    }
    
    if (preferredOrientation === 'horizontal') {
        if (currentSourceKey === 'ophim') {
            // For OPhim, posterUrl contains the banner/seo image, which is horizontal
            return posterUrl || thumbUrl;
        }
        if (posterOrientation === 'horizontal') {
            return posterUrl;
        } else if (thumbOrientation === 'horizontal') {
            return thumbUrl;
        } else {
            return thumbUrl || posterUrl;
        }
    }
    
    return posterUrl;
}

function placeholderImg(w, h, text, bg = '#374151', fg = '#ffffff') {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="${bg}"/><text x="${w/2}" y="${h/2}" font-family="sans-serif" font-size="${Math.min(w,h)/12}" fill="${fg}" text-anchor="middle" dominant-baseline="central">${text.replace(/"/g, '&quot;')}</text></svg>`;
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

function getVerticalImage(posterUrl, thumbUrl) {
    return getBestImageForOrientation(posterUrl, thumbUrl, 'vertical') || 
           posterUrl || 
           thumbUrl || 
           placeholderImg(300, 450, 'No Poster');
}

function getHeroImage(posterUrl, thumbUrl) {
    return getVerticalImage(posterUrl, thumbUrl);
}

function applyPosterOrientationClass(img) {
    if (!img || !img.classList || !img.classList.contains('film-poster')) return;
    if (!img.naturalWidth || !img.naturalHeight) return;

    img.classList.remove('film-poster-landscape');

    // Commented out to maintain consistent portrait aspect ratio for all cards
    /*
    if (img.naturalWidth > img.naturalHeight) {
        img.classList.add('film-poster-landscape');
    }
    */
}

const posterObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
            if (node.nodeType !== 1) continue;
            if (node.tagName === 'IMG' && node.classList.contains('film-poster')) {
                if (node.complete) {
                    applyPosterOrientationClass(node);
                } else {
                    node.addEventListener('load', () => applyPosterOrientationClass(node), { once: true });
                }
            }
            const imgs = node.querySelectorAll?.('img.film-poster') || [];
            for (const img of imgs) {
                if (img.complete) {
                    applyPosterOrientationClass(img);
                } else {
                    img.addEventListener('load', () => applyPosterOrientationClass(img), { once: true });
                }
            }
        }
    }
});

document.addEventListener('DOMContentLoaded', function() {
    const posters = document.querySelectorAll('img.film-poster');
    posters.forEach((img) => {
        if (img.complete) {
            applyPosterOrientationClass(img);
        } else {
            img.addEventListener('load', () => applyPosterOrientationClass(img), { once: true });
        }
    });
    if (document.body) {
        posterObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
});

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
            loadWatchHistoryFromFirebase();
            loadFavoritesFromFirebase();
            loadPinnedMoviesFromFirebase();
        } else {
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
                source: item.source || currentSourceKey || '',
                addedAt: item.addedAt || new Date().toISOString()
            };
            batch.set(docRef, cleanItem);
        });
        
        await batch.commit();
    } catch (error) {
        console.error('Error saving favorites:', error);
    }
}

// Load watch history from Firebase
async function loadWatchHistoryFromFirebase() {
    if (!currentUser) return;
    
    // Only load if watchHistory is empty (first time login)
    if (watchHistory.length > 0) {
        return;
    }
    
    try {
        const snapshot = await db.collection('users').doc(currentUser.uid).collection('watchHistory').orderBy('watchedAt', 'desc').get();
        watchHistory = [];
        snapshot.forEach(doc => {
            watchHistory.push(doc.data());
        });
    } catch (error) {
        console.error('Error loading watch history:', error);
        watchHistory = [];
    }
}

// Save a single watch history item to Firebase immediately
async function saveSingleWatchHistoryItem(historyItem) {
    if (!currentUser) return;

    try {
        const historyRef = db.collection('users').doc(currentUser.uid).collection('watchHistory');
        const existingSnapshot = await historyRef.where('movieSlug', '==', historyItem.movieSlug).get();

        if (!existingSnapshot.empty) {
            existingSnapshot.forEach(doc => {
                doc.ref.update(historyItem);
            });
        } else {
            await historyRef.add(historyItem);
        }
    } catch (error) {
        console.error('Error saving watch history item:', error);
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
    
    // Toggle user-specific sections on homepage
    const recentWatchedSection = document.getElementById('recentWatchedSection');
    const pinnedMoviesSection = document.getElementById('pinnedMoviesSection');
    
    if (currentUser) {
        if (recentWatchedSection) recentWatchedSection.classList.remove('hidden');
        if (pinnedMoviesSection) pinnedMoviesSection.classList.remove('hidden');
    } else {
        if (recentWatchedSection) recentWatchedSection.classList.add('hidden');
        if (pinnedMoviesSection) pinnedMoviesSection.classList.add('hidden');
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
            source: currentSourceKey,
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

// Resolve KKPhim relative image paths
function resolveKKPhimImageUrl(url, pathImageFromApi = '') {
    if (!url) return '';
    if (url.startsWith('http')) return url;

    let cdnDomain = 'https://phimimg.com';

    if (pathImageFromApi && typeof pathImageFromApi === 'string' && pathImageFromApi.startsWith('http')) {
        cdnDomain = pathImageFromApi.replace(/\/$/, '');
    }

    if (url.startsWith('/')) {
        return `${cdnDomain}${url}`;
    }
    return `${cdnDomain}/${url}`;
}

function stripHtml(str) {
    if (!str) return '';
    return str.replace(/<[^>]*>/g, '');
}

// Data Normalization Helpers
function normalizeMovieData(item, pathImage = '') {
    if (!item) return null;
    
    // Normalize based on source
    if (currentSourceKey === 'ophim') {
        let image_url = resolveOPhimImageUrl(item.data?.seoOnPage?.seoSchema?.image || item.seoOnPage?.seoSchema?.image || item.seoSchema?.image || item.image || '', pathImage);
        let thumb_url = resolveOPhimImageUrl(item.thumb_url || '', pathImage);
        let poster_url = image_url || thumb_url || resolveOPhimImageUrl(item.poster_url || '', pathImage);
        
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
    
    if (currentSourceKey === 'kkphim') {
        let poster_url = resolveKKPhimImageUrl(item.poster_url || '', pathImage);
        let thumb_url = resolveKKPhimImageUrl(item.thumb_url || '', pathImage);

        return {
            name: item.name || item.title || '',
            slug: item.slug || '',
            poster_url: poster_url,
            thumb_url: thumb_url,
            quality: item.quality || 'HD',
            current_episode: item.episode_current || item.current_episode || '',
            total_episodes: item.episode_total || item.total_episodes || '',
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
    
    if (currentSourceKey === 'kkphim') {
        const p = data.pagination || data.data?.params?.pagination || data.params?.pagination;
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

    const currentName = currentSource?.name || 'NguonC';
    const optionsHtml = Object.keys(SOURCES).map(key => `
        <button onclick="setSource('${key}')"
                class="flex items-center w-full px-4 py-2 text-sm transition ${currentSourceKey === key ? 'bg-purple-600 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'}">
            <span class="flex-1 text-left" style="display:inline">${SOURCES[key].name}</span>
            ${currentSourceKey === key ? '<i class="fas fa-check text-purple-200"></i>' : ''}
        </button>
    `).join('');

    const desktopHtml = `
        <div class="relative source-switcher">
            <button onclick="toggleSourceDropdown(this)"
                    class="flex items-center bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition border border-gray-600 hover:border-purple-500 px-3 py-1.5">
                <i class="fas fa-exchange-alt text-purple-400 text-xs mr-1.5"></i>
                <span class="text-white font-medium">${currentName}</span>
                <i class="fas fa-chevron-down text-gray-500 text-xs ml-1 transition-transform duration-200 source-dropdown-arrow"></i>
            </button>
            <div class="absolute right-0 mt-2 w-44 bg-gray-800 rounded-lg shadow-xl border border-gray-700 hidden z-50 overflow-hidden source-dropdown-menu">
                ${optionsHtml}
            </div>
        </div>
    `;

    const mobileHtml = `
        <div class="relative source-switcher">
            <button onclick="toggleSourceDropdown(this)"
                    class="flex items-center bg-gray-700 hover:bg-gray-600 rounded-lg text-xs transition border border-gray-600 px-2 py-1">
                <span class="text-white font-semibold" style="display:inline">${currentName}</span>
                <i class="fas fa-chevron-down text-gray-500 ml-1 transition-transform duration-200 source-dropdown-arrow" style="font-size:9px"></i>
            </button>
            <div class="absolute right-0 mt-1 w-40 bg-gray-800 rounded-lg shadow-xl border border-gray-700 hidden z-50 overflow-hidden source-dropdown-menu">
                ${optionsHtml}
            </div>
        </div>
    `;

    if (desktopContainer) desktopContainer.innerHTML = desktopHtml;
    if (mobileContainer) mobileContainer.innerHTML = mobileHtml;
}

// Toggle source dropdown
function toggleSourceDropdown(btn) {
    const switcher = btn.closest('.source-switcher');
    if (!switcher) return;
    const dropdown = switcher.querySelector('.source-dropdown-menu');
    const arrow = switcher.querySelector('.source-dropdown-arrow');
    if (dropdown) {
        const isHidden = dropdown.classList.contains('hidden');
        // Close all other dropdowns first
        document.querySelectorAll('.source-dropdown-menu').forEach(m => {
            if (m !== dropdown) m.classList.add('hidden');
        });
        document.querySelectorAll('.source-dropdown-arrow').forEach(a => {
            if (a !== arrow) a.style.transform = 'rotate(0deg)';
        });
        dropdown.classList.toggle('hidden');
        if (arrow) {
            arrow.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
        }
    }
}

// Close source dropdown when clicking outside
document.addEventListener('click', function(event) {
    document.querySelectorAll('.source-switcher').forEach(switcher => {
        const dropdown = switcher.querySelector('.source-dropdown-menu');
        const arrow = switcher.querySelector('.source-dropdown-arrow');
        if (dropdown && !dropdown.classList.contains('hidden') && !switcher.contains(event.target)) {
            dropdown.classList.add('hidden');
            if (arrow) {
                arrow.style.transform = 'rotate(0deg)';
            }
        }
    });
});

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

// Format episode info
function formatEpisodeInfo(currentEpisode, totalEpisodes) {
    if (!currentEpisode) return '';

    if (currentEpisode.toLowerCase().includes('full') ||
        currentEpisode.toLowerCase().includes('hoàn tất') ||
        currentEpisode.toLowerCase().includes('completed')) {
        return currentEpisode;
    }

    const currentMatch = currentEpisode.match(/(\d+)/);
    const currentNum = currentMatch ? parseInt(currentMatch[1]) : 0;

    let totalNum = 0;
    if (totalEpisodes) {
        const totalMatch = totalEpisodes.toString().match(/(\d+)/);
        totalNum = totalMatch ? parseInt(totalMatch[1]) : 0;
    }

    if (currentNum > 0 && totalNum > 0) {
        return `${currentNum}/${totalNum}`;
    }

    if (currentNum > 0) {
        return `Tập ${currentNum}`;
    }

    return currentEpisode;
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
async function removeFromWatchHistory(movieSlug, episodeName) {
    watchHistory = watchHistory.filter(item => 
        !(item.movieSlug === movieSlug && item.episodeName === episodeName)
    );
    
    if (currentUser) {
        try {
            const historyRef = db.collection('users').doc(currentUser.uid).collection('watchHistory');
            const snapshot = await historyRef.where('movieSlug', '==', movieSlug).get();
            const batch = db.batch();
            snapshot.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
        } catch (error) {
            console.error('Error removing from watch history:', error);
        }
    }
    
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
    
    const historyItem = {
        movieSlug: movieSlug,
        movieTitle: movieTitle,
        episodeName: 'Chi tiết phim',
        watchedAt: watchedAt,
        poster_url: window.currentMoviePosterUrl || '',
        thumb_url: window.currentMovieThumbUrl || ''
    };
    
    watchHistory.push(historyItem);
    
    // Save to Firebase immediately if user is logged in
    if (currentUser) {
        saveSingleWatchHistoryItem(historyItem);
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
        return;
    }
    
    // Check if this episode is already in watch history (avoid duplicates)
    const existingEntry = watchHistory.find(item => 
        item.movieSlug === movieSlug && 
        (item.episodeSlug === episodeName || item.episodeName === episodeName)
    );
    
    if (existingEntry) {
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
        watchedAt: new Date().toISOString(),
        poster_url: window.currentMoviePosterUrl || '',
        thumb_url: window.currentMovieThumbUrl || ''
    };
    
    // Remove all existing entries for this movie (ghi đè)
    watchHistory = watchHistory.filter(item => item.movieSlug !== movieSlug);
    
    // Add new entry at the beginning
    watchHistory.unshift(historyItem);
    
    // Keep only last 50 items
    if (watchHistory.length > 50) {
        watchHistory = watchHistory.slice(0, 50);
    }
    
    // Save to Firebase immediately if user is logged in
    if (currentUser) {
        await saveSingleWatchHistoryItem(historyItem);
    }
    
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

function showWarning(message) {
    Swal.fire({
        icon: 'warning',
        title: 'Cảnh báo',
        text: message,
        confirmButtonColor: '#8b5cf6'
    });
}

function showInfo(message) {
    Swal.fire({
        icon: 'info',
        title: 'Thông báo',
        text: message,
        confirmButtonColor: '#8b5cf6',
        timer: 2000,
        showConfirmButton: false
    });
}

function goToMovieDetail(slug) {
    showMovieDetail(slug);
}

function showPageLoading(show) {
    const loading = document.getElementById('loading');
    const moviesContainer = document.getElementById('moviesContainer');
    if (loading) loading.classList.toggle('hidden', !show);
    if (moviesContainer) moviesContainer.classList.toggle('hidden', show);
}

function showPageNoResults() {
    const noResults = document.getElementById('noResults');
    const moviesContainer = document.getElementById('moviesContainer');
    if (noResults) noResults.classList.remove('hidden');
    if (moviesContainer) moviesContainer.classList.add('hidden');
}

function hidePageNoResults() {
    const noResults = document.getElementById('noResults');
    const moviesContainer = document.getElementById('moviesContainer');
    if (noResults) noResults.classList.add('hidden');
    if (moviesContainer) moviesContainer.classList.remove('hidden');
}

function getMovieCardHTML(movie) {
    return `
        <div class="film-card bg-gray-800 rounded-lg overflow-hidden cursor-pointer" onclick="showMovieDetail('${movie.slug}')">
            <div class="relative">
                <img src="${getVerticalImage(movie.poster_url, movie.thumb_url)}" 
                     alt="${movie.name || movie.title}" 
                     loading="lazy" decoding="async" class="film-poster w-full"
                     onerror="this.src=placeholderImg(300,450,'No Poster')"
                     onload="applyPosterOrientationClass(this)">
                <div class="absolute top-2 right-2 bg-purple-600 px-2 py-1 rounded text-xs font-semibold">
                    ${movie.quality || 'HD'}
                </div>
                ${movie.current_episode || movie.year ? `
                    <div class="absolute bottom-2 left-2 bg-black bg-opacity-75 px-2 py-1 rounded text-xs">
                        ${movie.current_episode ? formatEpisodeInfo(movie.current_episode, movie.total_episodes) : movie.year}
                    </div>
                ` : ''}
            </div>
            <div class="p-4">
                <h3 class="font-semibold text-sm mb-2 line-clamp-2">${movie.name || movie.title}</h3>
                <p class="text-gray-400 text-xs mb-2">${movie.year || movie.time || ''}</p>
                <div class="flex items-center justify-between">
                    <span class="text-xs text-gray-500">${getCountryFromCategory(movie.category) || ''}</span>
                </div>
            </div>
        </div>
    `;
}

function getPaginationHTML(current, total, onClick, maxVisible = 5) {
    if (total <= 1) return '';
    let html = '';
    
    const prevDisabled = current <= 1;
    html += `<button onclick="${prevDisabled ? '' : onClick.replace('{page}', current - 1)}" class="px-3 py-2 rounded-lg text-sm font-medium transition ${prevDisabled ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-700 text-white hover:bg-gray-600'}" ${prevDisabled ? 'disabled' : ''}><i class="fas fa-chevron-left"></i></button>`;
    
    let startPage = Math.max(1, current - Math.floor(maxVisible / 2));
    let endPage = Math.min(total, startPage + maxVisible - 1);
    if (endPage - startPage < maxVisible - 1) {
        startPage = Math.max(1, endPage - maxVisible + 1);
    }
    
    if (startPage > 1) {
        html += `<button onclick="${onClick.replace('{page}', 1)}" class="px-3 py-2 rounded-lg text-sm font-medium bg-gray-700 text-white hover:bg-gray-600 transition">1</button>`;
        if (startPage > 2) html += `<span class="px-2 text-gray-400">...</span>`;
    }
    
    for (let i = startPage; i <= endPage; i++) {
        html += `<button onclick="${onClick.replace('{page}', i)}" class="px-3 py-2 rounded-lg text-sm font-medium transition ${i === current ? 'bg-purple-600 text-white' : 'bg-gray-700 text-white hover:bg-gray-600'}">${i}</button>`;
    }
    
    if (endPage < total) {
        if (endPage < total - 1) html += `<span class="px-2 text-gray-400">...</span>`;
        html += `<button onclick="${onClick.replace('{page}', total)}" class="px-3 py-2 rounded-lg text-sm font-medium bg-gray-700 text-white hover:bg-gray-600 transition">${total}</button>`;
    }
    
    const nextDisabled = current >= total;
    html += `<button onclick="${nextDisabled ? '' : onClick.replace('{page}', current + 1)}" class="px-3 py-2 rounded-lg text-sm font-medium transition ${nextDisabled ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-700 text-white hover:bg-gray-600'}" ${nextDisabled ? 'disabled' : ''}><i class="fas fa-chevron-right"></i></button>`;
    
    return html;
}

function setupSearchListeners() {
    ['searchInput', 'mobileSearchInput'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    const query = e.target.value.trim();
                    if (query) {
                        window.location.href = `index.html?search=${encodeURIComponent(query)}`;
                    }
                }
            });
        }
    });
}
