import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';

let scene, camera, renderer, controls, carModel;
let currentStickerTexture = null;
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// 🕒 نظام ذاكرة التراجع (Undo History)
let actionHistory = []; 
const INITIAL_CAR_COLOR = 0x374151; 

const workshopAds = [
    { title: "ورشة 'الأناقة' لتعديل سيارات الـ 3D", desc: "📍 سطيف - صبغة مطفية وتغليف كامل وتعديل الهياكل" },
    { title: "مركز 'AutoTuning DZ' للمحترفين", desc: "📍 وهران - تركيب جنوط رياضية وتزويد المحركات" }
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
                if (titleEl) titleEl.innerText = workshopAds[currentAdIndex].title;
                if (descEl) descEl.innerText = workshopAds[currentAdIndex].desc;
                card.style.opacity = 1;
            }, 400);
        }
    }, 4500);
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

    const ambientLight = new THREE.AmbientLight(0xffffff, 2.5);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.8);
    dirLight1.position.set(5, 10, 7);
    scene.add(dirLight1);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enableZoom = true; 

    canvasEl.addEventListener('click', onCanvasClick);

    function animate() {
        requestAnimationFrame(animate);
        if (carModel) carModel.rotation.y += 0.003; 
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
        
        // 💾 تخزين حدث الملصق للتراجع
        actionHistory.push({
            type: 'sticker',
            mesh: decalMesh,
            parent: intersection.object
        });
    }
}

// ↩️ دالة التراجع البرمجية
window.undoLastAction = () => {
    if (actionHistory.length === 0) {
        alert("🔄 لا توجد أي تعديلات سابقة للتراجع عنها حالياً!");
        return;
    }

    const lastAction = actionHistory.pop();

    if (lastAction.type === 'sticker') {
        if (lastAction.parent && lastAction.mesh) {
            lastAction.parent.remove(lastAction.mesh);
        }
    } else if (lastAction.type === 'color') {
        let previousColor = INITIAL_CAR_COLOR;
        for (let i = actionHistory.length - 1; i >= 0; i--) {
            if (actionHistory[i].type === 'color') {
                previousColor = actionHistory[i].color;
                break;
            }
        }
        applyColorToMeshes(previousColor, 0.2, 0.5);
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
    const email = document.getElementById('loginEmail').value;
    const report = document.getElementById('statusReport');

    try {
        const res = await fetch(`https://autocollo-api.onrender.com/check-status/${email}`);
        const data = await res.json();

        if (data.status === 'active') {
            localStorage.setItem('user_strict_email', email);
            unlockSimulator();
        } else if (data.status === 'pending') {
            if (report) {
                report.innerHTML = "⏳ طلبك قيد المراجعة حالياً من طرف الأدمن .";
                report.style.color = "#fbbf24";
            }
        } else {
            if (report) {
                report.innerText = "❌ الحساب غير موجود! يرجى إنشاء حساب جديد أولاً.";
                report.style.color = "#ef4444";
            }
        }
    } catch (err) {
        if (report) report.innerText = "❌ تعذر الاتصال بالسيرفر.";
    }
};

window.handleStrictRegister = async (e) => {
    e.preventDefault();
    const name = document.getElementById('regName').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPass').value;
    const transactionId = document.getElementById('regTxnId').value;
    const report = document.getElementById('statusReport');

    const payload = { name, email, password, transaction_id: transactionId };

    try {
        const response = await fetch('https://autocollo-api.onrender.com/register-secure', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        localStorage.setItem('user_strict_email', email);
        if (report) {
            report.innerHTML = `⏳ <strong>تم الإرسال بنجاح:</strong> سيقوم الأدمن بالتفعيل قريباً!`;
            report.style.color = "#fbbf24";
        }
    } catch (err) {
        if (report) report.innerText = "❌ فشل الاتصال بالخادم.";
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
    if (badge) {
        badge.innerText = "🔓 الحساب مفعّل ونشط";
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
                child.material.color.set(colorValue);
                child.material.roughness = roughness;
                child.material.metalness = metalness;
                child.material.needsUpdate = true;
            }
        }
    });
}

window.applyColor = (colorValue, roughness, metalness) => {
    if (!carModel) {
        alert("يرجى كتابة اسم السيارة أولاً!");
        return;
    }
    actionHistory.push({ type: 'color', color: colorValue });
    applyColorToMeshes(colorValue, roughness, metalness);
};

