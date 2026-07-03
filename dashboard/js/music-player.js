
			// Firebase auth & firestore
			const auth = firebase.auth();
			const db = firebase.firestore();

			// Kiểm tra đăng nhập
			auth.onAuthStateChanged((user) => {
				if (!user) {
					// Nếu chưa đăng nhập, chuyển hướng về trang đăng nhập
					window.location.href = "../login.html";
				} else {
					// Đã đăng nhập, tải danh sách yêu thích từ Firebase
					loadFavoritesFromFirebase(user.uid);
				}
			});

			// Hàm tải danh sách yêu thích từ Firebase
			async function loadFavoritesFromFirebase(userId) {
				try {
					const doc = await db.collection("userFavorites").doc(userId).get();
					if (doc.exists) {
						favorites = doc.data().favorites || [];
						localStorage.setItem("favorites", JSON.stringify(favorites));
					}
				} catch (error) {
					console.error("Lỗi khi tải danh sách yêu thích:", error);
				}
			}

			// Hàm lưu danh sách yêu thích lên Firebase
			async function saveFavoritesToFirebase(userId, favorites) {
				try {
					await db.collection("userFavorites").doc(userId).set(
						{
							favorites: favorites,
							lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
						},
						{ merge: true },
					);
				} catch (error) {
					console.error("Lỗi khi lưu danh sách yêu thích:", error);
				}
			}

			// Load playlists from JSON file
			const CACHE_KEY = "music_playlists_cache";
			const CACHE_TTL = 3600000; // 1 hour

			function loadPlaylists() {
				const cached = sessionStorage.getItem(CACHE_KEY);
				if (cached) {
					try {
						const { data, timestamp } = JSON.parse(cached);
						if (Date.now() - timestamp < CACHE_TTL) {
							return Promise.resolve(data);
						}
					} catch (_) {}
				}
				return fetch("js/playlists.json")
					.then((r) => r.json())
					.then((data) => {
						sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
						return data;
					});
			}

			loadPlaylists().then((playlists) => {
					const MUSIC_FOLDER = "music/";

					// Tạo danh sách "Tất cả bài hát"
					const allSongs = [];
					Object.values(playlists).forEach((songs) => {
						if (Array.isArray(songs)) {
							songs.forEach((filename) => {
								const path = MUSIC_FOLDER + filename + ".mp3";
								allSongs.push({
									path: path,
									title: filename,
								});
							});
						}
					});
					playlists["Tất cả bài hát"] = allSongs;

					// Cập nhật danh sách yêu thích từ local storage
					let favorites = JSON.parse(localStorage.getItem("favorites") || "[]");
					favorites = Array.isArray(favorites) ? favorites : [];

					// Cập nhật danh sách yêu thích
					playlists["Danh Sách Yêu Thích"] = [];
					favorites.forEach((favoriteUrl) => {
						for (const [playlistName, songs] of Object.entries(playlists)) {
							if (playlistName === "Tất cả bài hát" || playlistName === "Danh Sách Yêu Thích") continue;

							// Chỉ lấy tên file để so sánh (bỏ đi thư mục và đuôi .mp3)
							const favoriteFilename = favoriteUrl.replace(MUSIC_FOLDER, "").replace(/\.mp3$/, "");
							const song = songs.find((songPath) => songPath === favoriteFilename);

							if (song) {
								playlists["Danh Sách Yêu Thích"].push({
									path: MUSIC_FOLDER + song + ".mp3",
									title: song,
								});
								break;
							}
						}
					});

					// Cập nhật select box
					const categorySelect = document.getElementById("categorySelect");
					categorySelect.innerHTML = "";
					Object.keys(playlists).forEach((playlistName) => {
						const option = document.createElement("option");
						option.value = playlistName;
						option.textContent = playlistName;
						categorySelect.appendChild(option);
					});

					let currentPlaylist = "Tất cả bài hát";
					let currentIndex = 0;
					let isRandom = true;
					let isNoRepeat = false;
					let currentPage = 1;
					const pageSize = 10;
					let playedSongs = new Set();

					const playerContainer = document.getElementById("playerContainer");
					const currentSongDisplay = document.getElementById("currentSong");
					const playlist = document.getElementById("playlist");
					const playlistWrapper = document.getElementById("playlistWrapper");

					// Progress bar elements
					const progressBar = document.getElementById("progressBar");
					const progressFill = document.getElementById("progressFill");
					const currentTimeEl = document.getElementById("currentTime");
					const totalTimeEl = document.getElementById("totalTime");

					// Volume control elements
					const volumeSlider = document.getElementById("volumeSlider");
					const volumeValue = document.getElementById("volumeValue");
					const muteBtn = document.getElementById("muteBtn");
					let isMuted = false;
					const songList = document.getElementById("songList");
					const pagination = document.getElementById("pagination");
					const durationCacheKey = "music_duration_cache_v1";
					const durationCache = new Map(Object.entries(JSON.parse(localStorage.getItem(durationCacheKey) || "{}")));
					const durationLoading = new Map();

					function resolveSong(playlist, index) {
						const item = playlist[index];
						if (typeof item === 'string') {
							return {
								path: MUSIC_FOLDER + item + '.mp3',
								title: item.replace(/\.mp3$/, '')
							};
						}
						return item;
					}

					function saveDurationCache() {
						localStorage.setItem(durationCacheKey, JSON.stringify(Object.fromEntries(durationCache)));
					}

					function queueDurationLoad(url, durationEl) {
						if (durationCache.has(url)) {
							durationEl.textContent = durationCache.get(url);
							return;
						}

						durationEl.textContent = "--:--";
						if (durationLoading.has(url)) {
							durationLoading.get(url).then((value) => {
								durationEl.textContent = value;
							});
							return;
						}

						const loadPromise = new Promise((resolve) => {
							const tempAudio = new Audio();
							tempAudio.preload = "metadata";
							tempAudio.src = url;
							tempAudio.addEventListener("loadedmetadata", function () {
								const value = formatTime(tempAudio.duration);
								durationCache.set(url, value);
								saveDurationCache();
								resolve(value);
							});
							tempAudio.addEventListener("error", function () {
								resolve("0:00");
							});
						});

						durationLoading.set(url, loadPromise);
						loadPromise.then((value) => {
							durationLoading.delete(url);
							durationEl.textContent = value;
						});
					}

					// Format time helper
					function formatTime(seconds) {
						if (isNaN(seconds)) return "0:00";
						const mins = Math.floor(seconds / 60);
						const secs = Math.floor(seconds % 60);
						return `${mins}:${secs.toString().padStart(2, "0")}`;
					}

					// Update progress bar
					function updateProgress() {
						const audio = document.getElementById("audioPlayer");
						if (audio && !isNaN(audio.duration)) {
							const progress = (audio.currentTime / audio.duration) * 100;
							progressFill.style.width = progress + "%";
							currentTimeEl.textContent = formatTime(audio.currentTime);
							totalTimeEl.textContent = formatTime(audio.duration);
						}
					}

					// Progress bar click to seek
					progressBar.addEventListener("click", function (e) {
						const audio = document.getElementById("audioPlayer");
						if (audio && !isNaN(audio.duration)) {
							const rect = progressBar.getBoundingClientRect();
							const percent = (e.clientX - rect.left) / rect.width;
							audio.currentTime = percent * audio.duration;
						}
					});

					categorySelect.addEventListener("change", function () {
						currentPlaylist = this.value;
						currentIndex = 0;
						currentPage = 1;
						renderPlaylist();
					});

					function renderPlaylist() {
						songList.innerHTML = "";
						const currentList = playlists[currentPlaylist];
						const fragment = document.createDocumentFragment();

						// Kiểm tra nếu là playlist đặc biệt (đã được xử lý sẵn)
						const isSpecialPlaylist = currentPlaylist === "Tất cả bài hát" || currentPlaylist === "Danh Sách Yêu Thích";

						const start = (currentPage - 1) * pageSize;
						const end = Math.min(start + pageSize, currentList.length);

						for (let idx = start; idx < end; idx++) {
							let song, url, title;

							if (isSpecialPlaylist) {
								// Đã có đầy đủ thông tin
								song = currentList[idx];
								url = song.path;
								title = song.title;
							} else {
								// Tạo đối tượng song từ tên file
								const filename = currentList[idx];
								url = MUSIC_FOLDER + filename + ".mp3";
								title = filename.replace(/\.mp3$/, "");
							}

							const isFavorite = favorites.some((fav) => fav === url);

							const songItem = document.createElement("div");
							songItem.className = "song-item" + (idx === currentIndex ? " playing" : "");

							// Song number
							const songNumber = document.createElement("div");
							songNumber.className = "song-number";
							songNumber.textContent = idx === currentIndex ? "🎵" : (idx + 1).toString();
							songItem.appendChild(songNumber);

							// Song info
							const songInfo = document.createElement("div");
							songInfo.className = "song-info";

							const songIcon = document.createElement("span");
							songIcon.className = "song-icon";
							songIcon.textContent = "🎵";

							const songTitle = document.createElement("div");
							songTitle.className = "song-title";
							songTitle.textContent = title;

							songInfo.appendChild(songIcon);
							songInfo.appendChild(songTitle);
							songItem.appendChild(songInfo);

							// Song duration
							const songDuration = document.createElement("div");
							songDuration.className = "song-duration";
							queueDurationLoad(url, songDuration);
							songItem.appendChild(songDuration);

							// Favorite button
							const favoriteBtn = document.createElement("button");
							favoriteBtn.className = "favorite-btn" + (isFavorite ? " active" : "");
							favoriteBtn.innerHTML = isFavorite ? "❤️" : "🤍";
							favoriteBtn.onclick = (event) => {
								event.stopPropagation();
								toggleFavorite(url);
							};
							songItem.appendChild(favoriteBtn);

							songItem.onclick = (event) => {
								if (event.target !== favoriteBtn) {
									currentIndex = idx;
									play(currentIndex);
									renderPlaylist();
								}
							};
							fragment.appendChild(songItem);
						}
						songList.appendChild(fragment);
						renderPagination();
					}

					function renderPagination() {
						pagination.innerHTML = "";
						const totalPages = Math.ceil(playlists[currentPlaylist].length / pageSize);
						const isMobile = window.innerWidth <= 360; // 360px là breakpoint cho mobile nhỏ
						const maxVisiblePages = isMobile ? 3 : 5; // 3 cho mobile nhỏ, 5 cho desktop
						let startPage, endPage;

						// Tính toán trang bắt đầu và kết thúc để hiển thị
						if (totalPages <= maxVisiblePages) {
							startPage = 1;
							endPage = totalPages;
						} else {
							// Tính toán để trang hiện tại luôn nằm giữa
							const maxPagesBeforeCurrent = Math.floor(maxVisiblePages / 2);
							const maxPagesAfterCurrent = Math.ceil(maxVisiblePages / 2) - 1;

							if (currentPage <= maxPagesBeforeCurrent) {
								// Trang hiện tại gần đầu
								startPage = 1;
								endPage = maxVisiblePages;
							} else if (currentPage + maxPagesAfterCurrent >= totalPages) {
								// Trang hiện tại gần cuối
								startPage = totalPages - maxVisiblePages + 1;
								endPage = totalPages;
							} else {
								// Trang hiện tại ở giữa
								startPage = currentPage - maxPagesBeforeCurrent;
								endPage = currentPage + maxPagesAfterCurrent;
							}
						}

						// Nút Previous
						const prevBtn = document.createElement("button");
						prevBtn.textContent = "<";
						prevBtn.disabled = currentPage === 1;
						prevBtn.onclick = () => {
							if (currentPage > 1) {
								currentPage--;
								renderPlaylist();
							}
						};
						pagination.appendChild(prevBtn);

						// Nút trang đầu tiên
						if (startPage > 1) {
							const firstPageBtn = document.createElement("button");
							firstPageBtn.textContent = "1";
							firstPageBtn.onclick = () => {
								currentPage = 1;
								renderPlaylist();
							};
							pagination.appendChild(firstPageBtn);

							// Thêm dấu "..." nếu cần
							if (startPage > 2) {
								const ellipsis = document.createElement("span");
								ellipsis.textContent = "...";
								ellipsis.style.color = "var(--spotify-gray-text)";
								pagination.appendChild(ellipsis);
							}
						}

						// Các nút trang
						for (let i = startPage; i <= endPage; i++) {
							const pageBtn = document.createElement("button");
							pageBtn.textContent = i;
							if (i === currentPage) {
								pageBtn.className = "active";
							}
							pageBtn.onclick = () => {
								currentPage = i;
								renderPlaylist();
							};
							pagination.appendChild(pageBtn);
						}

						// Nút trang cuối cùng
						if (endPage < totalPages) {
							// Thêm dấu "..." nếu cần
							if (endPage < totalPages - 1) {
								const ellipsis = document.createElement("span");
								ellipsis.textContent = "...";
								ellipsis.style.color = "var(--spotify-gray-text)";
								pagination.appendChild(ellipsis);
							}

							const lastPageBtn = document.createElement("button");
							lastPageBtn.textContent = totalPages;
							lastPageBtn.onclick = () => {
								currentPage = totalPages;
								renderPlaylist();
							};
							pagination.appendChild(lastPageBtn);
						}

						// Nút Next
						const nextBtn = document.createElement("button");
						nextBtn.textContent = ">";
						nextBtn.disabled = currentPage === totalPages;
						nextBtn.onclick = () => {
							if (currentPage < totalPages) {
								currentPage++;
								renderPlaylist();
							}
						};
						pagination.appendChild(nextBtn);
					}

					function play(index) {
						const currentList = playlists[currentPlaylist];
						const isSpecialPlaylist = currentPlaylist === "Tất cả bài hát" || currentPlaylist === "Danh Sách Yêu Thích";

						let songData, url, title;
						songData = currentList[index];

						// Nếu là playlist thông thường, tạo đối tượng song từ tên file
						if (!isSpecialPlaylist) {
							songData = {
								path: MUSIC_FOLDER + songData + ".mp3",
								title: typeof songData === "string" ? songData.replace(/\.mp3$/, "") : songData.title,
							};
						}

						let audio = document.getElementById("audioPlayer");

						// Tạo audio player nếu chưa tồn tại
						if (!audio) {
							audio = document.createElement("audio");
							audio.id = "audioPlayer";
							audio.controls = false; // ẩn controls vì chúng ta có custom player
							audio.volume = volumeSlider.value / 100;
							audio.addEventListener("ended", function () {
								if (isRepeat) play(currentIndex);
								else playNext();
							});
							audio.addEventListener("play", function () {
								updatePlayPauseButton(true);
							});
							audio.addEventListener("pause", function () {
								updatePlayPauseButton(false);
							});
							audio.addEventListener("timeupdate", updateProgress);
							audio.addEventListener("loadedmetadata", updateProgress);
							playerContainer.appendChild(audio);
						}

						// Cập nhật title của trang
						document.title = songData.title;

						// Cập nhật thông tin bài hát trên player bar
						const trackName = document.getElementById("trackName");
						const trackArt = document.getElementById("trackArt");

						if (trackName) {
							trackName.textContent = songData.title;
						}

						if (trackArt) {
							trackArt.textContent = "";
						}

						// Cập nhật player
						audio.src = songData.path;
						audio.play();
						if (isRandom) {
							playedSongs.add(songData.path);
						}

						// Cập nhật UI
						currentIndex = index;
						renderPlaylist();
					}

					let isRepeat = false;

					function toggleRepeat() {
						isRepeat = !isRepeat;
						const repeatBtn = document.getElementById("repeatBtn");
						if (repeatBtn) {
							if (isRepeat) {
								repeatBtn.classList.add("active");
								if (isNoRepeat) toggleNoRepeat();
							} else {
								repeatBtn.classList.remove("active");
							}
						}
						Toastify({
							text: isRepeat ? "Đã bật lặp lại bài" : "Đã tắt lặp lại bài",
							duration: 2000,
							gravity: "top",
							position: "right",
							stopOnFocus: true,
							style: {
								background: isRepeat ? "var(--spotify-green)" : "var(--spotify-gray-light)",
								color: "var(--spotify-white)",
								borderRadius: "8px",
								padding: "10px 15px",
								boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
							},
						}).showToast();
					}

					function playNext() {
						const currentList = playlists[currentPlaylist];
						if (isRandom) {
							let nextIndex;
							if (isNoRepeat) {
								const availableIndexes = Array.from({ length: currentList.length }, (_, i) => i).filter((idx) => {
									const song = resolveSong(currentList, idx);
									return !playedSongs.has(song.path);
								});

								if (availableIndexes.length === 0) {
									playedSongs.clear();
									nextIndex = 0;
								} else {
									const randomPos = Math.floor(Math.random() * availableIndexes.length);
									nextIndex = availableIndexes[randomPos];
								}
								const nextSong = resolveSong(currentList, nextIndex);
								playedSongs.add(nextSong.path);
							} else {
								// Nếu không bật "Không lặp lại", chọn ngẫu nhiên bất kỳ bài hát nào
								nextIndex = Math.floor(Math.random() * currentList.length);
							}
							currentIndex = nextIndex;
						} else {
							currentIndex = (currentIndex + 1) % currentList.length;
						}
						// Cập nhật currentPage dựa trên bài hát mới
						currentPage = Math.floor(currentIndex / pageSize) + 1;
						play(currentIndex);
						renderPagination();
					}

					function toggleNoRepeat() {
						isNoRepeat = !isNoRepeat;
						const noRepeatBtn = document.getElementById("noRepeatBtn");
						if (noRepeatBtn) {
							if (isNoRepeat) {
								playedSongs.clear();
								noRepeatBtn.classList.add("active");
								if (isRepeat) toggleRepeat();
								if (!isRandom) toggleRandom();
							} else {
								playedSongs.clear();
								noRepeatBtn.classList.remove("active");
							}
						}
						Toastify({
							text: isNoRepeat ? "Đã tắt phát lại" : "Đã bật phát lại",
							duration: 2000,
							gravity: "top",
							position: "right",
							stopOnFocus: true,
							style: {
								background: isNoRepeat ? "var(--spotify-green)" : "var(--spotify-gray-light)",
								color: "var(--spotify-white)",
								borderRadius: "8px",
								padding: "10px 15px",
								boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
							},
						}).showToast();
					}

					function toggleRandom() {
						isRandom = !isRandom;
						const shuffleBtn = document.getElementById("shuffleBtn");
						if (shuffleBtn) {
							if (isRandom) {
								shuffleBtn.classList.add("active");
							} else {
								shuffleBtn.classList.remove("active");
								if (isNoRepeat) toggleNoRepeat();
							}
						}
						Toastify({
							text: isRandom ? "Đã bật chế độ ngẫu nhiên" : "Đã tắt chế độ ngẫu nhiên",
							duration: 2000,
							gravity: "top",
							position: "right",
							stopOnFocus: true,
							style: {
								background: isRandom ? "var(--spotify-green)" : "var(--spotify-gray-light)",
								color: "var(--spotify-white)",
								borderRadius: "8px",
								padding: "10px 15px",
								boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
							},
						}).showToast();
					}

					function toggleFavorite(url) {
						const user = auth.currentUser;
						if (!user) {
							window.location.href = "../login.html";
							return;
						}

						const isFavorite = favorites.includes(url);
						if (isFavorite) {
							favorites = favorites.filter((song) => song !== url);
							// Xóa bài hát khỏi danh sách yêu thích
							const index = playlists["Danh Sách Yêu Thích"].findIndex((song) => song.path === url);
							if (index !== -1) {
								playlists["Danh Sách Yêu Thích"].splice(index, 1);
							}
						} else {
							favorites.push(url);
							const title = url.replace(MUSIC_FOLDER, "").replace(/\.mp3$/, "");
							playlists["Danh Sách Yêu Thích"].push({ path: url, title });
						}

						// Lưu vào localStorage
						localStorage.setItem("favorites", JSON.stringify(favorites));

						// Lưu lên Firebase
						saveFavoritesToFirebase(user.uid, favorites);

						renderPlaylist();
					}

					// Volume control event listeners
					if (volumeSlider && muteBtn) {
						// Xử lý sự kiện khi di chuyển thanh trượt (debounced)
						let volumeTimeout;
						volumeSlider.addEventListener("input", function () {
							const volume = this.value / 100;
							volumeValue.textContent = `${this.value}%`;

							if (isMuted) {
								isMuted = false;
								muteBtn.innerHTML = '<span class="material-icons">volume_up</span>';
							}

							clearTimeout(volumeTimeout);
							volumeTimeout = setTimeout(() => {
								const audioElements = document.getElementsByTagName("audio");
								for (let audio of audioElements) {
									audio.volume = volume;
								}
							}, 50);
						});

						// Xử lý sự kiện khi click nút mute
						muteBtn.onclick = function () {
							isMuted = !isMuted;
							const volume = volumeSlider.value / 100;

							// Update icon
							this.innerHTML = isMuted ? '<span class="material-icons">volume_off</span>' : '<span class="material-icons">volume_up</span>';

							// Update volume for all audio elements
							const audioElements = document.getElementsByTagName("audio");
							for (let audio of audioElements) {
								audio.volume = isMuted ? 0 : volume;
							}
						};

						// Set initial volume
						volumeSlider.value = 50;
						volumeValue.textContent = "50%";

						// Apply initial volume to all elements
						const audioElements = document.getElementsByTagName("audio");
						for (let audio of audioElements) {
							audio.volume = 0.5;
						}
					}

					// Thêm sự kiện lắng nghe phím
					document.addEventListener("keydown", function (event) {
						const volumeSlider = document.getElementById("volumeSlider");
						if (!volumeSlider) return;

						let currentVolume = parseInt(volumeSlider.value);
						const step = 1; // Bước nhảy âm lượng

						switch (event.key) {
							case "ArrowRight":
								event.preventDefault();
								currentVolume = Math.min(100, currentVolume + step);
								break;
							case "ArrowLeft":
								event.preventDefault();
								currentVolume = Math.max(0, currentVolume - step);
								break;
							case "m":
							case "M":
								event.preventDefault();
								const muteBtn = document.getElementById("muteBtn");
								if (muteBtn) muteBtn.click();
								return; // Không cần cập nhật thanh trượt vì đã xử lý trong click event
							case " ":
								event.preventDefault(); // Ngăn cuộn trang khi nhấn space
								const player = document.querySelector("audio, video");
								if (player) {
									if (player.paused) {
										player.play();
									} else {
										player.pause();
									}
								}
								return;
							default:
								return; // Thoát nếu không phải phím hỗ trợ
						}

						// Cập nhật thanh trượt và kích hoạt sự kiện input
						volumeSlider.value = currentVolume;
						volumeSlider.dispatchEvent(new Event("input"));
					});

					// Play/Pause button function
					function updatePlayPauseButton(isPlaying) {
						const playPauseBtn = document.getElementById("playPauseBtn");
						if (playPauseBtn) {
							const icon = playPauseBtn.querySelector(".material-icons");
							if (icon) {
								icon.textContent = isPlaying ? "pause" : "play_arrow";
							}
						}
					}

					function togglePlayPause() {
						const audio = document.getElementById("audioPlayer");
						if (audio) {
							if (audio.paused) {
								audio.play();
							} else {
								audio.pause();
							}
						}
					}

					function playPrevious() {
						const currentList = playlists[currentPlaylist];
						currentIndex = currentIndex === 0 ? currentList.length - 1 : currentIndex - 1;
						currentPage = Math.floor(currentIndex / pageSize) + 1;
						play(currentIndex);
						renderPagination();
					}

					// Shuffle mặc định bật
					if (isRandom) {
						const shuffleBtn = document.getElementById("shuffleBtn");
						if (shuffleBtn) shuffleBtn.classList.add("active");
					}

					// Khởi động trang
					renderPlaylist();

					// Đồng bộ danh sách yêu thích giữa các tab
					const handleStorageChange = () => {
						favorites = JSON.parse(localStorage.getItem("favorites") || "[]");
						renderPlaylist();
					};

					window.addEventListener("storage", handleStorageChange);

					// Xuất các hàm cần thiết ra global scope
					Object.assign(window, {
						playNext,
						playPrevious,
						toggleRepeat,
						toggleRandom,
						toggleNoRepeat,
						togglePlayPause,
						updatePlayPauseButton,
						updateProgress,
						formatTime,
					});

					// Ẩn thông tin bài hát khi dừng phát
					document.addEventListener(
						"ended",
						function () {
							document.getElementById("currentSong").classList.add("hidden");
						},
						true,
					);
				})
				.catch((error) => {
					console.error("Lỗi khi tải danh sách phát:", error);
					// Sử dụng Toastify thay vì Swal.fire
					Toastify({
						text: "Lỗi khi tải danh sách phát",
						duration: 2000,
						gravity: "top",
						position: "right",
						stopOnFocus: true,
						style: {
							background: "#1f2937",
							color: "#f3f4f6",
							borderRadius: "8px",
							padding: "10px 15px",
							boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
						},
					}).showToast();
				});
		
