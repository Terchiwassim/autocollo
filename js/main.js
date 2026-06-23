import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';

let scene, camera, renderer, controls, carModel;
let currentStickerTexture = null;
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// 🕒 نظام ذاكرة التراجع (Undo History) والمتغيرات الافتراضية للمواد
let actionHistory = []; 
const INITIAL_CAR_COLOR = 0x374151; 
let currentRoughness = 0.2; 
let currentMetalness = 0.5; 

// 🌐 قاموس الترجمة الفوري للنصوص البرمجية الديناميكية والتنبيهات وشاشات التحميل
const translations = {
    ar: {
        noCarAlert: "يرجى كتابة اسم السيارة أولاً!",
        stickerLoaded: "🎯 تم تحميل الشعار! اضغط فوق السيارة 3D لتثبيته.",
        noModifications: "🔄 لا توجد أي تعديلات سابقة للتراجع عنها حالياً!",
        selectCarFirst: "❌ يرجى اختيار سيارة وتعديلها أولاً!",
        savingText: "⏳ جاري الحفظ...",
        saveSuccess: "🎯 تم حفظ تعديلك داخل المعرض بنجاح!",
        saveError: "❌ تعذر الحفظ بالسيرفر.",
        saveBtnNormal: "💾 حفظ لقطة التصميم بالمعرض",
        pendingMsg: "⏳ طلبك قيد المراجعة حالياً من طرف الأدمن .",
        accountNotFound: "❌ الحساب غير موجود! يرجى إنشاء حساب جديد أولاً.",
        serverError: "❌ تعذر الاتصال بالسيرفر.",
        fillAllFields: "❌ يرجى ملء جميع الحقول المطلوبة!",
        sendingData: "⏳ جاري إرسال البيانات إلى السيرفر...",
        sendSuccess: "⏳ <strong>تم الإرسال بنجاح:</strong> سيقوم الأدمن بالتفعيل قريباً!",
        fetchError: "❌ فشل الاتصال بالخادم! تأكد من تشغيل السيرفر.",
        loaderTitle: "⏳ جاري تجهيز الورشة...",
        loaderSubText: "يرجى الانتظار، جاري تحميل مجسم السيارة 3D..."
    },
    en: {
        noCarAlert: "Please enter a car name first!",
        stickerLoaded: "🎯 Logo loaded! Click anywhere on the 3D car to place it.",
        noModifications: "🔄 No previous modifications found to undo!",
        selectCarFirst: "❌ Please choose and customize a car first!",
        savingText: "⏳ Saving...",
        saveSuccess: "🎯 Your modification has been saved to the gallery successfully!",
        saveError: "❌ Failed to save design to server.",
        saveBtnNormal: "💾 Save Design Snapshot to Gallery",
        pendingMsg: "⏳ Your request is currently pending review by the admin.",
        accountNotFound: "❌ Account not found! Please create a new account first.",
        serverError: "❌ Server connection error.",
        fillAllFields: "❌ Please fill in all required fields!",
        sendingData: "⏳ Sending data to server...",
        sendSuccess: "⏳ <strong>Sent successfully:</strong> Admin will activate your account soon!",
        fetchError: "❌ Connection failed! Make sure the server is running.",
        loaderTitle: "⏳ Preparing Workshop...",
        loaderSubText: "Please wait, loading 3D car model..."
    }
};

function getActiveLang() {
    return localStorage.getItem('preferredLang') || 'ar';
}

const workshopAds = [
    { 
        title_ar: "ورشة 'الأناقة' لتعديل سيارات الـ 3D", desc_ar: "📍 سطيف - صبغة مطفية وتغليف كامل وتعديل الهياكل",
        title_en: "'Al-Anaka' Workshop for 3D Car Tuning", desc_en: "📍 Setif - Matte paint, Full wrapping & Body tuning"
    },
    { 
        title_ar: "مركز 'AutoTuning DZ' للمحترفين", desc_ar: "📍 وهران - تركيب جنوط رياضية وتزويد المحركات",
        title_en: "'AutoTuning DZ' Center for Professionals", desc_en: "📍 Oran - Sports rims installation & Engine tuning"
    }
];
let currentAdIndex = 0;

