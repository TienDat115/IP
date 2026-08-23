// Movie Detail Page JavaScript
var currentMovie = null;
var currentEpisodeIndex = 0;
var currentServerIndex = 0;
var currentEpisodePage = 1;
var episodesPerPage = 50;
var currentEpisodeSlug = null;

function padStart(str, len, ch) {
    str = String(str);
    ch = ch || '0';
    while (str.length < len) {
        str = ch + str;
    }
    return str;
}

function copyMovieAPI() {
    var urlParams = new URLSearchParams(window.location.search);
    var slug = urlParams.get('slug');
    if (!slug) return;
    var url = getApiUrl(API_BASE + currentSource.endpoints.detail + '/' + slug);
    navigator.clipboard.writeText(url).then(function() {
        showToast('Đã copy API!', 'success');
    }).catch(function() {
        var ta = document.createElement('textarea');
        ta.value = url;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast('Đã copy API!', 'success');
    });
}

function convertYoutubeToEmbed(url) {
    if (!url) return '';
    if (url.indexOf('youtube.com/embed/') !== -1) return url;
    var regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    var match = url.match(regExp);
    if (match && match[2].length === 11) {
        return 'https://www.youtube.com/embed/' + match[2];
    }
    return url;
}

function isUserLoggedIn() {
    return auth.currentUser !== null;
}

function waitForWatchHistory() {
    if (!isUserLoggedIn()) return Promise.resolve();
    return new Promise(function(resolve) {
        var attempts = 0;
        function check() {
            if (watchHistory.length === 0 && attempts < 20) {
                attempts++;
                setTimeout(check, 100);
            } else {
                resolve();
            }
        }
        check();
    });
}

function scrollToVideo() {
    var videoPlayer = document.getElementById('videoPlayer');
    if (videoPlayer) {
        var offset = 100;
        var elementPosition = videoPlayer.getBoundingClientRect().top;
        var offsetPosition = elementPosition + window.pageYOffset - offset;
        window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
    }
}

document.addEventListener('DOMContentLoaded', function() {
    window.ensureConfigReady().then(function() {
        initializePage();
    });
});

function initializePage() {
    auth.onAuthStateChanged(function(user) {
        updateFavoriteButton();
    });
    var urlParams = new URLSearchParams(window.location.search);
    var movieSlug = urlParams.get('slug');
    if (!movieSlug) {
        showError('Không tìm thấy phim. Vui lòng quay lại trang chủ.');
        setTimeout(function() { window.location.href = 'index.html'; }, 3000);
        return;
    }
    loadMovieDetail(movieSlug).then(function() {
        return waitForWatchHistory();
    }).then(function() {
        autoPlayLatestEpisode();
        return loadRelatedMovies();
    }).catch(function(error) {
        console.error('Error initializing page:', error);
        showError('Có lỗi xảy ra khi tải trang. Vui lòng thử lại.');
    });
}

function loadMovieDetail(slug) {
    showLoading();
    return fetchJSONCached(getApiUrl(API_BASE + currentSource.endpoints.detail + '/' + slug)).then(function(data) {
        if (data.status === 'success' || data.status === true) {
            currentMovie = data.movie || data.item || (data.data && data.data.item);
            if (currentMovie) {
                var norm = normalizeMovieData(currentMovie);
                if (norm) {
                    currentMovie.poster_url = norm.poster_url;
                    currentMovie.thumb_url = norm.thumb_url;
                }
            }
            if (currentSourceKey === 'ophim') {
                var isTrailer = (currentMovie.status && currentMovie.status.toLowerCase() === 'trailer') ||
                    (currentMovie.episode_current && currentMovie.episode_current.toLowerCase().indexOf('trailer') !== -1);
                if (isTrailer) {
                    if (currentMovie.trailer_url) {
                        var embedUrl = convertYoutubeToEmbed(currentMovie.trailer_url);
                        currentMovie.episodes = [{
                            server_name: "Trailer",
                            server_data: [{ name: "Trailer", slug: "trailer", embed: embedUrl, m3u8: embedUrl }],
                            items: [{ name: "Trailer", slug: "trailer", embed: embedUrl, m3u8: embedUrl }]
                        }];
                    } else {
                        currentMovie.episodes = [];
                    }
                }
            }
            if (currentSourceKey === 'kkphim') {
                if (data.episodes) { currentMovie.episodes = data.episodes; }
            }
            if (currentSourceKey === 'vsmov') {
                if (data.episodes) { currentMovie.episodes = data.episodes; }
            }
            return displayMovieDetails();
        } else {
            throw new Error('Movie not found');
        }
    }).then(function() {
        updatePageMeta();
        setupEpisodes();
        updateFavoriteButton();
        updatePinButton();
        hideLoading();
        document.getElementById('movieContent').classList.remove('hidden');
        setTimeout(function() { scrollToVideo(); }, 500);
    }).catch(function(error) {
        console.error('Error loading movie details:', error);
        Swal.fire({
            icon: 'warning',
            title: 'Phim không có sẵn',
            text: 'Phim không có ở nguồn hiện tại. Quay về trang chủ.',
            confirmButtonText: 'OK',
            allowOutsideClick: false
        }).then(function() {
            window.location.href = 'index.html';
        });
        hideLoading();
    });
}

function formatEpisodeProgress(currentEpisode, totalEpisodes) {
    if (!currentEpisode) return 'Không rõ';
    if (currentEpisode.toLowerCase().indexOf('trailer') !== -1) { return 'Trailer'; }
    if (currentEpisode.toLowerCase().indexOf('full') !== -1 ||
        currentEpisode.toLowerCase().indexOf('hoàn tất') !== -1 ||
        currentEpisode.toLowerCase().indexOf('completed') !== -1) { return 'Full'; }
    if (currentEpisode && totalEpisodes) { return currentEpisode + ' / ' + totalEpisodes; }
    return currentEpisode;
}

function parseDate(dateObjOrString) {
    if (!dateObjOrString) return null;
    var dateStr = '';
    if (typeof dateObjOrString === 'string') {
        dateStr = dateObjOrString;
    } else if (typeof dateObjOrString === 'object' && dateObjOrString.time) {
        dateStr = dateObjOrString.time;
    } else if (typeof dateObjOrString === 'object' && dateObjOrString.seconds) {
        return new Date(dateObjOrString.seconds * 1000);
    } else {
        dateStr = String(dateObjOrString);
    }
    var d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
}

