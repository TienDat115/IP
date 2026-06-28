let curatedLinks = [];

async function loadCuratedLinks() {
	const container = document.getElementById("linksContainer");
	if (!currentUser) {
		container.innerHTML = '<p class="text-gray-400 text-center">Vui lòng đăng nhập để xem link phim.</p>';
		return;
	}
	container.innerHTML = '<p class="text-gray-400 text-center"><i class="fas fa-spinner fa-spin mr-2"></i>Đang tải...</p>';
	try {
		const snapshot = await db.collection("users").doc(currentUser.uid).collection("curatedLinks").orderBy("addedAt", "desc").get();
		curatedLinks = [];
		snapshot.forEach((doc) => {
			curatedLinks.push({ id: doc.id, ...doc.data() });
		});
		renderLinks();
	} catch (err) {
		container.innerHTML = '<p class="text-red-400 text-center">Không thể tải danh sách link: ' + err.message + '</p>';
	}
}

let searchTerm = "";
let currentPage = 1;
const PAGE_SIZE = 10;

function filterCuratedLinks() {
	searchTerm = document.getElementById("searchInput").value.toLowerCase().trim();
	currentPage = 1;
	renderLinks();
}

function getFilteredLinks() {
	return searchTerm
		? curatedLinks.filter((l) => l.title.toLowerCase().includes(searchTerm) || l.source.toLowerCase().includes(searchTerm))
		: curatedLinks;
}

