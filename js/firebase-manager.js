let currentUser = null;

firebase.auth().onAuthStateChanged(function(user) {
	currentUser = user;
	const status = document.getElementById('userStatus');
	const loginBtn = document.getElementById('loginBtn');
	const logoutBtn = document.getElementById('logoutBtn');
	if (user) {
		status.textContent = user.email;
		loginBtn.classList.add('hidden');
		logoutBtn.classList.remove('hidden');
		renderAdmin();
	} else {
		status.textContent = 'Chưa đăng nhập';
		loginBtn.classList.remove('hidden');
		logoutBtn.classList.add('hidden');
		document.getElementById('mainContent').innerHTML = `
			<div class="text-center py-20 text-gray-500">
				<i class="fas fa-sign-in-alt text-4xl mb-4"></i>
				<p>Vui lòng đăng nhập để quản lý dữ liệu Firebase.</p>
			</div>`;
	}
});

function login() {
	const email = prompt('Email:');
	if (!email) return;
	const pass = prompt('Mật khẩu:');
	if (!pass) return;
	firebase.auth().signInWithEmailAndPassword(email, pass)
		.catch(err => Swal.fire({ icon: 'error', title: 'Lỗi đăng nhập', text: err.message, background: '#1f2937', color: '#fff' }));
}

function logout() {
	firebase.auth().signOut();
}

function showStatus(msg, type = 'info') {
	const bar = document.getElementById('statusBar');
	bar.className = type;
	bar.textContent = msg;
	clearTimeout(bar._timer);
	bar._timer = setTimeout(() => bar.style.display = 'none', 3000);
}

const COLLECTIONS = [
	{ key: 'favorites', label: 'Yêu thích', icon: 'fa-heart', iconColor: 'text-red-400', orderField: 'addedAt' },
	{ key: 'watchHistory', label: 'Lịch sử xem', icon: 'fa-history', iconColor: 'text-blue-400', orderField: 'watchedAt' },
	{ key: 'pinnedMovies', label: 'Phim ghim', icon: 'fa-thumbtack', iconColor: 'text-amber-400', orderField: 'pinnedAt' },
	{ key: 'curatedLinks', label: 'Link phim cố định', icon: 'fa-bookmark', iconColor: 'text-teal-400', orderField: 'addedAt' },
	{ key: 'curatedTimes', label: 'Thời gian đã lưu', icon: 'fa-clock', iconColor: 'text-green-400', orderField: 'savedAt' },
	{ key: 'watchTimeNotes', label: 'Ghi chú phim', icon: 'fa-sticky-note', iconColor: 'text-yellow-400', orderField: 'createdAt' },
];

const GLOBAL_COLLECTIONS = [
	{ key: 'sources', label: 'Nguồn phim', icon: 'fa-link', iconColor: 'text-purple-400', orderField: 'order', orderDir: 'asc', allowAdd: true },
];

function getCollectionRef(colKey) {
	const isGlobal = GLOBAL_COLLECTIONS.some(c => c.key === colKey);
	return isGlobal ? db.collection(colKey) : db.collection('users').doc(currentUser.uid).collection(colKey);
}