function displayMovieDetails() {
    if (!currentMovie) return Promise.resolve();
    document.getElementById('movieTitle').textContent = currentMovie.name || currentMovie.title || 'Không có tiêu đề';
    document.getElementById('moviePoster').src = getHeroImage(currentMovie.poster_url);
    document.getElementById('moviePoster').alt = currentMovie.name || currentMovie.title || '';
    var createdDate = parseDate(currentMovie.created);
    var modifiedDate = parseDate(currentMovie.modified);
    var yearText = createdDate ? createdDate.getFullYear() : (currentMovie.year || currentMovie.release_year || 'Không rõ');
    var dateText = createdDate ? ' (' + padStart(createdDate.getDate(), 2) + '/' + padStart(createdDate.getMonth() + 1, 2) + '/' + createdDate.getFullYear() + ')' : '';
    var modifiedText = modifiedDate ? padStart(modifiedDate.getDate(), 2) + '/' + padStart(modifiedDate.getMonth() + 1, 2) + '/' + modifiedDate.getFullYear() : 'Không rõ';
    document.getElementById('movieYear').textContent = yearText + dateText;
    document.getElementById('movieDuration').textContent = currentMovie.time || 'Không rõ';
    var currentEpisode = currentMovie.current_episode || currentMovie.episode_current || '';
    var totalEpisodes = currentMovie.total_episodes || currentMovie.episode_total || '';
    document.getElementById("episodeProgress").textContent = formatEpisodeProgress(currentEpisode, totalEpisodes);
    var castsText = 'Không có thông tin diễn viên.';
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
    var firstCategory = getFirstCategory(currentMovie.category);
    document.getElementById('breadcrumbCategory').textContent = firstCategory || 'Phim';
    document.getElementById('breadcrumbMovie').textContent = currentMovie.name || currentMovie.title || 'Không có tiêu đề';
    return loadWatchTimeNote().then(function() {
        updateStructuredData();
    });
}

function getCategoriesFromCategory(category) {
    if (!category) return '';
    var i, j;
    if (Array.isArray(category)) {
        var hasNesting = false;
        for (i = 0; i < category.length; i++) {
            if (category[i].group || category[i].list) { hasNesting = true; break; }
        }
        if (hasNesting) {
            var categories = [];
            for (i = 0; i < category.length; i++) {
                if (category[i].group && category[i].group.name === 'Thể loại') {
                    if (category[i].list) {
                        for (j = 0; j < category[i].list.length; j++) {
                            categories.push(category[i].list[j].name);
                        }
                    }
                }
            }
            return categories.join(', ');
        } else {
            var names = [];
            for (i = 0; i < category.length; i++) { if (category[i].name) names.push(category[i].name); }
            return names.join(', ');
        }
    } else if (category.list) {
        var listNames = [];
        for (i = 0; i < category.list.length; i++) { if (category.list[i].name) listNames.push(category.list[i].name); }
        return listNames.join(', ');
    } else if (typeof category === 'object') {
        var objCategories = [];
        var keys = Object.keys(category);
        for (var k = 0; k < keys.length; k++) {
            var item = category[keys[k]];
            if (item.name) {
                objCategories.push(item.name);
            } else if (item.group && item.group.name === 'Thể loại' && item.list) {
                for (j = 0; j < item.list.length; j++) { if (item.list[j].name) objCategories.push(item.list[j].name); }
            }
        }
        return objCategories.join(', ');
    }
    return '';
}

function getFirstCategory(category) {
    if (!category) return '';
    var i;
    if (Array.isArray(category)) {
        var hasNesting = false;
        for (i = 0; i < category.length; i++) {
            if (category[i].group || category[i].list) { hasNesting = true; break; }
        }
        if (hasNesting) {
            var firstCat = null;
            for (i = 0; i < category.length; i++) {
                if (category[i].group && category[i].group.name === 'Thể loại') { firstCat = category[i]; break; }
            }
            if (firstCat && firstCat.list && firstCat.list.length > 0) { return firstCat.list[0].name; }
        } else {
            if (category.length > 0) { return category[0].name || ''; }
        }
    } else if (category.list && category.list.length > 0) {
        return category.list[0].name;
    }
    return '';
}

function updateStructuredData() {
    if (!currentMovie) return;
    var directorValue = null;
    if (currentMovie.director) {
        var directorName = Array.isArray(currentMovie.director) ? currentMovie.director.filter(Boolean).join(', ') : currentMovie.director;
        directorValue = { "@type": "Person", "name": directorName };
    }
    var actorValue = [];
    var i, castParts;
    if (currentMovie.casts) {
        castParts = currentMovie.casts.split(',');
        for (i = 0; i < castParts.length; i++) { actorValue.push({ "@type": "Person", "name": castParts[i].trim() }); }
    } else if (Array.isArray(currentMovie.actor)) {
        var filteredActors = currentMovie.actor.filter(Boolean);
        for (i = 0; i < filteredActors.length; i++) { actorValue.push({ "@type": "Person", "name": filteredActors[i].trim() }); }
    } else if (typeof currentMovie.actor === 'string') {
        castParts = currentMovie.actor.split(',');
        for (i = 0; i < castParts.length; i++) { actorValue.push({ "@type": "Person", "name": castParts[i].trim() }); }
    }
    var genreParts = getCategoriesFromCategory(currentMovie.category).split(', ');
    var genreValue = [];
    for (i = 0; i < genreParts.length; i++) { genreValue.push(genreParts[i].trim()); }
    var ratingValue = currentMovie.rating ? currentMovie.rating.toString() : '';
    var structuredData = {
        "@context": "https://schema.org",
        "@type": "Movie",
        "name": currentMovie.name || currentMovie.title || 'Không có tiêu đề',
        "description": stripHtml(currentMovie.content || currentMovie.description || 'Không có mô tả.'),
        "url": window.location.href,
        "image": getHeroImage(currentMovie.poster_url),
        "datePublished": currentMovie.year ? currentMovie.year + '-01-01' : '',
        "director": directorValue || {},
        "actor": actorValue,
        "genre": genreValue,
        "contentRating": ratingValue,
        "aggregateRating": currentMovie.rating ? { "@type": "AggregateRating", "ratingValue": ratingValue, "ratingCount": "1" } : {}
    };
    var structuredDataElement = document.getElementById('structuredData');
    if (structuredDataElement) {
        structuredDataElement.textContent = JSON.stringify(structuredData, null, 2);
    }
}

function updatePageMeta() {
    if (!currentMovie) return;
    var parsedCreated = parseDate(currentMovie.created);
    var year = currentMovie.year || (parsedCreated ? parsedCreated.getFullYear() : 'Không rõ');
    var movieName = currentMovie.name || currentMovie.title;
    var title = movieName + ' - Xem phim HD | CinePhim';
    var contentSnippet = currentMovie.content ? stripHtml(currentMovie.content).substring(0, 150) + '...' : '';
    var description = 'Xem ' + movieName + ' (' + year + ') online miễn phí với chất lượng HD. ' + contentSnippet;
    document.title = title;
    document.getElementById('pageTitle').textContent = title;
    document.getElementById('pageDescription').content = description;
    document.getElementById('ogTitle').content = title;
    document.getElementById('ogDescription').content = description;
    document.getElementById('ogImage').content = getHeroImage(currentMovie.poster_url);
}

