// Movie Detail Page JavaScript
let currentMovie = null;
let currentEpisodeIndex = 0;
let currentServerIndex = 0;
let currentEpisodePage = 1;
let episodesPerPage = 50;

// Helper to convert Youtube URL to embed URL
function convertYoutubeToEmbed(url) {
    if (!url) return '';
    if (url.includes('youtube.com/embed/')) return url;
    
    let regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    let match = url.match(regExp);
    
    if (match && match[2].length === 11) {
        return `https://www.youtube.com/embed/${match[2]}`;
    }
    return url;
}

// Check if user is logged in
function isUserLoggedIn() {
    return auth.currentUser !== null;
}

// Wait for watch history to load from Firebase
async function waitForWatchHistory() {
    if (!isUserLoggedIn()) return;
    
    // Wait for watchHistory to be loaded from Firebase
    let attempts = 0;
    while (watchHistory.length === 0 && attempts < 20) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
    }
}

// Auto-scroll to video player
function scrollToVideo() {
    const videoPlayer = document.getElementById('videoPlayer');
    if (videoPlayer) {
        // Smooth scroll to video player with some offset for better visibility
        const offset = 100; // 100px from top
        const elementPosition = videoPlayer.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - offset;
        
        window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
        });
    }
}

// Initialize page when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializePage();
});

// Initialize the page
async function initializePage() {
    try {
        // Listen for auth state changes
        auth.onAuthStateChanged((user) => {
            updateFavoriteButton();
        });
        
        // Get movie slug from URL parameter
        const urlParams = new URLSearchParams(window.location.search);
        const movieSlug = urlParams.get('slug');
        
        if (!movieSlug) {
            showError('Không tìm thấy phim. Vui lòng quay lại trang chủ.');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 3000);
            return;
        }

        // Load movie details
        await loadMovieDetail(movieSlug);
        
        // Wait for watch history to load from Firebase
        await waitForWatchHistory();
        
        // Initialize video player
        initializeVideoPlayer();
        
        // Auto-play latest watched episode from history
        autoPlayLatestEpisode();
        
        // Load related movies
        await loadRelatedMovies();
        
    } catch (error) {
        console.error('Error initializing page:', error);
        showError('Có lỗi xảy ra khi tải trang. Vui lòng thử lại.');
    }
}

// Load movie details
async function loadMovieDetail(slug) {
    try {
        showLoading(true);
        
        const data = await fetchJSONCached(getApiUrl(`${API_BASE}${currentSource.endpoints.detail}/${slug}`));
        
        if (data.status === 'success' || data.status === true) {
            currentMovie = data.movie || data.item || data.data?.item;
            if (currentSourceKey === 'ophim') {
                // Fix OPhim image paths
                const pathImage = data.pathImage || data.data?.pathImage || data.data?.APP_DOMAIN_CDN_IMAGE || '';
                currentMovie.poster_url = resolveOPhimImageUrl(currentMovie.poster_url || '', pathImage);
                currentMovie.thumb_url = resolveOPhimImageUrl(currentMovie.thumb_url || '', pathImage);
                
                // Handle trailer for OPhim
                const isTrailer = (currentMovie.status && currentMovie.status.toLowerCase() === 'trailer') || 
                                  (currentMovie.episode_current && currentMovie.episode_current.toLowerCase().includes('trailer'));
                if (isTrailer) {
                    if (currentMovie.trailer_url) {
                        const embedUrl = convertYoutubeToEmbed(currentMovie.trailer_url);
                        currentMovie.episodes = [
                            {
                                server_name: "Trailer",
                                server_data: [
                                    {
                                        name: "Trailer",
                                        slug: "trailer",
                                        embed: embedUrl,
                                        m3u8: embedUrl
                                    }
                                ],
                                items: [
                                    {
                                        name: "Trailer",
                                        slug: "trailer",
                                        embed: embedUrl,
                                        m3u8: embedUrl
                                    }
                                ]
                            }
                        ];
                    } else {
                        // Nếu link rỗng thì gán episodes rỗng để không chọn tập phim luôn
                        currentMovie.episodes = [];
                    }
                }
            }
            
            await displayMovieDetails();
            updatePageMeta();
            setupEpisodes();
            
            // Update favorite button status
            updateFavoriteButton();
            updatePinButton();
            
            // Store episodes data for server switching
            window.currentMovieEpisodes = currentMovie.episodes;
            window.currentMovieSlug = slug;
            window.currentMoviePosterUrl = currentMovie.poster_url || '';
            window.currentMovieThumbUrl = currentMovie.thumb_url || '';
            
            showLoading(false);
            document.getElementById('movieContent').classList.remove('hidden');
            
            // Auto-scroll to video player after content is loaded
            setTimeout(() => {
                scrollToVideo();
            }, 500);
            
        } else {
            throw new Error('Movie not found');
        }
        
    } catch (error) {
        console.error('Error loading movie details:', error);
        showError('Không thể tải thông tin phim. Vui lòng thử lại.');
        showLoading(false);
    }
}

// Format episode progress for movie detail
function formatEpisodeProgress(currentEpisode, totalEpisodes) {
    if (!currentEpisode) return 'Không rõ';
    
    if (currentEpisode.toLowerCase().includes('trailer')) {
        return 'Trailer';
    }
    
    // If current episode contains "full" or "hoàn tất", just return "Full"
    if (currentEpisode.toLowerCase().includes('full') || 
        currentEpisode.toLowerCase().includes('hoàn tất') ||
        currentEpisode.toLowerCase().includes('completed')) {
        return 'Full';
    }
    
    // If we have both current and total, show "X/Y"
    if (currentEpisode && totalEpisodes) {
        return `${currentEpisode} / ${totalEpisodes}`;
    }
    
    // Default to current episode
    return currentEpisode;
}

// Helper to parse date from various formats
function parseDate(dateObjOrString) {
    if (!dateObjOrString) return null;
    let dateStr = '';
    if (typeof dateObjOrString === 'string') {
        dateStr = dateObjOrString;
    } else if (typeof dateObjOrString === 'object' && dateObjOrString.time) {
        dateStr = dateObjOrString.time;
    } else if (typeof dateObjOrString === 'object' && dateObjOrString.seconds) {
        return new Date(dateObjOrString.seconds * 1000);
    } else {
        dateStr = String(dateObjOrString);
    }
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
}

