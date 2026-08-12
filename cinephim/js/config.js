// CinePhim - Configuration & Constants

// API Configuration
let SOURCES = {};
let currentSourceKey = localStorage.getItem('movieSource') || 'nguonc';
let currentSource = null;
let API_BASE = '';

const appConfigPromise = fetch('js/api-sources.json?t=' + Date.now())
    .then(res => res.json())
    .then(data => {
        SOURCES = data.SOURCES || data; // handle both structures just in case
        if (!SOURCES[currentSourceKey]) currentSourceKey = 'nguonc';
        currentSource = SOURCES[currentSourceKey];
        API_BASE = currentSource.base;
    })
    .catch(err => console.error("Failed to load api-sources.json:", err));

window.ensureConfigReady = async function() {
    await appConfigPromise;
};

// Function to switch source
function setSource(sourceKey) {
    if (SOURCES[sourceKey]) {
        localStorage.setItem('previousMovieSource', currentSourceKey);
        localStorage.setItem('movieSource', sourceKey);
        
        if (window.location.pathname.includes('movie-detail.html')) {
            const url = new URL(window.location.href);
            url.searchParams.delete('episode');
            url.searchParams.delete('server');
            window.location.href = url.toString();
        } else {
            window.location.reload();
        }
    }
}

// Helper function to normalize API url
function getApiUrl(url) {
    return url;
}

// Cache configuration
const API_CACHE_TTL = 2 * 60 * 1000;
const apiResponseCache = new Map();
const inFlightRequests = new Map();

async function fetchJSONCached(url, { ttl = API_CACHE_TTL, force = false } = {}) {
    const now = Date.now();
    const cached = apiResponseCache.get(url);
    if (!force && cached && now - cached.timestamp < ttl) {
        return cached.data;
    }

    if (!force && inFlightRequests.has(url)) {
        return inFlightRequests.get(url);
    }

    const request = fetch(url)
        .then((response) => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            return response.json();
        })
        .then((data) => {
            apiResponseCache.set(url, { data, timestamp: Date.now() });
            return data;
        })
        .finally(() => {
            inFlightRequests.delete(url);
        });

    inFlightRequests.set(url, request);
    return request;
}

// NguonC fallback categories list (scraped from nguonc.com menu)
const NGONC_CATEGORIES = [
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

const CURRENT_YEAR = 2026;

// NguonC fallback countries list (scraped from nguonc.com menu)
const NGUONC_COUNTRIES = [
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

const NGONC_YEARS = (() => {
    const years = [];
    for (let y = CURRENT_YEAR; y >= 1990; y--) {
        years.push({ slug: String(y), name: String(y) });
    }
    return years;
})();
