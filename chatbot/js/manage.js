"use strict";

const auth = firebase.auth();
const db = firebase.firestore();

let modalInstance = null;
let allWebhooks = [];

document.addEventListener("DOMContentLoaded", function () {
	auth.onAuthStateChanged((user) => {
		if (user) {
			document.getElementById("userInfo").style.display = "";
			document.getElementById("userEmail").textContent = user.email;
			loadWebhookList();
		} else {
			window.location.href = "../login.html";
		}
	});

	modalInstance = new bootstrap.Modal(document.getElementById("webhookModal"));

	document.getElementById("webhookModal").addEventListener("hidden.bs.modal", function () {
		document.getElementById("editId").value = "";
		document.getElementById("webhookIdField").value = "";
		document.getElementById("webhookName").value = "";
		document.getElementById("webhookUrl").value = "";
		document.getElementById("webhookVisible").checked = true;
	});
});

async function loadWebhookList() {
	try {
		const snapshot = await db.collection("webhooks").get();
		allWebhooks = [];
		snapshot.forEach((doc) => allWebhooks.push({ ...doc.data(), docId: doc.id }));
		allWebhooks.sort((a, b) => {
			const idA = isNaN(Number(a.id)) ? a.id : Number(a.id);
			const idB = isNaN(Number(b.id)) ? b.id : Number(b.id);
			return idA > idB ? 1 : idA < idB ? -1 : 0;
		});
		renderWebhookList();
	} catch (error) {
		console.error("Lỗi tải danh sách webhook:", error);
		document.getElementById("webhookTableBody").innerHTML = `<tr><td colspan="4" class="text-center py-4 text-danger"><i class="fas fa-exclamation-triangle fa-2x mb-2 d-block"></i>Lỗi tải danh sách: ${error.message}</td></tr>`;
	}
}

function filterWebhooks() {
	renderWebhookList();
}

function renderWebhookList() {
	const tbody = document.getElementById("webhookTableBody");
	const keyword = document.getElementById("searchInput").value.toLowerCase().trim();
	const filtered = keyword ? allWebhooks.filter((w) => (w.name || "").toLowerCase().includes(keyword)) : allWebhooks;
	if (filtered.length === 0) {
		tbody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-muted"><i class="fas fa-search fa-2x mb-2 d-block"></i>${allWebhooks.length === 0 ? 'Chưa có webhook nào. Nhấn "Thêm Webhook" để bắt đầu.' : "Không tìm thấy webhook nào."}</td></tr>`;
		return;
	}
	let html = "";
	for (const wh of filtered) {
		const displayUrl = wh.url || "";
		const isVisible = wh.visible !== false;
		const visibleBtn = isVisible
			? `<button class="btn btn-sm btn-outline-success" onclick="toggleVisible('${wh.docId}', false)" title="Tắt hiển thị"><i class="fas fa-eye"></i></button>`
			: `<button class="btn btn-sm btn-outline-secondary" onclick="toggleVisible('${wh.docId}', true)" title="Bật hiển thị"><i class="fas fa-eye-slash"></i></button>`;
		html += `
			<tr>
				<td class="text-muted d-none d-md-table-cell">${wh.id || ""}</td>
				<td>
					<div class="d-flex flex-column">
						<div><strong>${wh.name || "Không tên"}</strong></div>
						<span class="d-md-none small text-muted">ID: ${wh.id || "N/A"}</span>
						<span class="d-md-none small text-muted text-truncate" style="max-width: 200px;">${displayUrl}</span>
						<div class="d-md-none mt-1 d-flex gap-1 flex-wrap">
							${visibleBtn}
							<button class="btn btn-outline-success btn-sm" onclick="testWebhook('${wh.docId}')" title="Kiểm tra"><i class="fas fa-paper-plane"></i></button>
							<button class="btn btn-outline-primary btn-sm" onclick="editWebhook('${wh.docId}')" title="Sửa"><i class="fas fa-edit"></i></button>
							<button class="btn btn-outline-danger btn-sm" onclick="deleteWebhook('${wh.docId}')" title="Xóa"><i class="fas fa-trash"></i></button>
							<button class="btn btn-outline-secondary btn-sm" onclick="copyUrl('${wh.docId}')" title="Sao chép URL"><i class="fas fa-copy"></i></button>
						</div>
					</div>
				</td>
				<td class="d-none d-md-table-cell">
					<div class="d-flex align-items-center gap-1">
						<code class="small text-truncate" style="max-width: 250px;">${displayUrl}</code>
						<button class="btn btn-sm btn-outline-secondary" onclick="copyUrl('${wh.docId}')" title="Sao chép URL">
							<i class="fas fa-copy"></i>
						</button>
					</div>
				</td>
				<td class="d-none d-md-table-cell">
					<div class="btn-group btn-group-sm">
						${visibleBtn}
						<button class="btn btn-outline-success" onclick="testWebhook('${wh.docId}')" title="Kiểm tra"><i class="fas fa-paper-plane"></i></button>
						<button class="btn btn-outline-primary" onclick="editWebhook('${wh.docId}')" title="Sửa"><i class="fas fa-edit"></i></button>
						<button class="btn btn-outline-danger" onclick="deleteWebhook('${wh.docId}')" title="Xóa"><i class="fas fa-trash"></i></button>
					</div>
				</td>
			</tr>
		`;
	}
	tbody.innerHTML = html;
}

