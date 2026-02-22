// Firebase Configuration
// Include Firebase SDK in HTML before this script
// <script src="https://www.gstatic.com/firebasejs/9.6.1/firebase-app-compat.js"></script>
// <script src="https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore-compat.js"></script>
// <script src="https://www.gstatic.com/firebasejs/9.6.1/firebase-auth-compat.js"></script>

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyA0lOPK7ngRqblR6osPdUyGeoH9uUEQNo8",
    authDomain: "discordwebhooks-c3158.firebaseapp.com",
    projectId: "discordwebhooks-c3158",
    storageBucket: "discordwebhooks-c3158.firebasestorage.app",
    messagingSenderId: "75120159974",
    appId: "1:75120159974:web:bd9bee21fd8639b25d9f27",
    measurementId: "G-H06TGKVTP8"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// Data Management
let rooms = [];
let tenants = [];
let utilities = [];
let bills = [];
let payments = [];
let settings = {
    electricPrice: 3500,
    waterPrice: 25000,
    serviceFee: 100000,
    ownerName: 'Chủ Trọ',
    ownerAddress: 'Địa chỉ',
    ownerPhone: 'Số điện thoại'
};

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

async function initializeApp() {
    // Set current date for date inputs
    const today = new Date().toISOString().split('T')[0];
    document.querySelectorAll('input[type="date"]').forEach(input => {
        if (!input.value) input.value = today;
    });
    
    // Load data from Firebase
    await loadDataFromFirebase();
    
    // Load data based on current page
    const currentPage = window.location.pathname.split('/').pop();
    switch(currentPage) {
        case 'index.html':
            loadDashboard();
            break;
        case 'rooms.html':
            loadRooms();
            break;
        case 'tenants.html':
            loadTenants();
            break;
        case 'utilities.html':
            loadUtilities();
            break;
        case 'bills.html':
            loadBills();
            break;
        case 'payments.html':
            loadPayments();
            break;
    }
}

// Firebase Data Loading Functions
async function loadDataFromFirebase() {
    try {
        const roomsSnapshot = await db.collection('rooms').get();
        rooms = roomsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        const tenantsSnapshot = await db.collection('tenants').get();
        tenants = tenantsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        const utilitiesSnapshot = await db.collection('utilities').get();
        utilities = utilitiesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        const billsSnapshot = await db.collection('bills').get();
        bills = billsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        const paymentsSnapshot = await db.collection('payments').get();
        payments = paymentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        const settingsDoc = await db.collection('settings').doc('config').get();
        if (settingsDoc.exists) {
            settings = settingsDoc.data();
        }
    } catch (error) {
        console.error('Error loading data from Firebase:', error);
        showNotification('Lỗi tải dữ liệu từ Firebase', 'error');
    }
}

// Firebase Save Functions
async function saveData() {
    try {
        // Save rooms
        const roomsBatch = db.batch();
        rooms.forEach(room => {
            const docRef = db.collection('rooms').doc(room.id);
            roomsBatch.set(docRef, room);
        });
        await roomsBatch.commit();
        
        // Save tenants
        const tenantsBatch = db.batch();
        tenants.forEach(tenant => {
            const docRef = db.collection('tenants').doc(tenant.id);
            tenantsBatch.set(docRef, tenant);
        });
        await tenantsBatch.commit();
        
        // Save utilities
        const utilitiesBatch = db.batch();
        utilities.forEach(utility => {
            const docRef = db.collection('utilities').doc(utility.id);
            utilitiesBatch.set(docRef, utility);
        });
        await utilitiesBatch.commit();
        
        // Save bills
        const billsBatch = db.batch();
        bills.forEach(bill => {
            const docRef = db.collection('bills').doc(bill.id);
            billsBatch.set(docRef, bill);
        });
        await billsBatch.commit();
        
        // Save payments
        const paymentsBatch = db.batch();
        payments.forEach(payment => {
            const docRef = db.collection('payments').doc(payment.id);
            paymentsBatch.set(docRef, payment);
        });
        await paymentsBatch.commit();
        
        // Save settings
        await db.collection('settings').doc('config').set(settings);
        
    } catch (error) {
        console.error('Error saving data to Firebase:', error);
        showNotification('Lỗi lưu dữ liệu lên Firebase', 'error');
    }
}

