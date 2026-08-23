var sourcesList = [];

var SOURCE_COLORS = [
	{ value: "bg-blue-600", label: "Xanh dương" },
	{ value: "bg-orange-600", label: "Cam" },
	{ value: "bg-purple-600", label: "Tím" },
	{ value: "bg-green-600", label: "Xanh lá" },
	{ value: "bg-red-600", label: "Đỏ" },
	{ value: "bg-teal-600", label: "Teal" },
	{ value: "bg-pink-600", label: "Hồng" },
	{ value: "bg-indigo-600", label: "Indigo" }
];

var SOURCE_STATUS_COLORS = [
	{ value: "text-green-400", label: "Xanh lá" },
	{ value: "text-purple-400", label: "Tím" },
	{ value: "text-blue-400", label: "Xanh dương" },
	{ value: "text-orange-400", label: "Cam" },
	{ value: "text-red-400", label: "Đỏ" },
	{ value: "text-teal-400", label: "Teal" },
	{ value: "text-yellow-400", label: "Vàng" },
	{ value: "text-gray-400", label: "Xám" }
];

function escapeHtml(str) {
	if (str === null || str === undefined) return "";
	var div = document.createElement("div");
	div.textContent = String(str);
	return div.innerHTML;
}

function loadSources() {
	var grid = document.getElementById("sourcesGrid");
	grid.innerHTML = '<p class="text-gray-400 text-center col-span-full"><i class="fas fa-spinner fa-spin mr-2"></i>Đang tải...</p>';
	return db.collection("sources").orderBy("order", "asc").get().then(function(snapshot) {
		sourcesList = [];
		snapshot.forEach(function(doc) {
			var docData = doc.data();
			var item = { id: doc.id };
			for (var key in docData) {
				if (docData.hasOwnProperty(key)) {
					item[key] = docData[key];
				}
			}
			sourcesList.push(item);
		});
		renderSources();
	}).catch(function(err) {
		grid.innerHTML = '<p class="text-red-400 text-center col-span-full">Không thể tải danh sách nguồn: ' + escapeHtml(err.message) + '</p>';
	});
}

function renderSources() {
	var grid = document.getElementById("sourcesGrid");
	if (sourcesList.length === 0) {
		grid.innerHTML = '<p class="text-gray-400 text-center col-span-full">Chưa có nguồn phim nào.</p>';
		return;
	}
	grid.innerHTML = "";
	sourcesList.forEach(function(s) {
		var card = document.createElement("div");
		card.className = "bg-gray-800 rounded-lg p-6 hover:bg-gray-750 transition";
		card.dataset.id = s.id;
		card.innerHTML = '<div class="flex items-center mb-4">' +
			'<div class="w-12 h-12 ' + escapeHtml(s.color || "bg-purple-600") + ' rounded-lg flex items-center justify-center mr-4">' +
			'<i class="fas fa-play text-white text-xl"></i>' +
			'</div>' +
			'<div class="flex-1 min-w-0">' +
			'<h3 class="text-lg font-semibold text-white truncate">' + escapeHtml(s.name || "") + '</h3>' +
			'<p class="text-gray-400 text-sm truncate">' + escapeHtml(s.tagline || "") + '</p>' +
			'</div>' +
			'</div>' +
			'<p class="text-gray-300 mb-4">' + escapeHtml(s.description || "") + '</p>' +
			'<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">' +
			'<span class="' + escapeHtml(s.statusColor || "text-green-400") + ' font-medium">' + escapeHtml(s.status || "") + '</span>' +
			'<div class="flex items-center gap-2">' +
			'<div class="source-edit-delete hidden items-center gap-1 mr-1">' +
			'<button onclick="editSource(\'' + s.id + '\')" class="text-blue-400 hover:text-blue-300 transition text-sm px-2 py-1 rounded border border-blue-500/30 hover:border-blue-400" title="Sửa nguồn">' +
			'<i class="fas fa-edit"></i>' +
			'</button>' +
			'<button onclick="deleteSource(\'' + s.id + '\')" class="text-red-400 hover:text-red-300 transition text-sm px-2 py-1 rounded border border-red-500/30 hover:border-red-400" title="Xóa nguồn">' +
			'<i class="fas fa-trash-alt"></i>' +
			'</button>' +
			'</div>' +
			'<a href="' + escapeHtml(s.url || "#") + '" target="_blank" class="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg text-sm transition">' +
			'<i class="fas fa-external-link-alt mr-1"></i>Truy cập' +
			'</a>' +
			'</div>' +
			'</div>';
		grid.appendChild(card);
	});
	updateAuthUI();
}

