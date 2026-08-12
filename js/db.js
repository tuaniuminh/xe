/* MotoCare - Database & Business Logic Layer */
import { DEFAULT_PRESETS, VEHICLE_TYPES } from './presets.js';

// Keys for LocalStorage
const KEYS = {
    VEHICLES: 'motocare_vehicles',
    ACTIVE_VEHICLE_ID: 'motocare_active_id',
    MAINTENANCE_LOGS: 'motocare_maint_logs',
    FUEL_LOGS: 'motocare_fuel_logs',
    CUSTOM_PRESETS: 'motocare_custom_presets', // object of { vehicleId: { presetKey: { intervalKm, intervalMonths } } }
    GEMINI_KEY: 'motocare_gemini_key'
};

// Helper: Get item from LocalStorage
function getLocal(key, defaultValue = []) {
    try {
        const val = localStorage.getItem(key);
        return val ? JSON.parse(val) : defaultValue;
    } catch (e) {
        console.error("Lỗi đọc LocalStorage cho key: " + key, e);
        return defaultValue;
    }
}

// Helper: Set item in LocalStorage
function setLocal(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
        return true;
    } catch (e) {
        console.error("Lỗi ghi LocalStorage cho key: " + key, e);
        return false;
    }
}

// Helper: Generate UUID
function generateUUID() {
    return 'id_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now().toString(36);
}

// VEHICLES API
export const Vehicles = {
    getAll() {
        return getLocal(KEYS.VEHICLES, []);
    },

    getById(id) {
        const list = this.getAll();
        return list.find(v => v.id === id) || null;
    },

    saveAll(list) {
        return setLocal(KEYS.VEHICLES, list);
    },

    add(vehicle) {
        const list = this.getAll();
        const newVehicle = {
            id: generateUUID(),
            name: vehicle.name.trim(),
            plate: (vehicle.plate || '').trim(),
            type: vehicle.type, // 'scooter' | 'manual' | 'clutch'
            currentOdo: parseInt(vehicle.currentOdo) || 0,
            buyDate: vehicle.buyDate || new Date().toISOString().split('T')[0]
        };
        list.push(newVehicle);
        this.saveAll(list);
        
        // Auto set active if it's the first vehicle
        if (list.length === 1) {
            this.setActiveId(newVehicle.id);
        }
        return newVehicle;
    },

    update(vehicle) {
        const list = this.getAll();
        const idx = list.findIndex(v => v.id === vehicle.id);
        if (idx !== -1) {
            // Keep existing currentOdo if not provided, or ensure it doesn't decrease unless forced
            const newOdo = parseInt(vehicle.currentOdo) || 0;
            list[idx] = {
                ...list[idx],
                name: vehicle.name.trim(),
                plate: (vehicle.plate || '').trim(),
                type: vehicle.type,
                currentOdo: newOdo,
                buyDate: vehicle.buyDate || list[idx].buyDate
            };
            this.saveAll(list);
            
            // If Odometer increased, update corresponding logs or trigger check
            return list[idx];
        }
        return null;
    },

    delete(id) {
        let list = this.getAll();
        list = list.filter(v => v.id !== id);
        this.saveAll(list);

        // Clean up corresponding data
        let maintLogs = getLocal(KEYS.MAINTENANCE_LOGS, []);
        maintLogs = maintLogs.filter(log => log.vehicleId !== id);
        setLocal(KEYS.MAINTENANCE_LOGS, maintLogs);

        let fuelLogs = getLocal(KEYS.FUEL_LOGS, []);
        fuelLogs = fuelLogs.filter(log => log.vehicleId !== id);
        setLocal(KEYS.FUEL_LOGS, fuelLogs);

        let presets = getLocal(KEYS.CUSTOM_PRESETS, {});
        delete presets[id];
        setLocal(KEYS.CUSTOM_PRESETS, presets);

        // Reset active vehicle if deleted
        if (this.getActiveId() === id) {
            if (list.length > 0) {
                this.setActiveId(list[0].id);
            } else {
                localStorage.removeItem(KEYS.ACTIVE_VEHICLE_ID);
            }
        }
        return true;
    },

    getActiveId() {
        return localStorage.getItem(KEYS.ACTIVE_VEHICLE_ID) || null;
    },

    setActiveId(id) {
        localStorage.setItem(KEYS.ACTIVE_VEHICLE_ID, id);
    },

    getActive() {
        const activeId = this.getActiveId();
        if (!activeId) return null;
        return this.getById(activeId);
    },

    updateOdo(id, newOdo) {
        const vehicle = this.getById(id);
        if (vehicle) {
            newOdo = parseInt(newOdo) || 0;
            if (newOdo < vehicle.currentOdo) {
                // Return status to warning that ODO is lower than current
                return { success: false, error: 'Số ODO mới không được nhỏ hơn ODO hiện tại (' + vehicle.currentOdo + ' Km).' };
            }
            vehicle.currentOdo = newOdo;
            this.update(vehicle);
            return { success: true, vehicle };
        }
        return { success: false, error: 'Không tìm thấy xe.' };
    }
};