// Firebase Add Functions
async function addRoomToFirebase(room) {
    try {
        const docRef = await db.collection('rooms').add(room);
        room.id = docRef.id;
        rooms.push(room);
        return room;
    } catch (error) {
        console.error('Error adding room to Firebase:', error);
        throw error;
    }
}

async function addTenantToFirebase(tenant) {
    try {
        const docRef = await db.collection('tenants').add(tenant);
        tenant.id = docRef.id;
        tenants.push(tenant);
        return tenant;
    } catch (error) {
        console.error('Error adding tenant to Firebase:', error);
        throw error;
    }
}

async function addUtilityToFirebase(utility) {
    try {
        const docRef = await db.collection('utilities').add(utility);
        utility.id = docRef.id;
        utilities.push(utility);
        return utility;
    } catch (error) {
        console.error('Error adding utility to Firebase:', error);
        throw error;
    }
}

async function addBillToFirebase(bill) {
    try {
        const docRef = await db.collection('bills').add(bill);
        bill.id = docRef.id;
        bills.push(bill);
        return bill;
    } catch (error) {
        console.error('Error adding bill to Firebase:', error);
        throw error;
    }
}

async function addPaymentToFirebase(payment) {
    try {
        const docRef = await db.collection('payments').add(payment);
        payment.id = docRef.id;
        payments.push(payment);
        return payment;
    } catch (error) {
        console.error('Error adding payment to Firebase:', error);
        throw error;
    }
}

// Firebase Update Functions
async function updateRoomInFirebase(roomId, roomData) {
    try {
        await db.collection('rooms').doc(roomId).update(roomData);
        const index = rooms.findIndex(r => r.id === roomId);
        if (index !== -1) {
            rooms[index] = { ...rooms[index], ...roomData };
        }
    } catch (error) {
        console.error('Error updating room in Firebase:', error);
        throw error;
    }
}

async function updateTenantInFirebase(tenantId, tenantData) {
    try {
        await db.collection('tenants').doc(tenantId).update(tenantData);
        const index = tenants.findIndex(t => t.id === tenantId);
        if (index !== -1) {
            tenants[index] = { ...tenants[index], ...tenantData };
        }
    } catch (error) {
        console.error('Error updating tenant in Firebase:', error);
        throw error;
    }
}

// Firebase Delete Functions
async function deleteRoomFromFirebase(roomId) {
    try {
        await db.collection('rooms').doc(roomId).delete();
        rooms = rooms.filter(r => r.id !== roomId);
    } catch (error) {
        console.error('Error deleting room from Firebase:', error);
        throw error;
    }
}

async function deleteTenantFromFirebase(tenantId) {
    try {
        await db.collection('tenants').doc(tenantId).delete();
        tenants = tenants.filter(t => t.id !== tenantId);
    } catch (error) {
        console.error('Error deleting tenant from Firebase:', error);
        throw error;
    }
}

// Dashboard Functions
function loadDashboard() {
    updateDashboardStats();
    loadRecentActivities();
    loadPendingPayments();
    loadRevenueChart();
}

function updateDashboardStats() {
    const totalRooms = rooms.length;
    const availableRooms = rooms.filter(r => r.status === 'available').length;
    const totalTenants = tenants.filter(t => t.status === 'active').length;
    const monthlyRevenue = calculateMonthlyRevenue();
    
    document.getElementById('totalRooms').textContent = totalRooms;
    document.getElementById('availableRooms').textContent = availableRooms;
    document.getElementById('totalTenants').textContent = totalTenants;
    document.getElementById('monthlyRevenue').textContent = formatCurrency(monthlyRevenue);
}

function calculateMonthlyRevenue() {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    return payments
        .filter(p => {
            const paymentDate = new Date(p.date);
            return paymentDate.getMonth() === currentMonth && 
                   paymentDate.getFullYear() === currentYear;
        })
        .reduce((total, p) => total + p.amount, 0);
}

