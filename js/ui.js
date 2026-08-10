/* MotoCare - UI Rendering Engine */
import { Vehicles, MaintenanceLogs, FuelLogs, Stats, Presets } from './db.js';
import { VEHICLE_TYPES } from './presets.js';

export const UI = {
    // Show toast notification
    showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        if (!toast) return;

        toast.className = 'toast-notification'; // Reset
        toast.classList.add(`toast-${type}`);
        toast.innerText = message;
        toast.classList.remove('hidden');

        // Clear existing timeout if any
        if (this.toastTimeout) clearTimeout(this.toastTimeout);

        this.toastTimeout = setTimeout(() => {
            toast.classList.add('hidden');
        }, 3000);
    },

    // Render active vehicle selector in Header
    renderHeaderVehicleSelector() {
        const select = document.getElementById('active-vehicle-select');
        if (!select) return;

        const vehicles = Vehicles.getAll();
        const activeId = Vehicles.getActiveId();

        select.innerHTML = '<option value="">-- Chọn xe --</option>';
        vehicles.forEach(v => {
            const opt = document.createElement('option');
            opt.value = v.id;
            opt.innerText = `${v.name} ${v.plate ? '(' + v.plate + ')' : ''}`;
            if (v.id === activeId) opt.selected = true;
            select.appendChild(opt);
        });
    },

    // Render Dashboard
    renderDashboard(vehicleId) {
        const nameEl = document.getElementById('active-vehicle-name');
        const plateEl = document.getElementById('active-vehicle-plate');
        const odoInput = document.getElementById('current-odo-input');
        const healthGrid = document.getElementById('maintenance-health-grid');

        if (!nameEl || !plateEl || !odoInput || !healthGrid) return;

        const vehicle = Vehicles.getById(vehicleId);

        if (!vehicle) {
            nameEl.innerText = "Chưa có xe";
            plateEl.innerText = "Hãy thêm xe mới trong phần Nhà xe";
            odoInput.value = "";
            odoInput.disabled = true;
            healthGrid.innerHTML = `
                <div class="empty-state">
                    <p>Vui lòng thêm xe tại tab <strong>Nhà xe</strong> để bắt đầu theo dõi sức khỏe phụ tùng.</p>
                </div>
            `;
            return;
        }

        // Set Vehicle details
        nameEl.innerText = vehicle.name;
        plateEl.innerText = `${VEHICLE_TYPES[vehicle.type]} ${vehicle.plate ? '• ' + vehicle.plate : ''}`;
        
        odoInput.value = vehicle.currentOdo;
        odoInput.disabled = false;

        // Render health grid
        const healthStatus = Stats.getHealthStatus(vehicleId);
        healthGrid.innerHTML = '';

        if (healthStatus.length === 0) {
            healthGrid.innerHTML = '<div class="empty-state"><p>Không có hạng mục bảo dưỡng nào áp dụng cho loại xe này.</p></div>';
            return;
        }

        healthStatus.forEach(item => {
            const card = document.createElement('div');
            card.className = `health-card status-${item.status}`;
            
            // Calculate SVG radial offset (circumference ~ 220)
            const circumference = 219.9;
            const offset = circumference - (circumference * item.percentage) / 100;
            
            let kmLabel = `Còn ${Math.round(item.remainingKm)} Km`;
            if (item.remainingKm <= 0) {
                kmLabel = 'Quá hạn Km';
            }

            card.innerHTML = `
                <div class="radial-progress-wrapper">
                    <svg class="radial-progress" viewBox="0 0 80 80">
                        <circle class="track" cx="40" cy="40" r="35"></circle>
                        <circle class="fill" cx="40" cy="40" r="35" 
                                style="stroke-dasharray: ${circumference}; stroke-dashoffset: ${offset};"></circle>
                    </svg>
                    <div class="percentage">${item.percentage}%</div>
                </div>
                <div class="card-title" title="${item.name}">${item.name}</div>
                <div class="card-desc">${kmLabel}<br>${item.timeLabel}</div>
                <span class="status-badge">${item.status === 'good' ? 'Tốt' : (item.status === 'warning' ? 'Theo dõi' : 'Cần thay')}</span>
                <button class="btn btn-secondary btn-sm btn-quick-log" data-category="${item.key}">
                    Thay phụ tùng
                </button>
            `;
            healthGrid.appendChild(card);
        });
    },

    // Render Vehicles View
    renderVehiclesList() {
        const container = document.getElementById('vehicles-list-container');
        if (!container) return;

        const vehicles = Vehicles.getAll();
        const activeId = Vehicles.getActiveId();

        if (vehicles.length === 0) {
            container.innerHTML = `
                <div class="card empty-state">
                    <p>Nhà xe của bạn đang trống. Vui lòng nhấn nút <strong>Thêm xe mới</strong> ở góc trên để tạo xe đầu tiên.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = '';
        vehicles.forEach(v => {
            const card = document.createElement('div');
            card.className = `card vehicle-item-card ${v.id === activeId ? 'active-vehicle' : ''}`;
            if (v.id === activeId) {
                card.style.borderColor = 'var(--color-primary)';
                card.style.boxShadow = '0 0 15px rgba(0, 242, 254, 0.1)';
            }

            card.innerHTML = `
                <div class="vehicle-item-info">
                    <h4>${v.name} ${v.id === activeId ? '👑' : ''}</h4>
                    <div class="vehicle-meta-tags">
                        ${v.plate ? `<span class="meta-tag plate">${v.plate}</span>` : ''}
                        <span class="meta-tag">${VEHICLE_TYPES[v.type]}</span>
                        <span class="meta-tag">${v.currentOdo.toLocaleString()} Km</span>
                    </div>
                </div>
                <div class="vehicle-item-actions">
                    ${v.id !== activeId ? `<button class="btn btn-secondary btn-sm btn-set-active" data-id="${v.id}">Chọn</button>` : ''}
                    <button class="btn btn-secondary btn-sm btn-edit-vehicle" data-id="${v.id}">Sửa</button>
                    <button class="btn btn-danger btn-sm btn-delete-vehicle" data-id="${v.id}">Xóa</button>
                </div>
            `;
            container.appendChild(card);
        });
    },

    // Render Fuel Tracker View
    renderFuelTracker(vehicleId) {
        const efficiencyEl = document.getElementById('stat-fuel-efficiency');
        const costPerKmEl = document.getElementById('stat-fuel-cost-per-km');
        const totalCostEl = document.getElementById('stat-total-fuel-cost');
        const tbody = document.getElementById('fuel-logs-tbody');

        if (!efficiencyEl || !costPerKmEl || !totalCostEl || !tbody) return;

        const vehicle = Vehicles.getById(vehicleId);
        if (!vehicle) {
            efficiencyEl.innerText = '--';
            costPerKmEl.innerText = '--';
            totalCostEl.innerText = '--';
            tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Vui lòng thêm xe để theo dõi xăng dầu.</td></tr>';
            this.renderFuelChart([]);
            return;
        }

        const stats = Stats.calculateFuelStats(vehicleId);
        const logs = FuelLogs.getByVehicle(vehicleId);

        // Display statistics
        efficiencyEl.innerText = stats.efficiency !== null ? `${stats.efficiency} L/100 Km` : '--';
        costPerKmEl.innerText = stats.costPerKm !== null ? `${stats.costPerKm.toLocaleString()} đ/Km` : '--';
        totalCostEl.innerText = `${stats.totalCost.toLocaleString()} đ`;

        // Render Table Body
        tbody.innerHTML = '';
        if (logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Chưa có nhật ký đổ xăng nào.</td></tr>';
        } else {
            // To calculate single log efficiency, we need to compare with previous logs (sorted by Odo)
            const sorted = [...logs].sort((a,b) => a.odo - b.odo);
            
            logs.forEach(log => {
                // Find efficiency for this log if possible
                let logEffLabel = '-';
                if (log.full) {
                    const idx = sorted.findIndex(l => l.id === log.id);
                    // find previous full log
                    let prevFull = null;
                    let accumLiters = 0;
                    for (let i = idx - 1; i >= 0; i--) {
                        accumLiters += sorted[i + 1].liters; // accumulate liters from target up to previous
                        if (sorted[i].full) {
                            prevFull = sorted[i];
                            break;
                        }
                    }
                    if (prevFull) {
                        const dist = log.odo - prevFull.odo;
                        if (dist > 0) {
                            logEffLabel = `${((accumLiters / dist) * 100).toFixed(1)} L/100k`;
                        }
                    }
                }

                const tr = document.createElement('tr');
                const logDate = new Date(log.date).toLocaleDateString('vi-VN');
                tr.innerHTML = `
                    <td>${logDate}</td>
                    <td>${log.odo.toLocaleString()} Km</td>
                    <td>${log.liters.toFixed(2)} L ${log.full ? '⛽' : '⚠️'}</td>
                    <td>${log.cost.toLocaleString()} đ</td>
                    <td style="font-weight: 500; color: var(--color-primary);">${logEffLabel}</td>
                    <td>
                        <button class="action-icon-btn btn-delete-fuel" data-id="${log.id}">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                            </svg>
                        </button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }

        // Render Fuel Chart
        this.renderFuelChart(stats.chartData);
    },

    // Render SVG Line Chart
    renderFuelChart(chartData) {
        const container = document.getElementById('fuel-chart-container');
        if (!container) return;

        if (chartData.length < 2) {
            container.innerHTML = `
                <div class="empty-state">
                    Chưa đủ dữ liệu để vẽ biểu đồ.<br>
                    <small style="color: var(--text-secondary);">Cần tối thiểu 2 lần đổ xăng đầy bình liên tiếp.</small>
                </div>
            `;
            return;
        }

        // SVG Dimensions
        const width = container.clientWidth || 500;
        const height = 200;
        const paddingLeft = 40;
        const paddingRight = 20;
        const paddingTop = 25;
        const paddingBottom = 30;

        const chartWidth = width - paddingLeft - paddingRight;
        const chartHeight = height - paddingTop - paddingBottom;

        // Min Max of values
        const efficiencies = chartData.map(d => d.efficiency);
        let minEff = Math.min(...efficiencies) * 0.9;
        let maxEff = Math.max(...efficiencies) * 1.1;
        
        // Ensure some padding in scaling
        if (maxEff === minEff) {
            minEff -= 0.5;
            maxEff += 0.5;
        }

        // Plot points
        const pointsCount = chartData.length;
        const points = chartData.map((d, index) => {
            const x = paddingLeft + (index / (pointsCount - 1)) * chartWidth;
            const y = paddingTop + chartHeight - ((d.efficiency - minEff) / (maxEff - minEff)) * chartHeight;
            return { x, y, val: d.efficiency, date: d.date };
        });

        // Build SVG Elements
        let svgContent = `
            <svg class="svg-chart" viewBox="0 0 ${width} ${height}" width="100%" height="100%">
                <defs>
                    <linearGradient id="chart-gradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="var(--color-primary)" stop-opacity="0.3"/>
                        <stop offset="100%" stop-color="var(--color-primary)" stop-opacity="0.0"/>
                    </linearGradient>
                </defs>
        `;

        // Horizontal Gridlines & Y Labels (3 lines: Min, Mid, Max)
        const yLabelsCount = 3;
        for (let i = 0; i < yLabelsCount; i++) {
            const ratio = i / (yLabelsCount - 1);
            const val = minEff + ratio * (maxEff - minEff);
            const y = paddingTop + chartHeight - ratio * chartHeight;
            
            // Gridline
            svgContent += `<line class="chart-gridline" x1="${paddingLeft}" y1="${y}" x2="${width - paddingRight}" y2="${y}" />`;
            // Label
            svgContent += `<text class="chart-label" x="${paddingLeft - 10}" y="${y + 4}" text-anchor="end">${val.toFixed(1)}</text>`;
        }

        // Draw Line Path and Area Path
        let linePath = `M ${points[0].x} ${points[0].y}`;
        let areaPath = `M ${points[0].x} ${points[0].y}`;

        for (let i = 1; i < points.length; i++) {
            linePath += ` L ${points[i].x} ${points[i].y}`;
            areaPath += ` L ${points[i].x} ${points[i].y}`;
        }
        
        areaPath += ` L ${points[points.length - 1].x} ${paddingTop + chartHeight} L ${points[0].x} ${paddingTop + chartHeight} Z`;

        svgContent += `<path class="chart-area" d="${areaPath}" />`;
        svgContent += `<path class="chart-line" d="${linePath}" />`;

        // Draw dots and X labels (dates)
        points.forEach((p, idx) => {
            svgContent += `<circle class="chart-dot" cx="${p.x}" cy="${p.y}" r="5" data-val="${p.val}" />`;
            
            // X Labels (Date) - skip some if too many to prevent overlapping
            const shouldShowLabel = pointsCount <= 6 || idx === 0 || idx === pointsCount - 1 || idx === Math.floor(pointsCount / 2);
            if (shouldShowLabel) {
                const dateObj = new Date(p.date);
                const dateStr = `${dateObj.getDate()}/${dateObj.getMonth() + 1}`;
                svgContent += `<text class="chart-label" x="${p.x}" y="${height - 10}">${dateStr}</text>`;
            }
        });

        svgContent += `</svg>`;
        container.innerHTML = svgContent;
    },

    // Render Maintenance History View
    renderHistory(vehicleId, filterCategory = 'all') {
        const tbody = document.getElementById('maint-logs-tbody');
        if (!tbody) return;

        const vehicle = Vehicles.getById(vehicleId);
        if (!vehicle) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Vui lòng thêm xe để xem lịch sử bảo dưỡng.</td></tr>';
            return;
        }

        let logs = MaintenanceLogs.getByVehicle(vehicleId);

        if (filterCategory !== 'all') {
            logs = logs.filter(l => l.category === filterCategory);
        }

        tbody.innerHTML = '';
        if (logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Chưa có bản ghi bảo dưỡng nào.</td></tr>';
            return;
        }

        // Mapping keys to readable names
        const presets = Presets.getForVehicle(vehicleId);
        
        logs.forEach(log => {
            const presetName = presets[log.category] ? presets[log.category].name : "Bảo dưỡng khác";
            const logDate = new Date(log.date).toLocaleDateString('vi-VN');
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${logDate}</td>
                <td>${log.odo.toLocaleString()} Km</td>
                <td style="font-weight: 500; color: var(--color-primary-end);">${presetName}</td>
                <td>${log.cost > 0 ? log.cost.toLocaleString() + ' đ' : 'Miễn phí'}</td>
                <td title="${log.notes}">${log.notes || '-'}</td>
                <td>
                    <button class="action-icon-btn btn-delete-maint" data-id="${log.id}">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                        </svg>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    },

    // Render Presets Settings List
    renderPresetsSettings(vehicleId) {
        const container = document.getElementById('presets-config-list');
        if (!container) return;

        const vehicle = Vehicles.getById(vehicleId);
        if (!vehicle) {
            container.innerHTML = `
                <div class="empty-state" style="padding: 10px 0;">
                    Vui lòng chọn hoặc thêm xe máy để cấu hình định mức bảo dưỡng.
                </div>
            `;
            return;
        }

        const presets = Presets.getForVehicle(vehicleId);
        container.innerHTML = '';

        for (const [key, p] of Object.entries(presets)) {
            const item = document.createElement('div');
            item.className = 'preset-setting-item';
            item.innerHTML = `
                <div class="preset-setting-details">
                    <h5>${p.name}</h5>
                    <p>Mỗi: <strong>${p.intervalKm.toLocaleString()} Km</strong> hoặc <strong>${p.intervalMonths} Tháng</strong></p>
                </div>
                <button class="btn btn-secondary btn-sm btn-edit-preset" data-key="${key}" data-name="${p.name}" data-km="${p.intervalKm}" data-months="${p.intervalMonths}">
                    Thay đổi
                </button>
            `;
            container.appendChild(item);
        }
    }
};
