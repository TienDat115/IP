// CinePhim - Browse (Advanced Search) Page JavaScript

var currentPage = 1;
var categoryNameMap = {};
var countryNameMap = {};
var selectedCategories = [];
var selectedCountries = [];
var selectedYears = [];
var yearNameMap = {};
var combinedMovies = [];
var combinedTotalPages = 1;
var COMBINED_PER_PAGE = 24;


document.addEventListener('DOMContentLoaded', function() {
    window.ensureConfigReady().then(function() {
        return Promise.all([loadCategories(), loadCountries(), loadYears()]);
    }).then(function() {
        setupEventListeners();
        setupSearchListeners();

        var urlParams = new URLSearchParams(window.location.search);
        var cats = urlParams.get('category');
        var countries = urlParams.get('country');
        var years = urlParams.get('year');
        var page = urlParams.get('page');

        if (cats) {
            cats.split(',').forEach(function(slug) {
                slug = slug.trim();
                if (slug && categoryNameMap[slug]) {
                    var chip = document.querySelector('.chip-btn[data-group="category"][data-value="' + slug + '"]');
                    if (chip) {
                        chip.classList.add('selected');
                        selectedCategories.push(slug);
                    }
                }
            });
        }
        if (countries) {
            countries.split(',').forEach(function(slug) {
                slug = slug.trim();
                if (slug && countryNameMap[slug]) {
                    var chip = document.querySelector('.chip-btn[data-group="country"][data-value="' + slug + '"]');
                    if (chip) {
                        chip.classList.add('selected');
                        selectedCountries.push(slug);
                    }
                }
            });
        }
        if (years) {
            years.split(',').forEach(function(slug) {
                slug = slug.trim();
                if (slug && yearNameMap[slug]) {
                    var chip = document.querySelector('.chip-btn[data-group="year"][data-value="' + slug + '"]');
                    if (chip) {
                        chip.classList.add('selected');
                        selectedYears.push(slug);
                    }
                }
            });
        }

        if (selectedCategories.length > 0 || selectedCountries.length > 0 || selectedYears.length > 0) {
            var p = page ? parseInt(page) : 1;
            applyFilters(p);
            collapseFilterPanel();
        }
    });
});


function loadCategories() {
    var container = document.getElementById('categoriesContainer');
    if (!container) return Promise.resolve();

    var categories = [];

    if (currentSourceKey === 'ophim' || currentSourceKey === 'vsmov') {
        return fetchJSONCached(getApiUrl(API_BASE + currentSource.endpoints.category)).then(function(data) {
            if (data.status === 'success' && data.data && data.data.items) {
                categories = data.data.items.map(function(item) {
                    return { slug: item.slug, name: item.name };
                });
            }
            return finishLoadCategories(container, categories);
        }).catch(function(error) {
            console.warn('Failed to load categories from API, using fallback:', error);
            return finishLoadCategories(container, categories);
        });
    }

    if (currentSourceKey === 'kkphim') {
        return fetchJSONCached(getApiUrl(API_BASE + currentSource.endpoints.category)).then(function(data) {
            if (Array.isArray(data) && data.length > 0) {
                categories = data.map(function(item) {
                    return { slug: item.slug, name: item.name };
                });
            }
            return finishLoadCategories(container, categories);
        }).catch(function(error) {
            console.warn('Failed to load categories from API, using fallback:', error);
            return finishLoadCategories(container, categories);
        });
    }

    return Promise.resolve(finishLoadCategories(container, categories));
}

function finishLoadCategories(container, categories) {
    if (categories.length === 0) {
        categories = NGONC_CATEGORIES;
    }

    categoryNameMap = {};
    categories.forEach(function(cat) { categoryNameMap[cat.slug] = cat.name; });

    container.innerHTML = categories.map(function(cat) {
        return '<button class="chip-btn" data-group="category" data-value="' + cat.slug + '">' + cat.name + '</button>';
    }).join('');
}


