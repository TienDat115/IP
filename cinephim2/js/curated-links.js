var curatedLinks = [];

function loadCuratedLinks() {
	var container = document.getElementById("linksContainer");
	container.innerHTML = '<p class="text-gray-400 text-center"><i class="fas fa-spinner fa-spin mr-2"></i>Đang tải...</p>';
	return db.collection("curatedLinks").orderBy("addedAt", "desc").get().then(function(snapshot) {
		curatedLinks = [];
		snapshot.forEach(function(doc) {
			var docData = doc.data();
			var item = { id: doc.id };
			for (var key in docData) {
				if (docData.hasOwnProperty(key)) {
					item[key] = docData[key];
				}
			}
			curatedLinks.push(item);
		});
		renderLinks();
	}).catch(function(err) {
		container.innerHTML = '<p class="text-red-400 text-center">Không thể tải danh sách link: ' + err.message + '</p>';
	});
}

var searchTerm = "";
var currentPage = 1;
var PAGE_SIZE = 10;

function filterCuratedLinks() {
	searchTerm = document.getElementById("linkSearchInput").value.toLowerCase().trim();
	currentPage = 1;
	renderLinks();
}

function getFilteredLinks() {
	if (!searchTerm) return curatedLinks;
	return curatedLinks.filter(function(l) {
		return l.title.toLowerCase().indexOf(searchTerm) !== -1 || l.source.toLowerCase().indexOf(searchTerm) !== -1;
	});
}

