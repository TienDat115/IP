// CinePhim - Index Page JavaScript (RoPhim-style homepage)

let currentPage = 1;
let searchQuery = '';
let searchMode = false;

let newMoviesPage = 1;
let newMoviesTotalPages = 1;
let newMoviesLoading = false;

const swipers = {};
let heroSwiper = null;
let scrollTimeout = null;

let historyRowRendered = false;
let pinnedRowRendered = false;

const HOME_CATEGORY_ROWS = [
    { key: 'phim-le', type: 'type', slug: 'phim-le', name: 'Phim Lẻ', moreHref: 'single-movies.html' },
    { key: 'trung-quoc', type: 'country', slug: 'trung-quoc', name: 'Phim Trung Quốc', moreHref: 'browse.html?country=trung-quoc' },
    { key: 'viet-nam', type: 'country', slug: 'viet-nam', name: 'Phim Việt Nam', moreHref: 'browse.html?country=viet-nam' },
    { key: 'hoat-hinh', type: 'category', slug: 'hoat-hinh', name: 'Phim Hoạt Hình', moreHref: 'browse.html?category=hoat-hinh' }
];

function escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Initialize page
document.addEventListener('DOMContentLoaded', async function () {
    await window.ensureConfigReady();

    const urlParams = new URLSearchParams(window.location.search);
    const search = urlParams.get('search');

    setupEventListeners();
    setupSearchListeners();

    // Listen for auth ready to load personal rows
    document.addEventListener('cinephim:auth-ready', () => {
        loadRecentWatched();
        loadPinnedMovies();
    });

    if (search) {
        searchMovies(search, 1);
    } else {
        await loadHome();
    }
});

// Setup event listeners
function setupEventListeners() {
    const searchInput = document.getElementById('searchInput');
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

async function loadHome() {
    await loadRecentWatched();
    await loadPinnedMovies();
    await loadNewMoviesRow();
    await loadCategoryRows();
}

// Build endpoint for a home row (new / type / category)
function buildHomeEndpoint(row) {
    if (row.type === 'new') return currentSource.endpoints.new;
    if (row.type === 'type') {
        if (currentSourceKey === 'nguonc') return `/films/${row.slug}`;
        if (currentSourceKey === 'kkphim') return `/v1/api/danh-sach/${row.slug}`;
        return `/danh-sach/${row.slug}`;
    }
    // category
    if (row.type === 'category') {
        if (currentSourceKey === 'nguonc') return `/films/the-loai/${row.slug}`;
        if (currentSourceKey === 'kkphim') return `/v1/api/the-loai/${row.slug}`;
        return `/the-loai/${row.slug}`;
    }
    // country
    if (currentSourceKey === 'nguonc') return `/films/quoc-gia/${row.slug}`;
    if (currentSourceKey === 'kkphim') return `/v1/api/quoc-gia/${row.slug}`;
    return `${currentSource.endpoints.country}/${row.slug}`;
}

// New movies row + hero slider
async function loadNewMoviesRow() {
    try {
        const data = await fetchJSONCached(getApiUrl(`${API_BASE}${currentSource.endpoints.new}?page=1`));
        if (data.status !== 'success' && data.status !== true) return;

        const movies = (data.items || data.data?.items || []).map(item => normalizeMovieData(item)).filter(Boolean);
        if (movies.length === 0) return;

        const pagination = normalizePagination(data);
        if (pagination) {
            newMoviesPage = pagination.current_page || 1;
            newMoviesTotalPages = pagination.total_page || 999;
        } else {
            newMoviesTotalPages = 999;
        }

        renderHero(await enhanceHeroMovies(movies.slice(0, 5)));
        swipers['new'] = renderRowSection({ key: 'new', name: 'Phim mới cập nhật', moreHref: 'new-movies.html' }, movies, { loop: false });
    } catch (error) {
        console.error('Error loading new movies:', error);
    }
}

// Fetch details for hero movies to enrich description + categories
async function enhanceHeroMovies(movies) {
    if (movies.length === 0) return movies;
    const results = await Promise.allSettled(movies.map(async (movie) => {
        try {
            const data = await fetchJSONCached(getApiUrl(`${API_BASE}${currentSource.endpoints.detail}/${movie.slug}`));
            const raw = data.movie || data.item || data.data?.item;
            if (raw) {
                const norm = normalizeMovieData(raw);
                return { ...movie, ...norm, categoryNames: extractCategoryNames(norm.category) };
            }
        } catch (e) { /* ignore */ }
        return movie;
    }));
    return results.map(r => (r.status === 'fulfilled' && r.value ? r.value : null)).filter(Boolean);
}

function extractCategoryNames(category) {
    if (!category) return [];
    if (Array.isArray(category)) {
        const hasNesting = category.some(item => item.group || item.list);
        if (hasNesting) {
            return category
                .filter(item => item.group && item.group.name === 'Thể loại')
                .flatMap(item => (item.list ? item.list.map(c => c.name).filter(Boolean) : []));
        }
        return category.map(c => c.name).filter(Boolean);
    }
    if (category.list && Array.isArray(category.list)) {
        return category.list.map(c => c.name).filter(Boolean);
    }
    return [];
}

function renderHero(heroMovies) {
    const heroSection = document.getElementById('heroSection');
    const wrapper = document.getElementById('heroWrapper');
    const thumbsContainer = document.getElementById('heroThumbs');
    if (!heroSection || !wrapper || heroMovies.length === 0) return;

    wrapper.innerHTML = heroMovies.map((m, i) => getHeroSlideHTML(m, i)).join('');
    if (thumbsContainer) {
        thumbsContainer.innerHTML = heroMovies.map((m, i) => getHeroThumbHTML(m, i)).join('');
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
                const real = this.realIndex;
                document.querySelectorAll('.hero-thumb').forEach((el, i) => {
                    el.classList.toggle('active', i === real);
                });
            }
        }
    });

    // Sync active thumb on init
    if (heroSwiper) {
        setTimeout(() => {
            const real = heroSwiper.realIndex;
            document.querySelectorAll('.hero-thumb').forEach((el, i) => {
                el.classList.toggle('active', i === real);
            });
        }, 100);
    }
}

