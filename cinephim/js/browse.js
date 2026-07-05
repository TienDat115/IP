// CinePhim - Browse (Advanced Search) Page JavaScript

let currentPage = 1;
let currentCategory = '';
let currentCountry = '';
let totalPages = 1;
let categoryNameMap = {};
let countryNameMap = {};
let lastCheckedRadios = {};


document.addEventListener('DOMContentLoaded', async function() {
    await Promise.all([loadCategories(), loadCountries()]);
    setupEventListeners();
    setupSearchListeners();

    const urlParams = new URLSearchParams(window.location.search);
    const category = urlParams.get('category');
    const country = urlParams.get('country');
    const page = urlParams.get('page');

    if (category) {
        const radio = document.querySelector(`input[name="category"][value="${category}"]`);
        if (radio) {
            radio.checked = true;
            lastCheckedRadios.category = radio;
        }
    }
    if (country) {
        const radio = document.querySelector(`input[name="country"][value="${country}"]`);
        if (radio) {
            radio.checked = true;
            lastCheckedRadios.country = radio;
        }
    }

    if (category || country) {
        loadFilteredMovies(page ? parseInt(page) : 1);
    }
});


async function loadCategories() {
    const container = document.getElementById('categoriesContainer');
    if (!container) return;

    let categories = [];

    if (currentSourceKey === 'ophim') {
        try {
            const data = await fetchJSONCached(getApiUrl(`${API_BASE}${currentSource.endpoints.category}`));
            if (data.status === 'success' && data.data?.items) {
                categories = data.data.items.map(item => ({
                    slug: item.slug,
                    name: item.name
                }));
            }
        } catch (error) {
            console.warn('Failed to load categories from API, using fallback:', error);
        }
    }

    if (currentSourceKey === 'kkphim') {
        try {
            const data = await fetchJSONCached(getApiUrl(`${API_BASE}${currentSource.endpoints.category}`));
            if (Array.isArray(data) && data.length > 0) {
                categories = data.map(item => ({
                    slug: item.slug,
                    name: item.name
                }));
            }
        } catch (error) {
            console.warn('Failed to load categories from API, using fallback:', error);
        }
    }

    if (categories.length === 0) {
        categories = NGONC_CATEGORIES;
    }

    categoryNameMap = {};
    categories.forEach(cat => { categoryNameMap[cat.slug] = cat.name; });

    container.innerHTML = categories.map(cat => `
        <label class="flex items-center space-x-2 cursor-pointer hover:bg-gray-600 p-2 rounded transition">
            <input type="radio" name="category" value="${cat.slug}" class="w-4 h-4 text-purple-600 bg-gray-600 border-gray-500 rounded focus:ring-purple-500" />
            <span class="text-white">${cat.name}</span>
        </label>
    `).join('');
}


async function loadCountries() {
    const container = document.getElementById('countriesContainer');
    if (!container) return;

    let countries = [];

    if (currentSourceKey === 'ophim') {
        try {
            const data = await fetchJSONCached(getApiUrl(`${API_BASE}${currentSource.endpoints.country}`));
            if (data.status === 'success' && data.data?.items) {
                countries = data.data.items.map(item => ({
                    slug: item.slug,
                    name: item.name
                }));
            }
        } catch (error) {
            console.warn('Failed to load countries from API, using fallback:', error);
        }
    }

    if (currentSourceKey === 'kkphim') {
        try {
            const data = await fetchJSONCached(getApiUrl(`${API_BASE}${currentSource.endpoints.country}`));
            if (Array.isArray(data) && data.length > 0) {
                countries = data.map(item => ({
                    slug: item.slug,
                    name: item.name
                }));
            }
        } catch (error) {
            console.warn('Failed to load countries from API, using fallback:', error);
        }
    }

    if (countries.length === 0) {
        countries = NGUONC_COUNTRIES;
    }

    countryNameMap = {};
    countries.forEach(c => { countryNameMap[c.slug] = c.name; });

    container.innerHTML = countries.map(c => `
        <label class="flex items-center space-x-2 cursor-pointer hover:bg-gray-600 p-2 rounded transition">
            <input type="radio" name="country" value="${c.slug}" class="w-4 h-4 text-purple-600 bg-gray-600 border-gray-500 rounded focus:ring-purple-500" />
            <span class="text-white">${c.name}</span>
        </label>
    `).join('');
}