async function renderAdmin() {
	const container = document.getElementById('mainContent');
	container.innerHTML = `
		<div class="flex items-center justify-between mb-6">
			<h2 class="text-xl font-semibold"><i class="fas fa-folder-open mr-2 text-purple-400"></i>Quản lý dữ liệu Firebase</h2>
			<div class="flex gap-2">
				<button onclick="renderAdmin()" class="bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded-lg text-sm transition"><i class="fas fa-sync-alt mr-1"></i>Làm mới</button>
				<button onclick="showUserDocEditor()" class="bg-purple-600 hover:bg-purple-700 px-3 py-1.5 rounded-lg text-sm transition"><i class="fas fa-user-cog mr-1"></i>User fields</button>
			</div>
		</div>
		<h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3"><i class="fas fa-globe mr-1"></i>Dữ liệu chung</h3>
		<div id="globalCollectionsContainer" class="space-y-3 mb-8">
			${GLOBAL_COLLECTIONS.map(c => `
				<details class="collection-card" data-collection="${c.key}">
					<summary>
						<i class="fas ${c.icon} ${c.iconColor}"></i>
						${c.label}
						${c.allowAdd ? `<button onclick="event.stopPropagation(); addSource(); return false;" class="btn-add" title="Thêm mới"><i class="fas fa-plus mr-1"></i>Thêm</button>` : ''}
						<span class="count-badge" id="count-${c.key}">...</span>
					</summary>
					<div id="content-${c.key}" class="min-h-[40px]">
						<div class="text-center py-6 text-gray-500"><i class="fas fa-spinner fa-spin mr-2"></i>Đang tải...</div>
					</div>
				</details>
			`).join('')}
		</div>
		<h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3"><i class="fas fa-user mr-1"></i>Dữ liệu người dùng</h3>
		<div id="collectionsContainer" class="space-y-3">
			${COLLECTIONS.map(c => `
				<details class="collection-card" data-collection="${c.key}">
					<summary>
						<i class="fas ${c.icon} ${c.iconColor}"></i>
						${c.label}
						<span class="count-badge" id="count-${c.key}">...</span>
					</summary>
					<div id="content-${c.key}" class="min-h-[40px]">
						<div class="text-center py-6 text-gray-500"><i class="fas fa-spinner fa-spin mr-2"></i>Đang tải...</div>
					</div>
				</details>
			`).join('')}
		</div>`;
	for (const c of GLOBAL_COLLECTIONS) {
		loadCollection(c.key, c.label);
	}
	for (const c of COLLECTIONS) {
		loadCollection(c.key, c.label);
	}
}

async function loadCollection(colKey, colLabel) {
	const contentEl = document.getElementById('content-' + colKey);
	const countEl = document.getElementById('count-' + colKey);
	const col = COLLECTIONS.find(c => c.key === colKey) || GLOBAL_COLLECTIONS.find(c => c.key === colKey);
	try {
		let query = getCollectionRef(colKey);
		if (col?.orderField) {
			query = query.orderBy(col.orderField, col.orderDir || 'desc');
		}
		const snapshot = await query.get();
		const docs = [];
		snapshot.forEach(doc => docs.push({ id: doc.id, ...doc.data() }));
		countEl.textContent = docs.length;
		if (docs.length === 0) {
			contentEl.innerHTML = '<div class="empty-msg">Chưa có dữ liệu.</div>';
			return;
		}
		contentEl.innerHTML = docs.map(doc => {
			const fields = Object.entries(doc).filter(([k]) => k !== 'id');
			return `
				<div class="doc-row">
					<div class="flex-1 min-w-0">
						<div class="field-grid">
							${fields.map(([k, v]) => {
								const display = formatValue(v, k);
								return `<span class="field-item"><span class="field-key">${k}:</span> ${display}</span>`;
							}).join('')}
						</div>
						<div class="doc-id">ID: ${doc.id}</div>
					</div>
					<div class="doc-actions">
						<button class="btn-edit" onclick="editDoc('${colKey}','${doc.id}')" title="Sửa"><i class="fas fa-edit"></i></button>
						<button class="btn-delete" onclick="deleteDoc('${colKey}','${doc.id}')" title="Xóa"><i class="fas fa-trash-alt"></i></button>
					</div>
				</div>`;
		}).join('');
	} catch (err) {
		contentEl.innerHTML = `<div class="empty-msg" style="color:#ef4444">Lỗi: ${escapeHtml(err.message)}</div>`;
		countEl.textContent = '?';
	}
}