function autoPlayLatestEpisode() {
    if (!currentMovie || !currentMovie.episodes) return;
    var urlParams = new URLSearchParams(window.location.search);
    var episodeSlug = urlParams.get('episode');
    var serverIndex = parseInt(urlParams.get('server')) || 0;
    if (episodeSlug) {
        if (serverIndex >= 0 && serverIndex < currentMovie.episodes.length) { selectServer(serverIndex); }
        playEpisodeFromHistory(episodeSlug, serverIndex);
        return;
    }
    var movieHistory = [];
    var i;
    for (i = 0; i < watchHistory.length; i++) {
        if (watchHistory[i].movieSlug === currentMovie.slug) { movieHistory.push(watchHistory[i]); }
    }
    if (movieHistory.length > 0) {
        var latestEpisode = movieHistory[0];
        var targetEpisodeSlug = null;
        var targetServerIndex = 0;
        var hasSourceHistory = false;
        if (typeof currentSourceKey !== 'undefined') {
            if (currentSourceKey === 'nguonc') {
                if (latestEpisode.episodeSlug_nguonc) {
                    targetEpisodeSlug = latestEpisode.episodeSlug_nguonc;
                    targetServerIndex = latestEpisode.serverIndex_nguonc !== undefined ? latestEpisode.serverIndex_nguonc : 0;
                    hasSourceHistory = true;
                } else if (latestEpisode.episodeSlug && !latestEpisode.videoUrl_ophim) {
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
            playEpisodeFromHistory(targetEpisodeSlug, targetServerIndex, true);
        } else {
            playDefaultFirstEpisode();
        }
    } else {
        playDefaultFirstEpisode();
    }
}

function playDefaultFirstEpisode() {
    if (currentMovie.episodes.length > 0) {
        var server = currentMovie.episodes[0];
        var items = server.items || server.server_data || [];
        if (items.length > 0) {
            var firstEpisode = items[0];
            var videoUrl = firstEpisode.embed || firstEpisode.link_embed || firstEpisode.m3u8 || firstEpisode.link_m3u8;
            if (typeof currentSourceKey !== 'undefined' && currentSourceKey === 'nguonc') {
                videoUrl = videoUrl || currentMovie.link_m3u8 || currentMovie.link_embed;
            }
            playEpisode(firstEpisode.slug, videoUrl);
        }
    }
}

function setupEpisodes() {
    var episodesSection = document.getElementById('episodesSection');
    if (!currentMovie || !currentMovie.episodes || currentMovie.episodes.length === 0) {
        if (episodesSection) { episodesSection.classList.add('hidden'); }
        return;
    }
    if (episodesSection) { episodesSection.classList.remove('hidden'); }
    var serverSelect = document.getElementById('serverSelect');
    var episodesList = document.getElementById('episodesList');
    serverSelect.innerHTML = '';
    episodesList.innerHTML = '';
    var servers = currentMovie.episodes || [];
    for (var index = 0; index < servers.length; index++) {
        (function(server, idx) {
            var button = document.createElement('button');
            button.className = 'bg-transparent border border-black text-gray-300 hover:bg-gray-800 px-4 py-2 rounded-lg text-sm transition flex items-center';
            button.textContent = server.server_name || ('Server ' + (idx + 1));
            button.onclick = function() { selectServer(idx); };
            button.dataset.serverIndex = idx;
            if (idx === 0) {
                button.classList.add('bg-[#ffd875]', 'hover:bg-[#e2c15e]', 'text-gray-900');
                button.classList.remove('bg-transparent', 'border', 'border-black', 'text-gray-300', 'hover:bg-gray-800');
            }
            serverSelect.appendChild(button);
        })(servers[index], index);
    }
    updateEpisodesList();
}

function getCurrentServerIndex() {
    var serverSelect = document.getElementById('serverSelect');
    var activeButton = serverSelect.querySelector('.bg-\\[\\#ffd875\\]');
    return activeButton ? parseInt(activeButton.dataset.serverIndex) : 0;
}

function selectServer(serverIndex) {
    var serverSelect = document.getElementById('serverSelect');
    var buttons = serverSelect.querySelectorAll('button');
    for (var i = 0; i < buttons.length; i++) {
        buttons[i].classList.remove('bg-[#ffd875]', 'hover:bg-[#e2c15e]', 'text-gray-900');
        buttons[i].classList.add('bg-transparent', 'border', 'border-black', 'text-gray-300', 'hover:bg-gray-800');
    }
    var selectedButton = serverSelect.querySelector('[data-server-index="' + serverIndex + '"]');
    if (selectedButton) {
        selectedButton.classList.add('bg-[#ffd875]', 'hover:bg-[#e2c15e]', 'text-gray-900');
        selectedButton.classList.remove('bg-transparent', 'border', 'border-black', 'text-gray-300', 'hover:bg-gray-800');
    }
    currentEpisodePage = 1;
    updateEpisodesListForServer(serverIndex);
    currentServerIndex = serverIndex;
    updateUrlWithServer(serverIndex);
}

function updateUrlWithServer(serverIndex) {
    if (!currentMovie) return;
    try {
        var url = new URL(window.location);
        url.searchParams.set('server', serverIndex.toString());
        window.history.pushState({}, '', url);
    } catch (error) {
        console.error('Error updating URL:', error);
    }
}

function updateEpisodesList() {
    var serverIndex = getCurrentServerIndex();
    updateEpisodesListForServer(serverIndex);
}

function updateEpisodesListForServer(serverIndex) {
    var episodesList = document.getElementById('episodesList');
    if (!episodesList || !currentMovie || !currentMovie.episodes) return;
    var server = currentMovie.episodes[serverIndex];
    if (server) {
        var items = server.items || server.server_data || [];
        var totalEpisodes = items.length;
        if (currentServerIndex !== serverIndex) { currentEpisodePage = 1; }
        var startIndex = (currentEpisodePage - 1) * episodesPerPage;
        var endIndex = Math.min(startIndex + episodesPerPage, totalEpisodes);
        var reversedItems = items.slice().reverse();
        var paginatedEpisodes = reversedItems.slice(startIndex, endIndex);
        var htmlParts = [];
        for (var index = 0; index < paginatedEpisodes.length; index++) {
            var episode = paginatedEpisodes[index];
            var slug = episode.slug;
            var embed = episode.embed || episode.link_embed;
            var m3u8 = episode.m3u8 || episode.link_m3u8;
            var name = episode.name || ('Tập ' + (totalEpisodes - (startIndex + index)));
            var isCurrent = slug === currentEpisodeSlug;
            var selectedClass = isCurrent ? 'bg-[#ffd875] hover:bg-[#e2c15e] text-gray-900' : 'bg-transparent border border-black text-gray-300 hover:bg-gray-800';
            var watchedClass = isEpisodeWatched(slug, currentMovie.slug) ? ' ring-2 ring-blue-500' : '';
            var watchedIcon = isEpisodeWatched(slug, currentMovie.slug) ? '<i class="fas fa-check-circle text-xs ml-1"></i>' : '';
            htmlParts.push('<button onclick="playEpisode(\'' + slug + '\', \'' + (embed || m3u8) + '\')" class="' + selectedClass + ' px-3 py-2 rounded text-sm transition font-medium' + watchedClass + '">' + name + watchedIcon + '</button>');
        }
        episodesList.innerHTML = htmlParts.join('');
        updateEpisodesPagination(totalEpisodes);
        updateNavigationButtons();
    }
}

function updateEpisodesPagination(totalEpisodes) {
    var paginationContainer = document.getElementById('episodesPagination');
    if (!paginationContainer) return;
    if (totalEpisodes <= episodesPerPage) { paginationContainer.innerHTML = ''; return; }
    var totalPages = Math.ceil(totalEpisodes / episodesPerPage);
    var paginationHTML = '';
    var prevDisabled = currentEpisodePage === 1;
    var prevClass = prevDisabled ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-700 text-white hover:bg-gray-600';
    var prevDisabledAttr = prevDisabled ? ' disabled' : '';
    paginationHTML += '<button onclick="goToEpisodePage(' + (currentEpisodePage - 1) + ')" class="px-3 py-2 rounded-lg text-sm font-medium transition ' + prevClass + '"' + prevDisabledAttr + '><i class="fas fa-chevron-left"></i></button>';
    var maxVisiblePages = 5;
    var startPage = Math.max(1, currentEpisodePage - Math.floor(maxVisiblePages / 2));
    var endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    if (endPage - startPage < maxVisiblePages - 1) { startPage = Math.max(1, endPage - maxVisiblePages + 1); }
    if (startPage > 1) {
        paginationHTML += '<button onclick="goToEpisodePage(1)" class="px-3 py-2 rounded-lg text-sm font-medium bg-gray-700 text-white hover:bg-gray-600 transition">1</button>';
        if (startPage > 2) { paginationHTML += '<span class="px-2 text-gray-400">...</span>'; }
    }
    for (var i = startPage; i <= endPage; i++) {
        var pageClass = i === currentEpisodePage ? 'bg-[#ffd875] text-gray-900' : 'bg-gray-700 text-white hover:bg-gray-600';
        paginationHTML += '<button onclick="goToEpisodePage(' + i + ')" class="px-3 py-2 rounded-lg text-sm font-medium transition ' + pageClass + '">' + i + '</button>';
    }
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) { paginationHTML += '<span class="px-2 text-gray-400">...</span>'; }
        paginationHTML += '<button onclick="goToEpisodePage(' + totalPages + ')" class="px-3 py-2 rounded-lg text-sm font-medium bg-gray-700 text-white hover:bg-gray-600 transition">' + totalPages + '</button>';
    }
    var nextDisabled = currentEpisodePage === totalPages;
    var nextClass = nextDisabled ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-700 text-white hover:bg-gray-600';
    var nextDisabledAttr = nextDisabled ? ' disabled' : '';
    paginationHTML += '<button onclick="goToEpisodePage(' + (currentEpisodePage + 1) + ')" class="px-3 py-2 rounded-lg text-sm font-medium transition ' + nextClass + '"' + nextDisabledAttr + '><i class="fas fa-chevron-right"></i></button>';
    paginationContainer.innerHTML = paginationHTML;
}