function initAdSlider() {
    setInterval(() => {
        currentAdIndex = (currentAdIndex + 1) % workshopAds.length;
        const card = document.getElementById('adCard');
        if (card) {
            card.style.opacity = 0;
            setTimeout(() => {
                const titleEl = document.getElementById('adTitle');
                const descEl = document.getElementById('adDesc');
                const lang = getActiveLang();
                
                if (titleEl) titleEl.innerText = lang === 'en' ? workshopAds[currentAdIndex].title_en : workshopAds[currentAdIndex].title_ar;
                if (descEl) descEl.innerText = lang === 'en' ? workshopAds[currentAdIndex].desc_en : workshopAds[currentAdIndex].desc_ar;
                
                card.style.opacity = 1;
            }, 400);
        }
    }, 4500);
}

function createGradientHDRI() {
    const width = 512;
    const height = 256;
    const size = width * height;
    const data = new Float32Array(3 * size);

    for (let i = 0; i < size; i++) {
        const y = Math.floor(i / width) / height;
        const x = (i % width) / width;

        let r = 0.12, g = 0.15, b = 0.20; 

        if (y < 0.28 && x > 0.25 && x < 0.75) {
            r = 2.8; g = 2.8; b = 2.8; 
        }
        if (x > 0.88 || x < 0.12) {
            r = 0.1; g = 0.4; b = 1.6;
        }

        const stride = i * 3;
        data[stride] = r;
        data[stride + 1] = g;
        data[stride + 2] = b;
    }

    const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.FloatType);
    texture.needsUpdate = true;
    return texture;
}

function init3DScene() {
    scene = new THREE.Scene();
    scene.background = null; 

    const container = document.getElementById("3dContainer");
    const canvasEl = document.getElementById("scene");
    if (!canvasEl || !container) return;

    const width = container.clientWidth;
    const height = container.clientHeight || 440;

    camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(4, 2, 6); 

    renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();

    const dataTexture = createGradientHDRI();
    const envMap = pmremGenerator.fromEquirectangular(dataTexture).texture;
    
    scene.environment = envMap; 
    dataTexture.dispose();
    pmremGenerator.dispose();

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
    sunLight.position.set(10, 15, 10);
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0xffffff, 0.8);
    rimLight.position.set(-10, 8, -10);
    scene.add(rimLight);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enableZoom = true; 

    canvasEl.addEventListener('click', onCanvasClick);

    function animate() {
        requestAnimationFrame(animate);
        if (carModel) carModel.rotation.y += 0.002; 
        controls.update();
        renderer.render(scene, camera);
    }
    animate();
}

function onCanvasClick(event) {
    if (!currentStickerTexture || !carModel) return;

    const canvasEl = document.getElementById("scene");
    const rect = canvasEl.getBoundingClientRect();

    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(carModel, true);

    if (intersects.length > 0) {
        const intersection = intersects[0];
        
        if (intersection.object.material.transparent === true || intersection.object.material.opacity < 0.9) {
            return;
        }

        const position = intersection.point;
        const orientation = new THREE.Euler();
        const dummyHelper = new THREE.Object3D();
        
        dummyHelper.position.copy(position);
        dummyHelper.lookAt(position.clone().add(intersection.normal));
        orientation.copy(dummyHelper.rotation);

        const sizeSlider = document.getElementById('stickerSizeSlider');
        const s = sizeSlider ? parseFloat(sizeSlider.value) : 0.4;
        const decalSize = new THREE.Vector3(s, s, 1.0);

        const decalMaterial = new THREE.MeshStandardMaterial({
            map: currentStickerTexture,
            transparent: true,
            depthTest: true,
            depthWrite: false,
            polygonOffset: true,
            polygonOffsetFactor: -4, 
            roughness: 0.3,
            metalness: 0.2
        });

        const decalGeometry = new DecalGeometry(intersection.object, position, orientation, decalSize);
        const decalMesh = new THREE.Mesh(decalGeometry, decalMaterial);

        intersection.object.updateMatrixWorld();
        const inverseMat = intersection.object.matrixWorld.clone().invert();
        decalMesh.applyMatrix4(inverseMat);

        intersection.object.add(decalMesh);
        
        actionHistory.push({
            type: 'sticker',
            mesh: decalMesh,
            parent: intersection.object
        });
    }
}