function renderLinks() {
	const container = document.getElementById("linksContainer");
	const filtered = getFilteredLinks();
	const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
	if (currentPage > totalPages) currentPage = totalPages;
	const start = (currentPage - 1) * PAGE_SIZE;
	const pageItems = filtered.slice(start, start + PAGE_SIZE);
	if (filtered.length === 0) {
		container.innerHTML = '<p class="text-gray-400 text-center">' + (searchTerm ? 'Không tìm thấy phim nào.' : 'Chưa có link nào.') + '</p>';
		return;
	}
	container.innerHTML = "";
	pageItems.forEach((link) => {
		const card = document.createElement("div");
		card.className = "curated-card bg-gray-800 rounded-lg p-5 hover:bg-gray-750 transition border-l-4 border-teal-500";
		card.dataset.id = link.id;
		const isLoggedIn = !!currentUser;
		card.innerHTML = `
			<div class="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
				<div class="flex-1 min-w-0">
					<h3 class="text-base sm:text-lg font-semibold text-white mb-1">${escapeHtml(link.title)}</h3>
					<p class="text-gray-400 text-xs sm:text-sm mb-2 truncate">${escapeHtml(link.url)}</p>
					<span class="inline-block bg-teal-600 text-xs px-2 py-1 rounded font-medium">${escapeHtml(link.source)}</span>
				</div>
				<div class="flex flex-col items-stretch gap-2 flex-shrink-0 min-w-0 w-full sm:w-auto sm:min-w-[220px]">
					<a href="${escapeHtml(link.url)}" target="_blank" class="bg-purple-600 hover:bg-purple-700 px-4 py-2.5 rounded-lg text-sm transition font-medium text-center">
						<i class="fas fa-external-link-alt mr-1"></i>Xem phim
					</a>
					<div class="flex items-center justify-between gap-1">
						<div class="flex items-center gap-1">
							<input type="text" id="time-${link.id}" placeholder="00:00" class="w-16 sm:w-20 bg-gray-700 text-white text-xs rounded px-1 py-1 border border-gray-600 focus:border-purple-500 outline-none text-center" onkeydown="if(event.key==='Enter')saveCuratedTime('${link.id}')" />
							<button onclick="saveCuratedTime('${link.id}')" class="bg-green-600 hover:bg-green-700 text-xs px-1.5 sm:px-2 py-1 rounded transition" title="Lưu thời gian">
								<i class="fas fa-save"></i>
							</button>
							<button onclick="toggleVirtualKeyboard('${link.id}')" class="text-purple-400 hover:text-purple-300 transition text-xs px-1 py-1" title="Mở bàn phím ảo">
								<i class="fas fa-keyboard"></i>
							</button>
							<span id="saved-${link.id}" class="text-green-400 text-xs hidden"><i class="fas fa-check"></i></span>
						</div>
						<div class="flex items-center gap-1">
							<button onclick="editCuratedLink('${link.id}')" class="text-blue-400 hover:text-blue-300 transition text-xs px-1.5 py-1 rounded border border-blue-500/30 hover:border-blue-400 ${isLoggedIn ? '' : 'hidden'}" title="Sửa thông tin">
								<i class="fas fa-edit"></i>
							</button>
							<button onclick="deleteCuratedLink('${link.id}')" class="text-red-400 hover:text-red-300 transition text-xs px-1.5 py-1 rounded border border-red-500/30 hover:border-red-400 ${isLoggedIn ? '' : 'hidden'}" title="Xóa video">
								<i class="fas fa-trash-alt"></i>
							</button>
						</div>
					</div>
					<div id="kbd-${link.id}" class="hidden bg-gray-800 rounded-lg p-2 w-full">
						<div class="grid grid-cols-10 gap-0.5 sm:gap-1 mb-1">
							<button onclick="kbdInsert('${link.id}','1')" class="bg-gray-600 hover:bg-gray-500 text-white px-0.5 sm:px-1 py-0.5 rounded text-xs min-w-0">1</button>
							<button onclick="kbdInsert('${link.id}','2')" class="bg-gray-600 hover:bg-gray-500 text-white px-0.5 sm:px-1 py-0.5 rounded text-xs min-w-0">2</button>
							<button onclick="kbdInsert('${link.id}','3')" class="bg-gray-600 hover:bg-gray-500 text-white px-0.5 sm:px-1 py-0.5 rounded text-xs min-w-0">3</button>
							<button onclick="kbdInsert('${link.id}','4')" class="bg-gray-600 hover:bg-gray-500 text-white px-0.5 sm:px-1 py-0.5 rounded text-xs min-w-0">4</button>
							<button onclick="kbdInsert('${link.id}','5')" class="bg-gray-600 hover:bg-gray-500 text-white px-0.5 sm:px-1 py-0.5 rounded text-xs min-w-0">5</button>
							<button onclick="kbdInsert('${link.id}','6')" class="bg-gray-600 hover:bg-gray-500 text-white px-0.5 sm:px-1 py-0.5 rounded text-xs min-w-0">6</button>
							<button onclick="kbdInsert('${link.id}','7')" class="bg-gray-600 hover:bg-gray-500 text-white px-0.5 sm:px-1 py-0.5 rounded text-xs min-w-0">7</button>
							<button onclick="kbdInsert('${link.id}','8')" class="bg-gray-600 hover:bg-gray-500 text-white px-0.5 sm:px-1 py-0.5 rounded text-xs min-w-0">8</button>
							<button onclick="kbdInsert('${link.id}','9')" class="bg-gray-600 hover:bg-gray-500 text-white px-0.5 sm:px-1 py-0.5 rounded text-xs min-w-0">9</button>
							<button onclick="kbdInsert('${link.id}','0')" class="bg-gray-600 hover:bg-gray-500 text-white px-0.5 sm:px-1 py-0.5 rounded text-xs min-w-0">0</button>
						</div>
						<div class="grid grid-cols-6 gap-0.5 sm:gap-1">
							<button onclick="kbdInsert('${link.id}',':')" class="bg-gray-600 hover:bg-gray-500 text-white px-0.5 sm:px-1 py-0.5 rounded text-xs min-w-0">:</button>
							<button onclick="kbdInsert('${link.id}','-')" class="bg-gray-600 hover:bg-gray-500 text-white px-0.5 sm:px-1 py-0.5 rounded text-xs min-w-0">-</button>
							<button onclick="kbdInsert('${link.id}',' ')" class="bg-gray-600 hover:bg-gray-500 text-white px-0.5 sm:px-1 py-0.5 rounded text-xs min-w-0">space</button>
							<button onclick="kbdBackspace('${link.id}')" class="bg-orange-600 hover:bg-orange-700 text-white px-0.5 sm:px-1 py-0.5 rounded text-xs min-w-0"><i class="fas fa-backspace"></i></button>
							<button onclick="kbdClear('${link.id}')" class="bg-red-600 hover:bg-red-700 text-white px-0.5 sm:px-1 py-0.5 rounded text-xs min-w-0">Xóa hết</button>
							<button onclick="toggleVirtualKeyboard('${link.id}')" class="bg-purple-600 hover:bg-purple-700 text-white px-0.5 sm:px-1 py-0.5 rounded text-xs min-w-0">Đóng</button>
						</div>
					</div>
				</div>
			</div>
		`;
		container.appendChild(card);
	});
	loadCuratedTimes();
	renderPagination();
}

