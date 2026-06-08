"use strict";

const auth = firebase.auth();
const db = firebase.firestore();

let botModalInstance = null;
let chatModalInstance = null;
let allBots = [];
let allChats = [];

document.addEventListener("DOMContentLoaded", function () {
	auth.onAuthStateChanged((user) => {
		if (user) {
			document.getElementById("userInfo").style.display = "";
			document.getElementById("userEmail").textContent = user.email;
			loadBotList();
			loadChatList();
		} else {
			window.location.href = "../login.html";
		}
	});

	botModalInstance = new bootstrap.Modal(document.getElementById("botModal"));
	chatModalInstance = new bootstrap.Modal(document.getElementById("chatModal"));

	document.getElementById("botModal").addEventListener("hidden.bs.modal", function () {
		document.getElementById("editBotId").value = "";
		document.getElementById("botName").value = "";
		document.getElementById("botToken").value = "";
		document.getElementById("botVisible").checked = true;
	});

	document.getElementById("chatModal").addEventListener("hidden.bs.modal", function () {
		document.getElementById("editChatId").value = "";
		document.getElementById("chatName").value = "";
		document.getElementById("chatIdValue").value = "";
		document.getElementById("chatVisible").checked = true;
	});
});

// ==================== BOTS ====================

async function loadBotList() {
	try {
		const snapshot = await db.collection("bots").get();
		allBots = [];
		snapshot.forEach((doc) => allBots.push({ ...doc.data(), docId: doc.id }));
		allBots.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
		renderBotList();
	} catch (error) {
		console.error("Lỗi tải danh sách bot:", error);
		document.getElementById("botTableBody").innerHTML = `<tr><td colspan="3" class="text-center py-4 text-danger"><i class="fas fa-exclamation-triangle fa-2x mb-2 d-block"></i>Lỗi tải danh sách: ${error.message}</td></tr>`;
	}
}

function filterBots() {
	renderBotList();
}

function renderBotList() {
	const tbody = document.getElementById("botTableBody");
	const keyword = document.getElementById("searchBotInput").value.toLowerCase().trim();
	const filtered = keyword ? allBots.filter((b) => (b.name || "").toLowerCase().includes(keyword)) : allBots;
	if (filtered.length === 0) {
		tbody.innerHTML = `<tr><td colspan="3" class="text-center py-4 text-muted"><i class="fas fa-search fa-2x mb-2 d-block"></i>${allBots.length === 0 ? 'Chưa có bot nào. Nhấn "Thêm Bot" để bắt đầu.' : "Không tìm thấy bot nào."}</td></tr>`;
		return;
	}
	let html = "";
	for (const bot of filtered) {
		const displayToken = bot.docId || "";
		const isVisible = bot.visible !== false;
		const visibleBtn = isVisible
			? `<button class="btn btn-sm btn-outline-success" onclick="toggleBotVisible('${bot.docId}', false)" title="Tắt hiển thị"><i class="fas fa-eye"></i></button>`
			: `<button class="btn btn-sm btn-outline-secondary" onclick="toggleBotVisible('${bot.docId}', true)" title="Bật hiển thị"><i class="fas fa-eye-slash"></i></button>`;
		html += `
			<tr>
				<td>
					<div class="d-flex flex-column">
						<div><strong>${bot.name || "Không tên"}</strong></div>
						<span class="d-md-none small text-muted">${displayToken}</span>
						<div class="d-md-none mt-1 d-flex gap-1 flex-wrap">
							${visibleBtn}
							<button class="btn btn-outline-primary btn-sm" onclick="editBot('${bot.docId}')" title="Sửa"><i class="fas fa-edit"></i></button>
							<button class="btn btn-outline-danger btn-sm" onclick="deleteBot('${bot.docId}')" title="Xóa"><i class="fas fa-trash"></i></button>
							<button class="btn btn-outline-secondary btn-sm" onclick="copyToken('${bot.docId}')" title="Sao chép Token"><i class="fas fa-copy"></i></button>
						</div>
					</div>
				</td>
				<td class="d-none d-md-table-cell" style="max-width: 0;">
					<div class="d-flex align-items-center gap-1">
						<code class="small">${displayToken}</code>
						<button class="btn btn-sm btn-outline-secondary" onclick="copyToken('${bot.docId}')" title="Sao chép Token">
							<i class="fas fa-copy"></i>
						</button>
					</div>
				</td>
				<td class="d-none d-md-table-cell">
					<div class="btn-group btn-group-sm">
						${visibleBtn}
						<button class="btn btn-outline-primary" onclick="editBot('${bot.docId}')" title="Sửa"><i class="fas fa-edit"></i></button>
						<button class="btn btn-outline-danger" onclick="deleteBot('${bot.docId}')" title="Xóa"><i class="fas fa-trash"></i></button>
					</div>
				</td>
			</tr>
		`;
	}
	tbody.innerHTML = html;
}

