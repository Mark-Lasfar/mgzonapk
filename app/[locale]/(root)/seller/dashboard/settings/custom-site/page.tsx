import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSellerByUserId } from "@/lib/actions/seller.actions";
import { NotificationUtils } from "@/lib/utils/notification";
import { ArrowRight, Bell, CreditCard, Lock, Palette, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function SellerSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const t = await getTranslations("SellerDashboard");
  const { locale } = await params;
  const session = await auth();

  // Redirect to sign-in if user is not authenticated
  if (!session?.user) {
    redirect(`/${locale}/sign-in`);
  }

  // Fetch seller data
  const sellerResult = await getSellerByUserId(session.user.id!, locale);
  if (!sellerResult.success || !sellerResult.data) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">{t("settingsTitle")}</h1>
        <p className="text-red-600">{t("errors.sellerNotFound")}</p>
      </div>
    );
  }

  const seller = sellerResult.data;

  // Check if subscription is active
  if (seller.subscription?.status !== "active") {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">{t("settingsTitle")}</h1>
        <p className="text-red-600">{t("errors.inactiveSubscription")}</p>
        <Link
          href={`/${locale}/seller/dashboard/subscription`}
          className="text-blue-600 hover:underline"
        >
          {t("manageSubscription")}
        </Link>
      </div>
    );
  }

  // Fetch unread notifications count
  const unreadNotifications = await NotificationUtils.getUnreadCount(
    session.user.id!
  );

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{t("settingsTitle")}</h1>
        <p className="text-gray-600 mt-2">
          {t("settingsDescription", { businessName: seller.businessName })}
        </p>
        <div className="mt-4 flex items-center gap-4">
          <Badge variant="secondary">
            {t("pointsBalance")}: {seller.pointsBalance}
          </Badge>
          <Badge
            variant={seller.subscription.plan === "VIP" ? "default" : "outline"}
          >
            {t("plan")}: {seller.subscription.plan}
          </Badge>
        </div>
      </div>

      {/* Settings Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Account Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {t("accountSettings")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">{t("manageAccount")}</p>
            <Button asChild variant="outline">
              <Link href={`/${locale}/seller/dashboard/settings/account`}>
                {t("editAccount")} <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Notifications Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              {t("notificationSettings")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              {t("manageNotifications")}{" "}
              {unreadNotifications > 0 && (
                <Badge variant="destructive">{unreadNotifications} {t("unread")}</Badge>
              )}
            </p>
            <Button asChild variant="outline">
              <Link href={`/${locale}/seller/dashboard/settings/notifications`}>
                {t("editNotifications")} <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Security Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              {t("securitySettings")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">{t("manageSecurity")}</p>
            <Button asChild variant="outline">
              <Link href={`/${locale}/seller/dashboard/settings/security`}>
                {t("editSecurity")} <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Custom Site Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              {t("customizeSite")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">{t("manageCustomSite")}</p>
            <Button asChild variant="outline">
              <Link href={`/${locale}/seller/dashboard/settings/custom-site`}>
                {t("editCustomSite")} <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Subscription Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              {t("subscriptionSettings")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">{t("manageSubscription")}</p>
            <Button asChild variant="outline">
              <Link href={`/${locale}/seller/dashboard/subscription`}>
                {t("editSubscription")} <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}