function showAddModal() {
	document.getElementById("modalTitle").textContent = "Thêm Webhook";
	document.getElementById("editId").value = "";
	const ids = allWebhooks
		.map(w => parseInt(w.id, 10))
		.filter(n => !isNaN(n))
		.sort((a, b) => a - b);
	let nextId = 1;
	for (const id of ids) {
		if (id === nextId) {
			nextId++;
		} else if (id > nextId) {
			break;
		}
	}
	document.getElementById("webhookIdField").value = nextId;
	document.getElementById("webhookName").value = "";
	document.getElementById("webhookUrl").value = "";
	document.getElementById("webhookVisible").checked = true;
	modalInstance.show();
}

async function editWebhook(id) {
	try {
		const doc = await db.collection("webhooks").doc(id).get();
		if (!doc.exists) {
			Swal.fire({ icon: "error", title: "Lỗi!", text: "Webhook không tồn tại" });
			return;
		}
		const data = doc.data();
		document.getElementById("modalTitle").textContent = "Chỉnh Sửa Webhook";
		document.getElementById("editId").value = id;
		document.getElementById("webhookIdField").value = data.id || "";
		document.getElementById("webhookName").value = data.name || "";
		document.getElementById("webhookUrl").value = data.url || "";
		document.getElementById("webhookVisible").checked = data.visible !== false;
		modalInstance.show();
	} catch (error) {
		Swal.fire({ icon: "error", title: "Lỗi!", text: error.message });
	}
}

async function saveWebhook() {
	const editId = document.getElementById("editId").value.trim();
	const whId = document.getElementById("webhookIdField").value.trim();
	const name = document.getElementById("webhookName").value.trim();
	const url = document.getElementById("webhookUrl").value.trim();
	const visible = document.getElementById("webhookVisible").checked;

	if (!whId) {
		Swal.fire({ icon: "error", title: "Lỗi!", text: "Vui lòng nhập mã ID" });
		return;
	}
	if (!name) {
		Swal.fire({ icon: "error", title: "Lỗi!", text: "Vui lòng nhập tên webhook" });
		return;
	}
	if (!url) {
		Swal.fire({ icon: "error", title: "Lỗi!", text: "Vui lòng nhập URL webhook" });
		return;
	}
	if (!url.startsWith("https://discord.com/api/webhooks/")) {
		Swal.fire({ icon: "error", title: "Lỗi!", text: "URL webhook không hợp lệ. Phải bắt đầu bằng https://discord.com/api/webhooks/" });
		return;
	}

	try {
		if (editId) {
			await db.collection("webhooks").doc(editId).update({ id: whId, name, url, visible });
			Swal.fire({ icon: "success", title: "Đã cập nhật!", text: `Webhook "${name}" đã được cập nhật.`, timer: 1500, showConfirmButton: false });
		} else {
			await db.collection("webhooks").add({ id: whId, name, url, visible });
			Swal.fire({ icon: "success", title: "Đã thêm!", text: `Webhook "${name}" đã được thêm.`, timer: 1500, showConfirmButton: false });
		}
		modalInstance.hide();
		loadWebhookList();
	} catch (error) {
		Swal.fire({ icon: "error", title: "Lỗi!", text: error.message });
	}
}

async function deleteWebhook(id) {
	try {
		const doc = await db.collection("webhooks").doc(id).get();
		if (!doc.exists) return;
		const name = doc.data().name || "Webhook này";

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
			await db.collection("webhooks").doc(id).delete();
			Swal.fire({ icon: "success", title: "Đã xóa!", text: `Webhook "${name}" đã được xóa.`, timer: 1500, showConfirmButton: false });
			loadWebhookList();
		}
	} catch (error) {
		Swal.fire({ icon: "error", title: "Lỗi!", text: error.message });
	}
}

async function testWebhook(id) {
	try {
		const doc = await db.collection("webhooks").doc(id).get();
		if (!doc.exists) {
			Swal.fire({ icon: "error", title: "Lỗi!", text: "Webhook không tồn tại" });
			return;
		}
		const data = doc.data();
		const payload = {
			content: "✅ **Kiểm tra kết nối webhook thành công!**",
			embeds: [{
				title: "Thông báo từ Webhook Manager",
				description: `Webhook **${data.name}** hoạt động bình thường.`,
				color: 0x00ff00,
				footer: { text: `Kiểm tra lúc ${new Date().toLocaleString("vi-VN")}` }
			}]
		};

		const response = await fetch(data.url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
		});

		if (response.ok) {
			Swal.fire({ icon: "success", title: "Thành công!", text: `Webhook "${data.name}" hoạt động tốt. Đã gửi tin nhắn kiểm tra.` });
		} else {
			const err = await response.text();
			throw new Error(err || "Không thể gửi tin nhắn kiểm tra");
		}
	} catch (error) {
		Swal.fire({ icon: "error", title: "Lỗi kết nối!", text: `Webhook "${data?.name || id}" không hoạt động: ${error.message}` });
	}
}

async function copyUrl(id) {
	try {
		const doc = await db.collection("webhooks").doc(id).get();
		if (!doc.exists) {
			Swal.fire({ icon: "error", title: "Lỗi!", text: "Webhook không tồn tại" });
			return;
		}
		await navigator.clipboard.writeText(doc.data().url);
		Swal.fire({ icon: "success", title: "Đã sao chép!", text: "URL webhook đã được sao chép vào clipboard.", timer: 1500, showConfirmButton: false, position: "top-end", toast: true });
	} catch (error) {
		Swal.fire({ icon: "error", title: "Lỗi!", text: error.message });
	}
}

async function toggleVisible(id, visible) {
	try {
		await db.collection("webhooks").doc(id).update({ visible });
		loadWebhookList();
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