function updateRadioGroup(group) {
    const container = group === 'category'
        ? document.getElementById('categoriesContainer')
        : document.getElementById('countriesContainer');
    if (!container) return;
    const labels = container.querySelectorAll('label');
    labels.forEach(label => {
        const radio = label.querySelector('input[type="radio"]');
        if (!radio) return;
        const isChecked = lastCheckedRadios[group] === radio;
        radio.checked = isChecked;
    });
}

function setupEventListeners() {
    document.getElementById('categoriesContainer')?.addEventListener('click', function(e) {
        const label = e.target.closest('label');
        if (!label) return;
        const radio = label.querySelector('input[type="radio"]');
        if (!radio) return;
        e.preventDefault();

        if (lastCheckedRadios.category === radio) {
            lastCheckedRadios.category = null;
        } else {
            lastCheckedRadios.category = radio;
        }
        updateRadioGroup('category');
        loadFilteredMovies(1);
    });

    document.getElementById('countriesContainer')?.addEventListener('click', function(e) {
        const label = e.target.closest('label');
        if (!label) return;
        const radio = label.querySelector('input[type="radio"]');
        if (!radio) return;
        e.preventDefault();

        if (lastCheckedRadios.country === radio) {
            lastCheckedRadios.country = null;
        } else {
            lastCheckedRadios.country = radio;
        }
        updateRadioGroup('country');
        loadFilteredMovies(1);
    });
}


async function loadFilteredMovies(page = 1) {
    const selectedCategory = document.querySelector('input[name="category"]:checked');
    const category = selectedCategory ? selectedCategory.value : '';
    const selectedCountry = document.querySelector('input[name="country"]:checked');
    const country = selectedCountry ? selectedCountry.value : '';

    if (!category && !country) {
        document.getElementById('moviesGrid').innerHTML = '';
        document.getElementById('pagination').innerHTML = '';
        hideFilterNotice();
        return;
    }

    try {
        showPageLoading(true);
        hidePageNoResults();
        hideFilterNotice();

        currentCategory = category;
        currentCountry = country;
        currentPage = page;

        const url = new URL(window.location);
        if (category) url.searchParams.set('category', category);
        else url.searchParams.delete('category');
        if (country) url.searchParams.set('country', country);
        else url.searchParams.delete('country');
        url.searchParams.set('page', page);
        window.history.pushState({}, '', url);

        window.scrollTo(0, 0);

        let movies = [];
        let pagination = null;
        let data = null;

        if (category && country) {
            if (currentSourceKey === 'nguonc') {
                showSourceUnsupportedNotice();
                let endpoint = `/films/the-loai/${category}`;
                data = await fetchJSONCached(getApiUrl(`${API_BASE}${endpoint}?page=${page}`));
                if (data.status === 'success' || data.status === true) {
                    const pathImage = data.pathImage || '';
                    movies = (data.items || []).map(item => normalizeMovieData(item, pathImage));
                    pagination = normalizePagination(data);
                }
            } else {
                let endpoint = `${currentSource.endpoints.category}/${category}`;
                if (currentSourceKey === 'kkphim') {
                    endpoint = `/v1/api/the-loai/${category}`;
                }

                data = await fetchJSONCached(getApiUrl(`${API_BASE}${endpoint}?page=${page}`));

                if (data.status === 'success' || data.status === true) {
                    const pathImage = data.pathImage || data.data?.pathImage || data.data?.APP_DOMAIN_CDN_IMAGE || '';
                    const allMovies = (data.items || data.data?.items || []).map(item => normalizeMovieData(item, pathImage));
                    pagination = normalizePagination(data);

                    movies = allMovies.filter(movie => {
                        return movie.country && movie.country.some(c => c.slug === country);
                    });

                    showFilterNotice(category, country);
                }
            }

        } else if (category) {
            let endpoint = `${currentSource.endpoints.category}/${category}`;
            if (currentSourceKey === 'nguonc') {
                endpoint = `/films/the-loai/${category}`;
            } else if (currentSourceKey === 'kkphim') {
                endpoint = `/v1/api/the-loai/${category}`;
            }

            data = await fetchJSONCached(getApiUrl(`${API_BASE}${endpoint}?page=${page}`));

            if (data.status === 'success' || data.status === true) {
                const pathImage = data.pathImage || data.data?.pathImage || data.data?.APP_DOMAIN_CDN_IMAGE || '';
                movies = (data.items || data.data?.items || []).map(item => normalizeMovieData(item, pathImage));
                pagination = normalizePagination(data);
            }

        } else if (country) {
            let endpoint = `${currentSource.endpoints.country}/${country}`;
            if (currentSourceKey === 'nguonc') {
                endpoint = `/films/quoc-gia/${country}`;
            } else if (currentSourceKey === 'kkphim') {
                endpoint = `/v1/api/quoc-gia/${country}`;
            }

            data = await fetchJSONCached(getApiUrl(`${API_BASE}${endpoint}?page=${page}`));

            if (data.status === 'success' || data.status === true) {
                const pathImage = data.pathImage || data.data?.pathImage || data.data?.APP_DOMAIN_CDN_IMAGE || '';
                movies = (data.items || data.data?.items || []).map(item => normalizeMovieData(item, pathImage));
                pagination = normalizePagination(data);
            }
        }

        if (data && (data.status === 'success' || data.status === true)) {
            if (movies.length > 0) {
                displayMovies(movies);
            } else {
                showPageNoResults();
            }

            updatePagination(pagination);

            const catName = getCategoryDisplayName(category);
            const ctryName = getCountryDisplayName(country);
            document.title = buildPageTitle(catName, ctryName);
            updateBreadcrumb(catName, ctryName);

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
            showPageNoResults();
        }

        showPageLoading(false);

    } catch (error) {
        console.error('Error loading filtered movies:', error);
        showError('Không thể tải danh sách phim. Vui lòng thử lại.');
        showPageLoading(false);
    }
}


