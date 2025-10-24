// // app/[locale]/(root)/seller/dashboard/settings/financial-profile/FinancialProfileForm.tsx
// 'use client';

// import { useForm } from 'react-hook-form';
// import { zodResolver } from '@hookform/resolvers/zod';
// import * as z from 'zod';
// import { useTranslations } from 'next-intl';
// import { Button } from '@/components/ui/button';
// import { Input } from '@/components/ui/input';
// import { Badge } from '@/components/ui/badge';
// import {
//   Form,
//   FormControl,
//   FormField,
//   FormItem,
//   FormLabel,
//   FormMessage,
// } from '@/components/ui/form';
// import { useToast } from '@/components/ui/use-toast';
// import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

// interface BankInfo {
//   accountName: string;
//   accountNumber: string;
//   bankName: string;
//   swiftCode: string;
//   isVerified: boolean;
// }

// interface FinancialProfileFormProps {
//   bankInfo: BankInfo;
//   onRefresh?: () => void;
//   token?: string; // تمرير الـ token مباشرة
// }

// const formSchema = z.object({
//   accountName: z
//     .string()
//     .min(2, { message: 'accountName.min' })
//     .max(100, { message: 'accountName.max' }),
//   accountNumber: z
//     .string()
//     .min(8, { message: 'accountNumber.min' })
//     .max(34, { message: 'accountNumber.max' }),
//   bankName: z
//     .string()
//     .min(2, { message: 'bankName.min' })
//     .max(100, { message: 'bankName.max' }),
//   swiftCode: z
//     .string()
//     .min(8, { message: 'swiftCode.min' })
//     .max(11, { message: 'swiftCode.max' })
//     .regex(/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/, { message: 'swiftCode.invalid' }),
// });

// type FormData = z.infer<typeof formSchema>;

// export default function FinancialProfileForm({ 
//   bankInfo, 
//   onRefresh,
//   token 
// }: FinancialProfileFormProps) {
//   const t = useTranslations('SellerDashboard');
//   const { toast } = useToast();

//   const form = useForm<FormData>({
//     resolver: zodResolver(formSchema),
//     defaultValues: {
//       accountName: bankInfo.accountName || '',
//       accountNumber: bankInfo.accountNumber || '',
//       bankName: bankInfo.bankName || '',
//       swiftCode: bankInfo.swiftCode || '',
//     },
//     mode: 'onChange',
//   });

//   const handleSubmit = async (data: FormData) => {
//     if (!token) {
//       toast({
//         title: t('errors.title'),
//         description: t('errors.unauthenticated'),
//         variant: 'destructive',
//       });
//       return;
//     }

//     try {
//       form.setError('root', { message: '' }); // Clear previous errors
      
//       const response = await fetch('/api/seller/bank/verify', {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//           Authorization: `Bearer ${token}`,
//         },
//         body: JSON.stringify(data),
//       });

//       const result = await response.json();

//       if (response.ok && result.success) {
//         toast({
//           title: t('messages.bankInfoUpdated'),
//           description: t('messages.bankInfoUpdatedMessage'),
//         });
//         onRefresh?.();
//         form.reset(data); // Reset form with new data
//       } else {
//         toast({
//           title: t('errors.failedToUpdateBankInfo'),
//           description: result.message || result.error || t('errors.unknown'),
//           variant: 'destructive',
//         });
//       }
//     } catch (error) {
//       console.error('Error submitting bank info:', error);
//       toast({
//         title: t('errors.failedToUpdateBankInfo'),
//         description: t('errors.networkError'),
//         variant: 'destructive',
//       });
//     }
//   };

//   const verificationStatus = bankInfo.isVerified ? (
//     <Badge variant="default" className="flex items-center gap-1 bg-green-100 text-green-800 border-green-200">
//       <CheckCircle className="h-3 w-3" />
//       {t('bankInfoVerified')}
//     </Badge>
//   ) : (
//     <Badge variant="secondary" className="flex items-center gap-1 bg-yellow-100 text-yellow-800 border-yellow-200">
//       <AlertCircle className="h-3 w-3" />
//       {t('bankInfoPending')}
//     </Badge>
//   );

