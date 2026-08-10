// CinePhim - Browse (Advanced Search) Page JavaScript

let currentPage = 1;
let totalPages = 1;
let categoryNameMap = {};
let countryNameMap = {};
let selectedCategories = [];
let selectedCountries = [];
let selectedYears = [];
let yearNameMap = {};
let combinedMovies = [];
let combinedTotalPages = 1;
let isCombinedMode = false;
const COMBINED_PER_PAGE = 24;


document.addEventListener('DOMContentLoaded', async function() {
    await Promise.all([loadCategories(), loadCountries(), loadYears()]);
    setupEventListeners();
    setupSearchListeners();

    const urlParams = new URLSearchParams(window.location.search);
    const cats = urlParams.get('category');
    const countries = urlParams.get('country');
    const years = urlParams.get('year');
    const page = urlParams.get('page');

    if (cats) {
        cats.split(',').forEach(slug => {
            slug = slug.trim();
            if (slug && categoryNameMap[slug]) {
                const chip = document.querySelector(`.chip-btn[data-group="category"][data-value="${slug}"]`);
                if (chip) {
                    chip.classList.add('selected');
                    selectedCategories.push(slug);
                }
            }
        });
    }
    if (countries) {
        countries.split(',').forEach(slug => {
            slug = slug.trim();
            if (slug && countryNameMap[slug]) {
                const chip = document.querySelector(`.chip-btn[data-group="country"][data-value="${slug}"]`);
                if (chip) {
                    chip.classList.add('selected');
                    selectedCountries.push(slug);
                }
            }
        });
    }
    if (years) {
        years.split(',').forEach(slug => {
            slug = slug.trim();
            if (slug && yearNameMap[slug]) {
                const chip = document.querySelector(`.chip-btn[data-group="year"][data-value="${slug}"]`);
                if (chip) {
                    chip.classList.add('selected');
                    selectedYears.push(slug);
                }
            }
        });
    }

    if (selectedCategories.length > 0 || selectedCountries.length > 0 || selectedYears.length > 0) {
        const p = page ? parseInt(page) : 1;
        applyFilters(p);
    }
});


async function loadCategories() {
    const container = document.getElementById('categoriesContainer');
    if (!container) return;

    let categories = [];

    if (currentSourceKey === 'ophim' || currentSourceKey === 'vsmov') {
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
        <button class="chip-btn" data-group="category" data-value="${cat.slug}">${cat.name}</button>
    `).join('');
}


async function loadCountries() {
    const container = document.getElementById('countriesContainer');
    if (!container) return;

    let countries = [];

    if (currentSourceKey === 'ophim' || currentSourceKey === 'vsmov') {
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
        <button class="chip-btn" data-group="country" data-value="${c.slug}">${c.name}</button>
    `).join('');
}


function loadYears() {
    const container = document.getElementById('yearsContainer');
    if (!container) return;

    const years = NGONC_YEARS;

    yearNameMap = {};
    years.forEach(y => { yearNameMap[y.slug] = y.name; });

    container.innerHTML = years.map(y => `
        <button class="chip-btn" data-group="year" data-value="${y.slug}">${y.name}</button>
    `).join('');
}


function setupEventListeners() {
    document.getElementById('categoriesContainer')?.addEventListener('click', function(e) {
        const chip = e.target.closest('.chip-btn');
        if (!chip || chip.dataset.group !== 'category') return;

        const value = chip.dataset.value;
        if (chip.classList.contains('selected')) {
            chip.classList.remove('selected');
            selectedCategories = selectedCategories.filter(v => v !== value);
        } else {
            chip.classList.add('selected');
            selectedCategories.push(value);
        }
    });

    document.getElementById('countriesContainer')?.addEventListener('click', function(e) {
        const chip = e.target.closest('.chip-btn');
        if (!chip || chip.dataset.group !== 'country') return;

        const value = chip.dataset.value;
        if (chip.classList.contains('selected')) {
            chip.classList.remove('selected');
            selectedCountries = selectedCountries.filter(v => v !== value);
        } else {
            chip.classList.add('selected');
            selectedCountries.push(value);
        }
    });

    document.getElementById('yearsContainer')?.addEventListener('click', function(e) {
        const chip = e.target.closest('.chip-btn');
        if (!chip || chip.dataset.group !== 'year') return;

        const value = chip.dataset.value;
        if (chip.classList.contains('selected')) {
            chip.classList.remove('selected');
            selectedYears = selectedYears.filter(v => v !== value);
        } else {
            chip.classList.add('selected');
            selectedYears.push(value);
        }
    });

    document.getElementById('applyFilterBtn')?.addEventListener('click', () => applyFilters());
    document.getElementById('clearFilterBtn')?.addEventListener('click', clearFilters);
}