function formatValue(v, key) {
	if (v === null || v === undefined) return '<span class="null">null</span>';
	if (typeof v === 'boolean') return v ? '<span style="color:#34d399">true</span>' : '<span style="color:#f87171">false</span>';
	if (typeof v === 'number') return `<span style="color:#60a5fa">${v}</span>`;
	if (v instanceof Date || (typeof v === 'object' && v.toDate)) {
		const d = v.toDate ? v.toDate() : v;
		return `<span style="color:#a78bfa">${d.toISOString().replace('T',' ').slice(0,19)}</span>`;
	}
	if (v.seconds && v.nanoseconds) {
		const d = new Date(v.seconds * 1000);
		return `<span style="color:#a78bfa">${d.toISOString().replace('T',' ').slice(0,19)}</span>`;
	}
	const s = String(v);
	const max = 80;
	const display = s.length > max ? s.slice(0, max) + '...' : s;
	if (s.length > 80) {
		return `<span title="${escapeHtml(s)}">${escapeHtml(display)}</span>`;
	}
	return escapeHtml(display);
}

function escapeHtml(str) {
	const div = document.createElement('div');
	div.textContent = str;
	return div.innerHTML;
}

function getFieldType(v) {
	if (v === null || v === undefined) return 'string';
	if (typeof v === 'boolean') return 'boolean';
	if (typeof v === 'number') return 'number';
	if (v.seconds && v.nanoseconds) return 'timestamp';
	if (v instanceof Date) return 'date';
	return 'string';
}

async function editDoc(colKey, docId) {
	const docRef = getCollectionRef(colKey).doc(docId);
	let doc;
	try {
		const snap = await docRef.get();
		if (!snap.exists) { showStatus('Tài liệu không tồn tại', 'error'); return; }
		doc = { id: snap.id, ...snap.data() };
	} catch (err) {
		showStatus('Lỗi đọc dữ liệu: ' + err.message, 'error');
		return;
	}

	const fields = Object.entries(doc).filter(([k]) => k !== 'id');
	const html = fields.map(([k, v]) => {
		const val = v?.seconds ? new Date(v.seconds * 1000).toISOString().slice(0, 19) : (v ?? '');
		return `
			<div style="margin-bottom:8px">
				<label style="font-size:12px;color:#9ca3af;display:block;margin-bottom:2px">${k}</label>
				<textarea id="field-${k}" rows="2" class="swal2-input swal-input-custom" style="resize:vertical;font-family:monospace;font-size:13px">${escapeHtml(String(val))}</textarea>
			</div>`;
	}).join('');

	const { value: form } = await Swal.fire({
		title: 'Sửa tài liệu',
		width: 'min(95vw, 600px)',
		padding: '1rem',
		html: `<div style="margin-bottom:10px;font-size:12px;color:#6b7280">ID: ${docId} | Collection: ${colKey}</div>${html}`,
		focusConfirm: false,
		showCancelButton: true,
		confirmButtonText: 'Lưu',
		cancelButtonText: 'Hủy',
		preConfirm: () => {
			const result = {};
			for (const [k] of fields) {
				const el = document.getElementById('field-' + k);
				if (!el) continue;
				const raw = el.value.trim();
				const orig = doc[k];
				if (orig === null || orig === undefined) {
					result[k] = raw || null;
				} else if (typeof orig === 'number') {
					result[k] = raw === '' ? null : Number(raw);
				} else if (typeof orig === 'boolean') {
					result[k] = raw === 'true' ? true : raw === 'false' ? false : orig;
				} else if (orig?.seconds && orig?.nanoseconds || orig instanceof Date) {
					result[k] = raw ? firebase.firestore.Timestamp.fromDate(new Date(raw)) : null;
				} else {
					result[k] = raw;
				}
			}
			return result;
		},
		background: '#1f2937', color: '#fff', confirmButtonColor: '#7c3aed',
		customClass: { confirmButton: 'swal-btn-custom', cancelButton: 'swal-btn-custom' }
	});
	if (!form) return;
	try {
		await docRef.update(form);
		showStatus('Đã cập nhật!', 'success');
		loadCollection(colKey);
	} catch (err) {
		showStatus('Lỗi cập nhật: ' + err.message, 'error');
	}
}