function goToEpisodePage(page) {
    var serverIndex = getCurrentServerIndex();
    var server = currentMovie.episodes[serverIndex];
    if (!server) return;
    var items = server.items || server.server_data || [];
    var totalPages = Math.ceil(items.length / episodesPerPage);
    if (page < 1 || page > totalPages) return;
    currentEpisodePage = page;
    updateEpisodesListForServer(serverIndex);
    var episodesSection = document.getElementById('episodesSection');
    if (episodesSection) { episodesSection.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
}

function playEpisode(episodeSlug, videoUrl) {
    var iframeElement = document.getElementById('videoPlayer');
    if (!iframeElement) { showError('Không tìm thấy player video. Vui lòng tải lại trang.'); return; }
    if (!videoUrl) { showError('Không tìm thấy link video. Vui lòng chọn tập khác.'); return; }
    currentEpisodeSlug = episodeSlug;
    try {
        var srvIdx = getCurrentServerIndex();
        var srv = currentMovie.episodes[srvIdx];
        if (srv) {
            var items = srv.items || srv.server_data || [];
            var idx = -1;
            for (var i = 0; i < items.length; i++) {
                if (items[i].slug === episodeSlug) { idx = i; break; }
            }
            if (idx !== -1) {
                currentEpisodeIndex = idx;
                currentEpisodePage = Math.floor((items.length - 1 - idx) / episodesPerPage) + 1;
            }
            var totalPages = Math.max(1, Math.ceil(items.length / episodesPerPage));
            currentEpisodePage = Math.min(Math.max(currentEpisodePage, 1), totalPages);
        }
        iframeElement.src = videoUrl;
        updateCurrentEpisodeDisplay(episodeSlug);
        updatePageTitleWithEpisode(episodeSlug);
        updateNavigationButtons();
        updateUrlWithEpisode(episodeSlug);
        setTimeout(function() { scrollToVideo(); }, 300);
        saveToWatchHistory(currentMovie.slug, episodeSlug);
        updateEpisodesList();
        setTimeout(function() { markEpisodeAsWatched(currentMovie.slug, currentEpisodeIndex); }, 500);
    } catch (error) {
        console.error('Error playing episode:', error);
        showError('Có lỗi xảy ra khi phát video: ' + error.message + '. Vui lòng thử lại.');
    }
}

function updateUrlWithEpisode(episodeSlug) {
    if (!currentMovie || !episodeSlug) return;
    try {
        var url = new URL(window.location);
        url.searchParams.set('episode', episodeSlug);
        url.searchParams.set('server', getCurrentServerIndex().toString());
        window.history.pushState({}, '', url);
    } catch (error) {
        console.error('Error updating URL:', error);
    }
}

function saveToWatchHistory(movieSlug, episodeSlug) {
    if (!isUserLoggedIn()) return;
    var movieTitle = currentMovie.name || currentMovie.title || movieSlug;
    var episodeName = getEpisodeName(episodeSlug);
    var watchedAt = new Date().toISOString();
    var serverIndex = getCurrentServerIndex();
    var serverName = currentMovie.episodes && currentMovie.episodes[serverIndex] ? currentMovie.episodes[serverIndex].server_name : 'Server 1';
    var existingItem = null;
    for (var i = 0; i < watchHistory.length; i++) {
        if (watchHistory[i].movieSlug === movieSlug) { existingItem = watchHistory[i]; break; }
    }
    var historyItem;
    if (existingItem) {
        historyItem = {};
        for (var key in existingItem) {
            if (existingItem.hasOwnProperty(key)) { historyItem[key] = existingItem[key]; }
        }
    } else {
        historyItem = { movieSlug: movieSlug, movieTitle: movieTitle };
    }
    historyItem.episodeSlug = episodeSlug;
    historyItem.episodeName = episodeName;
    historyItem.serverIndex = serverIndex;
    historyItem.serverName = serverName;
    historyItem.watchedAt = watchedAt;
    historyItem.poster_url = currentMovie.poster_url || '';
    historyItem.thumb_url = currentMovie.thumb_url || '';
    historyItem.videoUrl = getCurrentVideoUrl();
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
    var histKeys = Object.keys(historyItem);
    for (var k = 0; k < histKeys.length; k++) {
        if (historyItem[histKeys[k]] === undefined) { delete historyItem[histKeys[k]]; }
    }
    var filteredHistory = [];
    for (var h = 0; h < watchHistory.length; h++) {
        if (watchHistory[h].movieSlug !== movieSlug) { filteredHistory.push(watchHistory[h]); }
    }
    watchHistory = filteredHistory;
    watchHistory.unshift(historyItem);
    if (watchHistory.length > 50) { watchHistory = watchHistory.slice(0, 50); }
    var user = auth.currentUser;
    if (user) { saveSingleWatchHistoryItem(historyItem); }
}

function getEpisodeName(episodeSlug) {
    if (!currentMovie || !currentMovie.episodes) return episodeSlug;
    for (var s = 0; s < currentMovie.episodes.length; s++) {
        var server = currentMovie.episodes[s];
        var items = server.items || server.server_data || [];
        for (var e = 0; e < items.length; e++) {
            if (items[e].slug === episodeSlug) {
                return items[e].name || ('Tập ' + (e + 1));
            }
        }
    }
    return episodeSlug;
}

function getCurrentVideoUrl() {
    var iframeElement = document.getElementById('videoPlayer');
    return iframeElement ? iframeElement.src : '';
}

function markEpisodeAsWatched(movieSlug, episodeIndex) {
    if (!isUserLoggedIn()) return;
    var user = auth.currentUser;
    if (!user) return;
    var userRef = db.collection('users').doc(user.uid);
    userRef.get().then(function(doc) {
        var userData = doc.exists ? doc.data() : {};
        var watched = userData.watchedEpisodes || [];
        var episodeKey = movieSlug + '_' + episodeIndex;
        if (watched.indexOf(episodeKey) === -1) {
            watched.push(episodeKey);
            return userRef.set({ watchedEpisodes: watched, lastUpdated: new Date() }, { merge: true });
        }
    }).catch(function(error) {
        console.error('Error marking episode as watched:', error);
    });
}

function isEpisodeWatched(episodeSlug, movieSlug) {
    if (movieSlug === undefined || movieSlug === null) movieSlug = null;
    var slugToCheck = movieSlug || currentMovie.slug;
    for (var i = 0; i < watchHistory.length; i++) {
        if (watchHistory[i].movieSlug === slugToCheck && watchHistory[i].episodeSlug === episodeSlug) {
            return true;
        }
    }
    return false;
}

function playPreviousEpisode() {
    if (!currentMovie || !currentMovie.episodes || currentMovie.episodes.length === 0) return;
    var serverIndex = getCurrentServerIndex();
    var server = currentMovie.episodes[serverIndex];
    if (!server) return;
    var items = server.items || server.server_data || [];
    if (items.length === 0) return;
    var currentSlug = getCurrentEpisodeSlug();
    var currentEpisode = null;
    for (var i = 0; i < items.length; i++) {
        if (items[i].slug === currentSlug) { currentEpisode = items[i]; break; }
    }
    if (!currentEpisode) return;
    var currentIndex = -1;
    for (var j = 0; j < items.length; j++) {
        if (items[j] === currentEpisode) { currentIndex = j; break; }
    }
    if (currentIndex > 0) {
        var previousEpisode = items[currentIndex - 1];
        playEpisode(previousEpisode.slug, previousEpisode.embed || previousEpisode.link_embed || previousEpisode.m3u8 || previousEpisode.link_m3u8);
    } else {
        showInfo('Đây là tập đầu tiên.');
    }
}

function playNextEpisode() {
    if (!currentMovie || !currentMovie.episodes || currentMovie.episodes.length === 0) return;
    var serverIndex = getCurrentServerIndex();
    var server = currentMovie.episodes[serverIndex];
    if (!server) return;
    var items = server.items || server.server_data || [];
    if (items.length === 0) return;
    var currentSlug = getCurrentEpisodeSlug();
    var currentEpisode = null;
    for (var i = 0; i < items.length; i++) {
        if (items[i].slug === currentSlug) { currentEpisode = items[i]; break; }
    }
    if (!currentEpisode) {
        var firstEpisode = items[0];
        playEpisode(firstEpisode.slug, firstEpisode.embed || firstEpisode.link_embed || firstEpisode.m3u8 || firstEpisode.link_m3u8);
        return;
    }
    var currentIndex = -1;
    for (var j = 0; j < items.length; j++) {
        if (items[j] === currentEpisode) { currentIndex = j; break; }
    }
    if (currentIndex < items.length - 1) {
        var nextEpisode = items[currentIndex + 1];
        playEpisode(nextEpisode.slug, nextEpisode.embed || nextEpisode.link_embed || nextEpisode.m3u8 || nextEpisode.link_m3u8);
    } else {
        showInfo('Đây là tập cuối cùng.');
    }
}

function getCurrentEpisodeSlug() {
    var iframeElement = document.getElementById('videoPlayer');
    if (!iframeElement || !iframeElement.src || iframeElement.src === 'about:blank') { return null; }
    for (var s = 0; s < currentMovie.episodes.length; s++) {
        var server = currentMovie.episodes[s];
        var items = server.items || server.server_data || [];
        for (var e = 0; e < items.length; e++) {
            var ep = items[e];
            if ((ep.embed && iframeElement.src.indexOf(ep.embed) !== -1) ||
                (ep.link_embed && iframeElement.src.indexOf(ep.link_embed) !== -1) ||
                (ep.m3u8 && iframeElement.src.indexOf(ep.m3u8) !== -1) ||
                (ep.link_m3u8 && iframeElement.src.indexOf(ep.link_m3u8) !== -1)) {
                return ep.slug;
            }
        }
    }
    return null;
}

function updateCurrentEpisodeDisplay(episodeSlug) {
    var displayElement = document.getElementById('currentEpisodeDisplay');
    if (!displayElement) return;
    var episodeName = getEpisodeName(episodeSlug);
    displayElement.textContent = episodeName;
}

function updatePageTitleWithEpisode(episodeSlug) {
    if (!currentMovie || !episodeSlug) return;
    var episodeName = getEpisodeName(episodeSlug);
    var title = (currentMovie.name || currentMovie.title) + ' - ' + episodeName;
    document.title = title;
    document.getElementById('pageTitle').textContent = title;
    document.getElementById('ogTitle').content = title;
}

function updateNavigationButtons() {
    var prevButton = document.querySelector('button[onclick="playPreviousEpisode()"]');
    var nextButton = document.querySelector('button[onclick="playNextEpisode()"]');
    if (!prevButton || !nextButton || !currentMovie || !currentMovie.episodes) return;
    var serverIndex = getCurrentServerIndex();
    var server = currentMovie.episodes[serverIndex];
    if (!server) return;
    var items = server.items || server.server_data || [];
    if (items.length === 0) {
        prevButton.disabled = true;
        nextButton.disabled = true;
        prevButton.classList.add('opacity-50', 'cursor-not-allowed');
        nextButton.classList.add('opacity-50', 'cursor-not-allowed');
        return;
    }
    var currentSlug = getCurrentEpisodeSlug();
    var currentEpisode = null;
    for (var i = 0; i < items.length; i++) {
        if (items[i].slug === currentSlug) { currentEpisode = items[i]; break; }
    }
    if (!currentEpisode) {
        prevButton.disabled = true;
        nextButton.disabled = false;
        prevButton.classList.add('opacity-50', 'cursor-not-allowed');
        nextButton.classList.remove('opacity-50', 'cursor-not-allowed');
        return;
    }
    var currentIndex = -1;
    for (var j = 0; j < items.length; j++) {
        if (items[j] === currentEpisode) { currentIndex = j; break; }
    }
    if (currentIndex <= 0) {
        prevButton.disabled = true;
        prevButton.classList.add('opacity-50', 'cursor-not-allowed');
    } else {
        prevButton.disabled = false;
        prevButton.classList.remove('opacity-50', 'cursor-not-allowed');
    }
    if (currentIndex >= items.length - 1) {
        nextButton.disabled = true;
        nextButton.classList.add('opacity-50', 'cursor-not-allowed');
    } else {
        nextButton.disabled = false;
        nextButton.classList.remove('opacity-50', 'cursor-not-allowed');
    }
}

function getCategorySlug(cat) {
    if (!cat) return null;
    if (cat.slug) return cat.slug;
    if (cat.name && typeof NGONC_CATEGORIES !== 'undefined') {
        for (var i = 0; i < NGONC_CATEGORIES.length; i++) {
            if (NGONC_CATEGORIES[i].name.toLowerCase() === cat.name.toLowerCase()) {
                return NGONC_CATEGORIES[i].slug;
            }
        }
    }
    return null;
}

function extractCategorySlug(category) {
    if (!category) return null;
    var firstCat = null;
    var i;
    if (Array.isArray(category)) {
        var hasNesting = false;
        for (i = 0; i < category.length; i++) {
            if (category[i].group || category[i].list) { hasNesting = true; break; }
        }
        if (hasNesting) {
            for (i = 0; i < category.length; i++) {
                if (category[i].group && category[i].group.name === 'Thể loại') {
                    if (category[i].list && category[i].list.length > 0) { firstCat = category[i].list[0]; }
                    break;
                }
            }
        } else if (category.length > 0) {
            firstCat = category[0];
        }
    } else if (category.list) {
        if (category.list.length > 0) { firstCat = category.list[0]; }
    } else if (typeof category === 'object') {
        var keys = Object.keys(category);
        for (var k = 0; k < keys.length; k++) {
            var item = category[keys[k]];
            if (item && item.group && item.group.name === 'Thể loại' && item.list && item.list.length > 0) {
                firstCat = item.list[0];
                break;
            }
        }
    }
    return getCategorySlug(firstCat);
}

function loadRelatedMovies() {
    if (!currentMovie || !currentMovie.category) return Promise.resolve();
    var categorySlug = extractCategorySlug(currentMovie.category);
    if (!categorySlug) return Promise.resolve();
    var endpoint = '/films/the-loai/' + categorySlug;
    if (currentSourceKey === 'kkphim') {
        endpoint = '/v1/api/the-loai/' + categorySlug;
    } else if (currentSourceKey === 'ophim' || currentSourceKey === 'vsmov') {
        endpoint = '/the-loai/' + categorySlug;
    }
    return fetchJSONCached(getApiUrl(API_BASE + endpoint + '?page=1')).then(function(data) {
        if (data.status === 'success' || data.status === true) {
            var rawItems = data.items || (data.data && data.data.items) || [];
            var items = [];
            for (var i = 0; i < rawItems.length; i++) { items.push(normalizeMovieData(rawItems[i])); }
            displayRelatedMovies(items);
        }
    }).catch(function(error) {
        console.error('Error loading related movies:', error);
    });
}

function displayRelatedMovies(movies) {
    var relatedMoviesContainer = document.getElementById('relatedMovies');
    if (!relatedMoviesContainer) return;
    var relatedMovies = [];
    for (var i = 0; i < movies.length; i++) {
        if (movies[i].slug !== currentMovie.slug) { relatedMovies.push(movies[i]); }
        if (relatedMovies.length >= 10) break;
    }
    if (relatedMovies.length === 0) {
        relatedMoviesContainer.innerHTML = '<p class="text-gray-400">Không có phim liên quan.</p>';
        return;
    }
    var htmlParts = [];
    for (var j = 0; j < relatedMovies.length; j++) {
        var movie = relatedMovies[j];
        var name = movie.name || movie.title || 'Không rõ';
        var alias = movie.origin_name || (movie.year ? String(movie.year) : '');
        var quality = movie.quality || 'HD';
        var epLabel = movie.current_episode || (movie.year ? String(movie.year) : '');
        var badgeHtml = epLabel ? '<span class="pin-new"><span class="line-center">' + epLabel + '</span></span>' : '';
        htmlParts.push(
            '<a href="movie-detail.html?slug=' + encodeURIComponent(movie.slug) + '" class="sw-item" onclick="handleMovieCardClick(event, \'' + movie.slug + '\')">' +
            '<span class="v-thumbnail">' +
            '<span class="thumb"><img src="' + getVerticalImage(movie.poster_url) + '" alt="' + name + '" loading="lazy" decoding="async" onerror="this.src=placeholderImg(300,450,\'No Poster\')"></span>' +
            '<span class="badge-quality">' + quality + '</span>' +
            badgeHtml +
            '</span>' +
            '<div class="info">' +
            '<h4 class="item-title lim-1">' + name + '</h4>' +
            '<h4 class="alias-title lim-1">' + alias + '</h4>' +
            '</div></a>'
        );
    }
    relatedMoviesContainer.innerHTML = htmlParts.join('');
}

function toggleFavorite() {
    if (!isUserLoggedIn()) { showLoginModal(); return; }
    if (!currentMovie) { showError('Không có thông tin phim'); return; }
    var user = auth.currentUser;
    var userRef = db.collection('users').doc(user.uid);
    var favoritesRef = userRef.collection('favorites');
    favoritesRef.where('slug', '==', currentMovie.slug).get().then(function(snapshot) {
        if (snapshot.empty) {
            var movieData = {
                slug: currentMovie.slug || "",
                title: currentMovie.name || currentMovie.title || "",
                name: currentMovie.name || currentMovie.title || "",
                source: currentSourceKey || "",
                poster_url: currentMovie.poster_url || "",
                addedAt: new Date().toISOString()
            };
            favoritesRef.add(movieData).then(function() {
                showToast('Đã thêm vào danh sách yêu thích', 'success');
                updateFavoriteButton();
            }).catch(function(error) {
                console.error('Error adding to favorites:', error);
                showToast('Không thể thêm vào yêu thích: ' + error.message, 'error');
            });
        } else {
            var batch = db.batch();
            snapshot.forEach(function(doc) { batch.delete(doc.ref); });
            batch.commit().then(function() {
                showToast('Đã xóa khỏi danh sách yêu thích', 'success');
                updateFavoriteButton();
            }).catch(function(error) {
                console.error('Error removing from favorites:', error);
                showToast('Không thể xóa khỏi yêu thích: ' + error.message, 'error');
            });
        }
    }).catch(function(error) {
        console.error('Error querying favorites:', error);
        showToast('Lỗi khi kiểm tra danh sách yêu thích: ' + error.message, 'error');
    });
}

function updateFavoriteButton() {
    var favoriteBtn = document.querySelector('button[onclick="toggleFavorite()"]');
    if (!favoriteBtn) return;
    if (!currentMovie) { favoriteBtn.innerHTML = '<i class="fas fa-heart mr-2"></i>Thêm vào yêu thích'; return; }
    if (!isUserLoggedIn()) { favoriteBtn.innerHTML = '<i class="fas fa-heart mr-2"></i>Thêm vào yêu thích'; return; }
    var user = auth.currentUser;
    var favoritesRef = db.collection('users').doc(user.uid).collection('favorites');
    favoritesRef.where('slug', '==', currentMovie.slug).get().then(function(snapshot) {
        if (snapshot.empty) {
            favoriteBtn.innerHTML = '<i class="fas fa-heart mr-2"></i>Thêm vào yêu thích';
        } else {
            favoriteBtn.innerHTML = '<i class="fas fa-heart mr-2"></i>Bỏ yêu thích';
        }
    }).catch(function(error) {
        console.error('Error checking favorite status:', error);
        favoriteBtn.innerHTML = '<i class="fas fa-heart mr-2"></i>Thêm vào yêu thích';
    });
}

function updatePinButton(slug, isPinned) {
    var pinBtn = document.querySelector('button[onclick="togglePinMovie()"]');
    if (!pinBtn) return;
    if (!currentMovie) {
        pinBtn.innerHTML = '<i class="fas fa-thumbtack mr-2"></i>Ghim phim';
        pinBtn.classList.remove('bg-gray-600', 'hover:bg-gray-700');
        pinBtn.classList.add('bg-yellow-600', 'hover:bg-yellow-700');
        return;
    }
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
        var pinnedMovies = JSON.parse(localStorage.getItem('pinnedMovies') || '[]');
        var localIsPinned = false;
        for (var i = 0; i < pinnedMovies.length; i++) {
            if (pinnedMovies[i].slug === currentMovie.slug) { localIsPinned = true; break; }
        }
        if (localIsPinned) {
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
    var user = auth.currentUser;
    var pinnedRef = db.collection('users').doc(user.uid).collection('pinnedMovies');
    pinnedRef.where('slug', '==', currentMovie.slug).get().then(function(snapshot) {
        if (snapshot.empty) {
            pinBtn.innerHTML = '<i class="fas fa-thumbtack mr-2"></i>Ghim phim';
            pinBtn.classList.remove('bg-gray-600', 'hover:bg-gray-700');
            pinBtn.classList.add('bg-yellow-600', 'hover:bg-yellow-700');
        } else {
            pinBtn.innerHTML = '<i class="fas fa-thumbtack mr-2"></i>Bỏ ghim';
            pinBtn.classList.remove('bg-yellow-600', 'hover:bg-yellow-700');
            pinBtn.classList.add('bg-gray-600', 'hover:bg-gray-700');
        }
    }).catch(function(error) {
        console.error('Error checking pin status:', error);
        pinBtn.innerHTML = '<i class="fas fa-thumbtack mr-2"></i>Ghim phim';
        pinBtn.classList.remove('bg-gray-600', 'hover:bg-gray-700');
        pinBtn.classList.add('bg-yellow-600', 'hover:bg-yellow-700');
    });
}

function togglePinMovie() {
    if (!currentMovie) { showError('Không tìm thấy thông tin phim'); return; }
    if (!isUserLoggedIn()) { showToast('Vui lòng đăng nhập để ghim phim', 'error'); return; }
    window.togglePin(currentMovie.slug, currentMovie);
}

function toggleWatchHistory() {
    var watchHistorySection = document.getElementById('watchHistorySection');
    if (watchHistorySection) {
        watchHistorySection.classList.toggle('hidden');
        if (!watchHistorySection.classList.contains('hidden')) { loadWatchHistory(); }
    }
}

function loadWatchHistory() {
    if (!isUserLoggedIn() || !currentMovie) return;
    var movieHistory = [];
    for (var i = 0; i < watchHistory.length; i++) {
        if (watchHistory[i].movieSlug === currentMovie.slug) { movieHistory.push(watchHistory[i]); }
    }
    if (movieHistory.length === 0) {
        displayWatchHistory([]);
    } else {
        displayWatchHistory(movieHistory);
    }
}

function displayWatchHistory(history) {
    var watchHistoryGrid = document.getElementById('watchHistoryGrid');
    if (!watchHistoryGrid) return;
    if (history.length === 0) {
        watchHistoryGrid.innerHTML = '<p class="text-gray-400">Chưa có lịch sử xem phim này.</p>';
        return;
    }
    var htmlParts = [];
    for (var i = 0; i < history.length; i++) {
        var item = history[i];
        htmlParts.push(
            '<div class="bg-gray-700 rounded-lg p-3 flex justify-between items-center">' +
            '<div class="flex-1">' +
            '<p class="font-medium">' + (item.episodeName || 'Tập không xác định') + '</p>' +
            '<p class="text-xs text-gray-400 mt-1"><i class="fas fa-server mr-1"></i>' + (item.serverName || 'Server 1') + '</p>' +
            '</div>' +
            '<button onclick="playEpisodeFromHistory(\'' + item.episodeSlug + '\', ' + (item.serverIndex || 0) + ')" class="bg-[#ffd875] hover:bg-[#e2c15e] text-gray-900 px-3 py-1 rounded text-sm font-medium">' +
            '<i class="fas fa-play"></i></button></div>'
        );
    }
    watchHistoryGrid.innerHTML = htmlParts.join('');
}

function playEpisodeFromHistory(episodeSlug, serverIndex, fromHistory) {
    if (fromHistory === undefined) fromHistory = false;
    if (!currentMovie || !currentMovie.episodes) return;
    if (currentMovie.episodes[serverIndex]) { selectServer(serverIndex); }
    var server = currentMovie.episodes[serverIndex];
    if (server) {
        var items = server.items || server.server_data || [];
        var episode = null;
        for (var i = 0; i < items.length; i++) {
            if (items[i].slug === episodeSlug) { episode = items[i]; break; }
        }
        var historyItem = null;
        for (var h = 0; h < watchHistory.length; h++) {
            if (watchHistory[h].movieSlug === currentMovie.slug) { historyItem = watchHistory[h]; break; }
        }
        var savedVideoUrl = null;
        if (historyItem && typeof currentSourceKey !== 'undefined') {
            if (currentSourceKey === 'nguonc') { savedVideoUrl = historyItem.videoUrl_nguonc; }
            else if (currentSourceKey === 'ophim') { savedVideoUrl = historyItem.videoUrl_ophim; }
            else if (currentSourceKey === 'kkphim') { savedVideoUrl = historyItem.videoUrl_kkphim; }
            else if (currentSourceKey === 'vsmov') { savedVideoUrl = historyItem.videoUrl_vsmov; }
        } else if (historyItem) {
            savedVideoUrl = historyItem.videoUrl;
        }
        if (episode) {
            var episodeUrl = episode.embed || episode.link_embed || episode.m3u8 || episode.link_m3u8;
            var videoUrlToPlay = '';
            if (typeof currentSourceKey !== 'undefined') {
                if (currentSourceKey === 'nguonc') {
                    videoUrlToPlay = savedVideoUrl || episodeUrl || currentMovie.link_m3u8 || currentMovie.link_embed;
                } else if (currentSourceKey === 'ophim') {
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
            playEpisode(episodeSlug, savedVideoUrl);
        } else {
            showError('Không tìm thấy tập phim trong server này.');
        }
    } else {
        showError('Không tìm thấy server.');
    }
}

function toggleCinemaMode() {
    var isActive = document.body.classList.toggle('cinema-mode');
    if (isActive) {
        var hideSelectors = ['header', 'footer', '#breadcrumbSection', '#movieHeroSection', '#episodesSection', '#movieDescriptionSection'];
        for (var i = 0; i < hideSelectors.length; i++) {
            var el = document.querySelector(hideSelectors[i]);
            if (el) el.dataset.cinemaHide = 'true';
        }
        window.scrollTo(0, 0);
    } else {
        var hiddenEls = document.querySelectorAll('[data-cinema-hide="true"]');
        for (var j = 0; j < hiddenEls.length; j++) {
            delete hiddenEls[j].dataset.cinemaHide;
        }
    }
}

setupSearchListeners();

function saveWatchTimeNote() {
    if (!currentMovie) return;
    var episodeInput = document.getElementById('watchEpisodeNumber');
    var noteInput = document.getElementById('watchTimeNote');
    var episodeNumber = episodeInput ? episodeInput.value.trim() : '';
    var note = noteInput ? noteInput.value.trim() : '';
    if (auth.currentUser) {
        saveWatchTimeNoteToFirebase(episodeNumber, note);
        showToast('Đã lưu ghi chú thời gian xem', 'success');
    } else {
        showToast('Vui lòng đăng nhập để lưu ghi chú', 'info');
    }
}

function loadWatchTimeNote() {
    if (!currentMovie) return Promise.resolve();
    var noteInput = document.getElementById('watchTimeNote');
    if (!noteInput) return Promise.resolve();
    return new Promise(function(resolve) {
        setTimeout(resolve, 500);
    }).then(function() {
        if (auth.currentUser) {
            return loadWatchTimeNoteFromFirebase();
        }
    });
}

function saveWatchTimeNoteToFirebase(episodeNumber, note) {
    if (!auth.currentUser || !currentMovie) return Promise.resolve();
    var userRef = db.collection('users').doc(auth.currentUser.uid);
    var notesRef = userRef.collection('watchTimeNotes');
    return notesRef.where('movieSlug', '==', currentMovie.slug).get().then(function(existingDocs) {
        var batch = db.batch();
        existingDocs.forEach(function(doc) { batch.delete(doc.ref); });
        if (episodeNumber || note) {
            var noteData = {
                movieSlug: currentMovie.slug,
                movieTitle: currentMovie.name || currentMovie.title,
                episodeNumber: episodeNumber || '',
                note: note || '',
                createdAt: new Date(),
                updatedAt: new Date()
            };
            var docRef = notesRef.doc();
            batch.set(docRef, noteData);
        }
        return batch.commit();
    }).catch(function(error) {
        console.error('Error saving watch time note to Firebase:', error);
    });
}

function loadWatchTimeNoteFromFirebase() {
    if (!auth.currentUser || !currentMovie) return Promise.resolve();
    var userRef = db.collection('users').doc(auth.currentUser.uid);
    var notesRef = userRef.collection('watchTimeNotes');
    return notesRef.where('movieSlug', '==', currentMovie.slug).get().then(function(snapshot) {
        if (!snapshot.empty) {
            var noteDoc = snapshot.docs[0];
            var noteData = noteDoc.data();
            var episodeInput = document.getElementById('watchEpisodeNumber');
            var noteInput = document.getElementById('watchTimeNote');
            if (episodeInput && noteData.episodeNumber) { episodeInput.value = noteData.episodeNumber; }
            if (noteInput && noteData.note) { noteInput.value = noteData.note; }
        }
    }).catch(function(error) {
        console.error('Error loading watch time note from Firebase:', error);
    });
}

function toggleVirtualKeyboard() {
    var keyboard = document.getElementById('virtualKeyboard');
    if (keyboard) { keyboard.classList.toggle('hidden'); }
}

function insertToNote(character) {
    var noteInput = document.getElementById('watchTimeNote');
    if (noteInput) {
        var start = noteInput.selectionStart;
        var end = noteInput.selectionEnd;
        var currentValue = noteInput.value;
        var newValue = currentValue.substring(0, start) + character + currentValue.substring(end);
        noteInput.value = newValue;
        var newPosition = start + character.length;
        noteInput.setSelectionRange(newPosition, newPosition);
        noteInput.focus();
    }
}

function deleteCharFromNote() {
    var noteInput = document.getElementById('watchTimeNote');
    if (noteInput) {
        var start = noteInput.selectionStart;
        var end = noteInput.selectionEnd;
        if (start > 0 || end > 0) {
            if (start !== end) {
                var newValue = noteInput.value.substring(0, start) + noteInput.value.substring(end);
                noteInput.value = newValue;
                noteInput.setSelectionRange(start, start);
            } else {
                var newValue = noteInput.value.substring(0, start - 1) + noteInput.value.substring(start);
                noteInput.value = newValue;
                noteInput.setSelectionRange(start - 1, start - 1);
            }
            noteInput.focus();
        }
    }
}

function clearAndSaveNote() {
    var noteInput = document.getElementById('watchTimeNote');
    if (noteInput) {
        noteInput.value = '';
        if (isUserLoggedIn()) {
            var userRef = db.collection('users').doc(auth.currentUser.uid);
            var notesRef = userRef.collection('watchTimeNotes');
            notesRef.where('movieSlug', '==', currentMovie.slug).get().then(function(snapshot) {
                var batch = db.batch();
                snapshot.forEach(function(doc) { batch.delete(doc.ref); });
                return batch.commit();
            }).then(function() {
                var watchTimeNotes = JSON.parse(localStorage.getItem('watchTimeNotes') || '{}');
                delete watchTimeNotes[currentMovie.slug];
                localStorage.setItem('watchTimeNotes', JSON.stringify(watchTimeNotes));
                showToast('Ghi chú đã được xóa', 'info');
            }).catch(function(error) {
                console.error('Error clearing watch time note:', error);
                showToast('Không thể xóa ghi chú. Vui lòng thử lại.', 'error');
            });
        } else {
            var watchTimeNotes = JSON.parse(localStorage.getItem('watchTimeNotes') || '{}');
            delete watchTimeNotes[currentMovie.slug];
            localStorage.setItem('watchTimeNotes', JSON.stringify(watchTimeNotes));
            showToast('Ghi chú đã được xóa', 'info');
        }
    }
}

function clearNote() {
    var noteInput = document.getElementById('watchTimeNote');
    if (noteInput) { noteInput.value = ''; }
}
