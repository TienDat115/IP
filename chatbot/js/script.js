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
			loadRecentWebhooks();
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
		const dropdownBtn = document.getElementById("webhookDropdownBtn");
		const dropdownText = document.getElementById("webhookDropdownText");
		const dropdownMenu = document.getElementById("webhookDropdownMenu");

		webhookSelect.innerHTML = '<option value="">Đang tải danh sách webhook...</option>';
		dropdownText.textContent = "Đang tải danh sách webhook...";

		// Lấy danh sách webhook từ collection 'webhooks'
		const webhooksRef = db.collection("webhooks");
		const snapshot = await webhooksRef.get();

		if (snapshot.empty) {
			webhookSelect.innerHTML = '<option value="">Không có webhook nào</option>';
			dropdownText.textContent = "Không có webhook nào";
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
		const visibleWebhooks = webhooks.filter((w) => w.visible !== false);
		if (visibleWebhooks.length === 0) {
			webhookSelect.innerHTML = '<option value="">Không có webhook nào</option>';
			dropdownText.textContent = "Không có webhook nào";
			return;
		}
		const groupedWebhooks = {};
		visibleWebhooks.forEach((webhook) => {
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
		dropdownMenu.innerHTML = "";

		// Thêm option mặc định & item mặc định
		const defaultOption = document.createElement("option");
		defaultOption.value = "";
		defaultOption.textContent = "Chọn webhook...";
		webhookSelect.appendChild(defaultOption);

		const defaultItem = document.createElement("div");
		defaultItem.className = "webhook-dropdown-item";
		defaultItem.dataset.value = "";
		defaultItem.textContent = "Chọn webhook...";
		defaultItem.addEventListener("click", function (e) {
			e.stopPropagation();
			selectWebhookItem("", "Chọn webhook...");
		});
		dropdownMenu.appendChild(defaultItem);

		// Thêm các webhook đã nhóm vào select và custom dropdown
		sortedGroups.forEach((group) => {
			// 1. Populate hidden select (giữ tương thích)
			const groupElement = document.createElement("optgroup");
			groupElement.label = group;
			webhookSelect.appendChild(groupElement);

			// 2. Populate custom dropdown
			const groupLabel = document.createElement("div");
			groupLabel.className = "webhook-dropdown-group-label";
			groupLabel.textContent = group;
			dropdownMenu.appendChild(groupLabel);

			// Thêm các webhook trong nhóm
			groupedWebhooks[group].forEach((webhook) => {
				const option = document.createElement("option");
				option.value = webhook.id;
				option.textContent = webhook.name || `Webhook ${webhook.id}`;
				groupElement.appendChild(option);

				const item = document.createElement("div");
				item.className = "webhook-dropdown-item";
				item.dataset.value = webhook.id;
				item.textContent = webhook.name || `Webhook ${webhook.id}`;
				item.addEventListener("click", function (e) {
					e.stopPropagation();
					selectWebhookItem(webhook.id, webhook.name || `Webhook ${webhook.id}`);
				});
				dropdownMenu.appendChild(item);
			});
		});

		// Bật select và custom dropdown sau khi tải xong
		webhookSelect.disabled = false;
		dropdownBtn.disabled = false;
		dropdownText.textContent = "Chọn webhook...";
		updateRecentBtnState();
	} catch (error) {
		console.error("Lỗi khi tải danh sách webhook:", error);
		const webhookSelect = document.getElementById("webhookSelect");
		const dropdownText = document.getElementById("webhookDropdownText");
		const dropdownBtn = document.getElementById("webhookDropdownBtn");
		webhookSelect.innerHTML = '<option value="">Lỗi khi tải danh sách webhook</option>';
		dropdownText.textContent = "Lỗi khi tải danh sách webhook";
		webhookSelect.disabled = true;
		if (dropdownBtn) dropdownBtn.disabled = true;
		Swal.fire({
			icon: "error",
			title: "Lỗi!",
			text: "Lỗi khi tải danh sách webhook: " + error.message,
			confirmButtonText: "OK",
		});
	}
}

// Chọn webhook từ custom dropdown
function selectWebhookItem(id, name) {
	const webhookSelect = document.getElementById("webhookSelect");
	const dropdownBtn = document.getElementById("webhookDropdownBtn");
	const dropdownText = document.getElementById("webhookDropdownText");
	const dropdownMenu = document.getElementById("webhookDropdownMenu");

	// Cập nhật hidden select
	webhookSelect.value = id;

	// Cập nhật text hiển thị
	dropdownText.textContent = name || "Chọn webhook...";

	// Đánh dấu item được chọn
	dropdownMenu.querySelectorAll(".webhook-dropdown-item").forEach((item) => {
		item.classList.toggle("selected", item.dataset.value === id);
	});

	// Đóng menu
	closeWebhookDropdown();

	// Dispatch sự kiện change để trigger các hàm phụ thuộc
	webhookSelect.dispatchEvent(new Event("change", { bubbles: true }));
}

// Recent webhooks tracking
let recentWebhooksCache = [];

async function loadRecentWebhooks() {
	try {
		const user = auth.currentUser;
		if (!user) return;
		const doc = await db.collection('recentWebhooks').doc(user.uid).get();
		recentWebhooksCache = doc.exists && doc.data().items ? doc.data().items : [];
	} catch (e) {
		console.warn('Lỗi tải webhook gần đây:', e);
		recentWebhooksCache = [];
	}
	updateRecentBtnState();
}

function updateRecentBtnState() {
	const recentBtn = document.getElementById('recentWebhookBtn');
	if (recentBtn) recentBtn.disabled = recentWebhooksCache.length === 0;
}

async function addRecentWebhook(id, name) {
	try {
		const user = auth.currentUser;
		if (!user) return;
		const ts = firebase.firestore.Timestamp.now();
		let items = recentWebhooksCache.filter(w => w.id !== id);
		items.unshift({ id, name: name || `Webhook ${id}`, timestamp: ts });
		if (items.length > 10) items = items.slice(0, 10);
		await db.collection('recentWebhooks').doc(user.uid).set({ items }, { merge: true });
		recentWebhooksCache = items;
		updateRecentBtnState();
	} catch (e) {
		console.warn('Lỗi lưu webhook gần đây:', e);
	}
}

function renderRecentWebhookItems(recent) {
	return recent.map((w, i) => `
		<button type="button" class="list-group-item list-group-item-action d-flex align-items-center gap-2 border-0 ${i === 0 ? 'active' : ''}" 
				onclick="selectRecentWebhook('${w.id}', '${(w.name || '').replace(/'/g, "\\'")}')" 
				style="cursor:pointer; padding: 10px 14px; border-radius: 6px; text-align: left; width: 100%; background: ${i === 0 ? '#5865f2' : 'transparent'}; color: ${i === 0 ? '#fff' : '#212529'}; transition: background 0.15s;">
			<i class="fas fa-clock" style="${i === 0 ? 'color: #fff' : 'color: #6c757d'}; width: 18px;"></i>
			<span style="flex: 1;">${w.name || 'Webhook ' + w.id}</span>
			<small style="color: ${i === 0 ? 'rgba(255,255,255,0.7)' : '#999'}; font-size: 11px;">${formatRelativeTime(w.timestamp)}</small>
		</button>
	`).join('');
}

async function showRecentWebhooks() {
	if (recentWebhooksCache.length === 0) {
		await loadRecentWebhooks();
	}
	if (recentWebhooksCache.length === 0) {
		Swal.fire({
			icon: 'info',
			title: 'Chưa có webhook gần đây',
			text: 'Gửi tin nhắn để lưu webhook vào danh sách gần đây.',
			confirmButtonText: 'OK',
		});
		return;
	}

	const items = renderRecentWebhookItems(recentWebhooksCache);

	Swal.fire({
		title: 'Webhook gần đây',
		html: `<div style="display: flex; flex-direction: column; gap: 4px;">${items}</div>`,
		showConfirmButton: false,
		showCancelButton: true,
		cancelButtonText: 'Đóng',
		cancelButtonColor: '#6c757d',
	});
}

function selectRecentWebhook(id, name) {
	Swal.close();
	selectWebhookItem(id, name || `Webhook ${id}`);
}

function formatRelativeTime(timestamp) {
	const ts = timestamp?.toDate ? timestamp.toDate().getTime() : (typeof timestamp === 'number' ? timestamp : timestamp?.seconds * 1000 || Date.now());
	const diff = Date.now() - ts;
	const mins = Math.floor(diff / 60000);
	if (mins < 1) return 'Vừa xong';
	if (mins < 60) return `${mins} phút trước`;
	const hours = Math.floor(mins / 60);
	if (hours < 24) return `${hours} giờ trước`;
	const days = Math.floor(hours / 24);
	return `${days} ngày trước`;
}

// Mở/đóng custom dropdown
function toggleWebhookDropdown() {
	const dropdownMenu = document.getElementById("webhookDropdownMenu");
	const dropdownBtn = document.getElementById("webhookDropdownBtn");
	if (!dropdownMenu || dropdownBtn.disabled) return;
	const isOpen = dropdownMenu.classList.contains("open");
	if (isOpen) {
		closeWebhookDropdown();
	} else {
		openWebhookDropdown();
	}
}

function openWebhookDropdown() {
	const dropdownMenu = document.getElementById("webhookDropdownMenu");
	const dropdownBtn = document.getElementById("webhookDropdownBtn");
	if (!dropdownMenu || !dropdownBtn) return;
	dropdownMenu.classList.add("open");
	dropdownBtn.classList.add("open");
}

function closeWebhookDropdown() {
	const dropdownMenu = document.getElementById("webhookDropdownMenu");
	const dropdownBtn = document.getElementById("webhookDropdownBtn");
	if (!dropdownMenu || !dropdownBtn) return;
	dropdownMenu.classList.remove("open");
	dropdownBtn.classList.remove("open");
}

// Đóng dropdown khi click bên ngoài
document.addEventListener("DOMContentLoaded", function () {
	document.addEventListener("click", function (e) {
		const dropdown = document.getElementById("customWebhookDropdown");
		const menu = document.getElementById("webhookDropdownMenu");
		if (dropdown && menu && !dropdown.contains(e.target) && menu.classList.contains("open")) {
			closeWebhookDropdown();
		}
	});
});

// Hàm lấy webhook URLs từ Firebase
async function getWebhookUrls() {
	try {
		const webhooks = {};
		const querySnapshot = await db.collection("webhooks").get();
		querySnapshot.forEach((doc) => {
			const data = doc.data();
			if (data.visible !== false) {
				webhooks[data.id] = data.url;
			}
		});
		return webhooks;
	} catch (error) {
		console.error("Lỗi khi lấy webhooks:", error);
		return {};
	}
}



// Hàm thêm log vào Firebase
async function addLogToFirebase(message, text, webhookName, webhookUrl, isError = false) {
	if (webhookName === "TEST") return;
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

// Gửi tin nhắn (văn bản và/hoặc file)
async function sendMessage() {
	const webhooks = await getWebhookUrls();
	const webhookSelect = document.getElementById("webhookSelect");
	const selectedWebhookId = webhookSelect.value;
	const webhookUrl = webhooks[selectedWebhookId];
	const webhookName = webhookSelect.options[webhookSelect.selectedIndex].text;
	const message = document.getElementById("messageText").value;
	const username = document.getElementById("customUsername").value;
	const avatarUrl = document.getElementById("avatarUrl").value;
	const tts = document.getElementById("tts").checked;
	const fileInput = document.getElementById("fileInput");
	const files = fileInput.files;

	// Kiểm tra xem có nội dung nào để gửi không
	if (!message.trim() && files.length === 0) {
		Swal.fire({
			icon: "error",
			title: "Lỗi!",
			text: "Vui lòng nhập nội dung tin nhắn hoặc chọn file đính kèm",
			confirmButtonText: "OK",
		});
		return;
	}

	try {
		// Nếu có file đính kèm, gửi dạng FormData
		if (files.length > 0) {
			const formData = new FormData();
			if (message) formData.append("content", evaluateExpressions(message));
			if (username) formData.append("username", username);
			if (avatarUrl) formData.append("avatar_url", avatarUrl);
			if (tts) formData.append("tts", "true");

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
				const messageText = message ? evaluateExpressions(message) : "";
				addLogToFirebase(`✅ Đã gửi tin nhắn với ${sentFilesCount} file thành công!`, messageText, webhookName, webhookUrl);
				addRecentWebhook(selectedWebhookId, webhookName);

				await Swal.fire({
					icon: "success",
					title: "Thành công!",
					text: `Bạn đã gửi tin nhắn với ${sentFilesCount} file thành công.`,
					showConfirmButton: true,
				});

				// Hỏi người dùng có muốn xóa file sau khi gửi không
				Swal.fire({
					title: 'Xóa file sau khi gửi?',
					text: 'Bạn có muốn xóa các file đã gửi khỏi danh sách không?',
					icon: 'question',
					showCancelButton: true,
					confirmButtonText: 'Xóa file',
					cancelButtonText: 'Giữ lại file',
					confirmButtonColor: '#d33',
					cancelButtonColor: '#3085d6'
				}).then((result) => {
					if (result.isConfirmed) {
						// Xóa file đã chọn
						fileInput.value = "";
						updateFileList(fileInput);
					}
				});
			} else {
				const error = await response.json();
				throw new Error(error.message || "Không thể gửi file");
			}
		} else {
			// Chỉ gửi tin nhắn văn bản
			const evaluatedMessage = evaluateExpressions(message);

			// Chia nhỏ tin nhắn nếu quá dài (1900 ký tự để đảm bảo an toàn)
			const maxLength = 1900;
			const messageChunks = [];

			// Hàm tìm vị trí cắt phù hợp
			const findBestSplitPoint = (str, maxPos) => {
				// Ưu tiên cắt tại dấu xuống dòng
				let splitPos = str.lastIndexOf('\n', maxPos);

				// Nếu không tìm thấy, cắt tại dấu cách gần nhất
				if (splitPos === -1) {
					splitPos = str.lastIndexOf(' ', maxPos);
				}

				// Nếu vẫn không tìm thấy, cắt tại maxPos
				return splitPos === -1 ? maxPos : splitPos;
			};

			let remainingText = evaluatedMessage;
			while (remainingText.length > 0) {
				if (remainingText.length <= maxLength) {
					messageChunks.push(remainingText);
					break;
				}

				const splitPos = findBestSplitPoint(remainingText, maxLength);
				const chunk = remainingText.substring(0, splitPos);
				messageChunks.push(chunk);
				remainingText = remainingText.substring(splitPos).trim();
			}

			// Gửi từng phần tin nhắn
			for (let i = 0; i < messageChunks.length; i++) {
				const payload = {
					content: messageChunks[i],
					username: username || undefined,
					avatar_url: avatarUrl || undefined,
					tts: tts,
				};

				const response = await fetch(webhookUrl, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify(payload),
				});

				if (!response.ok) {
					const error = await response.json();
					throw new Error(error.message || "Không thể gửi tin nhắn");
				}

				// Đợi một chút giữa các tin nhắn để tránh rate limit
				if (i < messageChunks.length - 1) {
					await new Promise(resolve => setTimeout(resolve, 1000));
				}
			}

			addLogToFirebase(`✅ Đã gửi tin nhắn thành công!`, evaluatedMessage, webhookName, webhookUrl);
			addRecentWebhook(selectedWebhookId, webhookName);

			await Swal.fire({
				icon: "success",
				title: "Thành công!",
				text: messageChunks.length > 1 
					? `Đã gửi tin nhắn thành công (đã chia thành ${messageChunks.length} phần).`
					: "Đã gửi tin nhắn thành công!",
				showConfirmButton: true,
			});
		}

	} catch (error) {
		console.error("Lỗi khi gửi tin nhắn:", error);
		addLogToFirebase(`❌ Lỗi khi gửi tin nhắn: ${error.message}`, message, webhookName, webhookUrl, true);

		Swal.fire({
			icon: "error",
			title: "Lỗi!",
			text: `Không thể gửi tin nhắn: ${error.message}`,
			confirmButtonText: "OK",
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
			addLogToFirebase("✅ Đã gửi tin nhúng thành công!", "", webhookName, webhookUrl);
			addRecentWebhook(selectedWebhookId, webhookName);
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
			addLogToFirebase(`❌ Lỗi khi gửi tin nhúng: ${error}`, "", webhookName, webhookUrl, true);

			await Swal.fire({
				icon: "error",
				title: "Lỗi!",
				text: "Đã xảy ra lỗi khi gửi tin nhúng: " + error.message,
			});
		}
	} catch (error) {
		addLogToFirebase(`❌ Lỗi kết nối: ${error.message}`, "", webhookName, webhookUrl, true);

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
		content: `## ❓ THÔNG BÁO ❓
		🆎 Nội Dung: Rollback thất bại
		💳 Tài Khoản: 
		👤 ID Nhân Vật: 
		🖥️ Máy Chủ: Võ Lâm Tây Vực - 
		⚠️ Lý Do: 
		🕙 Thời gian: \${getCurrentTime()}
		Vui lòng kiểm tra lại thông tin !
		@everyone
		-----------------------------------------------------------------`,
	},

	2: {
		name: "Phản Hồi Thông Tin",
		content: `## 🔔 THÔNG BÁO 🔔
		📢 __**Nội Dung:**__ 
		💡 __**Phản Hồi:**__
		🕙 __**Thời gian:**__ \${getCurrentTime()}
		@everyone
		-----------------------------------------------------------------`,
	},

	3: {
		name: "Thắc Mắc",
		content: `## ❓ CUNG CẤP THÔNG TIN ❓
		📢 __**Nội Dung:**__ 
		⚠️ __**Phản Hồi:**__
		🕙 __**Thời gian:**__ \${getCurrentTime()}
		@everyone
		-----------------------------------------------------------------`,
	},

	4: {
		name: "Cảnh Báo",
		content: `## ⚠️ CẢNH BÁO ⚠️
		📢 __**Nội Dung:**__ 
		🕙 __**Thời gian:**__ \${getCurrentTime()}
		@everyone
		-----------------------------------------------------------------`,
	},

	5: {
		name: "Reset Tiêu Phí Tháng",
		content: `## 🔔 THÔNG BÁO 🔔
		📢 __**Nội Dung:**__ Reset tiêu phí tháng tk **** hoàn tất
		🕙 __**Thời gian:**__ \${getCurrentTime()}
		@everyone
		-----------------------------------------------------------------`,
	},

	6: {
		name: "Reset Huyền Thông",
		content: `## 🔔 THÔNG BÁO 🔔
		📢 __**Nội Dung:**__ Reset điểm Huyền Thông về 0 ID **** hoàn tất
		🕙 __**Thời gian:**__ \${getCurrentTime()}
		@everyone
		-----------------------------------------------------------------`,
	},

	7: {
		name: "Sửa lỗi Phi Phong",
		content: `## 🔔 THÔNG BÁO 🔔
		📢 __**Nội Dung:**__ Sửa lỗi xác nhận kết quả phi phong ID **** hoàn tất
		🕙 __**Thời gian:**__ \${getCurrentTime()}
		@everyone
		-----------------------------------------------------------------`,
	},

	8: {
		name: "Chặn IP",
		content: `## 🔔 THÔNG BÁO 🔔
		📢 __**Nội Dung:**__ Chặn IP tk **** (Lúc **** đăng nhập S5: ****) hoàn tất
		🕙 __**Thời gian:**__ \${getCurrentTime()}
		@everyone
		-----------------------------------------------------------------`,
	},

	9: {
		name: "Bổ Sung Nội Dung File",
		content: `# Mọi Thay Đổi Sẽ Thực Hiện Dựa Trên Bản Võ Lâm Hồng Kông

## ** 📄 Ngoại vực VLHS.txt**
@everyone
-----------------------------------------------------------------
# ⚠️ VUI LÒNG TRẢ LỜI CÁC THẮC MẮC VÀ SỬA GỬI LẠI FILE ĐẦY ĐỦ NỘI DUNG (KHÔNG GỬI FILE CHỈ TRẢ LỜI CÁC CÂU HỎI)`,
	},

	10: {
		name: "Cập Nhật File Hoàn Tất",
		content: `## 🔔 THÔNG BÁO 🔔
		📢 __**Nội Dung:**__ Cập nhật hoàn tất nội dung file **___**. Vui lòng kiểm tra lại
		🕙 __**Thời gian:**__ \${getCurrentTime()}
		@everyone
		-----------------------------------------------------------------`,
	},

	11: {
		name: "Đổi Nhân Vật Chính",
		content: `## 🔔 THÔNG BÁO 🔔
		📢 __**Nội Dung:**__ 

		💡 __**Phản Hồi:**__ Đổi nhân vật chính và cho phép mua lại gói tuần + Reset Tiêu Phí tháng hoàn tất
		🕙 __**Thời gian:**__ \${getCurrentTime()}
		@everyone
		-----------------------------------------------------------------`,
	},

	12: {
		name: "Thêm Gói Quà Event",
		content: `## 🔔 THÔNG BÁO 🔔
		📢 __**Nội Dung:**__ Thêm gói **** hoàn tất. Vui lòng kiểm tra lại
		🕙 __**Thời gian:**__ \${getCurrentTime()}
		@everyone
		-----------------------------------------------------------------`,
	},

	13: {
		name: "Lệnh Không Hỗ Trợ",
		content: `🚫 Lệnh không được hỗ trợ hoặc chưa được kích hoạt tại nhóm này.`,
	},

	14: {
		name: "Bổ Sung Thông Tin",
		content: `# ⚠️ VUI LÒNG TRẢ LỜI CÁC THẮC MẮC VÀ SỬA GỬI LẠI FILE ĐẦY ĐỦ NỘI DUNG (KHÔNG GỬI FILE CHỈ TRẢ LỜI CÁC CÂU HỎI)`,
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
		// Xử lý phím tắt Ctrl + D để nhân đôi dòng hoặc văn bản được chọn
		if (e.ctrlKey && e.key === "d") {
			e.preventDefault();

			const textarea = e.target;
			const start = textarea.selectionStart;
			const end = textarea.selectionEnd;
			const text = textarea.value;
			const scrollTop = textarea.scrollTop;

			textarea.focus();

			try {
				if (start !== end) {
					// Lấy văn bản được chọn
					const selectedText = text.substring(start, end);

					// Tạo nội dung mới
					const newText = text.substring(0, end) + selectedText + text.substring(end);

					// Cập nhật giá trị textarea
					textarea.value = newText;

					// Cập nhật vị trí chọn
					setTimeout(() => {
						textarea.setSelectionRange(end, end + selectedText.length);
					}, 0);
				} else {
					// Phần xử lý nhân đôi dòng giữ nguyên
					const lineStart = text.lastIndexOf("\n", start - 1) + 1;
					const lineEnd = text.indexOf("\n", end);
					const currentLine = text.substring(lineStart, lineEnd === -1 ? text.length : lineEnd);
					const newText = text.substring(0, lineEnd === -1 ? text.length : lineEnd) + "\n" + currentLine + (lineEnd === -1 ? "" : text.substring(lineEnd));

					textarea.value = newText;
				}
			} catch (err) {
				console.error("Lỗi khi xử lý nhân đôi dòng:", err);
			}

			// Khôi phục vị trí scroll
			textarea.scrollTop = scrollTop;
		}
		// Xử lý phím Enter + Ctrl để gửi tin nhắn (giữ nguyên)
		else if (e.key === "Enter" && e.ctrlKey) {
			e.preventDefault();
			sendMessage();
		}
		// Xử lý phím tắt Ctrl + S để lưu bản nháp
		else if ((e.ctrlKey || e.metaKey) && e.key === "s") {
			e.preventDefault();
			const textarea = e.target;
			saveDraft(textarea.id);
		}
	});

	// Xử lý sự kiện thay đổi màu
	document.getElementById("embedColorPicker").addEventListener("change", function () {
		const color = this.value.substring(1); // Loại bỏ ký tự #
		document.getElementById("embedColor").value = color.toUpperCase();
	});
});

