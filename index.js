import 'dotenv/config';
import wolfjs from 'wolf.js';
const { WOLF } = wolfjs;

const settings = {
    identity: process.env.U_MAIL || 'your_email@example.com',
    secret: process.env.U_PASS || 'your_password',
    taskGroupId: 81889058,
    depositGroupId: 81889058
};

const MY_INFO = {
    myId: "80055399" // العضوية المستهدفة
};

const service = new WOLF();

// دالة لتنظيف النص من الرموز غير المرئية التي تسبب أخطاء
const cleanText = (text) => {
    return text.replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '');
};

// دالة لتجهيز الرموز للبحث (Escape)
const escapeRegExp = (string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

service.on('groupMessage', async (message) => {
    try {
        const rawContent = message.body;
        const content = cleanText(rawContent);

        const isTargetGroup = message.targetGroupId === settings.taskGroupId || message.targetGroupId === settings.depositGroupId;
        if (!isTargetGroup) return;

        // التحقق من أن الرسالة فخ + مطابقة العضوية
        if (content.includes("اختبار تحقق سريع") && content.includes(MY_INFO.myId)) {
            
            /* شرح النمط الجديد (Regex):
               [^\s\w\u0600-\u06FF] يعني: "أي شيء ليس مسافة، وليس حرفاً، وليس حرفاً عربياً"
               هذا يضمن تجاهل حرف "و" والتركيز على الرموز الهندسية فقط.
            */
            const symbolMatch = content.match(/العلامتين\s*([^\s\w\u0600-\u06FF])\s*و?\s*([^\s\w\u0600-\u06FF])/u);

            if (symbolMatch) {
                const sym1 = symbolMatch[1];
                const sym2 = symbolMatch[2];
                console.log(`✅ تم استخراج الرموز بنجاح: [${sym1}] و [${sym2}]`);

                // التركيز فقط على السطر بعد النقطتين ":"
                const parts = content.split(':');
                const targetLine = parts.length > 1 ? parts.slice(1).join(':') : content;

                // البحث عن الإجابة المحصورة بين العلامتين
                const pattern = new RegExp(`${escapeRegExp(sym1)}(.*?)${escapeRegExp(sym2)}`, 'u');
                const result = targetLine.match(pattern);

                if (result && result[1]) {
                    const answer = result[1].trim();
                    console.log(`🚀 الإجابة النهائية: ${answer}`);
                    
                    setTimeout(async () => {
                        await service.messaging.sendGroupMessage(message.targetGroupId, `#${answer}`);
                    }, 3000);
                } else {
                    console.log("❌ تعذر العثور على نص بين الرموز في الجزء المخصص.");
                }
            } else {
                console.log("❌ لم يتم استخراج العلامات (الرموز). تأكد من صيغة الرسالة.");
            }
        }
    } catch (err) {
        console.error("خطأ في معالجة الفخ:", err);
    }
});

// --- قسم المهام الدورية ---
service.on('ready', async () => {
    console.log(`🚀 البوت يعمل الآن - نظام الذكاء الاصطناعي للفخاخ نشط.`);
    
    try {
        await service.group.joinById(settings.taskGroupId);
        await service.group.joinById(settings.depositGroupId);

        // المهام (كل دقيقة)
        setInterval(async () => {
            await service.messaging.sendGroupMessage(settings.taskGroupId, "!مد مهام");
            setTimeout(async () => {
                await service.messaging.sendGroupMessage(settings.depositGroupId, "!مد تحالف ايداع كل");
            }, 2000);
        }, 60000); 

        // الصناديق (كل 3 دقائق)
        setInterval(async () => {
            await service.messaging.sendGroupMessage(settings.taskGroupId, "!مد صندوق فتح");
        }, 180000); 

    } catch (e) {
        console.error("خطأ في بدء المهام:", e);
    }
});

service.login(settings.identity, settings.secret);