function renderLinks() {
	var container = document.getElementById("linksContainer");
	var filtered = getFilteredLinks();
	var totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
	if (currentPage > totalPages) currentPage = totalPages;
	var start = (currentPage - 1) * PAGE_SIZE;
	var pageItems = filtered.slice(start, start + PAGE_SIZE);
	if (filtered.length === 0) {
		container.innerHTML = '<p class="text-gray-400 text-center">' + (searchTerm ? 'Không tìm thấy phim nào.' : 'Chưa có link nào.') + '</p>';
		return;
	}
	container.innerHTML = "";
	pageItems.forEach(function(link) {
		var card = document.createElement("div");
		card.className = "curated-card bg-gray-800 rounded-lg p-5 hover:bg-gray-750 transition border-l-4 border-teal-500";
		card.dataset.id = link.id;
		var isLoggedIn = !!currentUser;
		var editBtnHidden = isLoggedIn ? '' : 'hidden';
		card.innerHTML =
			'<div class="flex flex-col sm:flex-row sm:items-start justify-between gap-3">' +
			'<div class="flex-1 min-w-0">' +
			'<h3 class="text-base sm:text-lg font-semibold text-white mb-1">' + escapeHtml(link.title) + '</h3>' +
			'<p class="text-gray-400 text-xs sm:text-sm mb-2 truncate">' + escapeHtml(link.url) + '</p>' +
			'<span class="inline-block bg-teal-600 text-xs px-2 py-1 rounded font-medium">' + escapeHtml(link.source) + '</span>' +
			'</div>' +
			'<div class="flex flex-col items-stretch gap-2 flex-shrink-0 min-w-0 w-full sm:w-auto sm:min-w-[220px]">' +
			'<a href="' + escapeHtml(link.url) + '" target="_blank" class="bg-purple-600 hover:bg-purple-700 px-4 py-2.5 rounded-lg text-sm transition font-medium text-center">' +
			'<i class="fas fa-external-link-alt mr-1"></i>Xem phim' +
			'</a>' +
			'<div class="flex items-center justify-between gap-1">' +
			'<div class="flex items-center gap-1">' +
			'<input type="text" id="time-' + link.id + '" placeholder="00:00" class="w-16 sm:w-20 bg-gray-700 text-white text-xs rounded px-1 py-1 border border-gray-600 focus:border-purple-500 outline-none text-center" />' +
			'<button onclick="saveCuratedTime(\'' + link.id + '\')" class="bg-green-600 hover:bg-green-700 text-xs px-1.5 sm:px-2 py-1 rounded transition" title="Lưu thời gian">' +
			'<i class="fas fa-save"></i>' +
			'</button>' +
			'<button onclick="toggleVirtualKeyboard(\'' + link.id + '\')" class="text-purple-400 hover:text-purple-300 transition text-xs px-1 py-1" title="Mở bàn phím ảo">' +
			'<i class="fas fa-keyboard"></i>' +
			'</button>' +
			'<span id="saved-' + link.id + '" class="text-green-400 text-xs hidden"><i class="fas fa-check"></i></span>' +
			'</div>' +
			'<div class="flex items-center gap-1">' +
			'<button onclick="editCuratedLink(\'' + link.id + '\')" class="text-blue-400 hover:text-blue-300 transition text-xs px-1.5 py-1 rounded border border-blue-500/30 hover:border-blue-400 ' + editBtnHidden + '" title="Sửa thông tin">' +
			'<i class="fas fa-edit"></i>' +
			'</button>' +
			'<button onclick="deleteCuratedLink(\'' + link.id + '\')" class="text-red-400 hover:text-red-300 transition text-xs px-1.5 py-1 rounded border border-red-500/30 hover:border-red-400 ' + editBtnHidden + '" title="Xóa video">' +
			'<i class="fas fa-trash-alt"></i>' +
			'</button>' +
			'</div>' +
			'</div>' +
			'<div id="kbd-' + link.id + '" class="hidden bg-gray-800 rounded-lg p-2 w-full">' +
			'<div class="grid grid-cols-10 gap-0.5 sm:gap-1 mb-1">' +
			kbdButtonsHtml(link.id) +
			'</div>' +
			'<div class="grid grid-cols-6 gap-0.5 sm:gap-1">' +
			'<button onclick="kbdInsert(\'' + link.id + '\',\':\')" class="bg-gray-600 hover:bg-gray-500 text-white px-0.5 sm:px-1 py-0.5 rounded text-xs min-w-0">:</button>' +
			'<button onclick="kbdInsert(\'' + link.id + '\',\'-\')" class="bg-gray-600 hover:bg-gray-500 text-white px-0.5 sm:px-1 py-0.5 rounded text-xs min-w-0">-</button>' +
			'<button onclick="kbdInsert(\'' + link.id + '\',\' \')" class="bg-gray-600 hover:bg-gray-500 text-white px-0.5 sm:px-1 py-0.5 rounded text-xs min-w-0">space</button>' +
			'<button onclick="kbdBackspace(\'' + link.id + '\')" class="bg-orange-600 hover:bg-orange-700 text-white px-0.5 sm:px-1 py-0.5 rounded text-xs min-w-0"><i class="fas fa-backspace"></i></button>' +
			'<button onclick="kbdClear(\'' + link.id + '\')" class="bg-red-600 hover:bg-red-700 text-white px-0.5 sm:px-1 py-0.5 rounded text-xs min-w-0">Xóa hết</button>' +
			'<button onclick="toggleVirtualKeyboard(\'' + link.id + '\')" class="bg-purple-600 hover:bg-purple-700 text-white px-0.5 sm:px-1 py-0.5 rounded text-xs min-w-0">Đóng</button>' +
			'</div>' +
			'</div>' +
			'</div>' +
			'</div>';
		container.appendChild(card);
	});
	loadCuratedTimes();
	renderPagination();
}

function kbdButtonsHtml(linkId) {
	var html = '';
	var digits = ['1','2','3','4','5','6','7','8','9','0'];
	for (var i = 0; i < digits.length; i++) {
		html += '<button onclick="kbdInsert(\'' + linkId + '\',\'' + digits[i] + '\')" class="bg-gray-600 hover:bg-gray-500 text-white px-0.5 sm:px-1 py-0.5 rounded text-xs min-w-0">' + digits[i] + '</button>';
	}
	return html;
}

