"use strict";

// Khởi tạo Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Kiểm tra trạng thái đăng nhập khi trang tải
document.addEventListener("DOMContentLoaded", function () {
	auth.onAuthStateChanged((user) => {
		if (user) {
			// Người dùng đã đăng nhập
			document.querySelector(".container").classList.remove("d-none");
			document.getElementById("userInfo").classList.remove("d-none");
			document.getElementById("userEmail").textContent = user.email;
			// Tải dữ liệu sau khi đăng nhập
			loadWebhooks();
			loadLogs();
		} else {
			// Chưa đăng nhập, chuyển hướng về trang đăng nhập
			window.location.href = "../login.html";
		}
	});
});

// Hàm đăng xuất
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

// Hàm tải webhooks (chỉ gọi sau khi đăng nhập thành công)
async function loadWebhooks() {
	try {
		const webhookSelect = document.getElementById("webhookSelect");
		webhookSelect.innerHTML = '<option value="">Đang tải danh sách webhook...</option>';

		// Lấy danh sách webhook từ collection 'webhooks'
		const webhooksRef = db.collection("webhooks");
		const snapshot = await webhooksRef.get();

		if (snapshot.empty) {
			webhookSelect.innerHTML = '<option value="">Không có webhook nào</option>';
			return;
		}

		// Chuyển đổi snapshot thành mảng
		const webhooks = [];
		snapshot.forEach((doc) => {
			webhooks.push({
				id: doc.id,
				...doc.data(),
			});
		});

		// Tạo các nhóm webhook dựa trên phần tên trước dấu gạch ngang (-)
		const groupedWebhooks = {};
		webhooks.forEach((webhook) => {
			let groupName = "Khác";
			if (webhook.name && webhook.name.includes("-")) {
				// Lấy phần tên trước dấu gạch ngang và bỏ khoảng trắng thừa
				groupName = webhook.name.split("-")[0].trim();
			} else if (webhook.name) {
				// Nếu không có dấu gạch ngang, sử dụng toàn bộ tên làm nhóm
				groupName = webhook.name.trim();
			}

			if (!groupedWebhooks[groupName]) {
				groupedWebhooks[groupName] = [];
			}
			groupedWebhooks[groupName].push(webhook);
		});

		// Sắp xếp các webhook trong từng nhóm theo ID
		Object.keys(groupedWebhooks).forEach((group) => {
			groupedWebhooks[group].sort((a, b) => {
				// Chuyển đổi ID sang số nếu có thể để so sánh
				const idA = isNaN(Number(a.id)) ? a.id : Number(a.id);
				const idB = isNaN(Number(b.id)) ? b.id : Number(b.id);
				return idA > idB ? 1 : idA < idB ? -1 : 0;
			});
		});

		// Sắp xếp các nhóm theo tên
		const sortedGroups = Object.keys(groupedWebhooks).sort();

		// Xóa option "Đang tải..."
		webhookSelect.innerHTML = "";

		// Thêm option mặc định
		const defaultOption = document.createElement("option");
		defaultOption.value = "";
		defaultOption.textContent = "Chọn webhook...";
		webhookSelect.appendChild(defaultOption);

		// Thêm các webhook đã nhóm vào select
		sortedGroups.forEach((group) => {
			// Thêm nhóm (optgroup)
			const groupElement = document.createElement("optgroup");
			groupElement.label = group;

			// Thêm các webhook trong nhóm
			groupedWebhooks[group].forEach((webhook) => {
				const option = document.createElement("option");
				option.value = webhook.id;
				// Hiển thị toàn bộ tên webhook trong option
				option.textContent = webhook.name || `Webhook ${webhook.id}`;
				groupElement.appendChild(option);
			});

			webhookSelect.appendChild(groupElement);
		});

		// Bật select sau khi tải xong
		webhookSelect.disabled = false;
	} catch (error) {
		console.error("Lỗi khi tải danh sách webhook:", error);
		const webhookSelect = document.getElementById("webhookSelect");
		webhookSelect.innerHTML = '<option value="">Lỗi khi tải danh sách webhook</option>';
		Swal.fire({
			icon: "error",
			title: "Lỗi!",
			text: "Lỗi khi tải danh sách webhook: " + error.message,
			confirmButtonText: "OK",
		});
	}
}

// Hàm lấy webhook URLs từ Firebase
async function getWebhookUrls() {
	try {
		const webhooks = {};
		const querySnapshot = await db.collection("webhooks").get();
		querySnapshot.forEach((doc) => {
			const data = doc.data();
			webhooks[data.id] = data.url;
		});
		return webhooks;
	} catch (error) {
		console.error("Lỗi khi lấy webhooks:", error);
		return {};
	}
}

// Biến toàn cục cho phân trang
let currentLogIndex = 0;
let allLogs = [];

// Hàm tải log từ Firebase
async function loadLogs() {
	try {
		const logArea = document.getElementById("logArea");
		logArea.innerHTML = '<div class="text-center py-3"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div></div>';

		const logsRef = db.collection("logs").orderBy("timestamp", "desc").limit(50);
		const querySnapshot = await logsRef.get();

		allLogs = [];
		querySnapshot.forEach((doc) => {
			const logData = doc.data();
			logData.id = doc.id;
			allLogs.push(logData);
		});

		if (allLogs.length === 0) {
			logArea.innerHTML = '<div class="text-muted text-center py-3">Không có dữ liệu nhật ký.</div>';
		} else {
			currentLogIndex = 0;
			displayCurrentLog();
		}
	} catch (error) {
		console.error("Lỗi khi tải log:", error);
		document.getElementById("logArea").innerHTML = '<div class="alert alert-danger">Đã xảy ra lỗi khi tải nhật ký: ' + error.message + "</div>";
	}
}

