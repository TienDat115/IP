// CinePhim - Shared Layout
// Header, Footer, Login/Register modals & mobile bottom nav được định nghĩa ở đây.
// Sửa nội dung bên dưới để đổi toàn bộ trang mà không cần sửa từng file HTML.

(function () {
    function currentPage() {
        var name = window.location.pathname.split('/').pop();
        return name || 'index.html';
    }

    function menuItem(href, label) {
        var active = currentPage() === href ? ' active' : '';
        return '<a href="' + href + '" class="menu-item' + active + '">' + label + '</a>';
    }

    var headerHTML = [
        '<header id="siteHeader" class="home-header">',
        '<nav class="container mx-auto px-3 sm:px-6">',
        '<div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">',
        '<a href="index.html" class="home-logo"><i class="fas fa-film mr-2"></i>CinePhim</a>',
        '',
        '<div class="hidden lg:flex items-center gap-1 main-menu">',
        menuItem('index.html', 'Trang chủ'),
        menuItem('browse.html', 'Lọc Phim'),
        menuItem('single-movies.html', 'Phim Lẻ'),
        menuItem('sources.html', 'Nguồn phim'),
        '</div>',
        '',
        '<div id="search" class="order-last w-full lg:order-none lg:w-auto lg:flex-1 lg:max-w-xl">',
        '<div class="search-elements">',
        '<i class="fas fa-search search-icon"></i>',
        '<input id="searchInput" type="text" class="search-input" placeholder="Tìm kiếm phim, diễn viên..." autocomplete="off" />',
        '</div>',
        '</div>',
        '',
        '<div class="flex items-center gap-2 sm:gap-3">',
        '<div id="sourceSwitcherDesktop" class="hidden sm:block"></div>',
        '<div id="sourceSwitcherMobile" class="sm:hidden"></div>',
        '',
        '<!-- Desktop User Profile Menu (shown when logged in) -->',
        '<div class="hidden sm:block">',
        '<div id="userProfileMenu" class="relative hidden">',
        '<button onclick="toggleUserDropdown()" class="home-icon-btn">',
        '<img id="userAvatar" src="data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'32\' height=\'32\'%3E%3Crect width=\'32\' height=\'32\' fill=\'%234B5563\'/%3E%3Ctext x=\'16\' y=\'16\' font-family=\'sans-serif\' font-size=\'9\' fill=\'%23ffffff\' text-anchor=\'middle\' dominant-baseline=\'central\'%3EUser%3C/text%3E%3C/svg%3E" alt="User Avatar" class="w-8 h-8 rounded-full" />',
        '</button>',
        '',
        '<!-- Dropdown Menu -->',
        '<div id="userDropdown" class="absolute right-0 mt-2 w-64 bg-gray-800 rounded-lg shadow-xl border border-gray-700 hidden z-50">',
        '<div class="p-4 border-b border-gray-700">',
        '<p class="text-sm text-gray-300">Chào,</p>',
        '<p id="userEmail" class="text-sm font-medium text-white truncate">user@example.com</p>',
        '</div>',
        '',
        '<div class="py-2">',
        '<a href="favorites.html" class="flex items-center px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition">',
        '<i class="fas fa-heart w-5 mr-3 text-red-400"></i>',
        'Yêu thích',
        '</a>',
        '<a href="watch-history.html" class="flex items-center px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition">',
        '<i class="fas fa-history w-5 mr-3 text-blue-400"></i>',
        'Xem tiếp',
        '</a>',
        '<a href="#" onclick="showAccountModal(); return false;" class="flex items-center px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition">',
        '<i class="fas fa-user w-5 mr-3 text-green-400"></i>',
        'Tài khoản',
        '</a>',
        '</div>',
        '',
        '<div class="border-t border-gray-700 py-2">',
        '<button onclick="handleLogout()" class="flex items-center w-full px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition">',
        '<i class="fas fa-sign-out-alt w-5 mr-3 text-orange-400"></i>',
        'Thoát',
        '</button>',
        '</div>',
        '</div>',
        '</div>',
        '</div>',
        '',
        '<!-- Desktop Login Button (shown when not logged in) -->',
        '<div class="hidden sm:block">',
        '<button id="loginButton" onclick="toggleLogin()" class="home-login-btn hidden">',
        '<i id="loginIcon" class="fas fa-sign-in-alt mr-1"></i>',
        '<span id="loginText">Đăng nhập</span>',
        '</button>',
        '</div>',
        '</div>',
        '</div>',
        '</nav>',
        '</header>'
    ].join('\n');

    var footerHTML = [
        '<footer class="home-footer">',
        '<div class="container mx-auto px-4 py-10">',
        '<p class="text-center text-sm home-footer-notice">',
        '2026 CinePhim. Xem phim online miễn phí với chất lượng HD - Full HD. Nội dung chỉ dùng để giải trí cá nhân.',
        '</p>',
        '</div>',
        '</footer>'
    ].join('\n');

    var loginModalHTML = [
        '<!-- Login Modal -->',
        '<div id="loginModal" class="fixed inset-0 bg-black bg-opacity-75 z-50 hidden">',
        '<div class="flex items-center justify-center min-h-screen p-4">',
        '<div class="bg-gray-800 rounded-lg max-w-md w-full p-4 sm:p-6 modal">',
        '<div class="flex justify-between items-center mb-4">',
        '<h3 class="text-lg sm:text-xl font-semibold text-white">Đăng nhập</h3>',
        '<button onclick="closeLoginModal()" class="text-gray-400 hover:text-white text-xl">',
        '<i class="fas fa-times"></i>',
        '</button>',
        '</div>',
        '<form onsubmit="handleLogin(event)">',
        '<div class="mb-4">',
        '<label class="block text-sm font-medium text-gray-300 mb-2">Email</label>',
        '<input type="email" id="loginEmail" required class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-400 text-sm" placeholder="nhập email của bạn" />',
        '</div>',
        '<div class="mb-6">',
        '<label class="block text-sm font-medium text-gray-300 mb-2">Mật khẩu</label>',
        '<input type="password" id="loginPassword" required class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-400 text-sm" placeholder="nhập mật khẩu" />',
        '</div>',
        '<button type="submit" class="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-4 rounded-lg transition">Đăng nhập</button>',
        '</form>',
        '<div class="mt-4 text-center">',
        '<p class="text-sm text-gray-400">',
        'Chưa có tài khoản?',
        '<button onclick="showRegisterModal()" class="text-purple-400 hover:text-purple-300">Đăng ký</button>',
        '</p>',
        '</div>',
        '</div>',
        '</div>',
        '</div>'
    ].join('\n');

    var registerModalHTML = [
        '<!-- Register Modal -->',
        '<div id="registerModal" class="fixed inset-0 bg-black bg-opacity-75 z-50 hidden">',
        '<div class="flex items-center justify-center min-h-screen p-4">',
        '<div class="bg-gray-800 rounded-lg max-w-md w-full p-6">',
        '<div class="flex justify-between items-center mb-4">',
        '<h3 class="text-xl font-semibold text-white">Đăng ký</h3>',
        '<button onclick="closeRegisterModal()" class="text-gray-400 hover:text-white">',
        '<i class="fas fa-times"></i>',
        '</button>',
        '</div>',
        '<form onsubmit="handleRegister(event)">',
        '<div class="mb-4">',
        '<label class="block text-sm font-medium text-gray-300 mb-2">Email</label>',
        '<input type="email" id="registerEmail" required class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-400" placeholder="nhập email của bạn" />',
        '</div>',
        '<div class="mb-4">',
        '<label class="block text-sm font-medium text-gray-300 mb-2">Mật khẩu</label>',
        '<input type="password" id="registerPassword" required minlength="6" class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-400" placeholder="tối thiểu 6 ký tự" />',
        '</div>',
        '<div class="mb-6">',
        '<label class="block text-sm font-medium text-gray-300 mb-2">Xác nhận mật khẩu</label>',
        '<input type="password" id="registerConfirmPassword" required minlength="6" class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-400" placeholder="nhập lại mật khẩu" />',
        '</div>',
        '<button type="submit" class="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg transition">Đăng ký</button>',
        '</form>',
        '<div class="mt-4 text-center">',
        '<p class="text-sm text-gray-400">',
        'Đã có tài khoản?',
        '<button onclick="showLoginModal()" class="text-purple-400 hover:text-purple-300">Đăng nhập</button>',
        '</p>',
        '</div>',
        '</div>',
        '</div>',
        '</div>'
    ].join('\n');

    var bottomNavHTML = [
        '<!-- Mobile Bottom Navigation -->',
        '<nav id="bottomNav" class="sm:hidden fixed bottom-0 left-0 right-0 bg-gray-800/95 backdrop-blur border-t border-gray-700 z-50 px-2">',
        '<div class="flex items-center justify-around py-1 max-w-lg mx-auto">',
        '<a href="index.html" class="bottom-nav-item"><i class="fas fa-home"></i><span>Trang chủ</span></a>',
        '<a href="browse.html" class="bottom-nav-item"><i class="fas fa-search"></i><span>Tìm nâng cao</span></a>',
        '<a href="single-movies.html" class="bottom-nav-item"><i class="fas fa-film"></i><span>Phim Lẻ</span></a>',
        '<a href="sources.html" class="bottom-nav-item"><i class="fas fa-link"></i><span>Nguồn phim</span></a>',
        '',
        '<!-- Mobile User Profile Menu (shown when logged in) -->',
        '<div id="mobileUserProfileMenu" class="relative hidden">',
        '<button onclick="toggleMobileUserDropdown()" class="bottom-nav-item justify-center">',
        '<img id="mobileUserAvatar" src="data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'28\' height=\'28\'%3E%3Crect width=\'28\' height=\'28\' fill=\'%234B5563\'/%3E%3Ctext x=\'14\' y=\'14\' font-family=\'sans-serif\' font-size=\'8\' fill=\'%23ffffff\' text-anchor=\'middle\' dominant-baseline=\'central\'%3EUser%3C/text%3E%3C/svg%3E" alt="User Avatar" class="w-7 h-7 rounded-full" />',
        '</button>',
        '<div id="mobileUserDropdown" class="absolute right-0 bottom-16 w-64 bg-gray-800 rounded-lg shadow-xl border border-gray-700 hidden z-50">',
        '<div class="p-4 border-b border-gray-700">',
        '<p class="text-sm text-gray-300">Chào,</p>',
        '<p id="mobileUserEmail" class="text-sm font-medium text-white truncate">user@example.com</p>',
        '</div>',
        '',
        '<div class="py-2">',
        '<a href="favorites.html" class="flex items-center px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition">',
        '<i class="fas fa-heart w-5 mr-3 text-red-400"></i>',
        'Yêu thích',
        '</a>',
        '<a href="watch-history.html" class="flex items-center px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition">',
        '<i class="fas fa-history w-5 mr-3 text-blue-400"></i>',
        'Xem tiếp',
        '</a>',
        '<a href="#" onclick="showAccountModal(); return false;" class="flex items-center px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition">',
        '<i class="fas fa-user w-5 mr-3 text-green-400"></i>',
        'Tài khoản',
        '</a>',
        '</div>',
        '',
        '<div class="border-t border-gray-700 py-2">',
        '<button onclick="handleLogout()" class="flex items-center w-full px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition">',
        '<i class="fas fa-sign-out-alt w-5 mr-3 text-orange-400"></i>',
        'Thoát',
        '</button>',
        '</div>',
        '</div>',
        '</div>',
        '',
        '<!-- Mobile Login Button (shown when not logged in) -->',
        '<button id="mobileLoginButton" onclick="toggleLogin()" class="bottom-nav-item hidden">',
        '<i id="mobileLoginIcon" class="fas fa-sign-in-alt"></i><span>Đăng nhập</span>',
        '</button>',
        '</div>',
        '</nav>'
    ].join('\n');

    function inject() {
        var headerEl = document.getElementById('siteHeader');
        if (headerEl) {
            headerEl.innerHTML = headerHTML;
        }

        var footerEl = document.getElementById('siteFooter');
        if (footerEl) {
            footerEl.innerHTML = footerHTML;
        }

        if (document.body) {
            document.body.insertAdjacentHTML('beforeend', loginModalHTML);
            document.body.insertAdjacentHTML('beforeend', registerModalHTML);
            document.body.insertAdjacentHTML('beforeend', bottomNavHTML);
        }
    }

    if (document.body) {
        inject();
    } else {
        document.addEventListener('DOMContentLoaded', inject);
    }
})();