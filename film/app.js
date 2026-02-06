// API Configuration
const API_BASE = 'https://phim.nguonc.com/api';

// Global variables
let currentPage = 1;
let currentCategory = '';
let currentCountry = '';
let currentYear = '';
let searchQuery = '';
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

// Initialize app
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
            loadNewMovies();
            setupEventListeners();
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

// Apply theme
function applyTheme() {
    if (isDarkMode) {
        document.body.classList.add('dark');
        document.getElementById('themeIcon').className = 'fas fa-sun mr-1';
    } else {
        document.body.classList.remove('dark');
        document.getElementById('themeIcon').className = 'fas fa-moon mr-1';
    }
}

// Toggle theme
function toggleTheme() {
    isDarkMode = !isDarkMode;
    localStorage.setItem('darkMode', isDarkMode);
    applyTheme();
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
            loginIcon.className = 'fas fa-sign-in-alt mr-1';
            loginText.textContent = 'Đăng nhập';
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
    document.getElementById('loginModal').classList.remove('hidden');
    document.getElementById('registerModal').classList.add('hidden');
}

// Close login modal
function closeLoginModal() {
    document.getElementById('loginModal').classList.add('hidden');
}

// Show register modal
function showRegisterModal() {
    document.getElementById('registerModal').classList.remove('hidden');
    document.getElementById('loginModal').classList.add('hidden');
}

// Close register modal
function closeRegisterModal() {
    document.getElementById('registerModal').classList.add('hidden');
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
        loginIcon.className = 'fas fa-sign-out-alt mr-1';
        loginText.textContent = 'Đăng xuất';
    } else {
        loginIcon.className = 'fas fa-sign-in-alt mr-1';
        loginText.textContent = 'Đăng nhập';
    }
}

// Setup event listeners
function setupEventListeners() {
    const searchInput = document.getElementById('searchInput');
    let searchTimeout;
    
    searchInput.addEventListener('input', function(e) {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            const query = e.target.value.trim();
            if (query) {
                searchMovies(query);
            } else {
                loadNewMovies();
            }
        }, 500);
    });
    
    // Update login button on load
    updateLoginButton();
}

// Show loading
function showLoading() {
    document.getElementById('loading').classList.remove('hidden');
    document.getElementById('moviesContainer').innerHTML = '';
    document.getElementById('pagination').innerHTML = '';
}

// Hide loading
function hideLoading() {
    document.getElementById('loading').classList.add('hidden');
}

// Load new movies
async function loadNewMovies(page = 1) {
    showLoading();
    currentPage = page;
    currentCategory = '';
    currentCountry = '';
    currentYear = '';
    searchQuery = '';
    
    try {
        const response = await fetch(`${API_BASE}/films/phim-moi-cap-nhat?page=${page}`);
        const data = await response.json();
        
        if (data.status === 'success') {
            displayMovies(data.items);
            displayPagination(data.pagination);
        } else {
            showError('Không thể tải danh sách phim');
        }
    } catch (error) {
        showError('Lỗi kết nối đến server');
    } finally {
        hideLoading();
    }
}

// Load movies by category
async function loadMoviesByCategory(slug, page = 1) {
    showLoading();
    currentPage = page;
    currentCategory = slug;
    currentCountry = '';
    currentYear = '';
    searchQuery = '';
    
    try {
        const response = await fetch(`${API_BASE}/films/the-loai/${slug}?page=${page}`);
        const data = await response.json();
        
        if (data.status === 'success') {
            displayMovies(data.items);
            displayPagination(data.pagination);
        } else {
            showError('Không thể tải danh sách phim theo thể loại');
        }
    } catch (error) {
        showError('Lỗi kết nối đến server');
    } finally {
        hideLoading();
    }
}

// Load movies by country
async function loadMoviesByCountry(slug, page = 1) {
    showLoading();
    currentPage = page;
    currentCategory = '';
    currentCountry = slug;
    currentYear = '';
    searchQuery = '';
    
    try {
        const response = await fetch(`${API_BASE}/films/quoc-gia/${slug}?page=${page}`);
        const data = await response.json();
        
        if (data.status === 'success') {
            displayMovies(data.items);
            displayPagination(data.pagination);
        } else {
            showError('Không thể tải danh sách phim theo quốc gia');
        }
    } catch (error) {
        showError('Lỗi kết nối đến server');
    } finally {
        hideLoading();
    }
}

