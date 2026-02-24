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
    electricPrice: [
        { min: 0, max: 50, price: 2000 },      // 50 kWh đầu giá 2000
        { min: 51, max: 100, price: 2500 },    // 51-100 kWh giá 2500
        { min: 101, max: 200, price: 3000 },    // 101-200 kWh giá 3000
        { min: 201, max: null, price: 3500 }    // Trên 200 kWh giá 3500
    ],
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
    await loadData();
    
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
            loadRooms();
            break;
        case 'utilities.html':
            loadUtilities();
            loadRooms();
            loadPriceConfig();
            break;
        case 'bills.html':
            loadBills();
            break;
        case 'payments.html':
            loadPayments();
            break;
    }
}

// Firebase Load Functions
async function loadData() {
    try {
        // Load data from phongtro collection
        const phongtroDoc = await db.collection('phongtro').doc('data').get();
        
        if (phongtroDoc.exists) {
            const data = phongtroDoc.data();
            rooms = data.rooms || [];
            tenants = data.tenants || [];
            utilities = data.utilities || [];
            bills = data.bills || [];
            payments = data.payments || [];
            settings = data.settings || settings;
        } else {
            // Initialize with empty data if not exists
            await saveData();
        }
    } catch (error) {
        console.error('Error loading data from Firebase:', error);
        showNotification('Lỗi tải dữ liệu từ Firebase', 'error');
    }
}

// Firebase Save Functions
async function saveData() {
    try {
        // Save all data to single phongtro document
        const data = {
            rooms: rooms,
            tenants: tenants,
            utilities: utilities,
            bills: bills,
            payments: payments,
            settings: settings
        };
        
        await db.collection('phongtro').doc('data').set(data);
        
    } catch (error) {
        console.error('Error saving data to Firebase:', error);
        showNotification('Lỗi lưu dữ liệu lên Firebase', 'error');
    }
}

// Firebase Add Functions
async function addRoomToFirebase(room) {
    try {
        room.id = generateId();
        rooms.push(room);
        await saveData();
        return room;
    } catch (error) {
        console.error('Error adding room to Firebase:', error);
        throw error;
    }
}

async function addTenantToFirebase(tenant) {
    try {
        tenant.id = generateId();
        tenants.push(tenant);
        await saveData();
        return tenant;
    } catch (error) {
        console.error('Error adding tenant to Firebase:', error);
        throw error;
    }
}

async function addUtilityToFirebase(utility) {
    try {
        utility.id = generateId();
        utilities.push(utility);
        await saveData();
        return utility;
    } catch (error) {
        console.error('Error adding utility to Firebase:', error);
        throw error;
    }
}

async function addBillToFirebase(bill) {
    try {
        bill.id = generateId();
        bills.push(bill);
        await saveData();
        return bill;
    } catch (error) {
        console.error('Error adding bill to Firebase:', error);
        throw error;
    }
}

async function addPaymentToFirebase(payment) {
    try {
        payment.id = generateId();
        payments.push(payment);
        await saveData();
        return payment;
    } catch (error) {
        console.error('Error adding payment to Firebase:', error);
        throw error;
    }
}

// Firebase Update Functions
async function updateRoomInFirebase(roomId, roomData) {
    try {
        const index = rooms.findIndex(r => r.id === roomId);
        if (index !== -1) {
            rooms[index] = { ...rooms[index], ...roomData };
            await saveData();
        }
    } catch (error) {
        console.error('Error updating room in Firebase:', error);
        throw error;
    }
}

async function updateTenantInFirebase(tenantId, tenantData) {
    try {
        const index = tenants.findIndex(t => t.id === tenantId);
        if (index !== -1) {
            tenants[index] = { ...tenants[index], ...tenantData };
            await saveData();
        }
    } catch (error) {
        console.error('Error updating tenant in Firebase:', error);
        throw error;
    }
}

async function updateBillStatus(billId, status) {
    try {
        const index = bills.findIndex(b => b.id === billId);
        if (index !== -1) {
            bills[index].status = status;
            await saveData();
        }
        loadBills();
    } catch (error) {
        console.error('Error updating bill status:', error);
        throw error;
    }
}