// Room Management
function loadRooms() {
    const roomsList = document.getElementById('roomsList');
    if (!roomsList) return;
    
    const filteredRooms = filterRooms();
    roomsList.innerHTML = '';
    
    filteredRooms.forEach(room => {
        const roomCard = createRoomCard(room);
        roomsList.appendChild(roomCard);
    });
    
    updateRoomSelects();
}

function createRoomCard(room) {
    const col = document.createElement('div');
    col.className = 'col-md-4';
    
    const statusClass = `room-status-${room.status}`;
    const statusText = getStatusText(room.status);
    const tenant = tenants.find(t => t.roomId === room.id && t.status === 'active');
    
    col.innerHTML = `
        <div class="card room-card ${statusClass}" onclick="editRoom('${room.id}')">
            <div class="card-body">
                <h5 class="card-title">Phòng ${room.number}</h5>
                <p class="card-text">
                    <strong>Giá:</strong> ${formatCurrency(room.price)}<br>
                    <strong>Diện tích:</strong> ${room.area}m²<br>
                    <strong>Loại:</strong> ${getRoomTypeText(room.type)}<br>
                    <strong>Trạng thái:</strong> <span class="badge ${statusClass}">${statusText}</span><br>
                    ${tenant ? `<strong>Khách thuê:</strong> ${tenant.name}<br>` : ''}
                </p>
                <div class="btn-group w-100" role="group">
                    <button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); editRoom('${room.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="event.stopPropagation(); deleteRoom('${room.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        </div>
    `;
    
    return col;
}

async function addRoom() {
    const room = {
        number: document.getElementById('roomNumber').value,
        price: parseInt(document.getElementById('roomPrice').value),
        area: parseInt(document.getElementById('roomArea').value),
        type: document.getElementById('roomType').value,
        description: document.getElementById('roomDescription').value,
        status: 'available',
        createdAt: new Date().toISOString()
    };
    
    try {
        await addRoomToFirebase(room);
        loadRooms();
        closeModal('addRoomModal');
        showNotification('Thêm phòng thành công!', 'success');
    } catch (error) {
        showNotification('Lỗi thêm phòng: ' + error.message, 'error');
    }
}

function editRoom(roomId) {
    const room = rooms.find(r => r.id === roomId);
    if (!room) return;
    
    document.getElementById('editRoomId').value = room.id;
    document.getElementById('editRoomNumber').value = room.number;
    document.getElementById('editRoomPrice').value = room.price;
    document.getElementById('editRoomArea').value = room.area;
    document.getElementById('editRoomType').value = room.type;
    document.getElementById('editRoomStatus').value = room.status;
    document.getElementById('editRoomDescription').value = room.description;
    
    openModal('editRoomModal');
}

async function updateRoom() {
    const roomId = document.getElementById('editRoomId').value;
    const roomData = {
        number: document.getElementById('editRoomNumber').value,
        price: parseInt(document.getElementById('editRoomPrice').value),
        area: parseInt(document.getElementById('editRoomArea').value),
        type: document.getElementById('editRoomType').value,
        status: document.getElementById('editRoomStatus').value,
        description: document.getElementById('editRoomDescription').value
    };
    
    try {
        await updateRoomInFirebase(roomId, roomData);
        loadRooms();
        closeModal('editRoomModal');
        showNotification('Cập nhật phòng thành công!', 'success');
    } catch (error) {
        showNotification('Lỗi cập nhật phòng: ' + error.message, 'error');
    }
}

async function deleteRoom(roomId) {
    if (confirm('Bạn có chắc muốn xóa phòng này?')) {
        try {
            await deleteRoomFromFirebase(roomId);
            loadRooms();
            showNotification('Xóa phòng thành công!', 'success');
        } catch (error) {
            showNotification('Lỗi xóa phòng: ' + error.message, 'error');
        }
    }
}

// Tenant Management
function loadTenants() {
    const tenantsList = document.getElementById('tenantsList');
    if (!tenantsList) return;
    
    const filteredTenants = filterTenants();
    tenantsList.innerHTML = '';
    
    filteredTenants.forEach(tenant => {
        const row = createTenantRow(tenant);
        tenantsList.appendChild(row);
    });
    
    updateTenantSelects();
}