// Global helper for hero thumbnail clicks
function heroSlideTo(index) {
    if (heroSwiper) heroSwiper.slideToLoop(index);
}

function getHeroSlideHTML(movie, index) {
    const bg = movie.poster_url || movie.thumb_url || '';
    const alias = movie.origin_name || (movie.year ? String(movie.year) : '');
    const tags = [movie.quality, movie.current_episode, movie.year].filter(Boolean).map(t => `<span class="tag-classic">${escapeHtml(t)}</span>`).join('');
    const genreTags = (movie.categoryNames || []).slice(0, 4).map(c => `<span class="tag-topic">${escapeHtml(c)}</span>`).join('');

    return `
        <div class="swiper-slide">
            <div class="hero-slide">
                <div class="hero-bg" style="background-image:url('${bg}')"></div>
                <div class="hero-cover"><img src="${bg}" alt="${escapeHtml(movie.name)}" /></div>
                <div class="hero-content">
                    <h2 class="media-title">${escapeHtml(movie.name || '')}</h2>
                    ${alias ? `<h3 class="media-alias-title">${escapeHtml(alias)}</h3>` : ''}
                    ${tags ? `<div class="hl-tags">${tags}</div>` : ''}
                    ${genreTags ? `<div class="hl-tags">${genreTags}</div>` : ''}
                    ${movie.content ? `<p class="hero-desc lim-3">${escapeHtml(stripHtml(movie.content))}</p>` : ''}
                    <div class="touch">
                        <button class="button-play" onclick="showMovieDetail('${movie.slug}')" title="Xem phim"><i class="fas fa-play"></i></button>
                        <div class="touch-group">
                            <button class="item" onclick="showMovieDetail('${movie.slug}')" title="Chi tiết"><i class="fas fa-circle-info"></i></button>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
}

function getHeroThumbHTML(movie, index) {
    const src = getVerticalImage(movie.poster_url);
    return `<div class="hero-thumb" onclick="heroSlideTo(${index})"><img src="${src}" alt="" loading="lazy" onerror="this.src=placeholderImg(100,68,'')"></div>`;
}

function getSourceName(sourceKey) {
    if (!sourceKey) return '';
    if (typeof SOURCES !== 'undefined' && SOURCES[sourceKey]) {
        return SOURCES[sourceKey].name || sourceKey;
    }
    return sourceKey;
}

function getHomeCardHTML(movie) {
    const name = movie.name || movie.title || 'Không rõ';
    const alias = movie.origin_name || (movie.year ? String(movie.year) : '');
    const quality = movie.quality || 'HD';
    const badge = movie.source ? getSourceName(movie.source) : quality;
    const epLabel = movie.current_episode || (movie.year ? String(movie.year) : '');
    return `
        <div class="swiper-slide">
            <a href="movie-detail.html?slug=${encodeURIComponent(movie.slug)}" class="sw-item" onclick="handleMovieCardClick(event, '${movie.slug}', '${movie.source || ''}')">
                <span class="v-thumbnail">
                    <span class="thumb"><img src="${getVerticalImage(movie.poster_url)}" alt="${escapeHtml(name)}" loading="lazy" decoding="async" onerror="this.src=placeholderImg(300,450,'No Poster')"></span>
                    <span class="badge-quality">${escapeHtml(badge)}</span>
                    ${epLabel ? `<span class="pin-new"><span class="line-center">${escapeHtml(epLabel)}</span></span>` : ''}
                </span>
                <div class="info">
                    <h4 class="item-title lim-1">${escapeHtml(name)}</h4>
                    <h4 class="alias-title lim-1">${escapeHtml(alias)}</h4>
                </div>
            </a>
        </div>`;
}

function renderRowSection(row, movies, opts = {}) {
    const container = document.getElementById('homeRows');
    if (!container || movies.length === 0) return null;

    const section = document.createElement('section');
    section.className = 'home-section';
    section.id = `home-${row.key}`;

    const catMore = row.moreHref
        ? `<div class="cat-more"><a href="${row.moreHref}">Xem thêm <i class="fas fa-chevron-right"></i></a></div>`
        : '';

    section.innerHTML = `
        <div class="row-header">
            <h2 class="category-name">${escapeHtml(row.name)}</h2>
            ${catMore}
        </div>
        <div class="row-content">
            <div class="home-carousel-wrap">
                <button class="sw-button sw-prev" id="swiper-${row.key}-prev" title="Xem trước"><i class="fas fa-chevron-left"></i></button>
                <div class="swiper home-carousel" id="swiper-${row.key}">
                    <div class="swiper-wrapper">${movies.map(m => getHomeCardHTML(m)).join('')}</div>
                </div>
                <button class="sw-button sw-next" id="swiper-${row.key}-next" title="Xem tiếp"><i class="fas fa-chevron-right"></i></button>
            </div>
        </div>
    `;

    container.appendChild(section);
    return initCarousel(`swiper-${row.key}`, opts);
}

function initCarousel(id, { loop = true } = {}) {
    const el = document.getElementById(id);
    if (!el || typeof Swiper === 'undefined') return null;

    return new Swiper('#' + id, {
        loop: loop,
        slidesPerView: 3,
        spaceBetween: 12,
        navigation: { nextEl: `#${id}-next`, prevEl: `#${id}-prev` },
        breakpoints: {
            640: { slidesPerView: 4 },
            768: { slidesPerView: 5 },
            1024: { slidesPerView: 6 },
            1280: { slidesPerView: 7 },
            1536: { slidesPerView: 8 }
        }
    });
}