// Display movie details
async function displayMovieDetails() {
    if (!currentMovie) return;

    // Update basic info
    document.getElementById('movieTitle').textContent = currentMovie.name || currentMovie.title || 'Không có tiêu đề';
    document.getElementById('moviePoster').src = getHeroImage(currentMovie.poster_url, currentMovie.thumb_url);
    document.getElementById('moviePoster').alt = currentMovie.name || currentMovie.title || '';
    
    // Update movie info
    const createdDate = parseDate(currentMovie.created);
    const modifiedDate = parseDate(currentMovie.modified);
    const yearText = createdDate ? createdDate.getFullYear() : (currentMovie.year || currentMovie.release_year || 'Không rõ');
    const dateText = createdDate ? ` (${String(createdDate.getDate()).padStart(2, '0')}/${String(createdDate.getMonth() + 1).padStart(2, '0')}/${createdDate.getFullYear()})` : '';
    const modifiedText = modifiedDate ? `${String(modifiedDate.getDate()).padStart(2, '0')}/${String(modifiedDate.getMonth() + 1).padStart(2, '0')}/${modifiedDate.getFullYear()}` : 'Không rõ';
    document.getElementById('movieYear').textContent = yearText + dateText;
    document.getElementById('movieDuration').textContent = currentMovie.time || 'Không rõ';
    
    const currentEpisode = currentMovie.current_episode || currentMovie.episode_current || '';
    const totalEpisodes = currentMovie.total_episodes || currentMovie.episode_total || '';
    document.getElementById("episodeProgress").textContent = formatEpisodeProgress(currentEpisode, totalEpisodes);
    
    let castsText = 'Không có thông tin diễn viên.';
    if (currentMovie.casts) {
        castsText = currentMovie.casts;
    } else if (currentMovie.actor) {
        if (Array.isArray(currentMovie.actor)) {
            castsText = currentMovie.actor.filter(Boolean).join(', ') || 'Không có thông tin diễn viên.';
        } else if (typeof currentMovie.actor === 'string') {
            castsText = currentMovie.actor;
        }
    }
    document.getElementById('movieCasts').textContent = castsText;
    document.getElementById('movieCategories').textContent = getCategoriesFromCategory(currentMovie.category) || 'Không có thông tin thể loại.';
    document.getElementById('movieDescription').textContent = stripHtml(currentMovie.content || currentMovie.description || 'Không có mô tả.');
    document.getElementById('movieModified').textContent = modifiedText;
    
    // Update breadcrumb
    const firstCategory = getFirstCategory(currentMovie.category);
    document.getElementById('breadcrumbCategory').textContent = firstCategory || 'Phim';
    document.getElementById('breadcrumbMovie').textContent = currentMovie.name || currentMovie.title || 'Không có tiêu đề';
    
    // Load watch time note for this movie
    await loadWatchTimeNote();
    
    // Update structured data for SEO
    updateStructuredData();
}

// Helper function to extract categories from category data
function getCategoriesFromCategory(category) {
    if (!category) return '';
    
    if (Array.isArray(category)) {
        const hasNesting = category.some(item => item.group || item.list);
        if (hasNesting) {
            const categories = category.filter(item => item.group && item.group.name === 'Thể loại')
                                     .flatMap(item => item.list ? item.list.map(cat => cat.name) : []);
            return categories.join(', ');
        } else {
            return category.map(cat => cat.name).filter(Boolean).join(', ');
        }
    } else if (category.list) {
        return category.list.map(cat => cat.name).join(', ');
    } else if (typeof category === 'object') {
        const categories = [];
        Object.values(category).forEach(item => {
            if (item.name) {
                categories.push(item.name);
            } else if (item.group && item.group.name === 'Thể loại' && item.list) {
                item.list.forEach(cat => {
                    if (cat.name) categories.push(cat.name);
                });
            }
        });
        return categories.join(', ');
    }
    
    return '';
}

// Helper function to get first category for breadcrumb
function getFirstCategory(category) {
    if (!category) return '';
    
    if (Array.isArray(category)) {
        const hasNesting = category.some(item => item.group || item.list);
        if (hasNesting) {
            const firstCategory = category.find(item => item.group && item.group.name === 'Thể loại');
            if (firstCategory && firstCategory.list && firstCategory.list.length > 0) {
                return firstCategory.list[0].name;
            }
        } else {
            if (category.length > 0) {
                return category[0].name || '';
            }
        }
    } else if (category.list && category.list.length > 0) {
        return category.list[0].name;
    }
    
    return '';
}

// Update structured data for SEO
function updateStructuredData() {
    if (!currentMovie) return;

    const structuredData = {
        "@context": "https://schema.org",
        "@type": "Movie",
        "name": currentMovie.name || currentMovie.title || 'Không có tiêu đề',
        "description": stripHtml(currentMovie.content || currentMovie.description || 'Không có mô tả.'),
        "url": window.location.href,
        "image": getHeroImage(currentMovie.poster_url, currentMovie.thumb_url),
        "datePublished": currentMovie.year ? `${currentMovie.year}-01-01` : '',
        "director": currentMovie.director ? {
            "@type": "Person",
            "name": Array.isArray(currentMovie.director) ? currentMovie.director.filter(Boolean).join(', ') : currentMovie.director
        } : {},
        "actor": currentMovie.casts 
            ? currentMovie.casts.split(',').map(actor => ({
                "@type": "Person",
                "name": actor.trim()
            })) 
            : (Array.isArray(currentMovie.actor) 
                ? currentMovie.actor.filter(Boolean).map(actor => ({
                    "@type": "Person",
                    "name": actor.trim()
                }))
                : (typeof currentMovie.actor === 'string' 
                    ? currentMovie.actor.split(',').map(actor => ({
                        "@type": "Person",
                        "name": actor.trim()
                    }))
                    : [])),
        "genre": getCategoriesFromCategory(currentMovie.category).split(', ').map(genre => genre.trim()),
        "contentRating": currentMovie.rating ? currentMovie.rating.toString() : '',
        "aggregateRating": currentMovie.rating ? {
            "@type": "AggregateRating",
            "ratingValue": currentMovie.rating.toString(),
            "ratingCount": "1"
        } : {}
    };

    const structuredDataElement = document.getElementById('structuredData');
    if (structuredDataElement) {
        structuredDataElement.textContent = JSON.stringify(structuredData, null, 2);
    }
}

// Update page meta tags for SEO
function updatePageMeta() {
    if (!currentMovie) return;

    const year = currentMovie.year || (parseDate(currentMovie.created) ? parseDate(currentMovie.created).getFullYear() : 'Không rõ');
    const title = `${currentMovie.name || currentMovie.title} - Xem phim HD | CinePhim`;
    const description = `Xem ${currentMovie.name || currentMovie.title} (${year}) online miễn phí với chất lượng HD. ${currentMovie.content ? stripHtml(currentMovie.content).substring(0, 150) + '...' : ''}`;
    
    // Update title and meta description
    document.title = title;
    document.getElementById('pageTitle').textContent = title;
    document.getElementById('pageDescription').content = description;
    
    // Update Open Graph tags
    document.getElementById('ogTitle').content = title;
    document.getElementById('ogDescription').content = description;
    document.getElementById('ogImage').content = getHeroImage(currentMovie.poster_url, currentMovie.thumb_url);
}

