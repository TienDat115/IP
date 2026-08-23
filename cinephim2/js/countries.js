// Countries Page JavaScript
var currentPage = 1;
var currentCountry = '';
var countryNameMap = {};


// Initialize page when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.ensureConfigReady().then(function() {
        initializePage();
    });
});

// Initialize the page
function initializePage() {
    return loadCountries().then(function() {
        // Check for country parameter in URL
        var urlParams = new URLSearchParams(window.location.search);
        var country = urlParams.get('country');
        var page = urlParams.get('page');
        
        if (country) {
            var radio = document.querySelector('input[name="country"][value="' + country + '"]');
            if (radio) {
                radio.checked = true;
            }
            // Load with page from URL (default to 1 if not specified)
            var pageNumber = page ? parseInt(page) : 1;
            return loadCountryMovies(pageNumber);
        }
        
        // Setup event listeners for radio buttons
        setupEventListeners();
        setupSearchListeners();
    }).catch(function(error) {
        console.error('Error initializing page:', error);
        showError('Có lỗi xảy ra khi tải trang. Vui lòng thử lại.');
    });
}

// Load countries from API
function loadCountries() {
    var container = document.getElementById('countriesContainer');
    if (!container) return Promise.resolve();

    var countries = [];

    if (currentSourceKey === 'ophim' || currentSourceKey === 'vsmov') {
        return fetchJSONCached(getApiUrl(API_BASE + currentSource.endpoints.country)).then(function(data) {
            if (data.status === 'success' && data.data && data.data.items) {
                countries = data.data.items.map(function(item) {
                    return {
                        slug: item.slug,
                        name: item.name
                    };
                });
            }
            return buildCountriesList(container, countries);
        }).catch(function(error) {
            console.warn('Failed to load countries from API, using fallback:', error);
            return buildCountriesList(container, countries);
        });
    }

    if (currentSourceKey === 'kkphim') {
        return fetchJSONCached(getApiUrl(API_BASE + currentSource.endpoints.country)).then(function(data) {
            if (Array.isArray(data) && data.length > 0) {
                countries = data.map(function(item) {
                    return {
                        slug: item.slug,
                        name: item.name
                    };
                });
            }
            return buildCountriesList(container, countries);
        }).catch(function(error) {
            console.warn('Failed to load countries from API, using fallback:', error);
            return buildCountriesList(container, countries);
        });
    }

    return buildCountriesList(container, countries);
}

function buildCountriesList(container, countries) {
    if (countries.length === 0) {
        countries = NGUONC_COUNTRIES;
    }

    countryNameMap = {};
    countries.forEach(function(c) { countryNameMap[c.slug] = c.name; });

    container.innerHTML = countries.map(function(c) {
        return '<label class="flex items-center space-x-2 cursor-pointer hover:bg-gray-600 p-2 rounded transition">' +
            '<input type="radio" name="country" value="' + c.slug + '" onchange="loadCountryMovies(1)" class="w-4 h-4 text-purple-600 bg-gray-600 border-gray-500 rounded focus:ring-purple-500" />' +
            '<span class="text-white">' + c.name + '</span>' +
            '</label>';
    }).join('');

    setupEventListeners();
    setupSearchListeners();
    return Promise.resolve();
}

// Setup event listeners
function setupEventListeners() {
    var container = document.getElementById('countriesContainer');
    if (container && container.addEventListener) {
        container.addEventListener('change', function(e) {
            if (e.target && e.target.name === 'country') {
                loadCountryMovies(1);
            }
        });
    }
}

// Load movies by country
function loadCountryMovies(page) {
    if (page === undefined) page = 1;
    // Get selected country
    var selectedRadio = document.querySelector('input[name="country"]:checked');
    var selectedCountry = selectedRadio ? selectedRadio.value : '';
    
    if (!selectedCountry) {
        showWarning('Vui lòng chọn quốc gia để xem phim.');
        return Promise.resolve();
    }
    
    return new Promise(function(resolve, reject) {
        showPageLoading(true);
        hidePageNoResults();
        
        currentCountry = selectedCountry;
        currentPage = page;
        
        // Update URL with country and page parameters
        var url = new URL(window.location);
        url.searchParams.set('country', selectedCountry);
        url.searchParams.set('page', page);
        window.history.pushState({}, '', url);
        
        // Scroll to top when changing page
        window.scrollTo(0, 0);
        
        var endpoint = currentSource.endpoints.country + '/' + selectedCountry;
        if (currentSourceKey === 'nguonc') {
            endpoint = '/films/quoc-gia/' + selectedCountry;
        } else if (currentSourceKey === 'kkphim') {
            endpoint = '/v1/api/quoc-gia/' + selectedCountry;
        }
        
        fetchJSONCached(getApiUrl(API_BASE + endpoint + '?page=' + page)).then(function(data) {
            if (data.status === 'success' || data.status === true) {
                var rawItems = data.items || (data.data && data.data.items) || [];
                var movies = rawItems.map(function(item) { return normalizeMovieData(item); });
                displayMovies(movies);
                
                var pagination = normalizePagination(data);
                updatePagination(pagination);
                
                // Update page title
                var countryName = getCountryDisplayName(selectedCountry);
                document.title = 'Phim ' + countryName + ' - CinePhim';
                
                // Update breadcrumb
                updateBreadcrumb(countryName);
                
                // Scroll to movies container with header offset
                setTimeout(function() {
                    var moviesContainer = document.getElementById('moviesContainer');
                    if (moviesContainer) {
                        var header = document.querySelector('header');
                        var headerHeight = header ? header.offsetHeight : 0;
                        var top = moviesContainer.getBoundingClientRect().top + window.pageYOffset - headerHeight - 10;
                        window.scrollTo({ top: top, behavior: 'smooth' });
                    }
                }, 100);
                
            } else {
                showPageNoResults();
            }
            
            showPageLoading(false);
            resolve();
        }).catch(function(error) {
            console.error('Error loading country movies:', error);
            showError('Không thể tải danh sách phim. Vui lòng thử lại.');
            showPageLoading(false);
            resolve();
        });
    });
}

// Update pagination
function updatePagination(paginate) {
    if (!paginate) { document.getElementById('pagination').innerHTML = ''; return; }
    var current = paginate.current_page;
    currentPage = current;
    _renderPagination(paginate, 'loadCountryMovies({page})');
    var url = new URL(window.location);
    url.searchParams.set('page', current);
    window.history.pushState({}, '', url);
}

// Get country display name
function getCountryDisplayName(countrySlug) {
    return countryNameMap[countrySlug] || countrySlug;
}

// Update breadcrumb
function updateBreadcrumb(countryName) {
    var breadcrumbContainer = document.getElementById('breadcrumb');
    if (breadcrumbContainer) {
        breadcrumbContainer.innerHTML = '<a href="index.html" class="hover:text-purple-400 transition">Trang chủ</a>' +
            '<i class="fas fa-chevron-right text-xs"></i>' +
            '<span class="text-white">Phim theo quốc gia</span>' +
            '<i class="fas fa-chevron-right text-xs"></i>' +
            '<span class="text-white">' + countryName + '</span>';
    }
}
