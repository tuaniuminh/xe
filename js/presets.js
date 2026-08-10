/* MotoCare Presets Config */

export const DEFAULT_PRESETS = {
    oil_engine: {
        name: "Dầu nhớt động cơ",
        icon: "oil",
        desc: "Bôi trơn động cơ, giữ máy mát và hoạt động êm ái.",
        intervalKm: 2000,
        intervalMonths: 6,
        scooter: true,
        manual: true,
        clutch: true
    },
    oil_gear: {
        name: "Dầu hộp số (Dầu láp)",
        icon: "oil_gear",
        desc: "Bôi trơn hệ thống truyền động bánh sau xe tay ga. Thường thay mỗi 3 lần dầu máy.",
        intervalKm: 6000,
        intervalMonths: 12,
        scooter: true,
        manual: false,
        clutch: false
    },
    air_filter: {
        name: "Lọc gió động cơ",
        icon: "air",
        desc: "Lọc bụi bẩn trước khi khí vào buồng đốt. Bẩn gây hao xăng, nóng máy.",
        intervalKm: 10000,
        intervalMonths: 12,
        scooter: true,
        manual: true,
        clutch: true
    },
    spark_plug: {
        name: "Bugi đánh lửa",
        icon: "spark",
        desc: "Đánh lửa đốt cháy nhiên liệu. Bugi cũ khiến xe khó nổ, máy yếu.",
        intervalKm: 10000,
        intervalMonths: 12,
        scooter: true,
        manual: true,
        clutch: true
    },
    coolant: {
        name: "Nước làm mát",
        icon: "coolant",
        desc: "Giải nhiệt động cơ cho xe có két nước. Cần châm định kỳ hoặc thay mới.",
        intervalKm: 15000,
        intervalMonths: 18,
        scooter: true,
        manual: false,
        clutch: true
    },
    brake: {
        name: "Má phanh (Trước/Sau)",
        icon: "brake",
        desc: "Đảm bảo lực phanh an toàn. Cần kiểm tra độ mòn định kỳ.",
        intervalKm: 5000,
        intervalMonths: 6,
        scooter: true,
        manual: true,
        clutch: true
    },
    chain: {
        name: "Xích / Nhông sên dĩa",
        icon: "chain",
        desc: "Vệ sinh bôi trơn xích định kỳ, thay thế khi nhông dĩa bị mòn răng.",
        intervalKm: 500,
        intervalMonths: 1,
        scooter: false,
        manual: true,
        clutch: true
    },
    tires: {
        name: "Vỏ xe (Lốp trước/sau)",
        icon: "tire",
        desc: "Đảm bảo độ bám đường. Lốp mòn dễ trơn trượt và nhanh thủng xăm.",
        intervalKm: 15000,
        intervalMonths: 24,
        scooter: true,
        manual: true,
        clutch: true
    }
};

export const VEHICLE_TYPES = {
    scooter: "Xe tay ga (Scooter)",
    manual: "Xe số phổ thông (Manual)",
    clutch: "Xe côn tay (Clutch)"
};