function showBotModal() {
	document.getElementById("botModalTitle").textContent = "Thêm Bot";
	document.getElementById("editBotId").value = "";
	document.getElementById("botName").value = "";
	document.getElementById("botToken").value = "";
	document.getElementById("botToken").readOnly = false;
	document.getElementById("botVisible").checked = true;
	botModalInstance.show();
}

async function editBot(id) {
	try {
		const doc = await db.collection("bots").doc(id).get();
		if (!doc.exists) {
			Swal.fire({ icon: "error", title: "Lỗi!", text: "Bot không tồn tại" });
			return;
		}
		const data = doc.data();
		document.getElementById("botModalTitle").textContent = "Chỉnh Sửa Bot";
		document.getElementById("editBotId").value = id;
		document.getElementById("botName").value = data.name || "";
		document.getElementById("botToken").value = id;
		document.getElementById("botToken").readOnly = false;
		document.getElementById("botVisible").checked = data.visible !== false;
		botModalInstance.show();
	} catch (error) {
		Swal.fire({ icon: "error", title: "Lỗi!", text: error.message });
	}
}

async function saveBot() {
	const editId = document.getElementById("editBotId").value.trim();
	const name = document.getElementById("botName").value.trim();
	const token = document.getElementById("botToken").value.trim();
	const visible = document.getElementById("botVisible").checked;

	if (!name) {
		Swal.fire({ icon: "error", title: "Lỗi!", text: "Vui lòng nhập tên bot" });
		return;
	}
	if (!token) {
		Swal.fire({ icon: "error", title: "Lỗi!", text: "Vui lòng nhập Bot Token" });
		return;
	}

	try {
		if (editId) {
			if (editId !== token) {
				const oldDoc = await db.collection("bots").doc(editId).get();
				if (oldDoc.exists) {
					await db.collection("bots").doc(token).set({ ...oldDoc.data(), name, visible });
					await db.collection("bots").doc(editId).delete();
				}
			} else {
				await db.collection("bots").doc(editId).update({ name, visible });
			}
			Swal.fire({ icon: "success", title: "Đã cập nhật!", text: `Bot "${name}" đã được cập nhật.`, timer: 1500, showConfirmButton: false });
		} else {
			await db.collection("bots").doc(token).set({ name, visible });
			Swal.fire({ icon: "success", title: "Đã thêm!", text: `Bot "${name}" đã được thêm.`, timer: 1500, showConfirmButton: false });
		}
		botModalInstance.hide();
		loadBotList();
	} catch (error) {
		Swal.fire({ icon: "error", title: "Lỗi!", text: error.message });
	}
}

async function deleteBot(id) {
	try {
		const doc = await db.collection("bots").doc(id).get();
		if (!doc.exists) return;
		const name = doc.data().name || "Bot này";

		const result = await Swal.fire({
			title: "Xác nhận xóa",
			html: `Bạn có chắc muốn xóa <strong>${name}</strong>?<br><small class="text-danger">Hành động này không thể hoàn tác.</small>`,
			icon: "warning",
			showCancelButton: true,
			confirmButtonColor: "#d33",
			cancelButtonColor: "#3085d6",
			confirmButtonText: "Xóa",
			cancelButtonText: "Hủy",
		});

		if (result.isConfirmed) {
			await db.collection("bots").doc(id).delete();
			Swal.fire({ icon: "success", title: "Đã xóa!", text: `Bot "${name}" đã được xóa.`, timer: 1500, showConfirmButton: false });
			loadBotList();
		}
	} catch (error) {
		Swal.fire({ icon: "error", title: "Lỗi!", text: error.message });
	}
}

async function testBot(id) {
	try {
		const doc = await db.collection("bots").doc(id).get();
		if (!doc.exists) {
			Swal.fire({ icon: "error", title: "Lỗi!", text: "Bot không tồn tại" });
			return;
		}
		const data = doc.data();
		const response = await fetch(`https://api.telegram.org/bot${id}/getMe`);
		const result = await response.json();

		if (result.ok) {
			const botInfo = result.result;
			Swal.fire({ icon: "success", title: "Thành công!", text: `Bot "${data.name}" hoạt động tốt (${botInfo.first_name}).` });
		} else {
			throw new Error(result.description || "Không thể kết nối bot");
		}
	} catch (error) {
		Swal.fire({ icon: "error", title: "Lỗi kết nối!", text: `Bot "${data?.name || id}" không hoạt động: ${error.message}` });
	}
}

