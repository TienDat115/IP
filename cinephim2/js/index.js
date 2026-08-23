// CinePhim - Index Page JavaScript (ES5 for Tizen 2014)

var currentPage = 1;
var searchQuery = '';
var searchMode = false;

var newMoviesPage = 1;
var newMoviesTotalPages = 1;
var newMoviesLoading = false;

var swipers = {};
var heroSwiper = null;
var scrollTimeout = null;

var historyRowRendered = false;
var pinnedRowRendered = false;

var HOME_CATEGORY_ROWS = [
    { key: 'phim-le', type: 'type', slug: 'phim-le', name: 'Phim Lẻ', moreHref: 'single-movies.html' },
    { key: 'trung-quoc', type: 'country', slug: 'trung-quoc', name: 'Phim Trung Quốc', moreHref: 'browse.html?country=trung-quoc' },
    { key: 'viet-nam', type: 'country', slug: 'viet-nam', name: 'Phim Việt Nam', moreHref: 'browse.html?country=viet-nam' },
    { key: 'hoat-hinh', type: 'category', slug: 'hoat-hinh', name: 'Phim Hoạt Hình', moreHref: 'browse.html?category=hoat-hinh' }
];

function escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Initialize page
document.addEventListener('DOMContentLoaded', function () {
    window.ensureConfigReady().then(function () {
        var urlParams = new URLSearchParams(window.location.search);
        var search = urlParams.get('search');

        setupEventListeners();
        setupSearchListeners();

        document.addEventListener('cinephim:auth-ready', function () {
            loadRecentWatched();
            loadPinnedMovies();
        });

        if (search) {
            searchMovies(search, 1);
        } else {
            loadHome();
        }
    });
});

// Setup event listeners
function setupEventListeners() {
    var searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', function () {
            // Live search disabled on homepage; Enter triggers search via setupSearchListeners
        });
    }

    window.addEventListener('scroll', function () {
        if (searchMode) return;
        if (scrollTimeout) clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(handleInfiniteScroll, 200);
    });
}

/* ============================== HOME ============================== */

function loadHome() {
    return loadRecentWatched()
        .then(function () { return loadPinnedMovies(); })
        .then(function () { return loadNewMoviesRow(); })
        .then(function () { return loadCategoryRows(); });
}

// Build endpoint for a home row (new / type / category)
function buildHomeEndpoint(row) {
    if (row.type === 'new') return currentSource.endpoints.new;
    if (row.type === 'type') {
        if (currentSourceKey === 'nguonc') return '/films/' + row.slug;
        if (currentSourceKey === 'kkphim') return '/v1/api/danh-sach/' + row.slug;
        return '/danh-sach/' + row.slug;
    }
    // category
    if (row.type === 'category') {
        if (currentSourceKey === 'nguonc') return '/films/the-loai/' + row.slug;
        if (currentSourceKey === 'kkphim') return '/v1/api/the-loai/' + row.slug;
        return '/the-loai/' + row.slug;
    }
    // country
    if (currentSourceKey === 'nguonc') return '/films/quoc-gia/' + row.slug;
    if (currentSourceKey === 'kkphim') return '/v1/api/quoc-gia/' + row.slug;
    return currentSource.endpoints.country + '/' + row.slug;
}

// New movies row + hero slider
function loadNewMoviesRow() {
    return fetchJSONCached(getApiUrl(API_BASE + currentSource.endpoints.new + '?page=1'))
        .then(function (data) {
            if (data.status !== 'success' && data.status !== true) return;

            var rawItems = data.items || (data.data && data.data.items) || [];
            var movies = rawItems.map(function (item) { return normalizeMovieData(item); }).filter(Boolean);
            if (movies.length === 0) return;

            var pagination = normalizePagination(data);
            if (pagination) {
                newMoviesPage = pagination.current_page || 1;
                newMoviesTotalPages = pagination.total_page || 999;
            } else {
                newMoviesTotalPages = 999;
            }

            return enhanceHeroMovies(movies.slice(0, 5)).then(function (heroMovies) {
                renderHero(heroMovies);
                swipers['new'] = renderRowSection({ key: 'new', name: 'Phim mới cập nhật', moreHref: 'new-movies.html' }, movies, { loop: false });
            });
        })
        .catch(function (error) {
            console.error('Error loading new movies:', error);
        });
}