async function scheduleMessage(type = "message") {
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
	if (type === "embed") messageType = "tin nhúng";

	const { isConfirmed } = await Swal.fire({
		title: "Xác nhận hẹn giờ",
		html: `Bạn có chắc muốn gửi ${messageType} sau <b>${minutesNum} phút</b>?<br>(Lúc ${scheduledTime.getHours()}:${scheduledTime.getMinutes().toString().padStart(2, "0")})`,
		icon: "question",
		showCancelButton: true,
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
					if (type === "embed") {
						sendEmbedMessage();
					} else {
						sendMessage();
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
			showConfirmButton: false,
			showCloseButton: false,
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
	// Hàm xử lý định dạng văn bản
	const formatText = (prefix, suffix) => {
		const textarea = document.getElementById(textareaId);
		if (!textarea) return;

		const start = textarea.selectionStart;
		const end = textarea.selectionEnd;
		const selectedText = textarea.value.substring(start, end);
		const beforeText = textarea.value.substring(0, start);
		const afterText = textarea.value.substring(end);
		
		if (selectedText) {
			// Nếu có văn bản được chọn, bọc nó bằng prefix và suffix
			const newText = beforeText + prefix + selectedText + suffix + afterText;
			textarea.value = newText;
			// Di chuyển con trỏ đến sau phần vừa chèn
			setTimeout(() => {
				textarea.setSelectionRange(start + prefix.length, end + prefix.length);
			}, 0);
		} else {
			// Nếu không có văn bản nào được chọn, chèn và đặt con trỏ ở giữa
			const newText = beforeText + prefix + suffix + afterText;
			textarea.value = newText;
			setTimeout(() => {
				textarea.setSelectionRange(start + prefix.length, start + prefix.length);
			}, 0);
		}
		
		// Kích hoạt sự kiện input để cập nhật giao diện
		const event = new Event('input', { bubbles: true });
		textarea.dispatchEvent(event);
	};

	// Thêm sự kiện bàn phím cho các phím tắt
	document.addEventListener('keydown', function(e) {
		if (e.ctrlKey || e.metaKey) {
			switch(e.key.toLowerCase()) {
				case 'b':
					e.preventDefault();
					formatText('**', '**');
					break;
				case 'i':
					e.preventDefault();
					formatText('*', '*');
					break;
				case 'u':
					e.preventDefault();
					formatText('__', '__');
					break;
			}
		}
	});

	const tabs = [
		{
			id: "format-tab",
			title: "Định dạng",
			buttons: [
				{ title: "In đậm (Ctrl+B)", content: "B", prefix: "**", suffix: "**" },
				{ title: "In nghiêng (Ctrl+I)", content: "I", prefix: "*", suffix: "*" },
				{ title: "Gạch dưới (Ctrl+U)", content: "U̲", prefix: "__", suffix: "__" },
				{ title: "Gạch ngang", content: "S̶", prefix: "~~", suffix: "~~" },
				{ title: "Code", content: "`", prefix: "`", suffix: "`" },
				{ title: "Code Block", content: "```", prefix: "```", suffix: "```" },
				{ title: "Tiêu Đề", content: "##", prefix: "## ", suffix: "" },
				{ title: "In đậm + Gạch Dưới", content: "B + U̲", prefix: "__**", suffix: "**__" },
				{ title: "Thời gian", content: "Time", prefix: "", suffix: "${getCurrentTime()}" },
				{ title: "*", content: "**", prefix: "*****************************************************************", suffix: "" },
				{ title: "-", content: "--", prefix: "-----------------------------------------------------------------", suffix: "" },
				{ title: "=", content: "==", prefix: "==========================================", suffix: "" },
			],
		},
		{
			id: "emoji-tab",
			title: "Emoji",
			buttons: [
				{ title: "Text File", content: "📄", prefix: " 📄", suffix: "" },
				{ title: "Excel File", content: "📊", prefix: " 📊", suffix: "" },
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
				{ title: "Manh", content: "@__Mạnh__", prefix: "<@419760576806518784>", suffix: "" },
				{ title: "Cảo", content: "@CảoNgoanHiền(Hưng)", prefix: "<@403869958293028864>", suffix: "" },
				{ title: "VNxWrist", content: "@VNxWrist", prefix: "<@1123545230143148113>", suffix: "" },
			],
		},
		{
			id: "mention-tab-3",
			title: "Ngạo Thế",
			buttons: [
				{ title: "Tag mọi người", content: "@everyone", prefix: "@everyone", suffix: "" },
				{ title: "Zz_NHD_zZ", content: "@Zz_NHD_zZ", prefix: "<@352800692362149889>", suffix: "" },
				{ title: "Hiên Hiên", content: "@Hiên Hiên", prefix: "<@1001068253713551361>", suffix: "" },
				{ title: "Qìn Qìn", content: "@Qìn Qìn", prefix: "<@1263829456242475020>", suffix: "" },
				{ title: "Diện Diện", content: "@Diện Diện", prefix: "<@1051780994203656202>", suffix: "" },
				{ title: "Nhung Nhung", content: "@Nhung Nhung", prefix: "<@784708484275896320>", suffix: "" },
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
		"mention-tab-3": '<img src="image/ngaothe.png" alt="Ngạo Thế" style="width: 16px; height: 16px; margin-right: 4px;">',
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
	// Tạo các nút định dạng cho tab tin nhắn
	document.getElementById("formattingButtons").innerHTML = createFormattingButtons("messageText");
});

// Hàm lưu bản nháp lên Firebase (hỗ trợ nhiều bản nháp)
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

		const snapshot = await firebase.firestore()
			.collection("drafts").doc(user.uid).collection("items")
			.orderBy("lastUpdated", "desc")
			.get();

		if (snapshot.empty) {
			const { value: draftName } = await Swal.fire({
				title: 'Lưu bản nháp',
				input: 'text',
				inputLabel: 'Nhập tên cho bản nháp',
				inputPlaceholder: 'VD: Tin nhắn rollback...',
				showCancelButton: true,
				confirmButtonText: 'Lưu',
				cancelButtonText: 'Hủy',
				inputValidator: (value) => {
					if (!value) return 'Vui lòng nhập tên bản nháp';
				}
			});

			if (!draftName) return;

			await firebase.firestore().collection("drafts").doc(user.uid).collection("items").add({
				name: draftName,
				content: messageText,
				lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
				userId: user.uid,
			});

			showSuccessMessage("Đã lưu bản nháp thành công");
		} else {
			const choice = await Swal.fire({
				title: 'Lưu bản nháp',
				text: 'Bạn muốn lưu thành bản nháp mới hay ghi đè bản nháp cũ?',
				icon: 'question',
				showCancelButton: true,
				confirmButtonText: 'Lưu mới',
				cancelButtonText: 'Hủy',
				showDenyButton: true,
				denyButtonText: 'Ghi đè',
				denyButtonColor: '#dc3545',
			});

			if (choice.isDismissed) return;

			if (choice.isConfirmed) {
				const { value: draftName } = await Swal.fire({
					title: 'Lưu bản nháp mới',
					input: 'text',
					inputLabel: 'Nhập tên cho bản nháp',
					inputPlaceholder: 'VD: Tin nhắn rollback...',
					showCancelButton: true,
					confirmButtonText: 'Lưu',
					cancelButtonText: 'Hủy',
					inputValidator: (value) => {
						if (!value) return 'Vui lòng nhập tên bản nháp';
					}
				});

				if (!draftName) return;

				await firebase.firestore().collection("drafts").doc(user.uid).collection("items").add({
					name: draftName,
					content: messageText,
					lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
					userId: user.uid,
				});

				showSuccessMessage("Đã lưu bản nháp mới thành công");
			} else if (choice.isDenied) {
				const drafts = [];
				snapshot.forEach(doc => {
					drafts.push({ id: doc.id, ...doc.data() });
				});

				const itemsHtml = drafts.map(draft => `
					<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
						<button type="button" class="btn btn-outline-primary"
							onclick="overwriteDraft('${draft.id}', '${textareaId}')"
							style="flex: 1; text-align: left; padding: 10px 14px; border-radius: 6px; cursor: pointer;">
							<div style="font-weight: 600;">${draft.name || 'Bản nháp'}</div>
							<div style="font-size: 12px; color: #6c757d; margin-top: 4px;">${draft.lastUpdated?.toDate ? formatRelativeTime(draft.lastUpdated) : ''}</div>
						</button>
					</div>
				`).join('');

				await Swal.fire({
					title: 'Chọn bản nháp để ghi đè',
					html: `<div style="max-height: 400px; overflow-y: auto;">${itemsHtml}</div>`,
					showConfirmButton: false,
					showCancelButton: true,
					cancelButtonText: 'Đóng',
					cancelButtonColor: '#6c757d',
				});
			}
		}
	} catch (error) {
		console.error("Lỗi khi lưu bản nháp:", error);
		Swal.fire({
			icon: "error",
			title: "Lỗi",
			text: "Không thể lưu bản nháp: " + error.message,
		});
	}
}

async function overwriteDraft(draftId, textareaId = "messageText") {
	try {
		const user = firebase.auth().currentUser;
		if (!user) return;

		const messageText = document.getElementById(textareaId).value;
		if (!messageText.trim()) {
			showSuccessMessage("Không có nội dung để ghi đè");
			return;
		}

		Swal.close();
		await firebase.firestore()
			.collection("drafts").doc(user.uid).collection("items").doc(draftId)
			.update({
				content: messageText,
				lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
			});

		showSuccessMessage("Đã ghi đè bản nháp thành công");
	} catch (error) {
		console.error("Lỗi khi ghi đè bản nháp:", error);
		Swal.fire({
			icon: "error",
			title: "Lỗi",
			text: "Không thể ghi đè bản nháp: " + error.message,
		});
	}
}

// Hàm tải danh sách bản nháp từ Firebase (hiển thị để chọn)
async function loadDraft(textareaId = "messageText") {
	try {
		const user = firebase.auth().currentUser;
		if (!user) {
			throw new Error("Vui lòng đăng nhập để tải bản nháp");
		}

		const snapshot = await firebase.firestore()
			.collection("drafts").doc(user.uid).collection("items")
			.orderBy("lastUpdated", "desc")
			.get();

		if (snapshot.empty) {
			showSuccessMessage("Không tìm thấy bản nháp nào");
			return;
		}

		const drafts = [];
		snapshot.forEach(doc => {
			drafts.push({ id: doc.id, ...doc.data() });
		});

		const itemsHtml = drafts.map(draft => `
			<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
				<button type="button" class="btn btn-outline-primary"
					onclick="selectDraft('${draft.id}', '${textareaId}')"
					style="flex: 1; text-align: left; padding: 10px 14px; border-radius: 6px; cursor: pointer;">
					<div style="font-weight: 600;">${draft.name || 'Bản nháp'}</div>
					<div style="font-size: 12px; color: #6c757d; margin-top: 4px;">${draft.lastUpdated?.toDate ? formatRelativeTime(draft.lastUpdated) : ''}</div>
				</button>
				<button type="button" class="btn btn-sm btn-outline-danger" onclick="deleteDraft('${draft.id}')" title="Xóa bản nháp" style="flex-shrink: 0;">
					<i class="fas fa-trash"></i>
				</button>
			</div>
		`).join('');

		Swal.fire({
			title: 'Chọn bản nháp',
			html: `<div style="max-height: 400px; overflow-y: auto;">${itemsHtml}</div>`,
			showConfirmButton: false,
			showCancelButton: true,
			cancelButtonText: 'Đóng',
			cancelButtonColor: '#6c757d',
		});
	} catch (error) {
		console.error("Lỗi khi tải bản nháp:", error);
		Swal.fire({
			icon: "error",
			title: "Lỗi",
			text: "Không thể tải bản nháp: " + error.message,
		});
	}
}

// Chọn một bản nháp cụ thể và tải nội dung
async function selectDraft(draftId, textareaId = "messageText") {
	try {
		const user = firebase.auth().currentUser;
		if (!user) return;

		const doc = await firebase.firestore()
			.collection("drafts").doc(user.uid).collection("items").doc(draftId).get();

		if (!doc.exists) {
			showSuccessMessage("Bản nháp không tồn tại");
			return;
		}

		Swal.close();
		document.getElementById(textareaId).value = doc.data().content;
		showSuccessMessage("Đã tải bản nháp thành công");
	} catch (error) {
		console.error("Lỗi khi chọn bản nháp:", error);
		Swal.fire({
			icon: "error",
			title: "Lỗi",
			text: "Không thể tải bản nháp: " + error.message,
		});
	}
}

// Xóa một bản nháp
async function deleteDraft(draftId) {
	try {
		const user = firebase.auth().currentUser;
		if (!user) return;

		const { isConfirmed } = await Swal.fire({
			title: 'Xác nhận xóa',
			text: 'Bạn có chắc muốn xóa bản nháp này?',
			icon: 'warning',
			showCancelButton: true,
			confirmButtonColor: '#d33',
			cancelButtonColor: '#3085d6',
			confirmButtonText: 'Xóa',
			cancelButtonText: 'Hủy',
		});

		if (isConfirmed) {
			await firebase.firestore()
				.collection("drafts").doc(user.uid).collection("items").doc(draftId).delete();

			// Reload danh sách
			const textareaId = document.querySelector('[id$="messageText"]') ? 'messageText' : 'messageText';
			loadDraft(textareaId);
		}
	} catch (error) {
		console.error("Lỗi khi xóa bản nháp:", error);
		Swal.fire({
			icon: "error",
			title: "Lỗi",
			text: "Không thể xóa bản nháp: " + error.message,
		});
	}
}

function updateFileList(input) {
	const fileList = document.getElementById("fileList");
	const clearFilesBtn = document.getElementById("clearFilesBtn");

	if (input.files.length > 0) {
		let html = '<div class="list-group">';
		for (let i = 0; i < input.files.length; i++) {
			const file = input.files[i];
			const fileSize = (file.size / (1024 * 1024)).toFixed(2); // Chuyển sang MB
			const isImage = file.type.startsWith('image/');
			
			if (isImage) {
				// Tạo URL cho preview hình ảnh
				const imageUrl = URL.createObjectURL(file);
				html += `
					<div class="list-group-item list-group-item-action">
						<div class="d-flex justify-content-between align-items-start">
							<div class="flex-grow-1">
								<div class="d-flex align-items-center mb-2">
									<i class="far fa-image me-2 text-primary"></i>
									<span class="text-truncate" style="max-width: 200px;" title="${file.name}">${file.name}</span>
								</div>
								<div class="image-preview-container mb-2">
									<img src="${imageUrl}" alt="${file.name}" class="img-thumbnail" style="max-width: 150px; max-height: 100px; object-fit: cover; cursor: pointer;" onclick="viewImagePreview('${imageUrl}', '${file.name}')" />
								</div>
								<div class="d-flex justify-content-between align-items-center">
									<span class="badge bg-primary rounded-pill">${fileSize} MB</span>
									<small class="text-muted">Click để xem lớn</small>
								</div>
							</div>
							<button class="btn btn-sm btn-outline-danger ms-2" onclick="removeFile(${i})" title="Xóa file">
								<i class="fas fa-times"></i>
							</button>
						</div>
					</div>
				`;
			} else {
				html += `
					<div class="list-group-item list-group-item-action d-flex justify-content-between align-items-center">
						<div class="text-truncate" style="max-width: 70%;" title="${file.name}">
							<i class="far fa-file me-2"></i>${file.name}
						</div>
						<div class="d-flex align-items-center">
							<span class="badge bg-secondary rounded-pill me-2">${fileSize} MB</span>
							<button class="btn btn-sm btn-outline-danger" onclick="removeFile(${i})" title="Xóa file">
								<i class="fas fa-times"></i>
							</button>
						</div>
					</div>
				`;
			}
		}
		html += "</div>";
		fileList.innerHTML = html;
		
		// Hiển thị nút xóa tất cả khi có file
		if (clearFilesBtn) {
			clearFilesBtn.style.display = 'inline-flex';
		}
	} else {
		fileList.innerHTML = "Chưa có file nào được chọn";
		
		// Ẩn nút xóa tất cả khi không có file
		if (clearFilesBtn) {
			clearFilesBtn.style.display = 'none';
		}
	}
}

// Function to clear all files
function clearAllFiles() {
	Swal.fire({
		title: 'Xác nhận xóa tất cả',
		text: 'Bạn có chắc chắn muốn xóa tất cả file đã chọn không?',
		icon: 'warning',
		showCancelButton: true,
		confirmButtonColor: '#d33',
		cancelButtonColor: '#3085d6',
		confirmButtonText: 'Xóa tất cả',
		cancelButtonText: 'Hủy'
	}).then((result) => {
		if (result.isConfirmed) {
			const fileInput = document.getElementById("fileInput");
			fileInput.value = "";
			updateFileList(fileInput);
			showSuccessMessage("Đã xóa tất cả file thành công");
		}
	});
}

// Function to remove a specific file
function removeFile(index) {
	const fileInput = document.getElementById("fileInput");
	const dt = new DataTransfer();
	
	// Add all files except the one to remove
	for (let i = 0; i < fileInput.files.length; i++) {
		if (i !== index) {
			dt.items.add(fileInput.files[i]);
		}
	}
	
	// Update file input
	fileInput.files = dt.files;
	
	// Update file list display
	updateFileList(fileInput);
	
	// Show success message
	showSuccessMessage("Đã xóa file thành công");
}

// Function to view full image preview
function viewImagePreview(imageUrl, fileName) {
	Swal.fire({
		title: fileName,
		html: `<img src="${imageUrl}" alt="${fileName}" class="img-fluid" style="max-height: 70vh;" />`,
		width: 'auto',
		showCloseButton: true,
		showConfirmButton: false,
		background: '#2d3748',
		customClass: {
			popup: 'image-preview-modal'
		}
	});
}

// Xử lý drag & drop và paste clipboard
document.addEventListener("DOMContentLoaded", function() {
	const dropZone = document.getElementById("dropZone");
	const fileInput = document.getElementById("fileInput");

	if (dropZone && fileInput) {
		// Click để mở file input
		dropZone.addEventListener("click", function() {
			// Lưu các file hiện tại trước khi mở file input
			const currentFiles = Array.from(fileInput.files);
			
			// Tạo một input tạm thời để xử lý việc chọn file
			const tempInput = document.createElement('input');
			tempInput.type = 'file';
			tempInput.multiple = true;
			
			tempInput.addEventListener('change', function(e) {
				const newFiles = Array.from(e.target.files);
				
				if (newFiles.length > 0) {
					// Tạo DataTransfer mới để kết hợp file cũ và file mới
					const dataTransfer = new DataTransfer();
					
					// Thêm các file cũ
					currentFiles.forEach(file => {
						dataTransfer.items.add(file);
					});
					
					// Thêm các file mới
					newFiles.forEach(file => {
						dataTransfer.items.add(file);
					});
					
					// Cập nhật file input
					fileInput.files = dataTransfer.files;
					updateFileList(fileInput);
					
					// Hiển thị thông báo
					showSuccessMessage(`Đã thêm ${newFiles.length} file mới vào danh sách`);
				}
			});
			
			tempInput.click();
		});

		// Drag & drop events
		dropZone.addEventListener("dragover", function(e) {
			e.preventDefault();
			dropZone.classList.add("border-primary", "bg-light");
		});

		dropZone.addEventListener("dragleave", function(e) {
			e.preventDefault();
			dropZone.classList.remove("border-primary", "bg-light");
		});

		dropZone.addEventListener("drop", function(e) {
			e.preventDefault();
			dropZone.classList.remove("border-primary", "bg-light");
			
			const newFiles = e.dataTransfer.files;
			if (newFiles.length > 0) {
				// Tạo DataTransfer mới để kết hợp file cũ và file mới
				const dataTransfer = new DataTransfer();
				
				// Thêm các file cũ
				for (let i = 0; i < fileInput.files.length; i++) {
					dataTransfer.items.add(fileInput.files[i]);
				}
				
				// Thêm các file mới từ drag & drop
				for (let i = 0; i < newFiles.length; i++) {
					dataTransfer.items.add(newFiles[i]);
				}
				
				// Cập nhật file input
				fileInput.files = dataTransfer.files;
				updateFileList(fileInput);
				
				// Hiển thị thông báo
				showSuccessMessage(`Đã thêm ${newFiles.length} file mới vào danh sách`);
			}
		});

		// Paste event - xử lý paste hình ảnh từ clipboard
		document.addEventListener("paste", function(e) {
			// Chỉ xử lý paste khi người dùng không đang focus vào input hoặc textarea
			const activeElement = document.activeElement;
			const isInputFocused = activeElement && (
				activeElement.tagName === "INPUT" || 
				activeElement.tagName === "TEXTAREA" ||
				activeElement.contentEditable === "true"
			);

			if (!isInputFocused) {
				const items = e.clipboardData.items;
				let hasImage = false;

				for (let i = 0; i < items.length; i++) {
					const item = items[i];
					
					if (item.type.indexOf("image") !== -1) {
						hasImage = true;
						const file = item.getAsFile();
						
						if (file) {
							// Tạo một DataTransfer mới để thêm file vào input
							const dataTransfer = new DataTransfer();
							
							// Giữ lại các file đã có trước đó
							for (let j = 0; j < fileInput.files.length; j++) {
								dataTransfer.items.add(fileInput.files[j]);
							}
							
							// Thêm file mới từ clipboard
							dataTransfer.items.add(file);
							
							// Cập nhật file input
							fileInput.files = dataTransfer.files;
							updateFileList(fileInput);

							// Hiển thị thông báo
							Swal.fire({
								icon: "success",
								title: "Thành công!",
								text: "Đã thêm hình ảnh từ clipboard vào danh sách file",
								showConfirmButton: false,
								timer: 1500,
								position: "top-end",
								toast: true
							});
						}
						break;
					}
				}

				if (hasImage) {
					e.preventDefault(); // Ngăn hành động paste mặc định
				}
			}
		});
	}
});