window.undoLastAction = () => {
    const lang = getActiveLang();
    if (actionHistory.length === 0) {
        alert(translations[lang].noModifications);
        return;
    }

    const lastAction = actionHistory.pop();

    if (lastAction.type === 'sticker') {
        if (lastAction.parent && lastAction.mesh) {
            lastAction.parent.remove(lastAction.mesh);
        }
    } else if (lastAction.type === 'color' || lastAction.type === 'finish') {
        let previousColor = INITIAL_CAR_COLOR;
        let previousRoughness = 0.2;
        let previousMetalness = 0.5;

        for (let i = actionHistory.length - 1; i >= 0; i--) {
            if (actionHistory[i].type === 'color') {
                previousColor = actionHistory[i].color;
            }
            if (actionHistory[i].type === 'finish') {
                previousRoughness = actionHistory[i].roughness;
                previousMetalness = actionHistory[i].metalness;
            }
        }
        
        currentRoughness = previousRoughness;
        currentMetalness = previousMetalness;
        applyColorToMeshes(previousColor, previousRoughness, previousMetalness);
    }
};

window.switchAuth = (type) => {
    const report = document.getElementById('statusReport');
    if (report) report.innerText = "";

    if (type === 'login') {
        document.getElementById('tab-login').classList.add('active');
        document.getElementById('tab-register').classList.remove('active');
        document.getElementById('loginForm').style.display = 'block';
        document.getElementById('registerForm').style.display = 'none';
    } else {
        document.getElementById('tab-register').classList.add('active');
        document.getElementById('tab-login').classList.remove('active');
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('registerForm').style.display = 'block';
    }
};

window.handleLogin = async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const report = document.getElementById('statusReport');
    const lang = getActiveLang();

    try {
        const res = await fetch(`https://autocollo-api.onrender.com/check-status/${email}`);
        const data = await res.json();

        if (data.status === 'active') {
            localStorage.setItem('user_strict_email', email);
            unlockSimulator();
        } else if (data.status === 'pending') {
            if (report) {
                report.innerHTML = translations[lang].pendingMsg;
                report.style.color = "#fbbf24";
            }
        } else {
            if (report) {
                report.innerText = translations[lang].accountNotFound;
                report.style.color = "#ef4444";
            }
        }
    } catch (err) {
        if (report) report.innerText = translations[lang].serverError;
    }
};

window.handleStrictRegister = async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('regName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPass').value;
    const transactionId = document.getElementById('regTxnId').value.trim();
    const report = document.getElementById('statusReport');
    const lang = getActiveLang();

    if (!name || !email || !password || !transactionId) {
        if (report) {
            report.innerText = translations[lang].fillAllFields;
            report.style.color = "#ef4444";
        }
        return;
    }

    const payload = { name, email, password, transaction_id: transactionId };

    if (report) {
        report.innerText = translations[lang].sendingData;
        report.style.color = "#38bdf8";
    }

    try {
        const response = await fetch('https://autocollo-api.onrender.com/register-secure', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            localStorage.setItem('user_strict_email', email);
            if (report) {
                report.innerHTML = translations[lang].sendSuccess;
                report.style.color = "#fbbf24";
            }
            document.getElementById('registerForm').reset();
        } else {
            const errData = await response.json().catch(() => ({}));
            if (report) {
                report.innerText = lang === 'en' ? `❌ Registration Failed: ${errData.detail || "Server error"}` : `❌ فشل التسجيل: ${errData.detail || "خطأ من السيرفر"}`;
                report.style.color = "#ef4444";
            }
        }
    } catch (err) {
        console.error("Fetch Error:", err);
        if (report) {
            report.innerText = translations[lang].fetchError;
            report.style.color = "#ef4444";
        }
    }
};

async function checkSessionFromServer() {
    const email = localStorage.getItem('user_strict_email');
    if (!email) return;
    try {
        const res = await fetch(`https://autocollo-api.onrender.com/check-status/${email}`);
        const data = await res.json();
        if (data.status === 'active') unlockSimulator();
    } catch (e) {}
}

function unlockSimulator() {
    document.getElementById('authGate').style.display = 'none';
    document.getElementById('adCard').style.display = 'none';
    document.getElementById('appPanel').style.display = 'block';
    const badge = document.getElementById('securityBadge');
    const lang = getActiveLang();

    if (badge) {
        badge.innerText = lang === 'en' ? "🔓 Account activated & active" : "🔓 الحساب مفعّل ونشط";
        badge.style.background = "#10b981";
    }
    setTimeout(() => window.dispatchEvent(new Event('resize')), 100);
}

