// CinePhim - Configuration and Constants

// API Configuration
var SOURCES = {};
var currentSourceKey = localStorage.getItem('movieSource') || 'nguonc';
var currentSource = null;
var API_BASE = '';

var appConfigPromise = fetch('js/api-sources.json?t=' + Date.now())
        .then(function(res) { return res.json(); })
        .then(function(data) {
            SOURCES = data.SOURCES || data;
            if (!SOURCES[currentSourceKey]) currentSourceKey = 'nguonc';
            currentSource = SOURCES[currentSourceKey];
            API_BASE = currentSource.base;
        })
        .catch(function(err) { console.error("Failed to load api-sources.json:", err); });

    window.ensureConfigReady = function() {
        return appConfigPromise;
    };

    // Function to switch source
    window.setSource = function(sourceKey) {
        if (SOURCES[sourceKey]) {
            localStorage.setItem('movieSource', sourceKey);

            if (window.location.pathname.indexOf('movie-detail.html') !== -1) {
                var url = new URL(window.location.href);
                url.searchParams.delete('episode');
                url.searchParams.delete('server');
                window.location.href = url.toString();
            } else {
                window.location.reload();
            }
        }
    };

    // Helper function to normalize API url
    window.getApiUrl = function(url) {
        return url;
    };

    // Cache configuration
    var API_CACHE_TTL = 2 * 60 * 1000;
    var apiResponseCache = new Map();
    var inFlightRequests = new Map();

    window.fetchJSONCached = function(url, options) {
        options = options || {};
        var ttl = options.ttl !== undefined ? options.ttl : API_CACHE_TTL;
        var force = options.force !== undefined ? options.force : false;

        var now = Date.now();
        var cached = apiResponseCache.get(url);
        if (!force && cached && now - cached.timestamp < ttl) {
            return Promise.resolve(cached.data);
        }

        if (!force && inFlightRequests.has(url)) {
            return inFlightRequests.get(url);
        }

        var request = fetch(url)
            .then(function(response) {
                if (!response.ok) {
                    throw new Error('HTTP ' + response.status);
                }
                return response.json();
            })
            .then(function(data) {
                apiResponseCache.set(url, { data: data, timestamp: Date.now() });
                return data;
            })
            .finally(function() {
                inFlightRequests.delete(url);
            });

        inFlightRequests.set(url, request);
        return request;
    };

    // NguonC fallback categories list (scraped from nguonc.com menu)
    var NGONC_CATEGORIES = [
        { slug: 'hanh-dong', name: 'Hành Động' },
        { slug: 'phieu-luu', name: 'Phiêu Lưu' },
        { slug: 'hoat-hinh', name: 'Hoạt Hình' },
        { slug: 'phim-hai', name: 'Hài' },
        { slug: 'hinh-su', name: 'Hình Sự' },
        { slug: 'tai-lieu', name: 'Tài Liệu' },
        { slug: 'chinh-kich', name: 'Chính Kịch' },
        { slug: 'gia-dinh', name: 'Gia Đình' },
        { slug: 'gia-tuong', name: 'Giả Tưởng' },
        { slug: 'lich-su', name: 'Lịch Sử' },
        { slug: 'kinh-di', name: 'Kinh Dị' },
        { slug: 'phim-nhac', name: 'Nhạc' },
        { slug: 'bi-an', name: 'Bí Ẩn' },
        { slug: 'lang-man', name: 'Lãng Mạn' },
        { slug: 'khoa-hoc-vien-tuong', name: 'Khoa Học Viễn Tưởng' },
        { slug: 'gay-can', name: 'Gây Cấn' },
        { slug: 'chien-tranh', name: 'Chiến Tranh' },
        { slug: 'tam-ly', name: 'Tâm Lý' },
        { slug: 'tinh-cam', name: 'Tình Cảm' },
        { slug: 'co-trang', name: 'Cổ Trang' },
        { slug: 'mien-tay', name: 'Miền Tây' },
        { slug: 'phim-18', name: 'Phim 18+' }
    ];

    var CURRENT_YEAR = 2026;

    // NguonC fallback countries list (scraped from nguonc.com menu)
    var NGUONC_COUNTRIES = [
        { slug: 'au-my', name: 'Âu Mỹ' },
        { slug: 'anh', name: 'Anh' },
        { slug: 'trung-quoc', name: 'Trung Quốc' },
        { slug: 'indonesia', name: 'Indonesia' },
        { slug: 'viet-nam', name: 'Việt Nam' },
        { slug: 'phap', name: 'Pháp' },
        { slug: 'hong-kong', name: 'Hồng Kông' },
        { slug: 'han-quoc', name: 'Hàn Quốc' },
        { slug: 'nhat-ban', name: 'Nhật Bản' },
        { slug: 'thai-lan', name: 'Thái Lan' },
        { slug: 'dai-loan', name: 'Đài Loan' },
        { slug: 'nga', name: 'Nga' },
        { slug: 'ha-lan', name: 'Hà Lan' },
        { slug: 'philippines', name: 'Philippines' },
        { slug: 'an-do', name: 'Ấn Độ' },
        { slug: 'quoc-gia-khac', name: 'Quốc gia khác' }
    ];

var NGONC_YEARS = (function() {
    var years = [];
    for (var y = CURRENT_YEAR; y >= 1990; y--) {
        years.push({ slug: String(y), name: String(y) });
    }
    return years;
})();

window.SOURCES = SOURCES;
window.currentSourceKey = currentSourceKey;
window.currentSource = currentSource;
window.API_BASE = API_BASE;
window.NGONC_CATEGORIES = NGONC_CATEGORIES;
window.NGUONC_COUNTRIES = NGUONC_COUNTRIES;
window.NGONC_YEARS = NGONC_YEARS;
