// CinePhim - Common JavaScript Functions

// Global variables
var favorites = [];
var pinnedMovies = [];
var watchHistory = [];
window.currentUser = null;
var authListener = null;
var hasResolvedInitialAuth = false;

// Initialize Firebase
window.db = firebase.firestore();
window.auth = firebase.auth();

// Image Helper Functions
function placeholderImg(w, h, text, bg, fg) {
    if (bg === undefined) bg = '#374151';
    if (fg === undefined) fg = '#ffffff';
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '"><rect width="' + w + '" height="' + h + '" fill="' + bg + '"/><text x="' + (w/2) + '" y="' + (h/2) + '" font-family="sans-serif" font-size="' + Math.min(w,h)/12 + '" fill="' + fg + '" text-anchor="middle" dominant-baseline="central">' + text.replace(/"/g, '&quot;') + '</text></svg>';
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

function getVerticalImage(imageUrl) {
    return imageUrl || placeholderImg(300, 450, 'No Poster');
}

function getHeroImage(imageUrl) {
    return getVerticalImage(imageUrl);
}

// Initialize Firebase and common functions
document.addEventListener('DOMContentLoaded', function() {
    window.ensureConfigReady().then(function() {
        // Render source switcher if container exists
        renderSourceSwitcher();

        // Clear any existing auth listener
        if (authListener) {
            authListener();
        }
        
        // Set up auth state listener once
        authListener = auth.onAuthStateChanged(function(user) {
            window.currentUser = user;
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

            if (!hasResolvedInitialAuth) {
                hasResolvedInitialAuth = true;
            }
            document.dispatchEvent(new CustomEvent('cinephim:auth-ready', { detail: { user: window.currentUser } }));
        });
    });
});

// Load favorites from Firebase
function loadFavoritesFromFirebase() {
    if (!window.currentUser) {
        // Fallback to localStorage if not logged in
        favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
        return Promise.resolve();
    }
    
    return db.collection('users').doc(window.currentUser.uid).collection('favorites').orderBy('addedAt', 'desc').get().then(function(snapshot) {
        favorites = [];
        snapshot.forEach(function(doc) {
            favorites.push(doc.data());
        });
    }).catch(function(error) {
        console.error('Error loading favorites:', error);
        // Fallback to localStorage
        favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
    });
}

// Load watch history from Firebase
function loadWatchHistoryFromFirebase() {
    if (!window.currentUser) return Promise.resolve();
    
    // Only load if watchHistory is empty (first time login)
    if (watchHistory.length > 0) {
        return Promise.resolve();
    }
    
    return db.collection('users').doc(window.currentUser.uid).collection('watchHistory').orderBy('watchedAt', 'desc').get().then(function(snapshot) {
        watchHistory = [];
        snapshot.forEach(function(doc) {
            watchHistory.push(doc.data());
        });
    }).catch(function(error) {
        console.error('Error loading watch history:', error);
        watchHistory = [];
    });
}

// Save a single watch history item to Firebase immediately
function saveSingleWatchHistoryItem(historyItem) {
    if (!window.currentUser) return Promise.resolve();

    var historyRef = db.collection('users').doc(window.currentUser.uid).collection('watchHistory');
    return historyRef.where('movieSlug', '==', historyItem.movieSlug).get().then(function(existingSnapshot) {
        if (!existingSnapshot.empty) {
            existingSnapshot.forEach(function(doc) {
                doc.ref.update(historyItem);
            });
        } else {
            return historyRef.add(historyItem);
        }
    }).catch(function(error) {
        console.error('Error saving watch history item:', error);
    });
}

// Toggle login/logout
function toggleLogin() {
    var loginIcon = document.getElementById('loginIcon');
    var loginText = document.getElementById('loginText');
    
    if (window.currentUser) {
        // Logout
        auth.signOut().then(function() {
            window.currentUser = null;
            watchHistory = [];
            if (loginIcon) loginIcon.className = 'fas fa-sign-in-alt mr-1';
            if (loginText) loginText.textContent = '\u0110\u0103ng nh\u1eadp';
            // Reload page after logout
            window.location.reload();
        }).catch(function(error) {
            console.error('Logout error:', error);
        });
    } else {
        // Show login modal
        showLoginModal();
    }
}

// Sync login icons between desktop and mobile
function syncLoginIcons() {
    var desktopIcon = document.getElementById("loginIcon");
    var mobileIcon = document.getElementById("mobileLoginIcon");
    var desktopText = document.getElementById("loginText");
    if (desktopIcon && mobileIcon) {
        mobileIcon.className = desktopIcon.className;
        mobileIcon.className = desktopText && desktopText.textContent === "\u0110\u0103ng xu\u1ea5t"
            ? "fas fa-sign-out-alt"
            : "fas fa-sign-in-alt";
    }
}

// Override toggleLogin to sync icons
if (window.toggleLogin) {
    var originalToggleLogin = window.toggleLogin;
    window.toggleLogin = function () {
        originalToggleLogin();
        syncLoginIcons();
    };
}

// Initialize common page UI (bottom nav, search sync, icon sync)
function initPageSync() {
    var mobileSearchInput = document.getElementById("mobileSearchInput");
    var desktopSearchInput = document.getElementById("searchInput");
    if (mobileSearchInput && desktopSearchInput) {
        mobileSearchInput.addEventListener("input", function (e) {
            desktopSearchInput.value = e.target.value;
            var event = new Event("input");
            desktopSearchInput.dispatchEvent(event);
        });
        desktopSearchInput.addEventListener("input", function (e) {
            mobileSearchInput.value = e.target.value;
        });
    }

    highlightBottomNav();

    setTimeout(function () {
        syncLoginIcons();
    }, 100);
}

function highlightBottomNav() {
    var navItems = document.querySelectorAll('.bottom-nav-item');
    var path = window.location.pathname.split('/').pop() || 'index.html';
    navItems.forEach(function (item) {
        var href = item.getAttribute('href');
        if (href === path) {
            item.classList.add('active');
        }
    });
}

// Show login modal
function showLoginModal() {
    var modal = document.getElementById('loginModal');
    if (modal) {
        modal.classList.remove('hidden');
    }
    var registerModal = document.getElementById('registerModal');
    if (registerModal) {
        registerModal.classList.add('hidden');
    }
}

// Close login modal
function closeLoginModal() {
    var modal = document.getElementById('loginModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// Show register modal
function showRegisterModal() {
    var modal = document.getElementById('registerModal');
    if (modal) {
        modal.classList.remove('hidden');
    }
    var loginModal = document.getElementById('loginModal');
    if (loginModal) {
        loginModal.classList.add('hidden');
    }
}

// Close register modal
function closeRegisterModal() {
    var modal = document.getElementById('registerModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// Handle login
function handleLogin(event) {
    event.preventDefault();
    
    var email = document.getElementById('loginEmail').value;
    var password = document.getElementById('loginPassword').value;
    
    auth.signInWithEmailAndPassword(email, password).then(function(userCredential) {
        window.currentUser = userCredential.user;
        
        // Update UI
        updateLoginButton();
        closeLoginModal();
        
        Swal.fire({
            icon: 'success',
            title: 'Th\u00e0nh c\u00f4ng!',
            text: '\u0110\u0103ng nh\u1eadp th\u00e0nh c\u00f4ng!',
            confirmButtonColor: '#8b5cf6',
            timer: 2000,
            showConfirmButton: false
        }).then(function() {
            // Reload page after successful login
            window.location.reload();
        });
        
    }).catch(function(error) {
        console.error('Login error:', error);
        var errorMessage = '\u0110\u0103ng nh\u1eadp th\u1ea5t b\u1ea1i. Vui l\u00f2ng th\u1eed l\u1ea1i.';
        
        switch (error.code) {
            case 'auth/user-not-found':
                errorMessage = 'Email kh\u00f4ng t\u1ed3n t\u1ea1i.';
                break;
            case 'auth/wrong-password':
                errorMessage = 'M\u1eadt kh\u1ea9u kh\u00f4ng \u0111\u00fang.';
                break;
            case 'auth/invalid-email':
                errorMessage = 'Email kh\u00f4ng h\u1ee3p l\u1ec7.';
                break;
            case 'auth/user-disabled':
                errorMessage = 'T\u00e0i kho\u1ea3n \u0111\u00e3 b\u1ecb v\u00f4 hi\u1ec7u h\u00f3a.';
                break;
            case 'auth/too-many-requests':
                errorMessage = 'Qu\u00e1 nhi\u1ec1u y\u00eau c\u1ea7u. Vui l\u00f2ng th\u1eed l\u1ea1i sau.';
                break;
        }
        
        Swal.fire({
            icon: 'error',
            title: 'L\u1ed7i',
            text: errorMessage,
            confirmButtonColor: '#8b5cf6'
        });
    });
}

// Handle register
function handleRegister(event) {
    event.preventDefault();
    
    var email = document.getElementById('registerEmail').value;
    var password = document.getElementById('registerPassword').value;
    var confirmPassword = document.getElementById('registerConfirmPassword').value;
    
    // Validate passwords match
    if (password !== confirmPassword) {
        Swal.fire({
            icon: 'error',
            title: 'L\u1ed7i',
            text: 'M\u1eadt kh\u1ea9u x\u00e1c nh\u1eadn kh\u00f4ng kh\u1edbp.',
            confirmButtonColor: '#8b5cf6'
        });
        return;
    }
    
    // Validate password length
    if (password.length < 6) {
        Swal.fire({
            icon: 'error',
            title: 'L\u1ed7i',
            text: 'M\u1eadt kh\u1ea9u ph\u1ea3i c\u00f3 \u00edt nh\u1ea5t 6 k\u00fd t\u1ef1.',
            confirmButtonColor: '#8b5cf6'
        });
        return;
    }
    
    auth.createUserWithEmailAndPassword(email, password).then(function(userCredential) {
        window.currentUser = userCredential.user;
        
        // Update UI
        updateLoginButton();
        closeRegisterModal();
        
        Swal.fire({
            icon: 'success',
            title: 'Th\u00e0nh c\u00f4ng!',
            text: '\u0110\u0103ng k\u00fd th\u00e0nh c\u00f4ng!',
            confirmButtonColor: '#8b5cf6',
            timer: 2000,
            showConfirmButton: false
        }).then(function() {
            // Reload page after successful registration
            window.location.reload();
        });
        
    }).catch(function(error) {
        console.error('Register error:', error);
        var errorMessage = '\u0110\u0103ng k\u00fd th\u1ea5t b\u1ea1i. Vui l\u00f2ng th\u1eed l\u1ea1i.';
        
        switch (error.code) {
            case 'auth/email-already-in-use':
                errorMessage = 'Email \u0111\u00e3 \u0111\u01b0\u1ee3c s\u1eed d\u1ee5ng.';
                break;
            case 'auth/invalid-email':
                errorMessage = 'Email kh\u00f4ng h\u1ee3p l\u1ec7.';
                break;
            case 'auth/weak-password':
                errorMessage = 'M\u1eadt kh\u1ea9u qu\u00e1 y\u1ebfu. Vui l\u00f2ng ch\u1ecdn m\u1eadt kh\u1ea9u m\u1ea1nh h\u01a1n.';
                break;
            case 'auth/too-many-requests':
                errorMessage = 'Qu\u00e1 nhi\u1ec1u y\u00eau c\u1ea7u. Vui l\u00f2ng th\u1eed l\u1ea1i sau.';
                break;
        }
        
        Swal.fire({
            icon: 'error',
            title: 'L\u1ed7i',
            text: errorMessage,
            confirmButtonColor: '#8b5cf6'
        });
    });
}

// Toggle mobile user dropdown menu
function toggleMobileUserDropdown() {
    var dropdown = document.getElementById('mobileUserDropdown');
    if (dropdown) {
        dropdown.classList.toggle('hidden');
    }
}

// Close mobile user dropdown when clicking outside
document.addEventListener('click', function(event) {
    var mobileUserProfileMenu = document.getElementById('mobileUserProfileMenu');
    var mobileUserDropdown = document.getElementById('mobileUserDropdown');
    
    if (mobileUserProfileMenu && mobileUserDropdown && !mobileUserDropdown.classList.contains('hidden')) {
        if (!mobileUserProfileMenu.contains(event.target)) {
            mobileUserDropdown.classList.add('hidden');
        }
    }
});

// Toggle user dropdown menu
function toggleUserDropdown() {
    var dropdown = document.getElementById('userDropdown');
    if (dropdown) {
        dropdown.classList.toggle('hidden');
    }
}

// Close user dropdown when clicking outside
document.addEventListener('click', function(event) {
    var userProfileMenu = document.getElementById('userProfileMenu');
    var userDropdown = document.getElementById('userDropdown');
    
    if (userProfileMenu && userDropdown && !userDropdown.classList.contains('hidden')) {
        if (!userProfileMenu.contains(event.target)) {
            userDropdown.classList.add('hidden');
        }
    }
});

// Handle logout from dropdown
function handleLogout() {
    auth.signOut().then(function() {
        window.currentUser = null;
        watchHistory = [];
        
        // Close desktop dropdown
        var dropdown = document.getElementById('userDropdown');
        if (dropdown) {
            dropdown.classList.add('hidden');
        }
        
        // Close mobile dropdown
        var mobileDropdown = document.getElementById('mobileUserDropdown');
        if (mobileDropdown) {
            mobileDropdown.classList.add('hidden');
        }
        
        // Update UI
        updateLoginButton();
        
        Swal.fire({
            icon: 'success',
            title: '\u0110\u00e3 \u0111\u0103ng xu\u1ea5t!',
            text: 'B\u1ea1n \u0111\u00e3 \u0111\u0103ng xu\u1ea5t th\u00e0nh c\u00f4ng.',
            confirmButtonColor: '#8b5cf6',
            timer: 2000,
            showConfirmButton: false
        }).then(function() {
            // Reload page after successful logout
            window.location.reload();
        });
    }).catch(function(error) {
        console.error('Logout error:', error);
        Swal.fire({
            icon: 'error',
            title: 'L\u1ed7i',
            text: 'Kh\u00f4ng th\u1ec3 \u0111\u0103ng xu\u1ea5t. Vui l\u00f2ng th\u1eed l\u1ea1i.',
            confirmButtonColor: '#8b5cf6'
        });
    });
}

// Show account modal (placeholder function)
function showAccountModal() {
    // Close desktop dropdown first
    var dropdown = document.getElementById('userDropdown');
    if (dropdown) {
        dropdown.classList.add('hidden');
    }
    
    // Close mobile dropdown
    var mobileDropdown = document.getElementById('mobileUserDropdown');
    if (mobileDropdown) {
        mobileDropdown.classList.add('hidden');
    }
    
    Swal.fire({
        icon: 'info',
        title: 'T\u00e0i kho\u1ea3n',
        text: 'Ch\u1ee9c n\u0103ng qu\u1ea3n l\u00fd t\u00e0i kho\u1ea3n s\u1ebd s\u1edbp \u0111\u01b0\u1ee3c c\u1eadp nh\u1eadt!',
        confirmButtonColor: '#8b5cf6'
    });
}

// Update login button based on auth state
function updateLoginButton() {
    // Desktop elements
    var userProfileMenu = document.getElementById('userProfileMenu');
    var loginButton = document.getElementById('loginButton');
    var userEmail = document.getElementById('userEmail');
    var userAvatar = document.getElementById('userAvatar');
    
    // Mobile elements
    var mobileUserProfileMenu = document.getElementById('mobileUserProfileMenu');
    var mobileLoginButton = document.getElementById('mobileLoginButton');
    var mobileUserEmail = document.getElementById('mobileUserEmail');
    var mobileUserAvatar = document.getElementById('mobileUserAvatar');
    
    if (window.currentUser) {
        // Show user profile menu, hide login button for desktop
        if (userProfileMenu) {
            userProfileMenu.classList.remove('hidden');
            
            // Update user email
            if (userEmail) {
                userEmail.textContent = window.currentUser.email || 'user@example.com';
            }
            
            // Generate user avatar with first letter of email
            if (userAvatar) {
                var firstLetter = window.currentUser.email ? window.currentUser.email.charAt(0).toUpperCase() : 'U';
                userAvatar.src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(firstLetter) + '&background=6366f1&color=ffffff&size=32';
                userAvatar.alt = window.currentUser.email || 'User Avatar';
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
                mobileUserEmail.textContent = window.currentUser.email || 'user@example.com';
            }
            
            // Generate mobile user avatar
            if (mobileUserAvatar) {
                var mobileFirstLetter = window.currentUser.email ? window.currentUser.email.charAt(0).toUpperCase() : 'U';
                mobileUserAvatar.src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(mobileFirstLetter) + '&background=6366f1&color=ffffff&size=28';
                mobileUserAvatar.alt = window.currentUser.email || 'User Avatar';
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
            var loginIcon = document.getElementById('loginIcon');
            var loginText = document.getElementById('loginText');
            
            if (loginIcon) loginIcon.className = 'fas fa-sign-in-alt mr-1';
            if (loginText) loginText.textContent = '\u0110\u0103ng nh\u1eadp';
        }
        
        // Show login button, hide user profile menu for mobile
        if (mobileUserProfileMenu) {
            mobileUserProfileMenu.classList.add('hidden');
        }
        
        if (mobileLoginButton) {
            mobileLoginButton.classList.remove('hidden');
            
            // Update mobile login icon
            var mobileLoginIcon = document.getElementById('mobileLoginIcon');
            if (mobileLoginIcon) {
                mobileLoginIcon.className = 'fas fa-sign-in-alt';
            }
        }
    }
    
    // Toggle user-specific sections on homepage
    var recentWatchedSection = document.getElementById('recentWatchedSection');
    var pinnedMoviesSection = document.getElementById('pinnedMoviesSection');
    
    if (window.currentUser) {
        if (recentWatchedSection) recentWatchedSection.classList.remove('hidden');
        if (pinnedMoviesSection) pinnedMoviesSection.classList.remove('hidden');
    } else {
        if (recentWatchedSection) recentWatchedSection.classList.add('hidden');
        if (pinnedMoviesSection) pinnedMoviesSection.classList.add('hidden');
    }
}

// Show movie detail - redirect to detail page
function showMovieDetail(slug, savedSource) {
    if (savedSource && savedSource !== currentSourceKey && SOURCES[savedSource]) {
        var savedName = (SOURCES[savedSource] && SOURCES[savedSource].name) || savedSource;
        Swal.fire({
            title: 'C\u1ea7n chuy\u1ec3n ngu\u1ed3n',
            html: 'Phim n\u00e0y thu\u1ed9c ngu\u1ed3n <strong>' + savedName + '</strong>.<br>B\u1ea1n c\u1ea7n chuy\u1ec3n sang ngu\u1ed3n n\u00e0y \u0111\u1ec3 xem phim.',
            icon: 'warning',
            confirmButtonText: 'Chuy\u1ec3n ngu\u1ed3n',
            showCancelButton: true,
            cancelButtonText: 'H\u1ee7y',
            confirmButtonColor: '#8b5cf6',
            cancelButtonColor: '#6b7280'
        }).then(function(result) {
            if (result.isConfirmed) {
                localStorage.setItem('movieSource', savedSource);
                window.location.href = 'movie-detail.html?slug=' + encodeURIComponent(slug);
            }
        });
        return;
    }
    window.location.href = 'movie-detail.html?slug=' + encodeURIComponent(slug);
}

// Resolve OPhim relative image paths robustly
function resolveOPhimImageUrl(url, pathImageFromApi) {
    if (pathImageFromApi === undefined) pathImageFromApi = '';
    if (!url) return '';
    if (url.indexOf('http') === 0) return url;
    
    // Default CDN domain
    var cdnDomain = (SOURCES.ophim && SOURCES.ophim.image_cdn) ? SOURCES.ophim.image_cdn : 'https://img.ophim.live';
    
    // Try to extract cdn domain from pathImageFromApi if it is valid
    if (pathImageFromApi && typeof pathImageFromApi === 'string' && pathImageFromApi.indexOf('http') === 0) {
        // Remove trailing slash if present
        cdnDomain = pathImageFromApi.replace(/\/$/, '');
    }
    
    // Check if url already contains /uploads/movies/ or uploads/movies/
    if (url.indexOf('/uploads/movies/') === 0) {
        return cdnDomain + url;
    } else if (url.indexOf('uploads/movies/') === 0) {
        return cdnDomain + '/' + url;
    } else {
        // If it's just a filename, prepend cdnDomain + /uploads/movies/
        return cdnDomain + '/uploads/movies/' + url;
    }
}

// Resolve KKPhim relative image paths
function resolveKKPhimImageUrl(url, pathImageFromApi) {
    if (pathImageFromApi === undefined) pathImageFromApi = '';
    if (!url) return '';
    if (url.indexOf('http') === 0) return url;

    var cdnDomain = (SOURCES.kkphim && SOURCES.kkphim.image_cdn) ? SOURCES.kkphim.image_cdn : 'https://phimimg.com';

    if (pathImageFromApi && typeof pathImageFromApi === 'string' && pathImageFromApi.indexOf('http') === 0) {
        cdnDomain = pathImageFromApi.replace(/\/$/, '');
    }

    if (url.indexOf('/') === 0) {
        return cdnDomain + url;
    }
    return cdnDomain + '/' + url;
}

function stripHtml(str) {
    if (!str) return '';
    return str.replace(/<[^>]*>/g, '');
}
// Get raw image link based on source config (single image_field decides the API field)
function getRawImageUrl(item, sourceKey) {
    if (sourceKey === undefined) sourceKey = currentSourceKey;
    if (!item) return '';
    var sourceConfig = SOURCES[sourceKey] || {};
    var fieldName = sourceConfig.image_field || '';
    
    if (fieldName) {
        return item[fieldName] || '';
    }
    
    return item.thumb_url || item.poster_url || '';
}

// Data Normalization Helpers
function normalizeMovieData(item) {
    if (!item) return null;
    
    var rawPoster = getRawImageUrl(item, currentSourceKey);
    var rawThumb = rawPoster;
    
    // Normalize based on source
    if (currentSourceKey === 'ophim') {
        var ophimPosterUrl = resolveOPhimImageUrl(rawPoster);
        var ophimThumbUrl = resolveOPhimImageUrl(rawThumb);
        
        return {
            name: item.name || item.title || '',
            slug: item.slug || '',
            poster_url: ophimPosterUrl,
            thumb_url: ophimThumbUrl,
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
        var kkphimPosterUrl = resolveKKPhimImageUrl(rawPoster);
        var kkphimThumbUrl = resolveKKPhimImageUrl(rawThumb);

        return {
            name: item.name || item.title || '',
            slug: item.slug || '',
            poster_url: kkphimPosterUrl,
            thumb_url: kkphimThumbUrl,
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
        var ophimData = data.data && data.data.params && data.data.params.pagination;
        var ophimDataAlt = data.params && data.params.pagination;
        var p = ophimData || ophimDataAlt;
        if (!p) return null;
        return {
            current_page: p.currentPage,
            total_page: p.totalPages || Math.ceil(p.totalItems / p.totalItemsPerPage) || 1,
            total_items: p.totalItems,
            per_page: p.totalItemsPerPage
        };
    }
    
    if (currentSourceKey === 'kkphim') {
        var kkData = data.pagination;
        var kkDataAlt = data.data && data.data.params && data.data.params.pagination;
        var kkDataAlt2 = data.params && data.params.pagination;
        var pk = kkData || kkDataAlt || kkDataAlt2;
        if (!pk) return null;
        return {
            current_page: pk.currentPage,
            total_page: pk.totalPages || Math.ceil(pk.totalItems / pk.totalItemsPerPage) || 1,
            total_items: pk.totalItems,
            per_page: pk.totalItemsPerPage
        };
    }
    
    if (currentSourceKey === 'vsmov') {
        var vsData = data.pagination;
        var vsDataAlt = data.data && data.data.params && data.data.params.pagination;
        var vsDataAlt2 = data.params && data.params.pagination;
        var pv = vsData || vsDataAlt || vsDataAlt2;
        if (!pv) return null;
        return {
            current_page: pv.currentPage,
            total_page: pv.totalPages || Math.ceil(pv.totalItems / pv.totalItemsPerPage) || 1,
            total_items: pv.totalItems,
            per_page: pv.totalItemsPerPage
        };
    }
    
    return data.paginate || null;
}

// Render source switcher UI
function renderSourceSwitcher() {
    var desktopContainer = document.getElementById('sourceSwitcherDesktop');
    var mobileContainer = document.getElementById('sourceSwitcherMobile');

    var currentName = (currentSource && currentSource.name) || 'NguonC';
    var sourceKeys = Object.keys(SOURCES);
    var optionsParts = [];
    for (var i = 0; i < sourceKeys.length; i++) {
        var key = sourceKeys[i];
        var isActive = currentSourceKey === key;
        optionsParts.push(
            '<button onclick="setSource(\'' + key + '\')"' +
            ' class="flex items-center w-full px-4 py-2 text-sm transition ' + (isActive ? 'bg-purple-600 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white') + '">' +
            '<span class="flex-1 text-left" style="display:inline">' + SOURCES[key].name + '</span>' +
            (isActive ? '<i class="fas fa-check text-purple-200"></i>' : '') +
            '</button>'
        );
    }
    var optionsHtml = optionsParts.join('');

    var desktopHtml =
        '<div class="relative source-switcher">' +
            '<button onclick="toggleSourceDropdown(this)"' +
            ' class="flex items-center bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition border border-gray-600 hover:border-purple-500 px-3 py-1.5">' +
                '<i class="fas fa-exchange-alt text-purple-400 text-xs mr-1.5"></i>' +
                '<span class="text-white font-medium">' + currentName + '</span>' +
                '<i class="fas fa-chevron-down text-gray-500 text-xs ml-1 transition-transform duration-200 source-dropdown-arrow"></i>' +
            '</button>' +
            '<div class="absolute right-0 mt-2 w-44 bg-gray-800 rounded-lg shadow-xl border border-gray-700 hidden z-50 overflow-hidden source-dropdown-menu">' +
                optionsHtml +
            '</div>' +
        '</div>';

    var mobileHtml =
        '<div class="relative source-switcher">' +
            '<button onclick="toggleSourceDropdown(this)"' +
            ' class="flex items-center bg-gray-700 hover:bg-gray-600 rounded-lg text-xs transition border border-gray-600 px-2 py-1">' +
                '<span class="text-white font-semibold" style="display:inline">' + currentName + '</span>' +
                '<i class="fas fa-chevron-down text-gray-500 ml-1 transition-transform duration-200 source-dropdown-arrow" style="font-size:9px"></i>' +
            '</button>' +
            '<div class="absolute right-0 mt-1 w-40 bg-gray-800 rounded-lg shadow-xl border border-gray-700 hidden z-50 overflow-hidden source-dropdown-menu">' +
                optionsHtml +
            '</div>' +
        '</div>';

    if (desktopContainer) desktopContainer.innerHTML = desktopHtml;
    if (mobileContainer) mobileContainer.innerHTML = mobileHtml;
}

// Toggle source dropdown
function toggleSourceDropdown(btn) {
    var switcher = btn.closest('.source-switcher');
    if (!switcher) return;
    var dropdown = switcher.querySelector('.source-dropdown-menu');
    var arrow = switcher.querySelector('.source-dropdown-arrow');
    if (dropdown) {
        var isHidden = dropdown.classList.contains('hidden');
        // Close all other dropdowns first
        var allDropdowns = document.querySelectorAll('.source-dropdown-menu');
        allDropdowns.forEach(function(m) {
            if (m !== dropdown) m.classList.add('hidden');
        });
        var allArrows = document.querySelectorAll('.source-dropdown-arrow');
        allArrows.forEach(function(a) {
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
    var allSwitchers = document.querySelectorAll('.source-switcher');
    allSwitchers.forEach(function(switcher) {
        var dropdown = switcher.querySelector('.source-dropdown-menu');
        var arrow = switcher.querySelector('.source-dropdown-arrow');
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
    var now = new Date();
    var watched = new Date(watchedAt);
    var diffMs = now - watched;
    var diffMins = Math.floor(diffMs / 60000);
    var diffHours = Math.floor(diffMs / 3600000);
    var diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'V\u1eeba xong';
    if (diffMins < 60) return diffMins + ' ph\u00fat';
    if (diffHours < 24) return diffHours + ' gi\u1edd';
    if (diffDays < 7) return diffDays + ' ng\u00e0y';
    return formatDate(watchedAt);
}

// Format date
function formatDate(dateString) {
    if (!dateString) return 'Kh\u00f4ng r\u00f5';
    
    var date = new Date(dateString);
    
    // Check if date is invalid
    if (isNaN(date.getTime())) {
        return 'Kh\u00f4ng r\u00f5';
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

    if (currentEpisode.toLowerCase().indexOf('full') !== -1 ||
        currentEpisode.toLowerCase().indexOf('ho\u00e0n t\u1ea5t') !== -1 ||
        currentEpisode.toLowerCase().indexOf('completed') !== -1) {
        return currentEpisode;
    }

    var currentMatch = currentEpisode.match(/(\d+)/);
    var currentNum = currentMatch ? parseInt(currentMatch[1]) : 0;

    var totalNum = 0;
    if (totalEpisodes) {
        var totalMatch = totalEpisodes.toString().match(/(\d+)/);
        totalNum = totalMatch ? parseInt(totalMatch[1]) : 0;
    }

    if (currentNum > 0 && totalNum > 0) {
        return currentNum + '/' + totalNum;
    }

    if (currentNum > 0) {
        return 'T\u1eadp ' + currentNum;
    }

    return currentEpisode;
}

// Helper function to extract country from category
function getCountryFromCategory(category) {
    if (!category) return '';
    
    // Check if category has country group (id: 4)
    for (var key in category) {
        if (category[key].group && category[key].group.id === '67c6a1e7ce56d3d6fa748ab6d9af3fd7') {
            var countryList = category[key].list;
            if (countryList && countryList.length > 0) {
                return countryList[0].name;
            }
        }
    }
    return '';
}

function showLoading() {
    var loading = document.getElementById('loading');
    if (loading) {
        loading.classList.remove('hidden');
    }
}

function hideLoading() {
    var loading = document.getElementById('loading');
    if (loading) {
        loading.classList.add('hidden');
    }
}

// Load pinned movies from Firebase
function loadPinnedMoviesFromFirebase() {
    if (!window.currentUser) {
        // Fallback to localStorage if not logged in
        pinnedMovies = JSON.parse(localStorage.getItem('pinnedMovies') || '[]');
        return Promise.resolve();
    }
    
    return db.collection('users').doc(window.currentUser.uid).collection('pinnedMovies').orderBy('pinnedAt', 'desc').get().then(function(snapshot) {
        pinnedMovies = [];
        snapshot.forEach(function(doc) {
            pinnedMovies.push(doc.data());
        });
    }).catch(function(error) {
        console.error('Error loading pinned movies:', error);
        // Fallback to localStorage
        pinnedMovies = JSON.parse(localStorage.getItem('pinnedMovies') || '[]');
    });
}

// Save pinned movies to Firebase
function savePinnedMoviesToFirebase() {
    if (!window.currentUser) return Promise.resolve();
    
    var userRef = db.collection('users').doc(window.currentUser.uid);
    var pinnedRef = userRef.collection('pinnedMovies');
    
    // Clear existing pinned movies
    return pinnedRef.get().then(function(existingDocs) {
        var batch = db.batch();
        
        existingDocs.forEach(function(doc) {
            batch.delete(doc.ref);
        });
        
        // Add new pinned movies
        pinnedMovies.forEach(function(item) {
            var docRef = pinnedRef.doc();
            // Clean data before saving
            var cleanItem = {
                slug: item.slug || '',
                title: item.title || '',
                name: item.name || '',
                poster_url: item.poster_url || '',
                thumb_url: item.thumb_url || '',
                source: item.source || '',
                pinnedAt: item.pinnedAt || new Date().toISOString()
            };
            batch.set(docRef, cleanItem);
        });
        
        return batch.commit();
    }).catch(function(error) {
        console.error('Error saving pinned movies:', error);
    });
}

// Toggle pin movie
function togglePin(slug, movieData) {
    if (movieData === undefined) movieData = null;
    var index = -1;
    for (var i = 0; i < pinnedMovies.length; i++) {
        if (pinnedMovies[i].slug === slug) {
            index = i;
            break;
        }
    }
    
    if (index > -1) {
        // Remove from pinned movies
        pinnedMovies.splice(index, 1);
        
        // Show notification
        showToast('\u0110\u00e3 b\u1ecf ghim', 'success');
        
        // Update pin button if it exists
        if (typeof updatePinButton === 'function') { updatePinButton(slug, false); }
    } else {
        // Add to pinned movies
        var movieInfo = movieData || {
            slug: slug,
            title: slug,
            name: slug,
            poster_url: '',
            thumb_url: '',
            year: ''
        };
        
        var newMovieData = {
            slug: movieInfo.slug,
            title: movieInfo.name || movieInfo.title || slug,
            name: movieInfo.name || movieInfo.title || slug,
            poster_url: movieInfo.poster_url || '',
            thumb_url: movieInfo.thumb_url || '',
            year: movieInfo.year || '',
            source: currentSourceKey || movieInfo.source || '',
            pinnedAt: new Date().toISOString()
        };
        pinnedMovies.unshift(newMovieData);
        
        // Show notification
        showToast('\u0110\u00e3 ghim phim', 'success');
        
        // Update pin button if it exists
        if (typeof updatePinButton === 'function') { updatePinButton(slug, true); }
    }
    
    // Save to Firebase if logged in, otherwise localStorage
    if (window.currentUser) {
        return savePinnedMoviesToFirebase();
    } else {
        localStorage.setItem('pinnedMovies', JSON.stringify(pinnedMovies));
        return Promise.resolve();
    }
}

function showError(message) {
    Swal.fire({
        icon: 'error',
        title: 'L\u1ed7i',
        text: message,
        confirmButtonColor: '#8b5cf6'
    });
}

function showWarning(message) {
    Swal.fire({
        icon: 'warning',
        title: 'C\u1ea3nh b\u00e1o',
        text: message,
        confirmButtonColor: '#8b5cf6'
    });
}

function showInfo(message) {
    Swal.fire({
        icon: 'info',
        title: 'Th\u00f4ng b\u00e1o',
        text: message,
        confirmButtonColor: '#8b5cf6',
        timer: 2000,
        showConfirmButton: false
    });
}

function showToast(message, type) {
    if (type === undefined) type = 'success';
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
        didOpen: function(toast) {
            toast.addEventListener('mouseenter', Swal.stopTimer);
            toast.addEventListener('mouseleave', Swal.resumeTimer);
        }
    });
}

function showPageLoading(show) {
    var loading = document.getElementById('loading');
    var moviesContainer = document.getElementById('moviesContainer');
    if (loading) loading.classList.toggle('hidden', !show);
    if (moviesContainer) moviesContainer.classList.toggle('hidden', show);
}

function displayMovies(movies) {
    var grid = document.getElementById('moviesGrid');
    if (!grid) return;
    if (!movies || movies.length === 0) {
        showPageNoResults();
        return;
    }
    hidePageNoResults();
    var movieCards = movies.map(function(movie) { return getMovieCardHTML(movie); });
    grid.innerHTML = movieCards.join('');
}

function _renderPagination(paginationData, onClickTemplate) {
    var container = document.getElementById('pagination');
    if (!container) return;
    if (!paginationData) { container.innerHTML = ''; return; }
    var p = normalizePagination(paginationData) || paginationData;
    var current = p.current_page || 1;
    var total = p.total_page || 1;
    container.innerHTML = getPaginationHTML(current, total, onClickTemplate);
}

function showPageNoResults() {
    var noResults = document.getElementById('noResults');
    var moviesContainer = document.getElementById('moviesContainer');
    if (noResults) noResults.classList.remove('hidden');
    if (moviesContainer) moviesContainer.classList.add('hidden');
}

function hidePageNoResults() {
    var noResults = document.getElementById('noResults');
    var moviesContainer = document.getElementById('moviesContainer');
    if (noResults) noResults.classList.add('hidden');
    if (moviesContainer) moviesContainer.classList.remove('hidden');
}

// Handle clicks on movie card links: let the browser open href in a new tab
// (middle-click / Ctrl+click / right-click), keep showMovieDetail flow on normal left click.
function handleMovieCardClick(event, slug, savedSource) {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    showMovieDetail(slug, savedSource);
}

function getMovieCardHTML(movie) {
    var episodeInfo = '';
    if (movie.current_episode || movie.year) {
        episodeInfo = '<div class="absolute bottom-2 left-2 bg-black bg-opacity-75 px-2 py-1 rounded text-xs">' +
            (movie.current_episode ? formatEpisodeInfo(movie.current_episode, movie.total_episodes) : movie.year) +
            '</div>';
    }

    return '<a href="movie-detail.html?slug=' + encodeURIComponent(movie.slug) + '" class="film-card bg-gray-800 rounded-lg overflow-hidden cursor-pointer" onclick="handleMovieCardClick(event, \'' + movie.slug + '\')">' +
        '<div class="relative">' +
            '<img src="' + getVerticalImage(movie.poster_url) + '"' +
            ' alt="' + (movie.name || movie.title) + '"' +
            ' loading="lazy" decoding="async" class="film-poster w-full"' +
            ' onerror="this.src=placeholderImg(300,450,\'No Poster\')">' +
            '<div class="absolute top-2 right-2 bg-purple-600 px-2 py-1 rounded text-xs font-semibold">' +
                (movie.quality || 'HD') +
            '</div>' +
            episodeInfo +
        '</div>' +
        '<div class="p-4">' +
            '<h3 class="font-semibold text-sm mb-2 line-clamp-2">' + (movie.name || movie.title) + '</h3>' +
            '<p class="text-gray-400 text-xs mb-2">' + (movie.year || movie.time || '') + '</p>' +
            '<div class="flex items-center justify-between">' +
                '<span class="text-xs text-gray-500">' + (getCountryFromCategory(movie.category) || '') + '</span>' +
            '</div>' +
        '</div>' +
    '</a>';
}

function getPaginationHTML(current, total, onClick, maxVisible) {
    if (maxVisible === undefined) maxVisible = 5;
    if (total <= 1) return '';
    var html = '';
    
    var prevDisabled = current <= 1;
    html += '<button onclick="' + (prevDisabled ? '' : onClick.replace('{page}', current - 1)) + '" class="px-3 py-2 rounded-lg text-sm font-medium transition ' + (prevDisabled ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-700 text-white hover:bg-gray-600') + '"' + (prevDisabled ? ' disabled' : '') + '><i class="fas fa-chevron-left"></i></button>';
    
    var startPage = Math.max(1, current - Math.floor(maxVisible / 2));
    var endPage = Math.min(total, startPage + maxVisible - 1);
    if (endPage - startPage < maxVisible - 1) {
        startPage = Math.max(1, endPage - maxVisible + 1);
    }
    
    if (startPage > 1) {
        html += '<button onclick="' + onClick.replace('{page}', 1) + '" class="px-3 py-2 rounded-lg text-sm font-medium bg-gray-700 text-white hover:bg-gray-600 transition">1</button>';
        if (startPage > 2) html += '<span class="px-2 text-gray-400">...</span>';
    }
    
    for (var i = startPage; i <= endPage; i++) {
        html += '<button onclick="' + onClick.replace('{page}', i) + '" class="px-3 py-2 rounded-lg text-sm font-medium transition ' + (i === current ? 'bg-purple-600 text-white' : 'bg-gray-700 text-white hover:bg-gray-600') + '">' + i + '</button>';
    }
    
    if (endPage < total) {
        if (endPage < total - 1) html += '<span class="px-2 text-gray-400">...</span>';
        html += '<button onclick="' + onClick.replace('{page}', total) + '" class="px-3 py-2 rounded-lg text-sm font-medium bg-gray-700 text-white hover:bg-gray-600 transition">' + total + '</button>';
    }
    
    var nextDisabled = current >= total;
    html += '<button onclick="' + (nextDisabled ? '' : onClick.replace('{page}', current + 1)) + '" class="px-3 py-2 rounded-lg text-sm font-medium transition ' + (nextDisabled ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-700 text-white hover:bg-gray-600') + '"' + (nextDisabled ? ' disabled' : '') + '><i class="fas fa-chevron-right"></i></button>';
    
    return html;
}

function setupSearchListeners() {
    var searchIds = ['searchInput', 'mobileSearchInput'];
    searchIds.forEach(function(id) {
        var el = document.getElementById(id);
        if (el) {
            el.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    var query = e.target.value.trim();
                    if (query) {
                        window.location.href = 'index.html?search=' + encodeURIComponent(query);
                    }
                }
            });
        }
    });
}

window.renderSourceSwitcher = renderSourceSwitcher;
window.toggleSourceDropdown = toggleSourceDropdown;
window.toggleLogin = toggleLogin;
window.showLoginModal = showLoginModal;
window.closeLoginModal = closeLoginModal;
window.showRegisterModal = showRegisterModal;
window.closeRegisterModal = closeRegisterModal;
window.handleLogin = handleLogin;
window.handleRegister = handleRegister;
window.handleLogout = handleLogout;
window.showAccountModal = showAccountModal;
window.toggleUserDropdown = toggleUserDropdown;
window.toggleMobileUserDropdown = toggleMobileUserDropdown;
window.updateLoginButton = updateLoginButton;
window.showMovieDetail = showMovieDetail;
window.handleMovieCardClick = handleMovieCardClick;
window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.showError = showError;
window.showWarning = showWarning;
window.showInfo = showInfo;
window.showToast = showToast;
window.showPageLoading = showPageLoading;
window.displayMovies = displayMovies;
window.showPageNoResults = showPageNoResults;
window.hidePageNoResults = hidePageNoResults;
window._renderPagination = _renderPagination;
window.getPaginationHTML = getPaginationHTML;
window.setupSearchListeners = setupSearchListeners;
window.initPageSync = initPageSync;
window.placeholderImg = placeholderImg;
window.getVerticalImage = getVerticalImage;
window.getHeroImage = getHeroImage;
window.getCountryFromCategory = getCountryFromCategory;
window.formatWatchTime = formatWatchTime;
window.formatDate = formatDate;
window.formatEpisodeInfo = formatEpisodeInfo;
window.stripHtml = stripHtml;
window.normalizeMovieData = normalizeMovieData;
window.normalizePagination = normalizePagination;
window.getRawImageUrl = getRawImageUrl;
window.togglePin = togglePin;
window.syncLoginIcons = syncLoginIcons;
window.highlightBottomNav = highlightBottomNav;
window.loadWatchHistoryFromFirebase = loadWatchHistoryFromFirebase;
window.loadFavoritesFromFirebase = loadFavoritesFromFirebase;
window.loadPinnedMoviesFromFirebase = loadPinnedMoviesFromFirebase;
window.savePinnedMoviesToFirebase = savePinnedMoviesToFirebase;
window.saveSingleWatchHistoryItem = saveSingleWatchHistoryItem;
window.resolveOPhimImageUrl = resolveOPhimImageUrl;
window.resolveKKPhimImageUrl = resolveKKPhimImageUrl;
window.favorites = favorites;
window.pinnedMovies = pinnedMovies;
window.watchHistory = watchHistory;
window.currentUser = window.currentUser;
window.db = db;
window.auth = auth;