// Hiển thị log hiện tại
function displayCurrentLog() {
	if (allLogs.length === 0) return;

	const logArea = document.getElementById("logArea");
	const data = allLogs[currentLogIndex];

	// Chuyển đổi timestamp từ Firestore thành string dễ đọc
	const formatDate = (timestamp) => {
		let date;
		if (timestamp && typeof timestamp.toDate === 'function') {
			// Trường hợp timestamp là đối tượng Firestore Timestamp
			date = timestamp.toDate();
		} else if (timestamp instanceof Date) {
			// Trường hợp timestamp đã là Date object
			date = timestamp;
		} else if (typeof timestamp === 'number') {
			// Trường hợp timestamp là số (timestamp Unix)
			date = new Date(timestamp);
		} else {
			// Trường hợp không xác định, sử dụng Date.now()
			date = new Date();
		}
		return date.toLocaleString('vi-VN', {
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			day: '2-digit',
			month: '2-digit',
			month: '2-digit',
			year: 'numeric',
			hour12: false
		});
	};

	let logHTML = `
				<div class="log-item ${data.isError ? "text-danger" : ""}">
					<div class="d-flex justify-content-between align-items-center mb-2">
						<span><strong>${data.isError ? "❌ Lỗi: " : ""}${data.message}</strong></span>
						<span class="text-muted small">${formatDate(data.timestamp)}</span>
					</div>
					<div class="log-content">
						<div class="log-field"><strong>Webhook:</strong> ${data.webhookName || "Không có"}</div>
						${data.text ? `<div class="log-field"><strong>Nội dung:</strong><br>${data.text.replace(/\n/g, "<br>")}</div>` : ""}
					</div>
				</div>
			`;

	logArea.innerHTML = logHTML;

	// Cập nhật trạng thái nút điều hướng
	document.getElementById("prevLog").disabled = currentLogIndex === 0;
	document.getElementById("nextLog").disabled = currentLogIndex === allLogs.length - 1;

	// Cập nhật thông tin phân trang
	document.getElementById("logPaginationInfo").textContent = `${currentLogIndex + 1} / ${allLogs.length}`;
}

// Thêm sự kiện cho nút điều hướng
document.addEventListener("DOMContentLoaded", function () {
	document.getElementById("prevLog").addEventListener("click", () => {
		if (currentLogIndex > 0) {
			currentLogIndex--;
			displayCurrentLog();
		}
	});

	document.getElementById("nextLog").addEventListener("click", () => {
		if (currentLogIndex < allLogs.length - 1) {
			currentLogIndex++;
			displayCurrentLog();
		}
	});
});

// Hàm thêm log vào Firebase
async function addLogToFirebase(message, text, webhookName, webhookUrl, isError = false) {
	try {
		const timestamp = firebase.firestore.Timestamp.now();
		const logData = {
			message,
			text,
			webhookName,
			webhookUrl,
			timestamp,
			isError,
			user: auth.currentUser?.email || "unknown",
		};

		await db.collection("logs").add(logData);
	} catch (error) {
		console.error("Lỗi khi lưu log:", error);
	}
}

// Hàm thêm log vào khung nhật ký
function addLog(message, text, webhookName, webhookUrl, isError = false) {
	// Nếu là webhook TEST thì chỉ hiển thị không lưu vào Firebase
	if (webhookName === "TEST") {
		const newLog = {
			message: message,
			text: text,
			webhookName: webhookName,
			webhookUrl: webhookUrl,
			timestamp: new Date(), // Sử dụng timestamp thông thường
			isError: isError,
			user: auth.currentUser?.email || "unknown"
		};
		allLogs.unshift(newLog);
		currentLogIndex = 0;
		displayCurrentLog();
		return;
	}

	// Sử dụng timestamp từ Firestore
	const timestamp = firebase.firestore.FieldValue.serverTimestamp();

	// Tạo đối tượng log mới
	const newLog = {
		message: message,
		text: text,
		webhookName: webhookName,
		webhookUrl: webhookUrl,
		timestamp: timestamp,
		isError: isError,
		user: auth.currentUser?.email || "unknown"
	};

	// Lưu vào Firebase và hiển thị ngay
	addLogToFirebase(message, text, webhookName, webhookUrl, isError)
		.then(() => {
			allLogs.unshift(newLog);
			currentLogIndex = 0;
			displayCurrentLog();
		});
}

// Chèn văn bản vào textarea
function insertText(before, after, textareaId = "messageText") {
	const textarea = document.getElementById(textareaId);
	const start = textarea.selectionStart;
	const end = textarea.selectionEnd;
	const text = textarea.value;
	const selectedText = text.substring(start, end);

	textarea.value = text.substring(0, start) + before + selectedText + after + text.substring(end);

	// Đặt lại vị trí con trỏ
	const newCursorPos = start + before.length;
	textarea.setSelectionRange(newCursorPos, newCursorPos + selectedText.length);
	textarea.focus();
}

// Lấy thởi gian hiện tại
function getCurrentTime() {
	const now = new Date();
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, "0");
	const day = String(now.getDate()).padStart(2, "0");
	const hours = String(now.getHours()).padStart(2, "0");
	const minutes = String(now.getMinutes()).padStart(2, "0");
	const seconds = String(now.getSeconds()).padStart(2, "0");

	return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

// Hàm thực thi các biểu thức JavaScript trong chuỗi
function evaluateExpressions(text) {
	// Tìm tất cả các biểu thức ${...} trong chuỗi
	return text.replace(/\$\{([^}]+)\}/g, (match, expression) => {
		try {
			// Đánh giá biểu thức và trả về kết quả
			return new Function(`return ${expression}`)();
		} catch (e) {
			console.error("Lỗi khi thực thi biểu thức:", e);
			return match; // Giữ nguyên nếu có lỗi
		}
	});
}

// Gửi tin nhắn văn bản
async function sendTextMessage() {
	const webhooks = await getWebhookUrls();
	const webhookSelect = document.getElementById("webhookSelect");
	const selectedWebhookId = webhookSelect.value;
	const webhookUrl = webhooks[selectedWebhookId];
	const webhookName = webhookSelect.options[webhookSelect.selectedIndex].text;
	let message = document.getElementById("messageText").value;
	const username = document.getElementById("customUsername").value;
	const avatarUrl = document.getElementById("avatarUrl").value;
	const tts = document.getElementById("tts").checked;

	if (!message.trim()) {
		Swal.fire({
			icon: "error",
			title: "Lỗi!",
			text: "Vui lòng nhập nội dung tin nhắn",
			confirmButtonText: "OK",
		});
		return;
	}

	try {
		// Thực thi các biểu thức JavaScript trong tin nhắn
		message = evaluateExpressions(message);

		const payload = {
			content: message,
			tts: tts,
		};

		if (username) payload.username = username;
		if (avatarUrl) payload.avatar_url = avatarUrl;

		const response = await fetch(webhookUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(payload),
		});

		if (response.ok) {
			addLog("✅ Đã gửi tin nhắn thành công!", message, webhookName, webhookUrl);

			await Swal.fire({
				icon: "success",
				title: "Thành công!",
				text: "Tin nhắn đã được gửi thành công.",
				showConfirmButton: true,
			});
		} else {
			const error = await response.text();
			addLog(`❌ Lỗi khi gửi tin nhắn: ${error}`, "", webhookName, webhookUrl, true);
			await Swal.fire({
				icon: "error",
				title: "Lỗi!",
				text: "Đã xảy ra lỗi khi gửi tin nhắn: " + error.message,
			});
		}
	} catch (error) {
		addLog(`❌ Lỗi kết nối: ${error.message}`, "", webhookName, webhookUrl, true);
		await Swal.fire({
			icon: "error",
			title: "Lỗi!",
			text: "Đã xảy ra lỗi khi gửi tin nhắn: " + error.message,
		});
	}
}

