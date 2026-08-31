// CinePhim - Watch Time Notes Page JavaScript

let watchTimeNotes = [];
let searchTerm = "";
let currentPage = 1;
const PAGE_SIZE = 10;
let currentSort = "updatedAt_desc";

document.addEventListener('DOMContentLoaded', async function() {
    await window.ensureConfigReady();
    const searchInput = document.getElementById('noteSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', filterNotes);
    }
    setupSearchListeners();
    document.addEventListener('cinephim:auth-ready', () => {
        loadWatchTimeNotes();
    });
});

async function loadWatchTimeNotes() {
    const container = document.getElementById('notesContainer');
    container.innerHTML = '<p class="text-gray-400 text-center"><i class="fas fa-spinner fa-spin mr-2"></i>Đang tải...</p>';

    if (!currentUser) {
        container.innerHTML = '<p class="text-gray-400 text-center"><i class="fas fa-lock mr-2"></i>Vui lòng đăng nhập để xem ghi chú thời gian</p>';
        return;
    }

    try {
        const snapshot = await db.collection('users').doc(currentUser.uid).collection('watchTimeNotes').orderBy('updatedAt', 'desc').get();
        watchTimeNotes = [];
        snapshot.forEach(doc => {
            watchTimeNotes.push({ id: doc.id, ...doc.data() });
        });
        renderNotes();
    } catch (err) {
        container.innerHTML = '<p class="text-red-400 text-center">Không thể tải ghi chú: ' + err.message + '</p>';
    }
}

function filterNotes() {
    searchTerm = document.getElementById('noteSearchInput').value.toLowerCase().trim();
    currentPage = 1;
    renderNotes();
}

function changeSortOrder() {
    currentSort = document.getElementById('sortSelect').value;
    currentPage = 1;
    renderNotes();
}

function getFilteredNotes() {
    let list = searchTerm
        ? watchTimeNotes.filter(n =>
            (n.movieTitle || '').toLowerCase().includes(searchTerm) ||
            (n.movieSlug || '').toLowerCase().includes(searchTerm)
        )
        : [...watchTimeNotes];

    const [field, dir] = currentSort.split('_');
    list.sort((a, b) => {
        let valA, valB;
        if (field === 'updatedAt' || field === 'createdAt') {
            valA = toTimestamp(a[field]);
            valB = toTimestamp(b[field]);
        } else {
            valA = (a[field] || '').toLowerCase();
            valB = (b[field] || '').toLowerCase();
        }
        if (valA < valB) return dir === 'asc' ? -1 : 1;
        if (valA > valB) return dir === 'asc' ? 1 : -1;
        return 0;
    });
    return list;
}

function toTimestamp(date) {
    if (!date) return 0;
    if (date.toDate && typeof date.toDate === 'function') return date.toDate().getTime();
    if (date.seconds) return date.seconds * 1000;
    const d = new Date(date);
    return isNaN(d.getTime()) ? 0 : d.getTime();
}