// Auto-play episode from URL or latest watched from history
function autoPlayLatestEpisode() {
    if (!currentMovie || !currentMovie.episodes) return;
    
    // First, check if episode parameter is in URL
    const urlParams = new URLSearchParams(window.location.search);
    const episodeSlug = urlParams.get('episode');
    const serverIndex = parseInt(urlParams.get('server')) || 0;
    
    if (episodeSlug) {
        // Set server selection if specified
        if (serverIndex >= 0 && serverIndex < currentMovie.episodes.length) {
            selectServer(serverIndex);
        }
        
        // Find and play the episode
        playEpisodeFromHistory(episodeSlug, serverIndex);
        return;
    }
    
    // If no URL parameter, use history logic
    const movieHistory = watchHistory.filter(item => item.movieSlug === currentMovie.slug);
    
    if (movieHistory.length > 0) {
        // Get latest watched episode
        const latestEpisode = movieHistory[0]; // Most recent is at index 0
        let targetEpisodeSlug = null;
        let targetServerIndex = 0;
        let hasSourceHistory = false;
        
        if (typeof currentSourceKey !== 'undefined') {
            if (currentSourceKey === 'nguonc') {
                if (latestEpisode.episodeSlug_nguonc) {
                    targetEpisodeSlug = latestEpisode.episodeSlug_nguonc;
                    targetServerIndex = latestEpisode.serverIndex_nguonc !== undefined ? latestEpisode.serverIndex_nguonc : 0;
                    hasSourceHistory = true;
                } else if (latestEpisode.episodeSlug && !latestEpisode.videoUrl_ophim) {
                    // Fallback to old history entry
                    targetEpisodeSlug = latestEpisode.episodeSlug;
                    targetServerIndex = latestEpisode.serverIndex || 0;
                    hasSourceHistory = true;
                }
            } else if (currentSourceKey === 'ophim') {
                if (latestEpisode.episodeSlug_ophim) {
                    targetEpisodeSlug = latestEpisode.episodeSlug_ophim;
                    targetServerIndex = latestEpisode.serverIndex_ophim !== undefined ? latestEpisode.serverIndex_ophim : 0;
                    hasSourceHistory = true;
                }
            }
        }
        
        if (hasSourceHistory && targetEpisodeSlug) {
            // Restore server selection and play episode using playEpisodeFromHistory function
            playEpisodeFromHistory(targetEpisodeSlug, targetServerIndex, true);
        } else {
            // If no history for this specific source, play first episode
            playDefaultFirstEpisode();
        }
    } else {
        // If no history or episode not found, play first episode
        playDefaultFirstEpisode();
    }
}

// Function to play default first episode
function playDefaultFirstEpisode() {
    if (currentMovie.episodes.length > 0) {
        const server = currentMovie.episodes[0];
        const items = server.items || server.server_data || [];
        if (items.length > 0) {
            const firstEpisode = items[0];
            let videoUrl = firstEpisode.embed || firstEpisode.link_embed || firstEpisode.m3u8 || firstEpisode.link_m3u8;
            if (typeof currentSourceKey !== 'undefined' && currentSourceKey === 'nguonc') {
                videoUrl = videoUrl || currentMovie.link_m3u8 || currentMovie.link_embed;
            }
            
            playEpisode(firstEpisode.slug, videoUrl);
        }
    }
}

// Setup episodes
function setupEpisodes() {
    const episodesSection = document.getElementById('episodesSection');
    if (!currentMovie || !currentMovie.episodes || currentMovie.episodes.length === 0) {
        if (episodesSection) {
            episodesSection.classList.add('hidden');
        }
        return;
    }
    
    if (episodesSection) {
        episodesSection.classList.remove('hidden');
    }

    const serverSelect = document.getElementById('serverSelect');
    const episodesList = document.getElementById('episodesList');
    
    // Clear existing content
    serverSelect.innerHTML = '';
    episodesList.innerHTML = '';
    
    // Populate server buttons
    const servers = currentMovie.episodes || [];
    servers.forEach((server, index) => {
        const button = document.createElement('button');
        button.className = 'bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg text-sm transition flex items-center';
        button.textContent = server.server_name || `Server ${index + 1}`;
        button.onclick = () => selectServer(index);
        button.dataset.serverIndex = index;
        
        // Add active class for first server
        if (index === 0) {
            button.classList.add('bg-purple-600', 'hover:bg-purple-700');
            button.classList.remove('bg-gray-700', 'hover:bg-gray-600');
        }
        
        serverSelect.appendChild(button);
    });
    
    // Load episodes for first server
    updateEpisodesList();
}

// Get current server index
function getCurrentServerIndex() {
    const serverSelect = document.getElementById('serverSelect');
    const activeButton = serverSelect.querySelector('.bg-purple-600');
    return activeButton ? parseInt(activeButton.dataset.serverIndex) : 0;
}

// Select server
function selectServer(serverIndex) {
    const serverSelect = document.getElementById('serverSelect');
    const buttons = serverSelect.querySelectorAll('button');
    
    // Remove active class from all buttons
    buttons.forEach(button => {
        button.classList.remove('bg-purple-600', 'hover:bg-purple-700');
        button.classList.add('bg-gray-700', 'hover:bg-gray-600');
    });
    
    // Add active class to selected button
    const selectedButton = serverSelect.querySelector(`[data-server-index="${serverIndex}"]`);
    if (selectedButton) {
        selectedButton.classList.add('bg-purple-600', 'hover:bg-purple-700');
        selectedButton.classList.remove('bg-gray-700', 'hover:bg-gray-600');
    }
    
    // Update episodes list
    updateEpisodesListForServer(serverIndex);
    
    // Update URL with server parameter
    updateUrlWithServer(serverIndex);
}

// Update URL with server parameter
function updateUrlWithServer(serverIndex) {
    if (!currentMovie) return;
    
    try {
        const url = new URL(window.location);
        url.searchParams.set('server', serverIndex.toString());
        
        // Update browser URL without page reload
        window.history.pushState({}, '', url);
        
    } catch (error) {
        console.error('Error updating URL:', error);
    }
}

// Update episodes list when server changes
function updateEpisodesList() {
    const serverIndex = getCurrentServerIndex();
    updateEpisodesListForServer(serverIndex);
}

// Update episodes list for specific server
function updateEpisodesListForServer(serverIndex) {
    const episodesList = document.getElementById('episodesList');
    
    if (!episodesList || !currentMovie || !currentMovie.episodes) return;
    
    const server = currentMovie.episodes[serverIndex];
    
    if (server) {
        const items = server.items || server.server_data || [];
        const totalEpisodes = items.length;
        
        // Reset to page 1 if server changes
        if (currentServerIndex !== serverIndex) {
            currentEpisodePage = 1;
        }
        
        // Calculate pagination
        const startIndex = (currentEpisodePage - 1) * episodesPerPage;
        const endIndex = Math.min(startIndex + episodesPerPage, totalEpisodes);
        const paginatedEpisodes = [...items].reverse().slice(startIndex, endIndex);
        
        // Display episodes for current page
        episodesList.innerHTML = paginatedEpisodes.map((episode, index) => {
            const slug = episode.slug;
            const embed = episode.embed || episode.link_embed;
            const m3u8 = episode.m3u8 || episode.link_m3u8;
            const name = episode.name || `Tập ${totalEpisodes - (startIndex + index)}`;
            
            return `
                <button onclick="playEpisode('${slug}', '${embed || m3u8}')" 
                        class="bg-purple-600 hover:bg-purple-700 px-3 py-2 rounded text-sm transition ${isEpisodeWatched(slug, currentMovie.slug) ? 'ring-2 ring-blue-500' : ''}">
                    ${name}
                    ${isEpisodeWatched(slug, currentMovie.slug) ? '<i class="fas fa-check-circle text-xs ml-1"></i>' : ''}
                </button>
            `;
        }).join('');
        
        // Update pagination if needed
        updateEpisodesPagination(totalEpisodes);
        
        // Update navigation buttons state
        updateNavigationButtons();
    }
}

