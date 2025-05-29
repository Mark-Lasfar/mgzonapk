// app/[locale]/(admin)/admin/sellers/page.tsx
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAllSellers } from "@/lib/actions/seller.actions";

export default async function SellersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string; search?: string }>;
}) {
  const t = await getTranslations("Admin.sellers");
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const session = await auth();

  if (!session?.user || session.user.role !== "Admin") {
    redirect(`/${resolvedParams.locale}/sign-in`);
  }

  const page = parseInt(resolvedSearchParams.page || "1", 10);
  const search = resolvedSearchParams.search || "";
  const pageSize = 10;

  const result = await getAllSellers({ page, limit: pageSize, search });

  if (!result.success) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">{t("title")}</h1>
        <p>{t("error")}: {result.error}</p>
      </div>
    );
  }

  const { sellers, pagination } = result.data;
  const total = pagination.total;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const totalPages = pagination.pages;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">{t("title")}</h1>
      <div className="mb-4">
        <form action={`/${resolvedParams.locale}/admin/sellers`} method="GET" className="flex gap-2">
          <input
            type="text"
            name="search"
            placeholder={t("searchPlaceholder")}
            defaultValue={search}
            className="border rounded-lg px-4 py-2 w-full md:w-1/3"
          />
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg">
            {t("search")}
          </button>
        </form>
      </div>
      {sellers.length === 0 ? (
        <p>{t("noSellers")}</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border px-4 py-2 text-left">{t("businessName")}</th>
                  <th className="border px-4 py-2 text-left">{t("email")}</th>
                  <th className="border px-4 py-2 text-left">{t("subscriptionPlan")}</th>
                  <th className="border px-4 py-2 text-left">{t("status")}</th>
                  <th className="border px-4 py-2 text-left">{t("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {sellers.map((seller) => (
                  <tr key={seller._id} className="hover:bg-gray-50">
                    <td className="border px-4 py-2">{seller.businessName}</td>
                    <td className="border px-4 py-2">{seller.email}</td>
                    <td className="border px-4 py-2">{seller.subscription?.plan || "Free"}</td>
                    <td className="border px-4 py-2">{seller.subscription?.status || "pending"}</td>
                    <td className="border px-4 py-2">
                      <Link
                        href={`/${resolvedParams.locale}/admin/sellers/${encodeURIComponent(seller.businessName)}`}
                        className="text-blue-600 hover:underline"
                      >
                        {t("view")}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex justify-between items-center">
            <p>
              {t("showing", { start, end, total })}
            </p>
            <div className="flex gap-2">
              {page > 1 && (
                <Link
                  href={`/${resolvedParams.locale}/admin/sellers?page=${page - 1}${search ? `&search=${search}` : ""}`}
                  className="bg-gray-200 px-4 py-2 rounded-lg"
                >
                  {t("previous")}
                </Link>
              )}
              {page < totalPages && (
                <Link
                  href={`/${resolvedParams.locale}/admin/sellers?page=${page + 1}${search ? `&search=${search}` : ""}`}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg"
                >
                  {t("next")}
                </Link>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}