// PRESETS API (CUSTOM INTERVALS PER VEHICLE)
export const Presets = {
    getForVehicle(vehicleId) {
        const vehicle = Vehicles.getById(vehicleId);
        if (!vehicle) return {};

        const custom = getLocal(KEYS.CUSTOM_PRESETS, {});
        const vehicleCustom = custom[vehicleId] || {};

        // Merge defaults with custom values
        const merged = {};
        for (const [key, preset] of Object.entries(DEFAULT_PRESETS)) {
            // Check if this preset applies to this vehicle type
            if (preset[vehicle.type] === true) {
                const custVal = vehicleCustom[key] || {};
                merged[key] = {
                    key: key,
                    name: preset.name,
                    desc: preset.desc,
                    icon: preset.icon,
                    intervalKm: custVal.intervalKm !== undefined ? custVal.intervalKm : preset.intervalKm,
                    intervalMonths: custVal.intervalMonths !== undefined ? custVal.intervalMonths : preset.intervalMonths
                };
            }
        }
        return merged;
    },

    saveForVehicle(vehicleId, presetKey, intervalKm, intervalMonths) {
        const custom = getLocal(KEYS.CUSTOM_PRESETS, {});
        if (!custom[vehicleId]) custom[vehicleId] = {};
        
        custom[vehicleId][presetKey] = {
            intervalKm: parseInt(intervalKm) || 0,
            intervalMonths: parseInt(intervalMonths) || 0
        };
        return setLocal(KEYS.CUSTOM_PRESETS, custom);
    }
};

// MAINTENANCE LOGS API
export const MaintenanceLogs = {
    getAll() {
        return getLocal(KEYS.MAINTENANCE_LOGS, []);
    },

    getByVehicle(vehicleId) {
        const list = this.getAll();
        return list
            .filter(log => log.vehicleId === vehicleId)
            .sort((a, b) => new Date(b.date) - new Date(a.date) || b.odo - a.odo);
    },

    add(log) {
        const list = this.getAll();
        const newLog = {
            id: generateUUID(),
            vehicleId: log.vehicleId,
            date: log.date || new Date().toISOString().split('T')[0],
            odo: parseInt(log.odo) || 0,
            category: log.category, // 'oil_engine', 'oil_gear', etc.
            cost: parseInt(log.cost) || 0,
            notes: (log.notes || '').trim()
        };
        list.push(newLog);
        this.saveAll(list);

        // Update vehicle ODO if this log ODO is higher
        const vehicle = Vehicles.getById(log.vehicleId);
        if (vehicle && newLog.odo > vehicle.currentOdo) {
            Vehicles.updateOdo(vehicle.id, newLog.odo);
        }

        return newLog;
    },

    saveAll(list) {
        return setLocal(KEYS.MAINTENANCE_LOGS, list);
    },

    delete(id) {
        let list = this.getAll();
        list = list.filter(log => log.id !== id);
        return this.saveAll(list);
    }
};

// FUEL LOGS API
export const FuelLogs = {
    getAll() {
        return getLocal(KEYS.FUEL_LOGS, []);
    },

    getByVehicle(vehicleId) {
        const list = this.getAll();
        return list
            .filter(log => log.vehicleId === vehicleId)
            .sort((a, b) => new Date(b.date) - new Date(a.date) || b.odo - a.odo);
    },

    add(log) {
        const list = this.getAll();
        const newLog = {
            id: generateUUID(),
            vehicleId: log.vehicleId,
            date: log.date || new Date().toISOString().split('T')[0],
            odo: parseInt(log.odo) || 0,
            liters: parseFloat(log.liters) || 0,
            cost: parseInt(log.cost) || 0,
            full: log.full !== undefined ? log.full : true
        };
        list.push(newLog);
        this.saveAll(list);

        // Update vehicle ODO if this log ODO is higher
        const vehicle = Vehicles.getById(log.vehicleId);
        if (vehicle && newLog.odo > vehicle.currentOdo) {
            Vehicles.updateOdo(vehicle.id, newLog.odo);
        }

        return newLog;
    },

    saveAll(list) {
        return setLocal(KEYS.FUEL_LOGS, list);
    },

    delete(id) {
        let list = this.getAll();
        list = list.filter(log => log.id !== id);
        return this.saveAll(list);
    }
};