async function loadCategoryRows() {
    for (const row of HOME_CATEGORY_ROWS) {
        try {
            const data = await fetchJSONCached(getApiUrl(`${API_BASE}${buildHomeEndpoint(row)}?page=1`));
            if (data.status !== 'success' && data.status !== true) continue;
            const movies = (data.items || data.data?.items || []).map(item => normalizeMovieData(item)).filter(Boolean);
            if (movies.length === 0) continue;
            swipers[row.key] = renderRowSection({ key: row.key, name: row.name, moreHref: row.moreHref }, movies);
        } catch (error) {
            console.warn(`Skip row ${row.key}:`, error);
        }
    }
}

// Infinite scroll for "Phim mới cập nhật"
async function handleInfiniteScroll() {
    if (searchMode) return;
    const doc = document.documentElement;
    if (window.innerHeight + window.scrollY >= doc.scrollHeight - 600) {
        await loadMoreNewMovies();
    }
}

async function loadMoreNewMovies() {
    if (newMoviesLoading || newMoviesPage >= newMoviesTotalPages) return;
    newMoviesLoading = true;
    try {
        const nextPage = newMoviesPage + 1;
        const data = await fetchJSONCached(getApiUrl(`${API_BASE}${currentSource.endpoints.new}?page=${nextPage}`));
        if (data.status === 'success' || data.status === true) {
            const movies = (data.items || data.data?.items || []).map(item => normalizeMovieData(item)).filter(Boolean);
            if (movies.length === 0) {
                newMoviesTotalPages = newMoviesPage;
                return;
            }
            const swiper = swipers['new'];
            if (swiper && movies.length > 0) {
                swiper.appendSlide(movies.map(m => getHomeCardHTML(m)).join(''));
                swiper.update();
                newMoviesPage = nextPage;
            }
            const pagination = normalizePagination(data);
            if (pagination && pagination.total_page) newMoviesTotalPages = pagination.total_page;
        }
    } catch (error) {
        console.error('Error loading more new movies:', error);
    } finally {
        newMoviesLoading = false;
    }
}

