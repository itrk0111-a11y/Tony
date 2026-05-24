import wolfjs from 'wolf.js';
import axios from 'axios';
import Tesseract from 'tesseract.js';
import Jimp from 'jimp';
import sharp from 'sharp'; // تأكد من تثبيت هذه المكتبة

const { WOLF } = wolfjs;
const service = new WOLF();

const CONFIG = {
    MONITOR_GROUP: 81889058,
    TARGET_MEMBER: 51660277,
    RESULT_ROOM: 9969
};

async function extractBoldText(imageUrl) {
    try {
        // 1. تحميل الصورة
        const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        
        // 2. معالجة الصورة باستخدام Sharp لعزل الخط الغامق (Bold)
        // الفكرة: نرفع التباين بقوة حتى تختفي الكلمات الخفيفة وتبقى الثقيلة
        const processedBuffer = await sharp(response.data)
            .grayscale()           // تحويل لرمادي
            .normalize()           // تعزيز التباين
            .threshold(180)        // <-- هنا السر: قيمة عالية تجعل الكلمات النحيفة تختفي
            .toBuffer();

        // 3. قراءة النص من الصورة "المفلترة"
        const { data: { text } } = await Tesseract.recognize(processedBuffer, 'eng+ara', {
            tessedit_pageseg_mode: '6' // تحليل كتلة واحدة من النص
        });

        return text.trim();
    } catch (err) {
        console.error("❌ خطأ في المعالجة:", err.message);
        return null;
    }
}

service.on('groupMessage', async (message) => {
    if (message.targetGroupId !== CONFIG.MONITOR_GROUP || message.senderId !== CONFIG.TARGET_MEMBER) return;

    let imageUrl = null;
    if (message.attachments && message.attachments.length > 0) {
        imageUrl = message.attachments[0].link;
    }

    if (imageUrl) {
        console.log("📸 جاري استخراج النص الغامق...");
        const result = await extractBoldText(imageUrl);
        
        if (result && result.length > 0) {
            console.log(`🔑 النص المستخرج: ${result}`);
            await service.messaging.sendGroupMessage(CONFIG.RESULT_ROOM, `# ${result}`);
        }
    }
});

service.login(process.env.U_MAIL, process.env.U_PASS);