// Load movies by year
async function loadMoviesByYear(year, page = 1) {
    showLoading();
    currentPage = page;
    currentCategory = '';
    currentCountry = '';
    currentYear = year;
    searchQuery = '';
    
    try {
        const response = await fetch(`${API_BASE}/films/nam-phat-hanh/${year}?page=${page}`);
        const data = await response.json();
        
        if (data.status === 'success') {
            displayMovies(data.items);
            displayPagination(data.pagination);
        } else {
            showError('Không thể tải danh sách phim theo năm');
        }
    } catch (error) {
        showError('Lỗi kết nối đến server');
    } finally {
        hideLoading();
    }
}

// Search movies
async function searchMovies(keyword, page = 1) {
    showLoading();
    currentPage = page;
    searchQuery = keyword;
    
    try {
        const response = await fetch(`${API_BASE}/films/search?keyword=${encodeURIComponent(keyword)}`);
        const data = await response.json();
        
        if (data.status === 'success') {
            displayMovies(data.items);
            displayPagination(data.pagination);
        } else {
            showError('Không tìm thấy phim nào');
        }
    } catch (error) {
        showError('Lỗi kết nối đến server');
    } finally {
        hideLoading();
    }
}

// Display movies
function displayMovies(movies) {
    const container = document.getElementById('moviesContainer');
    
    if (!movies || movies.length === 0) {
        container.innerHTML = '<div class="col-span-full text-center py-8 text-gray-400">Không có phim nào để hiển thị</div>';
        return;
    }
    
    container.innerHTML = movies.map(movie => `
        <div class="film-card bg-gray-800 rounded-lg overflow-hidden cursor-pointer" onclick="showMovieDetail('${movie.slug}')">
            <div class="relative">
                <img src="${movie.poster_url || movie.thumb_url || 'https://via.placeholder.com/300x450/374151/ffffff?text=No+Poster'}" 
                     alt="${movie.name || movie.title}" 
                     class="film-poster w-full"
                     onerror="this.src='https://via.placeholder.com/300x450/374151/ffffff?text=No+Poster'">
                <div class="absolute top-2 right-2 bg-purple-600 px-2 py-1 rounded text-xs font-semibold">
                    ${movie.quality || 'HD'}
                </div>
                ${movie.current_episode ? `
                    <div class="absolute bottom-2 left-2 bg-black bg-opacity-75 px-2 py-1 rounded text-xs">
                        ${movie.current_episode}
                    </div>
                ` : ''}
            </div>
            <div class="p-4">
                <h3 class="font-semibold text-sm mb-2 line-clamp-2">${movie.name || movie.title}</h3>
                <p class="text-gray-400 text-xs mb-2">${movie.year || movie.time || ''}</p>
                <div class="flex items-center justify-between">
                    <span class="text-xs text-gray-500">${getCountryFromCategory(movie.category) || ''}</span>
                    <div class="flex items-center text-xs text-yellow-400">
                        <i class="fas fa-star mr-1"></i>
                        ${movie.rating || 'N/A'}
                    </div>
                </div>
            </div>
        </div>
    `).join('');
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

// Display pagination
function displayPagination(pagination) {
    const container = document.getElementById('pagination');
    
    if (!pagination || pagination.total_pages <= 1) {
        container.innerHTML = '';
        return;
    }
    
    const { current_page, total_pages } = pagination;
    let html = '';
    
    // Previous button
    if (current_page > 1) {
        html += `<button onclick="changePage(${current_page - 1})" class="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded transition">
            <i class="fas fa-chevron-left"></i>
        </button>`;
    }
    
    // Page numbers
    const startPage = Math.max(1, current_page - 2);
    const endPage = Math.min(total_pages, current_page + 2);
    
    for (let i = startPage; i <= endPage; i++) {
        const isActive = i === current_page;
        html += `<button onclick="changePage(${i})" class="px-3 py-2 ${isActive ? 'bg-purple-600' : 'bg-gray-700 hover:bg-gray-600'} rounded transition">
            ${i}
        </button>`;
    }
    
    // Next button
    if (current_page < total_pages) {
        html += `<button onclick="changePage(${current_page + 1})" class="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded transition">
            <i class="fas fa-chevron-right"></i>
        </button>`;
    }
    
    container.innerHTML = html;
}

// Change page
function changePage(page) {
    if (searchQuery) {
        searchMovies(searchQuery, page);
    } else if (currentCategory) {
        loadMoviesByCategory(currentCategory, page);
    } else if (currentCountry) {
        loadMoviesByCountry(currentCountry, page);
    } else if (currentYear) {
        loadMoviesByYear(currentYear, page);
    } else {
        loadNewMovies(page);
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
            const isFavorite = favorites.includes(slug);
            
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
                    <button onclick="toggleFavorite('${slug}')" class="absolute top-4 left-4 bg-red-600 hover:bg-red-700 px-3 py-2 rounded-lg transition">
                        <i class="fas fa-heart ${isFavorite ? '' : 'text-gray-300'}"></i>
                    </button>
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
                        
                        <div id="watchHistoryInModal" class="hidden">
                            <h4 class="text-lg font-semibold mb-4">Lịch sử xem phim này</h4>
                            <div id="modalWatchHistoryGrid" class="grid grid-cols-1 gap-4 max-h-60 overflow-y-auto">
                                <!-- Watch history will be loaded here -->
                            </div>
                        </div>
                    ` : ''}
                </div>
            `;
            
            // Store episodes data for server switching
            window.currentMovieEpisodes = movie.episodes;
            window.currentMovieTitle = movie.name || movie.title;
            window.currentMovieSlug = slug;
            
            modal.classList.remove('hidden');
        } else {
            showError('Không thể tải thông tin phim');
        }
    } catch (error) {
        showError('Lỗi kết nối đến server');
    }
}

