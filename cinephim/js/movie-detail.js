// Movie Detail Page JavaScript
let currentMovie = null;
let currentEpisodeIndex = 0;
let currentServerIndex = 0;
let currentEpisodePage = 1;
let episodesPerPage = 50;
let currentEpisodeSlug = null;

function copyMovieAPI() {
    const urlParams = new URLSearchParams(window.location.search);
    const slug = urlParams.get('slug');
    if (!slug) return;
    const url = getApiUrl(`${API_BASE}${currentSource.endpoints.detail}/${slug}`);
    navigator.clipboard.writeText(url).then(() => {
        showToast('Đã copy API!', 'success');
    }).catch(() => {
        const ta = document.createElement('textarea');
        ta.value = url;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast('Đã copy API!', 'success');
    });
}

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
document.addEventListener('DOMContentLoaded', async function() {
    await window.ensureConfigReady();
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
        showLoading();
        
        const data = await fetchJSONCached(getApiUrl(`${API_BASE}${currentSource.endpoints.detail}/${slug}`));
        
        if (data.status === 'success' || data.status === true) {
            currentMovie = data.movie || data.item || data.data?.item;
            if (currentMovie) {
                const norm = normalizeMovieData(currentMovie);
                if (norm) {
                    currentMovie.poster_url = norm.poster_url;
                    currentMovie.thumb_url = norm.thumb_url;
                }
            }
            if (currentSourceKey === 'ophim') {
                
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
            
            if (currentSourceKey === 'kkphim') {
                if (data.episodes) {
                    currentMovie.episodes = data.episodes;
                }
            }

            if (currentSourceKey === 'vsmov') {
                if (data.episodes) {
                    currentMovie.episodes = data.episodes;
                }
            }
            
            await displayMovieDetails();
            updatePageMeta();
            setupEpisodes();
            
            // Update favorite button status
            updateFavoriteButton();
            updatePinButton();
            
            hideLoading();
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
        
        Swal.fire({
            icon: 'warning',
            title: 'Phim không có sẵn',
            text: 'Phim không có ở nguồn hiện tại. Quay về trang chủ.',
            confirmButtonText: 'OK',
            allowOutsideClick: false,
        }).then(() => {
            window.location.href = 'index.html';
        });
        hideLoading();
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
    document.getElementById('moviePoster').src = getHeroImage(currentMovie.poster_url);
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
        "image": getHeroImage(currentMovie.poster_url),
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
    document.getElementById('ogImage').content = getHeroImage(currentMovie.poster_url);
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
            } else if (currentSourceKey === 'kkphim') {
                if (latestEpisode.episodeSlug_kkphim) {
                    targetEpisodeSlug = latestEpisode.episodeSlug_kkphim;
                    targetServerIndex = latestEpisode.serverIndex_kkphim !== undefined ? latestEpisode.serverIndex_kkphim : 0;
                    hasSourceHistory = true;
                }
            } else if (currentSourceKey === 'vsmov') {
                if (latestEpisode.episodeSlug_vsmov) {
                    targetEpisodeSlug = latestEpisode.episodeSlug_vsmov;
                    targetServerIndex = latestEpisode.serverIndex_vsmov !== undefined ? latestEpisode.serverIndex_vsmov : 0;
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
        button.className = 'bg-transparent border border-black text-gray-300 hover:bg-gray-800 px-4 py-2 rounded-lg text-sm transition flex items-center';
        button.textContent = server.server_name || `Server ${index + 1}`;
        button.onclick = () => selectServer(index);
        button.dataset.serverIndex = index;
        
        // Add active class for first server
        if (index === 0) {
            button.classList.add('bg-[#ffd875]', 'hover:bg-[#e2c15e]', 'text-gray-900');
            button.classList.remove('bg-transparent', 'border', 'border-black', 'text-gray-300', 'hover:bg-gray-800');
        }
        
        serverSelect.appendChild(button);
    });
    
    // Load episodes for first server
    updateEpisodesList();
}

// Get current server index
function getCurrentServerIndex() {
    const serverSelect = document.getElementById('serverSelect');
    const activeButton = serverSelect.querySelector('.bg-\\[\\#ffd875\\]');
    return activeButton ? parseInt(activeButton.dataset.serverIndex) : 0;
}

// Select server
function selectServer(serverIndex) {
    const serverSelect = document.getElementById('serverSelect');
    const buttons = serverSelect.querySelectorAll('button');
    
    // Remove active class from all buttons
    buttons.forEach(button => {
        button.classList.remove('bg-[#ffd875]', 'hover:bg-[#e2c15e]', 'text-gray-900');
        button.classList.add('bg-transparent', 'border', 'border-black', 'text-gray-300', 'hover:bg-gray-800');
    });
    
    // Add active class to selected button
    const selectedButton = serverSelect.querySelector(`[data-server-index="${serverIndex}"]`);
    if (selectedButton) {
        selectedButton.classList.add('bg-[#ffd875]', 'hover:bg-[#e2c15e]', 'text-gray-900');
        selectedButton.classList.remove('bg-transparent', 'border', 'border-black', 'text-gray-300', 'hover:bg-gray-800');
    }
    
    // Reset to page 1 on server change
    currentEpisodePage = 1;
    
    // Update episodes list
    updateEpisodesListForServer(serverIndex);
    
    // Update current server index after updating episodes
    currentServerIndex = serverIndex;
    
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
            const isCurrent = slug === currentEpisodeSlug;
            const selectedClass = isCurrent
                ? 'bg-[#ffd875] hover:bg-[#e2c15e] text-gray-900'
                : 'bg-transparent border border-black text-gray-300 hover:bg-gray-800';
            
            return `
                <button onclick="playEpisode('${slug}', '${embed || m3u8}')" 
                        class="${selectedClass} px-3 py-2 rounded text-sm transition font-medium ${isEpisodeWatched(slug, currentMovie.slug) ? 'ring-2 ring-blue-500' : ''}">
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
                        ? 'bg-[#ffd875] text-gray-900' 
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

    currentEpisodeSlug = episodeSlug;

    try {
        // Find episode index in the current server
        const srvIdx = getCurrentServerIndex();
        const srv = currentMovie.episodes[srvIdx];
        if (srv) {
            const items = srv.items || srv.server_data || [];
            const idx = items.findIndex(ep => ep.slug === episodeSlug);
            if (idx !== -1) {
                currentEpisodeIndex = idx;
                currentEpisodePage = Math.floor((items.length - 1 - idx) / episodesPerPage) + 1;
            }
            const totalPages = Math.max(1, Math.ceil(items.length / episodesPerPage));
            currentEpisodePage = Math.min(Math.max(currentEpisodePage, 1), totalPages);
        }
        
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
        } else if (currentSourceKey === 'kkphim') {
            historyItem.videoUrl_kkphim = historyItem.videoUrl;
            historyItem.episodeSlug_kkphim = episodeSlug;
            historyItem.serverIndex_kkphim = serverIndex;
            historyItem.serverName_kkphim = serverName;
        } else if (currentSourceKey === 'vsmov') {
            historyItem.videoUrl_vsmov = historyItem.videoUrl;
            historyItem.episodeSlug_vsmov = episodeSlug;
            historyItem.serverIndex_vsmov = serverIndex;
            historyItem.serverName_vsmov = serverName;
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

// Resolve a category slug from a single category item.
// NguonC detail API returns categories without slug (only name), so map name -> slug via NGONC_CATEGORIES.
function getCategorySlug(cat) {
    if (!cat) return null;
    if (cat.slug) return cat.slug;
    if (cat.name && typeof NGONC_CATEGORIES !== 'undefined') {
        const match = NGONC_CATEGORIES.find(c => c.name.toLowerCase() === cat.name.toLowerCase());
        if (match) return match.slug;
    }
    return null;
}

// Extract a category slug from various category structures
function extractCategorySlug(category) {
    if (!category) return null;

    let firstCat = null;

    if (Array.isArray(category)) {
        const hasNesting = category.some(item => item.group || item.list);
        if (hasNesting) {
            const cat = category.find(item => item.group && item.group.name === 'Thể loại');
            if (cat && cat.list && cat.list.length > 0) {
                firstCat = cat.list[0];
            }
        } else if (category.length > 0) {
            firstCat = category[0];
        }
    } else if (category.list) {
        if (category.list.length > 0) {
            firstCat = category.list[0];
        }
    } else if (typeof category === 'object') {
        const theLoaiEntry = Object.values(category).find(item =>
            item && item.group && item.group.name === 'Thể loại' && item.list && item.list.length > 0
        );
        firstCat = theLoaiEntry ? theLoaiEntry.list[0] : null;
    }

    return getCategorySlug(firstCat);
}

// Load related movies
async function loadRelatedMovies() {
    try {
        if (!currentMovie || !currentMovie.category) return;

        const categorySlug = extractCategorySlug(currentMovie.category);

        if (!categorySlug) return;

        let endpoint = `/films/the-loai/${categorySlug}`;
        if (currentSourceKey === 'kkphim') {
            endpoint = `/v1/api/the-loai/${categorySlug}`;
        } else if (currentSourceKey === 'ophim' || currentSourceKey === 'vsmov') {
            endpoint = `/the-loai/${categorySlug}`;
        }

        const data = await fetchJSONCached(getApiUrl(`${API_BASE}${endpoint}?page=1`));

        if (data.status === 'success' || data.status === true) {
            const items = (data.items || data.data?.items || []).map(item => normalizeMovieData(item));
            displayRelatedMovies(items);
        }

    } catch (error) {
        console.error('Error loading related movies:', error);
    }
}

// Display related movies
function displayRelatedMovies(movies) {
    const relatedMoviesContainer = document.getElementById('relatedMovies');
    if (!relatedMoviesContainer) return;

    // Filter out current movie and limit to 10 movies
    const relatedMovies = movies
        .filter(movie => movie.slug !== currentMovie.slug)
        .slice(0, 10);

    if (relatedMovies.length === 0) {
        relatedMoviesContainer.innerHTML = '<p class="text-gray-400">Không có phim liên quan.</p>';
        return;
    }

    relatedMoviesContainer.innerHTML = relatedMovies.map(movie => {
        const name = movie.name || movie.title || 'Không rõ';
        const alias = movie.origin_name || (movie.year ? String(movie.year) : '');
        const quality = movie.quality || 'HD';
        const epLabel = movie.current_episode || (movie.year ? String(movie.year) : '');
        return `
            <a href="movie-detail.html?slug=${encodeURIComponent(movie.slug)}" class="sw-item" onclick="handleMovieCardClick(event, '${movie.slug}')">
                <span class="v-thumbnail">
                    <span class="thumb"><img src="${getVerticalImage(movie.poster_url)}" alt="${name}" loading="lazy" decoding="async" onerror="this.src=placeholderImg(300,450,'No Poster')"></span>
                    <span class="badge-quality">${quality}</span>
                    ${epLabel ? `<span class="pin-new"><span class="line-center">${epLabel}</span></span>` : ''}
                </span>
                <div class="info">
                    <h4 class="item-title lim-1">${name}</h4>
                    <h4 class="alias-title lim-1">${alias}</h4>
                </div>
            </a>
        `;
    }).join('');
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
				slug: currentMovie.slug || "",
				title: currentMovie.name || currentMovie.title || "",
				name: currentMovie.name || currentMovie.title || "",
				source: currentSourceKey || "",
				poster_url: currentMovie.poster_url || "",
				addedAt: new Date().toISOString(),
			};
            
            favoritesRef.add(movieData).then(() => {
                showToast('Đã thêm vào danh sách yêu thích', 'success');
                updateFavoriteButton();
            }).catch((error) => {
                console.error('Error adding to favorites:', error);
                showToast('Không thể thêm vào yêu thích: ' + error.message, 'error');
            });
        } else {
            // Remove from favorites
            const batch = db.batch();
            snapshot.forEach(doc => {
                batch.delete(doc.ref);
            });
            batch.commit().then(() => {
                showToast('Đã xóa khỏi danh sách yêu thích', 'success');
                updateFavoriteButton();
            }).catch((error) => {
                console.error('Error removing from favorites:', error);
                showToast('Không thể xóa khỏi yêu thích: ' + error.message, 'error');
            });
        }
    }).catch((error) => {
        console.error('Error querying favorites:', error);
        showToast('Lỗi khi kiểm tra danh sách yêu thích: ' + error.message, 'error');
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
function updatePinButton(slug, isPinned) {
    const pinBtn = document.querySelector('button[onclick="togglePinMovie()"]');
    if (!pinBtn) return;
    
    if (!currentMovie) {
        pinBtn.innerHTML = '<i class="fas fa-thumbtack mr-2"></i>Ghim phim';
        pinBtn.classList.remove('bg-gray-600', 'hover:bg-gray-700');
        pinBtn.classList.add('bg-yellow-600', 'hover:bg-yellow-700');
        return;
    }
    
    // Use provided state directly when available (avoids stale Firebase query after toggling)
    if (typeof isPinned === 'boolean') {
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
        showToast('Vui lòng đăng nhập để ghim phim', 'error');
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
            <button onclick="playEpisodeFromHistory('${item.episodeSlug}', ${item.serverIndex || 0})" class="bg-[#ffd875] hover:bg-[#e2c15e] text-gray-900 px-3 py-1 rounded text-sm font-medium">
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
            } else if (currentSourceKey === 'kkphim') {
                savedVideoUrl = historyItem.videoUrl_kkphim;
            } else if (currentSourceKey === 'vsmov') {
                savedVideoUrl = historyItem.videoUrl_vsmov;
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
                } else if (currentSourceKey === 'kkphim') {
                    videoUrlToPlay = savedVideoUrl || episodeUrl;
                } else if (currentSourceKey === 'vsmov') {
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

// Toggle cinema mode
function toggleCinemaMode() {
    const isActive = document.body.classList.toggle('cinema-mode');

    if (isActive) {
        const hideSelectors = [
            'header',
            'footer',
            '#breadcrumbSection',
            '#movieHeroSection',
            '#episodesSection',
            '#movieDescriptionSection',
        ];

        hideSelectors.forEach(selector => {
            const el = document.querySelector(selector);
            if (el) el.dataset.cinemaHide = 'true';
        });

        window.scrollTo(0, 0);
    } else {
        document.querySelectorAll('[data-cinema-hide="true"]').forEach(el => {
            delete el.dataset.cinemaHide;
        });
    }
}

// Handle search
setupSearchListeners();

// Watch Time Note Functions
function saveWatchTimeNote() {
    if (!currentMovie) return;
    
    const episodeInput = document.getElementById('watchEpisodeNumber');
    const noteInput = document.getElementById('watchTimeNote');
    const episodeNumber = episodeInput ? episodeInput.value.trim() : '';
    const note = noteInput ? noteInput.value.trim() : '';
    
    // If user is logged in, save to Firebase
    if (auth.currentUser) {
        saveWatchTimeNoteToFirebase(episodeNumber, note);
        showToast('Đã lưu ghi chú thời gian xem', 'success');
    } else {
        showToast('Vui lòng đăng nhập để lưu ghi chú', 'info');
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
async function saveWatchTimeNoteToFirebase(episodeNumber, note) {
    if (!auth.currentUser || !currentMovie) return;
    
    try {
        const userRef = db.collection('users').doc(auth.currentUser.uid);
        const notesRef = userRef.collection('watchTimeNotes');
        
        const existingDocs = await notesRef.where('movieSlug', '==', currentMovie.slug).get();
        const batch = db.batch();
        
        existingDocs.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        if (episodeNumber || note) {
            const noteData = {
                movieSlug: currentMovie.slug,
                movieTitle: currentMovie.name || currentMovie.title,
                episodeNumber: episodeNumber || '',
                note: note || '',
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
            
            const episodeInput = document.getElementById('watchEpisodeNumber');
            const noteInput = document.getElementById('watchTimeNote');
            
            if (episodeInput && noteData.episodeNumber) {
                episodeInput.value = noteData.episodeNumber;
            }
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

function deleteCharFromNote() {
    const noteInput = document.getElementById('watchTimeNote');
    if (noteInput) {
        const start = noteInput.selectionStart;
        const end = noteInput.selectionEnd;
        if (start > 0 || end > 0) {
            if (start !== end) {
                const newValue = noteInput.value.substring(0, start) + noteInput.value.substring(end);
                noteInput.value = newValue;
                noteInput.setSelectionRange(start, start);
            } else {
                const newValue = noteInput.value.substring(0, start - 1) + noteInput.value.substring(start);
                noteInput.value = newValue;
                noteInput.setSelectionRange(start - 1, start - 1);
            }
            noteInput.focus();
        }
    }
}

function insertCurrentEpisodeToNote() {
    const noteInput = document.getElementById('watchTimeNote');
    if (!noteInput || !currentEpisodeSlug) {
        showToast('Chưa chọn tập nào', 'info');
        return;
    }
    const episodeName = getEpisodeName(currentEpisodeSlug) + ' ';
    const start = noteInput.selectionStart;
    const end = noteInput.selectionEnd;
    const currentValue = noteInput.value;
    const newValue = currentValue.substring(0, start) + episodeName + currentValue.substring(end);
    noteInput.value = newValue;
    const newPosition = start + episodeName.length;
    noteInput.setSelectionRange(newPosition, newPosition);
    noteInput.focus();
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
                
                showToast('Ghi chú đã được xóa', 'info');
            } catch (error) {
                console.error('Error clearing watch time note:', error);
                showToast('Không thể xóa ghi chú. Vui lòng thử lại.', 'error');
            }
        } else {
            // Clear from localStorage only if not logged in
            const watchTimeNotes = JSON.parse(localStorage.getItem('watchTimeNotes') || '{}');
            delete watchTimeNotes[currentMovie.slug];
            localStorage.setItem('watchTimeNotes', JSON.stringify(watchTimeNotes));
            
            showToast('Ghi chú đã được xóa', 'info');
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

