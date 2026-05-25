import 'dotenv/config';
import wolfjs from 'wolf.js';
import sharp from 'sharp';
import { createWorker } from 'tesseract.js';

const { WOLF } = wolfjs;
const client = new WOLF();

// --- إعدادات التحكم ---
const CHANNEL_ID = 81889058 ;             // القناة المراقبة حصراً
const AUTHORIZED_USER_ID = 51660277; // العضو المصرح له فقط
const RESPONSE_WINDOW_MS = 5000;    // 5 ثواني
const SEND_INTERVAL_SECONDS = 63;   // التمديد كل دقيقة
// ------------------------

let lastCommandTime = 0;

client.on('ready', async () => {
    console.log("🚀 البوت متصل! مراقبة القناة 224 والعضو 51660277 فقط.");
    await client.group.joinById(CHANNEL_ID);
    startAutomation();
});

// الأتمتة (الأوامر التلقائية)
async function startAutomation() {
    setInterval(async () => {
        try {
            await client.messaging.sendGroupMessage(CHANNEL_ID, '!مد مهام');
            await new Promise(resolve => setTimeout(resolve, 2000));
            await client.messaging.sendGroupMessage(CHANNEL_ID, '!مد تحالف ايداع كل');
            lastCommandTime = Date.now();
        } catch (err) {
            console.error("❌ خطأ في التمديد:", err.message);
        }
    }, SEND_INTERVAL_SECONDS * 1000);
}

// مراقبة الرسائل
client.on('groupMessage', async (message) => {
    // 1. فلترة القناة
    if (message.targetGroupId !== CHANNEL_ID) return;

    // 2. فلترة المرسل (يجب أن يكون العضو المحدد)
    if (message.sourceSubscriberId !== AUTHORIZED_USER_ID) return;

    // 3. التحقق من وجود صورة
    const imageUrl = message.body || (message.attachments && message.attachments[0]?.link);
    if (!imageUrl || !(imageUrl.endsWith('.jpg') || imageUrl.endsWith('.jpeg') || imageUrl.endsWith('.png'))) return;

    // 4. نافذة الـ 5 ثواني
    if (Date.now() - lastCommandTime > RESPONSE_WINDOW_MS) return;

    console.log("📸 تم استلام صورة من العضو المصرح له. جاري الفحص...");

    try {
        const code = await solveCaptcha(imageUrl);
        if (code) {
            await client.messaging.sendGroupMessage(CHANNEL_ID, `#${code}`);
            console.log(`✅ تم استخراج وإرسال الرمز: #${code}`);
        } else {
            console.log("⚠️ الصورة لا تحتوي على كابتشا، تم تجاهلها.");
        }
    } catch (err) {
        console.log("⚠️ فشلت عملية التحليل (ربما ليست صورة كابتشا):", err.message);
    }
});

// دالة الحل الذكية
async function solveCaptcha(url) {
    const response = await fetch(url);
    const buffer = Buffer.from(await response.arrayBuffer());
    const { data, info } = await sharp(buffer).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
    
    // فحص وجود الإطار الأصفر (البصمة البرمجية للكابتشا)
    let minX = info.width, minY = info.height, maxX = 0, maxY = 0, found = false;
    for (let y = 0; y < info.height; y++) {
        for (let x = 0; x < info.width; x++) {
            const idx = (y * info.width + x) * 4;
            // اللون الأصفر (أحمر + أخضر مرتفع، أزرق منخفض)
            if (data[idx] > 200 && data[idx + 1] > 200 && data[idx + 2] < 100) {
                minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
                found = true;
            }
        }
    }

    // إذا لم يجد الإطار الأصفر (مثل صور "المهمة مكتملة")، يخرج فوراً
    if (!found) return null;

    const processedBuffer = await sharp(buffer)
        .extract({ left: minX + 8, top: minY + 8, width: (maxX - minX) - 16, height: (maxY - minY) - 16 })
        .greyscale()
        .threshold(150) // جعل النص أسود تماماً والخلفية بيضاء
        .toBuffer();

    const worker = await createWorker('eng+ara');
    try {
        await worker.setParameters({ tessedit_pageseg_mode: '7' });
        const { data: { text } } = await worker.recognize(processedBuffer);
        
        // تنظيف النص
        const result = text.replace(/[^a-zA-Z0-9\u0621-\u064A]/g, '').trim();
        
        // تجاهل النصوص الطويلة (الضوضاء)
        if (result.length === 0 || result.length > 10) return null;
        
        return result;
    } finally {
        await worker.terminate(); // إغلاق المحرك فوراً لمنع تعليق البوت
    }
}

client.login(process.env.U_MAIL, process.env.U_PASS);