// Gửi file đính kèm
async function sendFileMessage() {
	try {
		const webhooks = await getWebhookUrls();
		const webhookSelect = document.getElementById("webhookSelect");
		const selectedWebhookId = webhookSelect.value;
		const webhookUrl = webhooks[selectedWebhookId];
		const webhookName = webhookSelect.options[webhookSelect.selectedIndex].text;
		const fileInput = document.getElementById("fileInput");
		const files = fileInput.files;
		const message = document.getElementById("fileMessageText").value;
		const username = document.getElementById("customUsername").value;
		const avatarUrl = document.getElementById("avatarUrl").value;

		if (files.length === 0) {
			Swal.fire({
				icon: "error",
				title: "Lỗi!",
				text: "Vui lòng chọn ít nhất một file",
				confirmButtonText: "OK",
			});
			return;
		}

		const formData = new FormData();
		if (message) formData.append("content", evaluateExpressions(message));
		if (username) formData.append("username", username);
		if (avatarUrl) formData.append("avatar_url", avatarUrl);

		// Thêm tất cả các file đã chọn
		for (let i = 0; i < files.length; i++) {
			formData.append(`file${i}`, files[i]);
		}

		const response = await fetch(webhookUrl, {
			method: "POST",
			body: formData,
		});

		if (response.ok) {
			const sentFilesCount = files.length;
			addLog(`✅ Đã gửi ${sentFilesCount} file thành công!`, evaluateExpressions(message), webhookName, webhookUrl);

			await Swal.fire({
				icon: "success",
				title: "Thành công!",
				text: `Bạn đã gửi ${sentFilesCount} file thành công.`,
				showConfirmButton: true,
			});
		} else {
			const error = await response.json();
			addLog(`❌ Lỗi khi gửi file: ${error.message || response.statusText}`, "", webhookName, webhookUrl, true);

			await Swal.fire({
				icon: "error",
				title: "Lỗi!",
				text: `Lỗi khi gửi file: ${error.message || response.statusText}`,
			});
		}
	} catch (error) {
		console.error("Lỗi khi gửi file:", error);
		addLog(`❌ Lỗi: ${error.message}`, "", webhookName, webhookUrl, true);

		await Swal.fire({
			icon: "error",
			title: "Lỗi!",
			text: `Lỗi khi gửi file: ${error.message}`,
		});
	}
}

// Thêm trường mới vào tin nhúng
function addEmbedField() {
	const fieldsContainer = document.getElementById("embedFields");
	const fieldCount = fieldsContainer.children.length + 1;

	const fieldDiv = document.createElement("div");
	fieldDiv.className = "embed-field mb-3 p-2 border rounded";
	fieldDiv.innerHTML = `
                <div class="d-flex justify-content-between mb-2">
                    <h6>Trường ${fieldCount}</h6>
                    <button class="btn btn-sm btn-danger" onclick="removeEmbedField(this)">Xóa</button>
                </div>
                <input type="text" class="form-control mb-2" placeholder="Tên trường">
                <textarea class="form-control mb-2" placeholder="Giá trị"></textarea>
                <div class="form-check">
                    <input class="form-check-input" type="checkbox">
                    <label class="form-check-label">Hiển thị cùng dòng</label>
                </div>
            `;

	fieldsContainer.appendChild(fieldDiv);
}

// Xóa trường tin nhúng
function removeEmbedField(button) {
	const fields = document.querySelectorAll(".embed-field");

	if (fields.length <= 1) {
		Swal.fire({
			icon: "error",
			title: "Lỗi!",
			text: "Phải có ít nhất một trường",
			confirmButtonText: "OK",
		});
		return;
	}

	// Hiển thị xác nhận trước khi xóa
	Swal.fire({
		title: "Xác nhận xóa",
		text: "Bạn có chắc chắn muốn xóa trường này không?",
		icon: "warning",
		showCancelButton: true,
		confirmButtonColor: "#d33",
		cancelButtonColor: "#3085d6",
		confirmButtonText: "Xóa",
		cancelButtonText: "Hủy",
	}).then((result) => {
		if (result.isConfirmed) {
			// Thêm hiệu ứng mờ dần trước khi xóa
			const fieldToRemove = button.closest(".embed-field");
			fieldToRemove.style.opacity = "0";
			fieldToRemove.style.transition = "opacity 0.3s ease";

			setTimeout(() => {
				fieldToRemove.remove();

				// Cập nhật lại số thứ tự các trường
				const remainingFields = document.querySelectorAll(".embed-field");
				remainingFields.forEach((field, index) => {
					const fieldTitle = field.querySelector("h6");
					if (fieldTitle) {
						fieldTitle.textContent = `Trường ${index + 1}`;
					}
				});
			}, 300);
		}
	});
}