// Fetch details for hero movies to enrich description + categories
function enhanceHeroMovies(movies) {
    if (movies.length === 0) return Promise.resolve(movies);

    var promises = movies.map(function (movie) {
        return fetchJSONCached(getApiUrl(API_BASE + currentSource.endpoints.detail + '/' + movie.slug))
            .then(function (data) {
                var raw = data.movie || data.item || (data.data && data.data.item);
                if (raw) {
                    var norm = normalizeMovieData(raw);
                    var merged = {};
                    var key;
                    for (key in movie) {
                        if (movie.hasOwnProperty(key)) merged[key] = movie[key];
                    }
                    for (key in norm) {
                        if (norm.hasOwnProperty(key)) merged[key] = norm[key];
                    }
                    merged.categoryNames = extractCategoryNames(norm.category);
                    return merged;
                }
                return movie;
            })
            .catch(function () { return movie; });
    });

    // Manual Promise.allSettled implementation
    return Promise.all(promises.map(function (p) {
        return p.then(function (value) {
            return { status: 'fulfilled', value: value };
        }, function (reason) {
            return { status: 'rejected', reason: reason };
        });
    })).then(function (results) {
        return results.map(function (r) {
            return (r.status === 'fulfilled' && r.value ? r.value : null);
        }).filter(Boolean);
    });
}

function extractCategoryNames(category) {
    if (!category) return [];
    if (Array.isArray(category)) {
        var hasNesting = category.some(function (item) { return item.group || item.list; });
        if (hasNesting) {
            var result = [];
            category
                .filter(function (item) { return item.group && item.group.name === 'Thể loại'; })
                .forEach(function (item) {
                    if (item.list) {
                        item.list.forEach(function (c) {
                            if (c.name) result.push(c.name);
                        });
                    }
                });
            return result;
        }
        return category.map(function (c) { return c.name; }).filter(Boolean);
    }
    if (category.list && Array.isArray(category.list)) {
        return category.list.map(function (c) { return c.name; }).filter(Boolean);
    }
    return [];
}

function renderHero(heroMovies) {
    var heroSection = document.getElementById('heroSection');
    var wrapper = document.getElementById('heroWrapper');
    var thumbsContainer = document.getElementById('heroThumbs');
    if (!heroSection || !wrapper || heroMovies.length === 0) return;

    wrapper.innerHTML = heroMovies.map(function (m, i) { return getHeroSlideHTML(m, i); }).join('');
    if (thumbsContainer) {
        thumbsContainer.innerHTML = heroMovies.map(function (m, i) { return getHeroThumbHTML(m, i); }).join('');
    }

    heroSection.classList.remove('hidden');

    if (typeof Swiper === 'undefined') return;

    heroSwiper = new Swiper('#heroSlider', {
        effect: 'fade',
        fadeEffect: { crossFade: true },
        loop: true,
        speed: 700,
        autoplay: { delay: 6000, disableOnInteraction: false },
        pagination: { el: '#heroSlider .swiper-pagination', clickable: true },
        on: {
            slideChange: function () {
                var real = this.realIndex;
                var thumbs = document.querySelectorAll('.hero-thumb');
                for (var i = 0; i < thumbs.length; i++) {
                    if (i === real) {
                        thumbs[i].classList.add('active');
                    } else {
                        thumbs[i].classList.remove('active');
                    }
                }
            }
        }
    });

    // Sync active thumb on init
    if (heroSwiper) {
        setTimeout(function () {
            var real = heroSwiper.realIndex;
            var thumbs = document.querySelectorAll('.hero-thumb');
            for (var i = 0; i < thumbs.length; i++) {
                if (i === real) {
                    thumbs[i].classList.add('active');
                } else {
                    thumbs[i].classList.remove('active');
                }
            }
        }, 100);
    }
}

// Global helper for hero thumbnail clicks
function heroSlideTo(index) {
    if (heroSwiper) heroSwiper.slideToLoop(index);
}

