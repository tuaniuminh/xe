/* MotoCare - Main App Controller */
import { Vehicles, MaintenanceLogs, FuelLogs, Presets, Stats, DataPortability, AI } from './db.js';
import { UI } from './ui.js';

// Application State
const state = {
    currentView: 'dashboard',
    activeVehicleId: null
};

// Global App Object
const App = {
    init() {
        this.registerServiceWorker();
        this.initTheme();
        this.initRouting();
        this.initEvents();
        
        // Bootstrapping active vehicle
        const activeId = Vehicles.getActiveId();
        if (activeId) {
            state.activeVehicleId = activeId;
        } else {
            const list = Vehicles.getAll();
            if (list.length > 0) {
                Vehicles.setActiveId(list[0].id);
                state.activeVehicleId = list[0].id;
            }
        }

        // Display version
        const versionEl = document.getElementById('app-version-display');
        if (versionEl) versionEl.innerText = 'v1.0.8'; // Set current version

        this.renderAll();
    },

    // Refresh all views based on active vehicle
    renderAll() {
        const vId = state.activeVehicleId;
        
        UI.renderHeaderVehicleSelector();
        UI.renderDashboard(vId);
        UI.renderVehiclesList();
        UI.renderFuelTracker(vId);
        UI.renderHistory(vId, document.getElementById('filter-maint-category')?.value || 'all');
        UI.renderPresetsSettings(vId);

        // Autofill Gemini API key if present in settings input
        const geminiInput = document.getElementById('settings-gemini-key');
        if (geminiInput && !geminiInput.value) {
            geminiInput.value = AI.getKey();
        }
    },

    // Single Page App View Routing
    initRouting() {
        const navItems = document.querySelectorAll('.app-nav .nav-item');
        const views = document.querySelectorAll('.app-main .app-view');

        navItems.forEach(item => {
            item.addEventListener('click', () => {
                const targetView = item.getAttribute('data-view');
                if (!targetView) return;

                // Toggle active menu
                navItems.forEach(nav => nav.classList.remove('active'));
                item.classList.add('active');

                // Toggle active view screen
                views.forEach(view => view.classList.remove('active'));
                const viewEl = document.getElementById(`view-${targetView}`);
                if (viewEl) {
                    viewEl.classList.add('active');
                    state.currentView = targetView;
                }

                // Render current view data dynamically
                this.renderAll();
            });
        });
    },

    // Initialize Event Listeners
    initEvents() {
        // 1. Header Active Vehicle Selection Change
        document.getElementById('active-vehicle-select')?.addEventListener('change', (e) => {
            const id = e.target.value;
            if (id) {
                Vehicles.setActiveId(id);
                state.activeVehicleId = id;
                UI.showToast("Đã đổi sang xe hoạt động!");
                this.renderAll();
            }
        });

        // 2. Dashboard - Update Odometer
        document.getElementById('btn-update-odo')?.addEventListener('click', () => {
            const vId = state.activeVehicleId;
            if (!vId) {
                UI.showToast("Vui lòng chọn hoặc thêm xe máy trước!", "danger");
                return;
            }
            const odoInput = document.getElementById('current-odo-input');
            const newOdo = parseInt(odoInput.value) || 0;
            
            const res = Vehicles.updateOdo(vId, newOdo);
            if (res.success) {
                UI.showToast("Cập nhật ODO thành công lên " + newOdo.toLocaleString() + " Km!");
                this.renderAll();
            } else {
                UI.showToast(res.error, "danger");
                // Reset input to actual ODO
                const currentVeh = Vehicles.getById(vId);
                if (currentVeh) odoInput.value = currentVeh.currentOdo;
            }
        });

        // 3. Quick Action Buttons on Dashboard
        document.getElementById('btn-quick-fuel')?.addEventListener('click', () => {
            this.openModal('fuel');
        });
        
        document.getElementById('btn-quick-maintenance')?.addEventListener('click', () => {
            this.openModal('maintenance');
        });

        document.getElementById('btn-quick-oil-change')?.addEventListener('click', () => {
            const vId = state.activeVehicleId;
            if (!vId) {
                UI.showToast("Chưa chọn xe máy!", "danger");
                return;
            }
            const vehicle = Vehicles.getById(vId);
            if (confirm(`Bạn muốn ghi nhận THAY DẦU MÁY cho xe ${vehicle.name} ở số Km hiện tại (${vehicle.currentOdo.toLocaleString()} Km) chứ?`)) {
                MaintenanceLogs.add({
                    vehicleId: vId,
                    date: new Date().toISOString().split('T')[0],
                    odo: vehicle.currentOdo,
                    category: 'oil_engine',
                    cost: 0,
                    notes: 'Thay dầu nhanh từ Dashboard'
                });
                UI.showToast("Đã lưu lịch sử thay dầu máy!");
                this.renderAll();
            }
        });

        // 4. Modal Open/Close triggers
        document.getElementById('btn-add-vehicle')?.addEventListener('click', () => this.openModal('vehicle'));
        document.getElementById('btn-close-modal-vehicle')?.addEventListener('click', () => this.closeModal('vehicle'));
        document.getElementById('btn-cancel-vehicle')?.addEventListener('click', () => this.closeModal('vehicle'));

        document.getElementById('btn-add-fuel')?.addEventListener('click', () => this.openModal('fuel'));
        document.getElementById('btn-close-modal-fuel')?.addEventListener('click', () => this.closeModal('fuel'));
        document.getElementById('btn-cancel-fuel')?.addEventListener('click', () => this.closeModal('fuel'));

        document.getElementById('btn-add-maintenance')?.addEventListener('click', () => this.openModal('maintenance'));
        document.getElementById('btn-close-modal-maintenance')?.addEventListener('click', () => this.closeModal('maintenance'));
        document.getElementById('btn-cancel-maintenance')?.addEventListener('click', () => this.closeModal('maintenance'));

        document.getElementById('btn-close-modal-preset')?.addEventListener('click', () => this.closeModal('preset'));
        document.getElementById('btn-cancel-preset')?.addEventListener('click', () => this.closeModal('preset'));

        // AI Doctor Modal close triggers
        document.getElementById('btn-close-modal-ai-doctor')?.addEventListener('click', () => this.closeModal('ai-doctor'));
        document.getElementById('btn-close-ai-doctor')?.addEventListener('click', () => this.closeModal('ai-doctor'));

        // Save Gemini API Key trigger
        document.getElementById('btn-save-gemini-key')?.addEventListener('click', () => {
            const keyInput = document.getElementById('settings-gemini-key');
            if (keyInput) {
                AI.saveKey(keyInput.value);
                UI.showToast("Đã lưu khóa API Gemini thành công!", "success");
                this.renderAll(); // updates status dot on Dashboard
            }
        });

        // Consult AI Doctor trigger
        document.getElementById('btn-consult-ai')?.addEventListener('click', async () => {
            const vId = state.activeVehicleId;
            if (!vId) {
                UI.showToast("Vui lòng chọn hoặc thêm xe máy trước!", "danger");
                return;
            }
            
            const apiKey = AI.getKey();
            if (!apiKey) {
                UI.showToast("Vui lòng cấu hình Gemini API Key trong mục Cài đặt trước!", "warning");
                // Redirect user to Settings view by triggering click on settings nav tab
                const settingsTab = document.querySelector('.app-nav .nav-item[data-view="settings"]');
                if (settingsTab) settingsTab.click();
                return;
            }

            this.openModal('ai-doctor');
            
            const loadingEl = document.getElementById('ai-loading');
            const contentEl = document.getElementById('ai-result-content');
            
            if (loadingEl && contentEl) {
                loadingEl.classList.remove('hidden');
                contentEl.classList.add('hidden');
                contentEl.innerHTML = '';
                
                try {
                    const prompt = AI.generateConsultationPrompt(vId);
                    const resultHtml = await AI.callGeminiTextAPI(prompt);
                    
                    loadingEl.classList.add('hidden');
                    contentEl.classList.remove('hidden');
                    contentEl.innerHTML = resultHtml;
                } catch (err) {
                    loadingEl.classList.add('hidden');
                    contentEl.classList.remove('hidden');
                    contentEl.innerHTML = `
                        <div style="color: var(--color-danger); padding: 20px; text-align: center;">
                            <h4 style="font-weight:600;">⚠️ Lỗi kết nối Gemini AI</h4>
                            <p style="margin-top: 10px; font-size: 0.9rem;">${err.message || 'Không thể lấy phản hồi từ Gemini API.'}</p>
                            <p style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 10px;">Vui lòng kiểm tra lại kết nối mạng và tính hợp lệ của API Key.</p>
                        </div>
                    `;
                }
            }
        });

        // 5. Form Submissions
        document.getElementById('form-vehicle')?.addEventListener('submit', (e) => {
            e.preventDefault();
            const id = document.getElementById('vehicle-id').value;
            const name = document.getElementById('vehicle-name').value;
            const plate = document.getElementById('vehicle-plate').value;
            const type = document.getElementById('vehicle-type').value;
            const odo = parseInt(document.getElementById('vehicle-odo').value) || 0;
            const buyDate = document.getElementById('vehicle-buy-date').value;

            if (id) {
                // Update
                Vehicles.update({ id, name, plate, type, currentOdo: odo, buyDate });
                UI.showToast("Cập nhật thông tin xe thành công!");
            } else {
                // Create
                const newVeh = Vehicles.add({ name, plate, type, currentOdo: odo, buyDate });
                state.activeVehicleId = newVeh.id;
                UI.showToast("Đã thêm xe mới!");
            }

            this.closeModal('vehicle');
            this.renderAll();
        });

        document.getElementById('form-fuel')?.addEventListener('submit', (e) => {
            e.preventDefault();
            const logId = document.getElementById('fuel-log-id').value;
            const date = document.getElementById('fuel-date').value;
            const odo = parseInt(document.getElementById('fuel-odo').value) || 0;
            const liters = parseFloat(document.getElementById('fuel-liters').value) || 0;
            const cost = parseInt(document.getElementById('fuel-cost').value) || 0;
            const full = document.getElementById('fuel-full').checked;

            FuelLogs.add({
                vehicleId: state.activeVehicleId,
                date,
                odo,
                liters,
                cost,
                full
            });

            UI.showToast("Ghi nhận đổ xăng thành công!");
            this.closeModal('fuel');
            this.renderAll();
        });

        document.getElementById('form-maintenance')?.addEventListener('submit', (e) => {
            e.preventDefault();
            const maintId = document.getElementById('maint-log-id').value;
            const date = document.getElementById('maint-date').value;
            const odo = parseInt(document.getElementById('maint-odo').value) || 0;
            const category = document.getElementById('maint-category').value;
            const cost = parseInt(document.getElementById('maint-cost').value) || 0;
            const notes = document.getElementById('maint-notes').value;

            MaintenanceLogs.add({
                vehicleId: state.activeVehicleId,
                date,
                odo,
                category,
                cost,
                notes
            });

            UI.showToast("Đã lưu lịch sử bảo dưỡng!");
            this.closeModal('maintenance');
            this.renderAll();
        });

        document.getElementById('form-preset')?.addEventListener('submit', (e) => {
            e.preventDefault();
            const key = document.getElementById('preset-key').value;
            const km = parseInt(document.getElementById('preset-interval-km').value) || 0;
            const months = parseInt(document.getElementById('preset-interval-months').value) || 0;

            Presets.saveForVehicle(state.activeVehicleId, key, km, months);
            
            UI.showToast("Đã cập nhật định mức bảo dưỡng!");
            this.closeModal('preset');
            this.renderAll();
        });

        // 6. Maintenance Logs filter
        document.getElementById('filter-maint-category')?.addEventListener('change', (e) => {
            UI.renderHistory(state.activeVehicleId, e.target.value);
        });

        // 7. Click Delegation for dynamic list items (Vehicles, Logs)
        document.addEventListener('click', (e) => {
            // Set Active Vehicle
            if (e.target.classList.contains('btn-set-active')) {
                const id = e.target.getAttribute('data-id');
                Vehicles.setActiveId(id);
                state.activeVehicleId = id;
                UI.showToast("Đã chọn làm xe chính!");
                this.renderAll();
            }

            // Edit Vehicle details
            if (e.target.classList.contains('btn-edit-vehicle')) {
                const id = e.target.getAttribute('data-id');
                const veh = Vehicles.getById(id);
                if (veh) {
                    this.openModal('vehicle', veh);
                }
            }

            // Delete Vehicle
            if (e.target.classList.contains('btn-delete-vehicle')) {
                const id = e.target.getAttribute('data-id');
                const veh = Vehicles.getById(id);
                if (confirm(`Bạn có chắc chắn muốn xóa xe ${veh.name}? Toàn bộ lịch sử bảo dưỡng, xăng xe của xe này cũng sẽ bị xóa vĩnh viễn.`)) {
                    Vehicles.delete(id);
                    UI.showToast("Đã xóa xe khỏi danh sách.");
                    
                    const list = Vehicles.getAll();
                    state.activeVehicleId = list.length > 0 ? list[0].id : null;
                    
                    this.renderAll();
                }
            }

            // Delete Fuel Log
            if (e.target.closest('.btn-delete-fuel')) {
                const btn = e.target.closest('.btn-delete-fuel');
                const id = btn.getAttribute('data-id');
                if (confirm("Xóa nhật ký đổ xăng này?")) {
                    FuelLogs.delete(id);
                    UI.showToast("Đã xóa nhật ký đổ xăng.");
                    this.renderAll();
                }
            }

            // Delete Maint Log
            if (e.target.closest('.btn-delete-maint')) {
                const btn = e.target.closest('.btn-delete-maint');
                const id = btn.getAttribute('data-id');
                if (confirm("Xóa lịch sử bảo dưỡng này?")) {
                    MaintenanceLogs.delete(id);
                    UI.showToast("Đã xóa lịch sử bảo dưỡng.");
                    this.renderAll();
                }
            }

            // Quick log from dashboard health card
            if (e.target.classList.contains('btn-quick-log')) {
                const category = e.target.getAttribute('data-category');
                this.openModal('maintenance', { category });
            }

            // Edit preset interval in settings
            if (e.target.classList.contains('btn-edit-preset')) {
                const key = e.target.getAttribute('data-key');
                const name = e.target.getAttribute('data-name');
                const km = e.target.getAttribute('data-km');
                const months = e.target.getAttribute('data-months');
                this.openModal('preset', { key, name, km, months });
            }
        });

        // 8. Settings - Data Backup/Restore
        document.getElementById('btn-export-data')?.addEventListener('click', () => {
            const dataStr = DataPortability.exportData();
            const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
            
            const exportFileDefaultName = 'motocare_backup_' + new Date().toISOString().split('T')[0] + '.json';
            
            const linkElement = document.createElement('a');
            linkElement.setAttribute('href', dataUri);
            linkElement.setAttribute('download', exportFileDefaultName);
            linkElement.click();
            UI.showToast("Đã tải tệp sao lưu dữ liệu.");
        });

        document.getElementById('btn-import-trigger')?.addEventListener('click', () => {
            document.getElementById('file-import-input')?.click();
        });

        document.getElementById('file-import-input')?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (evt) => {
                const result = DataPortability.importData(evt.target.result);
                if (result.success) {
                    UI.showToast("Khôi phục dữ liệu thành công!", "success");
                    // Reload after 1.5s
                    setTimeout(() => window.location.reload(), 1500);
                } else {
                    UI.showToast("Khôi phục thất bại: " + result.error, "danger");
                }
            };
            reader.readAsText(file);
        });

        document.getElementById('btn-reset-app')?.addEventListener('click', () => {
            if (confirm("CẢNH BÁO: Bạn có chắc chắn muốn xóa toàn bộ dữ liệu xe máy, lịch sử bảo dưỡng và đổ xăng chứ? Hành động này không thể khôi phục.")) {
                if (confirm("Hãy xác nhận lại một lần nữa. Bạn sẽ mất sạch dữ liệu đã ghi nhận.")) {
                    DataPortability.resetAll();
                    UI.showToast("Đã xóa toàn bộ dữ liệu ứng dụng!");
                    setTimeout(() => window.location.reload(), 1500);
                }
            }
        });
    },

    // Modal Control Logic
    openModal(type, data = null) {
        const overlay = document.getElementById(`modal-${type}`);
        if (!overlay) return;

        overlay.classList.remove('hidden');

        // Form Autofills and Configurations
        const vehicle = Vehicles.getById(state.activeVehicleId);
        const todayStr = new Date().toISOString().split('T')[0];

        if (type === 'vehicle') {
            const modalTitle = document.getElementById('vehicle-modal-title');
            if (data) {
                // Edit mode
                if (modalTitle) modalTitle.innerText = "Sửa thông tin xe";
                document.getElementById('vehicle-id').value = data.id || '';
                document.getElementById('vehicle-name').value = data.name || '';
                document.getElementById('vehicle-plate').value = data.plate || '';
                document.getElementById('vehicle-type').value = data.type || 'scooter';
                document.getElementById('vehicle-odo').value = data.currentOdo || 0;
                document.getElementById('vehicle-buy-date').value = data.buyDate || todayStr;
            } else {
                // Add mode
                if (modalTitle) modalTitle.innerText = "Thêm xe mới";
                document.getElementById('form-vehicle').reset();
                document.getElementById('vehicle-id').value = '';
                document.getElementById('vehicle-odo').value = 0;
                document.getElementById('vehicle-buy-date').value = todayStr;
            }
        } else if (type === 'fuel') {
            document.getElementById('form-fuel').reset();
            document.getElementById('fuel-log-id').value = '';
            document.getElementById('fuel-date').value = todayStr;
            if (vehicle) {
                document.getElementById('fuel-odo').value = vehicle.currentOdo;
            }
        } else if (type === 'maintenance') {
            document.getElementById('form-maintenance').reset();
            document.getElementById('maint-log-id').value = '';
            document.getElementById('maint-date').value = todayStr;
            if (vehicle) {
                document.getElementById('maint-odo').value = vehicle.currentOdo;
            }
            if (data && data.category) {
                // Preselect category
                document.getElementById('maint-category').value = data.category;
            }
        } else if (type === 'preset') {
            if (data) {
                document.getElementById('preset-key').value = data.key;
                document.getElementById('preset-name-display').value = data.name;
                document.getElementById('preset-interval-km').value = data.km;
                document.getElementById('preset-interval-months').value = data.months;
            }
        } else if (type === 'ai-doctor') {
            // Loading and clearing state is handled in click event listener
        }
    },

    closeModal(type) {
        const overlay = document.getElementById(`modal-${type}`);
        if (overlay) {
            overlay.classList.add('hidden');
        }
    },

    // Theme Management (Compatible with FamiLife)
    initTheme() {
        const savedTheme = localStorage.getItem('gift_ledger_theme') || 'light';
        this.setTheme(savedTheme);

        document.getElementById('btn-toggle-theme')?.addEventListener('click', () => {
            const currentTheme = localStorage.getItem('gift_ledger_theme') || 'light';
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            this.setTheme(newTheme);
        });
    },

    setTheme(theme) {
        localStorage.setItem('gift_ledger_theme', theme);
        const body = document.body;
        const html = document.documentElement;
        
        const sunIcon = document.querySelector('.theme-toggle-btn .sun-icon');
        const moonIcon = document.querySelector('.theme-toggle-btn .moon-icon');

        if (theme === 'light') {
            body.classList.add('light-mode');
            html.classList.add('light-mode');
            html.style.colorScheme = 'light';
            
            sunIcon?.classList.add('hidden');
            moonIcon?.classList.remove('hidden');
        } else {
            body.classList.remove('light-mode');
            html.classList.remove('light-mode');
            html.style.colorScheme = 'dark';
            
            sunIcon?.classList.remove('hidden');
            moonIcon?.classList.add('hidden');
        }

        // Redraw fuel chart grid lines to adjust color for theme!
        const vId = state.activeVehicleId;
        if (vId) {
            setTimeout(() => {
                const stats = Stats.calculateFuelStats(vId);
                UI.renderFuelChart(stats.chartData);
            }, 50);
        }
    },

    // PWA Service Worker Registration
    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('sw.js')
                    .then(registration => {
                        console.log('MotoCare Service Worker đã được đăng ký thành công: ', registration.scope);
                        
                        // Check if app update is available
                        registration.addEventListener('updatefound', () => {
                            const newWorker = registration.installing;
                            newWorker.addEventListener('statechange', () => {
                                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                    UI.showToast("Có phiên bản mới, vui lòng tải lại trang!", "info");
                                }
                            });
                        });
                    })
                    .catch(error => {
                        console.error('Đăng ký Service Worker thất bại: ', error);
                    });
            });
        }

        // Install PWA trigger (A2HS)
        let deferredPrompt;
        const installBanner = document.getElementById('pwa-install-banner');
        const installBtn = document.getElementById('btn-install-pwa');

        window.addEventListener('beforeinstallprompt', (e) => {
            // Prevent Chrome 67 and earlier from automatically showing the prompt
            e.preventDefault();
            // Stash the event so it can be triggered later.
            deferredPrompt = e;
            // Update UI notify the user they can install the PWA
            if (installBanner) installBanner.classList.remove('hidden');
        });

        installBtn?.addEventListener('click', () => {
            if (!deferredPrompt) return;
            // Show the prompt
            deferredPrompt.prompt();
            // Wait for the user to respond to the prompt
            deferredPrompt.userChoice.then((choiceResult) => {
                if (choiceResult.outcome === 'accepted') {
                    console.log('Người dùng đã đồng ý cài đặt PWA');
                } else {
                    console.log('Người dùng đã từ chối cài đặt PWA');
                }
                deferredPrompt = null;
                if (installBanner) installBanner.classList.add('hidden');
            });
        });
    }
};

// Bootstrap the application on page load
window.addEventListener('DOMContentLoaded', () => {
    // Expose app context globally so it is accessible in HTML onclick attributes
    window.app = App;
    App.init();
});