function renderPagination() {
	const container = document.getElementById("linksContainer");
	const filtered = getFilteredLinks();
	const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
	if (totalPages <= 1) return;

	const nav = document.createElement("div");
	nav.className = "flex items-center justify-center gap-2 pt-6";

	const prevBtn = document.createElement("button");
	prevBtn.className = "px-3 py-1.5 rounded text-sm transition " + (currentPage === 1 ? "bg-gray-700 text-gray-500 cursor-not-allowed" : "bg-gray-700 text-white hover:bg-purple-600");
	prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
	prevBtn.disabled = currentPage === 1;
	prevBtn.onclick = () => { if (currentPage > 1) { currentPage--; renderLinks(); } };
	nav.appendChild(prevBtn);

	const maxVisible = 5;
	let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
	let endPage = Math.min(totalPages, startPage + maxVisible - 1);
	if (endPage - startPage + 1 < maxVisible) {
		startPage = Math.max(1, endPage - maxVisible + 1);
	}

	if (startPage > 1) {
		const firstBtn = document.createElement("button");
		firstBtn.className = "px-3 py-1.5 rounded text-sm bg-gray-700 text-white hover:bg-purple-600 transition";
		firstBtn.textContent = "1";
		firstBtn.onclick = () => { currentPage = 1; renderLinks(); };
		nav.appendChild(firstBtn);
		if (startPage > 2) {
			const dots = document.createElement("span");
			dots.className = "px-1 text-gray-400 text-sm";
			dots.textContent = "...";
			nav.appendChild(dots);
		}
	}

	for (let i = startPage; i <= endPage; i++) {
		const btn = document.createElement("button");
		btn.className = "px-3 py-1.5 rounded text-sm transition " + (i === currentPage ? "bg-purple-600 text-white" : "bg-gray-700 text-white hover:bg-purple-600");
		btn.textContent = i;
		btn.onclick = () => { currentPage = i; renderLinks(); };
		nav.appendChild(btn);
	}

	if (endPage < totalPages) {
		if (endPage < totalPages - 1) {
			const dots = document.createElement("span");
			dots.className = "px-1 text-gray-400 text-sm";
			dots.textContent = "...";
			nav.appendChild(dots);
		}
		const lastBtn = document.createElement("button");
		lastBtn.className = "px-3 py-1.5 rounded text-sm bg-gray-700 text-white hover:bg-purple-600 transition";
		lastBtn.textContent = totalPages;
		lastBtn.onclick = () => { currentPage = totalPages; renderLinks(); };
		nav.appendChild(lastBtn);
	}

	const nextBtn = document.createElement("button");
	nextBtn.className = "px-3 py-1.5 rounded text-sm transition " + (currentPage === totalPages ? "bg-gray-700 text-gray-500 cursor-not-allowed" : "bg-gray-700 text-white hover:bg-purple-600");
	nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
	nextBtn.disabled = currentPage === totalPages;
	nextBtn.onclick = () => { if (currentPage < totalPages) { currentPage++; renderLinks(); } };
	nav.appendChild(nextBtn);

	container.appendChild(nav);
}

function escapeHtml(str) {
	const div = document.createElement("div");
	div.textContent = str;
	return div.innerHTML;
}

async function addCuratedLink() {
	if (!currentUser) {
		Swal.fire({ icon: "warning", title: "Chưa đăng nhập", text: "Vui lòng đăng nhập để thêm link!", background: "#1f2937", color: "#fff", confirmButtonColor: "#7c3aed" });
		return;
	}
	const { value: form } = await Swal.fire({
		title: "Thêm Link Phim",
		width: "min(90vw, 500px)",
		padding: "1.25rem",
		html:
			'<input id="swal-title" placeholder="Tên phim" class="swal2-input swal-input-custom">' +
			'<input id="swal-url" placeholder="URL phim" class="swal2-input swal-input-custom">' +
			'<input id="swal-source" placeholder="Nguồn (VD: Siêu Tâm Phim)" class="swal2-input swal-input-custom">',
		focusConfirm: false,
		preConfirm: () => {
			const title = document.getElementById("swal-title").value.trim();
			const url = document.getElementById("swal-url").value.trim();
			const source = document.getElementById("swal-source").value.trim();
			if (!title) { Swal.showValidationMessage("Vui lòng nhập tên phim"); return; }
			if (!url) { Swal.showValidationMessage("Vui lòng nhập URL"); return; }
			if (!source) { Swal.showValidationMessage("Vui lòng nhập nguồn"); return; }
			return { title, url, source };
		},
		background: "#1f2937", color: "#fff", confirmButtonColor: "#7c3aed",
		customClass: {
			confirmButton: "swal-btn-custom",
			validationMessage: "swal-msg-custom"
		}
	});
	if (!form) return;
	try {
		await db.collection("users").doc(currentUser.uid).collection("curatedLinks").add({
			title: form.title,
			url: form.url,
			source: form.source,
			addedAt: firebase.firestore.FieldValue.serverTimestamp(),
		});
		Swal.fire({ icon: "success", title: "Đã thêm!", timer: 1500, showConfirmButton: false, background: "#1f2937", color: "#fff", confirmButtonColor: "#7c3aed" });
		loadCuratedLinks();
	} catch (err) {
		Swal.fire({ icon: "error", title: "Lỗi", text: err.message, background: "#1f2937", color: "#fff", confirmButtonColor: "#7c3aed" });
	}
}

