"use strict";

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let allLogs = [];
const PAGE_SIZE = 20;
let currentPage = 1;

document.addEventListener("DOMContentLoaded", function () {
	auth.onAuthStateChanged((user) => {
		if (user) {
			document.getElementById("userEmail").textContent = user.email;
			loadLogs();
		} else {
			window.location.href = "../login.html";
		}
	});
});

async function signOut() {
	try {
		await auth.signOut();
		window.location.href = "../login.html";
	} catch (error) {
		console.error("Lỗi khi đăng xuất:", error);
		Swal.fire({
			icon: "error",
			title: "Lỗi!",
			text: error.message,
			confirmButtonText: "OK",
		});
	}
}

function formatDate(timestamp) {
	let date;
	if (timestamp && typeof timestamp.toDate === 'function') {
		date = timestamp.toDate();
	} else if (timestamp instanceof Date) {
		date = timestamp;
	} else if (typeof timestamp === 'number') {
		date = new Date(timestamp);
	} else {
		date = new Date();
	}
	return date.toLocaleString('vi-VN', {
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		day: '2-digit',
		month: '2-digit',
		year: 'numeric',
		hour12: false
	});
}

async function loadLogs() {
	try {
		const tbody = document.querySelector("#logsTable tbody");
		tbody.innerHTML = '<tr><td colspan="6" class="text-center py-3"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div></td></tr>';

		const logsRef = db.collection("logs").orderBy("timestamp", "desc");
		const querySnapshot = await logsRef.get();

		allLogs = [];
		querySnapshot.forEach((doc) => {
			const logData = doc.data();
			logData.id = doc.id;
			allLogs.push(logData);
		});

		currentPage = 1;
		renderPage();
	} catch (error) {
		console.error("Lỗi khi tải log:", error);
		document.querySelector("#logsTable tbody").innerHTML = `<tr><td colspan="6" class="alert alert-danger">Đã xảy ra lỗi khi tải nhật ký: ${error.message}</td></tr>`;
	}
}

function renderPage() {
	renderLogsTable();
	renderPagination();
}

function renderLogsTable() {
	const tbody = document.querySelector("#logsTable tbody");

	if (allLogs.length === 0) {
		tbody.innerHTML = '<tr><td colspan="6" class="text-muted text-center py-3">Không có dữ liệu nhật ký.</td></tr>';
		return;
	}

	const start = (currentPage - 1) * PAGE_SIZE;
	const pageLogs = allLogs.slice(start, start + PAGE_SIZE);

	tbody.innerHTML = pageLogs.map((log, index) => `
		<tr class="${log.isError ? "table-danger" : ""}" style="cursor: pointer;">
			<td class="text-center d-none d-sm-table-cell">${start + index + 1}</td>
			<td class="text-nowrap small d-none d-md-table-cell">${formatDate(log.timestamp)}</td>
			<td class="text-center">${log.isError ? '<span class="text-danger" title="Lỗi">❌</span>' : '<span class="text-success" title="Thành công">✅</span>'}</td>
			<td class="d-none d-sm-table-cell">${log.webhookName || "Không có"}</td>
			<td onclick="viewLogDetail('${log.id}')">
				<div class="small fw-bold text-truncate">${log.message}</div>
				${log.text ? `<div class="small text-muted text-truncate">${log.text.substring(0, 80)}${log.text.length > 80 ? "..." : ""}</div>` : '<div class="small text-muted fst-italic">Không có nội dung</div>'}
			</td>
			<td class="text-center">
				<button class="btn btn-sm btn-outline-danger" onclick="event.stopPropagation(); deleteLog('${log.id}')" title="Xóa log này">
					<i class="fas fa-trash-alt"></i>
				</button>
			</td>
		</tr>
	`).join("");
}

function renderPagination() {
	const totalPages = Math.ceil(allLogs.length / PAGE_SIZE);
	const container = document.getElementById("pagination");
	if (!container) return;

	if (totalPages <= 1) {
		container.innerHTML = "";
		return;
	}

	const maxVisible = window.innerWidth < 576 ? 3 : 5;

	let html = `<ul class="pagination pagination-sm justify-content-center mb-0 mt-3 flex-wrap">`;

	html += `<li class="page-item ${currentPage === 1 ? "disabled" : ""}">
		<button class="page-link" onclick="goToPage(${currentPage - 1})"><i class="fas fa-chevron-left"></i></button>
	</li>`;
	let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
	let endPage = Math.min(totalPages, startPage + maxVisible - 1);
	if (endPage - startPage + 1 < maxVisible) {
		startPage = Math.max(1, endPage - maxVisible + 1);
	}

	if (startPage > 1) {
		html += `<li class="page-item"><button class="page-link" onclick="goToPage(1)">1</button></li>`;
		if (startPage > 2) {
			html += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
		}
	}

	for (let i = startPage; i <= endPage; i++) {
		html += `<li class="page-item ${i === currentPage ? "active" : ""}">
			<button class="page-link" onclick="goToPage(${i})">${i}</button>
		</li>`;
	}

	if (endPage < totalPages) {
		if (endPage < totalPages - 1) {
			html += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
		}
		html += `<li class="page-item"><button class="page-link" onclick="goToPage(${totalPages})">${totalPages}</button></li>`;
	}

	html += `<li class="page-item ${currentPage === totalPages ? "disabled" : ""}">
		<button class="page-link" onclick="goToPage(${currentPage + 1})"><i class="fas fa-chevron-right"></i></button>
	</li>`;

	html += `</ul>`;

	container.innerHTML = html;
}

