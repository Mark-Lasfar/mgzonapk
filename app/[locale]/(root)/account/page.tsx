
  import { auth } from '@/auth';
  import BrowsingHistoryList from '@/components/shared/browsing-history-list';
  import { Card, CardContent } from '@/components/ui/card';
  import { Home, PackageCheckIcon, User, Crown, Briefcase, FileText, Key , Codepen } from 'lucide-react';
  import Link from 'next/link';
  import { getPointsBalance, getPointsHistory } from '@/lib/actions/points.actions';
  import { formatDateTime } from '@/lib/utils';
  import { getTranslations } from 'next-intl/server';
  import { Button } from '@/components/ui/button';



  export default async function AccountPage() {
    const t = await getTranslations('Account');
    const session = await auth();
    const siteName = 'Portfolio';

    let pointsBalance = 0;
    let pointsHistory: Array<{ _id?: string; amount: number; type: 'earn' | 'redeem'; description: string; createdAt: Date }> = [];

    if (session?.user?.id) {
      try {
        pointsBalance = await getPointsBalance(session.user.id);
        pointsHistory = await getPointsHistory(session.user.id);
      } catch (error) {
        console.error('Error fetching points:', error);
      }
    }

    return (
      <div>
        <h1 className="h1-bold py-4">{t('title')}</h1>
        {!session?.user?.id && (
          <Card className="mb-8">
            <CardContent className="flex flex-col items-center gap-4 p-6">
              <h2 className="text-xl font-bold">{t('newFrom', { siteName })}</h2>
              <p className="text-muted-foreground text-center">
                {t('registerPrompt')}
              </p>
              <Button asChild>
                <Link href="/register">{t('register')}</Link>
              </Button>
            </CardContent>
          </Card>
        )}
        {session?.user?.id && (
          <Card className="mb-8">
            <CardContent className="flex items-start gap-4 p-6">
              <FileText className="w-12 h-12" />
              <div>
                <h2 className="text-xl font-bold">{t('managePortfolio')}</h2>
                <p className="text-muted-foreground">
                  {t('managePortfolioDesc')}
                </p>
                <Button asChild>
                  <Link href="/account/portfolio">{t('managePortfolio')}</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        <div className="grid md:grid-cols-3 gap-4 items-stretch">
          <Card>
            <Link href="/account/orders">
              <CardContent className="flex items-start gap-4 p-6">
                <PackageCheckIcon className="w-12 h-12" />
                <div>
                  <h2 className="text-xl font-bold">{t('orders')}</h2>
                  <p className="text-muted-foreground">{t('ordersDesc')}</p>
                </div>
              </CardContent>
            </Link>
          </Card>
          <Card>
            <Link href="/account/manage">
              <CardContent className="flex items-start gap-4 p-6">
                <User className="w-12 h-12" />
                <div>
                  <h2 className="text-xl font-bold">{t('loginSecurity')}</h2>
                  <p className="text-muted-foreground">{t('loginSecurityDesc')}</p>
                </div>
              </CardContent>
            </Link>
          </Card>
          <Card>
            <Link href="/account/addresses">
              <CardContent className="flex items-start gap-4 p-6">
                <Home className="w-12 h-12" />
                <div>
                  <h2 className="text-xl font-bold">{t('addresses')}</h2>
                  <p className="text-muted-foreground">{t('addressesDesc')}</p>
                </div>
              </CardContent>
            </Link>
          </Card>
          <Card>
            <Link href="/account/subscriptions">
              <CardContent className="flex items-start gap-4 p-6">
                <Crown className="w-12 h-12" />
                <div>
                  <h2 className="text-xl font-bold">{t('subscriptions')}</h2>
                  <p className="text-muted-foreground">{t('subscriptionsDesc')}</p>
                </div>
              </CardContent>
            </Link>
          </Card>
          <Card>
            <Link href="/account/APIKEY">
              <CardContent className="flex items-start gap-4 p-6">
                <Key className="w-12 h-12" />
                <div>
                  <h2 className="text-xl font-bold">{t('apiKeysAndApps')}</h2>
                  <p className="text-muted-foreground">{t('apiKeysAndAppsDesc')}</p>
                </div>
              </CardContent>
            </Link>
          </Card>
          <Card>
            <Link href="/account/developers">
              <CardContent className="flex items-start gap-4 p-6">
                <Codepen className="w-12 h-12" />
                <div>
                  <h2 className="text-xl font-bold">{t('developers')}</h2>
                  <p className="text-muted-foreground">{t('developersdesc')}</p>
                </div>
              </CardContent>
            </Link>
          </Card>
          {session?.user?.role === 'SELLER' ? (
            <Card>
              <Link href="/seller/dashboard">
                <CardContent className="flex items-start gap-4 p-6">
                  <Briefcase className="w-12 h-12" />
                  <div>
                    <h2 className="text-xl font-bold">{t('sellerDashboard')}</h2>
                    <p className="text-muted-foreground">{t('sellerDashboardDesc')}</p>
                  </div>
                </CardContent>
              </Link>
            </Card>
          ) : (
            <Card>
              <Link href="/seller/registration">
                <CardContent className="flex items-start gap-4 p-6">
                  <Briefcase className="w-12 h-12" />
                  <div>
                    <h2 className="text-xl font-bold">{t('startSelling')}</h2>
                    <p className="text-muted-foreground">{t('startSellingDesc')}</p>
                  </div>
                </CardContent>
              </Link>
            </Card>
          )}
        </div>
        {(session?.user?.role === 'Admin' || session?.user?.role === 'SELLER') && (
          <div className="mt-8">
            <h2 className="text-xl font-bold">{t('yourRole')}</h2>
            <p className="text-muted-foreground">
              {t('loggedInAs', { role: session.user.role })}
            </p>
          </div>
        )}
        {session?.user?.id && (
          <div className="mt-8">
            <h2 className="text-xl font-bold">{t('pointsBalance')}</h2>
            <p className="text-muted-foreground">{t('currentPoints', { points: pointsBalance })}</p>
            <h3 className="text-lg font-bold mt-4">{t('pointsHistory')}</h3>
            <div className="mt-2">
              {pointsHistory.length > 0 ? (
                <ul className="space-y-2">
                  {pointsHistory.map((tx) => (
                    <li key={tx._id} className="border-b py-2">
                      <p>{tx.description}</p>
                      <p>
                        {tx.type === 'earn' ? '+' : '-'}{tx.amount} {t('points')} {t('on')} {formatDateTime(tx.createdAt).dateTime}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>{t('noPoints')}</p>
              )}
            </div>
          </div>
        )}
        <BrowsingHistoryList className="mt-16" />
      </div>
    );
  }