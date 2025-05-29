'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { updateSetting } from '@/lib/actions/setting.actions'

const pointsFormSchema = z.object({
  points: z.object({
    earnRate: z.number().min(0, 'Earn rate must be non-negative'),
    redeemValue: z.number().min(0, 'Redeem value must be non-negative'),
    registrationBonus: z.object({
      buyer: z.number().min(0, 'Buyer bonus must be non-negative'),
      seller: z.number().min(0, 'Seller bonus must be non-negative'),
    }),
    sellerPointsPerSale: z.number().min(0, 'Seller points per sale must be non-negative'),
  }),
})

type PointsFormValues = z.infer<typeof pointsFormSchema>

export default function PointsForm({ setting }: { setting: any }) {
  const { toast } = useToast()

  const form = useForm<PointsFormValues>({
    resolver: zodResolver(pointsFormSchema),
    defaultValues: {
      points: {
        earnRate: setting.points?.earnRate || 1, // 1 point per $1
        redeemValue: setting.points?.redeemValue || 0.05, // 1 point = $0.05
        registrationBonus: {
          buyer: setting.points?.registrationBonus?.buyer || 50,
          seller: setting.points?.registrationBonus?.seller || 100,
        },
        sellerPointsPerSale: setting.points?.sellerPointsPerSale || 10,
      },
    },
  })

  const onSubmit = async (data: PointsFormValues) => {
    try {
      const response = await updateSetting({ points: data.points })
      if (response.success) {
        toast({
          title: 'Success',
          description: 'Points settings updated successfully',
        })
      } else {
        toast({
          title: 'Error',
          description: response.error,
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update points settings',
        variant: 'destructive',
      })
    }
  }

  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle>Points Settings</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            id="points-settings"
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-6"
          >
            <FormField
              control={form.control}
              name="points.earnRate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Earn Rate (Points per $1)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="points.redeemValue"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Redeem Value ($ per Point)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="points.registrationBonus.buyer"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Buyer Registration Bonus (Points)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="points.registrationBonus.seller"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Seller Registration Bonus (Points)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="points.sellerPointsPerSale"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Seller Points per Sale</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit">Save Points Settings</Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}