// Gửi tin nhắn nhúng
async function sendEmbedMessage() {
	const webhooks = await getWebhookUrls();
	const webhookSelect = document.getElementById("webhookSelect");
	const selectedWebhookId = webhookSelect.value;
	const webhookUrl = webhooks[selectedWebhookId];
	const webhookName = webhookSelect.options[webhookSelect.selectedIndex].text;
	const title = document.getElementById("embedTitle").value;
	const description = document.getElementById("embedDescription").value;
	const color = document.getElementById("embedColorPicker").value;
	const footer = document.getElementById("embedFooter").value;
	const username = document.getElementById("customUsername").value;
	const avatarUrl = document.getElementById("avatarUrl").value;

	if (!title && !description) {
		Swal.fire({
			icon: "error",
			title: "Lỗi!",
			text: "Vui lòng nhập tiêu đề hoặc mô tả",
			confirmButtonText: "OK",
		});
		return;
	}

	// Thu thập các trường
	const fields = [];
	document.querySelectorAll(".embed-field").forEach((field) => {
		const name = field.querySelector('input[type="text"]').value;
		const value = field.querySelector("textarea").value;
		const inline = field.querySelector('input[type="checkbox"]').checked;

		if (name && value) {
			fields.push({
				name: name,
				value: value,
				inline: inline,
			});
		}
	});

	const embed = {
		title: title,
		description: description,
		color: parseInt(color.replace("#", ""), 16) || 0x5865f2, // Mặc định là màu xanh Discord
		fields: fields,
		footer: {
			text: footer || `Hệ thống thông báo - ${new Date().toLocaleString("vi-VN")}`,
		},
	};

	const payload = {
		embeds: [embed],
	};

	if (username) payload.username = username;
	if (avatarUrl) payload.avatar_url = avatarUrl;

	try {
		const response = await fetch(webhookUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(payload),
		});

		if (response.ok) {
			addLog("✅ Đã gửi tin nhúng thành công!", "", webhookName, webhookUrl);
			// Xóa form
			document.getElementById("embedTitle").value = "";
			document.getElementById("embedDescription").value = "";
			document.getElementById("embedColorPicker").value = "#5865F2";
			document.getElementById("embedFooter").value = "";
			// Giữ lại 1 trường trống
			const fieldsContainer = document.getElementById("embedFields");
			fieldsContainer.innerHTML = "";
			addEmbedField();

			await Swal.fire({
				icon: "success",
				title: "Thành công!",
				text: "Tin nhúng đã được gửi thành công.",
				showConfirmButton: true,
			});
		} else {
			const error = await response.text();
			addLog(`❌ Lỗi khi gửi tin nhúng: ${error}`, "", webhookName, webhookUrl, true);

			await Swal.fire({
				icon: "error",
				title: "Lỗi!",
				text: "Đã xảy ra lỗi khi gửi tin nhúng: " + error.message,
			});
		}
	} catch (error) {
		addLog(`❌ Lỗi kết nối: ${error.message}`, "", webhookName, webhookUrl, true);

		await Swal.fire({
			icon: "error",
			title: "Lỗi!",
			text: "Không thể gửi tin nhúng: " + error.message,
		});
	}
}

// Biến lưu template hiện tại
let currentTemplate = null;

// Định nghĩa các mẫu tin nhắn
const messageTemplates = {
	1: {
		name: "Rollback Thất Bại",
		content: `❓ THÔNG BÁO ❓
		🆎 Nội Dung: Rollback thất bại
		💳 Tài Khoản: 
		👤 ID Nhân Vật: 
		🖥️ Máy Chủ: Võ Lâm Tây Vực - 
		⚠️ Lý Do: 
		🕙 Thời gian: \${getCurrentTime()}
		Vui lòng kiểm tra và trả lại Account cho khách hàng!
		@everyone`,
	},

	2: {
		name: "Thông báo",
		content: `🔔 **THÔNG BÁO** 🔔
		📢 __**Nội Dung:**__ 
		💡 __**Phản Hồi:**__
		🕙 __**Thời gian:**__ \${getCurrentTime()}
		@everyone`,
	},

	3: {
		name: "Bảo Trì Thường Ngày",
		content: `🔔 **THÔNG BÁO** 🔔
		📢 __**Nội Dung:**__ Bảo trì hoàn tất
		🕙 __**Thời gian:**__ \${getCurrentTime()}
		@everyone`,
	},

	4: {
		name: "Bảo Trì Gộp SV",
		content: `🔔 **THÔNG BÁO** 🔔
		📢 __**Nội Dung:**__ Bảo trì gộp **S5 S6 (S44 S45)** hoàn tất
		🕙 __**Thời gian:**__ \${getCurrentTime()}
		@everyone`,
	},

	5: {
		name: "Reset Tiêu Phí Tháng",
		content: `🔔 **THÔNG BÁO** 🔔
		📢 __**Nội Dung:**__ Reset tiêu phí tháng tk **** hoàn tất
		🕙 __**Thời gian:**__ \${getCurrentTime()}
		@everyone`,
	},

	6: {
		name: "Bỏ Giới Hạn IP",
		content: `🔔 **THÔNG BÁO** 🔔
		📢 __**Nội Dung:**__ Bỏ giới hạn cho IP **** hoàn tất
		🕙 __**Thời gian:**__ \${getCurrentTime()}
		@everyone`,
	},

	7: {
		name: "Thắc Mắc",
		content: `❓ **THÔNG BÁO** ❓
		📢 __**Nội Dung:**__ 
		⚠️ __**Phản Hồi:**__
		🕙 __**Thời gian:**__ \${getCurrentTime()}
		@everyone`,
	},

	8: {
		name: "Reset Huyền Thông",
		content: `🔔 **THÔNG BÁO** 🔔
		📢 __**Nội Dung:**__ Reset điểm Huyền Thông về 0 ID **** (tk ****) hoàn tất
		🕙 __**Thời gian:**__ \${getCurrentTime()}
		@everyone`,
	},

	9: {
		name: "Sửa lỗi Phi Phong",
		content: `🔔 **THÔNG BÁO** 🔔
		📢 __**Nội Dung:**__ Sửa lỗi xác nhận kết quả phi phong ID **** (tk ****) hoàn tất
		🕙 __**Thời gian:**__ \${getCurrentTime()}
		@everyone`,
	},

	10: {
		name: "Chặn IP",
		content: `🔔 **THÔNG BÁO** 🔔
		📢 __**Nội Dung:**__ Chặn IP tk **** (Lúc **** đăng nhập S5: ****) hoàn tất
		🕙 __**Thời gian:**__ \${getCurrentTime()}
		@everyone`,
	},

	11: {
		name: "Nội Dung File Bảo Trì",
		content: `❓ **THÔNG BÁO** ❓
		📢 __**Nội Dung:**__ Nội dung file **___** (Lần 1) 
		# [[Điều Chỉnh Xong Gửi Lại File Nội Dung Đã Chỉnh Sửa]]
		⚠️ __**Lý Do:**__

		🕙 __**Thời gian:**__ \${getCurrentTime()}
		@everyone`,
	},

	12: {
		name: "Cập Nhật File Hoàn Tất",
		content: `🔔 **THÔNG BÁO** 🔔
		📢 __**Nội Dung:**__ Cập nhật hoàn tất nội dung file **___**. Vui lòng kiểm tra lại
		🕙 __**Thời gian:**__ \${getCurrentTime()}
		@everyone`,
	},

	13: {
		name: "Cảnh Báo",
		content: `## ⚠️ CẢNH BÁO ⚠️
		📢 __**Nội Dung:**__ 
		🕙 __**Thời gian:**__ \${getCurrentTime()}
		@everyone`,
	},
};