function applyFilters(page = 1) {
    if (selectedCategories.length === 0 && selectedCountries.length === 0 && selectedYears.length === 0) {
        showWarning('Vui lòng chọn ít nhất thể loại, quốc gia hoặc năm.');
        return;
    }

    const url = new URL(window.location);
    if (selectedCategories.length > 0) url.searchParams.set('category', selectedCategories.join(','));
    else url.searchParams.delete('category');
    if (selectedCountries.length > 0) url.searchParams.set('country', selectedCountries.join(','));
    else url.searchParams.delete('country');
    if (selectedYears.length > 0) url.searchParams.set('year', selectedYears.join(','));
    else url.searchParams.delete('year');
    url.searchParams.set('page', page);
    window.history.pushState({}, '', url);

    const catNames = selectedCategories.map(s => getCategoryDisplayName(s)).filter(Boolean);
    const ctryNames = selectedCountries.map(s => getCountryDisplayName(s)).filter(Boolean);
    const yearNames = selectedYears.map(s => getYearDisplayName(s)).filter(Boolean);
    document.title = buildPageTitle(catNames, ctryNames, yearNames);
    updateBreadcrumb(catNames, ctryNames, yearNames);

    loadFilteredMovies(page);
}


function clearFilters() {
    selectedCategories = [];
    selectedCountries = [];
    selectedYears = [];
    combinedMovies = [];
    isCombinedMode = false;
    combinedTotalPages = 1;
    document.querySelectorAll('.chip-btn.selected').forEach(el => el.classList.remove('selected'));

    const url = new URL(window.location);
    url.searchParams.delete('category');
    url.searchParams.delete('country');
    url.searchParams.delete('year');
    url.searchParams.delete('page');
    window.history.pushState({}, '', url);

    document.getElementById('moviesGrid').innerHTML = '';
    document.getElementById('pagination').innerHTML = '';
    hideFilterNotice();
    document.title = 'Tìm Phim Nâng Cao - CinePhim';
    updateBreadcrumb();
}