function renderNotes() {
    const container = document.getElementById('notesContainer');
    const filtered = getFilteredNotes();
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if (currentPage > totalPages) currentPage = totalPages;
    const start = (currentPage - 1) * PAGE_SIZE;
    const pageItems = filtered.slice(start, start + PAGE_SIZE);

    if (filtered.length === 0) {
        container.innerHTML = '<p class="text-gray-400 text-center">' + (searchTerm ? 'Không tìm thấy ghi chú nào.' : 'Chưa có ghi chú thời gian nào.') + '</p>';
        document.getElementById('pagination').innerHTML = '';
        return;
    }

    container.innerHTML = '';
    pageItems.forEach(note => {
        const card = document.createElement('div');
        card.className = 'bg-gray-800 rounded-lg p-4 sm:p-5 hover:bg-gray-750 transition border-l-4 border-yellow-500';
        card.dataset.id = note.id;

        const createdAt = note.createdAt ? formatDate(note.createdAt) : 'N/A';
        const updatedAt = note.updatedAt ? formatDate(note.updatedAt) : 'N/A';
        const noteValue = note.note || '';
        const episodeValue = note.episodeNumber || '';
        const displayNote = episodeValue ? episodeValue + (noteValue ? ' ' + noteValue : '') : noteValue;

        card.innerHTML = `
            <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div class="flex-1 min-w-0">
                    <h3 class="text-base sm:text-lg font-semibold text-white mb-1 truncate">
                        <a href="movie-detail.html?slug=${encodeURIComponent(note.movieSlug || '')}" class="hover:text-purple-400 transition">${escapeHtml(note.movieTitle || note.movieSlug || 'Phim không xác định')}</a>
                    </h3>
                    <p class="text-gray-400 text-xs mb-2">Slug: ${escapeHtml(note.movieSlug || '')}</p>
                    <div class="flex flex-wrap gap-2 text-xs text-gray-500">
                        <span><i class="fas fa-clock mr-1"></i>Tạo: ${createdAt}</span>
                        <span><i class="fas fa-edit mr-1"></i>Sửa: ${updatedAt}</span>
                    </div>
                </div>
                <div class="flex flex-col items-stretch gap-2 flex-shrink-0 min-w-0 w-full sm:w-auto sm:min-w-[280px]">
                    <div class="flex items-center gap-1">
                        <input type="text" id="ep-${note.id}" placeholder="Tập" value="${escapeHtml(episodeValue)}" class="w-14 sm:w-16 bg-gray-700 text-white text-xs rounded px-2 py-1.5 border border-gray-600 focus:border-purple-500 outline-none text-center" />
                        <input type="text" id="note-${note.id}" placeholder="VD: 23:45" value="${escapeHtml(noteValue)}" class="flex-1 bg-gray-700 text-white text-xs rounded px-2 py-1.5 border border-gray-600 focus:border-purple-500 outline-none" onkeydown="if(event.key==='Enter')saveNote('${note.id}')" />
                    </div>
                    <div class="flex items-center gap-1">
                        <button onclick="saveNote('${note.id}')" class="bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1.5 rounded transition font-medium" title="Lưu ghi chú">
                            <i class="fas fa-save mr-1"></i>Lưu
                        </button>
                        <button onclick="toggleVirtualKeyboard('${note.id}')" class="text-purple-400 hover:text-purple-300 transition text-xs px-2 py-1.5" title="Bàn phím ảo">
                            <i class="fas fa-keyboard"></i>
                        </button>
                        <button onclick="deleteNote('${note.id}')" class="text-red-400 hover:text-red-300 transition text-xs px-2 py-1.5 rounded border border-red-500/30 hover:border-red-400 ml-auto" title="Xóa ghi chú">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                    <span id="saved-${note.id}" class="text-green-400 text-xs hidden"><i class="fas fa-check"></i> Đã lưu</span>
                    <div id="kbd-${note.id}" class="hidden bg-gray-800 rounded-lg p-2 w-full">
                        <div class="grid grid-cols-10 gap-0.5 sm:gap-1 mb-1">
                            <button onclick="kbdInsert('${note.id}','1')" class="bg-gray-600 hover:bg-gray-500 text-white px-0.5 sm:px-1 py-0.5 rounded text-xs min-w-0">1</button>
                            <button onclick="kbdInsert('${note.id}','2')" class="bg-gray-600 hover:bg-gray-500 text-white px-0.5 sm:px-1 py-0.5 rounded text-xs min-w-0">2</button>
                            <button onclick="kbdInsert('${note.id}','3')" class="bg-gray-600 hover:bg-gray-500 text-white px-0.5 sm:px-1 py-0.5 rounded text-xs min-w-0">3</button>
                            <button onclick="kbdInsert('${note.id}','4')" class="bg-gray-600 hover:bg-gray-500 text-white px-0.5 sm:px-1 py-0.5 rounded text-xs min-w-0">4</button>
                            <button onclick="kbdInsert('${note.id}','5')" class="bg-gray-600 hover:bg-gray-500 text-white px-0.5 sm:px-1 py-0.5 rounded text-xs min-w-0">5</button>
                            <button onclick="kbdInsert('${note.id}','6')" class="bg-gray-600 hover:bg-gray-500 text-white px-0.5 sm:px-1 py-0.5 rounded text-xs min-w-0">6</button>
                            <button onclick="kbdInsert('${note.id}','7')" class="bg-gray-600 hover:bg-gray-500 text-white px-0.5 sm:px-1 py-0.5 rounded text-xs min-w-0">7</button>
                            <button onclick="kbdInsert('${note.id}','8')" class="bg-gray-600 hover:bg-gray-500 text-white px-0.5 sm:px-1 py-0.5 rounded text-xs min-w-0">8</button>
                            <button onclick="kbdInsert('${note.id}','9')" class="bg-gray-600 hover:bg-gray-500 text-white px-0.5 sm:px-1 py-0.5 rounded text-xs min-w-0">9</button>
                            <button onclick="kbdInsert('${note.id}','0')" class="bg-gray-600 hover:bg-gray-500 text-white px-0.5 sm:px-1 py-0.5 rounded text-xs min-w-0">0</button>
                        </div>
                        <div class="grid grid-cols-6 gap-0.5 sm:gap-1">
                            <button onclick="kbdInsert('${note.id}',':')" class="bg-gray-600 hover:bg-gray-500 text-white px-0.5 sm:px-1 py-0.5 rounded text-xs min-w-0">:</button>
                            <button onclick="kbdInsert('${note.id}','-')" class="bg-gray-600 hover:bg-gray-500 text-white px-0.5 sm:px-1 py-0.5 rounded text-xs min-w-0">-</button>
                            <button onclick="kbdInsert('${note.id}',' ')" class="bg-gray-600 hover:bg-gray-500 text-white px-0.5 sm:px-1 py-0.5 rounded text-xs min-w-0">space</button>
                            <button onclick="kbdBackspace('${note.id}')" class="bg-orange-600 hover:bg-orange-700 text-white px-0.5 sm:px-1 py-0.5 rounded text-xs min-w-0"><i class="fas fa-backspace"></i></button>
                            <button onclick="kbdClear('${note.id}')" class="bg-red-600 hover:bg-red-700 text-white px-0.5 sm:px-1 py-0.5 rounded text-xs min-w-0">Xóa hết</button>
                            <button onclick="toggleVirtualKeyboard('${note.id}')" class="bg-purple-600 hover:bg-purple-700 text-white px-0.5 sm:px-1 py-0.5 rounded text-xs min-w-0">Đóng</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        container.appendChild(card);
    });

    renderPagination(filtered);
}

function renderPagination(filtered) {
    const paginationEl = document.getElementById('pagination');
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if (totalPages <= 1) {
        paginationEl.innerHTML = '';
        return;
    }

    let html = '';
    // Prev
    html += '<button onclick="goToPage(' + (currentPage - 1) + ')" class="px-3 py-1.5 rounded text-sm transition ' + (currentPage === 1 ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-700 text-white hover:bg-purple-600') + '" ' + (currentPage === 1 ? 'disabled' : '') + '><i class="fas fa-chevron-left"></i></button>';

    const maxVisible = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    if (endPage - startPage + 1 < maxVisible) startPage = Math.max(1, endPage - maxVisible + 1);

    if (startPage > 1) {
        html += '<button onclick="goToPage(1)" class="px-3 py-1.5 rounded text-sm bg-gray-700 text-white hover:bg-purple-600 transition">1</button>';
        if (startPage > 2) html += '<span class="px-1 text-gray-400 text-sm">...</span>';
    }

    for (let i = startPage; i <= endPage; i++) {
        html += '<button onclick="goToPage(' + i + ')" class="px-3 py-1.5 rounded text-sm transition ' + (i === currentPage ? 'bg-purple-600 text-white' : 'bg-gray-700 text-white hover:bg-purple-600') + '">' + i + '</button>';
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) html += '<span class="px-1 text-gray-400 text-sm">...</span>';
        html += '<button onclick="goToPage(' + totalPages + ')" class="px-3 py-1.5 rounded text-sm bg-gray-700 text-white hover:bg-purple-600 transition">' + totalPages + '</button>';
    }

    // Next
    html += '<button onclick="goToPage(' + (currentPage + 1) + ')" class="px-3 py-1.5 rounded text-sm transition ' + (currentPage === totalPages ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-700 text-white hover:bg-purple-600') + '" ' + (currentPage === totalPages ? 'disabled' : '') + '><i class="fas fa-chevron-right"></i></button>';

    paginationEl.innerHTML = html;
}

function goToPage(page) {
    const filtered = getFilteredNotes();
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if (page < 1 || page > totalPages || page === currentPage) return;
    currentPage = page;
    renderNotes();
    document.getElementById('notesContainer').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function saveNote(docId) {
    if (!currentUser) {
        Swal.fire({ icon: "warning", title: "Chưa đăng nhập", text: "Vui lòng đăng nhập để lưu ghi chú!", background: "#1f2937", color: "#fff", confirmButtonColor: "#7c3aed" });
        return;
    }

    const epInput = document.getElementById('ep-' + docId);
    const noteInput = document.getElementById('note-' + docId);
    const savedEl = document.getElementById('saved-' + docId);

    const newEpisode = epInput ? epInput.value.trim() : '';
    const newNote = noteInput ? noteInput.value.trim() : '';

    const noteData = watchTimeNotes.find(n => n.id === docId);
    if (!noteData) return;

    try {
        const userRef = db.collection('users').doc(currentUser.uid);
        const notesRef = userRef.collection('watchTimeNotes');

        // Delete old doc
        await notesRef.doc(docId).delete();

        // Create new doc with updated data
        if (newEpisode || newNote) {
            await notesRef.doc(docId).set({
                movieSlug: noteData.movieSlug || '',
                movieTitle: noteData.movieTitle || '',
                episodeNumber: newEpisode,
                note: newNote,
                createdAt: noteData.createdAt || new Date(),
                updatedAt: new Date()
            });
        }

        // Update local array
        noteData.episodeNumber = newEpisode;
        noteData.note = newNote;
        noteData.updatedAt = new Date();

        savedEl.classList.remove('hidden');
        setTimeout(() => savedEl.classList.add('hidden'), 3000);
        showToast('Đã lưu ghi chú', 'success');
    } catch (err) {
        Swal.fire({ icon: "error", title: "Lỗi", text: "Không thể lưu: " + err.message, background: "#1f2937", color: "#fff", confirmButtonColor: "#7c3aed" });
    }
}

async function deleteNote(docId) {
    if (!currentUser) return;

    const noteData = watchTimeNotes.find(n => n.id === docId);
    if (!noteData) return;

    const result = await Swal.fire({
        title: "Xóa ghi chú?",
        text: "Xóa ghi chú của phim \"" + (noteData.movieTitle || noteData.movieSlug) + "\"?",
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
        await db.collection('users').doc(currentUser.uid).collection('watchTimeNotes').doc(docId).delete();
        watchTimeNotes = watchTimeNotes.filter(n => n.id !== docId);
        renderNotes();
        Swal.fire({ icon: "success", title: "Đã xóa!", timer: 1500, showConfirmButton: false, background: "#1f2937", color: "#fff" });
    } catch (err) {
        Swal.fire({ icon: "error", title: "Lỗi", text: err.message, background: "#1f2937", color: "#fff" });
    }
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function formatDate(date) {
    if (!date) return 'N/A';
    let d;
    if (date.toDate && typeof date.toDate === 'function') {
        d = date.toDate();
    } else if (date.seconds) {
        d = new Date(date.seconds * 1000);
    } else {
        d = new Date(date);
    }
    if (isNaN(d.getTime())) return 'N/A';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return day + '/' + month + '/' + year + ' ' + hours + ':' + minutes;
}

// Virtual Keyboard
function toggleVirtualKeyboard(id) {
    const kbd = document.getElementById('kbd-' + id);
    if (kbd) kbd.classList.toggle('hidden');
}

function getActiveInput(id) {
    const epInput = document.getElementById('ep-' + id);
    const noteInput = document.getElementById('note-' + id);
    // If note input is focused, use it; otherwise use episode input
    if (noteInput && document.activeElement === noteInput) return noteInput;
    if (epInput && document.activeElement === epInput) return epInput;
    // Default to note input if visible, else episode
    return noteInput || epInput;
}

function kbdInsert(id, char) {
    const input = getActiveInput(id);
    if (!input) return;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const val = input.value;
    input.value = val.slice(0, start) + char + val.slice(end);
    input.selectionStart = input.selectionEnd = start + char.length;
    input.focus();
}

function kbdBackspace(id) {
    const input = getActiveInput(id);
    if (!input) return;
    const start = input.selectionStart;
    if (start === 0) return;
    const val = input.value;
    input.value = val.slice(0, start - 1) + val.slice(start);
    input.selectionStart = input.selectionEnd = start - 1;
    input.focus();
}

function kbdClear(id) {
    const epInput = document.getElementById('ep-' + id);
    const noteInput = document.getElementById('note-' + id);
    if (epInput) epInput.value = '';
    if (noteInput) noteInput.value = '';
    if (epInput) epInput.focus();
}