function loadCountries() {
    var container = document.getElementById('countriesContainer');
    if (!container) return Promise.resolve();

    var countries = [];

    if (currentSourceKey === 'ophim' || currentSourceKey === 'vsmov') {
        return fetchJSONCached(getApiUrl(API_BASE + currentSource.endpoints.country)).then(function(data) {
            if (data.status === 'success' && data.data && data.data.items) {
                countries = data.data.items.map(function(item) {
                    return { slug: item.slug, name: item.name };
                });
            }
            return finishLoadCountries(container, countries);
        }).catch(function(error) {
            console.warn('Failed to load countries from API, using fallback:', error);
            return finishLoadCountries(container, countries);
        });
    }

    if (currentSourceKey === 'kkphim') {
        return fetchJSONCached(getApiUrl(API_BASE + currentSource.endpoints.country)).then(function(data) {
            if (Array.isArray(data) && data.length > 0) {
                countries = data.map(function(item) {
                    return { slug: item.slug, name: item.name };
                });
            }
            return finishLoadCountries(container, countries);
        }).catch(function(error) {
            console.warn('Failed to load countries from API, using fallback:', error);
            return finishLoadCountries(container, countries);
        });
    }

    return Promise.resolve(finishLoadCountries(container, countries));
}

function finishLoadCountries(container, countries) {
    if (countries.length === 0) {
        countries = NGUONC_COUNTRIES;
    }

    countryNameMap = {};
    countries.forEach(function(c) { countryNameMap[c.slug] = c.name; });

    container.innerHTML = countries.map(function(c) {
        return '<button class="chip-btn" data-group="country" data-value="' + c.slug + '">' + c.name + '</button>';
    }).join('');
}


function loadYears() {
    var container = document.getElementById('yearsContainer');
    if (!container) return;

    var years = NGONC_YEARS;

    yearNameMap = {};
    years.forEach(function(y) { yearNameMap[y.slug] = y.name; });

    container.innerHTML = years.map(function(y) {
        return '<button class="chip-btn" data-group="year" data-value="' + y.slug + '">' + y.name + '</button>';
    }).join('');
}


function setupEventListeners() {
    var categoriesContainer = document.getElementById('categoriesContainer');
    if (categoriesContainer) {
        categoriesContainer.addEventListener('click', function(e) {
            var chip = e.target.closest('.chip-btn');
            if (!chip || chip.dataset.group !== 'category') return;

            var value = chip.dataset.value;
            if (chip.classList.contains('selected')) {
                chip.classList.remove('selected');
                selectedCategories = selectedCategories.filter(function(v) { return v !== value; });
            } else {
                chip.classList.add('selected');
                selectedCategories.push(value);
            }
        });
    }

    var countriesContainer = document.getElementById('countriesContainer');
    if (countriesContainer) {
        countriesContainer.addEventListener('click', function(e) {
            var chip = e.target.closest('.chip-btn');
            if (!chip || chip.dataset.group !== 'country') return;

            var value = chip.dataset.value;
            if (chip.classList.contains('selected')) {
                chip.classList.remove('selected');
                selectedCountries = selectedCountries.filter(function(v) { return v !== value; });
            } else {
                chip.classList.add('selected');
                selectedCountries.push(value);
            }
        });
    }

    var yearsContainer = document.getElementById('yearsContainer');
    if (yearsContainer) {
        yearsContainer.addEventListener('click', function(e) {
            var chip = e.target.closest('.chip-btn');
            if (!chip || chip.dataset.group !== 'year') return;

            var value = chip.dataset.value;
            if (chip.classList.contains('selected')) {
                chip.classList.remove('selected');
                selectedYears = selectedYears.filter(function(v) { return v !== value; });
            } else {
                chip.classList.add('selected');
                selectedYears.push(value);
            }
        });
    }

    var toggleFilterBtn = document.getElementById('toggleFilterBtn');
    if (toggleFilterBtn) {
        toggleFilterBtn.addEventListener('click', toggleFilterPanel);
    }

    var applyFilterBtn = document.getElementById('applyFilterBtn');
    if (applyFilterBtn) {
        applyFilterBtn.addEventListener('click', function() {
            applyFilters();
            collapseFilterPanel();
        });
    }

    var clearFilterBtn = document.getElementById('clearFilterBtn');
    if (clearFilterBtn) {
        clearFilterBtn.addEventListener('click', function() {
            clearFilters();
            expandFilterPanel();
        });
    }
}


function toggleFilterPanel() {
    var panel = document.querySelector('.filter-panel');
    if (panel && panel.classList.contains('collapsed')) {
        expandFilterPanel();
    } else {
        collapseFilterPanel();
    }
}