window.applyLogoSticker = (event) => {
    const file = event.target.files[0];
    if (!file || !carModel) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        new THREE.TextureLoader().load(e.target.result, (texture) => {
            texture.wrapS = THREE.ClampToEdgeWrapping;
            texture.wrapT = THREE.ClampToEdgeWrapping;
            currentStickerTexture = texture;
            document.getElementById("scene").style.cursor = "crosshair";
            alert("🎯 تم تحميل الشعار! اضغط فوق السيارة 3D لتثبيته.");
        });
    };
    reader.readAsDataURL(file);
};

window.save3DDesign = async () => {
    const carName = document.getElementById('carInput').value.trim();
    const btn = document.getElementById('tuningBtn');
    const canvasEl = document.getElementById("scene");

    if (!carName) {
        alert("❌ يرجى اختيار سيارة وتعديلها أولاً!");
        return;
    }

    btn.disabled = true;
    btn.innerText = "⏳ جاري الحفظ...";

    const capturedSnapshot = canvasEl.toDataURL("image/png");
    const userEmail = localStorage.getItem('user_strict_email') || "test@example.com";
    
    try {
        await fetch('https://autocollo-api.onrender.com/gallery/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_email: userEmail, car_name: carName, modification: "3D", image_url: capturedSnapshot })
        });
        alert("🎯 تم حفظ تعديلك داخل المعرض بنجاح!");
    } catch (err) {
        alert("❌ تعذر الحفظ بالسيرفر.");
    } finally {
        btn.disabled = false;
        btn.innerText = "💾 حفظ لقطة التصميم بالمعرض";
    }
};

window.logout = () => { localStorage.clear(); location.reload(); };

const carModelsMap = {
    'cupra': './assets/car.glb', 'كوبرا': './assets/car.glb',
    'golf': './assets/golf.glb', 'golf 8': './assets/golf.glb', 'جولف': './assets/golf.glb',
    'accent': './assets/Accent.glb', 'اكسنت': './assets/Accent.glb',
    'fiat tipo': './assets/Fiat.glb', 'فيات تيبو': './assets/Fiat.glb',
    'chery': './assets/Chery.glb', 'شيري': './assets/Chery.glb',
    'partner': './assets/Partner.glb', 'بيجو': './assets/Partner.glb',
    'logan': './assets/Logan.glb', 'لوجان': './assets/Logan.glb',
     'ibiza': './assets/ibiza.glb',
                'إيبيزا': './assets/ibiza.glb',
                'qq':'./assets/qq.glb',
                // 'lupo':'./assets/volkswagen_golf_vision_gti.glb',
};

document.addEventListener("DOMContentLoaded", () => {
    const regForm = document.getElementById('registerForm');
    if (regForm) regForm.addEventListener('submit', window.handleStrictRegister);

    init3DScene();
    initAdSlider();
    checkSessionFromServer();

    const carInputEl = document.getElementById('carInput');
    if (carInputEl) {
        carInputEl.addEventListener('input', (e) => {
            const value = e.target.value.toLowerCase().trim();
            if (carModelsMap[value]) {
                new GLTFLoader().load(carModelsMap[value], (gltf) => {
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

                    actionHistory = []; // تفريغ الذاكرة عند تبديل السيارة

                    carModel.traverse((child) => {
                        if (child.isMesh) {
                            child.material.color.setHex(INITIAL_CAR_COLOR);
                            child.material.roughness = 0.2;
                            child.material.metalness = 0.5;
                        }
                    });

                    scene.add(carModel);
                    document.getElementById('placeholderText').style.display = "none";
                });
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
    
    // 1. فحص المود المحفوظ سابقاً في متصفح المستخدم
    const currentTheme = localStorage.getItem("theme");
    if (currentTheme === "light") {
        document.body.classList.add("light-mode");
    }

    // 2. الاستماع لضغطات الزر وعمل التبديل
    if (themeToggle) {
        themeToggle.addEventListener("click", () => {
            document.body.classList.toggle("light-mode");
            
            // 3. حفظ الخيار الحالي في الذاكرة المحلية
            if (document.body.classList.contains("light-mode")) {
                localStorage.setItem("theme", "light");
            } else {
                localStorage.setItem("theme", "dark");
            }
        });
    }
});