function updatePagination(paginate) {
    if (!paginate) { document.getElementById('pagination').innerHTML = ''; return; }
    const { current_page: current, total_page: total } = paginate;
    currentPage = current;
    totalPages = total;
    _renderPagination(paginate, 'loadFilteredMovies({page})');
    const url = new URL(window.location);
    url.searchParams.set('page', current);
    window.history.pushState({}, '', url);
}


function getCategoryDisplayName(slug) {
    return slug ? (categoryNameMap[slug] || slug) : '';
}

function getCountryDisplayName(slug) {
    return slug ? (countryNameMap[slug] || slug) : '';
}


function buildPageTitle(catName, ctryName) {
    if (catName && ctryName) return `Phim ${catName} ${ctryName} - CinePhim`;
    if (catName) return `Phim ${catName} - CinePhim`;
    if (ctryName) return `Phim ${ctryName} - CinePhim`;
    return 'Tìm Phim Nâng Cao - CinePhim';
}


function updateBreadcrumb(catName, ctryName) {
    const breadcrumbContainer = document.getElementById('breadcrumb');
    if (!breadcrumbContainer) return;

    let html = `
        <a href="index.html" class="hover:text-purple-400 transition">Trang chủ</a>
        <i class="fas fa-chevron-right text-xs"></i>
        <span class="text-white">Tìm phim nâng cao</span>
    `;

    if (catName) {
        html += `
            <i class="fas fa-chevron-right text-xs"></i>
            <span class="text-white">${catName}</span>
        `;
    }

    if (ctryName) {
        html += `
            <i class="fas fa-chevron-right text-xs"></i>
            <span class="text-white">${ctryName}</span>
        `;
    }

    breadcrumbContainer.innerHTML = html;
}


function showFilterNotice(category, country) {
    const notice = document.getElementById('filterNotice');
    const noticeText = document.getElementById('filterNoticeText');
    if (!notice || !noticeText) return;

    const catName = getCategoryDisplayName(category);
    const ctryName = getCountryDisplayName(country);
    noticeText.textContent = `Đang lọc phim "${catName}" từ "${ctryName}" (trang ${currentPage}). Kết quả hiển thị trong phạm vi trang hiện tại.`;
    notice.classList.remove('hidden');
}

function showSourceUnsupportedNotice() {
    const notice = document.getElementById('filterNotice');
    const noticeText = document.getElementById('filterNoticeText');
    if (!notice || !noticeText) return;

    noticeText.innerHTML = `Nguồn <strong>${currentSource.name}</strong> không hỗ trợ lọc kết hợp. Chỉ hiển thị kết quả theo thể loại. Vui lòng đổi sang nguồn <strong>OPhim</strong> hoặc <strong>KKPhim</strong> ở góc trên bên phải.`;
    notice.classList.remove('hidden');
}

function hideFilterNotice() {
    const notice = document.getElementById('filterNotice');
    if (notice) notice.classList.add('hidden');
}