// Áp dụng mẫu tin nhắn đã chọn
function applyTemplate(templateId, textareaId = "messageText") {
	const templateSelect = document.getElementById("templateSelect");
	const messageText = document.getElementById(textareaId);

	if (!templateId) {
		// Khi chọn "-- Chọn mẫu tin nhắn --"
		messageText.value = "";
		currentTemplate = null;
		templateSelect.selectedIndex = 0;
		return;
	}

	const template = messageTemplates[templateId];
	if (!template) return;

	// Áp dụng nội dung mẫu
	messageText.value = template.content;
	currentTemplate = templateId;
}

// Reset dropdown khi click vào option đầu tiên
document.querySelector('#templateSelect option[value=""]').addEventListener("click", function () {
	currentTemplate = null;
	document.getElementById("messageText").value = "";
});

// Khởi tạo
document.addEventListener("DOMContentLoaded", function () {
	// Thêm sự kiện cho các tab
	const tabEls = document.querySelectorAll('button[data-bs-toggle="tab"]');
	tabEls.forEach((tabEl) => {
		tabEl.addEventListener("shown.bs.tab", function (event) {
			// Có thể thêm xử lý khi chuyển tab ở đây
		});
	});

	// Thêm sự kiện cho nút gửi bằng phím Enter trong textarea
	document.getElementById("messageText").addEventListener("keydown", function (e) {
		if (e.key === "Enter" && e.ctrlKey) {
			e.preventDefault();
			sendTextMessage();
		}
	});

	// Xử lý sự kiện thay đổi màu
	document.getElementById("embedColorPicker").addEventListener("change", function () {
		const color = this.value.substring(1); // Loại bỏ ký tự #
		document.getElementById("embedColor").value = color.toUpperCase();
	});
});

async function scheduleMessage(type = "text") {
	const { value: minutes } = await Swal.fire({
		title: "Hẹn giờ gửi tin nhắn",
		input: "number",
		inputLabel: "Nhập số phút hẹn giờ",
		inputPlaceholder: "Nhập số phút (tối thiểu 1 phút)",
		inputValue: "5",
		inputAttributes: {
			min: "1",
			step: "1",
		},
		showCancelButton: true,
		cancelButtonText: "Hủy",
		confirmButtonText: "Xác nhận",
		inputValidator: (value) => {
			if (!value || parseInt(value) < 1) {
				return "Vui lòng nhập số phút hợp lệ (từ 1 phút trở lên)";
			}
		},
	});

	if (!minutes) return;

	const minutesNum = parseInt(minutes);
	const now = new Date();
	const scheduledTime = new Date(now.getTime() + minutesNum * 60000);

	// Xác định loại tin nhắn
	let messageType = "tin nhắn";
	if (type === "file") messageType = "file đính kèm";
	else if (type === "embed") messageType = "tin nhúng";

	const { isConfirmed } = await Swal.fire({
		title: "Xác nhận hẹn giờ",
		html: `Bạn có chắc muốn gửi ${messageType} sau <b>${minutesNum} phút</b>?<br>(Lúc ${scheduledTime.getHours()}:${scheduledTime.getMinutes().toString().padStart(2, "0")})`,
		icon: "question",
		showCancelButton: true,
		cancelButtonText: "Hủy",
		confirmButtonText: "Xác nhận",
		confirmButtonColor: "#3085d6",
		cancelButtonColor: "#d33",
	});

	if (isConfirmed) {
		let timeLeft = minutesNum * 60; // Chuyển đổi sang giây
		let timerInterval;
		let isCancelled = false;

		// Hàm cập nhật giao diện đếm ngược
		const updateTimer = () => {
			timeLeft--;
			const minutesLeft = Math.floor(timeLeft / 60);
			const secondsLeft = timeLeft % 60;

			swal.update({
				html: `
								<div class="text-center">
									<h4>Đang đếm ngược để gửi ${messageType}</h4>
									<div class="my-3">
										<strong>${minutesLeft}:${secondsLeft.toString().padStart(2, "0")}</strong>
									</div>
									<progress value="${timeLeft}" max="${minutesNum * 60}" style="width: 100%; height: 20px;"></progress>
									<div class="mt-2">
										<small>${messageType.charAt(0).toUpperCase() + messageType.slice(1)} sẽ được gửi lúc: <b>${scheduledTime.getHours()}:${scheduledTime.getMinutes().toString().padStart(2, "0")}</b></small>
									</div>
								</div>
							`,
			});

			if (timeLeft <= 0) {
				clearInterval(timerInterval);
				if (!isCancelled) {
					swal.close();
					// Gọi hàm gửi tin nhắn tương ứng với loại
					if (type === "file") {
						sendFileMessage();
					} else if (type === "embed") {
						sendEmbedMessage();
					} else {
						sendTextMessage();
					}
					showSuccessMessage(`Đã gửi ${messageType} theo lịch hẹn`);
				}
			}
		};

		// Hiển thị hộp thoại đếm ngược
		swal.fire({
			title: `Đã đặt lịch gửi ${messageType}`,
			html: `
							<div class="text-center">
								<h4>Đang đếm ngược để gửi ${messageType}</h4>
								<div class="my-3">
									<strong>${minutesNum}:00</strong>
								</div>
								<progress value="${minutesNum * 60}" max="${minutesNum * 60}" style="width: 100%; height: 20px;"></progress>
								<div class="mt-2">
									<small>${messageType.charAt(0).toUpperCase() + messageType.slice(1)} sẽ được gửi lúc: <b>${scheduledTime.getHours()}:${scheduledTime.getMinutes().toString().padStart(2, "0")}</b></small>
								</div>
							</div>
						`,
			showConfirmButton: true,
			confirmButtonText: "Hủy bỏ",
			allowOutsideClick: false,
			didOpen: () => {
				timerInterval = setInterval(updateTimer, 1000);
			},
			willClose: () => {
				isCancelled = true;
				clearInterval(timerInterval);
			},
		});
	}
}