/* ============================== PERSONAL ROWS ============================== */

async function loadRecentWatched() {
    if (!currentUser) return;
    if (historyRowRendered) return;
    historyRowRendered = true;
    if (document.getElementById('home-history')) return;
    try {
        const snapshot = await db.collection('users').doc(currentUser.uid).collection('watchHistory').orderBy('watchedAt', 'desc').get();
        const items = [];
        snapshot.forEach(doc => items.push(doc.data()));
        if (items.length === 0) return;

        const movies = items.map(item => ({
            slug: item.movieSlug || '',
            name: item.movieTitle || item.movieSlug || 'Không rõ',
            title: item.movieTitle || item.movieSlug || '',
            poster_url: item.poster_url || item.thumb_url || '',
            origin_name: item.episodeName || '',
            source: item.source || '',
            quality: 'HD',
            current_episode: item.episodeName || ''
        })).filter(m => m.slug);

        renderRowSection({ key: 'history', name: 'Xem tiếp của bạn', moreHref: 'watch-history.html' }, movies, { loop: false });
    } catch (error) {
        console.error('Error loading recent watched:', error);
    }
}

async function loadPinnedMovies() {
    if (pinnedRowRendered) return;
    pinnedRowRendered = true;
    if (document.getElementById('home-pinned')) return;
    let attempts = 0;
    while (pinnedMovies.length === 0 && attempts < 20) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
    }
    if (pinnedMovies.length === 0) return;

    const movies = pinnedMovies.map(pin => ({
        slug: pin.slug || '',
        name: pin.title || pin.name || 'Không rõ',
        title: pin.title || pin.name || '',
        poster_url: pin.thumb_url || pin.poster_url || '',
        origin_name: pin.year ? String(pin.year) : '',
        source: pin.source || '',
        quality: 'HD',
        current_episode: ''
    })).filter(m => m.slug);

    if (movies.length === 0) return;
    renderRowSection({ key: 'pinned', name: 'Phim đã ghim' }, movies, { loop: false });
}

/* ============================== SEARCH ============================== */

function showSearchMode() {
    searchMode = true;
    const hero = document.getElementById('heroSection');
    const home = document.getElementById('homeContent');
    const results = document.getElementById('searchResultsSection');
    if (hero) hero.classList.add('hidden');
    if (home) home.classList.add('hidden');
    if (results) results.classList.remove('hidden');
}

async function searchMovies(keyword, page = 1) {
    searchQuery = keyword;
    currentPage = page;
    showSearchMode();

    const titleEl = document.getElementById('searchResultsTitle');
    if (titleEl) titleEl.textContent = `Kết quả tìm kiếm: "${keyword}"`;

    const loading = document.getElementById('loading');
    if (loading) loading.classList.remove('hidden');

    const url = new URL(window.location);
    url.searchParams.set('search', keyword);
    url.searchParams.set('page', page);
    window.history.pushState({}, '', url);

    try {
        const data = await fetchJSONCached(getApiUrl(`${API_BASE}${currentSource.endpoints.search}?keyword=${encodeURIComponent(keyword)}&page=${page}`));
        if (data.status === 'success' || data.status === true) {
            const movies = (data.items || data.data?.items || []).map(item => normalizeMovieData(item)).filter(Boolean);
            displayMovies(movies);
            const pagination = normalizePagination(data);
            if (pagination) {
                currentPage = pagination.current_page;
                displayPagination(pagination);
            } else {
                const paginationEl = document.getElementById('pagination');
                if (paginationEl) paginationEl.innerHTML = '';
            }

            setTimeout(() => {
                const moviesContainer = document.getElementById('moviesContainer');
                if (moviesContainer) {
                    const header = document.querySelector('header');
                    const headerHeight = header ? header.offsetHeight : 0;
                    const top = moviesContainer.getBoundingClientRect().top + window.pageYOffset - headerHeight - 10;
                    window.scrollTo({ top, behavior: 'smooth' });
                }
            }, 100);
        } else {
            showError('Không tìm thấy kết quả');
            showNoResultsMessage();
        }
    } catch (error) {
        console.error('Error searching:', error);
        showError('Lỗi kết nối đến server');
        showNoResultsMessage();
    } finally {
        if (loading) loading.classList.add('hidden');
    }
}

function showNoResultsMessage() {
    const noResults = document.getElementById('noResults');
    const moviesContainer = document.getElementById('moviesContainer');
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