function buildSourceFormHtml(source) {
	var colorOptions = SOURCE_COLORS.map(function(o) {
		return '<option value="' + o.value + '"' + (source && source.color === o.value ? " selected" : "") + '>' + o.label + '</option>';
	}).join("");
	var statusColorOptions = SOURCE_STATUS_COLORS.map(function(o) {
		return '<option value="' + o.value + '"' + (source && source.statusColor === o.value ? " selected" : "") + '>' + o.label + '</option>';
	}).join("");
	return '<input id="swal-name" placeholder="Tên nguồn (VD: NguonC)" class="swal2-input swal-input-custom" value="' + (source ? escapeHtml(source.name || "") : "") + '">' +
		'<input id="swal-tagline" placeholder="Tagline (VD: Phim online Việt Nam)" class="swal2-input swal-input-custom" value="' + (source ? escapeHtml(source.tagline || "") : "") + '">' +
		'<textarea id="swal-description" placeholder="Mô tả" class="swal2-textarea swal-input-custom" rows="2">' + (source ? escapeHtml(source.description || "") : "") + '</textarea>' +
		'<input id="swal-status" placeholder="Trạng thái (VD: Sẵn sàng)" class="swal2-input swal-input-custom" value="' + (source ? escapeHtml(source.status || "") : "") + '">' +
		'<select id="swal-statusColor" class="swal2-input swal-input-custom">' + statusColorOptions + '</select>' +
		'<input id="swal-url" placeholder="URL nguồn (VD: https://phim.nguonc.com/)" class="swal2-input swal-input-custom" value="' + (source ? escapeHtml(source.url || "") : "") + '">' +
		'<select id="swal-color" class="swal2-input swal-input-custom">' + colorOptions + '</select>';
}

function readSourceForm() {
	var name = document.getElementById("swal-name").value.trim();
	var tagline = document.getElementById("swal-tagline").value.trim();
	var description = document.getElementById("swal-description").value.trim();
	var status = document.getElementById("swal-status").value.trim();
	var statusColor = document.getElementById("swal-statusColor").value;
	var url = document.getElementById("swal-url").value.trim();
	var color = document.getElementById("swal-color").value;
	if (!name) { Swal.showValidationMessage("Vui lòng nhập tên nguồn"); return; }
	if (!url) { Swal.showValidationMessage("Vui lòng nhập URL"); return; }
	return { name: name, tagline: tagline, description: description, status: status, statusColor: statusColor, url: url, color: color };
}