// Hàm hiển thị thông báo thành công
function showSuccessMessage(message) {
	swal.fire({
		title: "Thành công!",
		text: message,
		icon: "success",
		showConfirmButton: true,
		confirmButtonText: "OK",
	});
}

// Hàm tải log
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

		// Lấy tất cả log của người dùng
		const logsRef = db.collection("logs");
		const querySnapshot = await logsRef.where("user", "==", auth.currentUser.email).orderBy("timestamp", "desc").get();

		// Chuẩn bị dữ liệu
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

		// Tạo file
		const blob = new Blob([logContent], { type: "text/plain;charset=utf-8;" });
		const url = window.URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.setAttribute("href", url);
		// Định dạng tên file bao gồm ngày giờ phút giây
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

// Hàm xóa log
async function deleteLogs() {
	const { value: confirmDelete } = await Swal.fire({
		title: "Xác nhận xóa",
		text: "Bạn có chắc chắn muốn xóa tất cả log?",
		icon: "warning",
		showCancelButton: true,
		confirmButtonText: "Xóa",
		cancelButtonText: "Hủy",
	});

	if (confirmDelete) {
		try {
			// Xóa tất cả log trong Firebase
			const batch = db.batch();
			const querySnapshot = await db.collection("logs").get();

			querySnapshot.forEach((doc) => {
				batch.delete(doc.ref);
			});

			await batch.commit();

			// Xóa log khỏi giao diện
			const logArea = document.getElementById("logArea");
			if (logArea) {
				logArea.innerHTML = "<div>Hệ thống đã sẵn sàng. Chọn các tùy chọn và gửi tin nhắn.</div>";
			}

			// Hiển thị thông báo thành công
			Swal.fire({
				title: "Thành công!",
				text: "Tất cả log đã được xóa.",
				icon: "success",
			});

			// Load lại log sau 1 giây để đảm bảo cập nhật
			setTimeout(() => {
				loadLogs();
			}, 1000);
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

// Hàm xóa log hiện tại
async function deleteCurrentLog() {
	if (allLogs.length === 0) {
		Swal.fire({
			title: "Không có log nào để xóa",
			text: "Không tìm thấy log hiện tại để xóa.",
			icon: "info",
		});
		return;
	}

	const currentLog = allLogs[currentLogIndex];
	if (!currentLog || !currentLog.id) {
		Swal.fire({
			title: "Lỗi",
			text: "Không tìm thấy thông tin log hiện tại.",
			icon: "error",
		});
		return;
	}

	try {
		const result = await Swal.fire({
			title: "Xác nhận xóa",
			text: "Bạn có chắc chắn muốn xóa log hiện tại?",
			icon: "warning",
			showCancelButton: true,
			confirmButtonColor: "#d33",
			cancelButtonColor: "#3085d6",
			confirmButtonText: "Có, xóa ngay!",
			cancelButtonText: "Hủy bỏ",
		});

		if (result.isConfirmed) {
			// Xóa log hiện tại khỏi Firestore
			await db.collection("logs").doc(currentLog.id).delete();

			// Xóa log khỏi mảng allLogs
			allLogs.splice(currentLogIndex, 1);

			// Nếu đây là log cuối cùng, giảm currentLogIndex
			if (currentLogIndex >= allLogs.length && allLogs.length > 0) {
				currentLogIndex = allLogs.length - 1;
			}

			// Cập nhật hiển thị
			if (allLogs.length === 0) {
				document.getElementById("logArea").innerHTML = "<div>Không còn log nào.</div>";
				document.getElementById("logPaginationInfo").textContent = "0/0";
				document.getElementById("prevLog").disabled = true;
				document.getElementById("nextLog").disabled = true;
			} else {
				displayCurrentLog();
			}

			Swal.fire({
				title: "Đã xóa!",
				text: "Log hiện tại đã được xóa thành công.",
				icon: "success",
			});
		}
	} catch (error) {
		console.error("Lỗi khi xóa log hiện tại:", error);
		Swal.fire({
			icon: "error",
			title: "Lỗi!",
			text: error.message,
		});
	}
}

// Hàm xem trước ảnh đại diện
function previewAvatar() {
	const avatarUrl = document.getElementById("avatarUrl").value.trim();
	if (!avatarUrl) {
		Swal.fire({
			title: "Thiếu thông tin",
			text: "Vui lòng nhập URL ảnh đại diện",
			icon: "warning",
		});
		return;
	}

	try {
		// Kiểm tra xem URL có hợp lệ không
		new URL(avatarUrl);

		Swal.fire({
			title: "Xem trước ảnh đại diện",
			html: `
								<div class="text-center">
									<img src="${avatarUrl}" class="img-fluid rounded mb-3" style="max-height: 300px;" onerror="this.onerror=null; this.src='https://via.placeholder.com/200?text=Không+tải+được+ảnh'">
									<div class="small text-muted">${avatarUrl}</div>
								</div>
							`,
			showConfirmButton: true,
			showCancelButton: false,
			confirmButtonText: "Đóng",
			width: "90%",
		});
	} catch (e) {
		Swal.fire({
			title: "Lỗi",
			text: "URL không hợp lệ. Vui lòng kiểm tra lại.",
			icon: "error",
		});
	}
}

// Thêm sự kiện cho nút ẩn/hiện nhật ký
document.addEventListener("DOMContentLoaded", function () {
	const toggleLogBtn = document.getElementById("toggleLogBtn");
	const logContainer = document.getElementById("logContainer");
	const toggleIcon = toggleLogBtn.querySelector("i");

	toggleLogBtn.addEventListener("click", function () {
		logContainer.classList.toggle("hidden");
		if (logContainer.classList.contains("hidden")) {
			toggleIcon.className = "fas fa-eye";
			toggleLogBtn.innerHTML = '<i class="fas fa-eye"></i>';
		} else {
			toggleIcon.className = "fas fa-eye-slash";
			toggleLogBtn.innerHTML = '<i class="fas fa-eye-slash"></i>';
		}
	});

	// Ẩn log container mặc định
	logContainer.classList.add("hidden");
	toggleLogBtn.innerHTML = '<i class="fas fa-eye"></i>';
});

// Hàm khởi tạo dropdown template
function initTemplateDropdown() {
	// Khởi tạo cho tab văn bản
	const selectText = document.getElementById("templateSelect");
	// Khởi tạo cho tab file
	const selectFile = document.getElementById("templateSelectFile");

	// Hàm khởi tạo cho một select cụ thể
	function initSelect(select) {
		if (!select) return;

		// Xóa các option cũ (giữ lại option đầu tiên)
		while (select.options.length > 1) {
			select.remove(1);
		}

		// Thêm các option từ messageTemplates
		if (typeof messageTemplates === "object") {
			Object.entries(messageTemplates).forEach(([value, template]) => {
				if (template.name) {
					// Chỉ thêm nếu có tên hiển thị
					const option = new Option(template.name, value);
					select.add(option);
				}
			});
		}
	}

	// Khởi tạo cho cả hai select
	initSelect(selectText);
	initSelect(selectFile);
}

function createFormattingButtons(textareaId = "messageText") {
	const tabs = [
		{
			id: "format-tab",
			title: "Định dạng",
			buttons: [
				{ title: "In đậm", content: "B", prefix: "**", suffix: "**" },
				{ title: "In nghiêng", content: "I", prefix: "*", suffix: "*" },
				{ title: "Gạch dưới", content: "U̲", prefix: "__", suffix: "__" },
				{ title: "Gạch ngang", content: "S̶", prefix: "~~", suffix: "~~" },
				{ title: "Code", content: "`", prefix: "`", suffix: "`" },
				{ title: "Code Block", content: "```", prefix: "```", suffix: "```" },
				{ title: "Tiêu Đề", content: "##", prefix: "## ", suffix: "" },
				{ title: "In đậm + Gạch Dưới", content: "B + U̲", prefix: "__**", suffix: "**__" },
				{ title: "Thời gian", content: "Time", prefix: "", suffix: "${getCurrentTime()}" },
				{ title: "-", content: "--", prefix: "-----------------------------------------------------------------", suffix: "" },
				{ title: "=", content: "==", prefix: "==========================================", suffix: "" },
			],
		},
		{
			id: "emoji-tab",
			title: "Emoji",
			buttons: [
				{ title: "Thông báo", content: "🔔", prefix: "🔔", suffix: "" },
				{ title: "Hỏi, nghi vấn", content: "❓", prefix: "❓", suffix: "" },
				{ title: "Lỗi, cảnh báo", content: "⚠️", prefix: "⚠️", suffix: "" },
				{ title: "Nội Dung", content: "🆎", prefix: "🆎", suffix: "" },
				{ title: "ID Nhân Vật", content: "👤", prefix: "👤", suffix: "" },
				{ title: "Máy Chủ", content: "🖥️", prefix: "🖥️", suffix: "" },
				{ title: "Game", content: "🎮", prefix: "🎮", suffix: "" },
				{ title: "IP", content: "🌐", prefix: "🌐", suffix: "" },
				{ title: "Ý tưởng", content: "💡", prefix: "💡", suffix: "" },
				{ title: "Tin nhắn", content: "💬", prefix: "💬", suffix: "" },
				{ title: "Thông báo", content: "📢", prefix: "📢", suffix: "" },
				{ title: "Trạng thái", content: "🟢", prefix: "🟢", suffix: "" },
				{ title: "Đồng ý", content: "✅", prefix: "✅", suffix: "" },
				{ title: "Từ chối", content: "⛔️", prefix: "⛔️", suffix: "" },
				{ title: "Lý do", content: "🤔", prefix: "🤔", suffix: "" },
				{ title: "Chuyển hướng", content: "➡️", prefix: "➡️", suffix: "" },
				{ title: "Thời gian", content: "🕒", prefix: "🕒", suffix: "" },
				{ title: "Hỗ trợ", content: "🆘", prefix: "🆘", suffix: "" },
				{ title: "Hỏa", content: "🔥", prefix: "🔥", suffix: "" },
				{ title: "OK", content: "👌🏾", prefix: "👌🏾", suffix: "" },
			],
		},
		{
			id: "number-tab",
			title: "Số",
			buttons: [
				{ title: "Số 0", content: "0️⃣", prefix: "0️⃣", suffix: "" },
				{ title: "Số 1", content: "1️⃣", prefix: "1️⃣", suffix: "" },
				{ title: "Số 2", content: "2️⃣", prefix: "2️⃣", suffix: "" },
				{ title: "Số 3", content: "3️⃣", prefix: "3️⃣", suffix: "" },
				{ title: "Số 4", content: "4️⃣", prefix: "4️⃣", suffix: "" },
				{ title: "Số 5", content: "5️⃣", prefix: "5️⃣", suffix: "" },
				{ title: "Số 6", content: "6️⃣", prefix: "6️⃣", suffix: "" },
				{ title: "Số 7", content: "7️⃣", prefix: "7️⃣", suffix: "" },
				{ title: "Số 8", content: "8️⃣", prefix: "8️⃣", suffix: "" },
				{ title: "Số 9", content: "9️⃣", prefix: "9️⃣", suffix: "" },
				{ title: "Số 10", content: "🔟", prefix: "🔟", suffix: "" },
			],
		},
		{
			id: "mention-tab-1",
			title: "Tây Vực",
			buttons: [
				{ title: "Tag mọi người", content: "@everyone", prefix: "@everyone", suffix: "" },
				{ title: "Zz_NHD_zZ", content: "@Zz_NHD_zZ", prefix: "<@352800692362149889>", suffix: "" },
				{ title: "Manh", content: "@Manh", prefix: "<@419760576806518784>", suffix: "" },
				{ title: "Vu", content: "@Vu", prefix: "<@468411054616084490>", suffix: "" },
				{ title: "VNxWrist", content: "@VNxWrist", prefix: "<@1123545230143148113>", suffix: "" },
			],
		},
		{
			id: "mention-tab-2",
			title: "Xích Hỏa",
			buttons: [
				{ title: "Tag mọi người", content: "@everyone", prefix: "@everyone", suffix: "" },
				{ title: "Zz_NHD_zZ", content: "@Zz_NHD_zZ", prefix: "<@352800692362149889>", suffix: "" },
				{ title: "Ozin", content: "@Ozin", prefix: "<@739346682835370094>", suffix: "" },
				{ title: "Hương", content: "@Hương", prefix: "<@1085871904348438548>", suffix: "" },
			],
		},
	];

	// Tạo HTML cho các tab với Bootstrap
	let html = `
    <div class="emoji-tabs-container mb-3">
        <ul class="nav nav-tabs nav-fill" id="emojiTabs" role="tablist">
`;

	// Thêm các nút tab với Bootstrap
	tabs.forEach((tab, index) => {
		const activeClass = index === 0 ? "active" : "";
		const selected = index === 0 ? "true" : "false";
		html += `
            <li class="nav-item" role="presentation">
                <button 
                    class="nav-link ${activeClass} fw-bold" 
                    id="${tab.id}-tab" 
                    data-bs-toggle="tab" 
                    data-bs-target="#${tab.id}" 
                    type="button" 
                    role="tab" 
                    aria-controls="${tab.id}" 
                    aria-selected="${selected}"
                >
                    <span class="tab-icon">${getTabIcon(tab.id)}</span>
                    <span class="tab-title">${tab.title}</span>
                </button>
            </li>
`;
	});

	html += `
        </ul>
        <div class="tab-content p-2 border border-top-0 rounded-bottom" id="emojiTabsContent">
`;

	// Thêm nội dung cho từng tab
	tabs.forEach((tab, index) => {
		const activeClass = index === 0 ? "show active" : "";
		html += `
            <div 
                class="tab-pane fade ${activeClass}" 
                id="${tab.id}" 
                role="tabpanel" 
                aria-labelledby="${tab.id}-tab"
            >
`;
		// Chia các nút thành các dòng, mỗi dòng tối đa 10 nút cho máy tính và 5 nút cho điện thoại
		const buttonsPerRow = window.innerWidth > 768 ? 10 : 5;
		for (let i = 0; i < tab.buttons.length; i += buttonsPerRow) {
			const rowButtons = tab.buttons.slice(i, i + buttonsPerRow);
			html += `<div class="d-flex flex-wrap justify-content-center mb-1">`;
			rowButtons.forEach((btn) => {
				html += createEmojiButton(btn, textareaId);
			});
			html += `</div>`;
		}

		html += `</div>`;
	});

	html += `</div></div>`;
	return html;
}

// Hàm lấy icon cho từng tab
function getTabIcon(tabId) {
	const icons = {
		"format-tab": '<i class="fas fa-font me-1"></i>',
		"emoji-tab": '<i class="far fa-smile me-1"></i>',
		"number-tab": '<i class="fas fa-list-ol me-1"></i>',
		"mention-tab-1": '<img src="image/tayvuc.png" alt="Tây Vực" style="width: 16px; height: 16px; margin-right: 4px;">',
		"mention-tab-2": '<img src="image/xichhoa.png" alt="Xích Hỏa" style="width: 16px; height: 16px; margin-right: 4px;">',
	};
	return icons[tabId] || "";
}

// Hàm tạo nút emoji với Bootstrap
function createEmojiButton(btn, textareaId) {
	return `
            <button 
                type="button" 
                class="emoji-btn btn btn-sm m-1" 
                title="${btn.title}" 
                onclick="insertText('${btn.prefix}', '${btn.suffix}', '${textareaId}')"
                data-bs-toggle="tooltip" 
                data-bs-placement="top"
            >
                <span class="emoji-content">${btn.content}</span>
            </button>`;
}

// Khởi tạo tooltip
document.addEventListener("DOMContentLoaded", function () {
	var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
	var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
		return new bootstrap.Tooltip(tooltipTriggerEl);
	});
});
// Gọi hàm khởi tạo khi DOM đã tải xong
document.addEventListener("DOMContentLoaded", function () {
	initTemplateDropdown();
	// Tạo các nút định dạng cho cả hai tab
	document.getElementById("formattingButtons").innerHTML = createFormattingButtons("messageText");
	document.getElementById("fileFormattingButtons").innerHTML = createFormattingButtons("fileMessageText");
});

// Hàm lưu bản nháp lên Firebase
async function saveDraft(textareaId = "messageText") {
	try {
		const messageText = document.getElementById(textareaId).value;
		if (!messageText.trim()) {
			showSuccessMessage("Không có nội dung để lưu");
			return;
		}

		const user = firebase.auth().currentUser;
		if (!user) {
			throw new Error("Vui lòng đăng nhập để sử dụng tính năng lưu bản nháp");
		}

		const draftData = {
			content: messageText,
			lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
			userId: user.uid,
		};

		await firebase.firestore().collection("drafts").doc(user.uid).set(draftData);
		showSuccessMessage("Đã lưu bản nháp thành công");
	} catch (error) {
		console.error("Lỗi khi lưu bản nháp:", error);
		Swal.fire({
			icon: "error",
			title: "Lỗi",
			text: "Không thể lưu bản nháp: " + error.message,
		});
	}
}

// Hàm tải bản nháp từ Firebase
async function loadDraft(textareaId = "messageText") {
	try {
		const user = firebase.auth().currentUser;
		if (!user) {
			throw new Error("Vui lòng đăng nhập để tải bản nháp");
		}

		const doc = await firebase.firestore().collection("drafts").doc(user.uid).get();

		if (!doc.exists) {
			showSuccessMessage("Không tìm thấy bản nháp nào");
			return;
		}

		const draftData = doc.data();
		document.getElementById(textareaId).value = draftData.content;
		showSuccessMessage("Đã tải bản nháp thành công");
	} catch (error) {
		console.error("Lỗi khi tải bản nháp:", error);
		Swal.fire({
			icon: "error",
			title: "Lỗi",
			text: "Không thể tải bản nháp: " + error.message,
		});
	}
}

function updateFileList(input) {
	const fileList = document.getElementById("fileList");

	if (input.files.length > 0) {
		let html = '<div class="list-group">';
		for (let i = 0; i < input.files.length; i++) {
			const file = input.files[i];
			const fileSize = (file.size / (1024 * 1024)).toFixed(2); // Chuyển sang MB
			html += `
                <div class="list-group-item list-group-item-action d-flex justify-content-between align-items-center">
                    <div class="text-truncate" style="max-width: 70%;" title="${file.name}">
                        <i class="far fa-file me-2"></i>${file.name}
                    </div>
                    <span class="badge bg-secondary rounded-pill">${fileSize} MB</span>
                </div>
            `;
		}
		html += "</div>";
		fileList.innerHTML = html;
	} else {
		fileList.innerHTML = "Chưa có file nào được chọn";
	}
}
