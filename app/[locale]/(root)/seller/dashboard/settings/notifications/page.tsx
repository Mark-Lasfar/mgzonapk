import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSellerByUserId, updateSellerSettings } from "@/lib/actions/seller.actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Bell } from "lucide-react";

export default async function SellerNotificationsSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const t = await getTranslations("SellerDashboard");
  const { locale } = await params;
  const session = await auth();

  if (!session?.user) {
    redirect(`/${locale}/sign-in`);
  }

  const sellerResult = await getSellerByUserId(session.user.id, locale);
  if (!sellerResult.success || !sellerResult.data) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">{t("notificationSettings")}</h1>
        <p className="text-red-600">{t("errors.sellerNotFound")}</p>
      </div>
    );
  }

  const seller = sellerResult.data;

  if (seller.subscription?.status !== "active") {
    redirect(`/${locale}/seller/dashboard/settings`);
  }

  // Define form schema
  const formSchema = z.object({
    email: z.boolean(),
    sms: z.boolean(),
    orderUpdates: z.boolean(),
    marketingEmails: z.boolean(),
    pointsNotifications: z.boolean(),
  });

  // Server Action to handle form submission
  async function handleSubmit(formData: z.infer<typeof formSchema>) {
    "use server";
    const result = await updateSellerSettings(session.user.id, {
      settings: {
        notifications: formData,
      },
    });
    return result;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            {t("notificationSettings")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...useForm({
            resolver: zodResolver(formSchema),
            defaultValues: seller.settings.notifications,
          })}>
            <form action={handleSubmit} className="space-y-6">
              <FormField
                name="email"
                render={({ field }) => (
                  <FormItem className="flex items-center space-x-2">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel>{t("notifications.email")}</FormLabel>
                  </FormItem>
                )}
              />
              <FormField
                name="sms"
                render={({ field }) => (
                  <FormItem className="flex items-center space-x-2">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel>{t("notifications.sms")}</FormLabel>
                  </FormItem>
                )}
              />
              <FormField
                name="orderUpdates"
                render={({ field }) => (
                  <FormItem className="flex items-center space-x-2">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel>{t("notifications.orderUpdates")}</FormLabel>
                  </FormItem>
                )}
              />
              <FormField
                name="marketingEmails"
                render={({ field }) => (
                  <FormItem className="flex items-center space-x-2">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel>{t("notifications.marketingEmails")}</FormLabel>
                  </FormItem>
                )}
              />
              <FormField
                name="pointsNotifications"
                render={({ field }) => (
                  <FormItem className="flex items-center space-x-2">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel>{t("notifications.pointsNotifications")}</FormLabel>
                  </FormItem>
                )}
              />
              <Button type="submit">{t("submit")}</Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}