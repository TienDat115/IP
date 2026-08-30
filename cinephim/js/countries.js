// Countries Page JavaScript
let currentPage = 1;
let currentCountry = '';
let countryNameMap = {};


// Initialize page when DOM is loaded
document.addEventListener('DOMContentLoaded', async function() {
    await window.ensureConfigReady();
    initializePage();
});

// Initialize the page
async function initializePage() {
    try {
        await loadCountries();
        
        // Check for country parameter in URL
        const urlParams = new URLSearchParams(window.location.search);
        const country = urlParams.get('country');
        const page = urlParams.get('page');
        
        if (country) {
            const radio = document.querySelector(`input[name="country"][value="${country}"]`);
            if (radio) {
                radio.checked = true;
            }
            // Load with page from URL (default to 1 if not specified)
            const pageNumber = page ? parseInt(page) : 1;
            await loadCountryMovies(pageNumber);
        }
        
        // Setup event listeners for radio buttons
        setupEventListeners();
        setupSearchListeners();
        
    } catch (error) {
        console.error('Error initializing page:', error);
        showError('Có lỗi xảy ra khi tải trang. Vui lòng thử lại.');
    }
}

// Load countries from API
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
        <label class="flex items-center space-x-2 cursor-pointer hover:bg-gray-600 p-2 rounded transition">
            <input type="radio" name="country" value="${c.slug}" onchange="loadCountryMovies(1)" class="w-4 h-4 text-purple-600 bg-gray-600 border-gray-500 rounded focus:ring-purple-500" />
            <span class="text-white">${c.name}</span>
        </label>
    `).join('');
}

// Setup event listeners
function setupEventListeners() {
    document.getElementById('countriesContainer')?.addEventListener('change', function(e) {
        if (e.target && e.target.name === 'country') {
            loadCountryMovies(1);
        }
    });
}

// Load movies by country
async function loadCountryMovies(page = 1) {
    // Get selected country
    const selectedRadio = document.querySelector('input[name="country"]:checked');
    const selectedCountry = selectedRadio ? selectedRadio.value : '';
    
    if (!selectedCountry) {
        showWarning('Vui lòng chọn quốc gia để xem phim.');
        return;
    }
    
    try {
        showPageLoading(true);
        hidePageNoResults();
        
        currentCountry = selectedCountry;
        currentPage = page;
        
        // Update URL with country and page parameters
        const url = new URL(window.location);
        url.searchParams.set('country', selectedCountry);
        url.searchParams.set('page', page);
        window.history.pushState({}, '', url);
        
        // Scroll to top when changing page
        window.scrollTo(0, 0);
        
        let endpoint = `${currentSource.endpoints.country}/${selectedCountry}`;
        if (currentSourceKey === 'nguonc') {
            endpoint = `/films/quoc-gia/${selectedCountry}`;
        } else if (currentSourceKey === 'kkphim') {
            endpoint = `/v1/api/quoc-gia/${selectedCountry}`;
        }
        
        const data = await fetchJSONCached(getApiUrl(`${API_BASE}${endpoint}?page=${page}`));
        
        if (data.status === 'success' || data.status === true) {
            const movies = (data.items || data.data?.items || []).map(item => normalizeMovieData(item));
            displayMovies(movies);
            
            const pagination = normalizePagination(data);
            updatePagination(pagination);
            
            // Update page title
            const countryName = getCountryDisplayName(selectedCountry);
            document.title = `Phim ${countryName} - CinePhim`;
            
            // Update breadcrumb
            updateBreadcrumb(countryName);
            
            // Scroll to movies container with header offset (mobile only), else scroll to top
            if (isMobileViewport()) {
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
                window.scrollTo(0, 0);
            }
            
        } else {
            showPageNoResults();
        }
        
        showPageLoading(false);
        
    } catch (error) {
        console.error('Error loading country movies:', error);
        showError('Không thể tải danh sách phim. Vui lòng thử lại.');
        showPageLoading(false);
    }
}

// Update pagination
function updatePagination(paginate) {
    if (!paginate) { document.getElementById('pagination').innerHTML = ''; return; }
    const { current_page: current } = paginate;
    currentPage = current;
    _renderPagination(paginate, 'loadCountryMovies({page})');
    const url = new URL(window.location);
    url.searchParams.set('page', current);
    window.history.pushState({}, '', url);
}

// Get country display name
function getCountryDisplayName(countrySlug) {
    return countryNameMap[countrySlug] || countrySlug;
}

// Update breadcrumb
function updateBreadcrumb(countryName) {
    const breadcrumbContainer = document.getElementById('breadcrumb');
    if (breadcrumbContainer) {
        breadcrumbContainer.innerHTML = `
            <a href="index.html" class="hover:text-purple-400 transition">Trang chủ</a>
            <i class="fas fa-chevron-right text-xs"></i>
            <span class="text-white">Phim theo quốc gia</span>
            <i class="fas fa-chevron-right text-xs"></i>
            <span class="text-white">${countryName}</span>
        `;
    }
}