function createTenantRow(tenant) {
    const row = document.createElement('tr');
    const room = rooms.find(r => r.id === tenant.roomId);
    const statusClass = tenant.status === 'active' ? 'status-occupied' : 'status-available';
    const statusText = tenant.status === 'active' ? 'Đang thuê' : 'Đã rời đi';
    
    row.innerHTML = `
        <td>${tenant.name}</td>
        <td>${tenant.phone}</td>
        <td>${tenant.idCard}</td>
        <td>${room ? room.number : 'N/A'}</td>
        <td>${formatDate(tenant.startDate)}</td>
        <td><span class="badge ${statusClass}">${statusText}</span></td>
        <td>
            <button class="btn btn-sm btn-primary" onclick="editTenant('${tenant.id}')">
                <i class="fas fa-edit"></i>
            </button>
            <button class="btn btn-sm btn-danger" onclick="deleteTenant('${tenant.id}')">
                <i class="fas fa-trash"></i>
            </button>
        </td>
    `;
    
    return row;
}

async function addTenant() {
    const tenant = {
        name: document.getElementById('tenantName').value,
        phone: document.getElementById('tenantPhone').value,
        idCard: document.getElementById('tenantIdCard').value,
        birthdate: document.getElementById('tenantBirthdate').value,
        roomId: document.getElementById('tenantRoom').value,
        startDate: document.getElementById('tenantStartDate').value,
        address: document.getElementById('tenantAddress').value,
        email: document.getElementById('tenantEmail').value,
        notes: document.getElementById('tenantNotes').value,
        status: 'active',
        createdAt: new Date().toISOString()
    };
    
    try {
        await addTenantToFirebase(tenant);
        
        // Update room status
        const room = rooms.find(r => r.id === tenant.roomId);
        if (room) {
            await updateRoomInFirebase(room.id, { status: 'occupied' });
        }
        
        loadTenants();
        loadRooms();
        closeModal('addTenantModal');
        showNotification('Thêm khách thuê thành công!', 'success');
    } catch (error) {
        showNotification('Lỗi thêm khách thuê: ' + error.message, 'error');
    }
}

function editTenant(tenantId) {
    const tenant = tenants.find(t => t.id === tenantId);
    if (!tenant) return;
    
    document.getElementById('editTenantId').value = tenant.id;
    document.getElementById('editTenantName').value = tenant.name;
    document.getElementById('editTenantPhone').value = tenant.phone;
    document.getElementById('editTenantIdCard').value = tenant.idCard;
    document.getElementById('editTenantBirthdate').value = tenant.birthdate;
    document.getElementById('editTenantRoom').value = tenant.roomId;
    document.getElementById('editTenantStatus').value = tenant.status;
    document.getElementById('editTenantAddress').value = tenant.address;
    document.getElementById('editTenantEmail').value = tenant.email;
    document.getElementById('editTenantNotes').value = tenant.notes;
    
    openModal('editTenantModal');
}

async function deleteTenant(tenantId) {
    if (confirm('Bạn có chắc muốn xóa khách thuê này?')) {
        try {
            await deleteTenantFromFirebase(tenantId);
            loadTenants();
            showNotification('Xóa khách thuê thành công!', 'success');
        } catch (error) {
            showNotification('Lỗi xóa khách thuê: ' + error.message, 'error');
        }
    }
}

async function updateTenant() {
    const tenantId = document.getElementById('editTenantId').value;
    const tenantData = {
        name: document.getElementById('editTenantName').value,
        phone: document.getElementById('editTenantPhone').value,
        idCard: document.getElementById('editTenantIdCard').value,
        birthdate: document.getElementById('editTenantBirthdate').value,
        roomId: document.getElementById('editTenantRoom').value,
        status: document.getElementById('editTenantStatus').value,
        address: document.getElementById('editTenantAddress').value,
        email: document.getElementById('editTenantEmail').value,
        notes: document.getElementById('editTenantNotes').value
    };
    
    try {
        await updateTenantInFirebase(tenantId, tenantData);
        loadTenants();
        loadRooms();
        closeModal('editTenantModal');
        showNotification('Cập nhật khách thuê thành công!', 'success');
    } catch (error) {
        showNotification('Lỗi cập nhật khách thuê: ' + error.message, 'error');
    }
}