async function loadFilteredMovies(page = 1) {
    if (selectedCategories.length === 0 && selectedCountries.length === 0 && selectedYears.length === 0) return;

    const totalSelections = selectedCategories.length + selectedCountries.length + selectedYears.length;
    const isMulti = totalSelections !== 1;

    try {
        showPageLoading(true);
        hidePageNoResults();
        hideFilterNotice();

        currentPage = page;

        let movies = [];
        let data = null;

        if (!isMulti) {
            // Single dimension: use normal API call with pagination
            if (selectedCategories.length === 1 && selectedCountries.length === 0 && selectedYears.length === 0) {
                let endpoint = buildCategoryEndpoint(selectedCategories[0]);
                data = await fetchJSONCached(getApiUrl(`${API_BASE}${endpoint}?page=${page}`));
                if (data.status === 'success' || data.status === true) {
                    const pathImage = getPathImage(data);
                    movies = extractMovies(data, pathImage);
                }
            } else if (selectedCountries.length === 1 && selectedCategories.length === 0 && selectedYears.length === 0) {
                let endpoint = buildCountryEndpoint(selectedCountries[0]);
                data = await fetchJSONCached(getApiUrl(`${API_BASE}${endpoint}?page=${page}`));
                if (data.status === 'success' || data.status === true) {
                    const pathImage = getPathImage(data);
                    movies = extractMovies(data, pathImage);
                }
            } else if (selectedYears.length === 1 && selectedCategories.length === 0 && selectedCountries.length === 0) {
                let endpoint = buildYearEndpoint(selectedYears[0]);
                data = await fetchJSONCached(getApiUrl(`${API_BASE}${endpoint}?page=${page}`));
                if (data.status === 'success' || data.status === true) {
                    const pathImage = getPathImage(data);
                    movies = extractMovies(data, pathImage);
                }
            }

            if (data && (data.status === 'success' || data.status === true)) {
                if (movies.length > 0) {
                    displayMovies(movies);
                    setTimeout(() => {
                        const target = document.getElementById('moviesContainer');
                        if (target) {
                            const headerHeight = document.querySelector('header')?.offsetHeight || 60;
                            const targetPosition = target.getBoundingClientRect().top + window.scrollY - headerHeight - 10;
                            window.scrollTo({ top: targetPosition, behavior: 'smooth' });
                        }
                    }, 100);
                } else {
                    showPageNoResults();
                }
                updatePagination(data);
            } else {
                showPageNoResults();
            }

        } else {
            isCombinedMode = true;
            combinedMovies = [];
            let endpoints = [];

            if (selectedCategories.length > 0) {
                for (const cat of selectedCategories) {
                    let ep = buildCategoryEndpoint(cat);
                    endpoints.push(getApiUrl(`${API_BASE}${ep}`));
                }
            } else if (selectedYears.length > 0) {
                for (const year of selectedYears) {
                    let ep = buildYearEndpoint(year);
                    endpoints.push(getApiUrl(`${API_BASE}${ep}`));
                }
            } else if (selectedCountries.length > 0) {
                for (const country of selectedCountries) {
                    let ep = buildCountryEndpoint(country);
                    endpoints.push(getApiUrl(`${API_BASE}${ep}`));
                }
            }

            // Fetch page 1 first to get total pages
            const page1Results = await Promise.all(endpoints.map(url => fetchJSONCached(`${url}?page=1`).catch(() => null)));
            let maxTotalPages = 1;
            const totalPagesPerEndpoint = page1Results.map(res => {
                if (res && (res.status === 'success' || res.status === true)) {
                    const paginate = normalizePagination(res);
                    return paginate ? paginate.total_page : 1;
                }
                return 1;
            });
            maxTotalPages = Math.max(...totalPagesPerEndpoint, 1);

            const allMovies = [];
            for (const res of page1Results) {
                if (res && (res.status === 'success' || res.status === true)) {
                    const pathImage = getPathImage(res);
                    const items = extractMovies(res, pathImage);
                    allMovies.push(...items);
                }
            }
            // Fetch all remaining pages in parallel
            const remainingPromises = [];
            for (let p = 2; p <= maxTotalPages; p++) {
                for (const url of endpoints) {
                    remainingPromises.push(fetchJSONCached(`${url}?page=${p}`).catch(() => null));
                }
            }
            const remainingResults = await Promise.all(remainingPromises);
            for (const res of remainingResults) {
                if (res && (res.status === 'success' || res.status === true)) {
                    const pathImage = getPathImage(res);
                    const items = extractMovies(res, pathImage);
                    allMovies.push(...items);
                }
            }

            if (selectedCountries.length > 0) {
                for (let i = allMovies.length - 1; i >= 0; i--) {
                    const movie = allMovies[i];
                    if (!movie.country || !Array.isArray(movie.country) || !movie.country.some(c => selectedCountries.includes(c.slug))) {
                        allMovies.splice(i, 1);
                    }
                }
            }

            if (selectedYears.length > 0) {
                for (let i = allMovies.length - 1; i >= 0; i--) {
                    const movie = allMovies[i];
                    if (!selectedYears.includes(String(movie.year))) {
                        allMovies.splice(i, 1);
                    }
                }
            }

            const seen = new Set();
            combinedMovies = allMovies.filter(m => {
                if (seen.has(m.slug)) return false;
                seen.add(m.slug);
                return true;
            });

            combinedTotalPages = Math.max(1, Math.ceil(combinedMovies.length / COMBINED_PER_PAGE));

            if (combinedMovies.length > 0) {
                currentPage = page;
                renderCombinedPage(page);
            } else {
                showPageNoResults();
                document.getElementById('pagination').innerHTML = '';
                showPageLoading(false);
                return;
            }

            if ((selectedCategories.length > 0 && selectedCountries.length > 0) ||
                    (selectedCategories.length > 0 && selectedYears.length > 0) ||
                    (selectedCountries.length > 0 && selectedYears.length > 0)) {
                showMultiFilterNotice();
            }
        }

        showPageLoading(false);

    } catch (error) {
        console.error('Error loading filtered movies:', error);
        showError('Không thể tải danh sách phim. Vui lòng thử lại.');
        showPageLoading(false);
    }
}


function buildCategoryEndpoint(category) {
    if (currentSourceKey === 'nguonc') return `/films/the-loai/${category}`;
    if (currentSourceKey === 'kkphim') return `/v1/api/the-loai/${category}`;
    return `${currentSource.endpoints.category}/${category}`;
}

function buildCountryEndpoint(country) {
    if (currentSourceKey === 'nguonc') return `/films/quoc-gia/${country}`;
    if (currentSourceKey === 'kkphim') return `/v1/api/quoc-gia/${country}`;
    return `${currentSource.endpoints.country}/${country}`;
}

function buildYearEndpoint(year) {
    if (currentSourceKey === 'nguonc') return `/films/nam-phat-hanh/${year}`;
    if (currentSourceKey === 'kkphim') return `/v1/api/nam/${year}`;
    if (currentSourceKey === 'vsmov') return `/nam/${year}`;
    return `/nam-phat-hanh/${year}`;
}