async function deleteCuratedLink(docId) {
	if (!currentUser) return;
	const result = await Swal.fire({
		title: "Xóa video?",
		text: "Bạn có chắc muốn xóa video này?",
		icon: "warning",
		showCancelButton: true,
		confirmButtonColor: "#dc2626",
		cancelButtonColor: "#6b7280",
		confirmButtonText: "Xóa",
		cancelButtonText: "Hủy",
		background: "#1f2937", color: "#fff"
	});
	if (!result.isConfirmed) return;
	try {
		await db.collection("users").doc(currentUser.uid).collection("curatedLinks").doc(docId).delete();
		Swal.fire({ icon: "success", title: "Đã xóa!", timer: 1500, showConfirmButton: false, background: "#1f2937", color: "#fff" });
		loadCuratedLinks();
	} catch (err) {
		Swal.fire({ icon: "error", title: "Lỗi", text: err.message, background: "#1f2937", color: "#fff" });
	}
}

async function editCuratedLink(docId) {
	if (!currentUser) return;
	const link = curatedLinks.find((l) => l.id === docId);
	if (!link) return;

	const { value: form } = await Swal.fire({
		title: "Sửa thông tin phim",
		width: "min(90vw, 500px)",
		padding: "1.25rem",
		html:
			`<input id="swal-title" placeholder="Tên phim" class="swal2-input swal-input-custom" value="${escapeHtml(link.title)}">` +
			`<input id="swal-url" placeholder="URL phim" class="swal2-input swal-input-custom" value="${escapeHtml(link.url)}">` +
			`<input id="swal-source" placeholder="Nguồn (VD: Siêu Tâm Phim)" class="swal2-input swal-input-custom" value="${escapeHtml(link.source)}">`,
		focusConfirm: false,
		preConfirm: () => {
			const title = document.getElementById("swal-title").value.trim();
			const url = document.getElementById("swal-url").value.trim();
			const source = document.getElementById("swal-source").value.trim();
			if (!title) { Swal.showValidationMessage("Vui lòng nhập tên phim"); return; }
			if (!url) { Swal.showValidationMessage("Vui lòng nhập URL"); return; }
			if (!source) { Swal.showValidationMessage("Vui lòng nhập nguồn"); return; }
			return { title, url, source };
		},
		background: "#1f2937", color: "#fff", confirmButtonColor: "#7c3aed",
		customClass: {
			confirmButton: "swal-btn-custom",
			validationMessage: "swal-msg-custom"
		}
	});
	if (!form) return;
	try {
		await db.collection("users").doc(currentUser.uid).collection("curatedLinks").doc(docId).update({
			title: form.title,
			url: form.url,
			source: form.source,
		});
		Swal.fire({ icon: "success", title: "Đã cập nhật!", timer: 1500, showConfirmButton: false, background: "#1f2937", color: "#fff", confirmButtonColor: "#7c3aed" });
		loadCuratedLinks();
	} catch (err) {
		Swal.fire({ icon: "error", title: "Lỗi", text: err.message, background: "#1f2937", color: "#fff", confirmButtonColor: "#7c3aed" });
	}
}

async function saveCuratedTime(docId) {
	const timeInput = document.getElementById("time-" + docId);
	const savedEl = document.getElementById("saved-" + docId);
	const timeValue = timeInput.value.trim();

	if (!currentUser) {
		Swal.fire({ icon: "warning", title: "Chưa đăng nhập", text: "Vui lòng đăng nhập để lưu thời gian!", background: "#1f2937", color: "#fff" });
		return;
	}

	const card = timeInput.closest(".curated-card");
	const title = card.querySelector("h3").textContent;
	const url = card.querySelector("p.truncate").textContent;
	const timeDocId = encodeURIComponent(url);

	try {
		await db.collection("users").doc(currentUser.uid).collection("curatedTimes").doc(timeDocId).set({
			title, url, time: timeValue,
			savedAt: firebase.firestore.FieldValue.serverTimestamp(),
		});
		savedEl.classList.remove("hidden");
		setTimeout(() => savedEl.classList.add("hidden"), 3000);
	} catch (err) {
		Swal.fire({ icon: "error", title: "Lỗi", text: "Không thể lưu: " + err.message, background: "#1f2937", color: "#fff" });
	}
}