// Update episodes pagination
function updateEpisodesPagination(totalEpisodes) {
    const paginationContainer = document.getElementById('episodesPagination');
    
    if (!paginationContainer) return;
    
    // Only show pagination if more than 50 episodes
    if (totalEpisodes <= episodesPerPage) {
        paginationContainer.innerHTML = '';
        return;
    }
    
    const totalPages = Math.ceil(totalEpisodes / episodesPerPage);
    let paginationHTML = '';
    
    // Previous button
    paginationHTML += `
        <button onclick="goToEpisodePage(${currentEpisodePage - 1})" 
                class="px-3 py-2 rounded-lg text-sm font-medium transition ${
                    currentEpisodePage === 1 
                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed' 
                    : 'bg-gray-700 text-white hover:bg-gray-600'
                }" 
                ${currentEpisodePage === 1 ? 'disabled' : ''}>
            <i class="fas fa-chevron-left"></i>
        </button>
    `;
    
    // Page numbers (max 5 visible pages)
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentEpisodePage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage < maxVisiblePages - 1) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    if (startPage > 1) {
        paginationHTML += `
            <button onclick="goToEpisodePage(1)" class="px-3 py-2 rounded-lg text-sm font-medium bg-gray-700 text-white hover:bg-gray-600 transition">1</button>
        `;
        if (startPage > 2) {
            paginationHTML += `<span class="px-2 text-gray-400">...</span>`;
        }
    }
    
    for (let i = startPage; i <= endPage; i++) {
        paginationHTML += `
            <button onclick="goToEpisodePage(${i})" 
                    class="px-3 py-2 rounded-lg text-sm font-medium transition ${
                        i === currentEpisodePage 
                        ? 'bg-purple-600 text-white' 
                        : 'bg-gray-700 text-white hover:bg-gray-600'
                    }">
                ${i}
            </button>
        `;
    }
    
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            paginationHTML += `<span class="px-2 text-gray-400">...</span>`;
        }
        paginationHTML += `
            <button onclick="goToEpisodePage(${totalPages})" class="px-3 py-2 rounded-lg text-sm font-medium bg-gray-700 text-white hover:bg-gray-600 transition">${totalPages}</button>
        `;
    }
    
    // Next button
    paginationHTML += `
        <button onclick="goToEpisodePage(${currentEpisodePage + 1})" 
                class="px-3 py-2 rounded-lg text-sm font-medium transition ${
                    currentEpisodePage === totalPages 
                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed' 
                    : 'bg-gray-700 text-white hover:bg-gray-600'
                }" 
                ${currentEpisodePage === totalPages ? 'disabled' : ''}>
            <i class="fas fa-chevron-right"></i>
        </button>
    `;
    
    paginationContainer.innerHTML = paginationHTML;
}

