// 🌐 قاموس الترجمة الفوري لنصوص صفحة المعرض والتنبيهات
const galleryTranslations = {
    ar: {
        loginRequired: "❌ يرجى تسجيل الدخول أولاً لرؤية معرض تصاميمك.",
        emptyGarage: "🚗 مرآبك فارغ حالياً! قم بتعديل سيارة في الورشة واضغط على زر الحفظ لتظهر هنا.",
        serverError: "❌ فشل الاتصال بالسيرفر! تأكد من تشغيل ملف main.py.",
        deleteConfirm: "هل أنت متأكد من رغبتك في حذف هذا التصميم نهائياً؟",
        deleteSuccess: "🎯 تم حذف التصميم بنجاح!",
        deleteFailed: "❌ فشل حذف التصميم من السيرفر.",
        connectionError: "❌ حدث خطأ في الاتصال.",
        deleteBtn: "🗑️ حذف"
    },
    en: {
        loginRequired: "❌ Please log in first to view your custom designs gallery.",
        emptyGarage: "🚗 Your garage is currently empty! Customize a car in the workshop and press the save button to see it here.",
        serverError: "❌ Connection to server failed! Please ensure main.py is running.",
        deleteConfirm: "Are you sure you want to permanently delete this design?",
        deleteSuccess: "🎯 Design deleted successfully!",
        deleteFailed: "❌ Failed to delete the design from server.",
        connectionError: "❌ Connection error occurred.",
        deleteBtn: "🗑️ Delete"
    }
};

// دالة مساعدة سريعة لمعرفة اللغة النشطة حاليًا في المتصفح
function getGalleryLang() {
    return localStorage.getItem('preferredLang') || 'ar';
}

document.addEventListener("DOMContentLoaded", () => {
    loadUserGallery();
});

// ↩️ دالة العودة خطوة واحدة إلى الخلف
function goBackStep() {
    window.history.back();
}
window.goBackStep = goBackStep;

// دالة جلب التصاميم المحفوظة من سيرفر البايثون وعرضها كصور ثابتة فقط
async function loadUserGallery() {
    const grid = document.getElementById("galleryGrid");
    const userEmail = localStorage.getItem('user_strict_email');
    const lang = getGalleryLang();

    if (!userEmail) {
        grid.innerHTML = `<div class="no-data">${galleryTranslations[lang].loginRequired}</div>`;
        return;
    }

    try {
        const response = await fetch(`https://autocollo-api.onrender.com/gallery/${userEmail}`);
        if (!response.ok) throw new Error("فشل جلب البيانات");
        
        const designs = await response.json();

        if (designs.length === 0) {
            grid.innerHTML = `<div class="no-data">${galleryTranslations[lang].emptyGarage}</div>`;
            return;
        }

        grid.innerHTML = ""; // تنظيف النص المؤقت

        designs.forEach(design => {
            const card = document.createElement("div");
            card.className = "design-card";

            card.innerHTML = `
                <div class="card-glass-overlay"></div>
                <button class="btn-delete" onclick="deleteDesign(${design.id}, event)">${galleryTranslations[lang].deleteBtn}</button>
                
                <div class="card-preview-zone">
                    <img class="design-img" src="${design.image_url}" alt="${design.car_name}">
                </div>
                
                <div class="design-info">
                    <h4 class="design-car-name">👑 ${design.car_name}</h4>
                </div>
            `;
            grid.appendChild(card);
        });

    } catch (err) {
        console.error(err);
        grid.innerHTML = `<div class="no-data">${galleryTranslations[lang].serverError}</div>`;
    }
}

// 🗑️ دالة حذف التصميم وإرسال الطلب للباك إند
async function deleteDesign(designId, event) {
    event.stopPropagation(); // منع انتشار الحدث
    const lang = getGalleryLang();
    
    if (!confirm(galleryTranslations[lang].deleteConfirm)) return;

    try {
        const response = await fetch(`https://autocollo-api.onrender.com/gallery/delete/${designId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            alert(galleryTranslations[lang].deleteSuccess);
            loadUserGallery(); // تحديث فوري للشبكة
        } else {
            alert(galleryTranslations[lang].deleteFailed);
        }
    } catch (error) {
        console.error("Error deleting design:", error);
        alert(galleryTranslations[lang].connectionError);
    }
}

// ربط دالة الحذف بالـ Window لتكون متاحة للـ HTML
window.deleteDesign = deleteDesign;

// --- 🌗 إعدادات الـ Dark & Light Mode الذكية الخاصة بالصفحة ---
document.addEventListener("DOMContentLoaded", () => {
    const themeToggle = document.getElementById("themeToggle");
    
    const currentTheme = localStorage.getItem("theme");
    if (currentTheme === "light") {
        document.body.classList.add("light-mode");
    }

    if (themeToggle) {
        themeToggle.addEventListener("click", () => {
            document.body.classList.toggle("light-mode");
            const isLight = document.body.classList.contains("light-mode");
            localStorage.setItem("theme", isLight ? "light" : "dark");
        });
    }

    // 🌐 الاستماع لزر تبديل اللغة إذا كان متواجد في صفحة المعرض لتحديث الكروت فوراً
    const langToggleBtn = document.getElementById('langToggle');
    if (langToggleBtn) {
        langToggleBtn.addEventListener('click', () => {
            setTimeout(() => {
                loadUserGallery(); // إعادة بناء المعرض باللغة الجديدة فوراً
            }, 50);
        });
    }
});