async function toggleBotVisible(id, visible) {
	try {
		await db.collection("bots").doc(id).update({ visible });
		loadBotList();
	} catch (error) {
		Swal.fire({ icon: "error", title: "Lỗi!", text: error.message });
	}
}

async function copyToken(id) {
	try {
		const doc = await db.collection("bots").doc(id).get();
		if (!doc.exists) {
			Swal.fire({ icon: "error", title: "Lỗi!", text: "Bot không tồn tại" });
			return;
		}
		await navigator.clipboard.writeText(id);
		Swal.fire({ icon: "success", title: "Đã sao chép!", text: "Token bot đã được sao chép vào clipboard.", timer: 1500, showConfirmButton: false, position: "top-end", toast: true });
	} catch (error) {
		Swal.fire({ icon: "error", title: "Lỗi!", text: error.message });
	}
}

// ==================== CHATS ====================

async function loadChatList() {
	try {
		const snapshot = await db.collection("chats").get();
		allChats = [];
		snapshot.forEach((doc) => allChats.push({ ...doc.data(), docId: doc.id }));
		allChats.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
		renderChatList();
	} catch (error) {
		console.error("Lỗi tải danh sách chat:", error);
		document.getElementById("chatTableBody").innerHTML = `<tr><td colspan="3" class="text-center py-4 text-danger"><i class="fas fa-exclamation-triangle fa-2x mb-2 d-block"></i>Lỗi tải danh sách: ${error.message}</td></tr>`;
	}
}

function filterChats() {
	renderChatList();
}

function renderChatList() {
	const tbody = document.getElementById("chatTableBody");
	const keyword = document.getElementById("searchChatInput").value.toLowerCase().trim();
	const filtered = keyword ? allChats.filter((c) => (c.name || "").toLowerCase().includes(keyword)) : allChats;
	if (filtered.length === 0) {
		tbody.innerHTML = `<tr><td colspan="3" class="text-center py-4 text-muted"><i class="fas fa-search fa-2x mb-2 d-block"></i>${allChats.length === 0 ? 'Chưa có chat nào. Nhấn "Thêm Chat" để bắt đầu.' : "Không tìm thấy chat nào."}</td></tr>`;
		return;
	}
	let html = "";
	for (const chat of filtered) {
		const isVisible = chat.visible !== false;
		const displayChatId = chat.docId || "";
		const visibleBtn = isVisible
			? `<button class="btn btn-sm btn-outline-success" onclick="toggleChatVisible('${chat.docId}', false)" title="Tắt hiển thị"><i class="fas fa-eye"></i></button>`
			: `<button class="btn btn-sm btn-outline-secondary" onclick="toggleChatVisible('${chat.docId}', true)" title="Bật hiển thị"><i class="fas fa-eye-slash"></i></button>`;
		html += `
			<tr>
				<td>
					<div class="d-flex flex-column">
						<div><strong>${chat.name || "Không tên"}</strong></div>
						<span class="d-md-none small text-muted">${displayChatId}</span>
						<div class="d-md-none mt-1 d-flex gap-1 flex-wrap">
							${visibleBtn}
							<button class="btn btn-outline-primary btn-sm" onclick="editChat('${chat.docId}')" title="Sửa"><i class="fas fa-edit"></i></button>
							<button class="btn btn-outline-danger btn-sm" onclick="deleteChat('${chat.docId}')" title="Xóa"><i class="fas fa-trash"></i></button>
							<button class="btn btn-outline-secondary btn-sm" onclick="copyChatId('${chat.docId}')" title="Sao chép Chat ID"><i class="fas fa-copy"></i></button>
						</div>
					</div>
				</td>
				<td class="d-none d-md-table-cell" style="max-width: 0;">
					<div class="d-flex align-items-center gap-1">
						<code class="small">${displayChatId}</code>
						<button class="btn btn-sm btn-outline-secondary" onclick="copyChatId('${chat.docId}')" title="Sao chép Chat ID">
							<i class="fas fa-copy"></i>
						</button>
					</div>
				</td>
				<td class="d-none d-md-table-cell">
					<div class="btn-group btn-group-sm">
						${visibleBtn}
						<button class="btn btn-outline-primary" onclick="editChat('${chat.docId}')" title="Sửa"><i class="fas fa-edit"></i></button>
						<button class="btn btn-outline-danger" onclick="deleteChat('${chat.docId}')" title="Xóa"><i class="fas fa-trash"></i></button>
					</div>
				</td>
			</tr>
		`;
	}
	tbody.innerHTML = html;
}

