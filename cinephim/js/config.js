// CinePhim - Configuration & Constants

// API Configuration
const SOURCES = {
    nguonc: {
        name: 'NguonC',
        base: 'https://phim.nguonc.com/api',
        endpoints: {
            new: '/films/phim-moi-cap-nhat',
            search: '/films/search',
            detail: '/film',
            category: '/categories',
            country: '/countries'
        }
    },
    ophim: {
        name: 'OPhim',
        base: 'https://ophim1.com/v1/api',
        endpoints: {
            new: '/danh-sach/phim-moi-cap-nhat',
            search: '/tim-kiem',
            detail: '/phim',
            category: '/the-loai',
            country: '/quoc-gia'
        }
    },
    kkphim: {
        name: 'KKPhim',
        base: 'https://phimapi.com',
        endpoints: {
            new: '/danh-sach/phim-moi-cap-nhat',
            search: '/v1/api/tim-kiem',
            detail: '/phim',
            category: '/the-loai',
            country: '/quoc-gia'
        }
    }
};

// Current source management
let currentSourceKey = localStorage.getItem('movieSource') || 'nguonc';
if (!SOURCES[currentSourceKey]) currentSourceKey = 'nguonc';

let currentSource = SOURCES[currentSourceKey];
let API_BASE = currentSource.base;

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