async function deleteDoc(colKey, docId) {
	const result = await Swal.fire({
		title: 'Xóa tài liệu?',
		text: `Bạn có chắc muốn xóa tài liệu này khỏi "${colKey}"?`,
		icon: 'warning',
		showCancelButton: true,
		confirmButtonColor: '#dc2626',
		cancelButtonColor: '#6b7280',
		confirmButtonText: 'Xóa',
		cancelButtonText: 'Hủy',
		background: '#1f2937', color: '#fff'
	});
	if (!result.isConfirmed) return;
	try {
		await getCollectionRef(colKey).doc(docId).delete();
		showStatus('Đã xóa!', 'success');
		loadCollection(colKey);
	} catch (err) {
		showStatus('Lỗi xóa: ' + err.message, 'error');
	}
}

const SOURCE_COLORS = [
	{ value: 'bg-blue-600', label: 'Xanh dương' },
	{ value: 'bg-orange-600', label: 'Cam' },
	{ value: 'bg-purple-600', label: 'Tím' },
	{ value: 'bg-green-600', label: 'Xanh lá' },
	{ value: 'bg-red-600', label: 'Đỏ' },
	{ value: 'bg-teal-600', label: 'Teal' },
	{ value: 'bg-pink-600', label: 'Hồng' },
	{ value: 'bg-indigo-600', label: 'Indigo' }
];

const SOURCE_STATUS_COLORS = [
	{ value: 'text-green-400', label: 'Xanh lá' },
	{ value: 'text-purple-400', label: 'Tím' },
	{ value: 'text-blue-400', label: 'Xanh dương' },
	{ value: 'text-orange-400', label: 'Cam' },
	{ value: 'text-red-400', label: 'Đỏ' },
	{ value: 'text-teal-400', label: 'Teal' },
	{ value: 'text-yellow-400', label: 'Vàng' },
	{ value: 'text-gray-400', label: 'Xám' }
];

async function addSource() {
	const html =
		'<input id="swal-name" placeholder="Tên nguồn (VD: NguonC)" class="swal2-input swal-input-custom">' +
		'<input id="swal-tagline" placeholder="Tagline (VD: Phim online Việt Nam)" class="swal2-input swal-input-custom">' +
		'<textarea id="swal-description" placeholder="Mô tả" class="swal2-textarea swal-input-custom" rows="2"></textarea>' +
		'<input id="swal-status" placeholder="Trạng thái (VD: Sẵn sàng)" class="swal2-input swal-input-custom">' +
		'<select id="swal-statusColor" class="swal2-input swal-input-custom">' + SOURCE_STATUS_COLORS.map(o => `<option value="${o.value}">${o.label}</option>`).join('') + '</select>' +
		'<input id="swal-url" placeholder="URL nguồn (VD: https://phim.nguonc.com/)" class="swal2-input swal-input-custom">' +
		'<select id="swal-color" class="swal2-input swal-input-custom">' + SOURCE_COLORS.map(o => `<option value="${o.value}">${o.label}</option>`).join('') + '</select>';

	const { value: form } = await Swal.fire({
		title: 'Thêm nguồn phim',
		width: 'min(90vw, 500px)',
		padding: '1.25rem',
		html,
		focusConfirm: false,
		showCancelButton: true,
		confirmButtonText: 'Lưu',
		cancelButtonText: 'Hủy',
		preConfirm: () => {
			const name = document.getElementById('swal-name').value.trim();
			const url = document.getElementById('swal-url').value.trim();
			if (!name) { Swal.showValidationMessage('Vui lòng nhập tên nguồn'); return; }
			if (!url) { Swal.showValidationMessage('Vui lòng nhập URL'); return; }
			return {
				name,
				tagline: document.getElementById('swal-tagline').value.trim(),
				description: document.getElementById('swal-description').value.trim(),
				status: document.getElementById('swal-status').value.trim(),
				statusColor: document.getElementById('swal-statusColor').value,
				url,
				color: document.getElementById('swal-color').value
			};
		},
		background: '#1f2937', color: '#fff', confirmButtonColor: '#7c3aed',
		customClass: { confirmButton: 'swal-btn-custom', cancelButton: 'swal-btn-custom' }
	});
	if (!form) return;
	try {
		const snapshot = await db.collection('sources').get();
		let maxOrder = -1;
		snapshot.forEach(doc => {
			const order = doc.data().order;
			if (typeof order === 'number' && order > maxOrder) maxOrder = order;
		});
		await db.collection('sources').add({ ...form, order: maxOrder + 1 });
		showStatus('Đã thêm nguồn!', 'success');
		loadCollection('sources');
	} catch (err) {
		showStatus('Lỗi thêm: ' + err.message, 'error');
	}
}

