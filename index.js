import 'dotenv/config';
import wolfjs from 'wolf.js';
import sharp from 'sharp';
import { createWorker } from 'tesseract.js';
import fetch from 'node-fetch';

const { WOLF } = wolfjs;
const client = new WOLF();

// --- الإعدادات ---
const TARGET_USER_ID = 76023604;
const CHANNEL_TASKS = 224;
const CHANNEL_ALLIANCE = 224;
const TARGET_PLAYER_NAME = 'cat'; 

let lastCommandTime = 0;
let lastStatusRequestTime = 0;

client.on('ready', async () => {
    console.log(`🚀 البوت متصل!`);
    await client.group.joinById(CHANNEL_TASKS);
    await client.group.joinById(CHANNEL_ALLIANCE);
    startAutomation();
});

// --- الأتمتة ---
async function startAutomation() {
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    while (true) {
        try {
            await client.messaging.sendGroupMessage(CHANNEL_TASKS, '!مد مهام');
            await sleep(2000);
            await client.messaging.sendGroupMessage(CHANNEL_ALLIANCE, '!مد تحالف ايداع كل');
            
            // طلب الحالة كل 30 دقيقة
            if (Date.now() - lastStatusRequestTime > 30 * 60 * 1000) {
                console.log("🕒 طلب الحالة...");
                await client.messaging.sendGroupMessage(CHANNEL_TASKS, '!مد حالة');
                lastStatusRequestTime = Date.now();
                await sleep(5000);
            }
            await sleep(60000); 
        } catch (err) { console.error("❌ خطأ أتمتة:", err.message); await sleep(5000); }
    }
}

// --- معالجة الصور الذكية ---
async function readImage(buffer, region = null) {
    let pipeline = sharp(buffer).greyscale().normalize();
    
    if (region) {
        pipeline = pipeline.extract(region);
    }
    
    // تحسين التباين ليقرأ البوت النص الأسود على خلفية فاتحة
    const processedBuffer = await pipeline.threshold(140).toBuffer();

    const worker = await createWorker('ara+eng');
    const { data: { text } } = await worker.recognize(processedBuffer);
    await worker.terminate();
    return text;
}

// --- معالجة الرسائل ---
client.on('groupMessage', async (message) => {
    if (message.sourceSubscriberId != TARGET_USER_ID || message.type !== 'image_link') return;

    try {
        const response = await fetch(message.body);
        const buffer = Buffer.from(await response.arrayBuffer());

        // 1. فحص الكابتشا (منطقك القديم)
        if (await isCaptchaByColor(buffer)) {
            const code = await solveCaptcha(buffer);
            if (code) await client.messaging.sendGroupMessage(message.targetGroupId, `#${code}`);
            return;
        }

        // 2. التحقق من الاسم في الجزء العلوي (40% من الصورة)
        const metadata = await sharp(buffer).metadata();
        const nameText = await readImage(buffer, { 
            left: 0, top: 0, width: Math.round(metadata.width * 0.7), height: Math.round(metadata.height * 0.4) 
        });
        
        console.log(`[DEBUG NAME]: ${nameText.trim()}`); // شاهد ماذا يرى البوت هنا

        if (!nameText.toLowerCase().includes(TARGET_PLAYER_NAME.toLowerCase())) {
            return; // لم يجد الاسم، توقف هنا
        }

        console.log("✅ تم التعرف على الاسم! جاري تحليل الحالة...");

        // 3. تحليل بيانات الحالة من الصورة كاملة
        const fullText = await readImage(buffer);
        console.log(`[DEBUG STATUS]: ${fullText.replace(/\n/g, ' ')}`);

        const timeMachine = fullText.match(/(?:الجهاز الزمني|الجهاز)[:\s]+([^\n\r]+)/u);
        const chests = fullText.match(/(?:الصناديق|صناديق)[:\s]+(\d+)/u);
        const warranty = fullText.match(/(?:نقاط الضمان|الضمان)[:\s]+(\d+)\/(\d+)/u);

        console.log("📊 --- النتائج ---");
        console.log(`⏱️ الجهاز الزمني: ${timeMachine ? timeMachine[1].trim() : 'غير موجود'}`);
        console.log(`📦 عدد الصناديق: ${chests ? chests[1] : '0'}`);
        
        if (warranty) {
            const current = parseInt(warranty[1]);
            const total = parseInt(warranty[2]);
            console.log(`🛡️ نقاط الضمان: ${current}/${total} (${current >= total ? 'جاهز ✅' : 'غير جاهز ❌'})`);
        } else {
            console.log("🛡️ نقاط الضمان: لم يتم التعرف عليها");
        }

    } catch (err) { console.error("⚠️ خطأ:", err.message); }
});

// --- وظائف الكابتشا ---
async function isCaptchaByColor(buffer) {
    const { data, info } = await sharp(buffer).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
    let redPixels = 0;
    for (let i = 0; i < data.length; i += 4) {
        if (data[i] > 120 && data[i] > (data[i + 1] + 30) && data[i] > (data[i + 2] + 30)) redPixels++;
    }
    return (redPixels / (info.width * info.height)) * 100 > 40;
}

async function solveCaptcha(buffer) {
    // ضع منطق الحل الخاص بك هنا
    return "0000"; 
}

client.login(process.env.U_MAIL, process.env.U_PASS);
