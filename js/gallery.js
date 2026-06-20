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

    if (!userEmail) {
        grid.innerHTML = `<div class="no-data">❌ يرجى تسجيل الدخول أولاً لرؤية معرض تصاميمك.</div>`;
        return;
    }

    try {
        const response = await fetch(`http://127.0.0.1:8000/gallery/${userEmail}`);
        if (!response.ok) throw new Error("فشل جلب البيانات");
        
        const designs = await response.json();

        if (designs.length === 0) {
            grid.innerHTML = `<div class="no-data">🚗 مرآبك فارغ حالياً! قم بتعديل سيارة في الورشة واضغط على زر الحفظ لتظهر هنا.</div>`;
            return;
        }

        grid.innerHTML = ""; // تنظيف النص المؤقت

        designs.forEach(design => {
            const card = document.createElement("div");
            card.className = "design-card";
            
            // 📝 تم حذف حدث الضغط (Click Event) الذي كان يفتح نافذة الـ 3D تماماً بناءً على طلبك

            card.innerHTML = `
                <div class="card-glass-overlay"></div>
                <button class="btn-delete" onclick="deleteDesign(${design.id}, event)">🗑️ حذف</button>
                
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
        grid.innerHTML = `<div class="no-data">❌ فشل الاتصال بالسيرفر! تأكد من تشغيل ملف main.py.</div>`;
    }
}

// 🗑️ دالة حذف التصميم وإرسال الطلب للباك إند
async function deleteDesign(designId, event) {
    event.stopPropagation(); // منع انتشار الحدث
    
    if (!confirm("هل أنت متأكد من رغبتك في حذف هذا التصميم نهائياً؟")) return;

    try {
        const response = await fetch(`http://127.0.0.1:8000/gallery/delete/${designId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            alert("🎯 تم حذف التصميم بنجاح!");
            loadUserGallery(); // تحديث فوري للشبكة
        } else {
            alert("❌ فشل حذف التصميم من السيرفر.");
        }
    } catch (error) {
        console.error("Error deleting design:", error);
        alert("❌ حدث خطأ في الاتصال.");
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
});

