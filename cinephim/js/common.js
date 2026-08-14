// CinePhim - Common JavaScript Functions

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
function placeholderImg(w, h, text, bg = '#374151', fg = '#ffffff') {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="${bg}"/><text x="${w/2}" y="${h/2}" font-family="sans-serif" font-size="${Math.min(w,h)/12}" fill="${fg}" text-anchor="middle" dominant-baseline="central">${text.replace(/"/g, '&quot;')}</text></svg>`;
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

function getVerticalImage(imageUrl) {
    return imageUrl || placeholderImg(300, 450, 'No Poster');
}

function getHeroImage(imageUrl) {
    return getVerticalImage(imageUrl);
}

// Initialize Firebase and common functions
document.addEventListener('DOMContentLoaded', async function() {
    await window.ensureConfigReady();
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

// Sync theme icons between desktop and mobile
function syncThemeIcons() {
    const desktopIcon = document.getElementById("themeIcon");
    const mobileIcon = document.getElementById("mobileThemeIcon");
    if (desktopIcon && mobileIcon) {
        mobileIcon.className = desktopIcon.classList.contains("fa-moon")
            ? "fas fa-moon"
            : "fas fa-sun";
    }
}

// Sync login icons between desktop and mobile
function syncLoginIcons() {
    const desktopIcon = document.getElementById("loginIcon");
    const mobileIcon = document.getElementById("mobileLoginIcon");
    const desktopText = document.getElementById("loginText");
    if (desktopIcon && mobileIcon) {
        mobileIcon.className = desktopIcon.className;
        mobileIcon.className = desktopText && desktopText.textContent === "Đăng xuất"
            ? "fas fa-sign-out-alt"
            : "fas fa-sign-in-alt";
    }
}

// Override toggleTheme to sync icons
if (window.toggleTheme) {
    const originalToggleTheme = window.toggleTheme;
    window.toggleTheme = function () {
        originalToggleTheme();
        syncThemeIcons();
    };
}

// Override toggleLogin to sync icons
if (window.toggleLogin) {
    const originalToggleLogin = window.toggleLogin;
    window.toggleLogin = function () {
        originalToggleLogin();
        syncLoginIcons();
    };
}

// Initialize common page UI (bottom nav, search sync, icon sync)
function initPageSync() {
    const mobileSearchInput = document.getElementById("mobileSearchInput");
    const desktopSearchInput = document.getElementById("searchInput");
    if (mobileSearchInput && desktopSearchInput) {
        mobileSearchInput.addEventListener("input", function (e) {
            desktopSearchInput.value = e.target.value;
            const event = new Event("input");
            desktopSearchInput.dispatchEvent(event);
        });
        desktopSearchInput.addEventListener("input", function (e) {
            mobileSearchInput.value = e.target.value;
        });
    }

    highlightBottomNav();

    setTimeout(function () {
        syncThemeIcons();
        syncLoginIcons();
    }, 100);
}

function highlightBottomNav() {
    const navItems = document.querySelectorAll('.bottom-nav-item');
    const path = window.location.pathname.split('/').pop() || 'index.html';
    navItems.forEach(function (item) {
        const href = item.getAttribute('href');
        if (href === path) {
            item.classList.add('active');
        }
    });
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

// Resolve OPhim relative image paths robustly
function resolveOPhimImageUrl(url, pathImageFromApi = '') {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    
    // Default CDN domain
    let cdnDomain = (SOURCES.ophim && SOURCES.ophim.image_cdn) ? SOURCES.ophim.image_cdn : 'https://img.ophim.live';
    
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

    let cdnDomain = (SOURCES.kkphim && SOURCES.kkphim.image_cdn) ? SOURCES.kkphim.image_cdn : 'https://phimimg.com';

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
// Get raw image link based on source config (single image_field decides the API field)
function getRawImageUrl(item, sourceKey = currentSourceKey) {
    if (!item) return '';
    let sourceConfig = SOURCES[sourceKey] || {};
    let fieldName = sourceConfig.image_field || '';
    
    if (fieldName) {
        return item[fieldName] || '';
    }
    
    return item.thumb_url || item.poster_url || '';
}

// Data Normalization Helpers
function normalizeMovieData(item) {
    if (!item) return null;
    
    let rawPoster = getRawImageUrl(item, currentSourceKey);
    let rawThumb = rawPoster;
    
    // Normalize based on source
    if (currentSourceKey === 'ophim') {
        let poster_url = resolveOPhimImageUrl(rawPoster);
        let thumb_url = resolveOPhimImageUrl(rawThumb);
        
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
            country: item.country || [],
            origin_name: item.origin_name || '',
            content: item.content || item.description || '',
            episode_time: item.episode_time || item.time || '',
            season: item.season || item.season_number || '',
            rating: item.rating || item.rating_number || '',
            imdb_rating: item.imdb_rating || item.imdb_score || '',
            type: item.type || ''
        };
    }
    
    if (currentSourceKey === 'kkphim') {
        let poster_url = resolveKKPhimImageUrl(rawPoster);
        let thumb_url = resolveKKPhimImageUrl(rawThumb);

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
            country: item.country || [],
            origin_name: item.origin_name || '',
            content: item.content || item.description || '',
            episode_time: item.episode_time || item.time || '',
            season: item.season || item.season_number || '',
            rating: item.rating || item.rating_number || '',
            imdb_rating: item.imdb_rating || item.imdb_score || '',
            type: item.type || ''
        };
    }
    
    if (currentSourceKey === 'vsmov') {
        return {
            name: item.name || item.title || '',
            slug: item.slug || '',
            poster_url: rawPoster,
            thumb_url: rawThumb,
            quality: item.quality || 'HD',
            current_episode: item.episode_current || item.current_episode || '',
            total_episodes: item.episode_total || item.total_episodes || '',
            year: item.year || '',
            category: item.category || [],
            country: item.country || [],
            origin_name: item.origin_name || '',
            content: item.content || item.description || '',
            episode_time: item.episode_time || item.time || '',
            season: item.season || item.season_number || '',
            rating: item.rating || item.rating_number || '',
            imdb_rating: item.imdb_rating || item.imdb_score || '',
            type: item.type || ''
        };
    }
    
    // NguonC is already in the expected format, but let's ensure consistency
    return {
        name: item.name || item.title || '',
        slug: item.slug || '',
        poster_url: rawPoster,
        thumb_url: rawThumb,
        quality: item.quality || 'HD',
        current_episode: item.current_episode || '',
        total_episodes: item.total_episodes || '',
        year: item.year || item.time || '',
        category: item.category || [],
        country: item.country || [],
        origin_name: item.origin_name || '',
        content: item.content || item.description || '',
        episode_time: item.episode_time || item.time || '',
        season: item.season || item.season_number || '',
        rating: item.rating || item.rating_number || '',
        imdb_rating: item.imdb_rating || item.imdb_score || '',
        type: item.type || ''
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
    
    if (currentSourceKey === 'vsmov') {
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

// Close modal when clicking outside
document.addEventListener('DOMContentLoaded', async function() {
    await window.ensureConfigReady();
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
        showToast('Đã bỏ ghim', 'success');
        
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
        showToast('Đã ghim phim', 'success');
        
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

function showToast(message, type = 'success') {
    Swal.fire({
        toast: true,
        position: 'top-end',
        icon: type,
        title: message,
        showConfirmButton: false,
        timer: 2000,
        timerProgressBar: true,
        background: '#1f2937',
        color: '#fff',
        didOpen: (toast) => {
            toast.addEventListener('mouseenter', Swal.stopTimer);
            toast.addEventListener('mouseleave', Swal.resumeTimer);
        }
    });
}

function showPageLoading(show) {
    const loading = document.getElementById('loading');
    const moviesContainer = document.getElementById('moviesContainer');
    if (loading) loading.classList.toggle('hidden', !show);
    if (moviesContainer) moviesContainer.classList.toggle('hidden', show);
}

function displayMovies(movies) {
    const grid = document.getElementById('moviesGrid');
    if (!grid) return;
    if (!movies || movies.length === 0) {
        showPageNoResults();
        return;
    }
    hidePageNoResults();
    grid.innerHTML = movies.map(movie => getMovieCardHTML(movie)).join('');
}

function _renderPagination(paginationData, onClickTemplate) {
    const container = document.getElementById('pagination');
    if (!container) return;
    if (!paginationData) { container.innerHTML = ''; return; }
    const p = normalizePagination(paginationData) || paginationData;
    const current = p.current_page || 1;
    const total = p.total_page || 1;
    container.innerHTML = getPaginationHTML(current, total, onClickTemplate);
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
                <img src="${getVerticalImage(movie.poster_url)}" 
                     alt="${movie.name || movie.title}" 
                     loading="lazy" decoding="async" class="film-poster w-full"
                     onerror="this.src=placeholderImg(300,450,'No Poster')">
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