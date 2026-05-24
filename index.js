import wolfjs from 'wolf.js';
import axios from 'axios';
import Tesseract from 'tesseract.js';

const { WOLF } = wolfjs;
const service = new WOLF();

async function solveCaptchaLocally(imageUrl) {
    try {
        console.log("🔍 جاري معالجة الصورة عبر Tesseract...");
        
        // محاولة القراءة مباشرة من الرابط
        const { data: { text } } = await Tesseract.recognize(imageUrl, 'eng', {
            tessedit_char_whitelist: '0123456789', // التركيز على الأرقام فقط
        });

        const cleanText = text.replace(/[^0-9]/g, '');
        return cleanText.trim();
    } catch (err) {
        console.error("❌ خطأ في القراءة:", err.message);
        return null;
    }
}

service.on('groupMessage', async (message) => {
    // الفلتر للمجموعة
    if (message.targetGroupId !== 81889058) return;

    let imageUrl = null;
    if (message.body && message.body.startsWith('http')) imageUrl = message.body;
    else if (message.attachments && message.attachments.length > 0) imageUrl = message.attachments[0].link;

    if (imageUrl) {
        console.log(`✅ صورة مكتشفة، جاري المحاولة...`);
        const solution = await solveCaptchaLocally(imageUrl);
        
        if (solution && solution.length >= 4) {
            console.log(`🔑 الحل المستخرج: ${solution}`);
            await service.messaging.sendGroupMessage(message.targetGroupId, `#${solution}`);
        } else {
            console.log("⚠️ فشل في قراءة الأرقام. الصورة قد تكون غير واضحة.");
        }
    }
});

service.on('ready', () => console.log("🚀 البوت متصل الآن بنظام OCR المباشر!"));

service.login(process.env.U_MAIL, process.env.U_PASS);