// METRICS & STATS CALCULATIONS
export const Stats = {
    // Robust fuel calculation algorithm
    calculateFuelStats(vehicleId) {
        const logs = FuelLogs.getByVehicle(vehicleId);
        if (logs.length === 0) {
            return { efficiency: null, costPerKm: null, totalCost: 0, chartData: [] };
        }

        // Sort ascending by ODO for calculation
        const sortedLogs = [...logs].sort((a, b) => a.odo - b.odo);
        let totalCost = 0;
        sortedLogs.forEach(l => totalCost += l.cost);

        // Calculate Fuel Efficiency (L/100km)
        // Formula: Look for pairs of "Full tank" fills. 
        // Sum liters of all fills starting after Full Fill A up to and including Full Fill B.
        // Distance is ODO(B) - ODO(A).
        let totalDistanceForEfficiency = 0;
        let totalLitersForEfficiency = 0;
        let lastFullLog = null;
        let pendingLiters = 0;
        const chartData = [];

        for (let i = 0; i < sortedLogs.length; i++) {
            const current = sortedLogs[i];
            
            if (current.full) {
                if (lastFullLog !== null) {
                    const dist = current.odo - lastFullLog.odo;
                    if (dist > 0) {
                        const litersConsumed = pendingLiters + current.liters;
                        totalDistanceForEfficiency += dist;
                        totalLitersForEfficiency += litersConsumed;

                        const eff = parseFloat(((litersConsumed / dist) * 100).toFixed(2));
                        chartData.push({
                            date: current.date,
                            odo: current.odo,
                            efficiency: eff
                        });
                    }
                }
                lastFullLog = current;
                pendingLiters = 0; // reset pending since tank is full now
            } else {
                // If it is a partial fill, we accumulate the liters
                if (lastFullLog !== null) {
                    pendingLiters += current.liters;
                }
            }
        }

        const avgEfficiency = totalDistanceForEfficiency > 0 
            ? parseFloat(((totalLitersForEfficiency / totalDistanceForEfficiency) * 100).toFixed(2))
            : null;

        // Calculate Cost per Km
        // Take overall distance from first fuel log ODO to last fuel log ODO, or current ODO of bike
        const vehicle = Vehicles.getById(vehicleId);
        let overallDistance = 0;
        let costPerKm = null;
        
        if (sortedLogs.length >= 2) {
            overallDistance = sortedLogs[sortedLogs.length - 1].odo - sortedLogs[0].odo;
            if (overallDistance > 0) {
                // Sum cost of all logs except the first one?
                // Actually, total cost divided by total overall distance is the standard estimate
                costPerKm = Math.round(totalCost / overallDistance);
            }
        } else if (sortedLogs.length === 1 && vehicle && vehicle.currentOdo > sortedLogs[0].odo) {
            overallDistance = vehicle.currentOdo - sortedLogs[0].odo;
            if (overallDistance > 0) {
                costPerKm = Math.round(totalCost / overallDistance);
            }
        }

        return {
            efficiency: avgEfficiency,
            costPerKm,
            totalCost,
            chartData
        };
    },

    getHealthStatus(vehicleId) {
        const vehicle = Vehicles.getById(vehicleId);
        if (!vehicle) return [];

        const presets = Presets.getForVehicle(vehicleId);
        const maintLogs = MaintenanceLogs.getByVehicle(vehicleId);
        const fuelStats = this.calculateFuelStats(vehicleId);
        const currentOdo = vehicle.currentOdo;
        
        // --- HEURISTIC LOCAL AI: Detect Fuel Consumption Anomaly ---
        let isFuelAnomaly = false;
        let fuelAnomalyReason = '';
        if (fuelStats.efficiency && fuelStats.chartData.length >= 2) {
            const latestEff = fuelStats.chartData[fuelStats.chartData.length - 1].efficiency;
            if (latestEff > fuelStats.efficiency * 1.12) {
                isFuelAnomaly = true;
                const percentIncrease = (((latestEff - fuelStats.efficiency) / fuelStats.efficiency) * 100).toFixed(0);
                fuelAnomalyReason = `Hao xăng tăng vọt ${percentIncrease}% so với trung bình (${latestEff} so với ${fuelStats.efficiency} L/100km).`;
            }
        }

        // --- HEURISTIC LOCAL AI: Detect Vehicle Age ---
        let isOlderVehicle = false;
        if (vehicle.buyDate) {
            const ageInYears = (new Date() - new Date(vehicle.buyDate)) / (1000 * 60 * 60 * 24 * 365.25);
            if (ageInYears > 5) {
                isOlderVehicle = true;
            }
        }

        const health = [];

        for (const [key, preset] of Object.entries(presets)) {
            // Find the most recent maintenance log of this category
            const logsOfCat = maintLogs.filter(log => log.category === key);
            const lastLog = logsOfCat.length > 0 ? logsOfCat[0] : null;

            const lastOdo = lastLog ? lastLog.odo : 0;
            const lastDateStr = lastLog ? lastLog.date : vehicle.buyDate;
            const lastDate = new Date(lastDateStr);
            const today = new Date();

            // Local AI Adjustments
            let adjustedIntervalKm = preset.intervalKm;
            let adjustedIntervalMonths = preset.intervalMonths;
            let hasAdjustment = false;
            let adjustmentReason = '';

            // Apply rule 1: Fuel anomaly affects spark plug and air filter
            if (isFuelAnomaly && (key === 'air_filter' || key === 'spark_plug')) {
                adjustedIntervalKm = Math.round(preset.intervalKm * 0.75); // Reduce interval by 25%
                hasAdjustment = true;
                adjustmentReason = `AI Heuristic: ${fuelAnomalyReason} Đề xuất kiểm tra và thay phụ tùng sớm hơn 25%.`;
            }

            // Apply rule 2: Older vehicles need closer safety checks
            if (isOlderVehicle && (key === 'brake' || key === 'coolant' || key === 'tires')) {
                adjustedIntervalKm = Math.round(preset.intervalKm * 0.85); // Reduce by 15%
                adjustedIntervalMonths = Math.max(3, Math.round(preset.intervalMonths * 0.8)); // Reduce by 20%
                hasAdjustment = true;
                adjustmentReason = `AI Heuristic: Xe đã trên 5 tuổi. Rút ngắn chu kỳ bảo trì phanh/lốp/làm mát thêm 15% để đảm bảo an toàn.`;
            }

            // Km-based remaining
            const elapsedKm = currentOdo - lastOdo;
            const remainingKm = Math.max(0, adjustedIntervalKm - elapsedKm);
            const percentKm = Math.max(0, Math.min(100, (remainingKm / adjustedIntervalKm) * 100));

            // Time-based remaining (in months)
            const diffTime = Math.abs(today - lastDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            const elapsedMonths = diffDays / 30.4375; // average days in a month
            const remainingMonths = Math.max(0, adjustedIntervalMonths - elapsedMonths);
            const percentTime = Math.max(0, Math.min(100, (remainingMonths / adjustedIntervalMonths) * 100));

            // Take the lower percentage (worst health index)
            const percentage = Math.round(Math.min(percentKm, percentTime));

            // Determine status
            let status = 'good';
            if (percentage <= 10 || remainingKm <= 100 || remainingMonths <= 0.5) {
                status = 'danger';
            } else if (percentage <= 30 || remainingKm <= 350 || remainingMonths <= 1.5) {
                status = 'warning';
            }

            // Calculations for UI labels
            let daysLeft = Math.round(remainingMonths * 30.4375);
            let timeLabel = '';
            if (daysLeft <= 0) {
                timeLabel = 'Hết hạn thời gian';
            } else if (daysLeft < 30) {
                timeLabel = `Còn ${daysLeft} ngày`;
            } else {
                const monthsLeft = Math.round(remainingMonths);
                timeLabel = `Còn ~${monthsLeft} tháng`;
            }

            health.push({
                key,
                name: preset.name,
                desc: preset.desc,
                icon: preset.icon,
                intervalKm: adjustedIntervalKm,
                intervalMonths: adjustedIntervalMonths,
                lastOdo,
                lastDate: lastDateStr,
                remainingKm,
                timeLabel,
                percentage,
                status,
                hasAdjustment,
                adjustmentReason
            });
        }

        return health;
    }
};

// DATA BACKUP & PORTABILITY
export const DataPortability = {
    exportData() {
        const backup = {
            version: '1.0.6',
            timestamp: new Date().toISOString(),
            vehicles: getLocal(KEYS.VEHICLES, []),
            activeId: localStorage.getItem(KEYS.ACTIVE_VEHICLE_ID) || null,
            maintenanceLogs: getLocal(KEYS.MAINTENANCE_LOGS, []),
            fuelLogs: getLocal(KEYS.FUEL_LOGS, []),
            customPresets: getLocal(KEYS.CUSTOM_PRESETS, {}),
            geminiKey: localStorage.getItem(KEYS.GEMINI_KEY) || null
        };
        return JSON.stringify(backup, null, 2);
    },

    importData(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            
            // basic validation
            if (!data.vehicles || !Array.isArray(data.vehicles)) {
                throw new Error("Định dạng dữ liệu không hợp lệ: Thiếu danh sách xe.");
            }

            setLocal(KEYS.VEHICLES, data.vehicles);
            if (data.activeId) {
                localStorage.setItem(KEYS.ACTIVE_VEHICLE_ID, data.activeId);
            } else if (data.vehicles.length > 0) {
                localStorage.setItem(KEYS.ACTIVE_VEHICLE_ID, data.vehicles[0].id);
            }
            
            setLocal(KEYS.MAINTENANCE_LOGS, data.maintenanceLogs || []);
            setLocal(KEYS.FUEL_LOGS, data.fuelLogs || []);
            setLocal(KEYS.CUSTOM_PRESETS, data.customPresets || {});
            
            if (data.geminiKey) {
                localStorage.setItem(KEYS.GEMINI_KEY, data.geminiKey);
            }
            
            return { success: true };
        } catch (e) {
            console.error("Lỗi import dữ liệu", e);
            return { success: false, error: e.message };
        }
    },

    resetAll() {
        localStorage.removeItem(KEYS.VEHICLES);
        localStorage.removeItem(KEYS.ACTIVE_VEHICLE_ID);
        localStorage.removeItem(KEYS.MAINTENANCE_LOGS);
        localStorage.removeItem(KEYS.FUEL_LOGS);
        localStorage.removeItem(KEYS.CUSTOM_PRESETS);
        localStorage.removeItem(KEYS.GEMINI_KEY);
        return true;
    }
};