function renderPagination() {
	var container = document.getElementById("linksContainer");
	var filtered = getFilteredLinks();
	var totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
	if (totalPages <= 1) return;

	var nav = document.createElement("div");
	nav.className = "flex items-center justify-center gap-2 pt-6";

	var prevBtn = document.createElement("button");
	prevBtn.className = "px-3 py-1.5 rounded text-sm transition " + (currentPage === 1 ? "bg-gray-700 text-gray-500 cursor-not-allowed" : "bg-gray-700 text-white hover:bg-purple-600");
	prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
	prevBtn.disabled = currentPage === 1;
	prevBtn.onclick = function() { if (currentPage > 1) { currentPage--; renderLinks(); } };
	nav.appendChild(prevBtn);

	var maxVisible = 5;
	var startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
	var endPage = Math.min(totalPages, startPage + maxVisible - 1);
	if (endPage - startPage + 1 < maxVisible) {
		startPage = Math.max(1, endPage - maxVisible + 1);
	}

	if (startPage > 1) {
		var firstBtn = document.createElement("button");
		firstBtn.className = "px-3 py-1.5 rounded text-sm bg-gray-700 text-white hover:bg-purple-600 transition";
		firstBtn.textContent = "1";
		firstBtn.onclick = function() { currentPage = 1; renderLinks(); };
		nav.appendChild(firstBtn);
		if (startPage > 2) {
			var dots = document.createElement("span");
			dots.className = "px-1 text-gray-400 text-sm";
			dots.textContent = "...";
			nav.appendChild(dots);
		}
	}

	for (var i = startPage; i <= endPage; i++) {
		var btn = document.createElement("button");
		btn.className = "px-3 py-1.5 rounded text-sm transition " + (i === currentPage ? "bg-purple-600 text-white" : "bg-gray-700 text-white hover:bg-purple-600");
		btn.textContent = i;
		btn.onclick = (function(pageNum) { return function() { currentPage = pageNum; renderLinks(); }; })(i);
		nav.appendChild(btn);
	}

	if (endPage < totalPages) {
		if (endPage < totalPages - 1) {
			var dots2 = document.createElement("span");
			dots2.className = "px-1 text-gray-400 text-sm";
			dots2.textContent = "...";
			nav.appendChild(dots2);
		}
		var lastBtn = document.createElement("button");
		lastBtn.className = "px-3 py-1.5 rounded text-sm bg-gray-700 text-white hover:bg-purple-600 transition";
		lastBtn.textContent = totalPages;
		lastBtn.onclick = function() { currentPage = totalPages; renderLinks(); };
		nav.appendChild(lastBtn);
	}

	var nextBtn = document.createElement("button");
	nextBtn.className = "px-3 py-1.5 rounded text-sm transition " + (currentPage === totalPages ? "bg-gray-700 text-gray-500 cursor-not-allowed" : "bg-gray-700 text-white hover:bg-purple-600");
	nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
	nextBtn.disabled = currentPage === totalPages;
	nextBtn.onclick = function() { if (currentPage < totalPages) { currentPage++; renderLinks(); } };
	nav.appendChild(nextBtn);

	container.appendChild(nav);
}

function escapeHtml(str) {
	var div = document.createElement("div");
	div.textContent = str;
	return div.innerHTML;
}

function addCuratedLink() {
	if (!currentUser) {
		Swal.fire({ icon: "warning", title: "Chưa đăng nhập", text: "Vui lòng đăng nhập để thêm link!", background: "#1f2937", color: "#fff", confirmButtonColor: "#7c3aed" });
		return Promise.resolve();
	}
	return Swal.fire({
		title: "Thêm Link Phim",
		width: "min(90vw, 500px)",
		padding: "1.25rem",
		html:
			'<input id="swal-title" placeholder="Tên phim" class="swal2-input swal-input-custom">' +
			'<input id="swal-url" placeholder="URL phim" class="swal2-input swal-input-custom">' +
			'<input id="swal-source" placeholder="Nguồn (VD: Siêu Tâm Phim)" class="swal2-input swal-input-custom">',
		focusConfirm: false,
		preConfirm: function() {
			var title = document.getElementById("swal-title").value.trim();
			var url = document.getElementById("swal-url").value.trim();
			var source = document.getElementById("swal-source").value.trim();
			if (!title) { Swal.showValidationMessage("Vui lòng nhập tên phim"); return; }
			if (!url) { Swal.showValidationMessage("Vui lòng nhập URL"); return; }
			if (!source) { Swal.showValidationMessage("Vui lòng nhập nguồn"); return; }
			return { title: title, url: url, source: source };
		},
		background: "#1f2937", color: "#fff", confirmButtonColor: "#7c3aed",
		customClass: {
			confirmButton: "swal-btn-custom",
			validationMessage: "swal-msg-custom"
		}
	}).then(function(result) {
		var form = result.value;
		if (!form) return;
		return db.collection("curatedLinks").add({
			title: form.title,
			url: form.url,
			source: form.source,
			addedAt: firebase.firestore.FieldValue.serverTimestamp()
		}).then(function() {
			Swal.fire({ icon: "success", title: "Đã thêm!", timer: 1500, showConfirmButton: false, background: "#1f2937", color: "#fff", confirmButtonColor: "#7c3aed" });
			loadCuratedLinks();
		});
	}).catch(function(err) {
		Swal.fire({ icon: "error", title: "Lỗi", text: err.message, background: "#1f2937", color: "#fff", confirmButtonColor: "#7c3aed" });
	});
}

