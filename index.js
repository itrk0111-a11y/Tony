import 'dotenv/config';
import wolfjs from 'wolf.js';
import sharp from 'sharp';
import { createWorker } from 'tesseract.js';

const { WOLF } = wolfjs;
const client = new WOLF();

const TARGET_USER_ID = 51660277;
const CHANNEL_ID = 81889058;

client.on('ready', async () => {
    console.log("✅ البوت متصل ومستعد!");
    await client.group.joinById(CHANNEL_ID);
});

client.on('groupMessage', async (message) => {
    if (message.sourceSubscriberId == TARGET_USER_ID && message.targetGroupId == CHANNEL_ID) {
        const imageUrl = message.body || (message.attachments && message.attachments[0]?.link);

        if (imageUrl && (imageUrl.endsWith('.jpg') || imageUrl.endsWith('.jpeg') || imageUrl.endsWith('.png'))) {
            console.log("📸 اكتشفت صورة! جاري المعالجة بـ Sharp...");
            try {
                const code = await solveCaptcha(imageUrl);
                console.log("🎯 الرمز المستخرج هو:", code);
                // await client.messaging.sendGroupMessage(CHANNEL_ID, `#${code}`);
            } catch (err) {
                console.error("❌ خطأ أثناء المعالجة:", err.message);
            }
        }
    }
});

async function solveCaptcha(url) {
    // 1. تحميل الصورة
    const response = await fetch(url);
    const buffer = Buffer.from(await response.arrayBuffer());

    // 2. معالجة الصورة لاستخراج البيانات (Pixels)
    const image = sharp(buffer);
    const { data, info } = await image.raw().ensureAlpha().toBuffer({ resolveWithObject: true });

    let minX = info.width, minY = info.height, maxX = 0, maxY = 0;
    let found = false;

    // 3. مسح البكسلات للبحث عن اللون الأصفر (الإطار)
    for (let y = 0; y < info.height; y++) {
        for (let x = 0; x < info.width; x++) {
            const idx = (y * info.width + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];

            // شرط اللون الأصفر (الإطار المنقط)
            if (r > 200 && g > 200 && b < 100) {
                minX = Math.min(minX, x);
                minY = Math.min(minY, y);
                maxX = Math.max(maxX, x);
                maxY = Math.max(maxY, y);
                found = true;
            }
        }
    }

    if (!found) throw new Error("لم يتم العثور على الإطار الأصفر!");

    // 4. قص الصورة بناءً على الإحداثيات المكتشفة
    const cropWidth = maxX - minX;
    const cropHeight = maxY - minY;

    const croppedBuffer = await sharp(buffer)
        .extract({ left: minX + 5, top: minY + 5, width: cropWidth - 10, height: cropHeight - 10 })
        .greyscale()
        .threshold(150)
        .toBuffer();

    // 5. قراءة النص
    const worker = await createWorker('eng+ara');
    const { data: { text } } = await worker.recognize(croppedBuffer);
    await worker.terminate();

    return text.replace(/[^a-zA-Z0-9\u0621-\u064A]/g, '').trim();
}

client.login(process.env.U_MAIL, process.env.U_PASS);