// Go to specific episode page
function goToEpisodePage(page) {
    const serverIndex = getCurrentServerIndex();
    const server = currentMovie.episodes[serverIndex];
    
    if (!server) return;
    const items = server.items || server.server_data || [];
    
    const totalPages = Math.ceil(items.length / episodesPerPage);
    
    if (page < 1 || page > totalPages) return;
    
    currentEpisodePage = page;
    updateEpisodesListForServer(serverIndex);
    
    // Scroll to episodes section
    const episodesSection = document.getElementById('episodesSection');
    if (episodesSection) {
        episodesSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// Initialize video player
function initializeVideoPlayer() {
    const iframeElement = document.getElementById('videoPlayer');
    if (!iframeElement) {
        console.error('Video iframe not found');
        return;
    }
    
}

// Play episode
function playEpisode(episodeSlug, videoUrl) {
    const iframeElement = document.getElementById('videoPlayer');
    
    if (!iframeElement) {
        showError('Không tìm thấy player video. Vui lòng tải lại trang.');
        return;
    }

    if (!videoUrl) {
        showError('Không tìm thấy link video. Vui lòng chọn tập khác.');
        return;
    }

    try {
        // Find episode index
        currentEpisodeIndex = findEpisodeIndex(episodeSlug);
        
        // Log video URL for debugging
        // Update iframe src with embed URL
        iframeElement.src = videoUrl;
        
        // Update current episode display
        updateCurrentEpisodeDisplay(episodeSlug);
        
        // Update page title with episode number
        updatePageTitleWithEpisode(episodeSlug);
        
        // Update navigation buttons state
        updateNavigationButtons();
        
        // Update URL with episode parameter
        updateUrlWithEpisode(episodeSlug);
        
        // Auto-scroll to video player when episode changes
        setTimeout(() => {
            scrollToVideo();
        }, 300);
        
        // Save to watch history
        saveToWatchHistory(currentMovie.slug, episodeSlug);
        
        // Update episodes list to show watched status
        updateEpisodesList();
        
        // Mark as watched after 5 seconds (simulating watching)
        setTimeout(() => {
            markEpisodeAsWatched(currentMovie.slug, currentEpisodeIndex);
        }, 5000);
        
    } catch (error) {
        console.error('Error playing episode:', error);
        showError('Có lỗi xảy ra khi phát video: ' + error.message + '. Vui lòng thử lại.');
    }
}

// Update URL with episode parameter
function updateUrlWithEpisode(episodeSlug) {
    if (!currentMovie || !episodeSlug) return;
    
    try {
        const url = new URL(window.location);
        url.searchParams.set('episode', episodeSlug);
        url.searchParams.set('server', getCurrentServerIndex().toString());
        
        // Update browser URL without page reload
        window.history.pushState({}, '', url);
        
    } catch (error) {
        console.error('Error updating URL:', error);
    }
}

// Save to watch history
function saveToWatchHistory(movieSlug, episodeSlug) {
    if (!isUserLoggedIn()) return;

    const movieTitle = currentMovie.name || currentMovie.title || movieSlug;
    const episodeName = getEpisodeName(episodeSlug);
    const watchedAt = new Date().toISOString();
    
    // Get current server index
    const serverIndex = getCurrentServerIndex();
    const serverName = currentMovie.episodes && currentMovie.episodes[serverIndex] ? 
                      currentMovie.episodes[serverIndex].server_name : 'Server 1';
    
    // Get existing history item if any
    let existingItem = watchHistory.find(item => item.movieSlug === movieSlug);
    
    // Create base history item preserving existing data
    let historyItem = existingItem ? { ...existingItem } : {
        movieSlug: movieSlug,
        movieTitle: movieTitle
    };
    
    // Always update these base fields to the latest watched
    historyItem.episodeSlug = episodeSlug;
    historyItem.episodeName = episodeName;
    historyItem.serverIndex = serverIndex;
    historyItem.serverName = serverName;
    historyItem.watchedAt = watchedAt;
    historyItem.poster_url = currentMovie.poster_url || '';
    historyItem.thumb_url = currentMovie.thumb_url || '';
    
    // Always save videoUrl for compatibility
    historyItem.videoUrl = getCurrentVideoUrl();
    
    // Save source-specific data
    if (typeof currentSourceKey !== 'undefined') {
        historyItem.source = currentSourceKey;
        if (currentSourceKey === 'nguonc') {
            historyItem.videoUrl_nguonc = historyItem.videoUrl;
            historyItem.episodeSlug_nguonc = episodeSlug;
            historyItem.serverIndex_nguonc = serverIndex;
            historyItem.serverName_nguonc = serverName;
        } else if (currentSourceKey === 'ophim') {
            historyItem.videoUrl_ophim = historyItem.videoUrl;
            historyItem.episodeSlug_ophim = episodeSlug;
            historyItem.serverIndex_ophim = serverIndex;
            historyItem.serverName_ophim = serverName;
        }
    }
    
    // Remove undefined values to prevent Firebase errors
    Object.keys(historyItem).forEach(key => {
        if (historyItem[key] === undefined) {
            delete historyItem[key];
        }
    });
    
    // Remove existing entry for this movie (ghi đè)
    watchHistory = watchHistory.filter(item => item.movieSlug !== movieSlug);
    
    // Add new entry at the beginning
    watchHistory.unshift(historyItem);
    
    // Keep only last 50 items
    if (watchHistory.length > 50) {
        watchHistory = watchHistory.slice(0, 50);
    }
    
    // Save to Firebase immediately if user is logged in
    const user = auth.currentUser;
    if (user) {
        saveSingleWatchHistoryItem(historyItem);
    }
    
}


function getEpisodeName(episodeSlug) {
    if (!currentMovie || !currentMovie.episodes) return episodeSlug;
    
    for (let server of currentMovie.episodes) {
        const items = server.items || server.server_data || [];
        const episode = items.find(ep => ep.slug === episodeSlug);
        if (episode) {
            return episode.name || `Tập ${items.indexOf(episode) + 1}`;
        }
    }
    return episodeSlug;
}

// Get current video URL
function getCurrentVideoUrl() {
    const iframeElement = document.getElementById('videoPlayer');
    return iframeElement ? iframeElement.src : '';
}

// Mark episode as watched
function markEpisodeAsWatched(movieSlug, episodeIndex) {
    if (!isUserLoggedIn()) return;
    
    const user = auth.currentUser;
    if (!user) return;
    
    // Save to users collection
    const userRef = db.collection('users').doc(user.uid);
    
    userRef.get().then((doc) => {
        const userData = doc.exists ? doc.data() : {};
        const watched = userData.watchedEpisodes || [];
        const episodeKey = `${movieSlug}_${episodeIndex}`;
        
        if (!watched.includes(episodeKey)) {
            watched.push(episodeKey);
            return userRef.set({
                watchedEpisodes: watched,
                lastUpdated: new Date()
            }, { merge: true });
        }
    }).catch((error) => {
        console.error('Error marking episode as watched:', error);
    });
}

// Check if episode is watched
function isEpisodeWatched(episodeSlug, movieSlug = null) {
    const slugToCheck = movieSlug || currentMovie.slug;
    return watchHistory.some(item => 
        item.movieSlug === slugToCheck && 
        item.episodeSlug === episodeSlug
    );
}

// Play previous episode
function playPreviousEpisode() {
    if (!currentMovie || !currentMovie.episodes || currentMovie.episodes.length === 0) return;
    
    const serverIndex = getCurrentServerIndex();
    const server = currentMovie.episodes[serverIndex];
    
    if (!server) return;
    const items = server.items || server.server_data || [];
    if (items.length === 0) return;
    
    // Find current episode in the list
    const currentEpisode = items.find(ep => ep.slug === getCurrentEpisodeSlug());
    if (!currentEpisode) return;
    
    const currentIndex = items.indexOf(currentEpisode);
    
    // Check if there's a previous episode
    if (currentIndex > 0) {
        const previousEpisode = items[currentIndex - 1];
        playEpisode(previousEpisode.slug, previousEpisode.embed || previousEpisode.link_embed || previousEpisode.m3u8 || previousEpisode.link_m3u8);
    } else {
        showInfo('Đây là tập đầu tiên.');
    }
}

// Play next episode
function playNextEpisode() {
    if (!currentMovie || !currentMovie.episodes || currentMovie.episodes.length === 0) return;
    
    const serverIndex = getCurrentServerIndex();
    const server = currentMovie.episodes[serverIndex];
    
    if (!server) return;
    const items = server.items || server.server_data || [];
    if (items.length === 0) return;
    
    // Find current episode in the list
    const currentEpisode = items.find(ep => ep.slug === getCurrentEpisodeSlug());
    if (!currentEpisode) {
        // If no current episode, play the first one
        const firstEpisode = items[0];
        playEpisode(firstEpisode.slug, firstEpisode.embed || firstEpisode.link_embed || firstEpisode.m3u8 || firstEpisode.link_m3u8);
        return;
    }
    
    const currentIndex = items.indexOf(currentEpisode);
    
    // Check if there's a next episode
    if (currentIndex < items.length - 1) {
        const nextEpisode = items[currentIndex + 1];
        playEpisode(nextEpisode.slug, nextEpisode.embed || nextEpisode.link_embed || nextEpisode.m3u8 || nextEpisode.link_m3u8);
    } else {
        showInfo('Đây là tập cuối cùng.');
    }
}

// Get current episode slug
function getCurrentEpisodeSlug() {
    const iframeElement = document.getElementById('videoPlayer');
    if (!iframeElement || !iframeElement.src || iframeElement.src === 'about:blank') {
        return null;
    }
    
    // Find the episode that matches the current video URL
    for (let server of currentMovie.episodes) {
        const items = server.items || server.server_data || [];
        const episode = items.find(ep => 
            (ep.embed && iframeElement.src.includes(ep.embed)) || 
            (ep.link_embed && iframeElement.src.includes(ep.link_embed)) || 
            (ep.m3u8 && iframeElement.src.includes(ep.m3u8)) || 
            (ep.link_m3u8 && iframeElement.src.includes(ep.link_m3u8))
        );
        if (episode) {
            return episode.slug;
        }
    }
    
    return null;
}

// Update current episode display
function updateCurrentEpisodeDisplay(episodeSlug) {
    const displayElement = document.getElementById('currentEpisodeDisplay');
    if (!displayElement) return;
    
    const episodeName = getEpisodeName(episodeSlug);
    displayElement.textContent = episodeName;
}

// Update page title with episode number
function updatePageTitleWithEpisode(episodeSlug) {
    if (!currentMovie || !episodeSlug) return;
    
    const episodeName = getEpisodeName(episodeSlug);
    const title = `${currentMovie.name || currentMovie.title} - ${episodeName}`;
    
    // Update document title and meta tags
    document.title = title;
    document.getElementById('pageTitle').textContent = title;
    document.getElementById('ogTitle').content = title;
}

// Update navigation buttons state
function updateNavigationButtons() {
    const prevButton = document.querySelector('button[onclick="playPreviousEpisode()"]');
    const nextButton = document.querySelector('button[onclick="playNextEpisode()"]');
    
    if (!prevButton || !nextButton || !currentMovie || !currentMovie.episodes) return;
    
    const serverIndex = getCurrentServerIndex();
    const server = currentMovie.episodes[serverIndex];
    
    if (!server) return;
    const items = server.items || server.server_data || [];
    if (items.length === 0) {
        prevButton.disabled = true;
        nextButton.disabled = true;
        prevButton.classList.add('opacity-50', 'cursor-not-allowed');
        nextButton.classList.add('opacity-50', 'cursor-not-allowed');
        return;
    }
    
    const currentEpisode = items.find(ep => ep.slug === getCurrentEpisodeSlug());
    if (!currentEpisode) {
        // Enable next button if no current episode (can play first)
        prevButton.disabled = true;
        nextButton.disabled = false;
        prevButton.classList.add('opacity-50', 'cursor-not-allowed');
        nextButton.classList.remove('opacity-50', 'cursor-not-allowed');
        return;
    }
    
    const currentIndex = items.indexOf(currentEpisode);
    
    // Update previous button state
    if (currentIndex <= 0) {
        prevButton.disabled = true;
        prevButton.classList.add('opacity-50', 'cursor-not-allowed');
    } else {
        prevButton.disabled = false;
        prevButton.classList.remove('opacity-50', 'cursor-not-allowed');
    }
    
    // Update next button state
    if (currentIndex >= items.length - 1) {
        nextButton.disabled = true;
        nextButton.classList.add('opacity-50', 'cursor-not-allowed');
    } else {
        nextButton.disabled = false;
        nextButton.classList.remove('opacity-50', 'cursor-not-allowed');
    }
}

// Show info message
function showInfo(message) {
    Swal.fire({
        icon: 'info',
        title: 'Thông báo',
        text: message,
        confirmButtonColor: '#8b5cf6',
        timer: 2000,
        showConfirmButton: false
    });
}

// Find episode index by slug
function findEpisodeIndex(episodeSlug) {
    if (!currentMovie || !currentMovie.episodes) return 0;
    
    for (let server of currentMovie.episodes) {
        const items = server.items || server.server_data || [];
        const index = items.findIndex(ep => ep.slug === episodeSlug);
        if (index !== -1) return index;
    }
    return 0;
}

// Load related movies
async function loadRelatedMovies() {
    try {
        if (!currentMovie || !currentMovie.category) return;

        // Lấy category đầu tiên để tìm phim liên quan
        let categoryData = null;
        
        // Check if category is an array or object
        if (Array.isArray(currentMovie.category)) {
            categoryData = currentMovie.category.find(item => item.group && item.group.name === 'Thể loại');
        } else if (currentMovie.category.list) {
            categoryData = currentMovie.category;
        }
        
        if (!categoryData || !categoryData.list || categoryData.list.length === 0) return;
        
        const categorySlug = categoryData.list[0].slug;
        const data = await fetchJSONCached(getApiUrl(`${API_BASE}/films/category/${categorySlug}?page=1`));
        
        if (data.status === 'success' && data.items) {
            displayRelatedMovies(data.items);
        }
        
    } catch (error) {
        console.error('Error loading related movies:', error);
    }
}

// Display related movies
function displayRelatedMovies(movies) {
    const relatedMoviesContainer = document.getElementById('relatedMovies');
    if (!relatedMoviesContainer) return;

    // Filter out current movie and limit to 8 movies
    const relatedMovies = movies
        .filter(movie => movie.slug !== currentMovie.slug)
        .slice(0, 8);

    if (relatedMovies.length === 0) {
        relatedMoviesContainer.innerHTML = '<p class="text-gray-400">Không có phim liên quan.</p>';
        return;
    }

    relatedMoviesContainer.innerHTML = relatedMovies.map(movie => `
        <div class="bg-gray-700 rounded-lg overflow-hidden hover:transform hover:scale-105 transition cursor-pointer" onclick="goToMovieDetail('${movie.slug}')">
            <img src="${getVerticalImage(movie.poster_url, movie.thumb_url)}" 
             alt="${movie.name || movie.title}" 
             loading="lazy" decoding="async" class="w-full h-48 object-cover"
             onerror="this.src='https://via.placeholder.com/300x450/374151/ffffff?text=No+Poster'">
            <div class="p-3">
                <h4 class="font-medium text-sm truncate">${movie.name || movie.title}</h4>
                <p class="text-xs text-gray-400 mt-1">${movie.year || ''}</p>
            </div>
        </div>
    `).join('');
}

// Go to movie detail page
function goToMovieDetail(slug) {
    window.location.href = `movie-detail.html?slug=${slug}`;
}

// Toggle favorite
function toggleFavorite() {
    if (!isUserLoggedIn()) {
        showLoginModal();
        return;
    }

    if (!currentMovie) {
        showError('Không có thông tin phim');
        return;
    }

    const user = auth.currentUser;
    const userRef = db.collection('users').doc(user.uid);
    const favoritesRef = userRef.collection('favorites');
    
    // Check if movie is already in favorites
    favoritesRef.where('slug', '==', currentMovie.slug).get().then((snapshot) => {
        if (snapshot.empty) {
            // Add to favorites
            const movieData = {
                slug: currentMovie.slug || '',
                title: currentMovie.name || currentMovie.title || '',
                name: currentMovie.name || currentMovie.title || '',
                source: currentSourceKey || '',
                addedAt: new Date().toISOString()
            };
            
            favoritesRef.add(movieData).then(() => {
                showSuccess('Đã thêm vào danh sách yêu thích');
                updateFavoriteButton();
            }).catch((error) => {
                console.error('Error adding to favorites:', error);
                showError('Không thể thêm vào yêu thích: ' + error.message);
            });
        } else {
            // Remove from favorites
            const batch = db.batch();
            snapshot.forEach(doc => {
                batch.delete(doc.ref);
            });
            batch.commit().then(() => {
                showSuccess('Đã xóa khỏi danh sách yêu thích');
                // Reload page after successful removal
                setTimeout(() => {
                    window.location.reload();
                }, 1500);
            }).catch((error) => {
                console.error('Error removing from favorites:', error);
                showError('Không thể xóa khỏi yêu thích: ' + error.message);
            });
        }
    }).catch((error) => {
        console.error('Error querying favorites:', error);
        showError('Lỗi khi kiểm tra danh sách yêu thích: ' + error.message);
    });
}

// Update favorite button text
function updateFavoriteButton() {
    const favoriteBtn = document.querySelector('button[onclick="toggleFavorite()"]');
    if (!favoriteBtn) return;
    
    if (!currentMovie) {
        favoriteBtn.innerHTML = '<i class="fas fa-heart mr-2"></i>Thêm vào yêu thích';
        return;
    }
    
    if (!isUserLoggedIn()) {
        favoriteBtn.innerHTML = '<i class="fas fa-heart mr-2"></i>Thêm vào yêu thích';
        return;
    }
    
    const user = auth.currentUser;
    const favoritesRef = db.collection('users').doc(user.uid).collection('favorites');
    
    favoritesRef.where('slug', '==', currentMovie.slug).get().then((snapshot) => {
        if (snapshot.empty) {
            favoriteBtn.innerHTML = '<i class="fas fa-heart mr-2"></i>Thêm vào yêu thích';
        } else {
            favoriteBtn.innerHTML = '<i class="fas fa-heart mr-2"></i>Bỏ yêu thích';
        }
    }).catch((error) => {
        console.error('Error checking favorite status:', error);
        favoriteBtn.innerHTML = '<i class="fas fa-heart mr-2"></i>Thêm vào yêu thích';
    });
}

// Update pin button text and state
function updatePinButton() {
    const pinBtn = document.querySelector('button[onclick="togglePinMovie()"]');
    if (!pinBtn) return;
    
    if (!currentMovie) {
        pinBtn.innerHTML = '<i class="fas fa-thumbtack mr-2"></i>Ghim phim';
        pinBtn.classList.remove('bg-gray-600', 'hover:bg-gray-700');
        pinBtn.classList.add('bg-yellow-600', 'hover:bg-yellow-700');
        return;
    }
    
    if (!isUserLoggedIn()) {
        // Check localStorage for non-logged in users
        const pinnedMovies = JSON.parse(localStorage.getItem('pinnedMovies') || '[]');
        const isPinned = pinnedMovies.some(pin => pin.slug === currentMovie.slug);
        
        if (isPinned) {
            pinBtn.innerHTML = '<i class="fas fa-thumbtack mr-2"></i>Bỏ ghim';
            pinBtn.classList.remove('bg-yellow-600', 'hover:bg-yellow-700');
            pinBtn.classList.add('bg-gray-600', 'hover:bg-gray-700');
        } else {
            pinBtn.innerHTML = '<i class="fas fa-thumbtack mr-2"></i>Ghim phim';
            pinBtn.classList.remove('bg-gray-600', 'hover:bg-gray-700');
            pinBtn.classList.add('bg-yellow-600', 'hover:bg-yellow-700');
        }
        return;
    }
    
    const user = auth.currentUser;
    const pinnedRef = db.collection('users').doc(user.uid).collection('pinnedMovies');
    
    pinnedRef.where('slug', '==', currentMovie.slug).get().then((snapshot) => {
        if (snapshot.empty) {
            pinBtn.innerHTML = '<i class="fas fa-thumbtack mr-2"></i>Ghim phim';
            pinBtn.classList.remove('bg-gray-600', 'hover:bg-gray-700');
            pinBtn.classList.add('bg-yellow-600', 'hover:bg-yellow-700');
        } else {
            pinBtn.innerHTML = '<i class="fas fa-thumbtack mr-2"></i>Bỏ ghim';
            pinBtn.classList.remove('bg-yellow-600', 'hover:bg-yellow-700');
            pinBtn.classList.add('bg-gray-600', 'hover:bg-gray-700');
        }
    }).catch((error) => {
        console.error('Error checking pin status:', error);
        pinBtn.innerHTML = '<i class="fas fa-thumbtack mr-2"></i>Ghim phim';
        pinBtn.classList.remove('bg-gray-600', 'hover:bg-gray-700');
        pinBtn.classList.add('bg-yellow-600', 'hover:bg-yellow-700');
    });
}

// Toggle pin for current movie
async function togglePinMovie() {
    if (!currentMovie) {
        showError('Không tìm thấy thông tin phim');
        return;
    }
    
    if (!isUserLoggedIn()) {
        showError('Vui lòng đăng nhập để ghim phim');
        return;
    }
    
    // Call the global togglePin function from common.js with movie data
    await window.togglePin(currentMovie.slug, currentMovie);
}

// Toggle watch history section
function toggleWatchHistory() {
    const watchHistorySection = document.getElementById('watchHistorySection');
    if (watchHistorySection) {
        watchHistorySection.classList.toggle('hidden');
        
        if (!watchHistorySection.classList.contains('hidden')) {
            loadWatchHistory();
        }
    }
}

// Load watch history for current movie
function loadWatchHistory() {
    if (!isUserLoggedIn() || !currentMovie) return;

    // Use global watchHistory variable like the old system
    const movieHistory = watchHistory.filter(item => item.movieSlug === currentMovie.slug);
    
    if (movieHistory.length === 0) {
        displayWatchHistory([]);
    } else {
        displayWatchHistory(movieHistory);
    }
}

// Display watch history
function displayWatchHistory(history) {
    const watchHistoryGrid = document.getElementById('watchHistoryGrid');
    if (!watchHistoryGrid) return;

    if (history.length === 0) {
        watchHistoryGrid.innerHTML = '<p class="text-gray-400">Chưa có lịch sử xem phim này.</p>';
        return;
    }

    // Since we only have latest entry per movie, no need to sort
    watchHistoryGrid.innerHTML = history.map(item => `
        <div class="bg-gray-700 rounded-lg p-3 flex justify-between items-center">
            <div class="flex-1">
                <p class="font-medium">${item.episodeName || 'Tập không xác định'}</p>
                <p class="text-xs text-gray-400 mt-1">
                    <i class="fas fa-server mr-1"></i>${item.serverName || 'Server 1'}
                </p>
            </div>
            <button onclick="playEpisodeFromHistory('${item.episodeSlug}', ${item.serverIndex || 0})" class="bg-purple-600 hover:bg-purple-700 px-3 py-1 rounded text-sm">
                <i class="fas fa-play"></i>
            </button>
        </div>
    `).join('');
}

// Play episode from history with server selection
function playEpisodeFromHistory(episodeSlug, serverIndex, fromHistory = false) {
    if (!currentMovie || !currentMovie.episodes) return;
    
    // Set server selection
    if (currentMovie.episodes[serverIndex]) {
        selectServer(serverIndex);
    }
    
    // Find and play the episode
    const server = currentMovie.episodes[serverIndex];
    if (server) {
        const items = server.items || server.server_data || [];
        const episode = items.find(ep => ep.slug === episodeSlug);
        
        // Find history item to get saved URL
        const historyItem = watchHistory.find(item => item.movieSlug === currentMovie.slug);
        
        let savedVideoUrl = null;
        if (historyItem && typeof currentSourceKey !== 'undefined') {
            if (currentSourceKey === 'nguonc') {
                savedVideoUrl = historyItem.videoUrl_nguonc;
            } else if (currentSourceKey === 'ophim') {
                savedVideoUrl = historyItem.videoUrl_ophim;
            }
        } else if (historyItem) {
            savedVideoUrl = historyItem.videoUrl;
        }
        
        if (episode) {
            const episodeUrl = episode.embed || episode.link_embed || episode.m3u8 || episode.link_m3u8;
            let videoUrlToPlay = '';
            
            if (typeof currentSourceKey !== 'undefined') {
                if (currentSourceKey === 'nguonc') {
                    // Ưu tiên thứ tự load cho nguonC: videoUrl lưu -> link riêng tập -> link chung
                    videoUrlToPlay = savedVideoUrl || episodeUrl || currentMovie.link_m3u8 || currentMovie.link_embed;
                } else if (currentSourceKey === 'ophim') {
                    // Load đúng videoUrl đã lưu của OPhim
                    videoUrlToPlay = savedVideoUrl || episodeUrl;
                } else {
                    videoUrlToPlay = savedVideoUrl || episodeUrl;
                }
            } else {
                videoUrlToPlay = savedVideoUrl || episodeUrl;
            }
            
            if (videoUrlToPlay) {
                playEpisode(episode.slug, videoUrlToPlay);
            } else {
                showError('Không tìm thấy link video cho tập này.');
            }
        } else if (savedVideoUrl && fromHistory) {
            // Even if episode not found, play saved URL
            playEpisode(episodeSlug, savedVideoUrl);
        } else {
            showError('Không tìm thấy tập phim trong server này.');
        }
    } else {
        showError('Không tìm thấy server.');
    }
}

// Show/hide loading
function showLoading(show) {
    const loading = document.getElementById('loading');
    if (loading) {
        loading.classList.toggle('hidden', !show);
    }
}

// Utility functions
function showError(message) {
    Swal.fire({
        icon: 'error',
        title: 'Lỗi',
        text: message,
        confirmButtonColor: '#8b5cf6'
    });
}

function showSuccess(message) {
    Swal.fire({
        icon: 'success',
        title: 'Thành công',
        text: message,
        timer: 2000,
        showConfirmButton: false
    });
}

// Handle search
document.getElementById('searchInput')?.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        const query = e.target.value.trim();
        if (query) {
            window.location.href = `index.html?search=${encodeURIComponent(query)}`;
        }
    }
});