function addSource() {
	if (!currentUser) {
		Swal.fire({ icon: "warning", title: "Chưa đăng nhập", text: "Vui lòng đăng nhập để thêm nguồn!", background: "#1f2937", color: "#fff", confirmButtonColor: "#7c3aed" });
		return Promise.resolve();
	}
	return Swal.fire({
		title: "Thêm Nguồn Phim",
		width: "min(90vw, 500px)",
		padding: "1.25rem",
		html: buildSourceFormHtml(null),
		focusConfirm: false,
		preConfirm: readSourceForm,
		background: "#1f2937", color: "#fff", confirmButtonColor: "#7c3aed",
		customClass: {
			confirmButton: "swal-btn-custom",
			validationMessage: "swal-msg-custom"
		}
	}).then(function(result) {
		var form = result.value;
		if (!form) return;
		var maxOrder = sourcesList.reduce(function(max, s) { return Math.max(max, s.order || 0); }, -1);
		var dataToAdd = {};
		for (var key in form) {
			if (form.hasOwnProperty(key)) {
				dataToAdd[key] = form[key];
			}
		}
		dataToAdd.order = maxOrder + 1;
		return db.collection("sources").add(dataToAdd).then(function() {
			Swal.fire({ icon: "success", title: "Đã thêm!", timer: 1500, showConfirmButton: false, background: "#1f2937", color: "#fff" });
			loadSources();
		});
	}).catch(function(err) {
		Swal.fire({ icon: "error", title: "Lỗi", text: err.message, background: "#1f2937", color: "#fff" });
	});
}

function editSource(docId) {
	if (!currentUser) return Promise.resolve();
	var source = null;
	for (var i = 0; i < sourcesList.length; i++) {
		if (sourcesList[i].id === docId) { source = sourcesList[i]; break; }
	}
	if (!source) return Promise.resolve();
	return Swal.fire({
		title: "Sửa Nguồn Phim",
		width: "min(90vw, 500px)",
		padding: "1.25rem",
		html: buildSourceFormHtml(source),
		focusConfirm: false,
		preConfirm: readSourceForm,
		background: "#1f2937", color: "#fff", confirmButtonColor: "#7c3aed",
		customClass: {
			confirmButton: "swal-btn-custom",
			validationMessage: "swal-msg-custom"
		}
	}).then(function(result) {
		var form = result.value;
		if (!form) return;
		return db.collection("sources").doc(docId).update(form).then(function() {
			Swal.fire({ icon: "success", title: "Đã cập nhật!", timer: 1500, showConfirmButton: false, background: "#1f2937", color: "#fff" });
			loadSources();
		});
	}).catch(function(err) {
		Swal.fire({ icon: "error", title: "Lỗi", text: err.message, background: "#1f2937", color: "#fff" });
	});
}

function deleteSource(docId) {
	if (!currentUser) return Promise.resolve();
	var source = null;
	for (var i = 0; i < sourcesList.length; i++) {
		if (sourcesList[i].id === docId) { source = sourcesList[i]; break; }
	}
	return Swal.fire({
		title: "Xóa nguồn?",
		text: "Bạn có chắc muốn xóa nguồn " + (source ? source.name : "") + "?",
		icon: "warning",
		showCancelButton: true,
		confirmButtonColor: "#dc2626",
		cancelButtonColor: "#6b7280",
		confirmButtonText: "Xóa",
		cancelButtonText: "Hủy",
		background: "#1f2937", color: "#fff"
	}).then(function(result) {
		if (!result.isConfirmed) return;
		return db.collection("sources").doc(docId).delete().then(function() {
			Swal.fire({ icon: "success", title: "Đã xóa!", timer: 1500, showConfirmButton: false, background: "#1f2937", color: "#fff" });
			loadSources();
		});
	}).catch(function(err) {
		Swal.fire({ icon: "error", title: "Lỗi", text: err.message, background: "#1f2937", color: "#fff" });
	});
}

function updateAuthUI() {
	var addBtn = document.getElementById("addSourceBtn");
	if (addBtn) addBtn.classList.toggle("hidden", !currentUser);
	var editDeleteBtns = document.querySelectorAll(".source-edit-delete");
	for (var i = 0; i < editDeleteBtns.length; i++) {
		editDeleteBtns[i].classList.toggle("hidden", !currentUser);
		editDeleteBtns[i].classList.toggle("flex", !!currentUser);
	}
}

document.addEventListener("cinephim:auth-ready", function() {
	updateAuthUI();
	loadSources();
});

document.addEventListener("DOMContentLoaded", function() {
	setupSearchListeners();
});
