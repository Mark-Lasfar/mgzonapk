#!/bin/bash

# تحديد مسار ملف التكوين
RCLONE_CONFIG="/root/.config/rclone/rclone.conf"

echo "🚀 جاري محاولة تحديث رموز rclone باستخدام ملف التكوين: $RCLONE_CONFIG"

# قائمة بأسماء الريموتات التي تريد تحديثها
REMOTES=("gdrive_main" "gdrive_account2" "gdrive_account3" "gdrive_account4" "gdrive_account5")

# التحقق من وجود ملف التكوين
if [ ! -f "$RCLONE_CONFIG" ]; then
    echo "❌ خطأ: ملف التكوين غير موجود في $RCLONE_CONFIG."
    echo "يرجى التأكد من تشغيل الخلية التي تنشئ ملف rclone.conf أولاً."
    exit 1
fi

# المرور على كل ريموت ومحاولة إعادة الاتصال/التحديث
for remote in "${REMOTES[@]}"; do
    echo "\n--- جاري معالجة الريموت: $remote ---"
    # استخدام rclone config reconnect لمحاولة تحديث الرمز
    # استخدام --verbose لعرض المزيد من التفاصيل
    # قد يتطلب هذا الأمر تفاعلاً إذا كان الـ refresh_token غير صالح
    rclone --config "$RCLONE_CONFIG" config reconnect "$remote": --verbose

    # التحقق من حالة الخروج للأمر السابق
    if [ $? -eq 0 ]; then
        echo "✅ تم محاولة تحديث الريموت $remote بنجاح."
    else
        echo "⚠️ فشلت محاولة تحديث الريموت $remote."
        echo "قد تحتاج إلى إعادة المصادقة يدوياً لهذا الريموت."
    fi
done

echo "\n✅ اكتملت محاولة تحديث الرموز لجميع الريموتات المحددة."
echo "يرجى فحص المخرجات لأي رسائل خطأ أو طلبات تفاعلية."