// Close movie modal
function closeMovieModal() {
    document.getElementById('movieModal').classList.add('hidden');
}

// Check if episode is watched
function isEpisodeWatched(episodeSlug) {
    return watchHistory.some(item => 
        item.movieSlug === window.currentMovieSlug && 
        item.episodeName === episodeSlug
    );
}

// Toggle watch history in modal
function toggleWatchHistoryInModal() {
    const modal = document.getElementById('watchHistoryInModal');
    const grid = document.getElementById('modalWatchHistoryGrid');
    
    if (modal.classList.contains('hidden')) {
        modal.classList.remove('hidden');
        loadWatchHistoryInModal();
    } else {
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
    
    grid.innerHTML = movieHistory.map((item, index) => `
        <div class="flex items-center justify-between p-3 border-b border-gray-700 hover:bg-gray-700 cursor-pointer bg-blue-900" 
             onclick="continueWatchingEpisode('${item.episodeName}')">
            <div class="flex items-center space-x-3">
                <div class="flex items-center">
                    <i class="fas fa-play-circle text-green-400 mr-2"></i>
                    <span class="text-sm font-semibold">${item.episodeName}</span>
                </div>
                <span class="text-xs text-gray-400">${formatWatchTime(item.watchedAt)}</span>
            </div>
            <div class="text-xs text-blue-300">
                <i class="fas fa-redo mr-1"></i>Xem tiếp
            </div>
        </div>
    `).join('');
}

// Continue watching episode
function continueWatchingEpisode(episodeSlug) {
    // Find episode in current movie episodes
    if (!window.currentMovieEpisodes) {
        alert('Không tìm thấy thông tin tập phim');
        return;
    }
    
    let targetEpisode = null;
    let targetVideoUrl = null;
    
    // Search through all servers for episode
    for (const server of window.currentMovieEpisodes) {
        const episode = server.items.find(ep => ep.slug === episodeSlug);
        if (episode) {
            targetEpisode = episode;
            targetVideoUrl = episode.embed || episode.m3u8;
            break;
        }
    }
    
    if (!targetEpisode || !targetVideoUrl) {
        alert('Không tìm thấy video của tập này');
        return;
    }
    
    // Hide watch history modal
    const watchHistoryModal = document.getElementById('watchHistoryInModal');
    if (watchHistoryModal) {
        watchHistoryModal.classList.add('hidden');
    }
    
    // Play episode in current modal
    playEpisodeInModal(episodeSlug, targetVideoUrl);
}

// Play episode in current modal
function playEpisodeInModal(slug, videoUrl) {
    if (!videoUrl || videoUrl === 'undefined') {
        alert('Không thể tải thông tin tập phim. Vui lòng thử lại sau.');
        return;
    }
    
    // Get current movie info
    const movieTitle = window.currentMovieTitle || 'Phim';
    const movieSlug = window.currentMovieSlug || slug;
    
    console.log('Playing episode in modal:', { movieSlug, movieTitle, episodeSlug: slug, videoUrl });
    
    // Add to watch history
    addToWatchHistory(movieSlug, movieTitle, slug);
    
    // Create video player in modal
    const videoContainer = document.createElement('div');
    videoContainer.className = 'fixed inset-0 bg-black bg-opacity-95 z-50 flex items-center justify-center';
    videoContainer.innerHTML = `
        <div class="bg-gray-800 rounded-lg max-w-6xl w-full max-h-[95vh] overflow-hidden">
            <div class="relative">
                <button onclick="closeVideoInModal()" class="absolute top-4 right-4 text-white text-2xl hover:text-red-400 z-10 bg-black bg-opacity-50 rounded-full w-10 h-10 flex items-center justify-center">
                    <i class="fas fa-times"></i>
                </button>
                <div class="aspect-video bg-black">
                    ${videoUrl.includes('.m3u8') ? `
                        <video id="videoPlayerInModal" class="w-full h-full" controls>
                            <source src="${videoUrl}" type="application/x-mpegURL">
                            Your browser does not support the video tag.
                        </video>
                    ` : `
                        <iframe id="videoPlayerInModal" src="${videoUrl}" class="w-full h-full" frameborder="0" allowfullscreen></iframe>
                    `}
                </div>
                <div class="absolute top-4 left-4 bg-black bg-opacity-75 px-3 py-2 rounded">
                    <p class="text-white text-sm font-semibold">${movieTitle}</p>
                    <p class="text-gray-300 text-xs">${slug}</p>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(videoContainer);
    videoContainer.id = 'videoModalInModal';
    
    // Load HLS.js for m3u8 support if needed
    if (videoUrl.includes('.m3u8')) {
        loadHLSPlayerInModal();
    }
}

// Close video in modal
function closeVideoInModal() {
    const videoModal = document.getElementById('videoModalInModal');
    if (videoModal) {
        videoModal.remove();
    }
}

// Load HLS.js for m3u8 streaming in modal
function loadHLSPlayerInModal() {
    if (window.Hls) {
        const video = document.getElementById('videoPlayerInModal');
        if (video) {
            const hls = new Hls();
            hls.loadSource(video.src);
            hls.attachMedia(video);
        }
        return;
    }
    
    // Load HLS.js script
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/hls.js@latest';
    script.onload = function() {
        const video = document.getElementById('videoPlayerInModal');
        if (video && window.Hls) {
            const hls = new Hls();
            hls.loadSource(video.src);
            hls.attachMedia(video);
        }
    };
    document.head.appendChild(script);
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
    
    console.log('Playing episode:', { movieSlug, movieTitle, episodeSlug: slug, videoUrl });
    
    // Add to watch history
    addToWatchHistory(movieSlug, movieTitle, slug);
    
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
        </div>
    `;
    
    document.body.appendChild(videoModal);
    videoModal.id = 'videoModal';
    
    // Load HLS.js for m3u8 support if needed
    if (videoUrl.includes('.m3u8')) {
        loadHLSPlayer();
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
    
    // Update watch history display if it's currently visible
    const watchHistorySection = document.getElementById('watchHistorySection');
    if (watchHistorySection) {
        displayWatchHistory();
    }
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
    
    // Load HLS.js script
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

// Close video modal
function closeVideoModal() {
    const videoModal = document.getElementById('videoModal');
    if (videoModal) {
        videoModal.remove();
    }
}

// Show home
function showHome() {
    hideAllSections();
    document.getElementById('moviesContainer').parentElement.classList.remove('hidden');
    loadNewMovies();
}

// Show categories
function showCategories() {
    hideAllSections();
    const section = document.getElementById('categoriesSection');
    section.classList.remove('hidden');
    
    const grid = document.getElementById('categoriesGrid');
    grid.innerHTML = categories.map(category => `
        <div onclick="loadMoviesByCategory('${category.slug}')" 
             class="bg-gray-800 p-4 rounded-lg text-center cursor-pointer hover:bg-gray-700 transition">
            <i class="fas ${category.icon} text-3xl mb-2 text-purple-400"></i>
            <p class="text-sm">${category.name}</p>
        </div>
    `).join('');
}

// Show countries
function showCountries() {
    hideAllSections();
    const section = document.getElementById('countriesSection');
    section.classList.remove('hidden');
    
    const grid = document.getElementById('countriesGrid');
    grid.innerHTML = countries.map(country => `
        <div onclick="loadMoviesByCountry('${country.slug}')" 
             class="bg-gray-800 p-4 rounded-lg text-center cursor-pointer hover:bg-gray-700 transition">
            <i class="fas ${country.icon} text-3xl mb-2 text-purple-400"></i>
            <p class="text-sm">${country.name}</p>
        </div>
    `).join('');
}

// Hide all sections
function hideAllSections() {
    document.getElementById('moviesContainer').innerHTML = '';
    document.getElementById('pagination').innerHTML = '';
    document.getElementById('categoriesSection').classList.add('hidden');
    document.getElementById('countriesSection').classList.add('hidden');
    document.getElementById('yearsSection').classList.add('hidden');
    document.getElementById('favoritesSection').classList.add('hidden');
    
    // Remove movie modal if exists
    const movieModal = document.getElementById('movieModal');
    if (movieModal) {
        movieModal.classList.add('hidden');
    }
    
    // Remove watch history section if exists
    const watchHistorySection = document.getElementById('watchHistorySection');
    if (watchHistorySection) {
        watchHistorySection.remove();
    }
}

// Show now playing movies
async function showNowPlaying() {
    hideAllSections();
    document.getElementById('moviesContainer').parentElement.classList.remove('hidden');
    await loadMoviesByCategory('phim-dang-chieu');
}

// Show years
function showYears() {
    hideAllSections();
    const section = document.getElementById('yearsSection');
    section.classList.remove('hidden');
    
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = currentYear; i >= currentYear - 20; i--) {
        years.push(i);
    }
    
    const grid = document.getElementById('yearsGrid');
    grid.innerHTML = years.map(year => `
        <div onclick="loadMoviesByYear(${year})" 
             class="bg-gray-800 p-3 rounded-lg text-center cursor-pointer hover:bg-gray-700 transition">
            <p class="text-sm font-semibold">${year}</p>
        </div>
    `).join('');
}

// Show watch history
function showWatchHistory() {
    hideAllSections();
    
    // Reload from localStorage to get latest data
    watchHistory = JSON.parse(localStorage.getItem('watchHistory') || '[]');
    console.log('Loaded watch history from localStorage:', watchHistory);
    console.log('Watch history length:', watchHistory.length);
    
    const section = document.createElement('div');
    section.className = 'container mx-auto px-4 py-8';
    section.id = 'watchHistorySection';
    section.innerHTML = `
        <div class="flex justify-between items-center mb-6">
            <h3 class="text-2xl font-bold">Lịch sử xem phim</h3>
            <div class="flex gap-2">
                <button onclick="refreshWatchHistory()" class="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm transition">
                    <i class="fas fa-sync mr-2"></i>Làm mới
                </button>
                <button onclick="clearWatchHistory()" class="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg text-sm transition">
                    <i class="fas fa-trash mr-2"></i>Xóa tất cả
                </button>
            </div>
        </div>
        <div id="watchHistoryGrid" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            <!-- Watch history items will be loaded here -->
        </div>
    `;
    
    document.querySelector('main').appendChild(section);
    
    if (watchHistory.length === 0) {
        document.getElementById('watchHistoryGrid').innerHTML = `
            <div class="col-span-full text-center py-8 text-gray-400">
                <i class="fas fa-history text-4xl mb-4"></i>
                <p>Chưa có lịch sử xem phim</p>
                <p class="text-sm mt-2">Hãy xem một vài phim để lịch sử được hiển thị!</p>
                <p class="text-xs mt-4 text-gray-500">Mẹo: Mở Developer Console (F12) để xem logs</p>
            </div>
        `;
        return;
    }
    
    displayWatchHistory();
}

// Refresh watch history from localStorage
function refreshWatchHistory() {
    watchHistory = JSON.parse(localStorage.getItem('watchHistory') || '[]');
    console.log('Refreshed watch history:', watchHistory);
    displayWatchHistory();
}

// Clear all watch history
async function clearWatchHistory() {
    const result = await Swal.fire({
        title: 'Xác nhận xóa lịch sử',
        text: 'Bạn có chắc chắn muốn xóa toàn bộ lịch sử xem phim?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'Xóa',
        cancelButtonText: 'Hủy'
    });
    
    if (result.isConfirmed) {
        watchHistory = [];
        
        // Clear from Firebase if user is logged in
        if (currentUser) {
            try {
                const userRef = db.collection('users').doc(currentUser.uid);
                const historyRef = userRef.collection('watchHistory');
                const snapshot = await historyRef.get();
                const batch = db.batch();
                
                snapshot.forEach(doc => {
                    batch.delete(doc.ref);
                });
                
                await batch.commit();
                console.log('Watch history cleared from Firebase');
            } catch (error) {
                console.error('Error clearing watch history:', error);
            }
        }
        
        // Clear from localStorage as fallback
        localStorage.setItem('watchHistory', JSON.stringify(watchHistory));
        displayWatchHistory();
        
        Swal.fire({
            icon: 'success',
            title: 'Thành công!',
            text: 'Lịch sử đã được xóa.',
            confirmButtonColor: '#8b5cf6',
            timer: 1500,
            showConfirmButton: false
        });
    }
}

// Display watch history
function displayWatchHistory() {
    console.log('displayWatchHistory() called');
    
    // Wait a bit for DOM to be ready
    setTimeout(() => {
        const container = document.getElementById('watchHistoryGrid');
        console.log('Container found:', container);
        console.log('Watch history data:', watchHistory);
        
        if (!container) {
            console.log('Container not found!');
            return;
        }
        
        if (!watchHistory || watchHistory.length === 0) {
            container.innerHTML = '<div class="col-span-full text-center py-8 text-gray-400"><i class="fas fa-history text-4xl mb-4"></i><p>Không có dữ liệu lịch sử</p></div>';
            return;
        }
        
        let html = '';
        watchHistory.forEach((item, index) => {
            console.log('Building HTML for item ' + index + ':', item);
            html += '<div class="film-card bg-gray-800 rounded-lg overflow-hidden cursor-pointer relative" onclick="showMovieDetail(\'' + item.movieSlug + '\')">';
            html += '<div class="absolute top-2 right-2 z-10">';
            html += '<button onclick="event.stopPropagation(); removeFromWatchHistory(\'' + item.movieSlug + '\')" class="bg-red-600 hover:bg-red-700 p-2 rounded-full transition">';
            html += '<i class="fas fa-trash text-white text-xs"></i>';
            html += '</button></div>';
            html += '<div class="absolute top-2 left-2 bg-black bg-opacity-75 px-2 py-1 rounded text-xs">';
            html += '<i class="fas fa-history text-gray-300 mr-1"></i>' + formatWatchTime(item.watchedAt);
            html += '</div>';
            html += '<div class="relative">';
            html += '<div class="aspect-video bg-gray-700 flex items-center justify-center">';
            html += '<i class="fas fa-film text-4xl text-gray-500"></i>';
            html += '</div>';
            html += '<div class="absolute bottom-2 left-2 bg-purple-600 px-2 py-1 rounded text-xs font-semibold">';
            html += (item.episodeName || 'Tập phim');
            html += '</div>';
            html += '</div>';
            html += '<div class="p-4">';
            html += '<h4 class="font-semibold text-sm mb-2 line-clamp-2">' + (item.movieTitle || 'Phim không xác định') + '</h4>';
            html += '<p class="text-gray-400 text-xs mb-2">' + (item.episodeName || 'Không có thông tin tập') + '</p>';
            html += '<p class="text-gray-500 text-xs">Xem lúc: ' + formatDate(item.watchedAt) + '</p>';
            html += '</div>';
            html += '</div>';
        });
        
        // Clean up any zero-width spaces
        html = html.replace(/​/g, '');
        
        console.log('Final HTML length:', html.length);
        console.log('Setting innerHTML...');
        container.innerHTML = html;
        console.log('Container innerHTML set successfully');
        console.log('Container display:', container.style.display);
        console.log('Container children count:', container.children.length);
    }, 100);
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

// Remove from watch history
function removeFromWatchHistory(movieSlug) {
    watchHistory = watchHistory.filter(item => item.movieSlug !== movieSlug);
    localStorage.setItem('watchHistory', JSON.stringify(watchHistory));
    displayWatchHistory();
}

// Show favorites
function showFavorites() {
    hideAllSections();
    const section = document.getElementById('favoritesSection');
    section.classList.remove('hidden');
    
    if (favorites.length === 0) {
        document.getElementById('favoritesGrid').innerHTML = `
            <div class="col-span-full text-center py-8 text-gray-400">
                <i class="fas fa-heart text-4xl mb-4"></i>
                <p>Chưa có phim yêu thích nào</p>
                <p class="text-sm mt-2">Hãy thêm phim yêu thích để xem lại sau!</p>
            </div>
        `;
        return;
    }
    
    const container = document.getElementById('favoritesGrid');
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
}

// Display favorite movies
function displayFavoriteMovies(movies) {
    const container = document.getElementById('favoritesGrid');
    
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
            <button onclick="event.stopPropagation(); toggleFavorite('${movie.slug}')" 
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
                    <div class="flex items-center text-xs text-yellow-400">
                        <i class="fas fa-star mr-1"></i>
                        ${movie.rating || 'N/A'}
                    </div>
                </div>
            </div>
        </div>
    `).join('');
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
    
    // Update favorites display if it's currently visible
    const favoritesSection = document.getElementById('favoritesSection');
    if (favoritesSection && !favoritesSection.classList.contains('hidden')) {
        // Display favorites without calling function recursively
        const container = document.getElementById('favoritesGrid');
        if (!container) return;
        
        if (favorites.length === 0) {
            container.innerHTML = `
                <div class="col-span-full text-center py-8 text-gray-400">
                    <i class="fas fa-heart text-4xl mb-4"></i>
                    <p>Chưa có phim yêu thích</p>
                    <p class="text-sm mt-2">Hãy thêm phim yêu thích để xem lại sau!</p>
                </div>
            `;
            return;
        }
        
        let html = '';
        favorites.forEach((movie, index) => {
            // Ensure movie.slug is a string
            const movieSlug = typeof movie.slug === 'string' ? movie.slug : String(movie.slug || '');
            const isFavorite = favorites.some(fav => fav.slug === movieSlug);
            html += `
                <div class="film-card bg-gray-800 rounded-lg overflow-hidden cursor-pointer relative" onclick="showMovieDetail('${movieSlug}')">
                    <button onclick="event.stopPropagation(); toggleFavorite('${movieSlug}')" class="absolute top-2 right-2 z-10 bg-red-600 hover:bg-red-700 p-2 rounded-full transition">
                        <i class="fas fa-heart text-white text-xs"></i>
                    </button>
                    <div class="relative">
                        <div class="aspect-video bg-gray-700 flex items-center justify-center">
                            <i class="fas fa-film text-4xl text-gray-500"></i>
                        </div>
                        <div class="absolute bottom-2 left-2 bg-black bg-opacity-75 px-2 py-1 rounded text-xs">
                            <span class="text-purple-400">Yêu thích</span>
                        </div>
                    </div>
                    <div class="p-4">
                        <h4 class="font-semibold text-sm mb-2">${movie.title || movie.name || movieSlug || 'Phim không xác định'}</h4>
                        <p class="text-gray-400 text-xs mb-2">Thêm lúc: ${formatDate(movie.addedAt)}</p>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
    }
}

// Initialize theme
function initializeTheme() {
    if (isDarkMode) {
        document.body.classList.add('dark');
        document.getElementById('themeIcon').classList.remove('fa-sun');
        document.getElementById('themeIcon').classList.add('fa-moon');
    } else {
        document.body.classList.remove('dark');
        document.getElementById('themeIcon').classList.remove('fa-moon');
        document.getElementById('themeIcon').classList.add('fa-sun');
    }
}

// Toggle theme
function toggleTheme() {
    isDarkMode = !isDarkMode;
    localStorage.setItem('darkMode', isDarkMode);
    
    if (isDarkMode) {
        document.body.classList.add('dark');
        document.getElementById('themeIcon').classList.remove('fa-sun');
        document.getElementById('themeIcon').classList.add('fa-moon');
    } else {
        document.body.classList.remove('dark');
        document.getElementById('themeIcon').classList.remove('fa-moon');
        document.getElementById('themeIcon').classList.add('fa-sun');
    }
}

// Show error message
function showError(message) {
    const container = document.getElementById('moviesContainer');
    container.innerHTML = `
        <div class="col-span-full text-center py-8">
            <div class="text-red-400 mb-4">
                <i class="fas fa-exclamation-triangle text-4xl"></i>
            </div>
            <p class="text-gray-400">${message}</p>
        </div>
    `;
}

// Close modal when clicking outside
document.getElementById('movieModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeMovieModal();
    }
});