function applyColorToMeshes(colorValue, roughness, metalness) {
    if (!carModel) return;
    carModel.traverse((child) => {
        if (child.isMesh) {
            const name = child.name.toLowerCase();
            const matName = child.material.name ? child.material.name.toLowerCase() : '';

            if (child.material.transparent === true || child.material.opacity < 0.9) return;

            const excludedMaterials = ['k319b9', 'k314pk', 'gu-9b9', 'k3d4pk', 'k1z4pk', 'k294pk', 'gengpl001'];
            if (excludedMaterials.includes(matName)) return; 

            const shouldExcludeNormal =
                name.includes('glass') || name.includes('window') || name.includes('vitre') ||
                name.includes('tire') || name.includes('wheel') || name.includes('rim') || name.includes('pneu') ||
                name.includes('light') || name.includes('lamp') || name.includes('phare') || name.includes('optique') ||
                name.includes('interior') || name.includes('seat') || name.includes('mirror') || name.includes('retro');

            if (!shouldExcludeNormal && child.material) {
                child.material = child.material.clone();
                if (colorValue !== null) child.material.color.set(colorValue);
                child.material.roughness = roughness;
                child.material.metalness = metalness;
                
                child.material.envMapIntensity = 1.6; 
                child.material.needsUpdate = true;
            }
        }
    });
}

window.applyColor = (colorValue) => {
    const lang = getActiveLang();
    if (!carModel) {
        alert(translations[lang].noCarAlert);
        return;
    }
    actionHistory.push({ type: 'color', color: colorValue });
    applyColorToMeshes(colorValue, currentRoughness, currentMetalness);
};

window.changePaintFinish = (type) => {
    const lang = getActiveLang();
    if (!carModel) {
        alert(lang === 'en' ? "❌ Please load a car model first!" : "❌ يرجى تحميل مجسم السيارة أولاً!");
        return;
    }

    if (type === 'matte') {
        currentRoughness = 0.95; 
        currentMetalness = 0.05; 
    } else if (type === 'glossy') {
        currentRoughness = 0.05; 
        currentMetalness = 0.25;
    } else if (type === 'metallic') {
        currentRoughness = 0.25;
        currentMetalness = 0.95; 
    }

    actionHistory.push({ type: 'finish', roughness: currentRoughness, metalness: currentMetalness });
    applyColorToMeshes(null, currentRoughness, currentMetalness);

    document.querySelectorAll('.btn-finish').forEach(btn => btn.classList.remove('active'));
    if (type === 'matte') document.getElementById('btnMatte')?.classList.add('active');
    if (type === 'glossy') document.getElementById('btnGlossy')?.classList.add('active');
    if (type === 'metallic') document.getElementById('btnMetallic')?.classList.add('active');
};

window.applyLogoSticker = (event) => {
    const file = event.target.files[0];
    const lang = getActiveLang();
    if (!file || !carModel) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        new THREE.TextureLoader().load(e.target.result, (texture) => {
            texture.wrapS = THREE.ClampToEdgeWrapping;
            texture.wrapT = THREE.ClampToEdgeWrapping;
            currentStickerTexture = texture;
            document.getElementById("scene").style.cursor = "crosshair";
            alert(translations[lang].stickerLoaded);
        });
    };
    reader.readAsDataURL(file);
};

window.save3DDesign = async () => {
    const carName = document.getElementById('carInput').value.trim();
    const btn = document.getElementById('tuningBtn');
    const canvasEl = document.getElementById("scene");
    const lang = getActiveLang();

    if (!carName) {
        alert(translations[lang].selectCarFirst);
        return;
    }

    btn.disabled = true;
    btn.innerText = translations[lang].savingText;

    const capturedSnapshot = canvasEl.toDataURL("image/png");
    const userEmail = localStorage.getItem('user_strict_email') || "test@example.com";
    
    try {
        await fetch('https://autocollo-api.onrender.com/gallery/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_email: userEmail, car_name: carName, modification: "3D", image_url: capturedSnapshot })
        });
        alert(translations[lang].saveSuccess);
    } catch (err) {
        alert(translations[lang].saveError);
    } finally {
        btn.disabled = false;
        btn.innerText = translations[lang].saveBtnNormal;
    }
};

window.logout = () => { localStorage.clear(); location.reload(); };