function deleteCuratedLink(docId) {
	if (!currentUser) return Promise.resolve();
	return Swal.fire({
		title: "Xóa video?",
		text: "Bạn có chắc muốn xóa video này?",
		icon: "warning",
		showCancelButton: true,
		confirmButtonColor: "#dc2626",
		cancelButtonColor: "#6b7280",
		confirmButtonText: "Xóa",
		cancelButtonText: "Hủy",
		background: "#1f2937", color: "#fff"
	}).then(function(result) {
		if (!result.isConfirmed) return;
		return db.collection("curatedLinks").doc(docId).delete().then(function() {
			Swal.fire({ icon: "success", title: "Đã xóa!", timer: 1500, showConfirmButton: false, background: "#1f2937", color: "#fff" });
			loadCuratedLinks();
		});
	}).catch(function(err) {
		Swal.fire({ icon: "error", title: "Lỗi", text: err.message, background: "#1f2937", color: "#fff" });
	});
}

function editCuratedLink(docId) {
	if (!currentUser) return Promise.resolve();
	var link = null;
	for (var i = 0; i < curatedLinks.length; i++) {
		if (curatedLinks[i].id === docId) { link = curatedLinks[i]; break; }
	}
	if (!link) return Promise.resolve();

	return Swal.fire({
		title: "Sửa thông tin phim",
		width: "min(90vw, 500px)",
		padding: "1.25rem",
		html:
			'<input id="swal-title" placeholder="Tên phim" class="swal2-input swal-input-custom" value="' + escapeHtml(link.title) + '">' +
			'<input id="swal-url" placeholder="URL phim" class="swal2-input swal-input-custom" value="' + escapeHtml(link.url) + '">' +
			'<input id="swal-source" placeholder="Nguồn (VD: Siêu Tâm Phim)" class="swal2-input swal-input-custom" value="' + escapeHtml(link.source) + '">',
		focusConfirm: false,
		preConfirm: function() {
			var title = document.getElementById("swal-title").value.trim();
			var url = document.getElementById("swal-url").value.trim();
			var source = document.getElementById("swal-source").value.trim();
			if (!title) { Swal.showValidationMessage("Vui lòng nhập tên phim"); return; }
			if (!url) { Swal.showValidationMessage("Vui lòng nhập URL"); return; }
			if (!source) { Swal.showValidationMessage("Vui lòng nhập nguồn"); return; }
			return { title: title, url: url, source: source };
		},
		background: "#1f2937", color: "#fff", confirmButtonColor: "#7c3aed",
		customClass: {
			confirmButton: "swal-btn-custom",
			validationMessage: "swal-msg-custom"
		}
	}).then(function(result) {
		var form = result.value;
		if (!form) return;
		return db.collection("curatedLinks").doc(docId).update({
			title: form.title,
			url: form.url,
			source: form.source
		}).then(function() {
			Swal.fire({ icon: "success", title: "Đã cập nhật!", timer: 1500, showConfirmButton: false, background: "#1f2937", color: "#fff", confirmButtonColor: "#7c3aed" });
			loadCuratedLinks();
		});
	}).catch(function(err) {
		Swal.fire({ icon: "error", title: "Lỗi", text: err.message, background: "#1f2937", color: "#fff", confirmButtonColor: "#7c3aed" });
	});
}