function showChatModal() {
	document.getElementById("chatModalTitle").textContent = "Thêm Chat";
	document.getElementById("editChatId").value = "";
	document.getElementById("chatName").value = "";
	document.getElementById("chatIdValue").value = "";
	document.getElementById("chatIdValue").readOnly = false;
	document.getElementById("chatVisible").checked = true;
	chatModalInstance.show();
}

async function editChat(id) {
	try {
		const doc = await db.collection("chats").doc(id).get();
		if (!doc.exists) {
			Swal.fire({ icon: "error", title: "Lỗi!", text: "Chat không tồn tại" });
			return;
		}
		const data = doc.data();
		document.getElementById("chatModalTitle").textContent = "Chỉnh Sửa Chat";
		document.getElementById("editChatId").value = id;
		document.getElementById("chatName").value = data.name || "";
		document.getElementById("chatIdValue").value = id;
		document.getElementById("chatIdValue").readOnly = false;
		document.getElementById("chatVisible").checked = data.visible !== false;
		chatModalInstance.show();
	} catch (error) {
		Swal.fire({ icon: "error", title: "Lỗi!", text: error.message });
	}
}

async function saveChat() {
	const editId = document.getElementById("editChatId").value.trim();
	const name = document.getElementById("chatName").value.trim();
	const chatIdValue = document.getElementById("chatIdValue").value.trim();
	const visible = document.getElementById("chatVisible").checked;

	if (!name) {
		Swal.fire({ icon: "error", title: "Lỗi!", text: "Vui lòng nhập tên chat" });
		return;
	}
	if (!chatIdValue) {
		Swal.fire({ icon: "error", title: "Lỗi!", text: "Vui lòng nhập Chat ID" });
		return;
	}

	try {
		if (editId) {
			if (editId !== chatIdValue) {
				const oldDoc = await db.collection("chats").doc(editId).get();
				if (oldDoc.exists) {
					await db.collection("chats").doc(chatIdValue).set({ ...oldDoc.data(), name, visible });
					await db.collection("chats").doc(editId).delete();
				}
			} else {
				await db.collection("chats").doc(editId).update({ name, visible });
			}
			Swal.fire({ icon: "success", title: "Đã cập nhật!", text: `Chat "${name}" đã được cập nhật.`, timer: 1500, showConfirmButton: false });
		} else {
			await db.collection("chats").doc(chatIdValue).set({ name, visible });
			Swal.fire({ icon: "success", title: "Đã thêm!", text: `Chat "${name}" đã được thêm.`, timer: 1500, showConfirmButton: false });
		}
		chatModalInstance.hide();
		loadChatList();
	} catch (error) {
		Swal.fire({ icon: "error", title: "Lỗi!", text: error.message });
	}
}

async function deleteChat(id) {
	try {
		const doc = await db.collection("chats").doc(id).get();
		if (!doc.exists) return;
		const name = doc.data().name || "Chat này";

		const result = await Swal.fire({
			title: "Xác nhận xóa",
			html: `Bạn có chắc muốn xóa <strong>${name}</strong>?<br><small class="text-danger">Hành động này không thể hoàn tác.</small>`,
			icon: "warning",
			showCancelButton: true,
			confirmButtonColor: "#d33",
			cancelButtonColor: "#3085d6",
			confirmButtonText: "Xóa",
			cancelButtonText: "Hủy",
		});

		if (result.isConfirmed) {
			await db.collection("chats").doc(id).delete();
			Swal.fire({ icon: "success", title: "Đã xóa!", text: `Chat "${name}" đã được xóa.`, timer: 1500, showConfirmButton: false });
			loadChatList();
		}
	} catch (error) {
		Swal.fire({ icon: "error", title: "Lỗi!", text: error.message });
	}
}

async function toggleChatVisible(id, visible) {
	try {
		await db.collection("chats").doc(id).update({ visible });
		loadChatList();
	} catch (error) {
		Swal.fire({ icon: "error", title: "Lỗi!", text: error.message });
	}
}

async function copyChatId(id) {
	try {
		const doc = await db.collection("chats").doc(id).get();
		if (!doc.exists) {
			Swal.fire({ icon: "error", title: "Lỗi!", text: "Chat không tồn tại" });
			return;
		}
		await navigator.clipboard.writeText(id);
		Swal.fire({ icon: "success", title: "Đã sao chép!", text: "Chat ID đã được sao chép vào clipboard.", timer: 1500, showConfirmButton: false, position: "top-end", toast: true });
	} catch (error) {
		Swal.fire({ icon: "error", title: "Lỗi!", text: error.message });
	}
}

async function signOut() {
	try {
		await auth.signOut();
		window.location.href = "../login.html";
	} catch (error) {
		Swal.fire({ icon: "error", title: "Lỗi!", text: error.message });
	}
}
