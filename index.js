import 'dotenv/config';
import wolfjs from 'wolf.js';
import sharp from 'sharp';
import { createWorker } from 'tesseract.js';
import fetch from 'node-fetch'; // تأكد من تثبيت node-fetch

const { WOLF } = wolfjs;
const client = new WOLF();

// --- الإعدادات ---
const TARGET_USER_ID = 76023604;
const CHANNEL_ID = 224;
const TARGET_PLAYER_NAME = 'cat';
let taskInterval = 306000; // الافتراضي 5 دقائق و 6 ثوانٍ

// متغيرات الحالة
const waitingStates = { [CHANNEL_ID]: { isWaiting: false, timer: null } };

// تهيئة الـ Worker
let worker = null;
async function initWorker() {
    worker = await createWorker('eng+ara');
    await worker.setParameters({ tessedit_pageseg_mode: '7' });
    console.log("🤖 تم تهيئة محرك التعرف على النصوص (Tesseract)");
}

client.on('ready', async () => {
    console.log(`🚀 البوت متصل! القناة: ${CHANNEL_ID}`);
    await initWorker();
    await client.group.joinById(CHANNEL_ID);
    
    // بدء المهام
    startCrateLoop();
    startAutomationLoop();
});

// 1. حلقة طلب الصناديق (كل 30 دقيقة)
function startCrateLoop() {
    setInterval(async () => {
        await client.messaging.sendGroupMessage(CHANNEL_ID, '!مد صندوق');
        console.log("📦 تم إرسال طلب !مد صندوق");
    }, 30 * 60 * 1000);
}

// 2. حلقة المهام الديناميكية
async function startAutomationLoop() {
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    while (true) {
        try {
            // تفعيل حالة الانتظار قبل إرسال الأوامر
            setWaitingState(CHANNEL_ID, true);
            
            await client.messaging.sendGroupMessage(CHANNEL_ID, '!مد مهام');
            await sleep(2000);
            await client.messaging.sendGroupMessage(CHANNEL_ID, '!مد تحالف ايداع كل');
            
            console.log(`⏳ تم إرسال الأوامر. وضع السرعة الحالي: ${taskInterval === 60000 ? 'سريع (دقيقة)' : 'عادي (306 ثانية)'}`);
            
            await sleep(taskInterval);
        } catch (err) {
            console.error("❌ خطأ في الأتمتة:", err.message);
            await sleep(5000);
        }
    }
}

// 3. إدارة حالة الانتظار
function setWaitingState(channelId, isActive) {
    if (waitingStates[channelId].timer) clearTimeout(waitingStates[channelId].timer);
    waitingStates[channelId].isWaiting = isActive;
    // انتظار الكابتشا لمدة 15 ثانية فقط
    if (isActive) {
        waitingStates[channelId].timer = setTimeout(() => { 
            waitingStates[channelId].isWaiting = false; 
            console.log("⏲️ انتهى وقت انتظار الكابتشا.");
        }, 15000);
    }
}

// 4. الاستماع للرسائل
client.on('groupMessage', async (message) => {
    if (message.targetGroupId !== CHANNEL_ID || !message.body) return;

    // تحديث سرعة المهام بناءً على الصناديق
    if (message.body.includes('حالة الصناديق')) {
        const isInactive = message.body.includes('الجهاز الزمني: غير نشط') || message.body.includes('الجهاز الزمني: —');
        taskInterval = isInactive ? 306000 : 60000;
        console.log(`⚡ تحديث السرعة بناءً على الصناديق: ${taskInterval === 60000 ? 'سريع' : 'عادي'}`);
    }

    // معالجة الكابتشا
    // تحقق من نوع الرسالة (تأكد من صيغة البوت التي تصل بها الصورة، غالباً image_link)
    if (message.sourceSubscriberId == TARGET_USER_ID && (message.type === 'image' || message.type === 'text/image_link')) {
        
        if (!waitingStates[CHANNEL_ID].isWaiting) {
            console.log("⏭️ تم تجاهل صورة: البوت ليس في حالة انتظار.");
            return;
        }

        console.log("📸 استلمت صورة كابتشا، جاري المعالجة...");
        
        try {
            const response = await fetch(message.body);
            const buffer = Buffer.from(await response.arrayBuffer());

            // قراءة الاسم
            const name = await extractPlayerName(buffer);
            console.log(`👤 الاسم المكتشف: ${name}`);

            if (name.toLowerCase().includes(TARGET_PLAYER_NAME.toLowerCase())) {
                console.log("✅ الاسم يطابق، جاري استخراج الكود...");
                const code = await solveCaptcha(buffer);
                
                if (code) {
                    console.log(`🤖 تم استخراج الكود: #${code}`);
                    await client.messaging.sendGroupMessage(CHANNEL_ID, `#${code}`);
                    setWaitingState(CHANNEL_ID, false); // إيقاف الانتظار بعد الحل
                } else {
                    console.log("❌ تعذر قراءة الكود.");
                }
            } else {
                console.log("⏭️ الاسم لا يطابق المستهدف.");
            }
        } catch (err) {
            console.error("⚠️ خطأ أثناء حل الكابتشا:", err.message);
        }
    }
});

// --- دوال التعرف على النصوص ---
async function extractPlayerName(buffer) {
    try {
        const { data: { text } } = await worker.recognize(buffer);
        const match = text.match(/اللاعب[:\s]+([^\n\r]+)/u);
        return match ? match[1].trim() : "غير معروف";
    } catch (e) { return "خطأ"; }
}

async function solveCaptcha(buffer) {
    try {
        // تحسين جودة الصورة للحل
        const processed = await sharp(buffer)
            .resize(800)
            .greyscale()
            .threshold(150)
            .toBuffer();
            
        const { data: { text } } = await worker.recognize(processed);
        // استخراج أرقام وحروف فقط
        const cleanCode = text.replace(/[^a-zA-Z0-9]/g, '').trim();
        return cleanCode;
    } catch (e) { return null; }
}

client.login(process.env.U_MAIL, process.env.U_PASS);