// Utility Functions
function formatCurrency(amount) {
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND'
    }).format(amount);
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN');
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `alert alert-${type} notification`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

function openModal(modalId) {
    const modal = new bootstrap.Modal(document.getElementById(modalId));
    modal.show();
}

function closeModal(modalId) {
    const modal = bootstrap.Modal.getInstance(document.getElementById(modalId));
    if (modal) modal.hide();
}

function getStatusText(status) {
    const statusMap = {
        'available': 'Trống',
        'occupied': 'Đang thuê',
        'maintenance': 'Bảo trì'
    };
    return statusMap[status] || status;
}

function getRoomTypeText(type) {
    const typeMap = {
        'single': 'Phòng đơn',
        'double': 'Phòng đôi',
        'deluxe': 'Phòng cao cấp'
    };
    return typeMap[type] || type;
}

// Filter Functions
function filterRooms() {
    const searchTerm = document.getElementById('searchRoom')?.value.toLowerCase() || '';
    const statusFilter = document.getElementById('filterStatus')?.value || '';
    const sortBy = document.getElementById('sortBy')?.value || 'number';
    
    let filtered = rooms.filter(room => {
        const matchesSearch = room.number.toLowerCase().includes(searchTerm) ||
                            room.description.toLowerCase().includes(searchTerm);
        const matchesStatus = !statusFilter || room.status === statusFilter;
        return matchesSearch && matchesStatus;
    });
    
    // Sort
    filtered.sort((a, b) => {
        switch(sortBy) {
            case 'number':
                return a.number.localeCompare(b.number);
            case 'price':
                return a.price - b.price;
            case 'status':
                return a.status.localeCompare(b.status);
            default:
                return 0;
        }
    });
    
    return filtered;
}

function filterTenants() {
    const searchTerm = document.getElementById('searchTenant')?.value.toLowerCase() || '';
    const roomFilter = document.getElementById('filterRoom')?.value || '';
    const statusFilter = document.getElementById('filterStatus')?.value || '';
    
    return tenants.filter(tenant => {
        const matchesSearch = tenant.name.toLowerCase().includes(searchTerm) ||
                            tenant.phone.includes(searchTerm);
        const matchesRoom = !roomFilter || tenant.roomId === roomFilter;
        const matchesStatus = !statusFilter || tenant.status === statusFilter;
        return matchesSearch && matchesRoom && matchesStatus;
    });
}

// Update Select Elements
function updateRoomSelects() {
    const selects = document.querySelectorAll('#tenantRoom, #editTenantRoom, #utilityRoom, #filterRoom');
    selects.forEach(select => {
        const currentValue = select.value;
        select.innerHTML = '<option value="">Chọn phòng</option>';
        
        rooms.filter(room => room.status === 'available' || select.id.includes('filter')).forEach(room => {
            const option = document.createElement('option');
            option.value = room.id;
            option.textContent = `Phòng ${room.number} - ${formatCurrency(room.price)}`;
            select.appendChild(option);
        });
        
        select.value = currentValue;
    });
}

function updateTenantSelects() {
    // Update tenant selects if needed
}

// Initialize sample data
async function initializeSampleData() {
    if (rooms.length === 0) {
        // Sample rooms
        for (let i = 1; i <= 6; i++) {
            const room = {
                number: i.toString(),
                price: 1500000 + (i * 100000),
                area: 20 + (i * 2),
                type: i <= 2 ? 'single' : i <= 4 ? 'double' : 'deluxe',
                description: `Phòng ${i} description`,
                status: i <= 3 ? 'occupied' : 'available',
                createdAt: new Date().toISOString()
            };
            await addRoomToFirebase(room);
        }
    }
}

// Call initialize sample data when page loads
window.addEventListener('load', () => {
    setTimeout(initializeSampleData, 1000);
});