function collapseFilterPanel() {
    var panel = document.querySelector('.filter-panel');
    var btn = document.getElementById('toggleFilterBtn');
    if (!panel || panel.classList.contains('collapsed')) return;
    panel.classList.add('collapsed');
    if (btn) {
        btn.setAttribute('aria-expanded', 'false');
        btn.setAttribute('aria-label', 'Mở rộng bộ lọc');
        var icon = btn.querySelector('i');
        if (icon) icon.className = 'fas fa-chevron-down';
    }
}

function expandFilterPanel() {
    var panel = document.querySelector('.filter-panel');
    var btn = document.getElementById('toggleFilterBtn');
    if (!panel || !panel.classList.contains('collapsed')) return;
    panel.classList.remove('collapsed');
    if (btn) {
        btn.setAttribute('aria-expanded', 'true');
        btn.setAttribute('aria-label', 'Thu nhỏ bộ lọc');
        var icon = btn.querySelector('i');
        if (icon) icon.className = 'fas fa-chevron-up';
    }
}


function applyFilters(page) {
    if (typeof page === 'undefined') page = 1;
    if (selectedCategories.length === 0 && selectedCountries.length === 0 && selectedYears.length === 0) {
        showWarning('Vui lòng chọn ít nhất thể loại, quốc gia hoặc năm.');
        return;
    }

    var url = new URL(window.location);
    if (selectedCategories.length > 0) url.searchParams.set('category', selectedCategories.join(','));
    else url.searchParams.delete('category');
    if (selectedCountries.length > 0) url.searchParams.set('country', selectedCountries.join(','));
    else url.searchParams.delete('country');
    if (selectedYears.length > 0) url.searchParams.set('year', selectedYears.join(','));
    else url.searchParams.delete('year');
    url.searchParams.set('page', page);
    window.history.pushState({}, '', url);

    var catNames = selectedCategories.map(function(s) { return getCategoryDisplayName(s); }).filter(Boolean);
    var ctryNames = selectedCountries.map(function(s) { return getCountryDisplayName(s); }).filter(Boolean);
    var yearNames = selectedYears.map(function(s) { return getYearDisplayName(s); }).filter(Boolean);
    document.title = buildPageTitle(catNames, ctryNames, yearNames);
    updateBreadcrumb(catNames, ctryNames, yearNames);

    loadFilteredMovies(page);
}