function goToPage(page) {
	const totalPages = Math.ceil(allLogs.length / PAGE_SIZE);
	if (page < 1 || page > totalPages) return;
	currentPage = page;
	renderPage();
}

function viewLogDetail(logId) {
	const log = allLogs.find(l => l.id === logId);
	if (!log) return;

	const time = formatDate(log.timestamp);
	const status = log.isError ? "❌ Lỗi" : "✅ Thành công";
	const text = log.text || "Không có nội dung";

	Swal.fire({
		title: "Chi tiết nhật ký",
		html: `
			<div class="text-start">
				<div class="mb-2"><strong>Thời gian:</strong><br>${time}</div>
				<div class="mb-2"><strong>Trạng thái:</strong><br>${status}</div>
				<div class="mb-2"><strong>Webhook:</strong><br>${log.webhookName || "Không có"}</div>
				<div class="mb-2"><strong>Tin nhắn:</strong><br>${log.message}</div>
				<div class="mb-2"><strong>Nội dung:</strong><br><pre style="white-space: pre-wrap; word-break: break-word; max-height: 300px; overflow-y: auto; background: #f5f5f5; padding: 8px; border-radius: 4px;">${text}</pre></div>
				${log.webhookUrl ? `<div class="mb-2"><strong>URL:</strong><br><small style="word-break: break-all;">${log.webhookUrl}</small></div>` : ""}
			</div>
		`,
		width: "600px",
		confirmButtonText: "Đóng",
	});
}

async function downloadLogs() {
	try {
		if (!auth.currentUser) {
			Swal.fire({
				icon: "error",
				title: "Lỗi!",
				text: "Bạn cần đăng nhập để tải log",
				confirmButtonText: "OK",
			});
			return;
		}

		const querySnapshot = await db.collection("logs").where("user", "==", auth.currentUser.email).orderBy("timestamp", "desc").get();

		let logContent = "";
		querySnapshot.forEach((doc) => {
			const data = doc.data();
			const timestamp = new Date(data.timestamp.seconds * 1000 + data.timestamp.nanoseconds / 1000000);
			logContent += `========================\n`;
			logContent += `Thời gian: ${timestamp.toLocaleString('vi-VN', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            })}\n`;
			logContent += `Tin nhắn: ${data.message}\n`;
			logContent += `Nội dung: ${data.text || ""}\n`;
			logContent += `Webhook: ${data.webhookName}\n`;
			logContent += `URL: ${data.webhookUrl}\n`;
			logContent += `Trạng thái: ${data.isError ? "Lỗi" : "Thành công"}\n`;
		});

		const blob = new Blob([logContent], { type: "text/plain;charset=utf-8;" });
		const url = window.URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.setAttribute("href", url);
		const now = new Date();
		const formattedDate = now.toISOString().replace(/[:.]/g, "-");
		a.setAttribute("download", `logs_${formattedDate}.txt`);
		a.click();
		window.URL.revokeObjectURL(url);
	} catch (error) {
		console.error("Lỗi khi tải log:", error);
		Swal.fire({
			icon: "error",
			title: "Lỗi!",
			text: error.message,
			confirmButtonText: "OK",
		});
	}
}

async function deleteLog(logId) {
	try {
		const result = await Swal.fire({
			title: "Xác nhận xóa",
			text: "Bạn có chắc chắn muốn xóa log này?",
			icon: "warning",
			showCancelButton: true,
			confirmButtonColor: "#d33",
			cancelButtonColor: "#3085d6",
			confirmButtonText: "Có, xóa ngay!",
			cancelButtonText: "Hủy bỏ",
		});

		if (result.isConfirmed) {
			await db.collection("logs").doc(logId).delete();
			allLogs = allLogs.filter(l => l.id !== logId);
			const totalPages = Math.ceil(allLogs.length / PAGE_SIZE);
			if (currentPage > totalPages) currentPage = totalPages || 1;
			renderPage();

			Swal.fire({
				title: "Đã xóa!",
				text: "Log đã được xóa thành công.",
				icon: "success",
				timer: 1500,
				showConfirmButton: false,
			});
		}
	} catch (error) {
		console.error("Lỗi khi xóa log:", error);
		Swal.fire({
			icon: "error",
			title: "Lỗi!",
			text: error.message,
		});
	}
}

async function deleteLogs() {
	const { isConfirmed } = await Swal.fire({
		title: "Xác nhận xóa",
		text: "Bạn có chắc chắn muốn xóa tất cả log?",
		icon: "warning",
		showCancelButton: true,
		confirmButtonText: "Xóa",
		cancelButtonText: "Hủy",
	});

	if (isConfirmed) {
		try {
			const batch = db.batch();
			const querySnapshot = await db.collection("logs").get();

			querySnapshot.forEach((doc) => {
				batch.delete(doc.ref);
			});

			await batch.commit();

			allLogs = [];
			currentPage = 1;
			renderPage();

			Swal.fire({
				title: "Thành công!",
				text: "Tất cả log đã được xóa.",
				icon: "success",
				timer: 1500,
				showConfirmButton: false,
			});
		} catch (error) {
			console.error("Lỗi khi xóa log:", error);
			Swal.fire({
				icon: "error",
				title: "Lỗi!",
				text: error.message,
			});
		}
	}
}