// GEMINI AI INTEGRATION
export const AI = {
    getKey() {
        return localStorage.getItem(KEYS.GEMINI_KEY) || '';
    },

    saveKey(key) {
        localStorage.setItem(KEYS.GEMINI_KEY, (key || '').trim());
        return true;
    },

    async callGeminiTextAPI(prompt, defaultModel = 'gemini-3.5-flash') {
        const apiKey = this.getKey();
        if (!apiKey) throw new Error("Chưa cấu hình Gemini API Key.");

        const models = [defaultModel, "gemini-1.5-flash", "gemini-1.5-pro"];
        let lastError = null;

        for (const model of models) {
            try {
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
                });

                if (!response.ok) {
                    const errJson = await response.json().catch(() => ({}));
                    throw new Error(errJson?.error?.message || `HTTP ${response.status}`);
                }

                const resData = await response.json();
                const text = resData?.candidates?.[0]?.content?.parts?.[0]?.text;
                if (!text) throw new Error("Không nhận được phản hồi.");
                return text;
            } catch (err) {
                console.warn(`Text model ${model} failed:`, err);
                lastError = err;
                if (err.message.includes("demand") || err.message.includes("quota") || err.message.includes("limit") || err.message.includes("429") || err.message.includes("503")) {
                    continue; // try next fallback model
                }
                continue;
            }
        }
        throw lastError || new Error("Lỗi kết nối Gemini API.");
    },

    generateConsultationPrompt(vehicleId) {
        const vehicle = Vehicles.getById(vehicleId);
        if (!vehicle) return '';

        const healthStatus = Stats.getHealthStatus(vehicleId);
        const fuelStats = Stats.calculateFuelStats(vehicleId);
        const maintLogs = MaintenanceLogs.getByVehicle(vehicleId).slice(0, 10); // last 10 logs

        let prompt = `Bạn là một Bác sĩ Xe máy chuyên nghiệp và chuyên gia cơ khí hàng đầu tại Việt Nam. Hãy chẩn đoán sức khỏe chiếc xe máy sau đây và đưa ra lời khuyên bảo dưỡng thông thái, ngắn gọn, thiết thực nhất cho chủ xe.

THÔNG TIN XE:
- Tên xe: ${vehicle.name}
- Biển số: ${vehicle.plate || 'Chưa cập nhật'}
- Loại xe: ${VEHICLE_TYPES[vehicle.type] || vehicle.type}
- Số ODO hiện tại: ${vehicle.currentOdo.toLocaleString()} Km
- Ngày mua xe: ${vehicle.buyDate}

TÌNH TRẠNG HAO MÒN PHỤ TÙNG (Tính toán từ hệ thống):
`;

        healthStatus.forEach(item => {
            prompt += `- ${item.name}: Hao mòn ${item.percentage}% (Còn ${Math.round(item.remainingKm)} Km / ${item.timeLabel}). Trạng thái cảnh báo: ${item.status}. ${item.hasAdjustment ? `[Định mức đã điều chỉnh: ${item.adjustmentReason}]` : ''}\n`;
        });

        prompt += `\nTHỐNG KÊ TIÊU THỤ XĂNG:
- Tiêu hao trung bình: ${fuelStats.efficiency !== null ? fuelStats.efficiency + ' L/100 Km' : 'Chưa có đủ dữ liệu (Cần tối thiểu 2 lần đổ xăng đầy bình)'}
- Chi phí xăng trên mỗi Km: ${fuelStats.costPerKm !== null ? fuelStats.costPerKm.toLocaleString() + ' đ/Km' : 'Chưa tính được'}
- Tổng chi phí đổ xăng: ${fuelStats.totalCost.toLocaleString()} đ
`;

        if (fuelStats.chartData.length >= 2) {
            const latestEff = fuelStats.chartData[fuelStats.chartData.length - 1].efficiency;
            prompt += `- Lần đổ đầy bình gần nhất tiêu thụ: ${latestEff} L/100 Km. ${latestEff > fuelStats.efficiency * 1.12 ? `[CẢNH BÁO: Hao xăng tăng ${( ((latestEff - fuelStats.efficiency) / fuelStats.efficiency) * 100 ).toFixed(0)}% so với trung bình!]` : ''}\n`;
        }

        prompt += `\nLỊCH SỬ BẢO DƯỠNG GẦN ĐÂY:
`;
        if (maintLogs.length === 0) {
            prompt += `- Chưa ghi nhận lịch sử bảo dưỡng nào.\n`;
        } else {
            maintLogs.forEach(log => {
                prompt += `- Ngày ${log.date} (ODO ${log.odo.toLocaleString()} Km): Hạng mục ${log.category}, chi phí ${log.cost.toLocaleString()} đ. Ghi chú: ${log.notes || 'Không'}\n`;
            });
        }

        prompt += `
YÊU CẦU:
Hãy phân tích và viết một báo cáo chẩn đoán bằng tiếng Việt, định dạng HTML (sử dụng h3 cho tiêu đề chính, h4 cho tiêu đề phụ, in đậm các cảnh báo quan trọng). Báo cáo cần bao gồm:
1. **Đánh giá tổng quan sức khỏe xe** (Có điểm nào bất thường không, ví dụ như hao xăng đột biến hay xe quá hạn bảo dưỡng nhiều).
2. **Các bộ phận cần chăm sóc khẩn cấp** (Xếp hạng từ nguy kịch nhất xuống).
3. **Lời khuyên vận hành & Lịch bảo dưỡng tiếp theo** (Cần làm gì trong 1000 Km tiếp theo).
4. **Mẹo tiết kiệm xăng/tăng tuổi thọ riêng cho dòng xe này** (Ví dụ xe ga thì khuyên về dầu láp, vệ sinh nồi; xe số/côn thì khuyên về xích).
Lưu ý: Hãy viết ngắn gọn, xúc tích, tập trung vào số liệu thực tế, tránh các lời sáo rỗng. Hãy định dạng bằng thẻ HTML thô (h3, h4, p, ul, li, strong, blockquote) thay vì Markdown để hiển thị trực tiếp.`;

        return prompt;
    }
};
