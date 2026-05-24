import 'dotenv/config';
import wolfjs from 'wolf.js';
import axios from 'axios';

const { WOLF } = wolfjs;
const service = new WOLF();

// الإعدادات
const settings = {
    // ضع هنا أرقام القنوات التي تريد أن يعمل فيها البوت فقط
    allowedGroupIds: [ 81889058], 
    verificationGroupId: 9969,
    apiKey: process.env.API_KEY || 'K83171079488957'
};

// دالة الحل عبر API
async function solveCaptcha(imageUrl) {
    try {
        console.log("جاري إرسال الصورة للـ API...");
        const response = await axios.post('https://api.ocr.space/parse/image', null, {
            params: { apikey: settings.apiKey, url: imageUrl, language: 'eng', OCREngine: 2 }
        });
        if (response.data.ParsedResults?.length > 0) {
            return response.data.ParsedResults[0].ParsedText.trim();
        }
        return null;
    } catch (err) { return null; }
}

service.on('groupMessage', async (message) => {
    // 1. التصفية: إذا لم تكن القناة ضمن القائمة المسموحة، توقف فوراً
    if (!settings.allowedGroupIds.includes(message.targetGroupId)) {
        return;
    }

    // 2. استخراج رابط الصورة بناءً على السجلات التي أرسلتها
    let imageUrl = null;

    // السجلات تظهر أن الرابط يأتي في body عندما يكون النوع text/image_link
    if (message.type === 'text/image_link') {
        imageUrl = message.body;
    } 
    // احتياطاً: إذا جاءت الصورة كمرفق عادي
    else if (message.attachments && message.attachments.length > 0) {
        imageUrl = message.attachments[0].link;
    }

    // 3. المعالجة إذا وجدنا رابطاً
    if (imageUrl) {
        console.log(`✅ تم اكتشاف صورة في القناة ${message.targetGroupId}، جاري الحل...`);
        const solution = await solveCaptcha(imageUrl);
        
        if (solution) {
            console.log("🔑 الحل المستخرج:", solution);
            await service.messaging.sendGroupMessage(settings.verificationGroupId, `#${solution}`);
        }
    }
});

service.on('ready', async () => {
    console.log("🚀 البوت يعمل الآن ويراقب القنوات المحددة فقط!");
});

service.login(process.env.U_MAIL, process.env.U_PASS);
