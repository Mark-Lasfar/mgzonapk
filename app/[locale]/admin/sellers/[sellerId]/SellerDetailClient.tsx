// app/[locale]/(admin)/admin/sellers/[sellerId]/SellerDetailClient.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  updateSeller,
  suspendSeller,
  deleteSeller,
} from "@/lib/actions/seller.actions";

interface SellerDetailClientProps {
  seller: any;
  metrics: any;
  locale: string;
  t: any;
}

export default function SellerDetailClient({
  seller: initialSeller,
  metrics,
  locale,
  t,
}: SellerDetailClientProps) {
  const [seller, setSeller] = useState<any>(initialSeller);
  const [editField, setEditField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [suspendReason, setSuspendReason] = useState<string>("");
  const router = useRouter();

  const handleEdit = (field: string, value: string) => {
    setEditField(field);
    setEditValue(value);
  };

  const handleSave = async () => {
    try {
      const updateData: any = { [editField!]: editValue };
      const result = await updateSeller(seller.userId, updateData, { revalidate: true }, locale);

      if (result.success) {
        setSuccess(t("updateSuccess"));
        setSeller(result.data);
        setEditField(null);
        setEditValue("");
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(`${t("error")}: ${result.error}`);
        setTimeout(() => setError(null), 3000);
      }
    } catch (err) {
      setError("Failed to update seller");
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleSuspend = async () => {
    try {
      if (!suspendReason) {
        setError(t("suspendReasonRequired"));
        setTimeout(() => setError(null), 3000);
        return;
      }

      const result = await suspendSeller(seller._id, suspendReason, locale);

      if (result.success) {
        setSuccess(t("suspendSuccess"));
        setSeller(result.data);
        setSuspendReason("");
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(`${t("error")}: ${result.error}`);
        setTimeout(() => setError(null), 3000);
      }
    } catch (err) {
      setError("Failed to suspend seller");
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleDelete = async () => {
    try {
      if (confirm(t("confirmDelete"))) {
        const result = await deleteSeller(seller.userId, locale);

        if (result.success) {
          setSuccess(t("deleteSuccess"));
          setTimeout(() => router.push(`/${locale}/admin/sellers`), 2000);
        } else {
          setError(`${t("error")}: ${result.error}`);
          setTimeout(() => setError(null), 3000);
        }
      }
    } catch (err) {
      setError("Failed to delete seller");
      setTimeout(() => setError(null), 3000);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Seller Details: {seller.businessName}</h1>
      {success && <p className="text-green-600 mb-4">{success}</p>}
      {error && <p className="text-red-600 mb-4">{error}</p>}

      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-2xl font-semibold mb-4">Business Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="font-medium">Business Name:</label>
            <div className="flex items-center">
              {editField === "businessName" ? (
                <>
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="border rounded-lg px-2 py-1 mr-2"
                  />
                  <button onClick={handleSave} className="text-green-600 hover:underline mr-2">Save</button>
                  <button onClick={() => setEditField(null)} className="text-red-600 hover:underline">Cancel</button>
                </>
              ) : (
                <>
                  <span className="mr-2">{seller.businessName}</span>
                  <button onClick={() => handleEdit("businessName", seller.businessName)} className="text-blue-600 hover:underline">Edit</button>
                </>
              )}
            </div>
          </div>

          {seller.logo && (
            <div className="mt-4">
              <label className="font-medium">Logo:</label>
              <Image src={seller.logo} alt="Seller Logo" width={100} height={100} className="rounded" />
            </div>
          )}

          <div>
            <label className="font-medium">Email:</label>
            <span className="ml-2">{seller.email || "N/A"}</span>
          </div>
          <div>
            <label className="font-medium">Phone:</label>
            <span className="ml-2">{seller.phone || "N/A"}</span>
          </div>
          <div>
            <label className="font-medium">Description:</label>
            <span className="ml-2">{seller.description || "N/A"}</span>
          </div>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-2xl font-semibold mb-4">Metrics</h2>
        {metrics ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="font-medium">Total Sales:</label>
              <span>{metrics.revenue?.yearly ?? "N/A"}</span>
            </div>
            <div>
              <label className="font-medium">Page Visits:</label>
              <span>{metrics.analytics?.visitorsCount ?? "N/A"}</span>
            </div>
            <div>
              <label className="font-medium">Profits:</label>
              <span>
                {metrics.revenue?.yearly ? (metrics.revenue.yearly * 0.9).toFixed(2) : "N/A"} (10% commission)
              </span>
            </div>
          </div>
        ) : (
          <p>Loading metrics...</p>
        )}
      </div>

      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-2xl font-semibold mb-4">Admin Actions</h2>
        <div className="flex flex-col gap-4">
          <div>
            <label className="font-medium">Suspend Seller:</label>
            <input
              type="text"
              placeholder="Enter reason for suspension"
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              className="border rounded-lg px-2 py-1 mr-2 w-full md:w-1/2"
            />
            <button
              onClick={handleSuspend}
              className="bg-yellow-600 text-white px-4 py-2 rounded-lg mt-2"
            >
              Suspend
            </button>
          </div>
          <div>
            <button
              onClick={handleDelete}
              className="bg-red-600 text-white px-4 py-2 rounded-lg"
            >
              Delete Seller
            </button>
          </div>
        </div>
      </div>

      <Link href={`/${locale}/admin/sellers`} className="text-blue-600 hover:underline">
        Back to Sellers
      </Link>
    </div>
  );
}