function clearFilters() {
    selectedCategories = [];
    selectedCountries = [];
    selectedYears = [];
    combinedMovies = [];
    combinedTotalPages = 1;
    document.querySelectorAll('.chip-btn.selected').forEach(function(el) { el.classList.remove('selected'); });

    var url = new URL(window.location);
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


function loadFilteredMovies(page) {
    if (typeof page === 'undefined') page = 1;
    if (selectedCategories.length === 0 && selectedCountries.length === 0 && selectedYears.length === 0) return Promise.resolve();

    var totalSelections = selectedCategories.length + selectedCountries.length + selectedYears.length;
    var isMulti = totalSelections !== 1;

    showPageLoading(true);
    hidePageNoResults();
    hideFilterNotice();

    currentPage = page;

    var movies = [];
    var data = null;

    if (!isMulti) {
        if (selectedCategories.length === 1 && selectedCountries.length === 0 && selectedYears.length === 0) {
            var endpoint = buildCategoryEndpoint(selectedCategories[0]);
            return fetchJSONCached(getApiUrl(API_BASE + endpoint + '?page=' + page)).then(function(result) {
                data = result;
                if (data.status === 'success' || data.status === true) {
                    movies = extractMovies(data);
                }
                return handleSingleResult(data, movies);
            }).catch(handleError);
        } else if (selectedCountries.length === 1 && selectedCategories.length === 0 && selectedYears.length === 0) {
            var endpoint = buildCountryEndpoint(selectedCountries[0]);
            return fetchJSONCached(getApiUrl(API_BASE + endpoint + '?page=' + page)).then(function(result) {
                data = result;
                if (data.status === 'success' || data.status === true) {
                    movies = extractMovies(data);
                }
                return handleSingleResult(data, movies);
            }).catch(handleError);
        } else if (selectedYears.length === 1 && selectedCategories.length === 0 && selectedCountries.length === 0) {
            var endpoint = buildYearEndpoint(selectedYears[0]);
            return fetchJSONCached(getApiUrl(API_BASE + endpoint + '?page=' + page)).then(function(result) {
                data = result;
                if (data.status === 'success' || data.status === true) {
                    movies = extractMovies(data);
                }
                return handleSingleResult(data, movies);
            }).catch(handleError);
        }
        return Promise.resolve();
    } else {
        combinedMovies = [];
        var endpoints = [];

        if (selectedCategories.length > 0) {
            for (var i = 0; i < selectedCategories.length; i++) {
                var ep = buildCategoryEndpoint(selectedCategories[i]);
                endpoints.push(getApiUrl(API_BASE + ep));
            }
        } else if (selectedYears.length > 0) {
            for (var i = 0; i < selectedYears.length; i++) {
                var ep = buildYearEndpoint(selectedYears[i]);
                endpoints.push(getApiUrl(API_BASE + ep));
            }
        } else if (selectedCountries.length > 0) {
            for (var i = 0; i < selectedCountries.length; i++) {
                var ep = buildCountryEndpoint(selectedCountries[i]);
                endpoints.push(getApiUrl(API_BASE + ep));
            }
        }

        var page1Promises = endpoints.map(function(url) {
            return fetchJSONCached(url + '?page=1').catch(function() { return null; });
        });

        return Promise.all(page1Promises).then(function(page1Results) {
            var maxTotalPages = 1;
            var totalPagesPerEndpoint = page1Results.map(function(res) {
                if (res && (res.status === 'success' || res.status === true)) {
                    var paginate = normalizePagination(res);
                    return paginate ? paginate.total_page : 1;
                }
                return 1;
            });

            for (var i = 0; i < totalPagesPerEndpoint.length; i++) {
                if (totalPagesPerEndpoint[i] > maxTotalPages) {
                    maxTotalPages = totalPagesPerEndpoint[i];
                }
            }

            var allMovies = [];
            for (var i = 0; i < page1Results.length; i++) {
                var res = page1Results[i];
                if (res && (res.status === 'success' || res.status === true)) {
                    var items = extractMovies(res);
                    for (var j = 0; j < items.length; j++) {
                        allMovies.push(items[j]);
                    }
                }
            }

            var remainingPromises = [];
            for (var p = 2; p <= maxTotalPages; p++) {
                for (var i = 0; i < endpoints.length; i++) {
                    remainingPromises.push(fetchJSONCached(endpoints[i] + '?page=' + p).catch(function() { return null; }));
                }
            }

            return Promise.all(remainingPromises).then(function(remainingResults) {
                for (var i = 0; i < remainingResults.length; i++) {
                    var res = remainingResults[i];
                    if (res && (res.status === 'success' || res.status === true)) {
                        var items = extractMovies(res);
                        for (var j = 0; j < items.length; j++) {
                            allMovies.push(items[j]);
                        }
                    }
                }

                if (selectedCountries.length > 0) {
                    for (var i = allMovies.length - 1; i >= 0; i--) {
                        var movie = allMovies[i];
                        if (!movie.country || !Array.isArray(movie.country) || !movie.country.some(function(c) { return selectedCountries.indexOf(c.slug) !== -1; })) {
                            allMovies.splice(i, 1);
                        }
                    }
                }

                if (selectedYears.length > 0) {
                    for (var i = allMovies.length - 1; i >= 0; i--) {
                        var movie = allMovies[i];
                        if (selectedYears.indexOf(String(movie.year)) === -1) {
                            allMovies.splice(i, 1);
                        }
                    }
                }

                var seen = [];
                combinedMovies = allMovies.filter(function(m) {
                    if (seen.indexOf(m.slug) !== -1) return false;
                    seen.push(m.slug);
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

                showPageLoading(false);
            });
        }).catch(handleError);
    }

    function handleSingleResult(data, movies) {
        if (data && (data.status === 'success' || data.status === true)) {
            if (movies.length > 0) {
                displayMovies(movies);
                setTimeout(function() {
                    var target = document.getElementById('moviesContainer');
                    if (target) {
                        var header = document.querySelector('header');
                        var headerHeight = header ? header.offsetHeight : 60;
                        var targetPosition = target.getBoundingClientRect().top + window.scrollY - headerHeight - 10;
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
        showPageLoading(false);
    }

    function handleError(error) {
        console.error('Error loading filtered movies:', error);
        showError('Không thể tải danh sách phim. Vui lòng thử lại.');
        showPageLoading(false);
    }
}


function buildCategoryEndpoint(category) {
    if (currentSourceKey === 'nguonc') return '/films/the-loai/' + category;
    if (currentSourceKey === 'kkphim') return '/v1/api/the-loai/' + category;
    return currentSource.endpoints.category + '/' + category;
}

function buildCountryEndpoint(country) {
    if (currentSourceKey === 'nguonc') return '/films/quoc-gia/' + country;
    if (currentSourceKey === 'kkphim') return '/v1/api/quoc-gia/' + country;
    return currentSource.endpoints.country + '/' + country;
}

function buildYearEndpoint(year) {
    if (currentSourceKey === 'nguonc') return '/films/nam-phat-hanh/' + year;
    if (currentSourceKey === 'kkphim') return '/v1/api/nam/' + year;
    if (currentSourceKey === 'vsmov') return '/nam/' + year;
    return '/nam-phat-hanh/' + year;
}

function extractMovies(data) {
    var items = data.items || (data.data && data.data.items) || [];
    return items.map(function(item) { return normalizeMovieData(item); });
}


function updatePagination(data) {
    var paginate = normalizePagination(data);
    if (!paginate) { document.getElementById('pagination').innerHTML = ''; return; }
    var current = paginate.current_page;
    currentPage = current;
    _renderPagination(paginate, 'loadFilteredMovies({page})');
    var url = new URL(window.location);
    url.searchParams.set('page', current);
    window.history.pushState({}, '', url);
}


function renderCombinedPage(page) {
    currentPage = page;
    var start = (page - 1) * COMBINED_PER_PAGE;
    var end = start + COMBINED_PER_PAGE;
    var pageMovies = combinedMovies.slice(start, end);

    if (pageMovies.length > 0) {
        displayMovies(pageMovies);
        setTimeout(function() {
            var target = document.getElementById('moviesContainer');
            if (target) {
                var header = document.querySelector('header');
                var headerHeight = header ? header.offsetHeight : 60;
                var targetPosition = target.getBoundingClientRect().top + window.scrollY - headerHeight - 10;
                window.scrollTo({ top: targetPosition, behavior: 'smooth' });
            }
        }, 100);
    } else {
        showPageNoResults();
    }

    var url = new URL(window.location);
    url.searchParams.set('page', page);
    window.history.pushState({}, '', url);

    var container = document.getElementById('pagination');
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
    var parts = [];
    if (catNames.length > 0) parts.push(catNames.join(', '));
    if (ctryNames.length > 0) parts.push(ctryNames.join(', '));
    if (yearNames.length > 0) parts.push('Năm ' + yearNames.join(', '));
    if (parts.length > 0) return 'Phim ' + parts.join(' - ') + ' - CinePhim';
    return 'Tìm Phim Nâng Cao - CinePhim';
}


function updateBreadcrumb(catNames, ctryNames, yearNames) {
    var breadcrumbContainer = document.getElementById('breadcrumb');
    if (!breadcrumbContainer) return;

    var html = '<a href="index.html">Trang chủ</a>' +
        '<i class="fas fa-chevron-right text-xs"></i>' +
        '<span>Tìm phim nâng cao</span>';

    if (catNames && catNames.length > 0) {
        html += '<i class="fas fa-chevron-right text-xs"></i>' +
            '<span>' + catNames.join(', ') + '</span>';
    }

    if (ctryNames && ctryNames.length > 0) {
        html += '<i class="fas fa-chevron-right text-xs"></i>' +
            '<span>' + ctryNames.join(', ') + '</span>';
    }

    if (yearNames && yearNames.length > 0) {
        html += '<i class="fas fa-chevron-right text-xs"></i>' +
            '<span>Năm ' + yearNames.join(', ') + '</span>';
    }

    breadcrumbContainer.innerHTML = html;
}


function showMultiFilterNotice() {
    var notice = document.getElementById('filterNotice');
    var noticeText = document.getElementById('filterNoticeText');
    if (!notice || !noticeText) return;
    if (currentSourceKey === 'nguonc' && selectedCountries.length > 0) {
        noticeText.innerHTML = 'Nguồn NguonC không hỗ trợ lọc theo quốc gia. Chỉ hiển thị kết quả theo tiêu chí còn lại.';
    } else {
        noticeText.innerHTML = 'Đã kết hợp kết quả từ nhiều bộ lọc.';
    }
    notice.classList.remove('hidden');
}

function hideFilterNotice() {
    var notice = document.getElementById('filterNotice');
    if (notice) notice.classList.add('hidden');
}
