function createTabNavigation(activeTab) {
	const navigation = `
        <div class="mb-6">
            <div class="flex justify-center space-x-2">
                <button id="networkTab" class="tab-button ${activeTab === "network" ? "active" : ""}" onclick="window.location.href='network.html'">
                    <span class="material-icons text-base sm:text-lg">network_check</span>
                </button>
                <button id="personalTab" class="tab-button ${activeTab === "clock" ? "active" : ""}" onclick="window.location.href='clock.html'">
                    <span class="material-icons text-base sm:text-lg">access_time</span>
                </button>
            </div>
        </div>
    `;
	return navigation;
}