function saveCuratedTime(docId) {
	var timeInput = document.getElementById("time-" + docId);
	var savedEl = document.getElementById("saved-" + docId);
	var timeValue = timeInput.value.trim();

	if (!currentUser) {
		Swal.fire({ icon: "warning", title: "Chưa đăng nhập", text: "Vui lòng đăng nhập để lưu thời gian!", background: "#1f2937", color: "#fff" });
		return Promise.resolve();
	}

	var card = timeInput;
	while (card && !card.classList.contains("curated-card")) {
		card = card.parentElement;
	}
	var titleEl = card ? card.querySelector("h3") : null;
	var pEl = card ? card.querySelector("p.truncate") : null;
	var title = titleEl ? titleEl.textContent : "";
	var url = pEl ? pEl.textContent : "";
	var timeDocId = encodeURIComponent(url);

	return db.collection("users").doc(currentUser.uid).collection("curatedTimes").doc(timeDocId).set({
		title: title,
		url: url,
		time: timeValue,
		savedAt: firebase.firestore.FieldValue.serverTimestamp()
	}).then(function() {
		savedEl.classList.remove("hidden");
		setTimeout(function() { savedEl.classList.add("hidden"); }, 3000);
	}).catch(function(err) {
		Swal.fire({ icon: "error", title: "Lỗi", text: "Không thể lưu: " + err.message, background: "#1f2937", color: "#fff" });
	});
}

function loadCuratedTimes() {
	if (!currentUser) return Promise.resolve();
	return db.collection("users").doc(currentUser.uid).collection("curatedTimes").get().then(function(snapshot) {
		var timeMap = {};
		snapshot.forEach(function(doc) {
			var data = doc.data();
			timeMap[data.url] = data.time;
		});
		var cards = document.querySelectorAll("#linksContainer .curated-card");
		for (var i = 0; i < cards.length; i++) {
			var url = cards[i].querySelector("p.truncate").textContent;
			if (timeMap[url]) {
				var input = cards[i].querySelector("input");
				if (input) input.value = timeMap[url];
			}
		}
	}).catch(function(err) {
		console.error("Lỗi tải thời gian đã lưu:", err);
	});
}

function toggleVirtualKeyboard(id) {
	var kbd = document.getElementById("kbd-" + id);
	if (kbd) kbd.classList.toggle("hidden");
}
function getTimeInput(id) {
	return document.getElementById("time-" + id);
}
function kbdInsert(id, char) {
	var input = getTimeInput(id);
	if (!input) return;
	var start = input.selectionStart;
	var end = input.selectionEnd;
	var val = input.value;
	input.value = val.slice(0, start) + char + val.slice(end);
	input.selectionStart = input.selectionEnd = start + char.length;
	input.focus();
}
function kbdBackspace(id) {
	var input = getTimeInput(id);
	if (!input) return;
	var start = input.selectionStart;
	if (start === 0) return;
	var val = input.value;
	input.value = val.slice(0, start - 1) + val.slice(start);
	input.selectionStart = input.selectionEnd = start - 1;
	input.focus();
}
function kbdClear(id) {
	var input = getTimeInput(id);
	if (!input) return;
	input.value = "";
	input.focus();
}

function updateAuthUI() {
	var btns = document.querySelectorAll(".curated-card .fa-trash-alt");
	for (var i = 0; i < btns.length; i++) {
		var icon = btns[i];
		var parent = icon.parentElement;
		while (parent && parent.tagName !== "BUTTON") {
			parent = parent.parentElement;
		}
		if (parent) parent.classList.toggle("hidden", !currentUser);
	}
	var addBtn = document.getElementById("addLinkBtn");
	if (addBtn) addBtn.classList.toggle("hidden", !currentUser);
}

document.addEventListener("cinephim:auth-ready", function() {
	updateAuthUI();
	loadCuratedLinks();
});

document.addEventListener("DOMContentLoaded", function() {
	window.ensureConfigReady().then(function() {
		var searchInput = document.getElementById("linkSearchInput");
		if (searchInput) {
			searchInput.addEventListener("input", filterCuratedLinks);
		}
		setupSearchListeners();
	});
});
