'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ShippingAddressSchema } from '@/lib/validator';
import { ShippingAddress, SellerCheckoutFormProps } from '@/types';
import { createOrder } from '@/lib/actions/order.actions';
import { getCart } from '@/lib/actions/cart.actions';
import { createPaymentSession } from '@/lib/utils/payments';
import { getSellerProducts, applyDiscount } from '@/lib/actions/product.actions';
import { formatCurrency, calculateFutureDate, formatDateTime, timeUntilMidnight } from '@/lib/utils';
import Image from 'next/image';
import Link from 'next/link';
import SellerIntegration from '@/lib/db/models/seller-integration.model';
import { customLogger } from '@/lib/api/services/logging';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTranslations } from 'next-intl';

const defaultShippingAddress: ShippingAddress = {
  fullName: '',
  street: '',
  city: '',
  province: '',
  phone: '',
  postalCode: '',
  country: '',
};

export default function SellerCheckoutForm({ storeId, sellerId }: SellerCheckoutFormProps) {
  const t = useTranslations('Checkout');
  const { toast } = useToast();
  const router = useRouter();
  const [cart, setCart] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [deliveryDates, setDeliveryDates] = useState<any[]>([]);
  const [shippingAddress, setShippingAddress] = useState<ShippingAddress | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('');
  const [deliveryDateIndex, setDeliveryDateIndex] = useState<number | null>(null);
  const [discountCode, setDiscountCode] = useState<string>('');
  const [discount, setDiscount] = useState<number>(0);
  const [points, setPoints] = useState<number>(0);
  const [availablePoints, setAvailablePoints] = useState<number>(0);
  const [pointsError, setPointsError] = useState<string | null>(null);
  const [isAddressSelected, setIsAddressSelected] = useState<boolean>(false);
  const [isPaymentMethodSelected, setIsPaymentMethodSelected] = useState<boolean>(false);
  const [isDeliveryDateSelected, setIsDeliveryDateSelected] = useState<boolean>(false);

  const shippingAddressForm = useForm<ShippingAddress>({
    resolver: zodResolver(ShippingAddressSchema),
    defaultValues: shippingAddress || defaultShippingAddress,
  });

  // Fetch cart, seller's products, payment methods, delivery options, and points
  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch cart
        const cartResult = await getCart(sellerId);
        if (cartResult.success && cartResult.cart) {
          setCart(cartResult.cart.items);
        } else {
          toast({ description: t('failed to load data'), variant: 'destructive' });
        }

        // Fetch seller's products
        const sellerProducts = await getSellerProducts(storeId);
        setProducts(sellerProducts);

        // Fetch payment methods from SellerIntegration
        const integrations = await SellerIntegration.find({ sellerId, type: 'payment', status: 'connected', isActive: true });
        const methods = integrations
          .filter((int: any) => int.integrationId)
          .map((int: any) => ({
            name: int.providerName,
            id: int.integrationId,
          }));
        setPaymentMethods(methods);

        // Fetch delivery options
        setDeliveryDates([
          { name: 'Standard', daysToDeliver: 5, shippingPrice: 10, freeShippingMinPrice: 50 },
          { name: 'Express', daysToDeliver: 2, shippingPrice: 20, freeShippingMinPrice: 100 },
        ]);

        // Fetch available points
        const pointsResponse = await fetch('/api/points/balance');
        const pointsData = await pointsResponse.json();
        if (pointsData.success) {
          setAvailablePoints(pointsData.data);
        } else {
          toast({ description: t('failed to load data'), variant: 'destructive' });
        }
      } catch (error) {
        toast({ description: t('failed to load data'), variant: 'destructive' });
      }
    }
    fetchData();
  }, [storeId, sellerId, toast, t]);

  // Update form with saved shipping address
  useEffect(() => {
    if (!shippingAddress) return;
    shippingAddressForm.setValue('fullName', shippingAddress.fullName);
    shippingAddressForm.setValue('street', shippingAddress.street);
    shippingAddressForm.setValue('city', shippingAddress.city);
    shippingAddressForm.setValue('country', shippingAddress.country);
    shippingAddressForm.setValue('postalCode', shippingAddress.postalCode);
    shippingAddressForm.setValue('province', shippingAddress.province);
    shippingAddressForm.setValue('phone', shippingAddress.phone);
  }, [shippingAddress, shippingAddressForm]);

  const onSubmitShippingAddress: SubmitHandler<ShippingAddress> = (values) => {
    setShippingAddress(values);
    setIsAddressSelected(true);
  };

  const handleApplyDiscount = async () => {
    try {
      const response = await applyDiscount(storeId, discountCode);
      if (response.success) {
        setDiscount(response.data.discount);
        toast({ description: t('discount applied', { amount: formatCurrency(response.data.discount) }) });
      } else {
        toast({ description: response.message || t('failed to apply discount'), variant: 'destructive' });
      }
    } catch (error) {
      toast({ description: t('failed to apply discount'), variant: 'destructive' });
    }
  };

  const handleApplyPoints = async () => {
    try {
      const response = await fetch('/api/points/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ points, currency: 'USD' }),
      });
      const data = await response.json();
      if (data.success) {
        setPointsError(null);
        setDiscount((prev) => prev + data.data.discount);
        toast({ description: t('discount applied', { amount: formatCurrency(data.data.discount) }) });
      } else {
        setPointsError(data.message || t('failed to apply discount'));
      }
    } catch (error) {
      setPointsError(t('failed to apply discount'));
    }
  };

  const handlePlaceOrder = async () => {
    try {
      if (!shippingAddress) {
        throw new Error(t('invalid shipping address'));
      }
      const itemsPrice = cart.reduce((total, item) => total + item.price * item.quantity, 0);
      const shippingPrice = deliveryDateIndex !== null ? deliveryDates[deliveryDateIndex].shippingPrice : 0;
      const taxPrice = itemsPrice * 0.1; // Example tax calculation
      const totalPrice = itemsPrice + shippingPrice + taxPrice - discount;

      const paymentIntegration = await SellerIntegration.findOne({
        sellerId,
        type: 'payment',
        providerName: selectedPaymentMethod,
        status: 'connected',
        isActive: true,
      });

      if (!paymentIntegration || !paymentIntegration.integrationId) {
        throw new Error(t('failed to load data'));
      }

      const paymentUrl = await createPaymentSession({
        userId: sellerId,
        planId: 'order',
        amount: totalPrice,
        currency: 'USD',
        method: selectedPaymentMethod,
        paymentGatewayId: paymentIntegration.integrationId,
      });

      const order = await createOrder({
        storeId,
        items: cart,
        shippingAddress,
        expectedDeliveryDate: deliveryDateIndex !== null ? calculateFutureDate(deliveryDates[deliveryDateIndex].daysToDeliver) : undefined,
        deliveryDateIndex,
        paymentMethod: selectedPaymentMethod,
        itemsPrice,
        shippingPrice,
        taxPrice,
        totalPrice,
        pointsUsed: points,
        pointsDiscount: discount,
      });

      if (order.success) {
        await customLogger.info(t('order created'), { orderId: order.data.orderId, storeId, userId: sellerId });
        router.push(`/checkout/${order.data.orderId}`);
      } else {
        toast({ description: order.message || t('failed to load data'), variant: 'destructive' });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t('failed to load data');
      await customLogger.error(t('order creation failed'), { storeId, error: errorMessage });
      toast({ description: errorMessage, variant: 'destructive' });
    }
  };

  const CheckoutSummary = () => {
    const itemsPrice = cart.reduce((total, item) => total + item.price * item.quantity, 0);
    const shippingPrice = deliveryDateIndex !== null ? deliveryDates[deliveryDateIndex].shippingPrice : 0;
    const taxPrice = itemsPrice * 0.1; // Example tax calculation
    const totalPrice = itemsPrice + shippingPrice + taxPrice - discount;

    return (
      <Card>
        <CardContent className="p-4">
          {!isAddressSelected && (
            <div className="border-b mb-4">
              <Button className="rounded-full w-full" onClick={shippingAddressForm.handleSubmit(onSubmitShippingAddress)}>
                {t('ship to this address')}
              </Button>
              <p className="text-xs text-center py-2">
                {t('choose shipping address and payment method')}
              </p>
            </div>
          )}
          {isAddressSelected && !isPaymentMethodSelected && (
            <div className="mb-4">
              <Button className="rounded-full w-full" onClick={() => setIsPaymentMethodSelected(true)}>
                {t('use this payment method')}
              </Button>
              <p className="text-xs text-center py-2">
                {t('choose a payment method')}
              </p>
            </div>
          )}
          {isPaymentMethodSelected && isAddressSelected && (
            <div>
              <Button onClick={handlePlaceOrder} className="rounded-full w-full">
                {t('place your order')}
              </Button>
              <p className="text-xs text-center py-2">
                {t('by placing your order', {
                  privacyLink: <Link href="/page/privacy-policy">{t('privacy notice')}</Link>,
                  conditionsLink: <Link href="/page/conditions-of-use">{t('conditions of use')}</Link>,
                })}
              </p>
            </div>
          )}
          <div>
            <div className="text-lg font-bold">{t('order summary')}</div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>{t('items')}</span>
                <span>{formatCurrency(itemsPrice)}</span>
              </div>
              <div className="flex justify-between">
                <span>{t('shipping and handling')}</span>
                <span>{shippingPrice === 0 ? t('free') : formatCurrency(shippingPrice)}</span>
              </div>
              <div className="flex justify-between">
                <span>{t('tax')}</span>
                <span>{formatCurrency(taxPrice)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between">
                  <span>{t('discount')}</span>
                  <span>-{formatCurrency(discount)}</span>
                </div>
              )}
              <div className="flex justify-between pt-4 font-bold text-lg">
                <span>{t('order total')}</span>
                <span>{formatCurrency(totalPrice)}</span>
              </div>
              <div className="mt-4">
                <FormLabel>{t('discount code')}</FormLabel>
                <Input
                  value={discountCode}
                  onChange={(e) => setDiscountCode(e.target.value)}
                  placeholder={t('enter discount code')}
                />
                <Button onClick={handleApplyDiscount} className="mt-2">{t('apply discount')}</Button>
                <FormLabel>{t('use points')}</FormLabel>
                <Input
                  type="number"
                  value={points}
                  onChange={(e) => setPoints(Number(e.target.value))}
                  max={availablePoints}
                  placeholder={t('available points', { points: availablePoints })}
                />
                {pointsError && <p className="text-red-500 text-xs">{pointsError}</p>}
                <Button
                  onClick={handleApplyPoints}
                  disabled={points <= 0 || points > availablePoints}
                  className="mt-2"
                >
                  {t('apply points')}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <main className="max-w-6xl mx-auto highlight-link">
      <div className="grid md:grid-cols-4 gap-6">
        <div className="md:col-span-3">
          {/* Shipping Address */}
          <div>
            {isAddressSelected && shippingAddress ? (
              <div className="grid grid-cols-1 md:grid-cols-12 my-3 pb-3">
                <div className="col-span-5 flex text-lg font-bold">
                  <span className="w-8">1 </span>
                  <span>{t('shipping address')}</span>
                </div>
                <div className="col-span-5">
                  <p>
                    {shippingAddress.fullName} <br />
                    {shippingAddress.street} <br />
                    {`${shippingAddress.city}, ${shippingAddress.province}, ${shippingAddress.postalCode}, ${shippingAddress.country}`}
                  </p>
                </div>
                <div className="col-span-2">
                  <Button variant="outline" onClick={() => setIsAddressSelected(false)}>
                    {t('change')}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex text-primary text-lg font-bold my-2">
                  <span className="w-8">1 </span>
                  <span>{t('enter shipping address')}</span>
                </div>
                <Form {...shippingAddressForm}>
                  <form
                    onSubmit={shippingAddressForm.handleSubmit(onSubmitShippingAddress)}
                    className="space-y-4"
                  >
                    <Card className="md:ml-8 my-4">
                      <CardContent className="p-4 space-y-2">
                        <div className="text-lg font-bold mb-2">{t('your address')}</div>
                        <FormField
                          control={shippingAddressForm.control}
                          name="fullName"
                          render={({ field }) => (
                            <FormItem className="w-full">
                              <FormLabel>{t('full name')}</FormLabel>
                              <FormControl>
                                <Input placeholder={t('enter full name')} {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={shippingAddressForm.control}
                          name="street"
                          render={({ field }) => (
                            <FormItem className="w-full">
                              <FormLabel>{t('address')}</FormLabel>
                              <FormControl>
                                <Input placeholder={t('enter address')} {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="flex flex-col gap-5 md:flex-row">
                          <FormField
                            control={shippingAddressForm.control}
                            name="city"
                            render={({ field }) => (
                              <FormItem className="w-full">
                                <FormLabel>{t('city')}</FormLabel>
                                <FormControl>
                                  <Input placeholder={t('enter city')} {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={shippingAddressForm.control}
                            name="province"
                            render={({ field }) => (
                              <FormItem className="w-full">
                                <FormLabel>{t('province')}</FormLabel>
                                <FormControl>
                                  <Input placeholder={t('enter province')} {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={shippingAddressForm.control}
                            name="country"
                            render={({ field }) => (
                              <FormItem className="w-full">
                                <FormLabel>{t('country')}</FormLabel>
                                <FormControl>
                                  <Input placeholder={t('enter country')} {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="flex flex-col gap-5 md:flex-row">
                          <FormField
                            control={shippingAddressForm.control}
                            name="postalCode"
                            render={({ field }) => (
                              <FormItem className="w-full">
                                <FormLabel>{t('postal code')}</FormLabel>
                                <FormControl>
                                  <Input placeholder={t('enter postal code')} {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={shippingAddressForm.control}
                            name="phone"
                            render={({ field }) => (
                              <FormItem className="w-full">
                                <FormLabel>{t('phone number')}</FormLabel>
                                <FormControl>
                                  <Input placeholder={t('enter phone number')} {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </CardContent>
                      <CardFooter className="p-4">
                        <Button type="submit" className="rounded-full font-bold">
                          {t('ship to this address')}
                        </Button>
                      </CardFooter>
                    </Card>
                  </form>
                </Form>
              </>
            )}
          </div>
          {/* Payment Method */}
          <div className="border-y">
            {isPaymentMethodSelected && selectedPaymentMethod ? (
              <div className="grid grid-cols-1 md:grid-cols-12 my-3 pb-3">
                <div className="flex text-lg font-bold col-span-5">
                  <span className="w-8">2 </span>
                  <span>{t('payment method')}</span>
                </div>
                <div className="col-span-5">
                  <p>{selectedPaymentMethod}</p>
                </div>
                <div className="col-span-2">
                  <Button variant="outline" onClick={() => setIsPaymentMethodSelected(false)}>
                    {t('change')}
                  </Button>
                </div>
              </div>
            ) : isAddressSelected ? (
              <>
                <div className="flex text-primary text-lg font-bold my-2">
                  <span className="w-8">2 </span>
                  <span>{t('choose a payment method')}</span>
                </div>
                <Card className="md:ml-8 my-4">
                  <CardContent className="p-4">
                    <RadioGroup
                      value={selectedPaymentMethod}
                      onValueChange={setSelectedPaymentMethod}
                    >
                      {paymentMethods.map((pm) => (
                        <div key={pm.id} className="flex items-center py-1">
                          <RadioGroupItem value={pm.name} id={`payment-${pm.id}`} />
                          <FormLabel className="font-bold pl-2 cursor-pointer" htmlFor={`payment-${pm.id}`}>
                            {pm.name}
                          </FormLabel>
                        </div>
                      ))}
                    </RadioGroup>
                  </CardContent>
                  <CardFooter className="p-4">
                    <Button onClick={() => setIsPaymentMethodSelected(true)} className="rounded-full font-bold">
                      {t('use this payment method')}
                    </Button>
                  </CardFooter>
                </Card>
              </>
            ) : (
              <div className="flex text-muted-foreground text-lg font-bold my-4 py-3">
                <span className="w-8">2 </span>
                <span>{t('choose a payment method')}</span>
              </div>
            )}
          </div>
          {/* Items and Delivery Date */}
          <div>
            {isDeliveryDateSelected && deliveryDateIndex !== null ? (
              <div className="grid grid-cols-1 md:grid-cols-12 my-3 pb-3">
                <div className="flex text-lg font-bold col-span-5">
                  <span className="w-8">3 </span>
                  <span>{t('items and shipping')}</span>
                </div>
                <div className="col-span-5">
                  <p>
                    {t('delivery date')}: {formatDateTime(calculateFutureDate(deliveryDates[deliveryDateIndex].daysToDeliver)).dateOnly}
                  </p>
                  <ul>
                    {cart.map((item, index) => (
                      <li key={index}>
                        {item.name} x {item.quantity} = {formatCurrency(item.price * item.quantity)}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="col-span-2">
                  <Button variant="outline" onClick={() => setIsDeliveryDateSelected(false)}>
                    {t('change')}
                  </Button>
                </div>
              </div>
            ) : isPaymentMethodSelected && isAddressSelected ? (
              <>
                <div className="flex text-primary text-lg font-bold my-2">
                  <span className="w-8">3 </span>
                  <span>{t('review items and shipping')}</span>
                </div>
                <Card className="md:ml-8">
                  <CardContent className="p-4">
                    <p className="mb-2">
                      <span className="text-lg font-bold text-green-700">
                        {t('arriving')} {formatDateTime(calculateFutureDate(deliveryDates[deliveryDateIndex || 0].daysToDeliver)).dateOnly}
                      </span>{' '}
                      {t('if you order in the next', { hours: timeUntilMidnight().hours, minutes: timeUntilMidnight().minutes })}
                    </p>
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        {cart.map((item, index) => (
                          <div key={index} className="flex gap-4 py-2">
                            <div className="relative w-16 h-16">
                              <Image
                                src={item.image}
                                alt={item.name}
                                fill
                                sizes="20vw"
                                style={{ objectFit: 'contain' }}
                              />
                            </div>
                            <div className="flex-1">
                              <p className="font-semibold">{item.name}</p>
                              <p className="font-bold">{formatCurrency(item.price)}</p>
                              <Select
                                value={item.quantity.toString()}
                                onValueChange={(value) => {
                                  if (value === '0') {
                                    setCart(cart.filter((_, i) => i !== index));
                                  } else {
                                    setCart(cart.map((cartItem, i) => i === index ? { ...cartItem, quantity: Number(value) } : cartItem));
                                  }
                                }}
                              >
                                <SelectTrigger className="w-24">
                                  <SelectValue>{t('quantity')}: {item.quantity}</SelectValue>
                                </SelectTrigger>
                                <SelectContent position="popper">
                                  {Array.from({ length: item.countInStock }).map((_, i) => (
                                    <SelectItem key={i + 1} value={`${i + 1}`}>{i + 1}</SelectItem>
                                  ))}
                                  <SelectItem key="delete" value="0">{t('delete')}</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div>
                        <div className="font-bold">
                          <p className="mb-2">{t('choose a shipping speed')}</p>
                          <RadioGroup
                            value={deliveryDates[deliveryDateIndex || 0]?.name}
                            onValueChange={(value) => {
                              setDeliveryDateIndex(deliveryDates.findIndex((dd) => dd.name === value));
                              setIsDeliveryDateSelected(true);
                            }}
                          >
                            {deliveryDates.map((dd) => (
                              <div key={dd.name} className="flex">
                                <RadioGroupItem value={dd.name} id={`address-${dd.name}`} />
                                <FormLabel className="pl-2 space-y-2 cursor-pointer" htmlFor={`address-${dd.name}`}>
                                  <div className="text-green-700 font-semibold">
                                    {formatDateTime(calculateFutureDate(dd.daysToDeliver)).dateOnly}
                                  </div>
                                  <div>
                                    {dd.shippingPrice === 0 ? t('free shipping') : formatCurrency(dd.shippingPrice)}
                                  </div>
                                </FormLabel>
                              </div>
                            ))}
                          </RadioGroup>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <div className="flex text-muted-foreground text-lg font-bold my-4 py-3">
                <span className="w-8">3 </span>
                <span>{t('items and shipping')}</span>
              </div>
            )}
          </div>
          {isPaymentMethodSelected && isAddressSelected && (
            <div className="mt-6">
              <div className="block md:hidden">
                <CheckoutSummary />
              </div>
              <Card className="hidden md:block">
                <CardContent className="p-4 flex flex-col md:flex-row justify-between items-center gap-3">
                  <Button onClick={handlePlaceOrder} className="rounded-full">{t('place your order')}</Button>
                  <div className="flex-1">
                    <p className="font-bold text-lg">{t('order total')}: {formatCurrency(cart.reduce((total, item) => total + item.price * item.quantity, 0) + (deliveryDateIndex !== null ? deliveryDates[deliveryDateIndex].shippingPrice : 0) + (cart.reduce((total, item) => total + item.price * item.quantity, 0) * 0.1) - discount)}</p>
                    <p className="text-xs">
                      {t('by placing your order', {
                        privacyLink: <Link href="/page/privacy-policy">{t('privacy notice')}</Link>,
                        conditionsLink: <Link href="/page/conditions-of-use">{t('conditions of use')}</Link>,
                      })}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
        <div className="hidden md:block">
          <CheckoutSummary />
        </div>
      </div>
    </main>
  );
}