const carModelsMap = {
    'cupra': './assets/car.glb', 'كوبرا': './assets/car.glb',
    'golf': './assets/golf.glb', 'golf 8': './assets/golf.glb', 'جولف': './assets/golf.glb',
    'accent': './assets/Accent.glb', 'اكسنت': './assets/Accent.glb',
    'tipo': './assets/Fiat.glb', 'تيبو': './assets/Fiat.glb',
    'chery': './assets/Chery.glb', 'شيري': './assets/Chery.glb',
    'partner': './assets/Partner.glb', 'بيجو': './assets/Partner.glb',
    'logan': './assets/Logan.glb', 'لوجان': './assets/Logan.glb',
    'ibiza': './assets/ibiza.glb', 'إيبيزا': './assets/ibiza.glb',
    'qq':'./assets/qq.glb',
};

document.addEventListener("DOMContentLoaded", () => {
    const regForm = document.getElementById('registerForm');
    if (regForm) {
        regForm.removeAttribute('onsubmit');
        regForm.addEventListener('submit', window.handleStrictRegister);
    }

    init3DScene();
    initAdSlider();
    checkSessionFromServer();

    const carInputEl = document.getElementById('carInput');
    if (carInputEl) {
        carInputEl.addEventListener('input', (e) => {
            const value = e.target.value.toLowerCase().trim();
            if (carModelsMap[value]) {
                
                const preloader = document.getElementById('preloader3D');
                const progressBar = document.getElementById('progressBar');
                const progressText = document.getElementById('progressText');
                const loaderTitle = document.getElementById('loaderTitle');
                const loaderSubText = document.getElementById('loaderSubText');
                const lang = getActiveLang();

                if (preloader) preloader.style.display = 'flex';
                if (progressBar) progressBar.style.width = '0%';
                if (progressText) progressText.innerText = '0%';
                if (loaderTitle) loaderTitle.innerText = translations[lang].loaderTitle;
                if (loaderSubText) loaderSubText.innerText = translations[lang].loaderSubText;

                new GLTFLoader().load(
                    carModelsMap[value], 
                    
                    (gltf) => {
                        if (carModel) scene.remove(carModel);
                        carModel = gltf.scene;

                        const box = new THREE.Box3().setFromObject(carModel);
                        const size = box.getSize(new THREE.Vector3());
                        const center = box.getCenter(new THREE.Vector3());

                        carModel.position.x += (carModel.position.x - center.x);
                        carModel.position.y += (carModel.position.y - center.y);
                        carModel.position.z += (carModel.position.z - center.z);

                        const maxDimension = Math.max(size.x, size.y, size.z);
                        if (maxDimension > 0) {
                            carModel.scale.setScalar(3.8 / maxDimension);
                        }

                        actionHistory = []; 

                        carModel.traverse((child) => {
                            if (child.isMesh) {
                                child.material.color.setHex(INITIAL_CAR_COLOR);
                                child.material.roughness = currentRoughness;
                                child.material.metalness = currentMetalness;
                                
                                child.material.envMapIntensity = 1.6;
                                child.material.needsUpdate = true;
                            }
                        });

                        scene.add(carModel);
                        document.getElementById('placeholderText').style.display = "none";
                        
                        if (preloader) preloader.style.display = 'none';
                    },
                    
                    (xhr) => {
                        if (xhr.total > 0) {
                            const percentComplete = Math.round((xhr.loaded / xhr.total) * 100);
                            if (progressBar) progressBar.style.width = percentComplete + '%';
                            if (progressText) progressText.innerText = percentComplete + '%';
                        }
                    },
                    
                    (error) => {
                        console.error('حدث خطأ أثناء تحميل مجسم الـ 3D:', error);
                        if (preloader) preloader.style.display = 'none';
                    }
                );
            }
        });
    }
});

window.addEventListener('resize', () => {
    const container = document.getElementById("3dContainer");
    if (camera && renderer && container) {
        camera.aspect = container.clientWidth / (container.clientHeight || 440);
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight || 440);
    }
});

document.addEventListener("DOMContentLoaded", () => {
    const themeToggle = document.getElementById("themeToggle");
    const currentTheme = localStorage.getItem("theme");
    if (currentTheme === "light") {
        document.body.classList.add("light-mode");
    }

    if (themeToggle) {
        themeToggle.addEventListener("click", () => {
            document.body.classList.toggle("light-mode");
            if (document.body.classList.contains("light-mode")) {
                localStorage.setItem("theme", "light");
            } else {
                localStorage.setItem("theme", "dark");
            }
        });
    }
});