function getHeroSlideHTML(movie, index) {
    var bg = movie.poster_url || movie.thumb_url || '';
    var alias = movie.origin_name || (movie.year ? String(movie.year) : '');
    var tags = [movie.quality, movie.current_episode, movie.year].filter(Boolean).map(function (t) {
        return '<span class="tag-classic">' + escapeHtml(t) + '</span>';
    }).join('');
    var genreTags = (movie.categoryNames || []).slice(0, 4).map(function (c) {
        return '<span class="tag-topic">' + escapeHtml(c) + '</span>';
    }).join('');

    var html = '';
    html += '<div class="swiper-slide">';
    html += '<div class="hero-slide">';
    html += '<div class="hero-bg" style="background-image:url(\'' + bg + '\')"></div>';
    html += '<div class="hero-cover"><img src="' + bg + '" alt="' + escapeHtml(movie.name) + '" /></div>';
    html += '<div class="hero-content">';
    html += '<h2 class="media-title">' + escapeHtml(movie.name || '') + '</h2>';
    if (alias) {
        html += '<h3 class="media-alias-title">' + escapeHtml(alias) + '</h3>';
    }
    if (tags) {
        html += '<div class="hl-tags">' + tags + '</div>';
    }
    if (genreTags) {
        html += '<div class="hl-tags">' + genreTags + '</div>';
    }
    if (movie.content) {
        html += '<p class="hero-desc lim-3">' + escapeHtml(stripHtml(movie.content)) + '</p>';
    }
    html += '<div class="touch">';
    html += '<button class="button-play" onclick="showMovieDetail(\'' + movie.slug + '\')" title="Xem phim"><i class="fas fa-play"></i></button>';
    html += '<div class="touch-group">';
    html += '<button class="item" onclick="showMovieDetail(\'' + movie.slug + '\')" title="Chi tiết"><i class="fas fa-circle-info"></i></button>';
    html += '</div>';
    html += '</div>';
    html += '</div>';
    html += '</div>';
    html += '</div>';
    return html;
}

function getHeroThumbHTML(movie, index) {
    var src = getVerticalImage(movie.poster_url);
    return '<div class="hero-thumb" onclick="heroSlideTo(' + index + ')"><img src="' + src + '" alt="" loading="lazy" onerror="this.src=placeholderImg(100,68,\'\')"></div>';
}

function getSourceName(sourceKey) {
    if (!sourceKey) return '';
    if (typeof SOURCES !== 'undefined' && SOURCES[sourceKey]) {
        return SOURCES[sourceKey].name || sourceKey;
    }
    return sourceKey;
}

function getHomeCardHTML(movie) {
    var name = movie.name || movie.title || 'Không rõ';
    var alias = movie.origin_name || (movie.year ? String(movie.year) : '');
    var quality = movie.quality || 'HD';
    var badge = movie.source ? getSourceName(movie.source) : quality;
    var epLabel = movie.current_episode || (movie.year ? String(movie.year) : '');

    var html = '';
    html += '<div class="swiper-slide">';
    html += '<a href="movie-detail.html?slug=' + encodeURIComponent(movie.slug) + '" class="sw-item" onclick="handleMovieCardClick(event, \'' + movie.slug + '\', \'' + (movie.source || '') + '\')">';
    html += '<span class="v-thumbnail">';
    html += '<span class="thumb"><img src="' + getVerticalImage(movie.poster_url) + '" alt="' + escapeHtml(name) + '" loading="lazy" decoding="async" onerror="this.src=placeholderImg(300,450,\'No Poster\')"></span>';
    html += '<span class="badge-quality">' + escapeHtml(badge) + '</span>';
    if (epLabel) {
        html += '<span class="pin-new"><span class="line-center">' + escapeHtml(epLabel) + '</span></span>';
    }
    html += '</span>';
    html += '<div class="info">';
    html += '<h4 class="item-title lim-1">' + escapeHtml(name) + '</h4>';
    html += '<h4 class="alias-title lim-1">' + escapeHtml(alias) + '</h4>';
    html += '</div>';
    html += '</a>';
    html += '</div>';
    return html;
}

function renderRowSection(row, movies, opts) {
    if (!opts) opts = {};
    var container = document.getElementById('homeRows');
    if (!container || movies.length === 0) return null;

    var section = document.createElement('section');
    section.className = 'home-section';
    section.id = 'home-' + row.key;

    var catMore = row.moreHref
        ? '<div class="cat-more"><a href="' + row.moreHref + '">Xem thêm <i class="fas fa-chevron-right"></i></a></div>'
        : '';

    var html = '';
    html += '<div class="row-header">';
    html += '<h2 class="category-name">' + escapeHtml(row.name) + '</h2>';
    html += catMore;
    html += '</div>';
    html += '<div class="row-content">';
    html += '<div class="home-carousel-wrap">';
    html += '<button class="sw-button sw-prev" id="swiper-' + row.key + '-prev" title="Xem trước"><i class="fas fa-chevron-left"></i></button>';
    html += '<div class="swiper home-carousel" id="swiper-' + row.key + '">';
    html += '<div class="swiper-wrapper">' + movies.map(function (m) { return getHomeCardHTML(m); }).join('') + '</div>';
    html += '</div>';
    html += '<button class="sw-button sw-next" id="swiper-' + row.key + '-next" title="Xem tiếp"><i class="fas fa-chevron-right"></i></button>';
    html += '</div>';
    html += '</div>';

    section.innerHTML = html;
    container.appendChild(section);
    return initCarousel('swiper-' + row.key, opts);
}

