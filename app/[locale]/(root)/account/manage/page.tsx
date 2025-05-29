import { Metadata } from 'next';
// import { getToken } from "next-auth/jwt";
import { headers } from 'next/headers'; // لجلب الهيدر بشكل متزامن
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { getToken } from 'next-auth/jwt';

const PAGE_TITLE = 'Login & Security';
export const metadata: Metadata = {
  title: PAGE_TITLE,
};

export default async function ProfilePage() {
  let user;

  try {
    const headersList = headers(); // جلب الهيدر من الطلب
    const token = await getToken({ req: { headers: headersList }, secret: process.env.NEXTAUTH_SECRET }); // تمرير secret
    if (token) {
      user = {
        name: token.name || "Guest",
        email: token.email || "Not provided",
      };
    }
  } catch (error) {
    console.error("Error fetching token:", error);
    throw new Error("Unable to fetch session. Please check your configuration.");
  }

  if (!user) {
    return <div>User is not authenticated</div>;
  }

  return (
    <div className="mb-24">
      <div className="flex gap-2 ">
        <Link href="/account">Your Account</Link>
        <span>›</span>
        <span>{PAGE_TITLE}</span>
      </div>
      <h1 className="h1-bold py-4">{PAGE_TITLE}</h1>
      <Card className="max-w-2xl ">
        <CardContent className="p-4 flex justify-between flex-wrap">
          <div>
            <h3 className="font-bold">Name</h3>
            <p>{user.name}</p>
          </div>
          <div>
            <Link href="/account/manage/name">
              <Button className="rounded-full w-32" variant="outline">
                Edit
              </Button>
            </Link>
          </div>
        </CardContent>
        <Separator />
        <CardContent className="p-4 flex justify-between flex-wrap">
          <div>
            <h3 className="font-bold">Email</h3>
            <p>{user.email}</p>
            <p>will be implemented in the next version</p>
          </div>
          <div>
            <Link href="#">
              <Button disabled className="rounded-full w-32" variant="outline">
                Edit
              </Button>
            </Link>
          </div>
        </CardContent>
        <Separator />
        <CardContent className="p-4 flex justify-between flex-wrap">
          <div>
            <h3 className="font-bold">Password</h3>
            <p>************</p>
            <p>will be implemented in the next version</p>
          </div>
          <div>
            <Link href="#">
              <Button disabled className="rounded-full w-32" variant="outline">
                Edit
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}