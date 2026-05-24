import wolfjs from 'wolf.js';
import axios from 'axios';
import Tesseract from 'tesseract.js';
import sharp from 'sharp'; // إضافة مكتبة المعالجة

const { WOLF } = wolfjs;
const service = new WOLF();

async function solveCaptchaLocally(imageUrl) {
    try {
        // 1. تحميل الصورة ومعالجتها بـ Sharp (تحويلها لرمادي + زيادة التباين)
        const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        const processedImage = await sharp(response.data)
            .grayscale() // تحويل لرمادي
            .threshold(128) // تحويل لأبيض وأسود صافي (Thresholding)
            .toBuffer();

        // 2. القراءة باستخدام Tesseract مع إعدادات صارمة
        const { data: { text } } = await Tesseract.recognize(processedImage, 'eng', {
            // إعدادات إضافية لزيادة الدقة
            tessedit_char_whitelist: '0123456789', // لا تبحث إلا عن هذه الأرقام
            tessedit_pageseg_mode: '7', // معاملة الصورة كسطر واحد من النص
        });

        const cleanText = text.replace(/[^0-9]/g, '');
        return cleanText.trim();
    } catch (err) {
        console.error("❌ خطأ في المعالجة:", err.message);
        return null;
    }
}

service.on('groupMessage', async (message) => {
    if (message.targetGroupId !== 81889058) return;

    let imageUrl = null;
    if (message.body && message.body.startsWith('http')) imageUrl = message.body;
    else if (message.attachments && message.attachments.length > 0) imageUrl = message.attachments[0].link;

    if (imageUrl) {
        console.log(`✅ تم التقاط الصورة، جاري المعالجة...`);
        const solution = await solveCaptchaLocally(imageUrl);
        
        // التحقق من الحل (يجب أن يكون 4 أرقام على الأقل)
        if (solution && solution.length >= 4) {
            console.log(`🔑 الحل المستخرج: ${solution}`);
            await service.messaging.sendGroupMessage(message.targetGroupId, `#${solution}`);
        } else {
            console.log("⚠️ الصورة صعبة جداً ولم يتمكن المحرك من قراءة الأرقام.");
        }
    }
});

service.login(process.env.U_MAIL, process.env.U_PASS);