function initCarousel(id, opts) {
    if (!opts) opts = {};
    var loop = opts.loop !== undefined ? opts.loop : true;
    var el = document.getElementById(id);
    if (!el || typeof Swiper === 'undefined') return null;

    return new Swiper('#' + id, {
        loop: loop,
        slidesPerView: 3,
        spaceBetween: 12,
        navigation: { nextEl: '#' + id + '-next', prevEl: '#' + id + '-prev' },
        breakpoints: {
            640: { slidesPerView: 4 },
            768: { slidesPerView: 5 },
            1024: { slidesPerView: 6 },
            1280: { slidesPerView: 7 },
            1536: { slidesPerView: 8 }
        }
    });
}

function loadCategoryRows() {
    var index = 0;
    function processNext() {
        if (index >= HOME_CATEGORY_ROWS.length) return Promise.resolve();
        var row = HOME_CATEGORY_ROWS[index];
        index++;
        return fetchJSONCached(getApiUrl(API_BASE + buildHomeEndpoint(row) + '?page=1'))
            .then(function (data) {
                if (data.status !== 'success' && data.status !== true) return processNext();
                var rawItems = data.items || (data.data && data.data.items) || [];
                var movies = rawItems.map(function (item) { return normalizeMovieData(item); }).filter(Boolean);
                if (movies.length === 0) return processNext();
                swipers[row.key] = renderRowSection({ key: row.key, name: row.name, moreHref: row.moreHref }, movies);
                return processNext();
            })
            .catch(function (error) {
                console.warn('Skip row ' + row.key + ':', error);
                return processNext();
            });
    }
    return processNext();
}

// Infinite scroll for "Phim mới cập nhật"
function handleInfiniteScroll() {
    if (searchMode) return;
    var doc = document.documentElement;
    if (window.innerHeight + window.scrollY >= doc.scrollHeight - 600) {
        loadMoreNewMovies();
    }
}

function loadMoreNewMovies() {
    if (newMoviesLoading || newMoviesPage >= newMoviesTotalPages) return;
    newMoviesLoading = true;
    var nextPage = newMoviesPage + 1;
    return fetchJSONCached(getApiUrl(API_BASE + currentSource.endpoints.new + '?page=' + nextPage))
        .then(function (data) {
            if (data.status === 'success' || data.status === true) {
                var rawItems = data.items || (data.data && data.data.items) || [];
                var movies = rawItems.map(function (item) { return normalizeMovieData(item); }).filter(Boolean);
                if (movies.length === 0) {
                    newMoviesTotalPages = newMoviesPage;
                    return;
                }
                var swiper = swipers['new'];
                if (swiper && movies.length > 0) {
                    swiper.appendSlide(movies.map(function (m) { return getHomeCardHTML(m); }).join(''));
                    swiper.update();
                    newMoviesPage = nextPage;
                }
                var pagination = normalizePagination(data);
                if (pagination && pagination.total_page) newMoviesTotalPages = pagination.total_page;
            }
        })
        .catch(function (error) {
            console.error('Error loading more new movies:', error);
        })
        .then(function () {
            newMoviesLoading = false;
        }, function () {
            newMoviesLoading = false;
        });
}

/* ============================== PERSONAL ROWS ============================== */

function loadRecentWatched() {
    if (!currentUser) return Promise.resolve();
    if (historyRowRendered) return Promise.resolve();
    historyRowRendered = true;
    if (document.getElementById('home-history')) return Promise.resolve();
    return db.collection('users').doc(currentUser.uid).collection('watchHistory').orderBy('watchedAt', 'desc').get()
        .then(function (snapshot) {
            var items = [];
            snapshot.forEach(function (doc) { items.push(doc.data()); });
            if (items.length === 0) return;

            var movies = items.map(function (item) {
                return {
                    slug: item.movieSlug || '',
                    name: item.movieTitle || item.movieSlug || 'Không rõ',
                    title: item.movieTitle || item.movieSlug || '',
                    poster_url: item.poster_url || item.thumb_url || '',
                    origin_name: item.episodeName || '',
                    source: item.source || '',
                    quality: 'HD',
                    current_episode: item.episodeName || ''
                };
            }).filter(function (m) { return m.slug; });

            renderRowSection({ key: 'history', name: 'Xem tiếp của bạn', moreHref: 'watch-history.html' }, movies, { loop: false });
        })
        .catch(function (error) {
            console.error('Error loading recent watched:', error);
        });
}

