function createTabNavigation(activeTab) {
    const navigation = `
        <div class="mb-4">
            <div class="flex justify-center space-x-1">
                <button id="networkTab" class="tab-button ${activeTab === "network" ? "active" : ""}" onclick="window.location.href='network.html'">
                    <span class="material-icons text-sm sm:text-base">network_check</span>
                </button>
                <button id="clockTab" class="tab-button ${activeTab === "clock" ? "active" : ""}" onclick="window.location.href='clock.html'">
                    <span class="material-icons text-sm sm:text-base">access_time</span>
                </button>
                <button id="calendarTab" class="tab-button ${activeTab === "calendar" ? "active" : ""}" onclick="window.location.href='calendar.html'">
                    <span class="material-icons text-sm sm:text-base">calendar_today</span>
                </button>
                <button id="weatherTab" class="tab-button ${activeTab === "weather" ? "active" : ""}" onclick="window.location.href='weather.html'">
                    <span class="material-icons text-sm sm:text-base">wb_sunny</span>
                </button>
            </div>
        </div>
    `;
    return navigation;
}