async function loadCuratedTimes() {
	if (!currentUser) return;
	try {
		const snapshot = await db.collection("users").doc(currentUser.uid).collection("curatedTimes").get();
		const timeMap = {};
		snapshot.forEach((doc) => {
			const data = doc.data();
			timeMap[data.url] = data.time;
		});
		document.querySelectorAll("#linksContainer .curated-card").forEach((card) => {
			const url = card.querySelector("p.truncate").textContent;
			if (timeMap[url]) {
				const input = card.querySelector("input");
				if (input) input.value = timeMap[url];
			}
		});
	} catch (err) {
		console.error("Lỗi tải thời gian đã lưu:", err);
	}
}

function toggleVirtualKeyboard(id) {
	const kbd = document.getElementById("kbd-" + id);
	if (kbd) kbd.classList.toggle("hidden");
}
function getTimeInput(id) {
	return document.getElementById("time-" + id);
}
function kbdInsert(id, char) {
	const input = getTimeInput(id);
	if (!input) return;
	const start = input.selectionStart;
	const end = input.selectionEnd;
	const val = input.value;
	input.value = val.slice(0, start) + char + val.slice(end);
	input.selectionStart = input.selectionEnd = start + char.length;
	input.focus();
}
function kbdBackspace(id) {
	const input = getTimeInput(id);
	if (!input) return;
	const start = input.selectionStart;
	if (start === 0) return;
	const val = input.value;
	input.value = val.slice(0, start - 1) + val.slice(start);
	input.selectionStart = input.selectionEnd = start - 1;
	input.focus();
}
function kbdClear(id) {
	const input = getTimeInput(id);
	if (!input) return;
	input.value = "";
	input.focus();
}

function updateAuthUI() {
	const btns = document.querySelectorAll(".curated-card .fa-trash-alt");
	btns.forEach((btn) => {
		btn.closest("button").classList.toggle("hidden", !currentUser);
	});
	const addBtn = document.getElementById("addLinkBtn");
	if (addBtn) addBtn.classList.toggle("hidden", !currentUser);
}

document.addEventListener("cinephim:auth-ready", () => {
	updateAuthUI();
	if (currentUser) loadCuratedLinks();
});

document.addEventListener("DOMContentLoaded", () => {
	const searchInput = document.getElementById("searchInput");
	if (searchInput) {
		searchInput.addEventListener("input", filterCuratedLinks);
	}
});

const mobileMenuToggle = document.getElementById("mobileMenuToggle");
const mobileMenu = document.getElementById("mobileMenu");

if (mobileMenuToggle) {
	mobileMenuToggle.addEventListener("click", toggleMobileMenu);
}

document.addEventListener("click", function (e) {
	if (mobileMenu && !mobileMenu.classList.contains("hidden")) {
		if (!mobileMenu.contains(e.target) && !mobileMenuToggle.contains(e.target)) {
			closeMobileMenu();
		}
	}
});

function syncThemeIcons() {
	const desktopIcon = document.getElementById("themeIcon");
	const mobileIcon = document.getElementById("mobileThemeIcon");

	if (desktopIcon && mobileIcon) {
		if (desktopIcon.classList.contains("fa-moon")) {
			mobileIcon.className = "fas fa-moon";
		} else {
			mobileIcon.className = "fas fa-sun";
		}
	}
}

function syncLoginIcons() {
	const desktopIcon = document.getElementById("loginIcon");
	const mobileIcon = document.getElementById("mobileLoginIcon");
	const desktopText = document.getElementById("loginText");

	if (desktopIcon && mobileIcon) {
		mobileIcon.className = desktopIcon.className;
		if (desktopText && desktopText.textContent === "Đăng xuất") {
			mobileIcon.className = "fas fa-sign-out-alt";
		} else {
			mobileIcon.className = "fas fa-sign-in-alt";
		}
	}
}

const originalToggleTheme = window.toggleTheme;
window.toggleTheme = function () {
	originalToggleTheme();
	syncThemeIcons();
};

const originalToggleLogin = window.toggleLogin;
window.toggleLogin = function () {
	originalToggleLogin();
	syncLoginIcons();
};

setTimeout(() => {
	syncThemeIcons();
	syncLoginIcons();
}, 100);