function loadPinnedMovies() {
    if (pinnedRowRendered) return Promise.resolve();
    pinnedRowRendered = true;
    if (document.getElementById('home-pinned')) return Promise.resolve();
    var attempts = 0;
    function waitForPinned() {
        if (pinnedMovies.length > 0 || attempts >= 20) return Promise.resolve();
        attempts++;
        return new Promise(function (resolve) {
            setTimeout(function () {
                resolve(waitForPinned());
            }, 100);
        });
    }
    return waitForPinned().then(function () {
        if (pinnedMovies.length === 0) return;

        var movies = pinnedMovies.map(function (pin) {
            return {
                slug: pin.slug || '',
                name: pin.title || pin.name || 'Không rõ',
                title: pin.title || pin.name || '',
                poster_url: pin.thumb_url || pin.poster_url || '',
                origin_name: pin.year ? String(pin.year) : '',
                source: pin.source || '',
                quality: 'HD',
                current_episode: ''
            };
        }).filter(function (m) { return m.slug; });

        if (movies.length === 0) return;
        renderRowSection({ key: 'pinned', name: 'Phim đã ghim' }, movies, { loop: false });
    });
}

/* ============================== SEARCH ============================== */

function showSearchMode() {
    searchMode = true;
    var hero = document.getElementById('heroSection');
    var home = document.getElementById('homeContent');
    var results = document.getElementById('searchResultsSection');
    if (hero) hero.classList.add('hidden');
    if (home) home.classList.add('hidden');
    if (results) results.classList.remove('hidden');
}

function searchMovies(keyword, page) {
    if (!page) page = 1;
    searchQuery = keyword;
    currentPage = page;
    showSearchMode();

    var titleEl = document.getElementById('searchResultsTitle');
    if (titleEl) titleEl.textContent = 'Kết quả tìm kiếm: "' + keyword + '"';

    var loading = document.getElementById('loading');
    if (loading) loading.classList.remove('hidden');

    var url = new URL(window.location);
    url.searchParams.set('search', keyword);
    url.searchParams.set('page', page);
    window.history.pushState({}, '', url);

    return fetchJSONCached(getApiUrl(API_BASE + currentSource.endpoints.search + '?keyword=' + encodeURIComponent(keyword) + '&page=' + page))
        .then(function (data) {
            if (data.status === 'success' || data.status === true) {
                var rawItems = data.items || (data.data && data.data.items) || [];
                var movies = rawItems.map(function (item) { return normalizeMovieData(item); }).filter(Boolean);
                displayMovies(movies);
                var pagination = normalizePagination(data);
                if (pagination) {
                    currentPage = pagination.current_page;
                    displayPagination(pagination);
                } else {
                    var paginationEl = document.getElementById('pagination');
                    if (paginationEl) paginationEl.innerHTML = '';
                }

                setTimeout(function () {
                    var moviesContainer = document.getElementById('moviesContainer');
                    if (moviesContainer) {
                        var header = document.querySelector('header');
                        var headerHeight = header ? header.offsetHeight : 0;
                        var top = moviesContainer.getBoundingClientRect().top + window.pageYOffset - headerHeight - 10;
                        window.scrollTo({ top: top, behavior: 'smooth' });
                    }
                }, 100);
            } else {
                showError('Không tìm thấy kết quả');
                showNoResultsMessage();
            }
        })
        .catch(function (error) {
            console.error('Error searching:', error);
            showError('Lỗi kết nối đến server');
            showNoResultsMessage();
        })
        .then(function () {
            if (loading) loading.classList.add('hidden');
        }, function () {
            if (loading) loading.classList.add('hidden');
        });
}

function showNoResultsMessage() {
    var noResults = document.getElementById('noResults');
    var moviesContainer = document.getElementById('moviesContainer');
    if (noResults) noResults.classList.remove('hidden');
    if (moviesContainer) moviesContainer.classList.add('hidden');
}

// Display pagination
function displayPagination(pagination) {
    _renderPagination(pagination, 'changePage({page})');
}

// Change page
function changePage(page) {
    currentPage = page;
    if (searchQuery) {
        searchMovies(searchQuery, page);
    }
}