// Firebase Delete Functions
async function deleteRoomFromFirebase(roomId) {
    try {
        rooms = rooms.filter(r => r.id !== roomId);
        await saveData();
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
    
    updateRoomSelects();
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
        
        rooms.filter(room => room.status === 'available' || select.id.includes('edit') || select.id.includes('filter') || select.id.includes('utility')).forEach(room => {
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

// Calculate electricity cost based on tiered pricing
function calculateElectricityCost(kwh) {
    let totalCost = 0;
    let remainingKwh = kwh;
    
    for (const tier of settings.electricPrice) {
        if (remainingKwh <= 0) break;
        
        const tierRange = tier.max ? tier.max - tier.min + 1 : remainingKwh;
        const kwhInTier = Math.min(remainingKwh, tierRange);
        
        totalCost += kwhInTier * tier.price;
        remainingKwh -= kwhInTier;
    }
    
    return totalCost;
}

// Utility Management
function loadUtilities() {
    const utilitiesList = document.getElementById('utilitiesList');
    if (!utilitiesList) return;
    
    utilitiesList.innerHTML = '';
    
    utilities.forEach(utility => {
        const row = document.createElement('tr');
        const room = rooms.find(r => r.id === utility.roomId);
        const electricUsage = utility.newElectric - utility.oldElectric;
        const waterUsage = utility.newWater - utility.oldWater;
        const electricCost = calculateElectricityCost(electricUsage);
        const waterCost = waterUsage * settings.waterPrice;
        const totalCost = electricCost + waterCost;
        
        row.innerHTML = `
            <td>${room ? room.number : 'N/A'}</td>
            <td>Tháng ${utility.month}/${utility.year}</td>
            <td>${utility.oldElectric}</td>
            <td>${utility.newElectric}</td>
            <td>${electricUsage} kWh</td>
            <td>${utility.oldWater}</td>
            <td>${utility.newWater}</td>
            <td>${waterUsage} m³</td>
            <td>${formatCurrency(totalCost)}</td>
            <td><span class="badge bg-success">Đã thanh toán</span></td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="editUtility('${utility.id}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-danger" onclick="deleteUtility('${utility.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        
        utilitiesList.appendChild(row);
    });
    
    // Update room selects
    updateRoomSelects();
}

async function addUtility() {
    const utility = {
        roomId: document.getElementById('utilityRoom').value,
        month: parseInt(document.getElementById('utilityMonth').value),
        year: parseInt(document.getElementById('utilityYear').value),
        oldElectric: parseInt(document.getElementById('oldElectric').value),
        newElectric: parseInt(document.getElementById('newElectric').value),
        oldWater: parseInt(document.getElementById('oldWater').value),
        newWater: parseInt(document.getElementById('newWater').value),
        notes: document.getElementById('utilityNotes').value,
        createdAt: new Date().toISOString()
    };
    
    try {
        await addUtilityToFirebase(utility);
        loadUtilities();
        closeModal('addUtilityModal');
        showNotification('Ghi chỉ số thành công!', 'success');
    } catch (error) {
        showNotification('Lỗi ghi chỉ số: ' + error.message, 'error');
    }
}

function editUtility(utilityId) {
    const utility = utilities.find(u => u.id === utilityId);
    if (!utility) return;
    
    // Fill edit form with utility data
    document.getElementById('utilityRoom').value = utility.roomId;
    document.getElementById('utilityMonth').value = utility.month;
    document.getElementById('utilityYear').value = utility.year;
    document.getElementById('oldElectric').value = utility.oldElectric;
    document.getElementById('newElectric').value = utility.newElectric;
    document.getElementById('oldWater').value = utility.oldWater;
    document.getElementById('newWater').value = utility.newWater;
    document.getElementById('utilityNotes').value = utility.notes;
    
    openModal('addUtilityModal');
}

async function deleteUtility(utilityId) {
    if (confirm('Bạn có chắc muốn xóa bản ghi này?')) {
        try {
            await deleteUtilityFromFirebase(utilityId);
            loadUtilities();
            showNotification('Xóa bản ghi thành công!', 'success');
        } catch (error) {
            showNotification('Lỗi xóa bản ghi: ' + error.message, 'error');
        }
    }
}

async function deleteUtilityFromFirebase(utilityId) {
    try {
        await db.collection('utilities').doc(utilityId).delete();
        utilities = utilities.filter(u => u.id !== utilityId);
    } catch (error) {
        console.error('Error deleting utility from Firebase:', error);
        throw error;
    }
}

function savePriceConfig() {
    settings.electricPrice = [
        { min: 0, max: 50, price: parseInt(document.getElementById('electricPrice1').value) },
        { min: 51, max: 100, price: parseInt(document.getElementById('electricPrice2').value) },
        { min: 101, max: 200, price: parseInt(document.getElementById('electricPrice3').value) },
        { min: 201, max: null, price: parseInt(document.getElementById('electricPrice4').value) }
    ];
    settings.waterPrice = parseInt(document.getElementById('waterPrice').value);
    settings.serviceFee = parseInt(document.getElementById('serviceFee').value);
    
    // Save to Firebase or localStorage
    localStorage.setItem('settings', JSON.stringify(settings));
    
    closeModal('priceConfigModal');
    showNotification('Lưu cấu hình giá thành công!', 'success');
    
    // Refresh utilities list to recalculate costs
    if (document.getElementById('utilitiesList')) {
        loadUtilities();
    }
}

function loadPriceConfig() {
    // Load saved settings or use defaults
    const savedSettings = localStorage.getItem('settings');
    if (savedSettings) {
        settings = JSON.parse(savedSettings);
    }
    
    // Update price config form
    if (document.getElementById('electricPrice1')) {
        document.getElementById('electricPrice1').value = settings.electricPrice[0].price;
        document.getElementById('electricPrice2').value = settings.electricPrice[1].price;
        document.getElementById('electricPrice3').value = settings.electricPrice[2].price;
        document.getElementById('electricPrice4').value = settings.electricPrice[3].price;
        document.getElementById('waterPrice').value = settings.waterPrice;
        document.getElementById('serviceFee').value = settings.serviceFee;
    }
}

// Add event listeners for modals
document.addEventListener('DOMContentLoaded', function() {
    // Listen for modal show events
    document.getElementById('addUtilityModal')?.addEventListener('show.bs.modal', function () {
        updateRoomSelects();
    });
    
    document.getElementById('priceConfigModal')?.addEventListener('show.bs.modal', function () {
        loadPriceConfig();
    });
});

// Generate bills from utilities
async function generateBills() {
    try {
        // Get current month and year
        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();
        
        // Find utilities for current month that don't have bills yet
        const currentUtilities = utilities.filter(u => 
            u.month === currentMonth && 
            u.year === currentYear &&
            !bills.some(b => b.utilityId === u.id)
        );
        
        if (currentUtilities.length === 0) {
            showNotification('Không có dữ liệu điện nước cho tháng này hoặc hóa đơn đã được tạo!', 'warning');
            return;
        }
        
        // Generate bills for each utility
        for (const utility of currentUtilities) {
            const room = rooms.find(r => r.id === utility.roomId);
            const tenant = tenants.find(t => t.roomId === utility.roomId && t.status === 'active');
            
            if (!room || !tenant) continue;
            
            const electricUsage = utility.newElectric - utility.oldElectric;
            const waterUsage = utility.newWater - utility.oldWater;
            const electricCost = calculateElectricityCost(electricUsage);
            const waterCost = waterUsage * settings.waterPrice;
            const totalAmount = room.price + electricCost + waterCost + settings.serviceFee;
            
            const bill = {
                utilityId: utility.id,
                roomId: utility.roomId,
                tenantId: tenant.id,
                month: utility.month,
                year: utility.year,
                roomPrice: room.price,
                electricUsage: electricUsage,
                electricCost: electricCost,
                waterUsage: waterUsage,
                waterCost: waterCost,
                serviceFee: settings.serviceFee,
                totalAmount: totalAmount,
                status: 'pending',
                createdAt: new Date().toISOString()
            };
            
            await addBillToFirebase(bill);
        }
        
        loadBills();
        showNotification(`Đã tạo ${currentUtilities.length} hóa đơn thành công!`, 'success');
        
    } catch (error) {
        console.error('Error generating bills:', error);
        showNotification('Lỗi tạo hóa đơn: ' + error.message, 'error');
    }
}

// Generate all bills for all rooms with utilities data
async function generateAllBills() {
    try {
        // Get current month and year
        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();
        
        // Find all utilities that don't have bills yet
        const availableUtilities = utilities.filter(u => 
            !bills.some(b => b.utilityId === u.id)
        );
        
        if (availableUtilities.length === 0) {
            showNotification('Không có dữ liệu điện nước nào chưa tạo hóa đơn!', 'warning');
            return;
        }
        
        let billsCreated = 0;
        
        // Generate bills for each utility
        for (const utility of availableUtilities) {
            const room = rooms.find(r => r.id === utility.roomId);
            const tenant = tenants.find(t => t.roomId === utility.roomId && t.status === 'active');
            
            if (!room || !tenant) continue;
            
            const electricUsage = utility.newElectric - utility.oldElectric;
            const waterUsage = utility.newWater - utility.oldWater;
            const electricCost = calculateElectricityCost(electricUsage);
            const waterCost = waterUsage * settings.waterPrice;
            const totalAmount = room.price + electricCost + waterCost + settings.serviceFee;
            
            const bill = {
                utilityId: utility.id,
                roomId: utility.roomId,
                tenantId: tenant.id,
                month: utility.month,
                year: utility.year,
                roomPrice: room.price,
                electricUsage: electricUsage,
                electricCost: electricCost,
                waterUsage: waterUsage,
                waterCost: waterCost,
                serviceFee: settings.serviceFee,
                totalAmount: totalAmount,
                status: 'pending',
                createdAt: new Date().toISOString()
            };
            
            await addBillToFirebase(bill);
            billsCreated++;
        }
        
        loadBills();
        showNotification(`Đã tạo ${billsCreated} hóa đơn thành công!`, 'success');
        
    } catch (error) {
        console.error('Error generating all bills:', error);
        showNotification('Lỗi tạo hóa đơn: ' + error.message, 'error');
    }
}
// Bill Management
function loadBills() {
    const billsList = document.getElementById('billsList');
    if (!billsList) return;
    
    billsList.innerHTML = '';
    
    bills.forEach(bill => {
        const row = document.createElement('tr');
        const room = rooms.find(r => r.id === bill.roomId);
        const tenant = tenants.find(t => t.id === bill.tenantId);
        
        const statusClass = bill.status === 'paid' ? 'bg-success' : 'bg-warning';
        const statusText = bill.status === 'paid' ? 'Đã thanh toán' : 'Chờ thanh toán';
        
        row.innerHTML = `
            <td>${tenant ? tenant.name : 'N/A'}</td>
            <td>${room ? room.number : 'N/A'}</td>
            <td>Tháng ${bill.month}/${bill.year}</td>
            <td>${formatCurrency(bill.roomPrice)}</td>
            <td>${bill.electricUsage} kWh</td>
            <td>${formatCurrency(bill.electricCost)}</td>
            <td>${bill.waterUsage} m³</td>
            <td>${formatCurrency(bill.waterCost)}</td>
            <td>${formatCurrency(bill.serviceFee)}</td>
            <td><strong>${formatCurrency(bill.totalAmount)}</strong></td>
            <td><span class="badge ${statusClass}">${statusText}</span></td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="viewBill('${bill.id}')">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="btn btn-sm btn-success" onclick="payBill('${bill.id}')" ${bill.status === 'paid' ? 'disabled' : ''}>
                    <i class="fas fa-money-bill"></i>
                </button>
                <button class="btn btn-sm btn-danger" onclick="deleteBill('${bill.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        
        billsList.appendChild(row);
    });
}

function viewBill(billId) {
    const bill = bills.find(b => b.id === billId);
    if (!bill) return;
    
    const room = rooms.find(r => r.id === bill.roomId);
    const tenant = tenants.find(t => t.id === bill.tenantId);
    
    const billDetails = `
        Chi tiết hóa đơn
        Khách thuê: ${tenant ? tenant.name : 'N/A'}
        Phòng: ${room ? room.number : 'N/A'}
        Tháng/Năm: Tháng ${bill.month}/${bill.year}
        ----------------------------------------
        Tiền phòng: ${formatCurrency(bill.roomPrice)}
        Tiền điện (${bill.electricUsage} kWh): ${formatCurrency(bill.electricCost)}
        Tiền nước (${bill.waterUsage} m³): ${formatCurrency(bill.waterCost)}
        Phí dịch vụ: ${formatCurrency(bill.serviceFee)}
        ----------------------------------------
        Tổng cộng: ${formatCurrency(bill.totalAmount)}
        Trạng thái: ${bill.status === 'paid' ? 'Đã thanh toán' : 'Chờ thanh toán'}
    `;
    
    alert(billDetails);
}

async function payBill(billId) {
    if (confirm('Xác nhận thanh toán hóa đơn này?')) {
        try {
            await updateBillStatus(billId, 'paid');
            showNotification('Thanh toán hóa đơn thành công!', 'success');
        } catch (error) {
            showNotification('Lỗi thanh toán: ' + error.message, 'error');
        }
    }
}

async function updateBillStatus(billId, status) {
    try {
        await db.collection('bills').doc(billId).update({ status: status });
        const bill = bills.find(b => b.id === billId);
        if (bill) {
            bill.status = status;
        }
        loadBills();
    } catch (error) {
        console.error('Error updating bill status:', error);
        throw error;
    }
}

async function deleteBill(billId) {
    if (confirm('Bạn có chắc muốn xóa hóa đơn này?')) {
        try {
            await db.collection('bills').doc(billId).delete();
            bills = bills.filter(b => b.id !== billId);
            loadBills();
            showNotification('Xóa hóa đơn thành công!', 'success');
        } catch (error) {
            showNotification('Lỗi xóa hóa đơn: ' + error.message, 'error');
        }
    }
}