//   return (
//     <div className="space-y-6">
//       {/* حالة التحقق */}
//       <div className="p-4 bg-gray-50 rounded-lg border">
//         <div className="flex justify-between items-center mb-2">
//           <span className="font-medium text-sm">{t('verificationStatus')}</span>
//           {verificationStatus}
//         </div>
//         <p className="text-xs text-gray-600">
//           {bankInfo.isVerified 
//             ? t('messages.verifiedBankInfo') 
//             : t('messages.pendingBankVerification')
//           }
//         </p>
//       </div>

//       {/* ملاحظة */}
//       {!bankInfo.isVerified && (
//         <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
//           <p className="text-xs text-blue-800">
//             {t('messages.bankInfoNote')}
//           </p>
//         </div>
//       )}

//       <Form {...form}>
//         <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
//           <FormField
//             control={form.control}
//             name="accountName"
//             render={({ field }) => (
//               <FormItem>
//                 <FormLabel>{t('accountName.label')}</FormLabel>
//                 <FormControl>
//                   <Input 
//                     {...field} 
//                     placeholder={t('accountName.placeholder')}
//                     disabled={bankInfo.isVerified}
//                     className={bankInfo.isVerified ? 'bg-gray-100' : ''}
//                   />
//                 </FormControl>
//                 <FormMessage />
//               </FormItem>
//             )}
//           />
          
//           <FormField
//             control={form.control}
//             name="accountNumber"
//             render={({ field }) => (
//               <FormItem>
//                 <FormLabel>{t('accountNumber.label')}</FormLabel>
//                 <FormControl>
//                   <Input 
//                     {...field} 
//                     placeholder={t('accountNumber.placeholder')}
//                     disabled={bankInfo.isVerified}
//                     type={bankInfo.isVerified ? 'password' : 'text'}
//                     className={bankInfo.isVerified ? 'bg-gray-100' : ''}
//                   />
//                 </FormControl>
//                 <FormMessage />
//               </FormItem>
//             )}
//           />
          
//           <FormField
//             control={form.control}
//             name="bankName"
//             render={({ field }) => (
//               <FormItem>
//                 <FormLabel>{t('bankName.label')}</FormLabel>
//                 <FormControl>
//                   <Input 
//                     {...field} 
//                     placeholder={t('bankName.placeholder')}
//                     disabled={bankInfo.isVerified}
//                     className={bankInfo.isVerified ? 'bg-gray-100' : ''}
//                   />
//                 </FormControl>
//                 <FormMessage />
//               </FormItem>
//             )}
//           />
          
//           <FormField
//             control={form.control}
//             name="swiftCode"
//             render={({ field }) => (
//               <FormItem>
//                 <FormLabel>{t('swiftCode.label')}</FormLabel>
//                 <FormControl>
//                   <Input 
//                     {...field} 
//                     placeholder={t('swiftCode.placeholder')}
//                     disabled={bankInfo.isVerified}
//                     className={bankInfo.isVerified ? 'bg-gray-100' : ''}
//                   />
//                 </FormControl>
//                 <FormMessage />
//               </FormItem>
//             )}
//           />
          
//           {!bankInfo.isVerified && (
//             <Button 
//               type="submit" 
//               disabled={form.formState.isSubmitting || !token}
//               className="w-full"
//             >
//               {form.formState.isSubmitting 
//                 ? <>
//                   <Loader2 className="h-4 w-4 animate-spin mr-2" />
//                   {t('verifying')}
//                 </>
//                 : t('verifyBankInfo')
//               }
//             </Button>
//           )}
          
//           {bankInfo.isVerified && (
//             <div className="text-center py-4">
//               <p className="text-green-600 text-sm">{t('messages.verifiedBankInfoComplete')}</p>
//             </div>
//           )}
//         </form>
//       </Form>
//     </div>
//   );
// }