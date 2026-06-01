import 'dotenv/config';
import wolfjs from 'wolf.js';
import sharp from 'sharp';
import { createWorker } from 'tesseract.js';

const { WOLF } = wolfjs;
const client = new WOLF();

// --- دالة Sleep عالمية لمنع التداخل ---
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// --- الإعدادات ---
const TARGET_USER_ID = 76023604;
const CHANNEL_TASKS = 224;
const CHANNEL_ALLIANCE = 224;
const TARGET_PLAYER_NAME = 'cat';

// الحالة العالمية
let botState = { 
    hasTimeDevice: false, 
    gold: 0, 
    silver: 0, 
    bronze: 0, 
    points: 0, 
    isReady: false 
};

let lastCommandTime = 0;

client.on('ready', async () => {
    console.log(`🚀 البوت يعمل الآن بكامل المزايا.`);
    await client.group.joinById(CHANNEL_TASKS);
    await client.group.joinById(CHANNEL_ALLIANCE);
    
    startStatusLoop(); 
    startTaskLoop();   
});

// 1. حلقة الحالة (كل 30 دقيقة)
async function startStatusLoop() {
    await client.messaging.sendGroupMessage(CHANNEL_TASKS, '!مد حالة');
    setTimeout(startStatusLoop, 30 * 60 * 1000);
}

// 2. حلقة المهام (مع تأخير ثانية بين الأوامر)
async function startTaskLoop() {
    try {
        lastCommandTime = Date.now();
        
        await client.messaging.sendGroupMessage(CHANNEL_TASKS, '!مد مهام');
        await sleep(1000); // تأخير ثانية لمنع التداخل
        await client.messaging.sendGroupMessage(CHANNEL_ALLIANCE, '!مد تحالف ايداع كل');
        
        await manageBoxes();

        const interval = botState.hasTimeDevice ? 63000 : 306000;
        setTimeout(startTaskLoop, interval);
    } catch (err) {
        console.error("خطأ في المهام:", err.message);
        setTimeout(startTaskLoop, 10000);
    }
}

// 3. إدارة الصناديق (نظام Safe Side - التوقف عند 40 نقطة)
async function manageBoxes() {
    // تفعيل الضمان
    if (botState.isReady && !botState.hasTimeDevice) {
        await client.messaging.sendGroupMessage(CHANNEL_TASKS, '!مد صندوق ضمان وقت');
        await sleep(3000);
        return;
    }

    // وضع الأمان: إذا كان هناك زمني أو جاهز أو وصلنا لـ 40 نقطة، توقف
    if (botState.hasTimeDevice || botState.isReady || botState.points >= 40) {
        return; 
    }

    // فتح الصناديق (الأولوية للذهبي)
    if (botState.gold > 0) {
        await client.messaging.sendGroupMessage(CHANNEL_TASKS, '!مد صندوق فتح ذهبي');
        await sleep(3000);
    } else if (botState.silver > 0) {
        await client.messaging.sendGroupMessage(CHANNEL_TASKS, '!مد صندوق فتح فضي');
        await sleep(3000);
    } else if (botState.bronze > 0) {
        await client.messaging.sendGroupMessage(CHANNEL_TASKS, '!مد صندوق فتح برونزي');
        await sleep(3000);
    }
}

// 4. معالجة الرسائل والكابتشا (فحص الفخوخ والتحقق)
client.on('groupMessage', async (message) => {
    if (message.sourceSubscriberId != TARGET_USER_ID || message.type !== 'text/image_link') return;

    try {
        const response = await fetch(message.body);
        const buffer = Buffer.from(await response.arrayBuffer());

        // أ) التحقق من الكابتشا (الفخوخ)
        if (await isCaptchaByColor(buffer)) {
            if (Date.now() - lastCommandTime <= 4000) {
                const name = await extractPlayerName(buffer);
                const regex = new RegExp(`\\b${TARGET_PLAYER_NAME}\\b`, 'i');
                
                if (regex.test(name)) {
                    const code = await solveCaptcha(buffer);
                    if (code) await client.messaging.sendGroupMessage(message.targetGroupId, `#${code}`);
                }
            }
        } 
        // ب) تحديث الحالة
        else {
            botState = await parseStatusImage(buffer);
            console.log("📊 تحديث الحالة:", botState);
        }
    } catch (err) {
        console.error("خطأ في المعالجة:", err.message);
    }
});

// --- الدوال المساعدة ---

async function isCaptchaByColor(buffer) {
    const { data, info } = await sharp(buffer).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
    let redPixels = 0;
    for (let i = 0; i < data.length; i += 4) {
        if (data[i] > 120 && data[i] > (data[i+1]+30) && data[i] > (data[i+2]+30)) redPixels++;
    }
    return (redPixels / (info.width * info.height)) * 100 > 40;
}

async function extractPlayerName(buffer) {
    const worker = await createWorker('ara+eng');
    const processed = await sharp(buffer).greyscale().threshold(160).toBuffer();
    const { data: { text } } = await worker.recognize(processed);
    await worker.terminate();
    const match = text.match(/اللاعب[:\s]+([^\n\r]+)/u);
    return match ? match[1].trim() : "";
}

async function solveCaptcha(buffer) {
    const worker = await createWorker('eng');
    const processed = await sharp(buffer).greyscale().threshold(180).toBuffer();
    const { data: { text } } = await worker.recognize(processed);
    await worker.terminate();
    
    const digits = text.replace(/\D/g, ''); 
    return digits.length > 0 ? digits : null;
}

async function parseStatusImage(buffer) {
    const worker = await createWorker('ara+eng');
    const { data: { text } } = await worker.recognize(buffer);
    await worker.terminate();
    
    return {
        hasTimeDevice: text.includes("الجهاز الزمني"),
        points: parseInt((text.match(/نقاط الضمان[:\s]+(\d+)\/50/) || [0, 0])[1]),
        isReady: text.includes("جاهز"),
        gold: parseInt((text.match(/ذهبي[:\s]+(\d+)/) || [0, 0])[1]),
        silver: parseInt((text.match(/فضي[:\s]+(\d+)/) || [0, 0])[1]),
        bronze: parseInt((text.match(/برونزي[:\s]+(\d+)/) || [0, 0])[1])
    };
}

client.login(process.env.U_MAIL, process.env.U_PASS);