function getPathImage(data) {
    return data.pathImage || data.data?.pathImage || data.data?.APP_DOMAIN_CDN_IMAGE || '';
}

function extractMovies(data, pathImage) {
    return (data.items || data.data?.items || []).map(item => normalizeMovieData(item, pathImage));
}


function updatePagination(data) {
    const paginate = normalizePagination(data);
    if (!paginate) { document.getElementById('pagination').innerHTML = ''; return; }
    const { current_page: current, total_page: total } = paginate;
    currentPage = current;
    totalPages = total;
    _renderPagination(paginate, 'loadFilteredMovies({page})');
    const url = new URL(window.location);
    url.searchParams.set('page', current);
    window.history.pushState({}, '', url);
}


function renderCombinedPage(page) {
    currentPage = page;
    const start = (page - 1) * COMBINED_PER_PAGE;
    const end = start + COMBINED_PER_PAGE;
    const pageMovies = combinedMovies.slice(start, end);

    if (pageMovies.length > 0) {
        displayMovies(pageMovies);
        setTimeout(() => {
            const target = document.getElementById('moviesContainer');
            if (target) {
                const headerHeight = document.querySelector('header')?.offsetHeight || 60;
                const targetPosition = target.getBoundingClientRect().top + window.scrollY - headerHeight - 10;
                window.scrollTo({ top: targetPosition, behavior: 'smooth' });
            }
        }, 100);
    } else {
        showPageNoResults();
    }

    const url = new URL(window.location);
    url.searchParams.set('page', page);
    window.history.pushState({}, '', url);

    const container = document.getElementById('pagination');
    if (container) {
        if (combinedTotalPages <= 1) {
            container.innerHTML = '';
        } else {
            container.innerHTML = getPaginationHTML(currentPage, combinedTotalPages, 'renderCombinedPage({page})');
        }
    }
}


function getCategoryDisplayName(slug) {
    return slug ? (categoryNameMap[slug] || slug) : '';
}

function getCountryDisplayName(slug) {
    return slug ? (countryNameMap[slug] || slug) : '';
}

function getYearDisplayName(slug) {
    return slug ? (yearNameMap[slug] || slug) : '';
}


function buildPageTitle(catNames, ctryNames, yearNames) {
    const parts = [];
    if (catNames.length > 0) parts.push(catNames.join(', '));
    if (ctryNames.length > 0) parts.push(ctryNames.join(', '));
    if (yearNames.length > 0) parts.push(`Năm ${yearNames.join(', ')}`);
    if (parts.length > 0) return `Phim ${parts.join(' - ')} - CinePhim`;
    return 'Tìm Phim Nâng Cao - CinePhim';
}


function updateBreadcrumb(catNames, ctryNames, yearNames) {
    const breadcrumbContainer = document.getElementById('breadcrumb');
    if (!breadcrumbContainer) return;

    let html = `
        <a href="index.html" class="hover:text-purple-400 transition">Trang chủ</a>
        <i class="fas fa-chevron-right text-xs"></i>
        <span class="text-white">Tìm phim nâng cao</span>
    `;

    if (catNames.length > 0) {
        html += `
            <i class="fas fa-chevron-right text-xs"></i>
            <span class="text-white">${catNames.join(', ')}</span>
        `;
    }

    if (ctryNames.length > 0) {
        html += `
            <i class="fas fa-chevron-right text-xs"></i>
            <span class="text-white">${ctryNames.join(', ')}</span>
        `;
    }

    if (yearNames.length > 0) {
        html += `
            <i class="fas fa-chevron-right text-xs"></i>
            <span class="text-white">Năm ${yearNames.join(', ')}</span>
        `;
    }

    breadcrumbContainer.innerHTML = html;
}


function showMultiFilterNotice() {
    const notice = document.getElementById('filterNotice');
    const noticeText = document.getElementById('filterNoticeText');
    if (!notice || !noticeText) return;
    if (currentSourceKey === 'nguonc' && selectedCountries.length > 0) {
        noticeText.innerHTML = `Nguồn NguonC không hỗ trợ lọc theo quốc gia. Chỉ hiển thị kết quả theo tiêu chí còn lại.`;
    } else {
        noticeText.innerHTML = `Đã kết hợp kết quả từ nhiều bộ lọc.`;
    }
    notice.classList.remove('hidden');
}

function hideFilterNotice() {
    const notice = document.getElementById('filterNotice');
    if (notice) notice.classList.add('hidden');
}