async function showUserDocEditor() {
	const userRef = db.collection('users').doc(currentUser.uid);
	let doc;
	try {
		const snap = await userRef.get();
		doc = snap.exists ? { ...snap.data() } : {};
	} catch (err) {
		showStatus('Lỗi đọc: ' + err.message, 'error');
		return;
	}

	const fields = Object.entries(doc);
	const html = fields.length === 0
		? '<p style="color:#6b7280;font-size:13px">Chưa có field nào trên tài liệu user.</p>'
		: fields.map(([k, v]) => {
			const val = Array.isArray(v) ? JSON.stringify(v) : String(v ?? '');
			return `
				<div style="margin-bottom:8px">
					<label style="font-size:12px;color:#9ca3af;display:block;margin-bottom:2px">${k}</label>
					<textarea id="ufield-${k}" rows="2" class="swal2-input swal-input-custom" style="resize:vertical;font-family:monospace;font-size:13px">${escapeHtml(val)}</textarea>
				</div>`;
		}).join('');

	const { value: form } = await Swal.fire({
		title: 'User fields',
		width: 'min(95vw, 600px)',
		padding: '1rem',
		html: `<div style="margin-bottom:10px;font-size:12px;color:#6b7280">users / ${currentUser.uid}</div>${html}
			<div style="margin-top:12px;padding-top:12px;border-top:1px solid #374151">
				<p style="font-size:12px;color:#9ca3af;margin-bottom:6px">Thêm field mới:</p>
				<div style="display:flex;gap:8px">
					<input id="newFieldKey" placeholder="Tên field" class="swal2-input swal-input-custom" style="flex:1">
					<input id="newFieldVal" placeholder="Giá trị" class="swal2-input swal-input-custom" style="flex:1">
				</div>
			</div>`,
		focusConfirm: false,
		showCancelButton: true,
		confirmButtonText: 'Lưu',
		cancelButtonText: 'Hủy',
		preConfirm: () => {
			const result = {};
			for (const [k] of fields) {
				const el = document.getElementById('ufield-' + k);
				if (!el) continue;
				const raw = el.value.trim();
				const orig = doc[k];
				if (Array.isArray(orig)) {
					try { result[k] = JSON.parse(raw); } catch { result[k] = raw.split(',').map(s => s.trim()).filter(Boolean); }
				} else if (typeof orig === 'number') {
					result[k] = raw === '' ? null : Number(raw);
				} else if (typeof orig === 'boolean') {
					result[k] = raw === 'true' ? true : raw === 'false' ? false : orig;
				} else if (orig?.toDate) {
					result[k] = raw ? firebase.firestore.Timestamp.fromDate(new Date(raw)) : null;
				} else {
					result[k] = raw;
				}
			}
			const nk = document.getElementById('newFieldKey')?.value.trim();
			const nv = document.getElementById('newFieldVal')?.value.trim();
			if (nk) {
				result[nk] = nv || '';
			}
			return result;
		},
		background: '#1f2937', color: '#fff', confirmButtonColor: '#7c3aed',
		customClass: { confirmButton: 'swal-btn-custom', cancelButton: 'swal-btn-custom' }
	});
	if (!form) return;
	try {
		await userRef.set(form, { merge: true });
		showStatus('Đã cập nhật user fields!', 'success');
	} catch (err) {
		showStatus('Lỗi: ' + err.message, 'error');
	}
}
