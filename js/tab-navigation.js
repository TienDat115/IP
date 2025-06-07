function createTabNavigation(activeTab) {
	// Thêm link đến file CSS nếu chưa tồn tại
	if (!document.querySelector('link[href*="tabs.css"]')) {
		const link = document.createElement('link');
		link.rel = 'stylesheet';
		link.href = '../css/tabs.css';
		document.head.appendChild(link);
	}

	const tabs = [
		{ id: 'network', icon: 'network_check', label: 'Mạng' },
		{ id: 'clock', icon: 'access_time', label: 'Đồng hồ' },
		{ id: 'calendar', icon: 'calendar_today', label: 'Lịch' },
		{ id: 'weather', icon: 'wb_sunny', label: 'Thời tiết' }
	];

	const navigation = `
		<div class="tab-navigation-container">
			<div class="flex justify-center space-x-1">
				${tabs.map(tab => `
					<button 
						id="${tab.id}Tab" 
						class="tab-button ${activeTab === tab.id ? 'active' : ''}" 
						onclick="window.location.href='${tab.id}.html'"
						aria-label="${tab.label}"
					>
						<span class="material-icons">${tab.icon}</span>
						<span class="sr-only">${tab.label}</span>
					</button>
				`).join('')}
			</div>
		</div>
	`;
	
	return navigation;
}