document.getElementById('mobileSearchInput')?.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        const query = e.target.value.trim();
        if (query) {
            window.location.href = `index.html?search=${encodeURIComponent(query)}`;
        }
    }
});

// Watch Time Note Functions
function saveWatchTimeNote() {
    if (!currentMovie) return;
    
    const noteInput = document.getElementById('watchTimeNote');
    const note = noteInput.value.trim();
    
    // If user is logged in, save to Firebase
    if (auth.currentUser) {
        saveWatchTimeNoteToFirebase(note);
        showSuccess('Đã lưu ghi chú thời gian xem');
    } else {
        showInfo('Vui lòng đăng nhập để lưu ghi chú');
    }
}

// Load watch time note for current movie
async function loadWatchTimeNote() {
    if (!currentMovie) return;
    
    const noteInput = document.getElementById('watchTimeNote');
    if (!noteInput) return;
    
    // Wait a moment for Firebase to be ready
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Check directly for current user
    if (auth.currentUser) {
        await loadWatchTimeNoteFromFirebase();
    }
}

// Save watch time note to Firebase
async function saveWatchTimeNoteToFirebase(note) {
    if (!auth.currentUser || !currentMovie) return;
    
    try {
        const userRef = db.collection('users').doc(auth.currentUser.uid);
        const notesRef = userRef.collection('watchTimeNotes');
        
        // Remove existing note for this movie
        const existingDocs = await notesRef.where('movieSlug', '==', currentMovie.slug).get();
        const batch = db.batch();
        
        existingDocs.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        // Add new note if not empty
        if (note) {
            const noteData = {
                movieSlug: currentMovie.slug,
                movieTitle: currentMovie.name || currentMovie.title,
                note: note,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            
            const docRef = notesRef.doc();
            batch.set(docRef, noteData);
        }
        
        await batch.commit();
    } catch (error) {
        console.error('Error saving watch time note to Firebase:', error);
    }
}

// Load watch time note from Firebase
async function loadWatchTimeNoteFromFirebase() {
    if (!auth.currentUser || !currentMovie) return;
    
    try {
        const userRef = db.collection('users').doc(auth.currentUser.uid);
        const notesRef = userRef.collection('watchTimeNotes');
        
        const snapshot = await notesRef.where('movieSlug', '==', currentMovie.slug).get();
        
        if (!snapshot.empty) {
            const noteDoc = snapshot.docs[0];
            const noteData = noteDoc.data();
            
            const noteInput = document.getElementById('watchTimeNote');
            if (noteInput && noteData.note) {
                noteInput.value = noteData.note;
            }
        }
    } catch (error) {
        console.error('Error loading watch time note from Firebase:', error);
    }
}

// Virtual Keyboard Functions
function toggleVirtualKeyboard() {
    const keyboard = document.getElementById('virtualKeyboard');
    if (keyboard) {
        keyboard.classList.toggle('hidden');
    }
}

function insertToNote(character) {
    const noteInput = document.getElementById('watchTimeNote');
    if (noteInput) {
        // Get current cursor position
        const start = noteInput.selectionStart;
        const end = noteInput.selectionEnd;
        const currentValue = noteInput.value;
        
        // Insert character at cursor position
        const newValue = currentValue.substring(0, start) + character + currentValue.substring(end);
        noteInput.value = newValue;
        
        // Set cursor position after inserted character
        const newPosition = start + character.length;
        noteInput.setSelectionRange(newPosition, newPosition);
        
        // Focus back to input
        noteInput.focus();
    }
}

// Clear and save watch time note
async function clearAndSaveNote() {
    const noteInput = document.getElementById('watchTimeNote');
    if (noteInput) {
        // Clear the input
        noteInput.value = '';
        
        // Save empty note to Firebase/localStorage to clear previous note
        if (isUserLoggedIn()) {
            try {
                // Clear from Firebase - use where clause to find and delete all matching documents
                const userRef = db.collection('users').doc(auth.currentUser.uid);
                const notesRef = userRef.collection('watchTimeNotes');
                
                // Find all documents for this movie
                const snapshot = await notesRef.where('movieSlug', '==', currentMovie.slug).get();
                
                // Delete all matching documents
                const batch = db.batch();
                snapshot.forEach(doc => {
                    batch.delete(doc.ref);
                });
                
                await batch.commit();
                
                // Clear from localStorage
                const watchTimeNotes = JSON.parse(localStorage.getItem('watchTimeNotes') || '{}');
                delete watchTimeNotes[currentMovie.slug];
                localStorage.setItem('watchTimeNotes', JSON.stringify(watchTimeNotes));
                
                showInfo('Ghi chú đã được xóa');
            } catch (error) {
                console.error('Error clearing watch time note:', error);
                showError('Không thể xóa ghi chú. Vui lòng thử lại.');
            }
        } else {
            // Clear from localStorage only if not logged in
            const watchTimeNotes = JSON.parse(localStorage.getItem('watchTimeNotes') || '{}');
            delete watchTimeNotes[currentMovie.slug];
            localStorage.setItem('watchTimeNotes', JSON.stringify(watchTimeNotes));
            
            showInfo('Ghi chú đã được xóa');
        }
    }
}

// Clear note input only
function clearNote() {
    const noteInput = document.getElementById('watchTimeNote');
    if (noteInput) {
        noteInput.value = '';
    }
}

